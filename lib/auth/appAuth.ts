import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, getVerifiedTelegramUser } from '../adminAuth';
import { db, getPool } from '../db';
import { isGuestUserId } from '../userId';
import {
  assertAppSessionActive,
  persistAppSession,
  revokeSessions,
  resolveTelegramIdentityForLogin,
  telegramIdentityBelongsToUser,
} from './accountIdentity';

export type AppAuthProvider = 'telegram' | 'web_guest' | 'native';
export type AppUserContext = {
  userId: string;
  provider: AppAuthProvider;
  isGuest: boolean;
  telegramUserId?: string;
  sessionId?: string;
};

export const APP_SESSION_COOKIE = 'lumia_app_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60;

type SessionPayload = { userId: string; provider: 'web_guest' | 'native'; sessionId: string; exp: number };

function secret(): string {
  const configured = String(process.env.APP_SESSION_SECRET || '').trim();
  const value = /^(?:replace-with|your[_-])/i.test(configured) ? '' : configured;
  if (process.env.NODE_ENV === 'production' && Buffer.byteLength(value, 'utf8') < 32) {
    throw new AdminAuthError(
      500,
      'APP_AUTH_NOT_CONFIGURED',
      'APP_SESSION_SECRET must contain at least 32 bytes',
    );
  }
  if (
    process.env.NODE_ENV === 'production'
    && value
    && [process.env.EMAIL_OTP_HASH_SECRET, process.env.AUTH_RATE_LIMIT_SECRET]
      .some((other) => String(other || '').trim() === value)
  ) {
    throw new AdminAuthError(
      500,
      'APP_AUTH_NOT_CONFIGURED',
      'APP_SESSION_SECRET must be independent from auth HMAC secrets',
    );
  }
  return value || 'lumia-local-development-session-secret';
}

