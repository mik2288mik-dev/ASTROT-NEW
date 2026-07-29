const getVerifiedTelegramUser = jest.fn();
const handleAdminError = jest.fn((res: any, error: any) => (
  res.status(error?.status || 500).json({ error: error?.code || 'INTERNAL_SERVER_ERROR' })
));
const resolveTelegramIdentityForLogin = jest.fn();
const createAppUserSession = jest.fn();
const setAppSessionCookie = jest.fn();
const toPublicAppProfile = jest.fn();
const getUser = jest.fn();

jest.mock('../lib/adminAuth', () => ({
  getVerifiedTelegramUser,
  handleAdminError,
}));
jest.mock('../lib/auth/accountIdentity', () => ({
  resolveTelegramIdentityForLogin,
}));
jest.mock('../lib/auth/appAuth', () => ({
  createAppUserSession,
  setAppSessionCookie,
}));
jest.mock('../lib/auth/profile', () => ({
  toPublicAppProfile,
}));
jest.mock('../lib/db', () => ({
  db: { users: { get: getUser } },
}));

import handler from '../pages/api/auth/telegram/login';

function response() {
  const res: any = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('explicit Telegram login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getVerifiedTelegramUser.mockReturnValue({
      id: '777',
      rawUser: { id: 777, first_name: 'Mik', username: 'mik' },
    });
    resolveTelegramIdentityForLogin.mockResolvedValue({
      userId: '-42',
      linked: false,
      existing: true,
    });
    createAppUserSession.mockResolvedValue({
      token: 'signed-random-session',
      sessionId: 'random-session-id',
      expiresAt: 123,
    });
    getUser.mockResolvedValue({ id: '-42', name: 'Mik', is_guest: false });
    toPublicAppProfile.mockReturnValue({ id: '-42', name: 'Mik', isGuest: false });
  });

  it('returns the canonical linked account with a random revocable web session', async () => {
    const res = response();
    await handler({
      method: 'POST',
      headers: { cookie: 'lumia_app_session=old-session' },
      body: { initData: 'verified-by-admin-auth' },
    } as any, res);

    expect(getVerifiedTelegramUser).toHaveBeenCalledWith(expect.objectContaining({
      headers: expect.objectContaining({ 'x-telegram-init-data': 'verified-by-admin-auth' }),
    }));
    expect(resolveTelegramIdentityForLogin).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'telegram', subject: '777' }),
      '777',
    );
    expect(createAppUserSession).toHaveBeenCalledWith({
      userId: '-42',
      kind: 'web',
      deviceId: null,
    });
    expect(setAppSessionCookie).toHaveBeenCalledWith(res, 'signed-random-session');
    expect(getUser).toHaveBeenCalledWith('-42');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      token: undefined,
      profile: { id: '-42', name: 'Mik', isGuest: false },
    });
  });

  it('returns the token only for an explicit native login', async () => {
    const res = response();
    await handler({
      method: 'POST',
      headers: {},
      body: { initData: 'verified-by-admin-auth', native: true, deviceId: 'device-1' },
    } as any, res);

    expect(createAppUserSession).toHaveBeenCalledWith({
      userId: '-42',
      kind: 'native',
      deviceId: 'device-1',
    });
    expect(setAppSessionCookie).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      token: 'signed-random-session',
    }));
  });
});
