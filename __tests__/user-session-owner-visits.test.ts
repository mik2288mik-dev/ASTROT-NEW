const mockRequireAppUser = jest.fn();
const mockRecordLogin = jest.fn();
const mockUpsert = jest.fn();
const mockConnect = jest.fn();
const mockEnqueue = jest.fn();
const mockWake = jest.fn();
const mockEnabled = jest.fn();
const mockTracker = jest.fn();

jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: (...args: unknown[]) => mockRequireAppUser(...args) }));
jest.mock('../lib/db', () => ({
  getPool: () => ({ connect: () => mockConnect() }),
  db: {
    users: { recordLogin: (...args: unknown[]) => mockRecordLogin(...args) },
    user_sessions: { upsert: (...args: unknown[]) => mockUpsert(...args) },
  },
}));
jest.mock('../lib/neboOps', () => ({
  enqueueNeboOpsEvent: (...args: unknown[]) => mockEnqueue(...args),
  wakeNeboOpsDelivery: () => mockWake(),
  isNeboOpsEnabled: () => mockEnabled(),
}));
jest.mock('../lib/myTracker', () => ({ getOrCreateMyTrackerUserId: (...args: unknown[]) => mockTracker(...args) }));

import handler from '../pages/api/users/session';

type Visit = { session_id: string; device_label: string; last_seen_at: Date };
const sessions = new Map<string, Visit>();
let now: number;
let lockTail: Promise<void>;
let recentAuth: boolean;
let outboxUnavailable: boolean;
let statements: string[];
const releases: jest.Mock[] = [];

function response() {
  const res: any = { setHeader: jest.fn() };
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}
function request(sessionId = 'device-session-1') {
  return { method: 'POST', headers: {}, body: { sessionId } } as any;
}
async function call(sessionId?: string) {
  const res = response();
  await handler(request(sessionId), res);
  return res;
}

describe('existing APK session visits notify the owner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessions.clear();
    releases.length = 0;
    statements = [];
    now = Date.parse('2026-09-09T09:00:00Z');
    lockTail = Promise.resolve();
    recentAuth = false;
    outboxUnavailable = false;
    mockRequireAppUser.mockResolvedValue({ userId: '-42', provider: 'native', sessionId: 'saved-auth-session' });
    mockRecordLogin.mockResolvedValue(undefined);
    mockEnqueue.mockResolvedValue(undefined);
    mockEnabled.mockReturnValue(true);
    mockWake.mockImplementation(() => statements.push('WAKE'));
    mockTracker.mockResolvedValue(null);
    mockUpsert.mockImplementation(async (userId: string, sessionId: string) => {
      statements.push('UPSERT');
      const stored = { session_id: sessionId, device_label: 'Android', last_seen_at: new Date(now) };
      sessions.set(`${userId}:${sessionId}`, stored);
      return stored;
    });
    mockConnect.mockImplementation(async () => {
      let unlock: (() => void) | undefined;
      const release = jest.fn();
      releases.push(release);
      return {
        release,
        query: jest.fn(async (sql: string, params: string[] = []) => {
          statements.push(sql);
          if (sql.includes('pg_advisory_xact_lock')) {
            const before = lockTail;
            lockTail = new Promise<void>((resolve) => { unlock = resolve; });
            await before;
          }
          if (sql.includes('FROM user_sessions')) {
            const previous = sessions.get(`${params[0]}:${params[1]}`);
            return { rows: previous ? [{
              ...previous,
              visit_expired: previous.last_seen_at.getTime() <= now - 30 * 60_000,
            }] : [] };
          }
          if (sql.includes('FROM nebo_ops_outbox')) {
            if (outboxUnavailable) throw new Error('PRIVATE_STORAGE_ERROR');
            return { rows: recentAuth ? [{ '?column?': 1 }] : [] };
          }
          if (sql === 'COMMIT' || sql === 'ROLLBACK') unlock?.();
          return { rows: [] };
        }),
      };
    });
  });

  it('announces a visit with an existing auth token and keeps the APK response unchanged', async () => {
    const res = await call();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      session: { sessionId: 'device-session-1', deviceLabel: 'Android', lastSeenAt: new Date(now) },
    });
    expect(mockEnqueue).toHaveBeenCalledWith(expect.anything(), {
      eventKey: expect.stringMatching(/^visit:[0-9a-f-]{36}$/), eventType: 'activity', userId: '-42',
      payload: { eventType: 'app_open', runtime: 'native' },
    });
    expect(mockUpsert.mock.calls[0][2].queryClient.query).toEqual(expect.any(Function));
    expect(statements.indexOf('COMMIT')).toBeLessThan(statements.indexOf('WAKE'));
    expect(releases[0]).toHaveBeenCalledTimes(1);
  });

  it('does not repeat an alert on retry or a short foreground resume', async () => {
    await call();
    await call();
    now += 60_000;
    await call();
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(3);
  });

  it('serializes two concurrent first requests before checking and persisting the session', async () => {
    const responses = await Promise.all([call(), call()]);
    expect(responses.every((res) => res.status.mock.calls[0][0] === 200)).toBe(true);
    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    expect(sessions.size).toBe(1);
    expect(releases.every((release) => release.mock.calls.length === 1)).toBe(true);
  });

  it('announces a return to the same WebView after thirty minutes of silence', async () => {
    await call();
    now += 30 * 60_000;
    await call();
    await call();
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockEnqueue.mock.calls[0][1].eventKey).not.toBe(mockEnqueue.mock.calls[1][1].eventKey);
  });

  it('announces a new device session even when the auth token is reused', async () => {
    await call('device-session-1');
    await call('device-session-2');
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
  });

  it('does not duplicate the login alert just created for the same auth session', async () => {
    recentAuth = true;
    const res = await call();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockWake).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const authQuery = statements.find((sql) => sql.includes('FROM nebo_ops_outbox'))!;
    expect(authQuery).toContain("INTERVAL '5 minutes'");
    expect(authQuery).toContain("status <> 'dead'");
  });

  it('does not couple a broken outbox to the existing session endpoint', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    outboxUnavailable = true;
    const res = await call();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(statements).toContain('ROLLBACK TO SAVEPOINT nebo_visit_notification');
    expect(statements).toContain('COMMIT');
    expect(mockWake).not.toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain('PRIVATE_STORAGE_ERROR');
    warn.mockRestore();
  });

  it('rolls back a failed session write without announcing the visit', async () => {
    mockUpsert.mockRejectedValueOnce(new Error('session unavailable'));
    const res = await call();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(statements).toContain('ROLLBACK');
    expect(statements).not.toContain('COMMIT');
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('preserves the owner opt-out without opening an outbox transaction', async () => {
    mockEnabled.mockReturnValue(false);
    const res = await call();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockWake).not.toHaveBeenCalled();
    expect(mockUpsert.mock.calls[0][2]).not.toHaveProperty('queryClient');
  });

  it('still returns native MyTracker identification to existing clients', async () => {
    mockTracker.mockResolvedValue('tracker-id');
    const req = request();
    req.body.analyticsProvider = 'mytracker';
    const res = response();
    await handler(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ analyticsUserId: 'tracker-id' }));
  });

  it('rejects a missing session identifier and unauthorized callers before tracking', async () => {
    const missing = await call('  ');
    expect(missing.status).toHaveBeenCalledWith(400);
    mockRequireAppUser.mockRejectedValueOnce({ status: 401, code: 'APP_SESSION_EXPIRED' });
    const unauthorized = await call();
    expect(unauthorized.status).toHaveBeenCalledWith(401);
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
