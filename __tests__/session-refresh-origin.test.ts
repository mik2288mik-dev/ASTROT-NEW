const clearAppSessionCookie = jest.fn();
const readAppRefreshCookie = jest.fn(() => 'refresh-token');
const readAppSessionCookie = jest.fn(() => '');
const setAppSessionCookie = jest.fn();
const refreshAppUserSession = jest.fn();

jest.mock('../lib/auth/appAuth', () => ({
  clearAppSessionCookie,
  readAppRefreshCookie,
  readAppSessionCookie,
  setAppSessionCookie,
}));
jest.mock('../lib/auth/appSessionRefresh', () => ({ refreshAppUserSession }));

import handler from '../pages/api/auth/session/refresh';

function response() {
  const res: any = {
    setHeader: jest.fn(),
    getHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('web session refresh origin', () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const previousNodeEnv = mutableEnv.NODE_ENV;
  const previousPublicOrigin = mutableEnv.PUBLIC_APP_ORIGIN;

  beforeEach(() => {
    jest.clearAllMocks();
    mutableEnv.NODE_ENV = 'production';
    mutableEnv.PUBLIC_APP_ORIGIN = 'https://astrot-production.up.railway.app';
    refreshAppUserSession.mockResolvedValue({
      token: 'access-token',
      refreshToken: 'next-refresh-token',
      sessionVersion: 2,
      expiresAt: 100,
      refreshExpiresAt: 200,
      absoluteExpiresAt: 300,
    });
  });

  afterAll(() => {
    if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
    else mutableEnv.NODE_ENV = previousNodeEnv;
    if (previousPublicOrigin === undefined) delete mutableEnv.PUBLIC_APP_ORIGIN;
    else mutableEnv.PUBLIC_APP_ORIGIN = previousPublicOrigin;
  });

  it('accepts the actual same-origin custom domain behind Railway', async () => {
    const res = response();
    await handler({
      method: 'POST',
      headers: {
        origin: 'https://tvoi-goroskop.ru',
        host: 'tvoi-goroskop.ru',
        'x-forwarded-proto': 'https',
      },
    } as any, res);

    expect(refreshAppUserSession).toHaveBeenCalledWith({
      credential: 'refresh-token',
      expectedKind: 'web',
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('still rejects a cross-origin refresh request', async () => {
    const res = response();
    await handler({
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        host: 'tvoi-goroskop.ru',
        'x-forwarded-proto': 'https',
      },
    } as any, res);

    expect(refreshAppUserSession).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
