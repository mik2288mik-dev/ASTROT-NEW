import { Capacitor } from '@capacitor/core';
import { nativeSessionStore } from './nativeSessionStore';
import {
  nativeIdentityAuth,
  type NativeIdentityProvider as Provider,
  type NativeProviderCredential,
  type NativeProviderLaunch,
} from './nativeIdentityAuthBridge';
import { apiFetch, isNativeAppRuntime } from './apiClient';
import {
  getRawTelegramInitData,
  setAuthSessionMode,
} from './authSessionIntent';
import type { UserProfile } from '../types';

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

function usesNativeAndroidProviderAuth(): boolean {
  return isNativeAppRuntime() && Capacitor.getPlatform() === 'android';
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
  payload: { profile?: UserProfile; token?: string },
  fallback: string,
): Promise<UserProfile> {
  if (!payload.profile) throw new Error(fallback);
  if (isNativeAppRuntime()) {
    if (!payload.token) throw new Error('NATIVE_SESSION_TOKEN_MISSING');
    await nativeSessionStore.setToken(payload.token);
  }
  setAuthSessionMode('account');
  return payload.profile;
}

async function postAuthJson<T extends Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
  fallback: string,
): Promise<T> {
  const response = await apiFetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
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
    body: JSON.stringify({ initData, native: isNativeAppRuntime() }),
  });
  if (!response.ok) throw await authError(response, 'TELEGRAM_LOGIN_FAILED');

  const payload = await response.json() as { profile?: UserProfile; token?: string };
  if (!payload.profile) throw new Error('TELEGRAM_LOGIN_FAILED');
  if (payload.token) await nativeSessionStore.setToken(payload.token);
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
    body: JSON.stringify({ initData }),
  });
  if (!response.ok) throw await authError(response, 'TELEGRAM_LINK_FAILED');
  const payload = await response.json() as { profile?: UserProfile; token?: string };
  if (!payload.profile) throw new Error('TELEGRAM_LINK_FAILED');
  if (payload.token) await nativeSessionStore.setToken(payload.token);
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
  const runtime = usesNativeAndroidProviderAuth() ? 'native' : 'browser';
  const response = await apiFetch(`/api/auth/capabilities?runtime=${runtime}`);
  if (!response.ok) {
    throw await authError(response, 'AUTH_CAPABILITIES_UNAVAILABLE');
  }
  const payload = await response.json().catch(() => ({}));
  const emailDelivery = payload?.emailDelivery === true || payload?.email === true;
  const emailPassword = payload?.emailPassword === true;
  return {
    vk: payload?.vk === true,
    yandex: payload?.yandex === true,
    google: payload?.google === true,
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
    );
    const credential = await nativeIdentityAuth.signIn(providerLaunchOptions(start));
    const payload = await postAuthJson<{ profile?: UserProfile; token?: string }>(
      `/api/auth/provider/${provider}/complete`,
      { challengeId: start.challengeId, ...credential, native: true },
      'PROVIDER_AUTH_COMPLETE_FAILED',
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
  const payload = await postAuthJson<{ profile?: UserProfile; token?: string }>(
    '/api/auth/password/register-verify',
    { challengeId, code, native: isNativeAppRuntime() },
    'EMAIL_VERIFICATION_FAILED',
  );
  return acceptAccountSession(payload, 'EMAIL_VERIFICATION_FAILED');
}

export async function loginWithEmailPassword(email: string, password: string): Promise<UserProfile> {
  const payload = await postAuthJson<{ profile?: UserProfile; token?: string }>(
    '/api/auth/password/login',
    { email, password, native: isNativeAppRuntime() },
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
  const payload = await postAuthJson<{ profile?: UserProfile; token?: string }>(
    '/api/auth/password/reset-complete',
    { ...input, native: isNativeAppRuntime() },
    'PASSWORD_RESET_FAILED',
  );
  return acceptAccountSession(payload, 'PASSWORD_RESET_FAILED');
}
