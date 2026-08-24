import { Capacitor } from '@capacitor/core';
import { nativeSessionStore, type NativeSessionBundle, type StoredNativeSession } from './nativeSessionStore';
import { assertNativeNetworkAvailable } from './nativeNetwork';
import {
  getAuthSessionMode,
  requiresExplicitAuthentication,
} from './authSessionIntent';

const DEFAULT_TIMEOUT_MS = 30_000;
const SESSION_REFRESH_PATH = '/api/auth/session/refresh';
const REFRESHABLE_ACCESS_CODES = new Set(['APP_SESSION_EXPIRED', 'APP_AUTH_REQUIRED']);
const TERMINAL_SESSION_CODES = new Set([
  'APP_SESSION_INVALID',
  'APP_SESSION_REVOKED',
  'APP_SESSION_REFRESH_INVALID',
  'APP_SESSION_REFRESH_EXPIRED',
  'APP_SESSION_REFRESH_REUSED',
  'ACCOUNT_BLOCKED',
]);

export const APP_SESSION_INVALIDATED_EVENT = 'lumia:app-session-invalidated';
export type AppSessionInvalidatedDetail = {
  code: string;
  status: number;
};

type NativeSessionResponse = {
  sessionVersion?: number;
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  accessExpiresAt?: number;
  refreshExpiresAt?: number;
  absoluteExpiresAt?: number;
  profile?: unknown;
};

let nativeSessionRequest: Promise<NativeSessionResponse> | null = null;
let nativeRefreshRequest: Promise<NativeSessionBundle | null> | null = null;
let webRefreshRequest: Promise<boolean> | null = null;
let webBootstrapAttempted = false;
let webAccessExpiresAt = 0;
let nativeSessionMutation = 0;

async function responseSessionCode(response: Response): Promise<string | null> {
  if (![400, 401, 403, 409].includes(response.status)) return null;
  const payload = await response.clone().json().catch(() => ({})) as {
    code?: unknown;
    error?: unknown;
  };
  return [payload.code, payload.error].find((value): value is string => typeof value === 'string') || null;
}

async function sessionInvalidationFromResponse(
  response: Response,
): Promise<AppSessionInvalidatedDetail | null> {
  if (response.status !== 401 && response.status !== 403) return null;
  const code = await responseSessionCode(response);
  return code && TERMINAL_SESSION_CODES.has(code) ? { code, status: response.status } : null;
}

function dispatchSessionInvalidation(detail: AppSessionInvalidatedDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(APP_SESSION_INVALIDATED_EVENT, { detail }));
}

export function isNativeAppRuntime(): boolean {
  return process.env.NEXT_PUBLIC_MOBILE_BUILD === '1' || Capacitor.isNativePlatform();
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
  if (/^https?:\/\//i.test(path)) {
    if (isNativeAppRuntime() && new URL(path).origin !== new URL(getApiBaseUrl()).origin) {
      throw new Error('Native authenticated requests must use NEXT_PUBLIC_API_URL');
    }
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}

function asNativeSessionBundle(payload: NativeSessionResponse): NativeSessionBundle | null {
  const accessToken = payload.accessToken || payload.token;
  if (
    payload.sessionVersion !== 2
    || typeof accessToken !== 'string'
    || !accessToken
    || typeof payload.refreshToken !== 'string'
    || !payload.refreshToken
    || !Number.isSafeInteger(payload.accessExpiresAt)
    || !Number.isSafeInteger(payload.refreshExpiresAt)
    || !Number.isSafeInteger(payload.absoluteExpiresAt)
  ) return null;
  return {
    version: 2,
    accessToken,
    refreshToken: payload.refreshToken,
    accessExpiresAt: payload.accessExpiresAt!,
    refreshExpiresAt: payload.refreshExpiresAt!,
    absoluteExpiresAt: payload.absoluteExpiresAt!,
  };
}

async function readNativeSession(): Promise<StoredNativeSession | null> {
  const compatibleStore = nativeSessionStore as typeof nativeSessionStore & {
    getSession?: () => Promise<StoredNativeSession | null>;
  };
  if (typeof compatibleStore.getSession === 'function') return compatibleStore.getSession();
  const token = await nativeSessionStore.getToken();
  return token ? { version: 1, accessToken: token } : null;
}

export async function persistNativeSessionResponse(payload: NativeSessionResponse): Promise<void> {
  const bundle = asNativeSessionBundle(payload);
  nativeSessionMutation += 1;
  if (bundle) {
    const compatibleStore = nativeSessionStore as typeof nativeSessionStore & {
      setSession?: (session: NativeSessionBundle) => Promise<void>;
    };
    if (typeof compatibleStore.setSession === 'function') {
      await compatibleStore.setSession(bundle);
      return;
    }
  }
  const token = payload.token || payload.accessToken;
  if (!token) throw new Error('NATIVE_SESSION_TOKEN_MISSING');
  await nativeSessionStore.setToken(token);
}

async function requestNativeSession(signal?: AbortSignal): Promise<NativeSessionResponse> {
  if (nativeSessionRequest) return nativeSessionRequest;

  nativeSessionRequest = (async () => {
    const response = await fetch(apiUrl('/api/auth/native-guest'), {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionVersion: 2 }),
      signal,
    });
    const payload = await response.json().catch(() => ({})) as NativeSessionResponse & {
      error?: string;
      message?: string;
    };
    if (!response.ok || !(payload.token || payload.accessToken)) {
      throw new Error(payload.message || payload.error || `Native session failed: ${response.status}`);
    }
    await persistNativeSessionResponse(payload);
    return payload;
  })().finally(() => {
    nativeSessionRequest = null;
  });

  return nativeSessionRequest;
}

