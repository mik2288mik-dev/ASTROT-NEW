import { nativeSessionStore } from './nativeSessionStore';
import { assertNativeNetworkAvailable } from './nativeNetwork';
import {
  getAuthSessionMode,
  requiresExplicitAuthentication,
} from './authSessionIntent';

const DEFAULT_TIMEOUT_MS = 30_000;
const INVALID_NATIVE_SESSION_CODES = new Set([
  'APP_SESSION_INVALID',
  'APP_SESSION_REVOKED',
  'APP_AUTH_REQUIRED',
  'ACCOUNT_BLOCKED',
]);

export const APP_SESSION_INVALIDATED_EVENT = 'lumia:app-session-invalidated';
export type AppSessionInvalidatedDetail = {
  code: string;
  status: number;
};

type NativeSessionResponse = {
  token: string;
  profile: unknown;
};

let nativeSessionRequest: Promise<NativeSessionResponse> | null = null;

async function sessionInvalidationFromResponse(
  response: Response,
): Promise<AppSessionInvalidatedDetail | null> {
  if (response.status !== 401 && response.status !== 403) return null;
  const payload = await response.clone().json().catch(() => ({})) as {
    code?: unknown;
    error?: unknown;
  };
  const code = [payload.code, payload.error].find(
    (value): value is string => typeof value === 'string' && INVALID_NATIVE_SESSION_CODES.has(value),
  );
  return code ? { code, status: response.status } : null;
}

function dispatchSessionInvalidation(detail: AppSessionInvalidatedDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_SESSION_INVALIDATED_EVENT, { detail }));
}

export function isNativeAppRuntime(): boolean {
  return process.env.NEXT_PUBLIC_MOBILE_BUILD === '1';
}

function configuredApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  if (!isNativeAppRuntime()) return '';
  const baseUrl = configuredApiBaseUrl();
  if (!baseUrl) throw new Error('NEXT_PUBLIC_API_URL is required for the native application');
  if (!baseUrl.startsWith('https://')) throw new Error('The native API URL must use HTTPS');
  return baseUrl;
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

async function requestNativeSession(): Promise<NativeSessionResponse> {
  if (nativeSessionRequest) return nativeSessionRequest;

  nativeSessionRequest = (async () => {
    const existingToken = await nativeSessionStore.getToken();
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (existingToken) headers.set('Authorization', `Bearer ${existingToken}`);

    const response = await fetch(apiUrl('/api/auth/native-guest'), {
      method: 'POST',
      headers,
    });
    const invalidatedSession = await sessionInvalidationFromResponse(response);
    const payload = await response.json().catch(() => ({})) as Partial<NativeSessionResponse> & {
      error?: string;
      message?: string;
    };
    if (!response.ok || !payload.token) {
      if (invalidatedSession) {
        await nativeSessionStore.clearToken().catch(() => undefined);
        dispatchSessionInvalidation(invalidatedSession);
      }
      throw new Error(payload.message || payload.error || `Native session failed: ${response.status}`);
    }
    await nativeSessionStore.setToken(payload.token);
    return payload as NativeSessionResponse;
  })().finally(() => {
    nativeSessionRequest = null;
  });

  return nativeSessionRequest;
}

export async function getAppAuthHeaders(): Promise<Record<string, string>> {
  if (isNativeAppRuntime()) {
    const mode = getAuthSessionMode();
    if (requiresExplicitAuthentication(mode)) return {};
    const storedToken = await nativeSessionStore.getToken();
    if (storedToken) return { Authorization: `Bearer ${storedToken}` };

    if (mode !== 'guest') return {};
    const token = (await requestNativeSession()).token;
    return { Authorization: `Bearer ${token}` };
  }

  // Web requests authenticate with the revocable HttpOnly app-session cookie.
  // Telegram launch proof is attached only by explicit Telegram-only services
  // (login, linking, notifications, Stars), never as a global fallback.
  return {};
}

async function fetchOnce(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  await assertNativeNetworkAvailable();
  const controller = new AbortController();
  const externalSignal = init.signal;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) abortFromExternal();
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(init.headers || {});
    const authHeaders = await getAppAuthHeaders();
    Object.entries(authHeaders).forEach(([name, value]) => {
      if (!headers.has(name)) headers.set(name, value);
    });
    return await fetch(apiUrl(path), {
      ...init,
      credentials: isNativeAppRuntime() ? 'omit' : (init.credentials || 'include'),
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const response = await fetchOnce(path, init, timeoutMs);
  const invalidatedSession = await sessionInvalidationFromResponse(response);
  if (invalidatedSession) {
    // An invalid or revoked native token must return the user to the explicit
    // sign-in choice. Silently creating a new guest here used to hide logout
    // failures and could switch accounts behind the user's back.
    if (isNativeAppRuntime()) await clearNativeSession().catch(() => undefined);
    dispatchSessionInvalidation(invalidatedSession);
  }
  return response;
}

export async function clearNativeSession(): Promise<void> {
  await nativeSessionStore.clearToken();
}

export async function clearAppSessionAndLocalData(): Promise<void> {
  await Promise.allSettled([clearNativeSession()]);
  if (typeof window !== 'undefined') {
    try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* unavailable storage */ }
  }
}
