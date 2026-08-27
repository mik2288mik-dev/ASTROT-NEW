import { Capacitor, CapacitorHttp, type HttpResponse } from '@capacitor/core';
import { nativeSessionStore, type NativeSessionBundle, type StoredNativeSession } from './nativeSessionStore';
import { assertNativeNetworkAvailable } from './nativeNetwork';
import {
  getAuthSessionMode,
  requiresExplicitAuthentication,
} from './authSessionIntent';

const DEFAULT_TIMEOUT_MS = 30_000;
const NATIVE_SESSION_READ_TIMEOUT_MS = 2_000;
const NATIVE_HTTP_MAX_CONNECT_TIMEOUT_MS = 8_000;
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

function usesAndroidNativeHttp(): boolean {
  // The mobile bundle is compiled specifically for Capacitor. Rely on the
  // platform bridge rather than a second native-platform flag, which can lag
  // during WebView startup on some Android devices.
  return isNativeAppRuntime() && Capacitor.getPlatform() === 'android';
}

function requestWasAborted(): Error {
  const error = new Error('The request was aborted.');
  error.name = 'AbortError';
  return error;
}

function isAbortError(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === 'AbortError';
}

function headersAsNativeObject(headersInit: HeadersInit | undefined): Record<string, string> {
  return Object.fromEntries(new Headers(headersInit || {}).entries());
}

function responseHeader(headers: Record<string, string>, name: string): string {
  const target = name.toLowerCase();
  return Object.entries(headers).find(([key]) => key.toLowerCase() === target)?.[1] || '';
}

function decodeNativeBase64(value: string): Uint8Array | string {
  try {
    const source = atob(value.replace(/\s/g, ''));
    const bytes = new Uint8Array(source.length);
    for (let index = 0; index < source.length; index += 1) bytes[index] = source.charCodeAt(index);
    return bytes;
  } catch {
    return value;
  }
}

function nativeHttpResponse(raw: HttpResponse): Response {
  const headers = raw.headers || {};
  const contentType = responseHeader(headers, 'content-type').toLowerCase();
  const data = raw.data;
  const body: BodyInit | null = data == null
    ? null
    : contentType.includes('json')
      ? (typeof data === 'string' ? data : JSON.stringify(data))
      : typeof data === 'string'
        ? decodeNativeBase64(data)
        : JSON.stringify(data);
  return new Response(body, { status: raw.status, headers });
}

function canUseNativeHttpBody(body: RequestInit['body']): body is string | null | undefined {
  return body == null || typeof body === 'string';
}

function raceNativeRequest<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return request;
  if (signal.aborted) {
    void request.catch(() => undefined);
    return Promise.reject(requestWasAborted());
  }

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      cleanup();
      reject(requestWasAborted());
    };
    const complete = (callback: (value: T) => void) => (value: T) => {
      cleanup();
      callback(value);
    };
    const fail = (error: unknown) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => signal.removeEventListener('abort', abort);
    signal.addEventListener('abort', abort, { once: true });
    request.then(complete(resolve), fail);
  });
}

/**
 * Android's explicit Capacitor HTTP bridge bypasses WebView transport/CORS
 * failures without installing the unsafe global fetch/XHR interception.
 */