function refreshResponseError(status: number, code: string): Error & { status: number; code: string } {
  const error = new Error(code) as Error & { status: number; code: string };
  error.status = status;
  error.code = code;
  return error;
}

async function fetchRefresh(init: RequestInit): Promise<Response> {
  await assertNativeNetworkAvailable();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(apiUrl(SESSION_REFRESH_PATH), { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshNativeSession(session: StoredNativeSession): Promise<NativeSessionBundle | null> {
  if (nativeRefreshRequest) return nativeRefreshRequest;
  const startingMutation = nativeSessionMutation;
  nativeRefreshRequest = (async () => {
    const authorization = session.version === 2
      ? `Refresh ${session.refreshToken}`
      : `Bearer ${session.accessToken}`;
    const response = await fetchRefresh({
      method: 'POST',
      credentials: 'omit',
      headers: { Authorization: authorization },
    });
    if ((response.status === 404 || response.status === 405) && session.version === 1) return null;
    const code = await responseSessionCode(response);
    if (!response.ok) {
      throw refreshResponseError(response.status, code || 'APP_SESSION_REFRESH_FAILED');
    }
    const payload = await response.json().catch(() => ({})) as NativeSessionResponse;
    const bundle = asNativeSessionBundle(payload);
    if (!bundle) throw refreshResponseError(502, 'APP_SESSION_REFRESH_RESPONSE_INVALID');
    if (nativeSessionMutation !== startingMutation) {
      throw refreshResponseError(409, 'APP_SESSION_CHANGED');
    }
    await persistNativeSessionResponse(payload);
    return bundle;
  })().finally(() => {
    nativeRefreshRequest = null;
  });
  return nativeRefreshRequest;
}

async function refreshWebSession(retryConcurrent = true): Promise<boolean> {
  if (webRefreshRequest) return webRefreshRequest;
  webRefreshRequest = (async () => {
    const response = await fetchRefresh({ method: 'POST', credentials: 'include' });
    const code = await responseSessionCode(response);
    if (response.ok) {
      const payload = await response.clone().json().catch(() => ({})) as { accessExpiresAt?: unknown };
      webAccessExpiresAt = Number.isSafeInteger(payload.accessExpiresAt)
        ? Number(payload.accessExpiresAt)
        : Math.floor(Date.now() / 1000) + 15 * 60;
      return true;
    }
    if (response.status === 409 && code === 'APP_SESSION_REFRESH_CONCURRENT' && retryConcurrent) {
      await new Promise((resolve) => setTimeout(resolve, 75));
      const retry = await fetchRefresh({ method: 'POST', credentials: 'include' });
      if (retry.ok) {
        const payload = await retry.clone().json().catch(() => ({})) as { accessExpiresAt?: unknown };
        webAccessExpiresAt = Number.isSafeInteger(payload.accessExpiresAt)
          ? Number(payload.accessExpiresAt)
          : Math.floor(Date.now() / 1000) + 15 * 60;
        return true;
      }
      const retryCode = await responseSessionCode(retry);
      throw refreshResponseError(retry.status, retryCode || 'APP_SESSION_REFRESH_FAILED');
    }
    throw refreshResponseError(response.status, code || 'APP_SESSION_REFRESH_FAILED');
  })().finally(() => {
    webRefreshRequest = null;
  });
  return webRefreshRequest;
}

async function prepareSessionBeforeRequest(path: string): Promise<void> {
  if (path === SESSION_REFRESH_PATH) return;
  if (!isNativeAppRuntime()) {
    if (typeof window === 'undefined') return;
    if (path === '/api/users/session/logout') {
      try {
        await refreshWebSession();
      } catch (error: any) {
        if (error?.status !== 401 && error?.status !== 403) throw error;
      }
      return;
    }
    const accessNearExpiry = webAccessExpiresAt > 0
      && webAccessExpiresAt <= Math.floor(Date.now() / 1000) + 90;
    if (!webBootstrapAttempted || webAccessExpiresAt === 0 || accessNearExpiry) {
      webBootstrapAttempted = true;
      await refreshWebSession().catch(() => false);
    }
    return;
  }

  const mode = getAuthSessionMode();
  if (requiresExplicitAuthentication(mode)) return;
  const session = await readNativeSession();
  if (!session) return;
  const now = Math.floor(Date.now() / 1000);
  const needsRefresh = session.version === 1 || session.accessExpiresAt <= now + 90;
  if (!needsRefresh) return;
  const refreshMutation = nativeSessionMutation;
  try {
    await refreshNativeSession(session);
  } catch (error: any) {
    if (error?.code && TERMINAL_SESSION_CODES.has(error.code)) {
      await invalidateSession({ code: error.code, status: error.status || 401 }, refreshMutation);
      throw error;
    }
    if (session.version === 2 && session.accessExpiresAt <= now) throw error;
  }
}

export async function getAppAuthHeaders(signal?: AbortSignal): Promise<Record<string, string>> {
  if (isNativeAppRuntime()) {
    const mode = getAuthSessionMode();
    if (requiresExplicitAuthentication(mode)) return {};
    const storedSession = await readNativeSession();
    if (storedSession) return { Authorization: `Bearer ${storedSession.accessToken}` };

    if (mode !== 'guest') return {};
    const payload = await requestNativeSession(signal);
    const token = payload.accessToken || payload.token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
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
    const authHeaders = await getAppAuthHeaders(controller.signal);
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

async function invalidateSession(
  detail: AppSessionInvalidatedDetail,
  expectedNativeMutation?: number,
): Promise<void> {
  if (isNativeAppRuntime()) {
    if (
      expectedNativeMutation !== undefined
      && expectedNativeMutation !== nativeSessionMutation
    ) return;
    await clearNativeSession().catch(() => undefined);
  } else {
    webAccessExpiresAt = 0;
  }
  dispatchSessionInvalidation(detail);
}

async function tryRefreshAfterAccessFailure(code: string): Promise<boolean> {
  if (!REFRESHABLE_ACCESS_CODES.has(code)) return false;
  if (!isNativeAppRuntime()) return refreshWebSession();
  const session = await readNativeSession();
  if (!session) return false;
  return !!(await refreshNativeSession(session));
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const callerSuppliedAuthorization = new Headers(init.headers || {}).has('Authorization');
  if (!callerSuppliedAuthorization) await prepareSessionBeforeRequest(path);
  const requestNativeMutation = nativeSessionMutation;
  const response = await fetchOnce(path, init, timeoutMs);
  const code = await responseSessionCode(response);

  if (!callerSuppliedAuthorization && code && REFRESHABLE_ACCESS_CODES.has(code)) {
    try {
      if (await tryRefreshAfterAccessFailure(code)) {
        const retryNativeMutation = nativeSessionMutation;
        const retried = await fetchOnce(path, init, timeoutMs);
        const retryInvalidation = await sessionInvalidationFromResponse(retried);
        if (retryInvalidation) await invalidateSession(retryInvalidation, retryNativeMutation);
        return retried;
      }
      await invalidateSession({ code, status: response.status }, requestNativeMutation);
    } catch (error: any) {
      if (error?.status === 409 || error?.status === 429 || error?.status >= 500) throw error;
      if (error?.code && TERMINAL_SESSION_CODES.has(error.code)) {
        await invalidateSession(
          { code: error.code, status: error.status || 401 },
          requestNativeMutation,
        );
        return response;
      }
      throw error;
    }
  }

  if (!callerSuppliedAuthorization) {
    const invalidatedSession = await sessionInvalidationFromResponse(response);
    if (invalidatedSession) await invalidateSession(invalidatedSession, requestNativeMutation);
  }
  return response;
}

export async function clearNativeSession(): Promise<void> {
  nativeSessionMutation += 1;
  await nativeSessionStore.clearToken();
}

export async function clearAppSessionAndLocalData(): Promise<void> {
  await Promise.allSettled([clearNativeSession()]);
  if (typeof window !== 'undefined') {
    try { window.localStorage.clear(); window.sessionStorage.clear(); } catch { /* unavailable storage */ }
  }
}
