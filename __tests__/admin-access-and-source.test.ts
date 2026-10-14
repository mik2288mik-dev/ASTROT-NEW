const mockQuery = jest.fn();
const mockRequireAppUser = jest.fn();
const mockGetVerifiedTelegramUser = jest.fn();
const mockRunWithScopedPool = jest.fn((_pool: unknown, fn: () => unknown) => fn());

class MockAdminAuthError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

jest.mock('../lib/adminAuth', () => ({
  AdminAuthError: MockAdminAuthError,
  getVerifiedTelegramUser: (...args: unknown[]) => mockGetVerifiedTelegramUser(...args),
  getConfiguredOwnerId: () => '777',
  handleAdminError: (res: any, error: any) => res.status(error.status || 500).json({ error: error.code }),
}));
jest.mock('../lib/auth/appAuth', () => ({ requireAppUser: (...args: unknown[]) => mockRequireAppUser(...args) }));
jest.mock('../lib/db', () => ({
  getPool: () => ({ query: mockQuery }),
  getPrimaryPool: () => ({ query: mockQuery }),
  runWithScopedPool: (pool: unknown, fn: () => unknown) => mockRunWithScopedPool(pool, fn),
}));

import { getAdminContext } from '../lib/admin/rbac';
import { requestedAdminSource, withAdminSource } from '../lib/admin/dataSource';
import { telegramAdminOrigin, verifiedRelayIdentity } from '../lib/admin/adminRelay';

const response = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('admin sign-in with the app account', () => {
  beforeEach(() => jest.clearAllMocks());

  it('recognizes the owner by the Telegram identity linked to the app account', async () => {
    mockRequireAppUser.mockResolvedValue({ userId: '-42', isGuest: false });
    mockQuery.mockResolvedValueOnce({ rows: [{ provider_subject: '777' }] });
    const ctx = await getAdminContext({ headers: { cookie: 'lumia_app_session=abc' }, query: {} } as any);
    expect(ctx).toMatchObject({ userId: '-42', role: 'super_admin', isOwner: true });
    expect(mockGetVerifiedTelegramUser).not.toHaveBeenCalled();
  });

  it('refuses an ordinary app account', async () => {
    mockRequireAppUser.mockResolvedValue({ userId: '-43', isGuest: false });
    mockQuery.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ role: null, is_admin: false }] });
    await expect(getAdminContext({ headers: { authorization: 'Bearer x' }, query: {} } as any)).rejects.toMatchObject({ status: 403 });
  });

  it('checks access once per request', async () => {
    mockRequireAppUser.mockResolvedValue({ userId: '777', isGuest: false });
    mockQuery.mockResolvedValue({ rows: [] });
    const req = { headers: { cookie: 'lumia_app_session=abc' }, query: {} } as any;
    await getAdminContext(req);
    await getAdminContext(req);
    expect(mockRequireAppUser).toHaveBeenCalledTimes(1);
  });
});

describe('Telegram version data switch', () => {
  const env = process.env.NEBO_TELEGRAM_DATABASE_URL;
  afterEach(() => { process.env.NEBO_TELEGRAM_DATABASE_URL = env; jest.clearAllMocks(); });

  it('reads the source from the header and defaults to this server', () => {
    expect(requestedAdminSource({ headers: { 'x-admin-source': 'telegram' }, query: {} } as any)).toBe('telegram');
    expect(requestedAdminSource({ headers: {}, query: {} } as any)).toBe('main');
  });

  it('never lets the admin change the other database', async () => {
    process.env.NEBO_TELEGRAM_DATABASE_URL = 'postgresql://user:pass@example.test/db';
    const handler = jest.fn();
    const res = response();
    await withAdminSource(handler)({ method: 'PATCH', headers: { 'x-admin-source': 'telegram' }, query: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(handler).not.toHaveBeenCalled();
  });

  it('explains when the Telegram database is not connected', async () => {
    delete process.env.NEBO_TELEGRAM_DATABASE_URL;
    const res = response();
    await withAdminSource(jest.fn())({ method: 'GET', headers: { 'x-admin-source': 'telegram' }, query: {} } as any, res);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('checks access on this server before reading the other database', async () => {
    process.env.NEBO_TELEGRAM_DATABASE_URL = 'postgresql://user:pass@example.test/db';
    mockRequireAppUser.mockResolvedValue({ userId: '777', isGuest: false });
    mockQuery.mockResolvedValue({ rows: [] });
    const handler = jest.fn();
    await withAdminSource(handler)({ method: 'GET', headers: { 'x-admin-source': 'telegram', cookie: 'lumia_app_session=a' }, query: {} } as any, response());
    expect(mockRequireAppUser).toHaveBeenCalled();
    expect(mockRunWithScopedPool).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('reading the Telegram server through a signed relay', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; jest.restoreAllMocks(); });

  it('relays only from the live server, never from Railway itself', () => {
    expect(telegramAdminOrigin({ NEBO_OPS_WEBHOOK_SECRET: 's'.repeat(40) } as any)).toBe('https://astrot-production.up.railway.app');
    expect(telegramAdminOrigin({ NEBO_OPS_WEBHOOK_SECRET: 's'.repeat(40), RAILWAY_PROJECT_ID: 'x' } as any)).toBe('');
    expect(telegramAdminOrigin({ NEBO_OPS_WEBHOOK_SECRET: 'short' } as any)).toBe('');
  });

  it('accepts a fresh signed read for the same address and nothing else', async () => {
    process.env.NEBO_OPS_WEBHOOK_SECRET = 's'.repeat(40);
    delete process.env.NEBO_TELEGRAM_DATABASE_URL;
    delete process.env.RAILWAY_PROJECT_ID;
    delete process.env.RAILWAY_ENVIRONMENT_ID;
    const fetchMock = jest.spyOn(global, 'fetch' as any).mockResolvedValue({ status: 200, text: async () => '{"ok":true}' } as any);
    mockRequireAppUser.mockResolvedValue({ userId: '777', isGuest: false });
    mockQuery.mockResolvedValue({ rows: [] });
    const res = response();
    res.setHeader = jest.fn(); res.send = jest.fn(() => res);
    await withAdminSource(jest.fn())({ method: 'GET', url: '/api/admin/v2/overview?range=7d', headers: { 'x-admin-source': 'telegram', cookie: 'lumia_app_session=a' }, query: {} } as any, res);
    expect(res.send).toHaveBeenCalledWith('{"ok":true}');
    const [url, init] = fetchMock.mock.calls[0] as any[];
    expect(url).toBe('https://astrot-production.up.railway.app/api/admin/v2/overview?range=7d');
    const relayed = { method: 'GET', url: '/api/admin/v2/overview?range=7d', headers: init.headers } as any;
    expect(verifiedRelayIdentity(relayed)).toEqual({ role: 'super_admin', userId: '777' });
    expect(verifiedRelayIdentity({ ...relayed, method: 'POST' })).toBeNull();
    expect(verifiedRelayIdentity({ ...relayed, url: '/api/admin/v2/users' })).toBeNull();
    expect(verifiedRelayIdentity({ ...relayed, headers: { ...init.headers, 'x-admin-relay-role': 'admin' } })).toBeNull();
    expect(verifiedRelayIdentity({ ...relayed, headers: { ...init.headers, 'x-admin-relay-ts': String(Date.now() - 120_000) } })).toBeNull();
  });
});
