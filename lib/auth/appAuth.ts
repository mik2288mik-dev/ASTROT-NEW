import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, getVerifiedTelegramUser } from '../adminAuth';
import { db, getPool } from '../db';
import { isGuestUserId } from '../userId';

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
    if (payload.provider === 'web_guest' && !isGuestUserId(payload.userId)) return null;
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
  setAppSessionCookie(res, createAppSessionToken({ ...identity, provider: 'web_guest' }));
  return { userId: identity.userId, provider: 'web_guest', isGuest: true, sessionId: identity.sessionId };
}

export async function createNativeGuestAppUser(): Promise<{ auth: AppUserContext; token: string }> {
  const identity = createGuestIdentity();
  await db.users.set(identity.userId, {
    name: 'Гость', language: 'ru', theme: 'light', is_setup: false,
    is_premium: false, premium_until: null, trial_started_at: null,
  });
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

export async function requireAppUser(req: NextApiRequest, options: { expectedUserId?: unknown; allowGuest?: boolean } = {}): Promise<AppUserContext> {
  let context: AppUserContext | null = null;
  if (header(req, 'x-telegram-init-data')) {
    const telegram = getVerifiedTelegramUser(req);
    context = { userId: telegram.id, provider: 'telegram', isGuest: false, telegramUserId: telegram.id };
  } else {
    const authorization = header(req, 'authorization');
    const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    const payload = verifyAppSessionToken(bearer || cookie(req, APP_SESSION_COOKIE));
    if (payload) {
      if (await isRevokedSession(payload.sessionId)) {
        throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
      }
      if (process.env.DATABASE_URL) {
        const user = await db.users.get(payload.userId, { hydratePrimaryChart: false });
        if (!user) throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This account no longer exists');
      }
      context = {
        userId: payload.userId,
        provider: payload.provider,
        isGuest: isGuestUserId(payload.userId),
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
