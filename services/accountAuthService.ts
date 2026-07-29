import { nativeSessionStore } from './nativeSessionStore';
import { apiFetch, apiUrl, isNativeAppRuntime } from './apiClient';

export type LinkableProvider = 'vk' | 'yandex' | 'google' | 'email' | 'telegram';
export type LinkedIdentity = {
  provider: LinkableProvider;
  email?: string | null;
  displayName?: string | null;
  verifiedAt?: string;
  lastUsedAt?: string | null;
};

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
  return payload.profile;
}
