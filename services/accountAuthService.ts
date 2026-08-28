import {
  nativeIdentityAuth,
  type NativeIdentityProvider as Provider,
  type NativeProviderLaunch,
} from './nativeIdentityAuthBridge';
import { apiFetch, persistNativeSessionResponse } from './apiClient';
import { isNativeAndroidRuntime, isNativeAppRuntime } from './nativeRuntime';
import {
  getRawTelegramInitData,
  setAuthSessionMode,
} from './authSessionIntent';
import type { UserProfile } from '../types';
import {
  canUseAccountAuthProvider,
  resolveDistributionChannel,
} from '../lib/distributionChannel';

export type LinkableProvider = 'vk' | 'yandex' | 'google' | 'email' | 'telegram';
export type AccountAuthCapabilities = {
  vk: boolean;
  yandex: boolean;
  google: boolean;
  email: boolean;
  emailPassword: boolean;
  emailDelivery: boolean;
};
export type LinkedIdentity = {
  provider: LinkableProvider;
  email?: string | null;
  displayName?: string | null;
  verifiedAt?: string;
  lastUsedAt?: string | null;
};

type AuthPurpose = 'login' | 'link';

type AccountSessionPayload = {
  profile?: UserProfile;
  sessionVersion?: number;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  accessExpiresAt?: number;
  refreshExpiresAt?: number;
  absoluteExpiresAt?: number;
};

type NativeProviderStart = {
  challengeId: string;
  provider: Provider;
  expiresInSeconds?: number;
  config: {
    webClientId?: string;
    clientId?: string;
    nonce?: string;
    state?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
    redirectUri?: string;
  };
};

let providerRequest: Promise<UserProfile> | null = null;
const AUTH_CAPABILITIES_TIMEOUT_MS = 8_000;
const NATIVE_PROVIDER_START_TIMEOUT_MS = 10_000;
const NATIVE_PROVIDER_COMPLETE_TIMEOUT_MS = 20_000;

function usesNativeAndroidProviderAuth(): boolean {
  return isNativeAndroidRuntime();
}

function isGoogleAvailableInCurrentChannel(): boolean {
  try {
    return canUseAccountAuthProvider('google', resolveDistributionChannel());
  } catch {
    // Yandex and VK are compiled into the Android build and do not need the
    // channel to render. Google remains hidden until a valid channel exists.
    return false;
  }
}

function canUseProviderInCurrentChannel(provider: Provider): boolean {
  return provider !== 'google' || isGoogleAvailableInCurrentChannel();
}

/**
 * Android Yandex/VK SDKs and their client IDs are compiled into the APK. Their
 * availability is therefore local build configuration, not a network
 * discovery problem. The server still validates both the challenge and the
 * resulting provider credential when the user taps a button.
 */
export function getLocalAccountAuthCapabilities(): AccountAuthCapabilities | null {
  if (!usesNativeAndroidProviderAuth()) return null;
  return {
    vk: true,
    yandex: true,
    google: isGoogleAvailableInCurrentChannel(),
    email: false,
    emailPassword: false,
    emailDelivery: false,
  };
}

async function authError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => ({})) as {
    code?: string;
    error?: string;
    message?: string;
  };
  const error = new Error(payload.message || payload.code || payload.error || fallback);
  (error as Error & { code?: string; status?: number }).code =
    payload.code || payload.error || fallback;
  (error as Error & { code?: string; status?: number }).status = response.status;
  return error;
}

async function acceptAccountSession(
  payload: AccountSessionPayload,
  fallback: string,
): Promise<UserProfile> {
  if (!payload.profile) throw new Error(fallback);
  if (isNativeAppRuntime()) {
    if (!(payload.token || payload.accessToken)) throw new Error('NATIVE_SESSION_TOKEN_MISSING');
    await persistNativeSessionResponse(payload);
  }
  setAuthSessionMode('account');
  return payload.profile;
}

async function postAuthJson<T extends Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
  fallback: string,
  timeoutMs?: number,
): Promise<T> {
  const response = await apiFetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, timeoutMs);
  if (!response.ok) throw await authError(response, fallback);
  return response.json() as Promise<T>;
}

