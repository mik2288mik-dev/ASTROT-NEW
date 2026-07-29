import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, getVerifiedTelegramUser } from '../adminAuth';
import { db, getPool } from '../db';
import { isGuestUserId } from '../userId';
import {
  assertAppSessionActive,
  persistAppSession,
  resolveVerifiedIdentity,
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
  const value = process.env.APP_SESSION_SECRET || process.env.BOT_TOKEN || '';
  if (!value && process.env.NODE_ENV === 'production') throw new AdminAuthError(500, 'APP_AUTH_NOT_CONFIGURED', 'APP_SESSION_SECRET is required');
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
  await persistAppSession({
    sessionId,
    userId: input.userId,
    kind: input.kind,
    deviceId: input.deviceId,
    expiresAt,
  });
  return {
    sessionId,
    expiresAt,
    token: createAppSessionToken({ userId: input.userId, sessionId, provider, exp: expiresAt }),
  };
}

async function resolveTelegramUser(req: NextApiRequest): Promise<AppUserContext> {
  const telegram = getVerifiedTelegramUser(req);
  let user = process.env.DATABASE_URL
    ? await db.users.get(telegram.id, { hydratePrimaryChart: false })
    : null;
  if (process.env.DATABASE_URL && !user) {
    await db.users.set(telegram.id, {
      name: telegram.rawUser.first_name || 'Telegram',
      language: telegram.rawUser.language_code || 'ru',
      theme: 'light',
      is_setup: false,
      is_premium: false,
    });
    user = await db.users.get(telegram.id, { hydratePrimaryChart: false });
  }
  const identity = process.env.DATABASE_URL
    ? await resolveVerifiedIdentity(
        {
          provider: 'telegram',
          subject: telegram.id,
          displayName: [telegram.rawUser.first_name, telegram.rawUser.last_name].filter(Boolean).join(' ') || null,
          metadata: { username: telegram.rawUser.username || null },
        },
        user ? telegram.id : null,
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

export async function requireAppUser(req: NextApiRequest, options: { expectedUserId?: unknown; allowGuest?: boolean } = {}): Promise<AppUserContext> {
  let context: AppUserContext | null = null;
  if (header(req, 'x-telegram-init-data')) {
    context = await resolveTelegramUser(req);
  } else {
    const authorization = header(req, 'authorization');
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const payload = verifyAppSessionToken(bearer || cookie(req, APP_SESSION_COOKIE));
    if (payload) {
      if (await isRevokedSession(payload.sessionId)) {
        throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
      }
      await assertAppSessionActive(payload.sessionId, payload.userId);
      let accountIsGuest = isGuestUserId(payload.userId);
      if (process.env.DATABASE_URL) {
        const account = await getPool().query('SELECT is_guest FROM users WHERE id = $1', [payload.userId]);
        const user = account.rowCount
          ? await db.users.get(payload.userId, { hydratePrimaryChart: false })
          : null;
        if (!user) throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This account no longer exists');
        accountIsGuest = account.rows[0].is_guest === true;
      }
      context = {
        userId: payload.userId,
        provider: payload.provider,
        isGuest: accountIsGuest,
        sessionId: payload.sessionId,
      };
    }
  }
  if (!context) throw new AdminAuthError(401, 'APP_AUTH_REQUIRED', 'A valid Telegram, web guest, or native session is required');
  if (context.isGuest && !options.allowGuest) throw new AdminAuthError(403, 'REGISTERED_ACCOUNT_REQUIRED', 'This feature requires a registered account');
  const expected = String(Array.isArray(options.expectedUserId) ? options.expectedUserId[0] : options.expectedUserId ?? '').trim();
  if (expected && context.userId !== expected) throw new AdminAuthError(403, 'USER_ID_MISMATCH', 'Authenticated session does not match userId');
  return context;
}
