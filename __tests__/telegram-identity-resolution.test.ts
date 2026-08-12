const poolQuery = jest.fn();
const clientQuery = jest.fn();
const release = jest.fn();
const connect = jest.fn(async () => ({ query: clientQuery, release }));
const setUser = jest.fn();

jest.mock('../lib/db', () => ({
  db: { users: { set: setUser } },
  getPool: () => ({ query: poolQuery, connect }),
}));

import {
  resolveTelegramIdentityForLogin,
  resolveVerifiedIdentity,
  telegramIdentityBelongsToUser,
} from '../lib/auth/accountIdentity';

const identity = {
  provider: 'telegram' as const,
  subject: '777',
  displayName: 'Mik',
  metadata: { username: 'mik' },
};

describe('Telegram canonical identity resolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the linked canonical account even if a duplicate legacy row exists', async () => {
    poolQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: '777' }] });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id FROM account_identities')) {
        return { rowCount: 1, rows: [{ user_id: '-42' }] };
      }
      return { rowCount: 1, rows: [] };
    });

    await expect(resolveTelegramIdentityForLogin(identity, '777')).resolves.toEqual({
      userId: '-42',
      linked: false,
      existing: true,
    });
    expect(clientQuery.mock.calls.filter(([sql]) => String(sql).includes('SELECT user_id FROM account_identities'))).toHaveLength(2);
    expect(setUser).not.toHaveBeenCalled();
  });

  it('links a pre-identity legacy Telegram account without creating a second user', async () => {
    poolQuery.mockResolvedValue({ rowCount: 1, rows: [{ id: '777' }] });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id FROM account_identities')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('SELECT id, is_guest FROM users WHERE id = $1 FOR UPDATE')) {
        return { rowCount: 1, rows: [{ id: '777', is_guest: false }] };
      }
      return { rowCount: 1, rows: [] };
    });

    await expect(resolveTelegramIdentityForLogin(identity, '777')).resolves.toEqual({
      userId: '777',
      linked: true,
      existing: false,
    });
    expect(setUser).not.toHaveBeenCalled();
  });

  it('holds one identity lock while creating the first canonical account', async () => {
    poolQuery.mockResolvedValue({ rowCount: 0, rows: [] });
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id FROM account_identities')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('INSERT INTO users')) {
        return { rowCount: 1, rows: [{ id: '-99' }] };
      }
      return { rowCount: 1, rows: [] };
    });

    await expect(resolveTelegramIdentityForLogin(identity, '777')).resolves.toEqual({
      userId: '-99',
      linked: true,
      existing: false,
    });

    const sqlCalls = clientQuery.mock.calls.map(([sql]) => String(sql));
    expect(sqlCalls.findIndex((sql) => sql.includes('pg_advisory_xact_lock')))
      .toBeLessThan(sqlCalls.findIndex((sql) => sql.includes('SELECT user_id FROM account_identities')));
    expect(sqlCalls.findIndex((sql) => sql.includes('INSERT INTO users')))
      .toBeLessThan(sqlCalls.findIndex((sql) => sql.includes('INSERT INTO account_identities')));
    expect(sqlCalls.find((sql) => sql.includes('INSERT INTO users'))).not.toContain('is_premium');
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('revokes the anonymous session in the same transaction when a guest is linked', async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id FROM account_identities')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('SELECT id, is_guest FROM users')) {
        return { rowCount: 1, rows: [{ id: '-42', is_guest: true }] };
      }
      return { rowCount: 1, rows: [] };
    });

    await expect(resolveVerifiedIdentity(identity, '-42')).resolves.toMatchObject({
      userId: '-42',
      linked: true,
    });
    const sqlCalls = clientQuery.mock.calls.map(([sql]) => String(sql));
    const revokeIndex = sqlCalls.findIndex((sql) => sql.includes('UPDATE app_sessions'));
    const upgradeIndex = sqlCalls.findIndex((sql) => sql.includes('UPDATE users'));
    expect(revokeIndex).toBeGreaterThan(-1);
    expect(revokeIndex).toBeLessThan(upgradeIndex);
  });

  it('rejects replacing a different identity for the same provider on one account', async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id FROM account_identities')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('SELECT id, is_guest FROM users')) {
        return { rowCount: 1, rows: [{ id: '-42', is_guest: false }] };
      }
      if (sql.includes('SELECT provider_subject FROM account_identities')) {
        return { rowCount: 1, rows: [{ provider_subject: 'another-google-subject' }] };
      }
      return { rowCount: 1, rows: [] };
    });

    await expect(resolveVerifiedIdentity({ provider: 'google', subject: 'new-google-subject' }, '-42'))
      .rejects.toMatchObject({ status: 409, code: 'PROVIDER_ALREADY_LINKED' });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO account_identities'))).toBe(false);
  });

  it('never turns a fresh registration challenge into login for a newly occupied identity', async () => {
    const beforeCommit = jest.fn();
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT user_id FROM account_identities')) {
        return { rowCount: 1, rows: [{ user_id: '-other-account' }] };
      }
      return { rowCount: 1, rows: [] };
    });

    await expect(resolveVerifiedIdentity(
      { provider: 'email', subject: 'person@example.test' },
      null,
      { requireNewIdentity: true, beforeCommit },
    )).rejects.toMatchObject({ status: 409, code: 'IDENTITY_ALREADY_LINKED' });
    expect(beforeCommit).not.toHaveBeenCalled();
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('UPDATE account_identities'))).toBe(false);
  });

  it('rechecks the linking session inside the identity transaction', async () => {
    clientQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM app_sessions')) return { rowCount: 0, rows: [] };
      return { rowCount: 1, rows: [] };
    });

    await expect(resolveVerifiedIdentity(
      { provider: 'google', subject: 'verified-google-subject' },
      '-42',
      { requiredSession: { userId: '-42', sessionId: 'revoked-session' } },
    )).rejects.toMatchObject({ status: 401, code: 'APP_SESSION_REVOKED' });
    expect(clientQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO account_identities'))).toBe(false);
  });

  it('checks Telegram ownership against the canonical account identity', async () => {
    poolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] });

    await expect(telegramIdentityBelongsToUser('-42', '777')).resolves.toBe(true);
    expect(poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("provider = 'telegram'"),
      ['-42', '777'],
    );
  });
});
