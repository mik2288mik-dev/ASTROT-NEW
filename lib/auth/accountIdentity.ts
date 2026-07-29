import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { getPool } from '../db';
import { AdminAuthError } from '../adminAuth';

export const EXTERNAL_AUTH_PROVIDERS = ['vk', 'yandex', 'google', 'email', 'telegram'] as const;
export type ExternalAuthProvider = typeof EXTERNAL_AUTH_PROVIDERS[number];
export type AuthPurpose = 'login' | 'link';
export type AppSessionKind = 'web' | 'native' | 'telegram';

type VerifiedIdentity = {
  provider: ExternalAuthProvider;
  subject: string;
  email?: string | null;
  displayName?: string | null;
  metadata?: Record<string, unknown>;
};

type OAuthProviderConfig = {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string;
};

const AUTH_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const AUTH_EXCHANGE_TTL_MS = 5 * 60 * 1000;
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function base64url(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requiredServerValue(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (!value || value.includes('_REQUIRED')) {
    throw new AdminAuthError(503, 'AUTH_PROVIDER_NOT_CONFIGURED', `${name} is required`);
  }
  return value;
}

function oauthConfig(provider: Exclude<ExternalAuthProvider, 'email' | 'telegram'>): OAuthProviderConfig {
  if (provider === 'google') {
    return {
      clientId: requiredServerValue('GOOGLE_AUTH_CLIENT_ID'),
      clientSecret: requiredServerValue('GOOGLE_AUTH_CLIENT_SECRET'),
      authorizeUrl: process.env.GOOGLE_AUTH_AUTHORIZE_URL || 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: process.env.GOOGLE_AUTH_TOKEN_URL || 'https://oauth2.googleapis.com/token',
      userInfoUrl: process.env.GOOGLE_AUTH_USERINFO_URL || 'https://openidconnect.googleapis.com/v1/userinfo',
      scopes: 'openid email profile',
    };
  }
  if (provider === 'yandex') {
    return {
      clientId: requiredServerValue('YANDEX_AUTH_CLIENT_ID'),
      clientSecret: requiredServerValue('YANDEX_AUTH_CLIENT_SECRET'),
      authorizeUrl: process.env.YANDEX_AUTH_AUTHORIZE_URL || 'https://oauth.yandex.ru/authorize',
      tokenUrl: process.env.YANDEX_AUTH_TOKEN_URL || 'https://oauth.yandex.ru/token',
      userInfoUrl: process.env.YANDEX_AUTH_USERINFO_URL || 'https://login.yandex.ru/info?format=json',
      scopes: 'login:email login:info',
    };
  }
  return {
    clientId: requiredServerValue('VK_AUTH_CLIENT_ID'),
    clientSecret: requiredServerValue('VK_AUTH_CLIENT_SECRET'),
    authorizeUrl: process.env.VK_AUTH_AUTHORIZE_URL || 'https://id.vk.com/authorize',
    tokenUrl: process.env.VK_AUTH_TOKEN_URL || 'https://id.vk.com/oauth2/auth',
    userInfoUrl: process.env.VK_AUTH_USERINFO_URL || 'https://id.vk.com/oauth2/user_info',
    scopes: 'vkid.personal_info email',
  };
}

async function createAccountUser(
  client: PoolClient,
  displayName?: string | null,
): Promise<string> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const random = BigInt(`0x${crypto.randomBytes(8).toString('hex')}`)
      % 8_000_000_000_000_000_000n;
    const userId = String(-(random + 1n));
    const inserted = await client.query(
      `INSERT INTO users
       (id, name, language, theme, is_setup, premium_until,
        trial_started_at, is_guest, auth_provider, platform)
       VALUES ($1, $2, 'ru', 'light', FALSE, NULL, NULL, FALSE, 'native', 'native')
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [userId, displayName || 'Пользователь'],
    );
    if (inserted.rowCount) return String(inserted.rows[0]?.id || userId);
  }
  throw new AdminAuthError(503, 'ACCOUNT_ID_ALLOCATION_FAILED', 'Could not allocate an account id');
}

/**
 * Links only a verified provider identity. If that identity belongs to another
 * users.id, the operation fails; populated accounts are never auto-merged.
 */
export async function resolveVerifiedIdentity(
  identity: VerifiedIdentity,
  currentUserId?: string | null,
): Promise<{ userId: string; linked: boolean; existing: boolean }> {
  const subject = String(identity.subject || '').trim();
  if (!subject) throw new AdminAuthError(400, 'IDENTITY_SUBJECT_REQUIRED', 'Verified provider subject is required');
  const email = identity.email ? normalizeEmail(identity.email) : null;
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`account-identity:${identity.provider}:${subject}`],
    );
    const existing = await client.query(
      `SELECT user_id FROM account_identities
       WHERE provider = $1 AND provider_subject = $2 FOR UPDATE`,
      [identity.provider, subject],
    );
    if (existing.rows[0]) {
      const ownerId = String(existing.rows[0].user_id);
      if (currentUserId && ownerId !== currentUserId) {
        throw new AdminAuthError(
          409,
          'IDENTITY_ALREADY_LINKED',
          'This sign-in method is already linked to another account',
        );
      }
      await client.query(
        `UPDATE account_identities
         SET last_used_at = CURRENT_TIMESTAMP, display_name = COALESCE($3, display_name),
             normalized_email = COALESCE($4, normalized_email), metadata = COALESCE($5::jsonb, metadata),
             updated_at = CURRENT_TIMESTAMP
         WHERE provider = $1 AND provider_subject = $2`,
        [identity.provider, subject, identity.displayName || null, email, JSON.stringify(identity.metadata || {})],
      );
      await client.query('COMMIT');
      return { userId: ownerId, linked: false, existing: true };
    }

    let userId = currentUserId || null;
    let upgradingGuest = false;
    if (userId) {
      const user = await client.query('SELECT id, is_guest FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (!user.rowCount) throw new AdminAuthError(404, 'ACCOUNT_NOT_FOUND', 'Account no longer exists');
      upgradingGuest = user.rows[0].is_guest === true;
    } else {
      userId = await createAccountUser(client, identity.displayName);
    }

    await client.query(
      `INSERT INTO account_identities
       (user_id, provider, provider_subject, normalized_email, display_name, last_used_at, metadata)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6::jsonb)`,
      [
        userId,
        identity.provider,
        subject,
        email,
        identity.displayName || null,
        JSON.stringify(identity.metadata || {}),
      ],
    );
    if (upgradingGuest) {
      // Linking the first verified identity upgrades the account in place. The
      // anonymous session must not inherit registered privileges, so revoke all
      // pre-link sessions in the same transaction before flipping is_guest.
      await client.query(
        `UPDATE app_sessions
         SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'identity_linked'
         WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId],
      );
    }
    await client.query(
      `UPDATE users
       SET is_guest = FALSE, auth_provider = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId, identity.provider],
    );
    await client.query('COMMIT');
    return { userId, linked: true, existing: false };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Resolves a verified Telegram identity for an explicit sign-in.
 *
 * Current accounts use account_identities as the canonical mapping, including
 * guests that later linked Telegram. The positive Telegram id is consulted only
 * as a compatibility fallback for a pre-identity legacy account. If a
 * concurrent request (or an older duplicate row) reveals that the identity
 * already belongs elsewhere, the canonical identity owner wins.
 */
export async function resolveTelegramIdentityForLogin(
  identity: Omit<VerifiedIdentity, 'provider'> & { provider: 'telegram' },
  legacyTelegramUserId: string,
): Promise<{ userId: string; linked: boolean; existing: boolean }> {
  const normalizedLegacyId = String(legacyTelegramUserId || '').trim();
  const legacy = normalizedLegacyId
    ? await getPool().query(
        `SELECT id
         FROM users
         WHERE id = $1
           AND id > 0
           AND is_guest = FALSE
           AND COALESCE(auth_provider, 'telegram') = 'telegram'
         LIMIT 1`,
        [normalizedLegacyId],
      )
    : { rowCount: 0 };

  if (legacy.rowCount) {
    try {
      return await resolveVerifiedIdentity(identity, normalizedLegacyId);
    } catch (error) {
      if (!(error instanceof AdminAuthError) || error.code !== 'IDENTITY_ALREADY_LINKED') {
        throw error;
      }
      return resolveVerifiedIdentity(identity, null);
    }
  }

  return resolveVerifiedIdentity(identity, null);
}

export async function listAccountIdentities(userId: string) {
  const result = await getPool().query(
    `SELECT provider, normalized_email, display_name, verified_at, last_used_at, created_at
     FROM account_identities WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  return result.rows.map((row) => ({
    provider: row.provider as ExternalAuthProvider,
    email: row.normalized_email || null,
    displayName: row.display_name || null,
    verifiedAt: row.verified_at,
    lastUsedAt: row.last_used_at,
  }));
}

