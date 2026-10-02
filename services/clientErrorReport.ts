import { apiFetchUnauthenticated } from './apiClient';

/** One report per failure kind per app session is enough to see it in the admin. */
const reported = new Set<string>();

/**
 * Tells the server what failed on screen (feature + error code + HTTP status),
 * so admin «Ошибки» shows real reader failures with device and app version.
 * Never throws and never blocks the screen.
 */
export function reportClientError(feature: string, error: unknown, detail?: string): void {
  if (typeof window === 'undefined') return;
  const source = (error && typeof error === 'object' ? error : {}) as { code?: unknown; status?: unknown; message?: unknown };
  const code = String(source.code || (error instanceof Error && error.name !== 'Error' ? error.name : '') || 'UNKNOWN')
    .replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 64) || 'UNKNOWN';
  const status = Number(source.status) || 0;
  const key = `${feature}|${code}|${status}`;
  if (reported.has(key)) return;
  reported.add(key);
  const message = typeof source.message === 'string' ? source.message : '';
  void apiFetchUnauthenticated('/api/app/client-error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feature,
      code,
      status,
      detail: [detail, message, typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : '']
        .filter(Boolean).join(' ').slice(0, 200),
    }),
  }, 5_000).catch(() => undefined);
}