function b64(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function sign(encoded: string): string {
  return crypto.createHmac('sha256', secret()).update(encoded).digest('base64url');
}

export function createAppSessionToken(payload: Omit<SessionPayload, 'exp'> & { exp?: number }): string {
  const encoded = b64(JSON.stringify({ ...payload, exp: payload.exp ?? Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS }));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAppSessionToken(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;
    const expected = sign(encoded);
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.userId || !payload.sessionId || !['web_guest', 'native'].includes(payload.provider)) return null;
    if (!Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function header(req: NextApiRequest, name: string): string {
  const value = req.headers?.[name];
  return Array.isArray(value) ? value[0] || '' : typeof value === 'string' ? value : '';
}

function cookie(req: NextApiRequest, name: string): string {
  const raw = header(req, 'cookie');
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

export function setAppSessionCookie(res: NextApiResponse, token: string): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${APP_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}${secure}`);
}

export function clearAppSessionCookie(res: NextApiResponse): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${APP_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

async function isRevokedSession(sessionId: string): Promise<boolean> {
  // Unit-test DB doubles from older auth tests do not expose getPool.
  if (!process.env.DATABASE_URL || typeof getPool !== 'function') return false;
  const result = await getPool().query(
    `SELECT 1 FROM app_session_revocations WHERE session_id = $1 AND expires_at > NOW() LIMIT 1`,
    [sessionId],
  );
  return !!result.rowCount;
}

export async function revokeAppSession(sessionId: string, expiresAt: number): Promise<void> {
  if (!sessionId) return;
  if (!process.env.DATABASE_URL || typeof getPool !== 'function') return;
  await getPool().query(
    `INSERT INTO app_session_revocations (session_id, expires_at)
     VALUES ($1, $2)
     ON CONFLICT (session_id) DO UPDATE SET expires_at = EXCLUDED.expires_at, revoked_at = CURRENT_TIMESTAMP`,
    [sessionId, new Date(expiresAt * 1000).toISOString()],
  );
  await getPool().query(
    `UPDATE app_sessions
     SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'user_request'
     WHERE session_id = $1 AND revoked_at IS NULL`,
    [sessionId],
  ).catch(() => undefined);
}

export function createGuestIdentity(): { userId: string; sessionId: string } {
  // users.id is BIGINT today; reserve negative IDs for non-Telegram guest identities.
  const random = BigInt(`0x${crypto.randomBytes(8).toString('hex')}`) % 8_000_000_000_000_000_000n;
  return { userId: String(-(random + 1n)), sessionId: crypto.randomUUID() };
}

export { isGuestUserId } from '../userId';

export async function createGuestAppUser(res: NextApiResponse): Promise<AppUserContext> {
  const identity = createGuestIdentity();
  await db.users.set(identity.userId, {
    name: 'Гость', language: 'ru', theme: 'light', is_setup: false,
    is_premium: false, premium_until: null, trial_started_at: null,
  });
  if (process.env.DATABASE_URL) {
    await getPool().query(
      `UPDATE users SET is_guest = TRUE, auth_provider = 'web_guest', platform = 'web' WHERE id = $1`,
      [identity.userId],
    );
    await persistAppSession({ sessionId: identity.sessionId, userId: identity.userId, kind: 'web' });
  }
  setAppSessionCookie(res, createAppSessionToken({ ...identity, provider: 'web_guest' }));
  return { userId: identity.userId, provider: 'web_guest', isGuest: true, sessionId: identity.sessionId };
}

export async function createNativeGuestAppUser(): Promise<{ auth: AppUserContext; token: string }> {
  const identity = createGuestIdentity();
  await db.users.set(identity.userId, {
    name: 'Гость', language: 'ru', theme: 'light', is_setup: false,
    is_premium: false, premium_until: null, trial_started_at: null,
  });
  if (process.env.DATABASE_URL) {
    await getPool().query(
      `UPDATE users SET is_guest = TRUE, auth_provider = 'native', platform = 'native' WHERE id = $1`,
      [identity.userId],
    );
    await persistAppSession({ sessionId: identity.sessionId, userId: identity.userId, kind: 'native' });
  }
  const token = createAppSessionToken({ ...identity, provider: 'native' });
  return {
    token,
    auth: {
      userId: identity.userId,
      provider: 'native',
      isGuest: true,
      sessionId: identity.sessionId,
    },
  };
}

export async function createAppUserSession(input: {
  userId: string;
  kind: 'web' | 'native';
  deviceId?: string | null;
}): Promise<{ token: string; sessionId: string; expiresAt: number }> {
  const sessionId = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const provider = input.kind === 'native' ? 'native' : 'web_guest';
  if (!process.env.DATABASE_URL) {
    await persistAppSession({
      sessionId,
      userId: input.userId,
      kind: input.kind,
      deviceId: input.deviceId,
      expiresAt,
    });
  } else {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const account = await client.query(
        `SELECT is_blocked
         FROM users
         WHERE id = $1
         FOR SHARE`,
        [input.userId],
      );
      if (!account.rows[0]) {
        throw new AdminAuthError(401, 'APP_ACCOUNT_NOT_FOUND', 'Account no longer exists');
      }
      if (account.rows[0].is_blocked === true) {
        throw new AdminAuthError(403, 'ACCOUNT_BLOCKED', 'Account is blocked');
      }
      await client.query(
        `INSERT INTO app_sessions
         (session_id, user_id, session_kind, device_id, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, input.userId, input.kind, input.deviceId || null, new Date(expiresAt * 1000).toISOString()],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  return {
    sessionId,
    expiresAt,
    token: createAppSessionToken({ userId: input.userId, sessionId, provider, exp: expiresAt }),
  };
}

/**
 * Serializes password-authenticated session issuance with password resets.
 * A reset either waits for this session and revokes it, or changes the version
 * first and makes this insertion fail.
 */
export async function createPasswordAppUserSession(input: {
  userId: string;
  passwordVersion: number;
  kind: 'web' | 'native';
  deviceId?: string | null;
}): Promise<{ token: string; sessionId: string; expiresAt: number }> {
  const sessionId = crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const provider = input.kind === 'native' ? 'native' : 'web_guest';
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const credential = await client.query(
      `SELECT c.password_version, u.is_blocked
       FROM account_password_credentials c
       JOIN users u ON u.id = c.user_id
       WHERE c.user_id = $1
       FOR SHARE OF c, u`,
      [input.userId],
    );
    if (
      !credential.rows[0]
      || Number(credential.rows[0].password_version) !== input.passwordVersion
    ) {
      throw new AdminAuthError(401, 'AUTH_CREDENTIAL_CHANGED', 'Authentication credentials changed');
    }
    if (credential.rows[0].is_blocked === true) {
      throw new AdminAuthError(403, 'ACCOUNT_BLOCKED', 'Account is blocked');
    }
    await client.query(
      `INSERT INTO app_sessions
       (session_id, user_id, session_kind, device_id, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, input.userId, input.kind, input.deviceId || null, new Date(expiresAt * 1000).toISOString()],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  return {
    sessionId,
    expiresAt,
    token: createAppSessionToken({ userId: input.userId, sessionId, provider, exp: expiresAt }),
  };
}

async function resolveTelegramUser(req: NextApiRequest): Promise<AppUserContext> {
  const telegram = getVerifiedTelegramUser(req);
  const identity = process.env.DATABASE_URL
    ? await resolveTelegramIdentityForLogin(
        {
          provider: 'telegram',
          subject: telegram.id,
          displayName: [telegram.rawUser.first_name, telegram.rawUser.last_name].filter(Boolean).join(' ') || null,
          metadata: { username: telegram.rawUser.username || null },
        },
        telegram.id,
      )
    : { userId: telegram.id };
  const rawInitData = header(req, 'x-telegram-init-data');
  const sessionId = `telegram:${crypto.createHash('sha256').update(rawInitData).digest('hex')}`;
  if (process.env.DATABASE_URL) {
    await persistAppSession({ sessionId, userId: identity.userId, kind: 'telegram' });
    await assertAppSessionActive(sessionId, identity.userId);
  }
  return {
    userId: identity.userId,
    provider: 'telegram',
    isGuest: false,
    telegramUserId: telegram.id,
    sessionId,
  };
}

export async function requireAppUser(req: NextApiRequest, options: {
  expectedUserId?: unknown;
  allowGuest?: boolean;
  allowTelegramProof?: boolean;
} = {}): Promise<AppUserContext> {
  let context: AppUserContext | null = null;
  const authorization = header(req, 'authorization').trim();
  const cookieToken = cookie(req, APP_SESSION_COOKIE);
  const explicitSessionSupplied = !!authorization || !!cookieToken;

  if (explicitSessionSupplied) {
    if (authorization && !authorization.startsWith('Bearer ')) {
      throw new AdminAuthError(401, 'APP_SESSION_INVALID', 'The app session is invalid');
    }
    const bearer = authorization ? authorization.slice(7).trim() : '';
    const payload = verifyAppSessionToken(bearer || cookieToken);
    if (!payload) {
      throw new AdminAuthError(401, 'APP_SESSION_INVALID', 'The app session is invalid');
    }
    if (await isRevokedSession(payload.sessionId)) {
      throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
    }
    try {
      await assertAppSessionActive(payload.sessionId, payload.userId);
    } catch (error) {
      // Blocking revokes sessions atomically. Preserve the more useful blocked
      // account response while the block is active; after an unblock the same
      // old token remains revoked and receives APP_SESSION_REVOKED.
      const blocked = process.env.DATABASE_URL
        ? await getPool()
            .query('SELECT is_blocked FROM users WHERE id = $1', [payload.userId])
            .then((result) => result.rows[0]?.is_blocked === true)
            .catch(() => false)
        : false;
      if (blocked) {
        await revokeSessions(payload.userId).catch(() => undefined);
        throw new AdminAuthError(403, 'ACCOUNT_BLOCKED', 'Account is blocked');
      }
      throw error;
    }
    context = {
      userId: payload.userId,
      provider: payload.provider,
      isGuest: isGuestUserId(payload.userId),
      sessionId: payload.sessionId,
    };
  } else if (options.allowTelegramProof !== false && header(req, 'x-telegram-init-data')) {
    // Raw Telegram initData remains available for Telegram-only endpoints and
    // older clients, but it must never replace an explicit app session.
    context = await resolveTelegramUser(req);
  }
  if (!context) throw new AdminAuthError(401, 'APP_AUTH_REQUIRED', 'A valid Telegram, web guest, or native session is required');
  if (process.env.DATABASE_URL) {
    const account = await getPool().query(
      'SELECT is_guest, is_blocked FROM users WHERE id = $1',
      [context.userId],
    );
    const user = account.rowCount
      ? await db.users.get(context.userId, { hydratePrimaryChart: false })
      : null;
    if (!user) throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This account no longer exists');
    if (account.rows[0].is_blocked === true) {
      await revokeSessions(context.userId).catch(() => undefined);
      throw new AdminAuthError(403, 'ACCOUNT_BLOCKED', 'Account is blocked');
    }
    context = { ...context, isGuest: account.rows[0].is_guest === true };
  }
  if (context.isGuest && !options.allowGuest) throw new AdminAuthError(403, 'REGISTERED_ACCOUNT_REQUIRED', 'This feature requires a registered account');
  const expected = String(Array.isArray(options.expectedUserId) ? options.expectedUserId[0] : options.expectedUserId ?? '').trim();
  if (expected && context.userId !== expected) throw new AdminAuthError(403, 'USER_ID_MISMATCH', 'Authenticated session does not match userId');
  return context;
}

/**
 * Telegram Stars requires two independent facts: a canonical revocable app
 * session and fresh Telegram-signed launch proof belonging to that account.
 */
export async function requireLinkedTelegramAppUser(
  req: NextApiRequest,
  expectedUserId?: unknown,
): Promise<AppUserContext> {
  const telegram = getVerifiedTelegramUser(req);
  const context = await requireAppUser(req, {
    expectedUserId,
    allowTelegramProof: false,
  });

  const ownsIdentity = process.env.DATABASE_URL
    ? await telegramIdentityBelongsToUser(context.userId, telegram.id)
    : context.userId === telegram.id;
  if (!ownsIdentity) {
    throw new AdminAuthError(
      403,
      'TELEGRAM_IDENTITY_NOT_LINKED',
      'Link this Telegram identity to the active account first',
    );
  }
  return { ...context, telegramUserId: telegram.id };
}

export async function requireTelegramPaymentUser(
  req: NextApiRequest,
  expectedUserId: unknown,
): Promise<AppUserContext> {
  return requireLinkedTelegramAppUser(req, expectedUserId);
}
