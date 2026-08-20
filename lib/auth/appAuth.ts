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
import {
  ACCESS_TOKEN_TTL_SECONDS,
  LEGACY_SESSION_TTL_SECONDS,
  REFRESH_ABSOLUTE_TTL_SECONDS,
  REFRESH_IDLE_TTL_SECONDS,
  createAccessSessionToken,
  createLegacySessionToken,
  createRefreshSessionToken,
  hashRefreshSessionToken,
  verifyAppSessionToken,
  verifyRefreshSessionToken,
  type AppSessionProvider,
} from './sessionTokens';

export type AppAuthProvider = 'telegram' | 'web_guest' | 'native';
export type AppUserContext = {
  userId: string;
  provider: AppAuthProvider;
  isGuest: boolean;
  telegramUserId?: string;
  sessionId?: string;
};

export const APP_SESSION_COOKIE = 'lumia_app_session';
export const APP_REFRESH_COOKIE = 'lumia_app_refresh';
export const APP_SESSION_REFRESH_VERSION = 2;

export type AppUserSession = {
  token: string;
  accessToken: string;
  refreshToken?: string;
  sessionId: string;
  sessionVersion: 1 | 2;
  expiresAt: number;
  refreshExpiresAt?: number;
  absoluteExpiresAt?: number;
};

export function supportsSessionRefresh(value: unknown): boolean {
  return value === APP_SESSION_REFRESH_VERSION || value === String(APP_SESSION_REFRESH_VERSION);
}

export function appSessionResponse(session: AppUserSession, includeTokens: boolean): Record<string, unknown> {
  if (session.sessionVersion !== 2) return includeTokens ? { token: session.token } : {};
  const metadata = {
    sessionVersion: session.sessionVersion,
    accessExpiresAt: session.expiresAt,
    refreshExpiresAt: session.refreshExpiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
  };
  return includeTokens
    ? {
        ...metadata,
        token: session.token,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      }
    : metadata;
}

export function createAppSessionToken(input: {
  userId: string;
  provider: AppSessionProvider;
  sessionId: string;
  exp?: number;
}): string {
  return createLegacySessionToken(input);
}

export { verifyAppSessionToken } from './sessionTokens';

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

export function readAppSessionCookie(req: NextApiRequest): string {
  return cookie(req, APP_SESSION_COOKIE);
}

export function readAppRefreshCookie(req: NextApiRequest): string {
  return cookie(req, APP_REFRESH_COOKIE);
}

function appendSetCookie(res: NextApiResponse, value: string): void {
  const current = typeof res.getHeader === 'function' ? res.getHeader('Set-Cookie') : undefined;
  if (!current) {
    res.setHeader('Set-Cookie', value);
    return;
  }
  res.setHeader('Set-Cookie', Array.isArray(current) ? [...current, value] : [String(current), value]);
}

function cookieMaxAge(token: string, fallback: number): number {
  const payload = verifyAppSessionToken(token, { allowExpired: true });
  return payload ? Math.max(0, payload.exp - Math.floor(Date.now() / 1000)) : fallback;
}

