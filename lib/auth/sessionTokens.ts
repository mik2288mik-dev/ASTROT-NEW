import crypto from 'crypto';
import { AdminAuthError } from '../adminAuth';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const LEGACY_SESSION_TTL_SECONDS = 60 * 24 * 60 * 60;
export const REFRESH_IDLE_TTL_SECONDS = 90 * 24 * 60 * 60;
export const REFRESH_ABSOLUTE_TTL_SECONDS = 365 * 24 * 60 * 60;
export const REFRESH_CONCURRENCY_GRACE_SECONDS = 30;

const ACCESS_TOKEN_PREFIX = 'a2';
const REFRESH_TOKEN_PREFIX = 'r2';
const MAX_ACCESS_TOKEN_LENGTH = 4_096;
const MAX_REFRESH_TOKEN_LENGTH = 2_048;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_ID_PATTERN = /^-?\d{1,64}$/;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type AppSessionProvider = 'web_guest' | 'native';

export type AppSessionTokenPayload = {
  version: 1 | 2;
  tokenType: 'access';
  userId: string;
  provider: AppSessionProvider;
  sessionId: string;
  issuedAt?: number;
  exp: number;
};

export type RefreshSessionTokenPayload = {
  version: 2;
  tokenType: 'refresh';
  userId: string;
  sessionId: string;
  generation: number;
  nonce: string;
  issuedAt: number;
  absoluteExpiresAt: number;
};

function sessionSecret(): string {
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

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function domainHmac(domain: string, value: string, encoding: 'base64url' | 'hex'): string {
  return crypto
    .createHmac('sha256', sessionSecret())
    .update(domain)
    .update('\0')
    .update(value)
    .digest(encoding);
}

function legacySignature(encoded: string): string {
  return crypto.createHmac('sha256', sessionSecret()).update(encoded).digest('base64url');
}

function signaturesMatch(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length
    && crypto.timingSafeEqual(actualBytes, expectedBytes);
}

function isIntegerTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isProvider(value: unknown): value is AppSessionProvider {
  return value === 'web_guest' || value === 'native';
}

export function createAccessSessionToken(input: {
  userId: string;
  provider: AppSessionProvider;
  sessionId: string;
  issuedAt?: number;
  exp?: number;
}): string {
  const issuedAt = input.issuedAt ?? Math.floor(Date.now() / 1000);
  const encoded = encodeJson({
    v: 2,
    typ: 'access',
    uid: input.userId,
    provider: input.provider,
    sid: input.sessionId,
    iat: issuedAt,
    exp: input.exp ?? issuedAt + ACCESS_TOKEN_TTL_SECONDS,
  });
  const signature = domainHmac('lumia:app-session:access:v2', encoded, 'base64url');
  return `${ACCESS_TOKEN_PREFIX}.${encoded}.${signature}`;
}

export function createLegacySessionToken(input: {
  userId: string;
  provider: AppSessionProvider;
  sessionId: string;
  exp?: number;
}): string {
  const encoded = encodeJson({
    userId: input.userId,
    provider: input.provider,
    sessionId: input.sessionId,
    exp: input.exp ?? Math.floor(Date.now() / 1000) + LEGACY_SESSION_TTL_SECONDS,
  });
  return `${encoded}.${legacySignature(encoded)}`;
}

function verifyV2AccessToken(token: string, allowExpired: boolean): AppSessionTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== ACCESS_TOKEN_PREFIX) return null;
  const [, encoded, signature] = parts;
  const expected = domainHmac('lumia:app-session:access:v2', encoded, 'base64url');
  if (!signaturesMatch(signature, expected)) return null;

  const raw = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>;
  if (
    raw.v !== 2
    || raw.typ !== 'access'
    || typeof raw.uid !== 'string'
    || !USER_ID_PATTERN.test(raw.uid)
    || typeof raw.sid !== 'string'
    || raw.sid.length < 1
    || raw.sid.length > 256
    || !isProvider(raw.provider)
    || !isIntegerTimestamp(raw.iat)
    || !isIntegerTimestamp(raw.exp)
    || (!allowExpired && Number(raw.exp) <= Math.floor(Date.now() / 1000))
  ) return null;

  return {
    version: 2,
    tokenType: 'access',
    userId: raw.uid,
    provider: raw.provider,
    sessionId: raw.sid,
    issuedAt: raw.iat,
    exp: raw.exp,
  };
}

