import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { getPool } from '../db';
import { AdminAuthError, getConfiguredOwnerId } from '../adminAuth';
import {
  hashOAuthBrowserExchange,
  oauthBrowserBindingMatches,
} from './oauthBrowserBinding';

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
    authorizeUrl: process.env.VK_AUTH_AUTHORIZE_URL || 'https://id.vk.ru/authorize',
    tokenUrl: process.env.VK_AUTH_TOKEN_URL || 'https://id.vk.ru/oauth2/auth',
    userInfoUrl: process.env.VK_AUTH_USERINFO_URL || 'https://id.vk.ru/oauth2/user_info',
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
  options: {
    beforeCommit?: (client: PoolClient, userId: string) => Promise<void>;
    requireNewIdentity?: boolean;
    requiredSession?: { userId: string; sessionId: string };
  } = {},
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
    if (options.requiredSession) {
      const requiredUserId = String(options.requiredSession.userId || '');
      const requiredSessionId = String(options.requiredSession.sessionId || '');
      if (!currentUserId || currentUserId !== requiredUserId || !requiredSessionId) {
        throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
      }
      const activeSession = await client.query(
        `SELECT session_id FROM app_sessions
         WHERE session_id = $1 AND user_id = $2
           AND revoked_at IS NULL AND expires_at > NOW()
         FOR SHARE`,
        [requiredSessionId, requiredUserId],
      );
      if (!activeSession.rowCount) {
        throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
      }
    }
    const existing = await client.query(
      `SELECT user_id FROM account_identities
       WHERE provider = $1 AND provider_subject = $2 FOR UPDATE`,
      [identity.provider, subject],
    );
    if (existing.rows[0]) {
      const ownerId = String(existing.rows[0].user_id);
      if (options.requireNewIdentity) {
        throw new AdminAuthError(
          409,
          'IDENTITY_ALREADY_LINKED',
          'This sign-in method is already linked to another account',
        );
      }
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
      await options.beforeCommit?.(client, ownerId);
      await client.query('COMMIT');
      return { userId: ownerId, linked: false, existing: true };
    }

    let userId = currentUserId || null;
    let upgradingGuest = false;
    if (userId) {
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`account-provider:${userId}:${identity.provider}`],
      );
      const user = await client.query('SELECT id, is_guest FROM users WHERE id = $1 FOR UPDATE', [userId]);
      if (!user.rowCount) throw new AdminAuthError(404, 'ACCOUNT_NOT_FOUND', 'Account no longer exists');
      upgradingGuest = user.rows[0].is_guest === true;
      const providerIdentity = await client.query(
        `SELECT provider_subject FROM account_identities
         WHERE user_id = $1 AND provider = $2 FOR UPDATE`,
        [userId, identity.provider],
      );
      if (providerIdentity.rows[0]) {
        throw new AdminAuthError(
          409,
          'PROVIDER_ALREADY_LINKED',
          'This account already has a different identity for that provider',
        );
      }
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
    await options.beforeCommit?.(client, userId);
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
  let resolved: { userId: string; linked: boolean; existing: boolean };
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
      resolved = await resolveVerifiedIdentity(identity, normalizedLegacyId);
    } catch (error) {
      if (!(error instanceof AdminAuthError) || error.code !== 'IDENTITY_ALREADY_LINKED') {
        throw error;
      }
      resolved = await resolveVerifiedIdentity(identity, null);
    }
  } else {
    resolved = await resolveVerifiedIdentity(identity, null);
  }

  // users.id can be a stable internal account id after an identity migration.
  // OWNER_ID still names the verified Telegram user, so persist the resulting
  // effective admin flag on that canonical account.
  if (normalizedLegacyId && normalizedLegacyId === getConfiguredOwnerId()) {
    await getPool().query(
      `UPDATE users SET is_admin = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [resolved.userId],
    );
  }

  return resolved;
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
  browserBindingHash: string;
  requiredSession?: { userId: string; sessionId: string };
}): Promise<{ authorizationUrl: string }> {
  if (!/^[a-f0-9]{64}$/.test(input.browserBindingHash)) {
    throw new AdminAuthError(400, 'OAUTH_BROWSER_BINDING_INVALID', 'OAuth browser binding is invalid');
  }
  if (
    input.purpose === 'link'
    && (
      !input.currentUserId
      || !input.requiredSession?.sessionId
      || input.requiredSession.userId !== input.currentUserId
    )
  ) {
    throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
  }
  const config = oauthConfig(input.provider);
  const challengeId = crypto.randomUUID();
  const state = base64url();
  const codeVerifier = base64url(48);
  const codeChallenge = Buffer.from(sha256(codeVerifier), 'hex').toString('base64url');
  await getPool().query(
    `WITH expired AS (
       SELECT challenge_id FROM auth_challenges
       WHERE expires_at < NOW()
       ORDER BY expires_at
       LIMIT 250
     )
     DELETE FROM auth_challenges c
     USING expired e
     WHERE c.challenge_id = e.challenge_id`,
  ).catch(() => undefined);
  await getPool().query(
    `WITH expired AS (
       SELECT code_hash FROM auth_exchange_codes
       WHERE expires_at < NOW()
       ORDER BY expires_at
       LIMIT 250
     )
     DELETE FROM auth_exchange_codes c
     USING expired e
     WHERE c.code_hash = e.code_hash`,
  ).catch(() => undefined);
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
      JSON.stringify({
        codeVerifier,
        oauthBindingHash: input.browserBindingHash,
        ...(input.requiredSession ? { requiredSessionId: input.requiredSession.sessionId } : {}),
      }),
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
  url.searchParams.set('code_challenge_method', input.provider === 'vk' ? 's256' : 'S256');
  return { authorizationUrl: url.toString() };
}

async function fetchOAuthIdentity(
  provider: 'vk' | 'yandex' | 'google',
  code: string,
  redirectUri: string,
  verifier: string,
  state: string,
  deviceId?: string,
): Promise<VerifiedIdentity> {
  const config = oauthConfig(provider);
  if (provider === 'vk' && !deviceId) {
    throw new AdminAuthError(400, 'VK_DEVICE_ID_REQUIRED', 'VK ID did not return a device id');
  }
  const tokenBody = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: config.clientId,
    code_verifier: verifier,
    ...(provider === 'vk'
      ? { device_id: deviceId!, state }
      : { client_secret: config.clientSecret }),
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

  const userInfoUrl = provider === 'vk'
    ? `${config.userInfoUrl}?client_id=${encodeURIComponent(config.clientId)}`
    : config.userInfoUrl;
  const userInfoResponse = await fetch(userInfoUrl, {
    method: provider === 'vk' ? 'POST' : 'GET',
    headers: {
      ...(provider !== 'vk' ? {
        Authorization: provider === 'yandex'
          ? `OAuth ${token.access_token}`
          : `Bearer ${token.access_token}`,
      } : {}),
      ...(provider === 'vk' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: provider === 'vk'
      ? new URLSearchParams({ access_token: token.access_token, device_id: deviceId! })
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
  deviceId?: string;
  browserBinding: string;
}): Promise<{ exchangeCode: string; userId: string; redirectUri: string }> {
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
    const metadata = typeof challenge.metadata === 'string'
      ? JSON.parse(challenge.metadata)
      : challenge.metadata || {};
    if (
      !input.browserBinding
      || typeof metadata.oauthBindingHash !== 'string'
      || !oauthBrowserBindingMatches(input.browserBinding, metadata.oauthBindingHash)
    ) {
      throw new AdminAuthError(
        401,
        'OAUTH_BROWSER_BINDING_INVALID',
        'This OAuth login must be completed in the browser where it started',
      );
    }
    await client.query(
      `UPDATE auth_challenges SET consumed_at = CURRENT_TIMESTAMP WHERE challenge_id = $1`,
      [challengeId],
    );
    await client.query('COMMIT');
    const identity = await fetchOAuthIdentity(
      input.provider,
      input.code,
      challenge.redirect_uri,
      String(metadata.codeVerifier || ''),
      stateSecret,
      input.deviceId,
    );
    const linkUserId = challenge.purpose === 'link' ? String(challenge.user_id || '') : null;
    const requiredSessionId = typeof metadata.requiredSessionId === 'string'
      ? metadata.requiredSessionId
      : '';
    if (challenge.purpose === 'link' && (!linkUserId || !requiredSessionId)) {
      throw new AdminAuthError(401, 'APP_SESSION_REVOKED', 'This session is no longer valid');
    }
    const account = await resolveVerifiedIdentity(
      identity,
      linkUserId,
      linkUserId
        ? { requiredSession: { userId: linkUserId, sessionId: requiredSessionId } }
        : {},
    );
    const exchangeCode = base64url(36);
    await getPool().query(
      `INSERT INTO auth_exchange_codes (code_hash, user_id, session_kind, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [
        hashOAuthBrowserExchange(exchangeCode, input.browserBinding),
        account.userId,
        'web',
        new Date(Date.now() + AUTH_EXCHANGE_TTL_MS).toISOString(),
      ],
    );
    return {
      exchangeCode,
      userId: account.userId,
      redirectUri: challenge.redirect_uri,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function consumeAuthExchange(code: string, browserBinding: string): Promise<{ userId: string; kind: 'web' }> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const codeHash = hashOAuthBrowserExchange(code, browserBinding);
    const result = await client.query(
      `SELECT user_id, session_kind FROM auth_exchange_codes
       WHERE code_hash = $1 AND session_kind = 'web'
         AND consumed_at IS NULL AND expires_at > NOW() FOR UPDATE`,
      [codeHash],
    );
    if (!result.rows[0]) throw new AdminAuthError(401, 'AUTH_EXCHANGE_INVALID', 'Login code is invalid or expired');
    await client.query(
      `UPDATE auth_exchange_codes SET consumed_at = CURRENT_TIMESTAMP
       WHERE code_hash = $1 AND session_kind = 'web'`,
      [codeHash],
    );
    await client.query('COMMIT');
    return { userId: String(result.rows[0].user_id), kind: 'web' };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
