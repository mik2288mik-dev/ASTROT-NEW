import crypto from 'crypto';
import { AdminAuthError } from '../adminAuth';
import { getPool } from '../db';
import { resolveVerifiedIdentity } from './accountIdentity';

export const NATIVE_AUTH_PROVIDERS = ['yandex', 'vk'] as const;
export type NativeAuthProvider = typeof NATIVE_AUTH_PROVIDERS[number];
export type NativeAuthPurpose = 'login' | 'link';

type NativeProviderCredential = {
  accessToken?: string;
  code?: string;
  deviceId?: string;
  state?: string;
};

type ChallengeRow = {
  challenge_id: string;
  provider: NativeAuthProvider;
  purpose: NativeAuthPurpose;
  user_id: string | number | null;
  state_hash: string | null;
  metadata: Record<string, unknown> | string | null;
  attempts: number;
  claimed_at: string | null;
};

type VerifiedNativeIdentity = {
  provider: NativeAuthProvider;
  subject: string;
  email?: string | null;
  displayName?: string | null;
  metadata: Record<string, unknown>;
};

const OPAQUE_TOKEN_MAX_LENGTH = 8_192;
const PROVIDER_REQUEST_TIMEOUT_MS = 10_000;
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_CHALLENGE_ATTEMPTS = 3;
const YANDEX_USERINFO_URL = 'https://login.yandex.ru/info?format=json';
const VK_TOKEN_URL = 'https://id.vk.ru/oauth2/auth';
const VK_USERINFO_URL = 'https://id.vk.ru/oauth2/user_info';

function randomBase64Url(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function equalHexDigest(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function configuredValue(name: string): string {
  const value = String(process.env[name] || '').trim();
  if (
    !value
    || /_REQUIRED/i.test(value)
    || /^your[_-]/i.test(value)
    || /^replace-with/i.test(value)
    || value.includes('[УКАЖИТЕ')
  ) return '';
  return value;
}

function requiredClientId(provider: NativeAuthProvider): string {
  const value = provider === 'yandex'
    ? configuredValue('YANDEX_AUTH_CLIENT_ID')
    : configuredValue('VK_AUTH_CLIENT_ID');
  if (!value) {
    throw new AdminAuthError(
      503,
      'AUTH_PROVIDER_NOT_CONFIGURED',
      'This sign-in provider is not configured',
    );
  }
  return value;
}

function parseMetadata(value: ChallengeRow['metadata']): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function requiredCredential(value: unknown, maxLength: number): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maxLength) {
    throw new AdminAuthError(400, 'PROVIDER_CREDENTIAL_INVALID', 'The sign-in credential is invalid');
  }
  return normalized;
}

function safeDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().slice(0, 200);
  return normalized || null;
}

function safeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return normalized;
}

function providerUnavailable(): AdminAuthError {
  return new AdminAuthError(
    503,
    'AUTH_PROVIDER_TEMPORARILY_UNAVAILABLE',
    'The sign-in provider is temporarily unavailable',
  );
}

function invalidProviderCredential(): AdminAuthError {
  return new AdminAuthError(401, 'PROVIDER_CREDENTIAL_INVALID', 'The sign-in credential is invalid or expired');
}

export function getNativeProviderAuthCapabilities(): {
  google: boolean;
  yandex: boolean;
  vk: boolean;
  email: boolean;
} {
  const email = getEmailPasswordAuthCapabilities();
  return {
    google: false,
    yandex: !!configuredValue('YANDEX_AUTH_CLIENT_ID'),
    vk: !!configuredValue('VK_AUTH_CLIENT_ID'),
    email: email.delivery,
  };
}