async function apiTransportFetch(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  if (!usesAndroidNativeHttp() || !canUseNativeHttpBody(init.body)) {
    return fetch(url, init);
  }
  if (init.signal?.aborted) throw requestWasAborted();

  const nativeTimeout = Math.max(1, Math.floor(timeoutMs));
  try {
    const raw = await raceNativeRequest(
      CapacitorHttp.request({
        url,
        method: init.method || 'GET',
        headers: headersAsNativeObject(init.headers),
        ...(init.body == null ? {} : { data: init.body }),
        connectTimeout: Math.min(nativeTimeout, NATIVE_HTTP_MAX_CONNECT_TIMEOUT_MS),
        readTimeout: nativeTimeout,
        // API responses are JSON or binary. The native bridge still parses
        // JSON by its content type and returns base64 for binary response data.
        responseType: 'arraybuffer',
      }),
      init.signal || undefined,
    );
    return nativeHttpResponse(raw);
  } catch (error) {
    if (isAbortError(error)) throw error;
    const networkError = new TypeError('Failed to fetch');
    (networkError as TypeError & { cause?: unknown }).cause = error;
    throw networkError;
  }
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

/**
 * A fresh native install has no app session yet. Resolve that state locally so
 * startup can render the sign-in gate instead of waiting for an unauthenticated
 * profile request to cross the network.
 */
export async function hasNativeAppSession(
  timeoutMs = NATIVE_SESSION_READ_TIMEOUT_MS,
): Promise<boolean> {
  if (!isNativeAppRuntime()) return false;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      readNativeSession().then((session) => session !== null).catch(() => false),
      new Promise<boolean>((resolve) => {
        timeout = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
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
    const response = await apiTransportFetch(apiUrl('/api/auth/native-guest'), {
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
  const externalSignal = init.signal;
  const abortFromExternal = () => controller.abort(externalSignal?.reason);
  if (externalSignal) {
    if (externalSignal.aborted) abortFromExternal();
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    return await apiTransportFetch(
      apiUrl(SESSION_REFRESH_PATH),
      { ...init, signal: controller.signal },
      DEFAULT_TIMEOUT_MS,
    );
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}

async function refreshNativeSession(
  session: StoredNativeSession,
  signal?: AbortSignal,
): Promise<NativeSessionBundle | null> {
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
      signal,
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

async function refreshWebSession(retryConcurrent = true, signal?: AbortSignal): Promise<boolean> {
  if (webRefreshRequest) return webRefreshRequest;
  webRefreshRequest = (async () => {
    const response = await fetchRefresh({ method: 'POST', credentials: 'include', signal });
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
      const retry = await fetchRefresh({ method: 'POST', credentials: 'include', signal });
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

async function prepareSessionBeforeRequest(path: string, signal?: AbortSignal): Promise<void> {
  if (path === SESSION_REFRESH_PATH) return;
  if (!isNativeAppRuntime()) {
    if (typeof window === 'undefined') return;
    if (path === '/api/users/session/logout') {
      try {
        await refreshWebSession(true, signal);
      } catch (error: any) {
        if (error?.status !== 401 && error?.status !== 403) throw error;
      }
      return;
    }
    const accessNearExpiry = webAccessExpiresAt > 0
      && webAccessExpiresAt <= Math.floor(Date.now() / 1000) + 90;
    if (!webBootstrapAttempted || webAccessExpiresAt === 0 || accessNearExpiry) {
      webBootstrapAttempted = true;
      await refreshWebSession(true, signal).catch(() => false);
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
    await refreshNativeSession(session, signal);
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
    return await apiTransportFetch(apiUrl(path), {
      ...init,
      credentials: isNativeAppRuntime() ? 'omit' : (init.credentials || 'include'),
      headers,
      signal: controller.signal,
    }, timeoutMs);
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

async function tryRefreshAfterAccessFailure(code: string, signal?: AbortSignal): Promise<boolean> {
  if (!REFRESHABLE_ACCESS_CODES.has(code)) return false;
  if (!isNativeAppRuntime()) return refreshWebSession(true, signal);
  const session = await readNativeSession();
  if (!session) return false;
  return !!(await refreshNativeSession(session, signal));
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const callerSuppliedAuthorization = new Headers(init.headers || {}).has('Authorization');
  const requestSignal = init.signal || undefined;
  if (!callerSuppliedAuthorization) await prepareSessionBeforeRequest(path, requestSignal);
  const requestNativeMutation = nativeSessionMutation;
  const response = await fetchOnce(path, init, timeoutMs);
  const code = await responseSessionCode(response);

  if (!callerSuppliedAuthorization && code && REFRESHABLE_ACCESS_CODES.has(code)) {
    try {
      if (await tryRefreshAfterAccessFailure(code, requestSignal)) {
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
