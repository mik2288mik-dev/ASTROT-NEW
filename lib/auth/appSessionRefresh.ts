import crypto from 'crypto';
import { AdminAuthError } from '../adminAuth';
import { getPool } from '../db';
import type { AppUserSession } from './appAuth';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_ABSOLUTE_TTL_SECONDS,
  REFRESH_CONCURRENCY_GRACE_SECONDS,
  REFRESH_IDLE_TTL_SECONDS,
  createAccessSessionToken,
  createRefreshSessionToken,
  hashRefreshSessionToken,
  verifyAppSessionToken,
  verifyRefreshSessionToken,
} from './sessionTokens';

type SessionKind = 'web' | 'native';

type LockedSessionRow = {
  session_id: string;
  user_id: string | number;
  session_kind: string;
  session_version: number;
  refresh_token_hash: string | null;
  refresh_generation: string | number;
  absolute_expires_at_epoch: string | number | null;
  refresh_rotated_at_epoch: string | number | null;
  expires_at_epoch: string | number;
  created_at_epoch: string | number;
  revoked_at: string | Date | null;
  db_now_epoch: string | number;
};

function invalidRefresh(): AdminAuthError {
  return new AdminAuthError(401, 'APP_SESSION_REFRESH_INVALID', 'The session refresh credential is invalid');
}

function epochSeconds(value: string | number | Date | null | undefined): number {
  if (!value) return 0;
  if (typeof value === 'number') return Math.floor(value);
  if (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)) return Math.floor(Number(value));
  return Math.floor(new Date(value).getTime() / 1000);
}

