import { nativeSessionStore } from './nativeSessionStore';
import { assertNativeNetworkAvailable } from './nativeNetwork';

const TELEGRAM_INIT_DATA_HEADER = 'x-telegram-init-data';
const DEFAULT_TIMEOUT_MS = 30_000;
const HUMAN_DAILY_PATH = '/api/content/natal/human-daily';

type NativeSessionResponse = {
  token: string;
  profile: unknown;
};

let nativeSessionRequest: Promise<NativeSessionResponse> | null = null;

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

function telegramInitData(): string {
  if (typeof window === 'undefined') return '';
  const value = (window as any).Telegram?.WebApp?.initData;
  return typeof value === 'string' ? value.trim() : '';
}

async function requestNativeSession(forceNew = false): Promise<NativeSessionResponse> {
  if (forceNew) await nativeSessionStore.clearToken();
  if (nativeSessionRequest) return nativeSessionRequest;

  nativeSessionRequest = (async () => {
    const existingToken = await nativeSessionStore.getToken();
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (existingToken) headers.set('Authorization', `Bearer ${existingToken}`);

    const response = await fetch(apiUrl('/api/auth/native-guest'), {
      method: 'POST',
      headers,
    });
    const payload = await response.json().catch(() => ({})) as Partial<NativeSessionResponse> & {
      error?: string;
      message?: string;
    };
    if (!response.ok || !payload.token) {
      if (response.status === 401) await nativeSessionStore.clearToken();
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
    const storedToken = await nativeSessionStore.getToken();
    const token = storedToken || (await requestNativeSession()).token;
    return { Authorization: `Bearer ${token}` };
  }

  const initData = telegramInitData();
  return initData ? { [TELEGRAM_INIT_DATA_HEADER]: initData } : {};
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

function logHumanDailyTransport(
  stage: string,
  path: string,
  init: RequestInit,
  metadata: Record<string, unknown> = {},
  level: 'info' | 'warn' = 'info'
): void {
  if (!path.includes(HUMAN_DAILY_PATH)) return;
  const payload = {
    scope: 'personal-daily-transport',
    stage,
    method: init.method || 'GET',
    path,
    ...metadata,
  };
  if (level === 'warn') {
    console.warn('[PersonalDaily][apiFetch]', payload);
    return;
  }
  console.info('[PersonalDaily][apiFetch]', payload);
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const startedAt = Date.now();
  logHumanDailyTransport('started', path, init, { timeoutMs });
  let response: Response;
  try {
    response = await fetchOnce(path, init, timeoutMs);
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    logHumanDailyTransport(isAbort ? 'abort' : 'transport_error', path, init, {
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
    }, 'warn');
    throw error;
  }
  logHumanDailyTransport('response', path, init, {
    status: response.status,
    durationMs: Date.now() - startedAt,
  });
  if (!isNativeAppRuntime() || response.status !== 401 || path.includes('/api/auth/native-guest')) {
    return response;
  }

  await requestNativeSession(true);
  logHumanDailyTransport('native_auth_retry_started', path, init);
  try {
    const retriedResponse = await fetchOnce(path, init, timeoutMs);
    logHumanDailyTransport('native_auth_retry_response', path, init, {
      status: retriedResponse.status,
      durationMs: Date.now() - startedAt,
    });
    return retriedResponse;
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    logHumanDailyTransport(isAbort ? 'native_auth_retry_abort' : 'native_auth_retry_transport_error', path, init, {
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
    }, 'warn');
    throw error;
  }
}

export async function clearNativeSession(): Promise<void> {
  await nativeSessionStore.clearToken();
}
