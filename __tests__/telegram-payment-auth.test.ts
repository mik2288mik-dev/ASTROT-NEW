const getVerifiedTelegramUser = jest.fn();
const getPoolQuery = jest.fn();
const getUser = jest.fn();
const assertAppSessionActive = jest.fn();
const telegramIdentityBelongsToUser = jest.fn();

jest.mock('../lib/adminAuth', () => {
  class AdminAuthError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { AdminAuthError, getVerifiedTelegramUser };
});

jest.mock('../lib/db', () => ({
  db: { users: { get: getUser } },
  getPool: () => ({ query: getPoolQuery }),
}));

jest.mock('../lib/auth/accountIdentity', () => ({
  assertAppSessionActive,
  persistAppSession: jest.fn(),
  resolveTelegramIdentityForLogin: jest.fn(),
  telegramIdentityBelongsToUser,
}));

import {
  APP_SESSION_COOKIE,
  createAppSessionToken,
  requireTelegramPaymentUser,
} from '../lib/auth/appAuth';

describe('Telegram Stars canonical account authentication', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_SESSION_SECRET = 'telegram-payment-test-session-secret';
    process.env.DATABASE_URL = 'postgres://test.invalid/test';
    getVerifiedTelegramUser.mockReturnValue({
      id: '777',
      rawUser: { id: 777, first_name: 'Mik' },
    });
    getPoolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    getUser.mockResolvedValue({ id: '-42' });
    telegramIdentityBelongsToUser.mockResolvedValue(true);
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
    else delete process.env.DATABASE_URL;
  });

  function request() {
    const token = createAppSessionToken({
      userId: '-42',
      sessionId: 'canonical-session',
      provider: 'web_guest',
    });
    return {
      headers: {
        cookie: `${APP_SESSION_COOKIE}=${encodeURIComponent(token)}`,
        'x-telegram-init-data': 'signed-init-data',
      },
      query: {},
      body: {},
    } as any;
  }

  it('rejects Telegram proof without an independent app session', async () => {
    const req = request();
    delete req.headers.cookie;

    await expect(requireTelegramPaymentUser(req, '-42')).rejects.toMatchObject({
      status: 401,
      code: 'APP_AUTH_REQUIRED',
    });
    expect(telegramIdentityBelongsToUser).not.toHaveBeenCalled();
  });

  it('accepts a linked Telegram identity for a different canonical users.id', async () => {
    getPoolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT is_guest FROM users')) {
        return { rowCount: 1, rows: [{ is_guest: false }] };
      }
      return { rowCount: 0, rows: [] };
    });

    await expect(requireTelegramPaymentUser(request(), '-42')).resolves.toMatchObject({
      userId: '-42',
      telegramUserId: '777',
      isGuest: false,
    });
    expect(telegramIdentityBelongsToUser).toHaveBeenCalledWith('-42', '777');
  });

  it('rejects Stars when Telegram belongs to a different account', async () => {
    getPoolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT is_guest FROM users')) {
        return { rowCount: 1, rows: [{ is_guest: false }] };
      }
      return { rowCount: 0, rows: [] };
    });
    telegramIdentityBelongsToUser.mockResolvedValue(false);

    await expect(requireTelegramPaymentUser(request(), '-42')).rejects.toMatchObject({
      status: 403,
      code: 'TELEGRAM_IDENTITY_NOT_LINKED',
    });
  });
});
