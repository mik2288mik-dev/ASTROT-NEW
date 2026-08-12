const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();
const mockConnect = jest.fn();
const mockPersistAppSession = jest.fn();

jest.mock('../lib/db', () => ({
  db: {
    users: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  getPool: () => ({
    connect: mockConnect,
    query: jest.fn(),
  }),
}));

jest.mock('../lib/auth/accountIdentity', () => ({
  assertAppSessionActive: jest.fn(),
  persistAppSession: mockPersistAppSession,
  resolveTelegramIdentityForLogin: jest.fn(),
  telegramIdentityBelongsToUser: jest.fn(),
}));

import { createAppUserSession, verifyAppSessionToken } from '../lib/auth/appAuth';

const originalDatabaseUrl = process.env.DATABASE_URL;

describe('app session issuance account guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_SESSION_SECRET = 'test-app-session-secret-that-is-long-enough';
    process.env.DATABASE_URL = 'postgres://test';
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
  });

  afterAll(() => {
    if (originalDatabaseUrl) process.env.DATABASE_URL = originalDatabaseUrl;
    else delete process.env.DATABASE_URL;
  });

  it('locks an active account before inserting its session in the same transaction', async () => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT is_blocked')) return { rowCount: 1, rows: [{ is_blocked: false }] };
      return { rowCount: 1, rows: [] };
    });

    const session = await createAppUserSession({ userId: '42', kind: 'native', deviceId: 'phone-1' });
    const statements = mockClientQuery.mock.calls.map(([sql]) => String(sql).trim());

    expect(statements[0]).toBe('BEGIN');
    expect(statements[1]).toContain('SELECT is_blocked');
    expect(statements[1]).toContain('FOR SHARE');
    expect(statements[2]).toContain('INSERT INTO app_sessions');
    expect(statements[3]).toBe('COMMIT');
    expect(verifyAppSessionToken(session.token)).toMatchObject({ userId: '42', provider: 'native' });
    expect(mockClientRelease).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a blocked account', { rowCount: 1, rows: [{ is_blocked: true }] }, { status: 403, code: 'ACCOUNT_BLOCKED' }],
    ['a missing account', { rowCount: 0, rows: [] }, { status: 401, code: 'APP_ACCOUNT_NOT_FOUND' }],
  ])('rolls back without issuing a session for %s', async (_label, accountResult, expectedError) => {
    mockClientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT is_blocked')) return accountResult;
      return { rowCount: 1, rows: [] };
    });

    await expect(createAppUserSession({ userId: '42', kind: 'web' })).rejects.toMatchObject(expectedError);
    const statements = mockClientQuery.mock.calls.map(([sql]) => String(sql));

    expect(statements.some((sql) => sql.includes('INSERT INTO app_sessions'))).toBe(false);
    expect(statements.at(-1)).toBe('ROLLBACK');
    expect(mockClientRelease).toHaveBeenCalledTimes(1);
  });

  it('preserves the local no-database session behavior', async () => {
    delete process.env.DATABASE_URL;

    const session = await createAppUserSession({ userId: '42', kind: 'web' });

    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockPersistAppSession).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: session.sessionId,
      userId: '42',
      kind: 'web',
    }));
    expect(verifyAppSessionToken(session.token)).toMatchObject({ userId: '42', provider: 'web_guest' });
  });
});
