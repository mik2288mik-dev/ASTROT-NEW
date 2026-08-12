const mockPoolQuery = jest.fn();
const mockDbUserGet = jest.fn();
const mockAssertAppSessionActive = jest.fn();
const mockPersistAppSession = jest.fn();
const mockResolveTelegramIdentityForLogin = jest.fn();
const mockRevokeSessions = jest.fn();
const mockGetVerifiedTelegramUser = jest.fn();

jest.mock('../lib/db', () => ({
  db: {
    users: {
      get: mockDbUserGet,
      set: jest.fn(),
    },
  },
  getPool: () => ({ query: mockPoolQuery }),
}));

jest.mock('../lib/auth/accountIdentity', () => ({
  assertAppSessionActive: mockAssertAppSessionActive,
  persistAppSession: mockPersistAppSession,
  resolveTelegramIdentityForLogin: mockResolveTelegramIdentityForLogin,
  revokeSessions: mockRevokeSessions,
  telegramIdentityBelongsToUser: jest.fn(),
}));

jest.mock('../lib/adminAuth', () => {
  class AdminAuthError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return {
    AdminAuthError,
    getVerifiedTelegramUser: mockGetVerifiedTelegramUser,
  };
});

import {
  createAppSessionToken,
  requireAppUser,
} from '../lib/auth/appAuth';

const originalDatabaseUrl = process.env.DATABASE_URL;

describe('blocked account session enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://test';
    process.env.APP_SESSION_SECRET = 'blocked-session-test-secret-that-is-long-enough';
    mockPoolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('app_session_revocations')) return { rowCount: 0, rows: [] };
      if (sql.includes('FROM users')) {
        return { rowCount: 1, rows: [{ is_guest: false, is_blocked: true }] };
      }
      return { rowCount: 1, rows: [] };
    });
    mockDbUserGet.mockResolvedValue({ id: '42', is_guest: false, is_blocked: true });
    mockRevokeSessions.mockResolvedValue(1);
    mockResolveTelegramIdentityForLogin.mockResolvedValue({ userId: '42' });
    mockGetVerifiedTelegramUser.mockReturnValue({
      id: '42',
      rawUser: { first_name: 'Blocked', last_name: 'User' },
    });
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
    else delete process.env.DATABASE_URL;
  });

  it('rejects and revokes an already active bearer session for a blocked account', async () => {
    const token = createAppSessionToken({
      userId: '42',
      sessionId: 'native-session-42',
      provider: 'native',
    });

    await expect(requireAppUser({
      headers: { authorization: `Bearer ${token}` },
      query: {},
      body: {},
    } as any, { allowGuest: true })).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_BLOCKED',
    });

    expect(mockRevokeSessions).toHaveBeenCalledWith('42', 'native-session-42');
  });

  it('applies the same blocked-account guard to Telegram proof sessions', async () => {
    await expect(requireAppUser({
      headers: { 'x-telegram-init-data': 'signed-telegram-proof' },
      query: {},
      body: {},
    } as any, { allowGuest: true })).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_BLOCKED',
    });

    expect(mockRevokeSessions).toHaveBeenCalledWith(
      '42',
      expect.stringMatching(/^telegram:[a-f0-9]{64}$/),
    );
  });
});