function constantTimeHashMatch(actual: string, expected: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(actual) || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  const actualBytes = Buffer.from(actual, 'hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  return actualBytes.length === expectedBytes.length
    && crypto.timingSafeEqual(actualBytes, expectedBytes);
}

function providerForKind(kind: SessionKind): 'web_guest' | 'native' {
  return kind === 'native' ? 'native' : 'web_guest';
}

function sessionResult(input: {
  userId: string;
  sessionId: string;
  kind: SessionKind;
  generation: number;
  now: number;
  absoluteExpiresAt: number;
}): AppUserSession & { refreshTokenHash: string } {
  const refreshExpiresAt = Math.min(input.now + REFRESH_IDLE_TTL_SECONDS, input.absoluteExpiresAt);
  const expiresAt = Math.min(input.now + ACCESS_TOKEN_TTL_SECONDS, input.absoluteExpiresAt);
  const refreshToken = createRefreshSessionToken({
    userId: input.userId,
    sessionId: input.sessionId,
    generation: input.generation,
    absoluteExpiresAt: input.absoluteExpiresAt,
    issuedAt: input.now,
  });
  const accessToken = createAccessSessionToken({
    userId: input.userId,
    sessionId: input.sessionId,
    provider: providerForKind(input.kind),
    issuedAt: input.now,
    exp: expiresAt,
  });
  return {
    token: accessToken,
    accessToken,
    refreshToken,
    refreshTokenHash: hashRefreshSessionToken(refreshToken),
    sessionId: input.sessionId,
    sessionVersion: 2,
    expiresAt,
    refreshExpiresAt,
    absoluteExpiresAt: input.absoluteExpiresAt,
  };
}

export async function refreshAppUserSession(input: {
  credential: string;
  expectedKind: SessionKind;
}): Promise<AppUserSession> {
  if (!process.env.DATABASE_URL) throw invalidRefresh();

  const refreshPayload = verifyRefreshSessionToken(input.credential);
  const legacyPayload = refreshPayload ? null : verifyAppSessionToken(input.credential);
  if (!refreshPayload && (!legacyPayload || legacyPayload.version !== 1)) throw invalidRefresh();
  if (legacyPayload && legacyPayload.provider !== providerForKind(input.expectedKind)) throw invalidRefresh();

  const userId = refreshPayload?.userId || legacyPayload!.userId;
  const sessionId = refreshPayload?.sessionId || legacyPayload!.sessionId;
  const client = await getPool().connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    const account = await client.query(
      'SELECT is_blocked FROM users WHERE id = $1 FOR SHARE',
      [userId],
    );
    if (!account.rows[0]) throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');

    const sessionResultRow = await client.query(
      `SELECT session_id, user_id, session_kind, session_version, refresh_token_hash,
              refresh_generation, revoked_at,
              EXTRACT(EPOCH FROM absolute_expires_at)::bigint AS absolute_expires_at_epoch,
              EXTRACT(EPOCH FROM refresh_rotated_at)::bigint AS refresh_rotated_at_epoch,
              EXTRACT(EPOCH FROM expires_at)::bigint AS expires_at_epoch,
              EXTRACT(EPOCH FROM created_at AT TIME ZONE 'UTC')::bigint AS created_at_epoch,
              EXTRACT(EPOCH FROM clock_timestamp())::bigint AS db_now_epoch
       FROM app_sessions
       WHERE session_id = $1 AND user_id = $2
       FOR UPDATE`,
      [sessionId, userId],
    );
    const row = sessionResultRow.rows[0] as LockedSessionRow | undefined;
    if (!row) throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
    if (row.session_kind !== input.expectedKind) throw invalidRefresh();
    if (row.revoked_at) throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
    if (account.rows[0].is_blocked === true) {
      await client.query(
        `UPDATE app_sessions
         SET revoked_at = clock_timestamp(), revoke_reason = 'account_blocked'
         WHERE session_id = $1 AND revoked_at IS NULL`,
        [sessionId],
      );
      await client.query('COMMIT');
      committed = true;
      throw new AdminAuthError(403, 'ACCOUNT_BLOCKED', 'Account is blocked');
    }

    const now = epochSeconds(row.db_now_epoch);
    const idleExpiresAt = epochSeconds(row.expires_at_epoch);
    if (idleExpiresAt <= now) {
      await client.query(
        `UPDATE app_sessions
         SET revoked_at = clock_timestamp(), revoke_reason = 'idle_expired'
         WHERE session_id = $1 AND revoked_at IS NULL`,
        [sessionId],
      );
      await client.query('COMMIT');
      committed = true;
      throw new AdminAuthError(401, 'APP_SESSION_REFRESH_EXPIRED', 'The session has expired');
    }

    if (legacyPayload) {
      if (Number(row.session_version) !== 1 || row.refresh_token_hash) throw invalidRefresh();
      const absoluteExpiresAt = epochSeconds(row.created_at_epoch) + REFRESH_ABSOLUTE_TTL_SECONDS;
      if (absoluteExpiresAt <= now) {
        await client.query(
          `UPDATE app_sessions
           SET revoked_at = clock_timestamp(), revoke_reason = 'absolute_expired'
           WHERE session_id = $1 AND revoked_at IS NULL`,
          [sessionId],
        );
        await client.query('COMMIT');
        committed = true;
        throw new AdminAuthError(401, 'APP_SESSION_REFRESH_EXPIRED', 'The session has expired');
      }
      const next = sessionResult({
        userId,
        sessionId,
        kind: input.expectedKind,
        generation: 0,
        now,
        absoluteExpiresAt,
      });
      await client.query(
        `UPDATE app_sessions
         SET session_version = 2,
             refresh_token_hash = $2,
             refresh_generation = 0,
             absolute_expires_at = to_timestamp($3),
             refresh_rotated_at = clock_timestamp(),
             expires_at = to_timestamp($4),
             last_seen_at = clock_timestamp()
         WHERE session_id = $1`,
        [sessionId, next.refreshTokenHash, absoluteExpiresAt, next.refreshExpiresAt],
      );
      await client.query('COMMIT');
      committed = true;
      const { refreshTokenHash: _refreshTokenHash, ...publicSession } = next;
      return publicSession;
    }

    if (Number(row.session_version) !== 2 || !row.refresh_token_hash) throw invalidRefresh();
    const absoluteExpiresAt = epochSeconds(row.absolute_expires_at_epoch);
    if (
      absoluteExpiresAt <= now
      || refreshPayload!.absoluteExpiresAt !== absoluteExpiresAt
    ) {
      if (absoluteExpiresAt > 0 && absoluteExpiresAt <= now) {
        await client.query(
          `UPDATE app_sessions
           SET revoked_at = clock_timestamp(), revoke_reason = 'absolute_expired'
           WHERE session_id = $1 AND revoked_at IS NULL`,
          [sessionId],
        );
        await client.query('COMMIT');
        committed = true;
        throw new AdminAuthError(401, 'APP_SESSION_REFRESH_EXPIRED', 'The session has expired');
      }
      throw invalidRefresh();
    }

    const currentGeneration = Number(row.refresh_generation);
    if (!Number.isSafeInteger(currentGeneration) || currentGeneration < 0) throw invalidRefresh();
    if (refreshPayload!.generation > currentGeneration) throw invalidRefresh();
    if (refreshPayload!.generation < currentGeneration) {
      const rotatedAt = epochSeconds(row.refresh_rotated_at_epoch);
      if (
        refreshPayload!.generation === currentGeneration - 1
        && rotatedAt > 0
        && now - rotatedAt <= REFRESH_CONCURRENCY_GRACE_SECONDS
      ) {
        throw new AdminAuthError(409, 'APP_SESSION_REFRESH_CONCURRENT', 'Another request already refreshed this session');
      }
      await client.query(
        `UPDATE app_sessions
         SET revoked_at = clock_timestamp(), revoke_reason = 'refresh_reuse'
         WHERE session_id = $1 AND revoked_at IS NULL`,
        [sessionId],
      );
      await client.query('COMMIT');
      committed = true;
      throw new AdminAuthError(401, 'APP_SESSION_REFRESH_REUSED', 'The session refresh credential was already used');
    }

    const suppliedHash = hashRefreshSessionToken(input.credential);
    if (!constantTimeHashMatch(suppliedHash, row.refresh_token_hash)) throw invalidRefresh();
    const nextGeneration = currentGeneration + 1;
    if (!Number.isSafeInteger(nextGeneration)) throw invalidRefresh();
    const next = sessionResult({
      userId,
      sessionId,
      kind: input.expectedKind,
      generation: nextGeneration,
      now,
      absoluteExpiresAt,
    });
    await client.query(
      `UPDATE app_sessions
       SET refresh_token_hash = $2,
           refresh_generation = $3,
           refresh_rotated_at = clock_timestamp(),
           expires_at = to_timestamp($4),
           last_seen_at = clock_timestamp()
       WHERE session_id = $1 AND revoked_at IS NULL`,
      [sessionId, next.refreshTokenHash, nextGeneration, next.refreshExpiresAt],
    );
    await client.query('COMMIT');
    committed = true;
    const { refreshTokenHash: _refreshTokenHash, ...publicSession } = next;
    return publicSession;
  } catch (error) {
    if (!committed) await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
