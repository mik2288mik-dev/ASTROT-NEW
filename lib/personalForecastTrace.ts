import { stableHash } from './personalForecastContract';

export type PersonalForecastTraceMode = 'off' | 'metadata' | 'full_eval';
export type PersonalForecastTrace = ReturnType<typeof createPersonalForecastTrace>;

function mode(): PersonalForecastTraceMode {
  const value = process.env.PERSONAL_FORECAST_TRACE;
  return value === 'metadata' || value === 'full_eval' ? value : 'off';
}

const PRIVATE_TRACE_KEYS = new Set([
  'api_key', 'authorization', 'session', 'session_token', 'raw_session',
  'name', 'birth_date', 'birth_time', 'birth_place', 'birth_timezone',
  'personal_profile', 'raw_profile', 'profile', 'prompt', 'instructions', 'input',
]);

function safeTraceDetails(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeTraceDetails);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !PRIVATE_TRACE_KEYS.has(key.toLocaleLowerCase('en-US')))
    .map(([key, item]) => [key, safeTraceDetails(item)]));
}

export function createPersonalForecastTrace(input: { userId?: string; profileFingerprint: string; period: string; periodKey: string; model: string; versions: Record<string, string> }) {
  const traceId = `pf-${Date.now().toString(36)}-${Math.abs(stableHash(`${input.profileFingerprint}|${Math.random()}`)).toString(36)}`;
  const traceMode = mode(); const events: Array<Record<string, unknown>> = [];
  const emit = (stage: string, details: Record<string, unknown> = {}) => {
    const event = { trace_id: traceId, stage, at: new Date().toISOString(), ...safeTraceDetails(details) as Record<string, unknown> };
    events.push(event);
    if (traceMode !== 'off') console.info('[personal_forecast_trace]', JSON.stringify(event));
  };
  emit('request_received', { user_hash: input.userId ? Math.abs(stableHash(input.userId)).toString(36) : null, profile_fingerprint_hash: Math.abs(stableHash(input.profileFingerprint)).toString(36), period: input.period, period_key: input.periodKey, model: input.model, versions: input.versions });
  return { traceId, mode: traceMode, events, emit };
}
