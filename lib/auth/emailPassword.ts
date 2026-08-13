import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { AdminAuthError } from '../adminAuth';
import { getPool } from '../db';
import { logger } from '../logger';
import { createAuthCode, hashAuthCode, verifyAuthCode } from './authCode';
import {
  clearAuthRateLimit,
  consumeAuthRateLimit,
} from './authRateLimit';
import {
  assertEmailDeliveryConfigured,
  EMAIL_AUTH_CODE_DELIVERY_TIMEOUT_MS,
  sendEmailAuthCode,
} from './emailDelivery';
import { resolveVerifiedIdentity } from './accountIdentity';
import {
  assertValidNewPassword,
  hashPassword,
  PasswordValidationError,
  verifyPassword,
} from './passwordHash';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
// Both deliverable and suppressed requests cross the same response floor.
// Delivery is forcibly bounded below it so a slow/outage adapter cannot reveal
// whether the email exists through request duration.
const MIN_CODE_REQUEST_MS = EMAIL_AUTH_CODE_DELIVERY_TIMEOUT_MS + 1_000;
const DUMMY_PASSWORD_HASH = 'scrypt$v=1$ln=15,r=8,p=3$3lI0asj1Bh-Tm6NKKMQVFg$OZxJ2ZPMovAjzcZDsmGp_EPf1vtsp4-qxDGG01BwxpUMGj0ge_cbw5jW9OA9L04KXKOP4fM_Bx5zu1N9P8wbTg';

type ChallengePurpose = 'register' | 'password_reset';
type ClaimedChallenge = {
  challenge_id: string;
  purpose: ChallengePurpose;
  user_id: string | number | null;
  credential_hash: string | null;
  metadata: { email?: unknown } | null;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function assertValidEmail(value: string): string {
  const email = normalizeEmail(value);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AdminAuthError(400, 'EMAIL_INVALID', 'Enter a valid email address');
  }
  return email;
}

function validateNewPassword(password: string, confirmation: string): void {
  try {
    assertValidNewPassword(password, confirmation);
  } catch (error) {
    if (error instanceof PasswordValidationError) {
      throw new AdminAuthError(400, error.code, error.message);
    }
    throw error;
  }
}

function invalidCredentials(): AdminAuthError {
  return new AdminAuthError(401, 'EMAIL_OR_PASSWORD_INVALID', 'Email or password is invalid');
}

function invalidCode(): AdminAuthError {
  return new AdminAuthError(401, 'AUTH_CODE_INVALID', 'Code is invalid or expired');
}

async function waitForUniformCodeResponse(startedAt: number): Promise<void> {
  const targetMs = MIN_CODE_REQUEST_MS + crypto.randomInt(0, 251);
  const remainingMs = targetMs - (Date.now() - startedAt);
  if (remainingMs > 0) await new Promise((resolve) => setTimeout(resolve, remainingMs));
}

function asIdentityConflict(error: unknown): never {
  if (error instanceof AdminAuthError) throw error;
  if ((error as { code?: string } | null)?.code === '23505') {
    throw new AdminAuthError(
      409,
      'IDENTITY_ALREADY_LINKED',
      'This sign-in method is already linked to another account',
    );
  }
  throw error;
}

export function sanitizeEmailPasswordError(error: unknown): AdminAuthError {
  if (error instanceof AdminAuthError) return error;
  if (error instanceof PasswordValidationError) {
    return new AdminAuthError(400, error.code, error.message);
  }
  return new AdminAuthError(
    503,
    'AUTH_TEMPORARILY_UNAVAILABLE',
    'Authentication is temporarily unavailable',
  );
}

async function enforceCodeSendLimits(
  purpose: ChallengePurpose,
  email: string,
  clientKey: string,
): Promise<void> {
  await consumeAuthRateLimit({
    scope: `${purpose}_client`,
    key: clientKey,
    maxAttempts: 20,
    windowMs: RATE_WINDOW_MS,
  });
  await consumeAuthRateLimit({
    scope: `${purpose}_resend`,
    key: email,
    maxAttempts: 1,
    windowMs: RESEND_COOLDOWN_MS,
  });
  await consumeAuthRateLimit({
    scope: `${purpose}_email`,
    key: email,
    maxAttempts: 5,
    windowMs: RATE_WINDOW_MS,
  });
  await consumeAuthRateLimit({
    scope: `${purpose}_global`,
    key: 'global',
    maxAttempts: 500,
    windowMs: RATE_WINDOW_MS,
  });
}

