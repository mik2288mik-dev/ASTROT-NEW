const mockUser = jest.fn();
const mockRecord = jest.fn();
const mockQuery = jest.fn();
const mockRelease = jest.fn();
jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: (...args: unknown[]) => mockUser(...args) }));
jest.mock('../lib/db', () => ({ getPool: () => ({ connect: async () => ({ query: mockQuery, release: mockRelease }) }) }));
import handler from '../pages/api/users/activity';
import { recordActivityPulse } from '../lib/productActivityRepository';
import type { ActivityPulse } from '../lib/productActivity';
const pulse: ActivityPulse = { sessionId: '018f1234-5678-4abc-8def-0123456789ab',
  eventId: '018f1234-5678-4abc-8def-0123456789ac', sequence: 1, totalActiveMs: 30_000,
  screen: 'dashboard', state: 'active' };
function response() { const res: any = { setHeader: jest.fn() }; res.status = jest.fn(() => res); res.json = jest.fn(() => res); return res; }
describe('activity persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser.mockResolvedValue({ userId: '42', provider: 'web' });
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT payload_json')) return { rows: [{ payload_json: { sequence: 0, total_active_ms: 0 }, received_ms: 10000, server_now_ms: 40000 }] };
      if (sql.includes('INSERT INTO user_app_events')) return { rows: [{ id: 1 }] };
      return { rows: [] };
    });
  });
  it('uses authenticated identity, stores bounded time and commits a matching visit', async () => {
    const res = response();
    await handler({ method: 'POST', headers: {}, body: { ...pulse, userId: '99', text: 'secret' } } as any, res);
    expect(res.status).toHaveBeenCalledWith(200);
    const event = mockQuery.mock.calls.find(([sql]) => sql.includes('INSERT INTO user_app_events'))!;
    expect(event[1][0]).toBe('42');
    expect(JSON.parse(event[1][3])).toMatchObject({ active_ms: 30000, session_id: pulse.sessionId, runtime: 'web' });
    expect(event[1][3]).not.toContain('secret');
    expect(mockQuery.mock.calls.some(([sql]) => sql.includes('INSERT INTO user_sessions'))).toBe(true);
    expect(mockQuery).toHaveBeenLastCalledWith('COMMIT');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
  it('coalesces repeated sequences without writing another interval or visit', async () => {
    await recordActivityPulse('42', { ...pulse, sequence: 0 }, { runtime: 'web' });
    expect(mockQuery.mock.calls.some(([sql]) => sql.includes('INSERT'))).toBe(false);
  });
  it('rolls back heartbeat if visit persistence fails', async () => {
    const original = mockQuery.getMockImplementation()!;
    mockQuery.mockImplementation(async (sql: string, ...args: unknown[]) => {
      if (sql.includes('INSERT INTO user_sessions')) throw new Error('db unavailable');
      return original(sql, ...args);
    });
    await expect(recordActivityPulse('42', pulse, { runtime: 'web' })).rejects.toThrow('db unavailable');
    expect(mockQuery).toHaveBeenLastCalledWith('ROLLBACK');
    expect(mockRelease).toHaveBeenCalled();
  });
  it('never records a rejected or invalid-auth request', async () => {
    mockUser.mockRejectedValue({ status: 401, code: 'APP_AUTH_REQUIRED' });
    const res = response();
    await handler({ method: 'POST', headers: {}, body: pulse } as any, res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
