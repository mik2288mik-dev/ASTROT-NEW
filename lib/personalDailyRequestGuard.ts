const PERSONAL_DAILY_PATH = '/api/content/natal/human-daily';
const INSTALL_MARKER = '__yourHoroscopePersonalDailyRequestGuardInstalled__';

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function sanitizePersonalDailyPostBody(body: BodyInit | null | undefined): BodyInit | null | undefined {
  if (typeof body !== 'string' || !body.trim()) return body;

  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return body;

    const { profile: _profile, chartData: _chartData, ...minimalBody } = parsed;
    return JSON.stringify(minimalBody);
  } catch {
    return body;
  }
}

/**
 * Production safety guard for the personal-daily cache-miss flow.
 *
 * The authenticated API resolves profile and natal chart data from PostgreSQL.
 * Sending the full client profile and chart again is redundant and can make the
 * request too large for the Next.js API body parser, so the POST may never reach
 * the route after a normal GET cache miss.
 */
export function installPersonalDailyRequestGuard(): void {
  if (typeof globalThis.fetch !== 'function') return;

  const runtime = globalThis as typeof globalThis & Record<string, unknown>;
  if (runtime[INSTALL_MARKER]) return;

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const method = String(
      init?.method || (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const isPersonalDailyPost = method === 'POST' && requestUrl(input).includes(PERSONAL_DAILY_PATH);

    if (!isPersonalDailyPost || !init) {
      return originalFetch(input, init);
    }

    return originalFetch(input, {
      ...init,
      body: sanitizePersonalDailyPostBody(init.body),
    });
  }) as typeof globalThis.fetch;

  runtime[INSTALL_MARKER] = true;
}
