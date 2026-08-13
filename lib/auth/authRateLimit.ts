import crypto from 'crypto';
import type { NextApiRequest } from 'next';
import { AdminAuthError } from '../adminAuth';
import { getPool } from '../db';

type RateLimitInput = {
  scope: string;
  key: string;
  maxAttempts: number;
  windowMs: number;
};

let lastCleanupAt = 0;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function rateLimitSecret(): string {
  const configured = String(process.env.AUTH_RATE_LIMIT_SECRET || '').trim();
  const value = /^(?:replace-with|your[_-])/i.test(configured) ? '' : configured;
  if (!value && process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_RATE_LIMIT_SECRET is required');
  }
  if (value && process.env.NODE_ENV === 'production' && Buffer.byteLength(value, 'utf8') < 32) {
    throw new Error('AUTH_RATE_LIMIT_SECRET must contain at least 32 bytes');
  }
  if (
    value
    && process.env.NODE_ENV === 'production'
    && [
      process.env.EMAIL_OTP_HASH_SECRET,
      process.env.APP_SESSION_SECRET,
    ]
      .some((other) => String(other || '').trim() === value)
  ) {
    throw new Error('AUTH_RATE_LIMIT_SECRET must be independent');
  }
  return value || 'local-development-auth-rate-limit-secret';
}

function hashedKey(scope: string, key: string): string {
  return crypto
    .createHmac('sha256', rateLimitSecret())
    .update(scope)
    .update('\0')
    .update(key)
    .digest('hex');
}

function firstHeader(req: NextApiRequest, name: string): string {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] || '' : typeof value === 'string' ? value : '';
}

export function getAuthClientKey(req: NextApiRequest): string {
  const forwarded = firstHeader(req, 'x-forwarded-for').split(',')[0]?.trim();
  const realIp = firstHeader(req, 'x-real-ip').trim();
  const remote = req.socket?.remoteAddress || '';
  const trustProxy = process.env.AUTH_TRUST_PROXY === '1';
  const ip = trustProxy ? (forwarded || realIp || remote) : remote;
  return `ip:${ip}`;
}

async function cleanupExpiredRateLimits(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  await getPool().query(
    `WITH expired AS (
       SELECT scope, key_hash FROM auth_rate_limits
       WHERE expires_at < NOW() - INTERVAL '1 day'
       ORDER BY expires_at
       LIMIT 250
     )
     DELETE FROM auth_rate_limits r
     USING expired e
     WHERE r.scope = e.scope AND r.key_hash = e.key_hash`,
  ).catch(() => undefined);
}

export async function consumeAuthRateLimit(input: RateLimitInput): Promise<void> {
  if (!input.scope || !input.key || input.maxAttempts < 1 || input.windowMs < 1) {
    throw new Error('Invalid auth rate-limit configuration');
  }
  await cleanupExpiredRateLimits();
  const expiresAt = new Date(Date.now() + input.windowMs).toISOString();
  const result = await getPool().query(
    `INSERT INTO auth_rate_limits
       (scope, key_hash, window_started_at, attempts, expires_at, updated_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP, 1, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (scope, key_hash) DO UPDATE SET
       attempts = CASE
         WHEN auth_rate_limits.expires_at <= CURRENT_TIMESTAMP THEN 1
         ELSE auth_rate_limits.attempts + 1
       END,
       window_started_at = CASE
         WHEN auth_rate_limits.expires_at <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP
         ELSE auth_rate_limits.window_started_at
       END,
       expires_at = CASE
         WHEN auth_rate_limits.expires_at <= CURRENT_TIMESTAMP THEN EXCLUDED.expires_at
         ELSE auth_rate_limits.expires_at
       END,
       updated_at = CURRENT_TIMESTAMP
     RETURNING attempts`,
    [input.scope, hashedKey(input.scope, input.key), expiresAt],
  );
  if (Number(result.rows[0]?.attempts || 0) > input.maxAttempts) {
    throw new AdminAuthError(429, 'AUTH_RATE_LIMITED', 'Too many attempts. Try again later');
  }
}

export async function clearAuthRateLimit(scope: string, key: string): Promise<void> {
  await getPool().query(
    'DELETE FROM auth_rate_limits WHERE scope = $1 AND key_hash = $2',
    [scope, hashedKey(scope, key)],
  );
}
