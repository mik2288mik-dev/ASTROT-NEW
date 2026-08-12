import crypto from 'crypto';

function codeSecret(): string {
  const configured = String(process.env.EMAIL_OTP_HASH_SECRET || '').trim();
  if (configured) {
    if (process.env.NODE_ENV === 'production' && Buffer.byteLength(configured, 'utf8') < 32) {
      throw new Error('EMAIL_OTP_HASH_SECRET must contain at least 32 bytes');
    }
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('EMAIL_OTP_HASH_SECRET is required');
  }
  return String(process.env.APP_SESSION_SECRET || 'local-development-auth-code-secret');
}

export function createAuthCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function hashAuthCode(challengeId: string, code: string): string {
  return crypto
    .createHmac('sha256', codeSecret())
    .update(challengeId)
    .update('\0')
    .update(code)
    .digest('hex');
}

export function verifyAuthCode(challengeId: string, code: string, expectedHash: string): boolean {
  if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashAuthCode(challengeId, code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
