/**
 * fetch с AbortSignal по таймауту — чтобы старт приложения не зависал на «висящем» TCP.
 */
const TELEGRAM_INIT_DATA_HEADER = 'x-telegram-init-data';

function isLocalApiRequest(input: RequestInfo | URL): boolean {
  if (typeof window === 'undefined') return false;
  const raw = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  if (raw.startsWith('/api/')) return true;

  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

function withTelegramInitDataHeader(
  input: RequestInfo | URL,
  headers: HeadersInit | undefined
): HeadersInit | undefined {
  if (!isLocalApiRequest(input)) return headers;
  const initData = (window as any).Telegram?.WebApp?.initData;
  if (typeof initData !== 'string' || !initData.trim()) return headers;

  const nextHeaders = new Headers(headers || {});
  if (!nextHeaders.has(TELEGRAM_INIT_DATA_HEADER)) {
    nextHeaders.set(TELEGRAM_INIT_DATA_HEADER, initData);
  }
  return nextHeaders;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init?.signal;
  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      headers: withTelegramInitDataHeader(input, init?.headers),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abortFromExternal);
  }
}