function providerLaunchOptions(start: NativeProviderStart): NativeProviderLaunch {
  const clientId = start.provider === 'google'
    ? start.config.webClientId
    : start.config.clientId;
  if (!clientId) throw new Error('AUTH_PROVIDER_NOT_CONFIGURED');
  return {
    challengeId: start.challengeId,
    provider: start.provider,
    clientId,
    nonce: start.config.nonce,
    state: start.config.state,
    codeChallenge: start.config.codeChallenge,
    codeChallengeMethod: start.config.codeChallengeMethod,
    redirectUri: start.config.redirectUri,
  };
}

export async function loginWithTelegram(): Promise<UserProfile> {
  const initData = getRawTelegramInitData();
  if (!initData) {
    const error = new Error('Открой приложение из чата с ботом Telegram и попробуй снова.');
    (error as Error & { code?: string }).code = 'TELEGRAM_CONTEXT_REQUIRED';
    throw error;
  }

  const response = await apiFetch('/api/auth/telegram/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, native: isNativeAppRuntime(), sessionVersion: 2 }),
  });
  if (!response.ok) throw await authError(response, 'TELEGRAM_LOGIN_FAILED');

  const payload = await response.json() as AccountSessionPayload;
  if (!payload.profile) throw new Error('TELEGRAM_LOGIN_FAILED');
  if (payload.token || payload.accessToken) await persistNativeSessionResponse(payload);
  setAuthSessionMode('telegram');
  return payload.profile;
}

export async function linkCurrentTelegramIdentity(): Promise<UserProfile> {
  const initData = getRawTelegramInitData();
  if (!initData) {
    const error = new Error('Открой приложение из чата с ботом Telegram и попробуй снова.');
    (error as Error & { code?: string }).code = 'TELEGRAM_CONTEXT_REQUIRED';
    throw error;
  }
  const response = await apiFetch('/api/auth/telegram/link', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData, sessionVersion: 2 }),
  });
  if (!response.ok) throw await authError(response, 'TELEGRAM_LINK_FAILED');
  const payload = await response.json() as AccountSessionPayload;
  if (!payload.profile) throw new Error('TELEGRAM_LINK_FAILED');
  if (payload.token || payload.accessToken) await persistNativeSessionResponse(payload);
  setAuthSessionMode('telegram');
  return payload.profile;
}

export async function getLinkedIdentities(): Promise<{
  userId: string;
  isGuest: boolean;
  identities: LinkedIdentity[];
}> {
  const response = await apiFetch('/api/auth/identities');
  if (!response.ok) throw new Error('IDENTITIES_LOAD_FAILED');
  return response.json();
}

