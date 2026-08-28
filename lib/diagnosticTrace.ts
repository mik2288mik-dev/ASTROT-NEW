export const NEBO_TRACE_HEADER = 'X-Nebo-Trace-Id';

const TRACE_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const SAFE_CODE_PATTERN = /[^A-Za-z0-9_.-]+/g;

export type DiagnosticEventName =
  | 'build_identity'
  | 'auth_capabilities'
  | 'auth_guest'
  | 'auth_provider'
  | 'auth_email'
  | 'personal_forecast'
  | 'natal_chart'
  | 'natal_question';

export type DiagnosticStatus =
  | 'start'
  | 'ok'
  | 'error'
  | 'cancelled'
  | 'timeout'
  | 'cache_hit'
  | 'cache_miss'
  | 'in_progress';

export type DiagnosticFields = {
  traceId?: string;
  side?: 'client' | 'native' | 'server';
  stage?: string;
  status?: DiagnosticStatus;
  durationMs?: number;
  httpStatus?: number;
  errorCode?: string;
  provider?: 'yandex' | 'vk' | 'google';
  operation?: string;
  period?: 'day' | 'week' | 'month';
  source?: string;
  attempt?: number;
  birthTimeMode?: 'exact' | 'approximate' | 'unknown';
  hasCoordinates?: boolean;
  runtime?: 'native' | 'browser';
  channel?: string;
  versionName?: string;
  versionCode?: string | number;
  sourceCommit?: string;
  apiOriginHost?: string;
};

const FIELD_ORDER: Array<keyof DiagnosticFields> = [
  'traceId',
  'side',
  'stage',
  'status',
  'durationMs',
  'httpStatus',
  'errorCode',
  'provider',
  'operation',
  'period',
  'source',
  'attempt',
  'birthTimeMode',
  'hasCoordinates',
  'runtime',
  'channel',
  'versionName',
  'versionCode',
  'sourceCommit',
  'apiOriginHost',
];

function safeSegment(value: unknown, fallback = ''): string {
  const normalized = String(value ?? '')
    .trim()
    .replace(SAFE_CODE_PATTERN, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
  return normalized || fallback;
}

export function normalizeDiagnosticTraceId(value: unknown): string | null {
  const candidate = String(Array.isArray(value) ? value[0] || '' : value || '').trim();
  return TRACE_ID_PATTERN.test(candidate) ? candidate : null;
}

export function createDiagnosticTraceId(scope: string): string {
  const prefix = safeSegment(scope.toLowerCase(), 'flow').slice(0, 16);
  let entropy = '';
  try {
    entropy = globalThis.crypto?.randomUUID?.().replace(/-/g, '').slice(0, 20) || '';
  } catch {
    // A deterministic-looking fallback is still only a correlation id, never a credential.
  }
  if (!entropy) {
    entropy = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`
      .replace(/[^a-z0-9]/gi, '')
      .slice(0, 20);
  }
  return `${prefix}-${Date.now().toString(36)}-${entropy}`.slice(0, 64);
}

export function diagnosticErrorCode(error: unknown, fallback = 'UNKNOWN_ERROR'): string {
  const value = error && typeof error === 'object'
    ? error as { code?: unknown; name?: unknown }
    : null;
  const explicitCode = safeSegment(value?.code);
  if (explicitCode) return explicitCode.slice(0, 80);
  const name = safeSegment(value?.name);
  if (name && name !== 'Error' && name !== 'TypeError') return name.slice(0, 80);
  return safeSegment(fallback, 'UNKNOWN_ERROR').slice(0, 80);
}

export function diagnosticHttpStatus(error: unknown): number | undefined {
  const value = Number(
    error && typeof error === 'object'
      ? (error as { status?: unknown }).status
      : Number.NaN,
  );
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : undefined;
}

export function formatDiagnosticFields(fields: DiagnosticFields): string {
  return FIELD_ORDER.flatMap((key) => {
    const value = fields[key];
    if (value === undefined || value === null || value === '') return [];
    if (typeof value === 'number') {
      return Number.isFinite(value) ? [`${key}=${Math.max(0, Math.round(value))}`] : [];
    }
    if (typeof value === 'boolean') return [`${key}=${value}`];
    const safeValue = key === 'traceId'
      ? normalizeDiagnosticTraceId(value)
      : safeSegment(value);
    return safeValue ? [`${key}=${safeValue}`] : [];
  }).join(' ');
}

export function diagnosticTraceHeaders(traceId: string): Record<string, string> {
  const normalized = normalizeDiagnosticTraceId(traceId);
  return normalized ? { [NEBO_TRACE_HEADER]: normalized } : {};
}