async function persistChallenge(input: {
  purpose: ChallengePurpose;
  email: string;
  userId?: string | null;
  credentialHash?: string | null;
  deliveryStatus: 'pending' | 'suppressed';
  challengeId: string;
  codeHash: string;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO auth_challenges
       (challenge_id, provider, purpose, user_id, secret_hash, credential_hash,
        metadata, delivery_status, last_sent_at, expires_at)
     VALUES ($1, 'email', $2, $3, $4, $5, $6::jsonb, $7, CURRENT_TIMESTAMP, $8)`,
    [
      input.challengeId,
      input.purpose,
      input.userId || null,
      input.codeHash,
      input.credentialHash || null,
      JSON.stringify({ email: input.email }),
      input.deliveryStatus,
      new Date(Date.now() + CODE_TTL_MS).toISOString(),
    ],
  );
}

async function cleanupExpiredEmailChallenges(): Promise<void> {
  await getPool().query(
    `WITH expired AS (
       SELECT challenge_id FROM auth_challenges
       WHERE provider = 'email' AND expires_at < NOW() - INTERVAL '1 day'
       ORDER BY expires_at
       LIMIT 250
     )
     DELETE FROM auth_challenges c
     USING expired e
     WHERE c.challenge_id = e.challenge_id`,
  );
}

async function deliverPendingChallenge(input: {
  challengeId: string;
  email: string;
  code: string;
  purpose: ChallengePurpose;
  shouldDeliver: boolean;
}): Promise<void> {
  if (!input.shouldDeliver) return;
  try {
    await sendEmailAuthCode({ email: input.email, code: input.code, purpose: input.purpose });
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE auth_challenges
         SET consumed_at = CURRENT_TIMESTAMP, claimed_at = NULL, credential_hash = NULL
         WHERE provider = 'email' AND purpose = $1 AND challenge_id <> $2
           AND consumed_at IS NULL AND metadata->>'email' = $3`,
        [input.purpose, input.challengeId, input.email],
      );
      const sent = await client.query(
        `UPDATE auth_challenges
         SET delivery_status = 'sent', delivered_at = CURRENT_TIMESTAMP
         WHERE challenge_id = $1 AND consumed_at IS NULL
         RETURNING challenge_id`,
        [input.challengeId],
      );
      if (!sent.rowCount) throw new Error('EMAIL_CHALLENGE_SUPERSEDED');
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    await getPool().query(
      `UPDATE auth_challenges
       SET delivery_status = 'failed', consumed_at = CURRENT_TIMESTAMP, credential_hash = NULL
       WHERE challenge_id = $1 AND consumed_at IS NULL`,
      [input.challengeId],
    ).catch(() => undefined);
    throw error;
  }
}

export async function beginEmailPasswordRegistration(input: {
  email: string;
  password: string;
  passwordConfirmation: string;
  clientKey: string;
  currentUserId?: string | null;
}): Promise<{ challengeId: string }> {
  const startedAt = Date.now();
  assertEmailDeliveryConfigured();
  const email = assertValidEmail(input.email);
  validateNewPassword(input.password, input.passwordConfirmation);
  await enforceCodeSendLimits('register', email, input.clientKey);
  await cleanupExpiredEmailChallenges();

  // Hash before checking account state so response timing does not reveal whether
  // this email identity already exists. Only the hash enters the pending row.
  const credentialHash = await hashPassword(input.password);
  const existing = await getPool().query(
    `SELECT user_id FROM account_identities
     WHERE provider = 'email' AND provider_subject = $1 LIMIT 1`,
    [email],
  );
  const existingOwnerId = existing.rows[0]?.user_id == null
    ? null
    : String(existing.rows[0].user_id);
  const shouldDeliver = !existingOwnerId
    || (!!input.currentUserId && existingOwnerId === String(input.currentUserId));
  const challengeId = cryptoRandomId();
  const code = createAuthCode();
  await persistChallenge({
    purpose: 'register',
    email,
    userId: input.currentUserId || null,
    credentialHash: shouldDeliver ? credentialHash : null,
    deliveryStatus: shouldDeliver ? 'pending' : 'suppressed',
    challengeId,
    codeHash: hashAuthCode(challengeId, code),
  });
  await deliverPendingChallenge({ challengeId, email, code, purpose: 'register', shouldDeliver })
    .catch(() => {
      // Keep the public response indistinguishable from a suppressed duplicate.
      // The challenge row carries the failure state; telemetry contains no email.
      logger.error({ scope: 'account-auth', event: 'email_code_delivery_failed', status: 'register' });
    });
  await waitForUniformCodeResponse(startedAt);
  return { challengeId };
}