export async function telegramIdentityBelongsToUser(
  userId: string,
  telegramSubject: string,
): Promise<boolean> {
  const result = await getPool().query(
    `SELECT 1 FROM account_identities
     WHERE user_id = $1 AND provider = 'telegram' AND provider_subject = $2
     LIMIT 1`,
    [userId, telegramSubject],
  );
  return !!result.rowCount;
}

export async function unlinkAccountIdentity(userId: string, provider: ExternalAuthProvider): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const identities = await client.query(
      `SELECT id FROM account_identities WHERE user_id = $1 FOR UPDATE`,
      [userId],
    );
    if ((identities.rowCount ?? 0) <= 1) {
      throw new AdminAuthError(409, 'LAST_IDENTITY_CANNOT_BE_REMOVED', 'Link another sign-in method first');
    }
    await client.query('DELETE FROM account_identities WHERE user_id = $1 AND provider = $2', [userId, provider]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function persistAppSession(input: {
  sessionId: string;
  userId: string;
  kind: AppSessionKind;
  deviceId?: string | null;
  expiresAt?: number;
}): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const expiresAt = new Date((input.expiresAt || Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS) * 1000);
  await getPool().query(
    `INSERT INTO app_sessions (session_id, user_id, session_kind, device_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (session_id) DO NOTHING`,
    [input.sessionId, input.userId, input.kind, input.deviceId || null, expiresAt.toISOString()],
  );
}