export async function getAccountAuthCapabilities(): Promise<AccountAuthCapabilities> {
  const localCapabilities = getLocalAccountAuthCapabilities();
  if (localCapabilities) return localCapabilities;

  const runtime = usesNativeAndroidProviderAuth() ? 'native' : 'browser';
  const channel = resolveDistributionChannel();
  const response = await apiFetch(
    `/api/auth/capabilities?runtime=${runtime}&channel=${channel}`,
    {},
    AUTH_CAPABILITIES_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw await authError(response, 'AUTH_CAPABILITIES_UNAVAILABLE');
  }
  const payload = await response.json().catch(() => ({}));
  const emailDelivery = payload?.emailDelivery === true || payload?.email === true;
  const emailPassword = payload?.emailPassword === true;
  return {
    vk: payload?.vk === true,
    yandex: payload?.yandex === true,
    google: canUseAccountAuthProvider('google', channel) && payload?.google === true,
    email: emailDelivery,
    emailPassword,
    emailDelivery,
  };
}
export async function beginExternalAuth(
  provider: Provider,
  purpose: AuthPurpose,
): Promise<void> {
  const response = await apiFetch(`/api/auth/oauth/${provider}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose, native: false }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.authorizationUrl) {
    throw new Error(payload.message || payload.error || 'OAUTH_START_FAILED');
  }
  if (purpose === 'login') setAuthSessionMode('account');
  if (isNativeAppRuntime()) window.open(payload.authorizationUrl, '_system', 'noopener,noreferrer');
  else window.location.assign(payload.authorizationUrl);
}

export async function authenticateWithProvider(
  provider: Provider,
  purpose: AuthPurpose = 'login',
): Promise<UserProfile | null> {
  if (!canUseProviderInCurrentChannel(provider)) {
    const error = new Error('AUTH_PROVIDER_NOT_AVAILABLE_IN_CHANNEL');
    (error as Error & { code?: string }).code = 'AUTH_PROVIDER_NOT_AVAILABLE_IN_CHANNEL';
    throw error;
  }
  if (!usesNativeAndroidProviderAuth()) {
    await beginExternalAuth(provider, purpose);
    return null;
  }
  if (providerRequest) return providerRequest;

  providerRequest = (async () => {
    const start = await postAuthJson<NativeProviderStart>(
      `/api/auth/provider/${provider}/start`,
      { purpose },
      'PROVIDER_AUTH_START_FAILED',
      NATIVE_PROVIDER_START_TIMEOUT_MS,
    );
    const credential = await nativeIdentityAuth.signIn(providerLaunchOptions(start));
    const payload = await postAuthJson<AccountSessionPayload>(
      `/api/auth/provider/${provider}/complete`,
      { challengeId: start.challengeId, ...credential, native: true, sessionVersion: 2 },
      'PROVIDER_AUTH_COMPLETE_FAILED',
      NATIVE_PROVIDER_COMPLETE_TIMEOUT_MS,
    );
    return acceptAccountSession(payload, 'PROVIDER_AUTH_COMPLETE_FAILED');
  })().finally(() => {
    providerRequest = null;
  });

  return providerRequest;
}

export async function clearNativeProviderCredentialState(): Promise<void> {
  if (!usesNativeAndroidProviderAuth()) return;
  await nativeIdentityAuth.clearCredentialState({}).catch(() => undefined);
}

export async function registerEmailPassword(input: {
  email: string;
  password: string;
  passwordConfirmation: string;
  purpose?: AuthPurpose;
}): Promise<{ challengeId: string }> {
  return postAuthJson<{ challengeId: string }>(
    '/api/auth/password/register',
    {
      email: input.email,
      password: input.password,
      passwordConfirmation: input.passwordConfirmation,
      purpose: input.purpose || 'login',
    },
    'EMAIL_REGISTRATION_FAILED',
  );
}

export async function verifyEmailPasswordRegistration(
  challengeId: string,
  code: string,
): Promise<UserProfile> {
  const payload = await postAuthJson<AccountSessionPayload>(
    '/api/auth/password/register-verify',
    { challengeId, code, native: isNativeAppRuntime(), sessionVersion: 2 },
    'EMAIL_VERIFICATION_FAILED',
  );
  return acceptAccountSession(payload, 'EMAIL_VERIFICATION_FAILED');
}

export async function loginWithEmailPassword(email: string, password: string): Promise<UserProfile> {
  const payload = await postAuthJson<AccountSessionPayload>(
    '/api/auth/password/login',
    { email, password, native: isNativeAppRuntime(), sessionVersion: 2 },
    'EMAIL_PASSWORD_LOGIN_FAILED',
  );
  return acceptAccountSession(payload, 'EMAIL_PASSWORD_LOGIN_FAILED');
}

export async function requestPasswordReset(email: string): Promise<{ challengeId: string }> {
  return postAuthJson<{ challengeId: string }>(
    '/api/auth/password/reset-request',
    { email },
    'PASSWORD_RESET_REQUEST_FAILED',
  );
}

export async function completePasswordReset(input: {
  challengeId: string;
  code: string;
  password: string;
  passwordConfirmation: string;
}): Promise<UserProfile> {
  const payload = await postAuthJson<AccountSessionPayload>(
    '/api/auth/password/reset-complete',
    { ...input, native: isNativeAppRuntime(), sessionVersion: 2 },
    'PASSWORD_RESET_FAILED',
  );
  return acceptAccountSession(payload, 'PASSWORD_RESET_FAILED');
}
