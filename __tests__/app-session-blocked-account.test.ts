import fs from 'fs';
import path from 'path';

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
const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

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

    expect(mockRevokeSessions).toHaveBeenCalledWith('42');
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

    expect(mockRevokeSessions).toHaveBeenCalledWith('42');
  });

  it('keeps every pre-block session revoked after the account is unblocked', async () => {
    let blocked = true;
    const revoked = new Set<string>();
    const sessionIds = ['native-session-one', 'native-session-two'];
    mockPoolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('app_session_revocations')) return { rowCount: 0, rows: [] };
      if (sql.includes('FROM users')) {
        return { rowCount: 1, rows: [{ is_guest: false, is_blocked: blocked }] };
      }
      return { rowCount: 1, rows: [] };
    });
    mockDbUserGet.mockImplementation(async () => ({ id: '42', is_guest: false, is_blocked: blocked }));
    mockAssertAppSessionActive.mockImplementation(async (sessionId: string) => {
      if (revoked.has(sessionId)) {
        throw Object.assign(new Error('This session is no longer valid'), {
          status: 401,
          code: 'APP_SESSION_REVOKED',
        });
      }
    });
    mockRevokeSessions.mockImplementation(async (_userId: string, sessionId?: string) => {
      if (sessionId) revoked.add(sessionId);
      else sessionIds.forEach((id) => revoked.add(id));
      return sessionId ? 1 : sessionIds.length;
    });

    const firstToken = createAppSessionToken({
      userId: '42',
      sessionId: sessionIds[0],
      provider: 'native',
    });
    const secondToken = createAppSessionToken({
      userId: '42',
      sessionId: sessionIds[1],
      provider: 'native',
    });

    await expect(requireAppUser({
      headers: { authorization: `Bearer ${firstToken}` },
      query: {},
      body: {},
    } as any, { allowGuest: true })).rejects.toMatchObject({ code: 'ACCOUNT_BLOCKED' });

    blocked = false;
    await expect(requireAppUser({
      headers: { authorization: `Bearer ${secondToken}` },
      query: {},
      body: {},
    } as any, { allowGuest: true })).rejects.toMatchObject({
      status: 401,
      code: 'APP_SESSION_REVOKED',
    });
    expect(mockRevokeSessions).toHaveBeenCalledWith('42');
  });

  it('routes admin block transitions through one transactional account-status helper', () => {
    const identity = read('lib/auth/accountIdentity.ts');
    const adminRoute = read('pages/api/admin/v2/users/[id].ts');

    expect(identity).toContain('export async function setAccountBlockedState');
    expect(adminRoute).toContain('setAccountBlockedState');
    expect(adminRoute).not.toContain('patch.isBlocked = body.isBlocked');
  });
});