export async function assertAppSessionActive(sessionId: string, userId: string): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const result = await getPool().query(
    `UPDATE app_sessions
     SET last_seen_at = CURRENT_TIMESTAMP
     WHERE session_id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > NOW()
     RETURNING session_id`,
    [sessionId, userId],
  );
  if (!result.rowCount) throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
}

export async function revokeSessions(userId: string, sessionId?: string | null): Promise<number> {
  if (!process.env.DATABASE_URL) return 0;
  const params = sessionId ? [userId, sessionId] : [userId];
  const condition = sessionId ? 'AND session_id = $2' : '';
  const result = await getPool().query(
    `UPDATE app_sessions SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'user_request'
     WHERE user_id = $1 ${condition} AND revoked_at IS NULL`,
    params,
  );
  return result.rowCount || 0;
}

export async function userHasRecoveryIdentity(userId: string): Promise<boolean> {
  const result = await getPool().query(
    `SELECT 1 FROM account_identities
     WHERE user_id = $1 AND provider IN ('vk', 'yandex', 'google', 'email') LIMIT 1`,
    [userId],
  );
  return !!result.rowCount;
}

export async function beginOAuth(input: {
  provider: 'vk' | 'yandex' | 'google';
  purpose: AuthPurpose;
  currentUserId?: string | null;
  redirectUri: string;
  native?: boolean;
}): Promise<{ authorizationUrl: string }> {
  const config = oauthConfig(input.provider);
  const challengeId = crypto.randomUUID();
  const state = base64url();
  const codeVerifier = base64url(48);
  const codeChallenge = Buffer.from(sha256(codeVerifier), 'hex').toString('base64url');
  await getPool().query(
    `INSERT INTO auth_challenges
     (challenge_id, provider, purpose, user_id, state_hash, redirect_uri, metadata, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [
      challengeId,
      input.provider,
      input.purpose,
      input.currentUserId || null,
      sha256(state),
      input.redirectUri,
      JSON.stringify({ codeVerifier, native: input.native === true }),
      new Date(Date.now() + AUTH_CHALLENGE_TTL_MS).toISOString(),
    ],
  );
  const url = new URL(config.authorizeUrl);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes);
  url.searchParams.set('state', `${challengeId}.${state}`);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return { authorizationUrl: url.toString() };
}

async function fetchOAuthIdentity(
  provider: 'vk' | 'yandex' | 'google',
  code: string,
  redirectUri: string,
  verifier: string,
): Promise<VerifiedIdentity> {
  const config = oauthConfig(provider);
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code_verifier: verifier,
  });
  const tokenResponse = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenBody,
    signal: AbortSignal.timeout(10_000),
  });
  const token = await tokenResponse.json().catch(() => ({})) as any;
  if (!tokenResponse.ok || !token.access_token) {
    throw new AdminAuthError(401, 'OAUTH_CODE_EXCHANGE_FAILED', 'OAuth provider rejected the code');
  }

  const userInfoResponse = await fetch(config.userInfoUrl, {
    method: provider === 'vk' ? 'POST' : 'GET',
    headers: {
      Authorization: provider === 'yandex'
        ? `OAuth ${token.access_token}`
        : `Bearer ${token.access_token}`,
      ...(provider === 'vk' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: provider === 'vk'
      ? new URLSearchParams({ client_id: config.clientId, access_token: token.access_token })
      : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const raw = await userInfoResponse.json().catch(() => ({})) as any;
  if (!userInfoResponse.ok) throw new AdminAuthError(401, 'OAUTH_USERINFO_FAILED', 'OAuth user info failed');
  const user = raw.user || raw.response?.[0] || raw;
  const subject = String(user.sub || user.id || user.user_id || '').trim();
  if (!subject) throw new AdminAuthError(401, 'OAUTH_IDENTITY_MISSING', 'OAuth provider did not return an id');
  const displayName = String(
    user.name || user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' '),
  ).trim() || null;
  return {
    provider,
    subject,
    email: typeof user.email === 'string' ? user.email : null,
    displayName,
    metadata: { provider },
  };
}

export async function finishOAuth(input: {
  provider: 'vk' | 'yandex' | 'google';
  code: string;
  state: string;
}): Promise<{ exchangeCode: string; userId: string; native: boolean; redirectUri: string }> {
  const [challengeId, stateSecret] = input.state.split('.');
  if (!challengeId || !stateSecret) throw new AdminAuthError(400, 'OAUTH_STATE_INVALID', 'Invalid OAuth state');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT * FROM auth_challenges
       WHERE challenge_id = $1 AND provider = $2 AND consumed_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [challengeId, input.provider],
    );
    const challenge = result.rows[0];
    if (!challenge || challenge.state_hash !== sha256(stateSecret)) {
      throw new AdminAuthError(400, 'OAUTH_STATE_INVALID', 'Invalid or expired OAuth state');
    }
    await client.query(
      `UPDATE auth_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE challenge_id = $1`,
      [challengeId],
    );
    await client.query('COMMIT');
    const metadata = challenge.metadata || {};
    const identity = await fetchOAuthIdentity(
      input.provider,
      input.code,
      challenge.redirect_uri,
      String(metadata.codeVerifier || ''),
    );
    const account = await resolveVerifiedIdentity(identity, challenge.purpose === 'link' ? String(challenge.user_id) : null);
    const exchangeCode = base64url(36);
    await getPool().query(
      `INSERT INTO auth_exchange_codes (code_hash, user_id, session_kind, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [
        sha256(exchangeCode),
        account.userId,
        metadata.native === true ? 'native' : 'web',
        new Date(Date.now() + AUTH_EXCHANGE_TTL_MS).toISOString(),
      ],
    );
    return {
      exchangeCode,
      userId: account.userId,
      native: metadata.native === true,
      redirectUri: challenge.redirect_uri,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function consumeAuthExchange(code: string): Promise<{ userId: string; kind: 'web' | 'native' }> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT user_id, session_kind FROM auth_exchange_codes
       WHERE code_hash = $1 AND consumed_at IS NULL AND expires_at > NOW() FOR UPDATE`,
      [sha256(code)],
    );
    if (!result.rows[0]) throw new AdminAuthError(401, 'AUTH_EXCHANGE_INVALID', 'Login code is invalid or expired');
    await client.query(
      `UPDATE auth_exchange_codes SET consumed_at = CURRENT_TIMESTAMP WHERE code_hash = $1`,
      [sha256(code)],
    );
    await client.query('COMMIT');
    return { userId: String(result.rows[0].user_id), kind: result.rows[0].session_kind };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function deliverEmailCode(email: string, code: string): Promise<void> {
  const endpoint = requiredServerValue('EMAIL_OTP_DELIVERY_URL');
  const secret = requiredServerValue('EMAIL_OTP_DELIVERY_SECRET');
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    body: JSON.stringify({ to: email, template: 'login_code', code, expiresInMinutes: 10 }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new AdminAuthError(503, 'EMAIL_DELIVERY_FAILED', 'Could not send login code');
}

export async function requestEmailCode(input: {
  email: string;
  purpose: AuthPurpose;
  currentUserId?: string | null;
}): Promise<{ challengeId: string; devCode?: string }> {
  const email = normalizeEmail(input.email);
  if (!validEmail(email)) throw new AdminAuthError(400, 'EMAIL_INVALID', 'Enter a valid email address');
  const recent = await getPool().query(
    `SELECT COUNT(*)::int AS count
     FROM auth_challenges
     WHERE provider = 'email' AND metadata->>'email' = $1
       AND created_at > NOW() - interval '15 minutes'`,
    [email],
  );
  if (Number(recent.rows[0]?.count || 0) >= 5) {
    throw new AdminAuthError(429, 'EMAIL_CODE_RATE_LIMITED', 'Wait before requesting another code');
  }
  const challengeId = crypto.randomUUID();
  const code = String(crypto.randomInt(100000, 1000000));
  await getPool().query(
    `INSERT INTO auth_challenges
     (challenge_id, provider, purpose, user_id, secret_hash, metadata, expires_at)
     VALUES ($1, 'email', $2, $3, $4, $5::jsonb, $6)`,
    [
      challengeId,
      input.purpose,
      input.currentUserId || null,
      sha256(`${challengeId}:${code}`),
      JSON.stringify({ email }),
      new Date(Date.now() + EMAIL_CODE_TTL_MS).toISOString(),
    ],
  );
  if (process.env.NODE_ENV !== 'test') await deliverEmailCode(email, code);
  return {
    challengeId,
    ...(process.env.NODE_ENV === 'test' || process.env.EMAIL_OTP_DEV_RETURN_CODE === '1' ? { devCode: code } : {}),
  };
}

export async function verifyEmailCode(input: {
  challengeId: string;
  code: string;
}): Promise<{ userId: string }> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT * FROM auth_challenges
       WHERE challenge_id = $1 AND provider = 'email' AND consumed_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [input.challengeId],
    );
    const challenge = result.rows[0];
    if (!challenge) throw new AdminAuthError(401, 'EMAIL_CODE_INVALID', 'Code is invalid or expired');
    if (challenge.attempts >= 5 || challenge.secret_hash !== sha256(`${input.challengeId}:${input.code}`)) {
      await client.query(
        `UPDATE auth_challenges SET attempts = attempts + 1 WHERE challenge_id = $1`,
        [input.challengeId],
      );
      await client.query('COMMIT');
      throw new AdminAuthError(401, 'EMAIL_CODE_INVALID', 'Code is invalid or expired');
    }
    await client.query(
      `UPDATE auth_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE challenge_id = $1`,
      [input.challengeId],
    );
    await client.query('COMMIT');
    const email = normalizeEmail(String(challenge.metadata?.email || ''));
    const account = await resolveVerifiedIdentity(
      { provider: 'email', subject: email, email },
      challenge.purpose === 'link' ? String(challenge.user_id) : null,
    );
    return { userId: account.userId };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
