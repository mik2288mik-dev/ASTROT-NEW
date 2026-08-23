const getVerifiedTelegramUser = jest.fn();
const handleAdminError = jest.fn((res: any, error: any) => (
  res.status(error?.status || 500).json({ error: error?.code || 'INTERNAL_SERVER_ERROR' })
));
const requireAppUser = jest.fn();
const createAppUserSession = jest.fn();
const setAppSessionCookie = jest.fn();
const resolveVerifiedIdentity = jest.fn();
const toPublicAppProfile = jest.fn();
const getUser = jest.fn();

jest.mock('../lib/adminAuth', () => ({
  getVerifiedTelegramUser,
  handleAdminError,
}));
jest.mock('../lib/auth/appAuth', () => ({
  requireAppUser,
  createAppUserSession,
  setAppSessionCookie,
}));
jest.mock('../lib/auth/accountIdentity', () => ({ resolveVerifiedIdentity }));
jest.mock('../lib/auth/profile', () => ({ toPublicAppProfile }));
jest.mock('../lib/db', () => ({ db: { users: { get: getUser } } }));

import handler from '../pages/api/auth/telegram/link';

function response() {
  const res: any = {
    status: jest.fn(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('Telegram identity linking session rotation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getVerifiedTelegramUser.mockReturnValue({
      id: '777',
      rawUser: { id: 777, first_name: 'Mik' },
    });
    requireAppUser.mockResolvedValue({
      userId: '-42',
      provider: 'web_guest',
      isGuest: true,
      sessionId: 'anonymous-session',
    });
    resolveVerifiedIdentity.mockResolvedValue({
      userId: '-42',
      linked: true,
      existing: false,
    });
    createAppUserSession.mockResolvedValue({
      token: 'rotated-session-token',
      sessionId: 'rotated-session-id',
      expiresAt: 123,
    });
    getUser.mockResolvedValue({ id: '-42', is_guest: false });
    toPublicAppProfile.mockReturnValue({ id: '-42', isGuest: false });
  });

  it('returns a fresh session after upgrading a guest in place', async () => {
    const res = response();
    await handler({
      method: 'POST',
      headers: {
        cookie: 'lumia_app_session=anonymous-token',
        'x-telegram-init-data': 'must-be-separated-from-current-session',
      },
      body: { initData: 'verified-telegram-proof' },
    } as any, res);

    expect(requireAppUser).toHaveBeenCalledWith(expect.objectContaining({
      headers: expect.not.objectContaining({ 'x-telegram-init-data': expect.anything() }),
    }), { allowGuest: true });
    expect(resolveVerifiedIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'telegram', subject: '777' }),
      '-42',
      {
        requiredSession: {
          userId: '-42',
          sessionId: 'anonymous-session',
        },
      },
    );
    expect(createAppUserSession).toHaveBeenCalledWith({
      userId: '-42',
      kind: 'web',
      sessionVersion: 1,
    });
    expect(setAppSessionCookie).toHaveBeenCalledWith(res, 'rotated-session-token');
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      userId: '-42',
      token: undefined,
      profile: { id: '-42', isGuest: false },
    });
  });

  it('keeps an already registered session when adding another identity', async () => {
    requireAppUser.mockResolvedValue({
      userId: '-42',
      provider: 'web_guest',
      isGuest: false,
      sessionId: 'registered-session',
    });
    const res = response();
    await handler({
      method: 'POST',
      headers: { cookie: 'lumia_app_session=registered-token' },
      body: { initData: 'verified-telegram-proof' },
    } as any, res);

    expect(resolveVerifiedIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'telegram', subject: '777' }),
      '-42',
      {
        requiredSession: {
          userId: '-42',
          sessionId: 'registered-session',
        },
      },
    );
    expect(createAppUserSession).not.toHaveBeenCalled();
    expect(setAppSessionCookie).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
