import { nativeSessionStore } from './nativeSessionStore';
import { apiFetch, apiUrl, isNativeAppRuntime } from './apiClient';
import {
  getRawTelegramInitData,
  setAuthSessionMode,
} from './authSessionIntent';
import type { UserProfile } from '../types';

export type LinkableProvider = 'vk' | 'yandex' | 'google' | 'email' | 'telegram';
export type LinkedIdentity = {
  provider: LinkableProvider;
  email?: string | null;
  displayName?: string | null;
  verifiedAt?: string;
  lastUsedAt?: string | null;
};

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
export async function beginExternalAuth(
  provider: 'vk' | 'yandex' | 'google',
  purpose: 'login' | 'link',
): Promise<void> {
  const response = await apiFetch(`/api/auth/oauth/${provider}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ purpose, native: isNativeAppRuntime() }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.authorizationUrl) {
    throw new Error(payload.message || payload.error || 'OAUTH_START_FAILED');
  }
  if (purpose === 'login') setAuthSessionMode('account');
  if (isNativeAppRuntime()) window.open(payload.authorizationUrl, '_system', 'noopener,noreferrer');
  else window.location.assign(payload.authorizationUrl);
}

export async function requestEmailLoginCode(email: string, purpose: 'login' | 'link') {
  const response = await apiFetch('/api/auth/email/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, purpose }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || 'EMAIL_CODE_REQUEST_FAILED');
  return payload as { challengeId: string };
}

export async function verifyEmailLoginCode(challengeId: string, code: string) {
  const response = await apiFetch('/api/auth/email/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, code, native: isNativeAppRuntime() }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || 'EMAIL_CODE_VERIFY_FAILED');
  if (payload.token) await nativeSessionStore.setToken(payload.token);
  setAuthSessionMode('account');
  return payload.profile;
}

export async function exchangeNativeLoginCode(code: string) {
  const response = await fetch(apiUrl('/api/auth/exchange'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.token) throw new Error(payload.message || payload.error || 'AUTH_EXCHANGE_FAILED');
  await nativeSessionStore.setToken(payload.token);
  setAuthSessionMode('account');
  return payload.profile;
}
