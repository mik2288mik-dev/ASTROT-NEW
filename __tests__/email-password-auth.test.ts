import fs from 'fs';
import path from 'path';

jest.mock('../lib/db', () => ({
  db: {},
  getPool: jest.fn(),
}));

import {
  assertValidNewPassword,
  hashPassword,
  verifyPassword,
} from '../lib/auth/passwordHash';
import {
  hashAuthCode,
  verifyAuthCode,
} from '../lib/auth/authCode';
import { sanitizeEmailPasswordError } from '../lib/auth/emailPassword';
import registerHandler from '../pages/api/auth/password/register';
import registerVerifyHandler from '../pages/api/auth/password/register-verify';
import loginHandler from '../pages/api/auth/password/login';
import resetRequestHandler from '../pages/api/auth/password/reset-request';
import resetCompleteHandler from '../pages/api/auth/password/reset-complete';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

describe('email and password authentication', () => {
  const originalCodeSecret = process.env.EMAIL_OTP_HASH_SECRET;

  beforeAll(() => {
    process.env.EMAIL_OTP_HASH_SECRET = 'test-only-auth-code-secret-with-enough-entropy';
  });

  afterAll(() => {
    if (originalCodeSecret === undefined) delete process.env.EMAIL_OTP_HASH_SECRET;
    else process.env.EMAIL_OTP_HASH_SECRET = originalCodeSecret;
  });

  it('stores passwords as salted self-describing scrypt hashes', async () => {
    const password = 'correct horse battery staple';
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).toMatch(/^scrypt\$v=1\$ln=15,r=8,p=3\$/);
    expect(first).not.toContain(password);
    expect(second).not.toBe(first);
    await expect(verifyPassword(password, first)).resolves.toBe(true);
    await expect(verifyPassword('definitely-wrong', first)).resolves.toBe(false);
  });

  it('rejects weak, mismatched, and unreasonably large passwords', () => {
    expect(() => assertValidNewPassword('short', 'short')).toThrow(expect.objectContaining({
      code: 'PASSWORD_TOO_SHORT',
    }));
    expect(() => assertValidNewPassword('long-enough-password', 'different-password')).toThrow(expect.objectContaining({
      code: 'PASSWORD_CONFIRMATION_MISMATCH',
    }));
    const oversized = '🚀'.repeat(300);
    expect(() => assertValidNewPassword(oversized, oversized)).toThrow(expect.objectContaining({
      code: 'PASSWORD_TOO_LONG',
    }));
    expect(() => assertValidNewPassword('long-enough-password', 'long-enough-password')).not.toThrow();
  });

  it('protects six-digit email codes with a server-side HMAC pepper', () => {
    const digest = hashAuthCode('challenge-1', '123456');
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain('123456');
    expect(verifyAuthCode('challenge-1', '123456', digest)).toBe(true);
    expect(verifyAuthCode('challenge-1', '654321', digest)).toBe(false);

    process.env.EMAIL_OTP_HASH_SECRET = 'a-different-test-only-auth-code-secret';
    expect(hashAuthCode('challenge-1', '123456')).not.toBe(digest);
  });

  it('rejects an OTP HMAC key reused as the production session key', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    const previousNodeEnv = mutableEnv.NODE_ENV;
    const previousAppSecret = mutableEnv.APP_SESSION_SECRET;
    const previousCodeSecret = mutableEnv.EMAIL_OTP_HASH_SECRET;
    mutableEnv.NODE_ENV = 'production';
    mutableEnv.APP_SESSION_SECRET = 'reused-production-auth-secret-at-least-32-bytes';
    mutableEnv.EMAIL_OTP_HASH_SECRET = mutableEnv.APP_SESSION_SECRET;
    try {
      expect(() => hashAuthCode('challenge-1', '123456'))
        .toThrow('EMAIL_OTP_HASH_SECRET must be independent from APP_SESSION_SECRET');
      mutableEnv.EMAIL_OTP_HASH_SECRET = 'replace-with-a-long-random-secret';
      expect(() => hashAuthCode('challenge-1', '123456'))
        .toThrow('EMAIL_OTP_HASH_SECRET is required');
    } finally {
      if (previousNodeEnv === undefined) delete mutableEnv.NODE_ENV;
      else mutableEnv.NODE_ENV = previousNodeEnv;
      if (previousAppSecret === undefined) delete mutableEnv.APP_SESSION_SECRET;
      else mutableEnv.APP_SESSION_SECRET = previousAppSecret;
      if (previousCodeSecret === undefined) delete mutableEnv.EMAIL_OTP_HASH_SECRET;
      else mutableEnv.EMAIL_OTP_HASH_SECRET = previousCodeSecret;
    }
  });

  it('does not expose unexpected backend errors through password routes', () => {
    expect(sanitizeEmailPasswordError(new Error('database detail'))).toMatchObject({
      status: 503,
      code: 'AUTH_TEMPORARILY_UNAVAILABLE',
      message: 'Authentication is temporarily unavailable',
    });
  });

  it('exports all password API handlers', () => {
    expect([
      registerHandler,
      registerVerifyHandler,
      loginHandler,
      resetRequestHandler,
      resetCompleteHandler,
    ]).toEqual([expect.any(Function), expect.any(Function), expect.any(Function), expect.any(Function), expect.any(Function)]);
  });

  it('adds password credentials and durable auth throttling after the existing identity migration', () => {
    const migration = read('lib/migrations.ts');
    const identityMigration = migration.indexOf('await mvp040AccountIdentitySessions(pool)');
    const savedPersonMigration = migration.indexOf('await mvp042SavedPersonIdentity(pool)');
    const passwordMigration = migration.indexOf('await mvp043PasswordAuthentication(pool)');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS account_password_credentials');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS auth_rate_limits');
    expect(migration).toContain("'register'");
    expect(migration).toContain("'password_reset'");
    expect(passwordMigration).toBeGreaterThan(savedPersonMigration);
    expect(savedPersonMigration).toBeGreaterThan(identityMigration);
  });

  it('exposes registration, verification, login, and reset without returning or logging passwords', () => {
    const routes = [
      'pages/api/auth/password/register.ts',
      'pages/api/auth/password/register-verify.ts',
      'pages/api/auth/password/login.ts',
      'pages/api/auth/password/reset-request.ts',
      'pages/api/auth/password/reset-complete.ts',
    ].map(read).join('\n');
    const implementation = read('lib/auth/emailPassword.ts');

    expect(routes).toContain('beginEmailPasswordRegistration');
    expect(routes).toContain('completeEmailPasswordRegistration');
    expect(routes).toContain('authenticateEmailPassword');
    expect(routes).toContain('beginPasswordReset');
    expect(routes).toContain('completePasswordReset');
    expect(implementation).toContain("revoke_reason = 'password_reset'");
    expect(`${routes}\n${implementation}`).not.toMatch(/console\.(?:log|info|warn|error)\([^\n]*(?:password|code)/i);
    expect(`${routes}\n${implementation}`).not.toContain('EMAIL_OTP_DEV_RETURN_CODE');
  });

  it('retires the weaker passwordless email login endpoints', () => {
    const legacyRoutes = [
      'pages/api/auth/email/request.ts',
      'pages/api/auth/email/verify.ts',
    ].map(read).join('\n');
    const identities = read('lib/auth/accountIdentity.ts');
    const client = read('services/accountAuthService.ts');

    expect(legacyRoutes.match(/status\(410\)/g)).toHaveLength(2);
    expect(legacyRoutes.match(/EMAIL_MAGIC_LOGIN_RETIRED/g)).toHaveLength(2);
    expect(identities).not.toContain('requestEmailCode');
    expect(identities).not.toContain('verifyEmailCode');
    expect(identities).not.toContain('EMAIL_OTP_DEV_RETURN_CODE');
    expect(client).not.toContain('/api/auth/email/request');
    expect(client).not.toContain('/api/auth/email/verify');
  });

  it('keeps the email identity on the canonical account and never merges by provider email', () => {
    const implementation = read('lib/auth/emailPassword.ts');
    const identities = read('lib/auth/accountIdentity.ts');

    expect(implementation).toContain("provider = 'email'");
    expect(implementation).toContain('IDENTITY_ALREADY_LINKED');
    expect(implementation).toContain('requireNewIdentity: !targetUserId');
    expect(implementation).toContain('requiredSession: targetUserId');
    expect(identities).toContain('accounts are never auto-merged');
    expect(identities).not.toMatch(/normalized_email\s*=\s*\$\d[^\n]+SELECT\s+user_id/is);
  });

  it('serializes credential writes, reset revocation, and password-session creation', () => {
    const implementation = read('lib/auth/emailPassword.ts');
    const identity = read('lib/auth/accountIdentity.ts');
    const appAuth = read('lib/auth/appAuth.ts');
    const routes = [
      'pages/api/auth/password/register-verify.ts',
      'pages/api/auth/password/login.ts',
      'pages/api/auth/password/reset-complete.ts',
    ].map(read).join('\n');

    expect(identity).toContain('beforeCommit');
    expect(implementation).toContain('writeCredentialWithinTransaction(client');
    expect(implementation).toContain("revoke_reason = 'password_reset'");
    expect(implementation).toContain('passwordVersion');
    expect(appAuth).toContain('createPasswordAppUserSession');
    expect(appAuth).toContain('FOR SHARE OF c, u');
    expect(routes.match(/createPasswordAppUserSession/g)).toHaveLength(6);
  });

  it('invalidates sibling codes and blocks reset sessions for blocked accounts', () => {
    const implementation = read('lib/auth/emailPassword.ts');

    expect(implementation).toContain('challenge_id <> $2');
    expect(implementation).toContain('challenge_id <> $1');
    expect(implementation).toContain('JOIN users u ON u.id = i.user_id');
    expect(implementation).toContain("'ACCOUNT_BLOCKED'");
  });

  it('applies client and identity throttles before the global circuit breaker', () => {
    const implementation = read('lib/auth/emailPassword.ts');
    const sends = implementation.slice(
      implementation.indexOf('async function enforceCodeSendLimits'),
      implementation.indexOf('async function persistChallenge'),
    );
    const verifies = implementation.slice(
      implementation.indexOf('async function claimChallenge'),
      implementation.indexOf('async function releaseChallengeClaim'),
    );
    const logins = implementation.slice(
      implementation.indexOf('export async function authenticateEmailPassword'),
      implementation.indexOf('export async function completePasswordReset'),
    );

    expect(sends.indexOf('_client`')).toBeLessThan(sends.indexOf('_global`'));
    expect(sends.indexOf('_email`')).toBeLessThan(sends.indexOf('_global`'));
    expect(verifies.indexOf('_verify_client`')).toBeLessThan(verifies.indexOf('_verify_global`'));
    expect(verifies.indexOf('_verify_email`')).toBeLessThan(verifies.indexOf('_verify_global`'));
    expect(logins.indexOf("'password_login_client'")).toBeLessThan(logins.indexOf("'password_login_global'"));
    expect(logins.indexOf("'password_login_email'")).toBeLessThan(logins.indexOf("'password_login_global'"));
  });
});
