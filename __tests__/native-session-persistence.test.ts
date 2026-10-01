const mockQuery = jest.fn();
const mockRelease = jest.fn();
jest.mock('../lib/db', () => ({ getPool: () => ({ connect: async () => ({ query: mockQuery, release: mockRelease }) }) }));
import { refreshAppUserSession } from '../lib/auth/appSessionRefresh';
import {
  ACCESS_TOKEN_TTL_SECONDS, NATIVE_SESSION_EXPIRES_AT, REFRESH_ABSOLUTE_TTL_SECONDS,
  createLegacySessionToken, createRefreshSessionToken, hashRefreshSessionToken, verifyRefreshSessionToken,
} from '../lib/auth/sessionTokens';

const SID = '5e0e1f8b-166f-4aa6-9ee4-a1ca743b21ad';
const ISSUED = Math.floor(Date.UTC(2025, 0, 1) / 1000);
const OLD_ABSOLUTE = ISSUED + REFRESH_ABSOLUTE_TTL_SECONDS;
const originalEnv = { database: process.env.DATABASE_URL, secret: process.env.APP_SESSION_SECRET };
let row: Record<string, unknown>;
let blocked: boolean;
let credential: string;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.DATABASE_URL = 'postgres://mock-only';
  process.env.APP_SESSION_SECRET = 'test-app-session-secret-that-is-long-enough';
  credential = createRefreshSessionToken({ userId: '42', sessionId: SID, generation: 0, issuedAt: ISSUED, absoluteExpiresAt: OLD_ABSOLUTE });
  blocked = false;
  row = {
    session_id: SID, user_id: '42', session_kind: 'native', session_version: 2,
    refresh_token_hash: hashRefreshSessionToken(credential), refresh_generation: 0,
    absolute_expires_at_epoch: OLD_ABSOLUTE, refresh_rotated_at_epoch: ISSUED,
    expires_at_epoch: ISSUED + 90 * 86400, created_at_epoch: ISSUED, revoked_at: null,
    db_now_epoch: ISSUED + 180 * 86400,
  };
  mockQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT is_blocked')) return { rows: [{ is_blocked: blocked }], rowCount: 1 };
    if (sql.includes('SELECT session_id')) return { rows: [row], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  });
});
afterAll(() => {
  for (const [key, value] of [['DATABASE_URL', originalEnv.database], ['APP_SESSION_SECRET', originalEnv.secret]]) {
    if (value === undefined) delete process.env[key!];
    else process.env[key!] = value;
  }
});

it.each([180, 800])('restores an existing native family after %i days without signing in again', async (days) => {
  row.db_now_epoch = ISSUED + days * 86400;
  const next = await refreshAppUserSession({ credential, expectedKind: 'native' });
  expect(next.refreshExpiresAt).toBe(NATIVE_SESSION_EXPIRES_AT);
  expect(next.absoluteExpiresAt).toBe(NATIVE_SESSION_EXPIRES_AT);
  expect(next.expiresAt).toBe(Number(row.db_now_epoch) + ACCESS_TOKEN_TTL_SECONDS);
  expect(next.refreshToken).not.toBe(credential);
  expect(verifyRefreshSessionToken(next.refreshToken!)).toMatchObject({ generation: 1, absoluteExpiresAt: NATIVE_SESSION_EXPIRES_AT });
  const update = mockQuery.mock.calls.find(([sql]) => String(sql).includes('SET refresh_token_hash'));
  expect(update![1]).toEqual([SID, hashRefreshSessionToken(next.refreshToken!), 1, NATIVE_SESSION_EXPIRES_AT, NATIVE_SESSION_EXPIRES_AT]);
  expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes('revoke_reason'))).toBe(false);
});

it('upgrades a signed legacy native session after its old expiry', async () => {
  credential = createLegacySessionToken({ userId: '42', sessionId: SID, provider: 'native', exp: ISSUED + 60 * 86400 });
  row.session_version = 1;
  row.refresh_token_hash = null;
  await expect(refreshAppUserSession({ credential, expectedKind: 'native' })).resolves.toMatchObject({
    sessionVersion: 2, refreshExpiresAt: NATIVE_SESSION_EXPIRES_AT,
  });
});

it.each(['idle', 'absolute'])('preserves the web %s timeout', async (timeout) => {
  row.session_kind = 'web';
  if (timeout === 'absolute') {
    row.db_now_epoch = OLD_ABSOLUTE + 1;
    row.expires_at_epoch = OLD_ABSOLUTE + 1000;
  }
  await expect(refreshAppUserSession({ credential, expectedKind: 'web' })).rejects.toMatchObject({ code: 'APP_SESSION_REFRESH_EXPIRED' });
  expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes(`revoke_reason = '${timeout}_expired'`))).toBe(true);
});

it.each(['revoked', 'blocked', 'wrong_hash', 'wrong_kind'])('never restores a native session when %s', async (failure) => {
  if (failure === 'revoked') row.revoked_at = new Date();
  if (failure === 'blocked') blocked = true;
  if (failure === 'wrong_hash') row.refresh_token_hash = '0'.repeat(64);
  if (failure === 'wrong_kind') row.session_kind = 'web';
  await expect(refreshAppUserSession({ credential, expectedKind: 'native' })).rejects.toMatchObject({
    code: failure === 'revoked' ? 'APP_SESSION_REVOKED' : failure === 'blocked' ? 'ACCOUNT_BLOCKED' : 'APP_SESSION_REFRESH_INVALID',
  });
  expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes('SET refresh_token_hash'))).toBe(false);
});

it('keeps the concurrency grace during migration to a persistent native family', async () => {
  row.refresh_generation = 1;
  row.absolute_expires_at_epoch = NATIVE_SESSION_EXPIRES_AT;
  row.refresh_rotated_at_epoch = Number(row.db_now_epoch) - 5;
  await expect(refreshAppUserSession({ credential, expectedKind: 'native' })).rejects.toMatchObject({ code: 'APP_SESSION_REFRESH_CONCURRENT', status: 409 });
});

it('revokes a reused refresh credential outside the concurrency grace', async () => {
  row.refresh_generation = 1;
  row.refresh_rotated_at_epoch = Number(row.db_now_epoch) - 31;
  await expect(refreshAppUserSession({ credential, expectedKind: 'native' })).rejects.toMatchObject({ code: 'APP_SESSION_REFRESH_REUSED' });
});