export function getEmailPasswordAuthCapabilities(): {
  login: boolean;
  delivery: boolean;
} {
  const production = process.env.NODE_ENV === 'production';
  const appSessionSecret = configuredValue('APP_SESSION_SECRET') || configuredValue('BOT_TOKEN');
  const rateLimitSecret = configuredValue('AUTH_RATE_LIMIT_SECRET')
    || configuredValue('EMAIL_OTP_HASH_SECRET')
    || configuredValue('APP_SESSION_SECRET');
  const emailCodeSecret = configuredValue('EMAIL_OTP_HASH_SECRET');
  const hasProductionSecret = (value: string) => Buffer.byteLength(value, 'utf8') >= 32;
  const appSessionReady = !production || !!appSessionSecret;
  const rateLimitReady = !production || hasProductionSecret(rateLimitSecret);
  const login = appSessionReady && rateLimitReady;
  let deliveryEndpointReady = false;
  try {
    deliveryEndpointReady = new URL(configuredValue('EMAIL_OTP_DELIVERY_URL')).protocol === 'https:';
  } catch {
    deliveryEndpointReady = false;
  }
  return {
    login,
    delivery: login
      && (!production || hasProductionSecret(emailCodeSecret))
      && deliveryEndpointReady
      && !!configuredValue('EMAIL_OTP_DELIVERY_SECRET'),
  };
}

