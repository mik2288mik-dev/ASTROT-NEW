import {
  createAppSessionToken,
  requireAppUser,
} from '../lib/auth/appAuth';

const originalDatabaseUrl = process.env.DATABASE_URL;

function request(headers: Record<string, string>) {
  return { headers, query: {}, body: {} } as any;
}

describe('app session authentication priority', () => {
  beforeAll(() => {
    process.env.APP_SESSION_SECRET = 'test-app-session-secret-that-is-long-enough';
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
    else delete process.env.DATABASE_URL;
  });

  it('uses an app session before raw Telegram initData', async () => {
    const token = createAppSessionToken({
      userId: '-42',
      sessionId: 'guest-session',
      provider: 'web_guest',
    });

    await expect(requireAppUser(request({
      cookie: `lumia_app_session=${token}`,
      'x-telegram-init-data': 'invalid-init-data-that-must-not-be-read',
    }), { allowGuest: true })).resolves.toMatchObject({
      userId: '-42',
      sessionId: 'guest-session',
      provider: 'web_guest',
    });
  });

  it('never falls back to Telegram when an explicit app session is invalid', async () => {
    await expect(requireAppUser(request({
      cookie: 'lumia_app_session=invalid-token',
      'x-telegram-init-data': 'another-auth-mechanism-must-not-be-used',
    }), { allowGuest: true })).rejects.toMatchObject({
      status: 401,
      code: 'APP_SESSION_INVALID',
    });
  });

  it('rejects a malformed Authorization header instead of using another credential', async () => {
    const validCookie = createAppSessionToken({
      userId: '-42',
      sessionId: 'guest-session',
      provider: 'web_guest',
    });

    await expect(requireAppUser(request({
      authorization: 'Basic not-an-app-session',
      cookie: `lumia_app_session=${validCookie}`,
      'x-telegram-init-data': 'another-auth-mechanism-must-not-be-used',
    }), { allowGuest: true })).rejects.toMatchObject({
      status: 401,
      code: 'APP_SESSION_INVALID',
    });
  });
});