export function setAppSessionCookie(
  res: NextApiResponse,
  token: string,
  refreshToken?: string,
): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  appendSetCookie(
    res,
    `${APP_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cookieMaxAge(token, ACCESS_TOKEN_TTL_SECONDS)}${secure}`,
  );
  if (refreshToken) {
    const refresh = verifyRefreshSessionToken(refreshToken);
    const absoluteRemaining = refresh
      ? Math.max(0, refresh.absoluteExpiresAt - Math.floor(Date.now() / 1000))
      : REFRESH_IDLE_TTL_SECONDS;
    appendSetCookie(
      res,
      `${APP_REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; Path=/api/auth/session; HttpOnly; SameSite=Strict; Max-Age=${Math.min(REFRESH_IDLE_TTL_SECONDS, absoluteRemaining)}${secure}`,
    );
  } else {
    appendSetCookie(
      res,
      `${APP_REFRESH_COOKIE}=; Path=/api/auth/session; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
    );
  }
}

export function clearAppSessionCookie(res: NextApiResponse): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  appendSetCookie(res, `${APP_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
  appendSetCookie(
    res,
    `${APP_REFRESH_COOKIE}=; Path=/api/auth/session; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  );
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

type SessionPlan = AppUserSession & {
  refreshTokenHash: string | null;
};

function buildSessionPlan(input: {
  userId: string;
  sessionId: string;
  provider: AppSessionProvider;
  refreshCapable: boolean;
}): SessionPlan {
  const now = Math.floor(Date.now() / 1000);
  if (!input.refreshCapable || !process.env.DATABASE_URL) {
    const expiresAt = now + LEGACY_SESSION_TTL_SECONDS;
    const token = createLegacySessionToken({ ...input, exp: expiresAt });
    return {
      token,
      accessToken: token,
      sessionId: input.sessionId,
      sessionVersion: 1,
      expiresAt,
      refreshTokenHash: null,
    };
  }

  const absoluteExpiresAt = now + REFRESH_ABSOLUTE_TTL_SECONDS;
  const refreshExpiresAt = Math.min(now + REFRESH_IDLE_TTL_SECONDS, absoluteExpiresAt);
  const expiresAt = Math.min(now + ACCESS_TOKEN_TTL_SECONDS, absoluteExpiresAt);
  const refreshToken = createRefreshSessionToken({
    userId: input.userId,
    sessionId: input.sessionId,
    generation: 0,
    absoluteExpiresAt,
    issuedAt: now,
  });
  const token = createAccessSessionToken({
    userId: input.userId,
    sessionId: input.sessionId,
    provider: input.provider,
    issuedAt: now,
    exp: expiresAt,
  });
  return {
    token,
    accessToken: token,
    refreshToken,
    sessionId: input.sessionId,
    sessionVersion: 2,
    expiresAt,
    refreshExpiresAt,
    absoluteExpiresAt,
    refreshTokenHash: hashRefreshSessionToken(refreshToken),
  };
}

function sessionInsertValues(
  input: { userId: string; kind: 'web' | 'native'; deviceId?: string | null },
  plan: SessionPlan,
): unknown[] {
  const familyExpiresAt = plan.sessionVersion === 2 ? plan.refreshExpiresAt! : plan.expiresAt;
  return [
    plan.sessionId,
    input.userId,
    input.kind,
    input.deviceId || null,
    new Date(familyExpiresAt * 1000).toISOString(),
    plan.sessionVersion,
    plan.refreshTokenHash,
    plan.absoluteExpiresAt ? new Date(plan.absoluteExpiresAt * 1000).toISOString() : null,
  ];
}

const INSERT_APP_SESSION_SQL = `INSERT INTO app_sessions
  (session_id, user_id, session_kind, device_id, expires_at, session_version,
   refresh_token_hash, refresh_generation, absolute_expires_at, refresh_rotated_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, CASE WHEN $6 = 2 THEN clock_timestamp() ELSE NULL END)`;

export async function createGuestAppUser(
  res: NextApiResponse,
  sessionVersion?: unknown,
): Promise<AppUserContext> {
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
  }
  const session = await createAppUserSession({
    userId: identity.userId,
    kind: 'web',
    sessionVersion: supportsSessionRefresh(sessionVersion) ? 2 : 1,
  });
  setAppSessionCookie(res, session.token, session.refreshToken);
  return { userId: identity.userId, provider: 'web_guest', isGuest: true, sessionId: session.sessionId };
}

export async function createNativeGuestAppUser(sessionVersion?: unknown): Promise<{
  auth: AppUserContext;
  session: AppUserSession;
}> {
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
  }
  const session = await createAppUserSession({
    userId: identity.userId,
    kind: 'native',
    sessionVersion: supportsSessionRefresh(sessionVersion) ? 2 : 1,
  });
  return {
    session,
    auth: {
      userId: identity.userId,
      provider: 'native',
      isGuest: true,
      sessionId: session.sessionId,
    },
  };
}

export async function createAppUserSession(input: {
  userId: string;
  kind: 'web' | 'native';
  deviceId?: string | null;
  sessionVersion?: 1 | 2;
}): Promise<AppUserSession> {
  const sessionId = crypto.randomUUID();
  const provider = input.kind === 'native' ? 'native' : 'web_guest';
  const plan = buildSessionPlan({
    userId: input.userId,
    sessionId,
    provider,
    refreshCapable: input.sessionVersion === 2,
  });
  if (!process.env.DATABASE_URL) {
    await persistAppSession({
      sessionId,
      userId: input.userId,
      kind: input.kind,
      deviceId: input.deviceId,
      expiresAt: plan.expiresAt,
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
        INSERT_APP_SESSION_SQL,
        sessionInsertValues(input, plan),
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
  const { refreshTokenHash: _refreshTokenHash, ...session } = plan;
  return session;
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
  sessionVersion?: 1 | 2;
}): Promise<AppUserSession> {
  const sessionId = crypto.randomUUID();
  const provider = input.kind === 'native' ? 'native' : 'web_guest';
  const plan = buildSessionPlan({
    userId: input.userId,
    sessionId,
    provider,
    refreshCapable: input.sessionVersion === 2,
  });
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
      INSERT_APP_SESSION_SQL,
      sessionInsertValues(input, plan),
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  const { refreshTokenHash: _refreshTokenHash, ...session } = plan;
  return session;
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
    const suppliedToken = bearer || cookieToken;
    const payload = verifyAppSessionToken(bearer || cookieToken);
    if (!payload) {
      const expiredPayload = verifyAppSessionToken(suppliedToken, { allowExpired: true });
      if (expiredPayload && expiredPayload.exp <= Math.floor(Date.now() / 1000)) {
        throw new AdminAuthError(401, 'APP_SESSION_EXPIRED', 'The app session has expired');
      }
      throw new AdminAuthError(401, 'APP_SESSION_INVALID', 'The app session is invalid');
    }
    if (await isRevokedSession(payload.sessionId)) {
      throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
    }
    try {
      await assertAppSessionActive(payload.sessionId, payload.userId, payload.version);
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