export async function beginNativeProviderAuth(input: {
  provider: NativeAuthProvider;
  purpose: NativeAuthPurpose;
  currentUserId?: string | null;
}): Promise<{
  challengeId: string;
  provider: NativeAuthProvider;
  expiresInSeconds: number;
  config: Record<string, string>;
}> {
  if (!NATIVE_AUTH_PROVIDERS.includes(input.provider)) {
    throw new AdminAuthError(400, 'AUTH_PROVIDER_INVALID', 'Unsupported sign-in provider');
  }
  if (input.purpose !== 'login' && input.purpose !== 'link') {
    throw new AdminAuthError(400, 'AUTH_PURPOSE_INVALID', 'Unsupported sign-in purpose');
  }
  if (input.purpose === 'link' && !input.currentUserId) {
    throw new AdminAuthError(401, 'AUTH_LINK_SESSION_REQUIRED', 'An active account session is required');
  }

  const clientId = requiredClientId(input.provider);
  const challengeId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  let stateHash: string | null = null;
  let redirectUri: string | null = null;
  let metadata: Record<string, unknown> = {};
  let config: Record<string, string>;

  if (input.provider === 'yandex') {
    config = { clientId };
  } else {
    const state = randomBase64Url();
    const codeVerifier = randomBase64Url(64);
    redirectUri = `vk${clientId}://vk.ru/blank.html`;
    stateHash = sha256(state);
    metadata = { codeVerifier };
    config = {
      clientId,
      redirectUri,
      state,
      codeChallenge: pkceChallenge(codeVerifier),
      codeChallengeMethod: 'S256',
    };
  }

  await getPool().query(
    `INSERT INTO auth_challenges
     (challenge_id, provider, purpose, user_id, state_hash, redirect_uri, metadata, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [
      challengeId,
      input.provider,
      input.purpose,
      input.currentUserId || null,
      stateHash,
      redirectUri,
      JSON.stringify(metadata),
      expiresAt,
    ],
  );

  return {
    challengeId,
    provider: input.provider,
    expiresInSeconds: Math.floor(CHALLENGE_TTL_MS / 1000),
    config,
  };
}

async function claimChallenge(input: {
  provider: NativeAuthProvider;
  challengeId: string;
  state?: string;
  currentUserId?: string | null;
}): Promise<ChallengeRow & { metadata: Record<string, unknown> }> {
  const challengeId = requiredCredential(input.challengeId, 128);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT challenge_id, provider, purpose, user_id, state_hash, metadata, attempts, claimed_at
       FROM auth_challenges
       WHERE challenge_id = $1 AND provider = $2
         AND purpose IN ('login', 'link')
         AND consumed_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [challengeId, input.provider],
    );
    const challenge = result.rows[0] as ChallengeRow | undefined;
    if (!challenge) {
      throw new AdminAuthError(400, 'AUTH_CHALLENGE_INVALID', 'The sign-in attempt is invalid or expired');
    }
    if (challenge.claimed_at) {
      throw new AdminAuthError(409, 'AUTH_CHALLENGE_IN_PROGRESS', 'This sign-in attempt is already being completed');
    }
    if (Number(challenge.attempts || 0) >= MAX_CHALLENGE_ATTEMPTS) {
      throw new AdminAuthError(429, 'AUTH_CHALLENGE_ATTEMPTS_EXCEEDED', 'Start a new sign-in attempt');
    }

    if (challenge.provider === 'vk') {
      const state = requiredCredential(input.state, 512);
      if (!challenge.state_hash || !equalHexDigest(sha256(state), challenge.state_hash)) {
        throw new AdminAuthError(400, 'AUTH_STATE_INVALID', 'The sign-in state is invalid or expired');
      }
    }

    const linkedUserId = challenge.user_id == null ? null : String(challenge.user_id);
    if (challenge.purpose === 'link') {
      if (!input.currentUserId) {
        throw new AdminAuthError(401, 'AUTH_LINK_SESSION_REQUIRED', 'An active account session is required');
      }
      if (!linkedUserId || linkedUserId !== input.currentUserId) {
        throw new AdminAuthError(
          403,
          'AUTH_LINK_SESSION_MISMATCH',
          'The active account does not match this link attempt',
        );
      }
    }

    const claimed = await client.query(
      `UPDATE auth_challenges
       SET claimed_at = CURRENT_TIMESTAMP, attempts = attempts + 1
       WHERE challenge_id = $1 AND consumed_at IS NULL AND claimed_at IS NULL`,
      [challengeId],
    );
    if (!claimed.rowCount) {
      throw new AdminAuthError(409, 'AUTH_CHALLENGE_IN_PROGRESS', 'This sign-in attempt is already being completed');
    }
    await client.query('COMMIT');
    return { ...challenge, metadata: parseMetadata(challenge.metadata) };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function settleChallenge(challengeId: string, consume: boolean): Promise<void> {
  await getPool().query(
    `UPDATE auth_challenges
     SET claimed_at = NULL,
         consumed_at = CASE
           WHEN $2::boolean OR attempts >= $3 THEN CURRENT_TIMESTAMP
           ELSE consumed_at
         END
     WHERE challenge_id = $1 AND consumed_at IS NULL AND claimed_at IS NOT NULL`,
    [challengeId, consume, MAX_CHALLENGE_ATTEMPTS],
  );
}

async function requestProviderJson(
  url: string,
  init: RequestInit,
): Promise<{ response: Response; payload: Record<string, any> }> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_REQUEST_TIMEOUT_MS) });
  } catch {
    throw providerUnavailable();
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw providerUnavailable();
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw providerUnavailable();
  }
  return { response, payload: payload as Record<string, any> };
}

function assertProviderResponse(response: Response): void {
  if (response.ok) return;
  if (response.status === 429 || response.status >= 500) throw providerUnavailable();
  throw invalidProviderCredential();
}

async function verifyYandex(credential: NativeProviderCredential): Promise<VerifiedNativeIdentity> {
  const accessToken = requiredCredential(credential.accessToken, OPAQUE_TOKEN_MAX_LENGTH);
  const clientId = requiredClientId('yandex');
  const { response, payload } = await requestProviderJson(YANDEX_USERINFO_URL, {
    method: 'GET',
    headers: { Authorization: `OAuth ${accessToken}` },
    redirect: 'error',
  });
  assertProviderResponse(response);
  if (String(payload.client_id || '') !== clientId) throw invalidProviderCredential();
  const subject = String(payload.psuid || payload.id || '').trim();
  if (!subject || subject.length > 512) throw invalidProviderCredential();
  const email = safeEmail(payload.default_email)
    || (Array.isArray(payload.emails) ? safeEmail(payload.emails[0]) : null);
  return {
    provider: 'yandex',
    subject,
    email,
    displayName: safeDisplayName(payload.display_name || payload.real_name),
    metadata: { provider: 'yandex', subjectType: payload.psuid ? 'psuid' : 'id' },
  };
}

async function verifyVk(
  credential: NativeProviderCredential,
  challenge: ChallengeRow & { metadata: Record<string, unknown> },
): Promise<VerifiedNativeIdentity> {
  const code = requiredCredential(credential.code, OPAQUE_TOKEN_MAX_LENGTH);
  const deviceId = requiredCredential(credential.deviceId, 512);
  const state = requiredCredential(credential.state, 512);
  const clientId = requiredClientId('vk');
  const codeVerifier = requiredCredential(challenge.metadata.codeVerifier, 512);
  const redirectUri = `vk${clientId}://vk.ru/blank.html`;
  const tokenResult = await requestProviderJson(VK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      client_id: clientId,
      device_id: deviceId,
      redirect_uri: redirectUri,
      state,
    }),
    redirect: 'error',
  });
  assertProviderResponse(tokenResult.response);
  const accessToken = requiredCredential(tokenResult.payload.access_token, OPAQUE_TOKEN_MAX_LENGTH);
  if (tokenResult.payload.state && String(tokenResult.payload.state) !== state) {
    throw invalidProviderCredential();
  }

  const userInfoResult = await requestProviderJson(VK_USERINFO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: accessToken, client_id: clientId, device_id: deviceId }),
    redirect: 'error',
  });
  assertProviderResponse(userInfoResult.response);
  const user = userInfoResult.payload.user && typeof userInfoResult.payload.user === 'object'
    ? userInfoResult.payload.user as Record<string, any>
    : userInfoResult.payload;
  const tokenSubject = String(tokenResult.payload.user_id || '').trim();
  const infoSubject = String(user.user_id || '').trim();
  if (tokenSubject && infoSubject && tokenSubject !== infoSubject) throw invalidProviderCredential();
  const subject = infoSubject || tokenSubject;
  if (!subject || subject.length > 512) throw invalidProviderCredential();
  const displayName = safeDisplayName(
    user.name || [user.first_name, user.last_name].filter((part) => typeof part === 'string').join(' '),
  );
  return {
    provider: 'vk',
    subject,
    email: safeEmail(user.email || tokenResult.payload.email),
    displayName,
    metadata: { provider: 'vk' },
  };
}