function verifyLegacyAccessToken(token: string, allowExpired: boolean): AppSessionTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;
  const expected = legacySignature(encoded);
  if (!signaturesMatch(signature, expected)) return null;

  const raw = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>;
  if (
    typeof raw.userId !== 'string'
    || !USER_ID_PATTERN.test(raw.userId)
    || typeof raw.sessionId !== 'string'
    || raw.sessionId.length < 1
    || raw.sessionId.length > 256
    || !isProvider(raw.provider)
    || !isIntegerTimestamp(raw.exp)
    || (!allowExpired && Number(raw.exp) <= Math.floor(Date.now() / 1000))
  ) return null;

  return {
    version: 1,
    tokenType: 'access',
    userId: raw.userId,
    provider: raw.provider,
    sessionId: raw.sessionId,
    exp: raw.exp,
  };
}

export function verifyAppSessionToken(
  token: string,
  options: { allowExpired?: boolean } = {},
): AppSessionTokenPayload | null {
  if (!token || token.length > MAX_ACCESS_TOKEN_LENGTH) return null;
  try {
    return token.startsWith(`${ACCESS_TOKEN_PREFIX}.`)
      ? verifyV2AccessToken(token, options.allowExpired === true)
      : verifyLegacyAccessToken(token, options.allowExpired === true);
  } catch {
    return null;
  }
}

export function createRefreshSessionToken(input: {
  userId: string;
  sessionId: string;
  generation: number;
  absoluteExpiresAt: number;
  issuedAt?: number;
  nonce?: string;
}): string {
  const encoded = encodeJson({
    v: 2,
    typ: 'refresh',
    uid: input.userId,
    sid: input.sessionId,
    generation: input.generation,
    nonce: input.nonce || crypto.randomBytes(32).toString('base64url'),
    iat: input.issuedAt ?? Math.floor(Date.now() / 1000),
    absoluteExp: input.absoluteExpiresAt,
  });
  const signature = domainHmac('lumia:app-session:refresh-envelope:v2', encoded, 'base64url');
  return `${REFRESH_TOKEN_PREFIX}.${encoded}.${signature}`;
}

export function verifyRefreshSessionToken(token: string): RefreshSessionTokenPayload | null {
  if (!token || token.length > MAX_REFRESH_TOKEN_LENGTH) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== REFRESH_TOKEN_PREFIX) return null;
    const [, encoded, signature] = parts;
    const expected = domainHmac('lumia:app-session:refresh-envelope:v2', encoded, 'base64url');
    if (!signaturesMatch(signature, expected)) return null;
    const raw = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (
      raw.v !== 2
      || raw.typ !== 'refresh'
      || typeof raw.uid !== 'string'
      || !USER_ID_PATTERN.test(raw.uid)
      || typeof raw.sid !== 'string'
      || !UUID_PATTERN.test(raw.sid)
      || !Number.isSafeInteger(raw.generation)
      || Number(raw.generation) < 0
      || typeof raw.nonce !== 'string'
      || !NONCE_PATTERN.test(raw.nonce)
      || Buffer.from(raw.nonce, 'base64url').length !== 32
      || !isIntegerTimestamp(raw.iat)
      || !isIntegerTimestamp(raw.absoluteExp)
    ) return null;

    return {
      version: 2,
      tokenType: 'refresh',
      userId: raw.uid,
      sessionId: raw.sid,
      generation: raw.generation as number,
      nonce: raw.nonce,
      issuedAt: raw.iat,
      absoluteExpiresAt: raw.absoluteExp,
    };
  } catch {
    return null;
  }
}

export function hashRefreshSessionToken(token: string): string {
  return domainHmac('lumia:app-session:refresh-at-rest:v2', token, 'hex');
}