export async function beginPasswordReset(input: {
  email: string;
  clientKey: string;
}): Promise<{ challengeId: string }> {
  const startedAt = Date.now();
  assertEmailDeliveryConfigured();
  const email = assertValidEmail(input.email);
  await enforceCodeSendLimits('password_reset', email, input.clientKey);
  await cleanupExpiredEmailChallenges();
  const identity = await getPool().query(
    `SELECT user_id FROM account_identities
     WHERE provider = 'email' AND provider_subject = $1 LIMIT 1`,
    [email],
  );
  const userId = identity.rows[0]?.user_id ? String(identity.rows[0].user_id) : null;
  const challengeId = cryptoRandomId();
  const code = createAuthCode();
  await persistChallenge({
    purpose: 'password_reset',
    email,
    userId,
    deliveryStatus: userId ? 'pending' : 'suppressed',
    challengeId,
    codeHash: hashAuthCode(challengeId, code),
  });
  await deliverPendingChallenge({
    challengeId,
    email,
    code,
    purpose: 'password_reset',
    shouldDeliver: !!userId,
  }).catch(() => {
    logger.error({ scope: 'account-auth', event: 'email_code_delivery_failed', status: 'password_reset' });
  });
  await waitForUniformCodeResponse(startedAt);
  return { challengeId };
}

function cryptoRandomId(): string {
  return crypto.randomUUID();
}