export async function completeNativeProviderAuth(input: {
  provider: NativeAuthProvider;
  challengeId: string;
  credential: NativeProviderCredential;
  currentUserId?: string | null;
  currentSessionId?: string | null;
}): Promise<{ userId: string; linked: boolean; existing: boolean }> {
  if (!NATIVE_AUTH_PROVIDERS.includes(input.provider)) {
    throw new AdminAuthError(400, 'AUTH_PROVIDER_INVALID', 'Unsupported sign-in provider');
  }
  const challenge = await claimChallenge({
    provider: input.provider,
    challengeId: input.challengeId,
    state: input.credential.state,
    currentUserId: input.currentUserId,
  });

  try {
    const identity = input.provider === 'yandex'
      ? await verifyYandex(input.credential)
      : await verifyVk(input.credential, challenge);
    const linkUserId = challenge.purpose === 'link' ? String(challenge.user_id) : null;
    if (linkUserId && !input.currentSessionId) {
      throw new AdminAuthError(401, 'AUTH_LINK_SESSION_REQUIRED', 'An active account session is required');
    }
    const account = linkUserId
      ? await resolveVerifiedIdentity(identity, linkUserId, {
          requiredSession: { userId: linkUserId, sessionId: input.currentSessionId! },
        })
      : await resolveVerifiedIdentity(identity, null);
    await settleChallenge(challenge.challenge_id, true);
    return account;
  } catch (error) {
    const consume = error instanceof AdminAuthError && error.status < 500;
    await settleChallenge(challenge.challenge_id, consume).catch(() => undefined);
    throw error;
  }
}

export function sanitizeNativeProviderAuthError(error: unknown): AdminAuthError {
  if (error instanceof AdminAuthError) return error;
  return new AdminAuthError(
    503,
    'AUTH_TEMPORARILY_UNAVAILABLE',
    'Authentication is temporarily unavailable',
  );
}