async function claimChallenge(input: {
  challengeId: string;
  code: string;
  purpose: ChallengePurpose;
  clientKey: string;
}): Promise<ClaimedChallenge> {
  await consumeAuthRateLimit({
    scope: `${input.purpose}_verify_client`,
    key: input.clientKey,
    maxAttempts: 30,
    windowMs: RATE_WINDOW_MS,
  });
  const candidate = await getPool().query(
    `SELECT metadata FROM auth_challenges
     WHERE challenge_id = $1 AND provider = 'email' AND purpose = $2
       AND consumed_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [input.challengeId, input.purpose],
  );
  const candidateEmail = normalizeEmail(String(candidate.rows[0]?.metadata?.email || ''));
  if (candidateEmail) {
    await consumeAuthRateLimit({
      scope: `${input.purpose}_verify_email`,
      key: candidateEmail,
      maxAttempts: 15,
      windowMs: RATE_WINDOW_MS,
    });
  }
  await consumeAuthRateLimit({
    scope: `${input.purpose}_verify_global`,
    key: 'global',
    maxAttempts: 2_000,
    windowMs: RATE_WINDOW_MS,
  });
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT challenge_id, purpose, user_id, secret_hash, credential_hash, metadata,
              attempts, claimed_at
       FROM auth_challenges
       WHERE challenge_id = $1 AND provider = 'email' AND purpose = $2
         AND delivery_status = 'sent' AND consumed_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [input.challengeId, input.purpose],
    );
    const challenge = result.rows[0];
    if (!challenge || challenge.claimed_at || Number(challenge.attempts || 0) >= MAX_CODE_ATTEMPTS) {
      throw invalidCode();
    }
    assertValidEmail(String(challenge.metadata?.email || ''));
    if (!verifyAuthCode(input.challengeId, input.code.trim(), String(challenge.secret_hash || ''))) {
      await client.query(
        `UPDATE auth_challenges
         SET attempts = attempts + 1,
             consumed_at = CASE WHEN attempts + 1 >= $2 THEN CURRENT_TIMESTAMP ELSE consumed_at END
         WHERE challenge_id = $1`,
        [input.challengeId, MAX_CODE_ATTEMPTS],
      );
      await client.query('COMMIT');
      throw invalidCode();
    }
    await client.query(
      'UPDATE auth_challenges SET claimed_at = CURRENT_TIMESTAMP WHERE challenge_id = $1',
      [input.challengeId],
    );
    await client.query('COMMIT');
    return challenge as ClaimedChallenge;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function releaseChallengeClaim(challengeId: string): Promise<void> {
  await getPool().query(
    `UPDATE auth_challenges SET claimed_at = NULL
     WHERE challenge_id = $1 AND consumed_at IS NULL`,
    [challengeId],
  ).catch(() => undefined);
}

async function writeCredentialWithinTransaction(client: PoolClient, input: {
  challengeId: string;
  userId: string;
  passwordHash: string;
  reset: boolean;
}): Promise<number> {
  const challenge = await client.query(
      `SELECT 1 FROM auth_challenges
       WHERE challenge_id = $1 AND claimed_at IS NOT NULL
         AND consumed_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [input.challengeId],
  );
  if (!challenge.rowCount) throw invalidCode();
  const credential = await client.query(
      `INSERT INTO account_password_credentials
         (user_id, password_hash, hash_algorithm, password_version,
          password_changed_at, created_at, updated_at)
       VALUES ($1, $2, 'scrypt', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         hash_algorithm = EXCLUDED.hash_algorithm,
          password_version = account_password_credentials.password_version + 1,
          password_changed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        RETURNING password_version`,
      [input.userId, input.passwordHash],
  );
  if (input.reset) {
    await client.query(
        `UPDATE app_sessions
         SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'password_reset'
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [input.userId],
    );
  }
  await client.query(
      `UPDATE auth_challenges
       SET consumed_at = CURRENT_TIMESTAMP, claimed_at = NULL, credential_hash = NULL
       WHERE challenge_id = $1`,
      [input.challengeId],
  );
  await client.query(
    `UPDATE auth_challenges
     SET consumed_at = CURRENT_TIMESTAMP, claimed_at = NULL, credential_hash = NULL
     WHERE provider = 'email' AND challenge_id <> $1 AND consumed_at IS NULL
       AND purpose = (SELECT purpose FROM auth_challenges WHERE challenge_id = $1)
       AND metadata->>'email' = (
         SELECT metadata->>'email' FROM auth_challenges WHERE challenge_id = $1
       )`,
    [input.challengeId],
  );
  return Number(credential.rows[0]?.password_version || 1);
}

async function finishCredentialWrite(input: {
  challengeId: string;
  userId: string;
  passwordHash: string;
  reset: boolean;
}): Promise<number> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const passwordVersion = await writeCredentialWithinTransaction(client, input);
    await client.query('COMMIT');
    return passwordVersion;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function completeEmailPasswordRegistration(input: {
  challengeId: string;
  code: string;
  clientKey: string;
  currentUserId?: string | null;
  currentSessionId?: string | null;
}): Promise<{ userId: string; passwordVersion: number }> {
  const challenge = await claimChallenge({ ...input, purpose: 'register' });
  const email = assertValidEmail(String(challenge.metadata?.email || ''));
  const targetUserId = challenge.user_id ? String(challenge.user_id) : null;
  if (targetUserId && input.currentUserId !== targetUserId) {
    await releaseChallengeClaim(input.challengeId);
    throw new AdminAuthError(401, 'LINK_SESSION_REQUIRED', 'The linking session is no longer valid');
  }
  if (targetUserId && !input.currentSessionId) {
    await releaseChallengeClaim(input.challengeId);
    throw new AdminAuthError(401, 'LINK_SESSION_REQUIRED', 'The linking session is no longer valid');
  }
  if (!challenge.credential_hash) {
    await releaseChallengeClaim(input.challengeId);
    throw invalidCode();
  }

  let passwordVersion = 0;
  try {
    const account = await resolveVerifiedIdentity(
      { provider: 'email', subject: email, email },
      targetUserId,
      {
        requireNewIdentity: !targetUserId,
        requiredSession: targetUserId
          ? { userId: targetUserId, sessionId: input.currentSessionId! }
          : undefined,
        beforeCommit: async (client, userId) => {
          passwordVersion = await writeCredentialWithinTransaction(client, {
            challengeId: input.challengeId,
            userId,
            passwordHash: challenge.credential_hash!,
            reset: false,
          });
        },
      },
    );
    return { userId: account.userId, passwordVersion };
  } catch (error) {
    await releaseChallengeClaim(input.challengeId);
    asIdentityConflict(error);
  }
}

export async function authenticateEmailPassword(input: {
  email: string;
  password: string;
  clientKey: string;
}): Promise<{ userId: string; passwordVersion: number }> {
  const email = assertValidEmail(input.email);
  await consumeAuthRateLimit({
    scope: 'password_login_client',
    key: input.clientKey,
    maxAttempts: 30,
    windowMs: RATE_WINDOW_MS,
  });
  await consumeAuthRateLimit({
    scope: 'password_login_email',
    key: email,
    maxAttempts: 10,
    windowMs: RATE_WINDOW_MS,
  });
  await consumeAuthRateLimit({
    scope: 'password_login_global',
    key: 'global',
    maxAttempts: 1_000,
    windowMs: RATE_WINDOW_MS,
  });

  const result = await getPool().query(
     `SELECT i.user_id, c.password_hash, c.password_version, u.is_blocked
     FROM account_identities i
     JOIN users u ON u.id = i.user_id
     LEFT JOIN account_password_credentials c ON c.user_id = i.user_id
     WHERE i.provider = 'email' AND i.provider_subject = $1
     LIMIT 1`,
    [email],
  );
  const row = result.rows[0];
  const passwordWithinLimit = Array.from(input.password).length <= 128
    && Buffer.byteLength(input.password, 'utf8') <= 512;
  const candidate = passwordWithinLimit ? input.password : 'invalid-oversized-password';
  const valid = await verifyPassword(candidate, row?.password_hash || DUMMY_PASSWORD_HASH);
  if (!row?.password_hash || !valid) throw invalidCredentials();
  if (row.is_blocked === true) {
    throw new AdminAuthError(403, 'ACCOUNT_BLOCKED', 'Account is blocked');
  }
  await clearAuthRateLimit('password_login_email', email);
  return { userId: String(row.user_id), passwordVersion: Number(row.password_version) };
}

export async function completePasswordReset(input: {
  challengeId: string;
  code: string;
  password: string;
  passwordConfirmation: string;
  clientKey: string;
}): Promise<{ userId: string; passwordVersion: number }> {
  validateNewPassword(input.password, input.passwordConfirmation);
  const challenge = await claimChallenge({ ...input, purpose: 'password_reset' });
  const email = assertValidEmail(String(challenge.metadata?.email || ''));
  const userId = challenge.user_id ? String(challenge.user_id) : '';
  if (!userId) {
    await releaseChallengeClaim(input.challengeId);
    throw invalidCode();
  }
  const identity = await getPool().query(
    `SELECT u.is_blocked
     FROM account_identities i
     JOIN users u ON u.id = i.user_id
     WHERE i.user_id = $1 AND i.provider = 'email' AND i.provider_subject = $2
     LIMIT 1`,
    [userId, email],
  );
  if (!identity.rowCount) {
    await releaseChallengeClaim(input.challengeId);
    throw invalidCode();
  }
  if (identity.rows[0]?.is_blocked === true) {
    await releaseChallengeClaim(input.challengeId);
    throw new AdminAuthError(403, 'ACCOUNT_BLOCKED', 'Account is blocked');
  }
  const passwordHash = await hashPassword(input.password);
  try {
    const passwordVersion = await finishCredentialWrite({
      challengeId: input.challengeId,
      userId,
      passwordHash,
      reset: true,
    });
    await clearAuthRateLimit('password_login_email', email);
    return { userId, passwordVersion };
  } catch (error) {
    await releaseChallengeClaim(input.challengeId);
    throw error;
  }
}
