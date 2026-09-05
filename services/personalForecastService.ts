import type { UserProfile } from '../types';
import { hasActivePremium } from '../lib/accessMatrix';
import {
  PERSONAL_FORECAST_VOICE_VERSION,
} from '../lib/appVoice';
import {
  PERSONAL_FORECAST_CACHE_VERSION,
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildPersonalForecastBirthProfileFingerprint,
  getPersonalForecastPeriodKey,
  isPersonalForecastPackage,
  normalizeForecastTimezone,
  type PersonalForecastAccessPayload,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
} from '../lib/personalForecastContract';
import { getTelegramInitDataHeaders } from './sessionService';
import { apiFetch } from './apiClient';
import {
  createDiagnosticTraceId,
  diagnosticErrorCode,
  diagnosticHttpStatus,
  diagnosticTraceHeaders,
  formatDiagnosticFields,
} from '../lib/diagnosticTrace';
import {
  diagnosticLog,
  showRuntimeDiagnosticsForFailure,
} from '../lib/runtimeDiagnostics';

type LoadOptions = {
  cacheOnly?: boolean;
  force?: boolean;
  maxInProgressRetries?: number;
};

export type PersonalForecastClientResult = {
  forecast: PersonalForecastPackage;
  accessTier: 'free' | 'premium';
  lockedSectionIds: string[];
  periodLocked: boolean;
  source: 'local' | 'cache' | 'stale' | 'generated';
  /** Runtime completion marker; never written into the forecast cache. */
  generatedDuringRequest?: boolean;
};

export type PersonalForecastClientError = Error & {
  status?: number;
  code?: string;
  retryAfterMs?: number;
};

type PersonalForecastPeriodResultState = {
  result: PersonalForecastClientResult | null;
};

const LOCAL_CACHE_PREFIX = 'tvoi-goroskop:personal-forecast-feed-v17-reference-four-part';
const memoryCache = new Map<string, PersonalForecastClientResult>();
const inFlight = new Map<string, Promise<PersonalForecastClientResult>>();

function logForecastDiagnostic(
  level: 'INFO' | 'WARN' | 'ERROR',
  traceId: string,
  fields: Omit<Parameters<typeof formatDiagnosticFields>[0], 'traceId' | 'side'>,
): void {
  diagnosticLog(level, 'personal_forecast', formatDiagnosticFields({
    traceId,
    side: 'client',
    ...fields,
  }));
}

function userId(profile: UserProfile): string {
  return String(profile.id || '').trim();
}

function contextKey(input: {
  profile: UserProfile;
  period: PersonalForecastPeriod;
  periodKey: string;
}): string {
  const timezone = normalizeForecastTimezone(input.profile.birthTimezone);
  return [
    userId(input.profile),
    input.period,
    input.periodKey,
    timezone,
    input.profile.language === 'en' ? 'en' : 'ru',
    hasActivePremium(input.profile) ? 'premium' : 'free',
    buildPersonalForecastBirthProfileFingerprint(input.profile),
    PERSONAL_FORECAST_CALCULATION_VERSION,
    PERSONAL_FORECAST_CONTRACT_VERSION,
    PERSONAL_FORECAST_PROMPT_VERSION,
    PERSONAL_FORECAST_VOICE_VERSION,
    PERSONAL_FORECAST_CACHE_VERSION,
  ].join('|');
}

function localStorageKey(key: string): string {
  let hash = 2166136261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${LOCAL_CACHE_PREFIX}:${(hash >>> 0).toString(36)}`;
}

function isStoredResult(value: unknown): value is PersonalForecastClientResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as PersonalForecastClientResult;
  const forecast = result.forecast;
  if (
    !forecast
    || typeof forecast !== 'object'
    || !Array.isArray(forecast.sections)
    || !forecast.overview
    || typeof forecast.overview !== 'object'
    || !Array.isArray(result.lockedSectionIds)
    || result.lockedSectionIds.some((id) => typeof id !== 'string' || !id.trim())
    || new Set(result.lockedSectionIds).size !== result.lockedSectionIds.length
    || typeof result.periodLocked !== 'boolean'
    || (result.accessTier !== 'free' && result.accessTier !== 'premium')
    || !(['local', 'cache', 'stale', 'generated'] as const).includes(result.source)
  ) {
    return false;
  }

  const allSections = [forecast.overview, ...forecast.sections];
  if (allSections.some((section) => (
    !section
    || typeof section !== 'object'
    || typeof section.id !== 'string'
    || !section.id.trim()
    || typeof section.text !== 'string'
  ))) {
    return false;
  }
  const allSectionIds = allSections.map((section) => section.id);
  const allSectionIdSet = new Set(allSectionIds);
  if (
    allSectionIdSet.size !== allSectionIds.length
    || result.lockedSectionIds.some((id) => !allSectionIdSet.has(id))
  ) {
    return false;
  }

  const freeSelectionIds = forecast.meta?.freeSelection?.sectionIds;
  if (!Array.isArray(freeSelectionIds)) return false;
  const expectedPeriodLocked = result.accessTier === 'free' && forecast.period !== 'day';
  if (result.periodLocked !== expectedPeriodLocked) return false;

  const expectedOpenIds = result.accessTier === 'premium'
    ? new Set(allSectionIds)
    : expectedPeriodLocked
      ? new Set<string>()
    : new Set(['overview', ...freeSelectionIds]);
  const expectedLockedIds = allSectionIds.filter((id) => !expectedOpenIds.has(id));
  const lockedIds = new Set(result.lockedSectionIds);
  if (
    expectedLockedIds.length !== lockedIds.size
    || expectedLockedIds.some((id) => !lockedIds.has(id))
  ) {
    return false;
  }

  for (const section of allSections) {
    if (lockedIds.has(section.id)) {
      if (
        section.text.trim()
        || !Array.isArray(section.explanationAnchors)
        || section.explanationAnchors.length
      ) {
        return false;
      }
    } else if (!section.text.trim()) {
      return false;
    }
  }

  return isPersonalForecastPackage(forecast, {
    redactedSectionIds: result.lockedSectionIds,
    promptVersion: result.source === 'stale'
      ? forecast.meta.promptVersion
      : undefined,
  });
}

function invalidResponseError(): PersonalForecastClientError {
  const error = new Error(
    'Personal forecast response does not match the V4 contract',
  ) as PersonalForecastClientError;
  error.code = 'PERSONAL_FORECAST_RESPONSE_INVALID';
  return error;
}

function parseAccessPayload(
  value: unknown,
  sourceOverride?: PersonalForecastClientResult['source'],
  expected?: Pick<PersonalForecastPackage, 'period' | 'periodKey'>,
): PersonalForecastClientResult {
  if (!value || typeof value !== 'object') throw invalidResponseError();
  const payload = value as PersonalForecastAccessPayload;
  const result: PersonalForecastClientResult = {
    forecast: payload.forecast,
    accessTier: payload.accessTier,
    lockedSectionIds: payload.lockedSectionIds,
    periodLocked: payload.periodLocked,
    source: payload.source || sourceOverride,
  };
  if (!isStoredResult(result)) throw invalidResponseError();
  if (
    expected
    && (
      result.forecast.period !== expected.period
      || result.forecast.periodKey !== expected.periodKey
    )
  ) {
    throw invalidResponseError();
  }
  return result;
}

function readStored(key: string): PersonalForecastClientResult | null {
  const memory = memoryCache.get(key);
  if (memory) {
    if (isStoredResult(memory)) return memory;
    memoryCache.delete(key);
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(localStorageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredResult(parsed)) return null;
    const result = { ...parsed, source: 'local' as const };
    memoryCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

function writeStored(key: string, result: PersonalForecastClientResult): void {
  if (result.source === 'stale') return;
  memoryCache.set(key, result);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(localStorageKey(key), JSON.stringify(result));
  } catch {
    // A storage quota failure must not break the personal screen.
  }
}

/**
 * A tab may render only its own ready package. Keeping the last successful
 * package on screen made a failed month look like a valid daily forecast.
 */
export function selectActiveReadyPersonalForecast(
  period: PersonalForecastPeriod,
  states: Record<PersonalForecastPeriod, PersonalForecastPeriodResultState>,
): PersonalForecastClientResult | null {
  const candidate = states[period]?.result;
  if (
    !candidate
    || candidate.forecast.period !== period
    || candidate.forecast.meta.status !== 'ready'
  ) return null;
  return candidate;
}

function buildUrl(input: {
  period: PersonalForecastPeriod;
  periodKey: string;
}): string {
  const params = new URLSearchParams({
    period: input.period,
    periodKey: input.periodKey,
  });
  return `/api/content/forecast/personal?${params.toString()}`;
}

async function parseError(response: Response): Promise<PersonalForecastClientError> {
  const payload = await response.json().catch(() => ({}));
  const error = new Error(
    payload?.message || payload?.error || `Personal forecast failed (${response.status})`,
  ) as PersonalForecastClientError;
  error.status = response.status;
  error.code = payload?.code;
  error.retryAfterMs = Number(payload?.retryAfterMs) || undefined;
  return error;
}

async function fetchCached(input: {
  profile: UserProfile;
  period: PersonalForecastPeriod;
  periodKey: string;
  traceId: string;
  attempt?: number;
}): Promise<PersonalForecastClientResult | null> {
  const startedAt = Date.now();
  logForecastDiagnostic('INFO', input.traceId, {
    stage: 'cache_request', status: 'start', period: input.period, attempt: input.attempt,
  });
  try {
    const response = await apiFetch(buildUrl(input), {
      method: 'GET',
      headers: {
        ...getTelegramInitDataHeaders(),
        ...diagnosticTraceHeaders(input.traceId),
      },
    });
    // The API uses 204 for an empty, valid cache and older deployments used
    // 404. Both mean the caller must begin generation.
    if (response.status === 404 || response.status === 204) {
      logForecastDiagnostic('INFO', input.traceId, {
        stage: 'cache_result',
        status: 'cache_miss',
        durationMs: Date.now() - startedAt,
        httpStatus: response.status,
        period: input.period,
        attempt: input.attempt,
      });
      return null;
    }
    if (!response.ok) throw await parseError(response);
    const payload = await response.json().catch(() => null);
    const result = parseAccessPayload(payload, 'cache', input);
    logForecastDiagnostic('INFO', input.traceId, {
      stage: 'cache_result',
      status: 'cache_hit',
      durationMs: Date.now() - startedAt,
      httpStatus: response.status,
      period: input.period,
      source: result.source,
      attempt: input.attempt,
    });
    return result;
  } catch (error) {
    logForecastDiagnostic('ERROR', input.traceId, {
      stage: 'cache_result',
      status: 'error',
      durationMs: Date.now() - startedAt,
      httpStatus: diagnosticHttpStatus(error),
      errorCode: diagnosticErrorCode(error, 'PERSONAL_FORECAST_CACHE_FAILED'),
      period: input.period,
      attempt: input.attempt,
    });
    throw error;
  }
}

async function generate(input: {
  profile: UserProfile;
  period: PersonalForecastPeriod;
  periodKey: string;
  maxInProgressRetries: number;
  traceId: string;
}): Promise<PersonalForecastClientResult> {
  const startedAt = Date.now();
  logForecastDiagnostic('INFO', input.traceId, {
    stage: 'generation_request', status: 'start', period: input.period,
  });
  const response = await apiFetch('/api/content/forecast/personal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getTelegramInitDataHeaders(),
      ...diagnosticTraceHeaders(input.traceId),
    },
    body: JSON.stringify({
      period: input.period,
      periodKey: input.periodKey,
    }),
  });
  if (response.status !== 202) {
    if (!response.ok) throw await parseError(response);
    const payload = await response.json().catch(() => null);
    const result = parseAccessPayload(payload, undefined, input);
    logForecastDiagnostic('INFO', input.traceId, {
      stage: 'generation_result',
      status: 'ok',
      durationMs: Date.now() - startedAt,
      httpStatus: response.status,
      period: input.period,
      source: result.source,
    });
    return result;
  }

  const payload = await response.json().catch(() => ({}));
  const retryAfterMs = Math.min(
    3_000,
    Math.max(500, Number(payload?.retryAfterMs) || 1500),
  );
  logForecastDiagnostic('INFO', input.traceId, {
    stage: 'generation_result',
    status: 'in_progress',
    durationMs: Date.now() - startedAt,
    httpStatus: response.status,
    period: input.period,
  });
  for (let attempt = 0; attempt < input.maxInProgressRetries; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
    const cached = await fetchCached({ ...input, attempt: attempt + 1 });
    if (cached) return cached;
  }
  const error = new Error('Personal forecast generation is still in progress') as PersonalForecastClientError;
  error.status = 202;
  error.code = 'GENERATION_IN_PROGRESS';
  error.retryAfterMs = retryAfterMs;
  throw error;
}

export function readLocalPersonalForecast(input: {
  profile: UserProfile;
  period: PersonalForecastPeriod;
  periodKey?: string;
}): PersonalForecastClientResult | null {
  const timezone = normalizeForecastTimezone(input.profile.birthTimezone);
  const periodKey = input.periodKey
    || getPersonalForecastPeriodKey(input.period, new Date(), timezone);
  return readStored(contextKey({ ...input, periodKey }));
}

export async function loadPersonalForecast(input: {
  profile: UserProfile;
  period: PersonalForecastPeriod;
  periodKey?: string;
  options?: LoadOptions;
}): Promise<PersonalForecastClientResult> {
  const traceId = createDiagnosticTraceId(`forecast-${input.period}`);
  const startedAt = Date.now();
  const timezone = normalizeForecastTimezone(input.profile.birthTimezone);
  const periodKey = input.periodKey
    || getPersonalForecastPeriodKey(input.period, new Date(), timezone);
  const resolved = { ...input, periodKey };
  const key = contextKey(resolved);
  const local = input.options?.force ? null : readStored(key);
  logForecastDiagnostic('INFO', traceId, {
    stage: 'load', status: 'start', period: input.period,
  });
  if (local) {
    logForecastDiagnostic('INFO', traceId, {
      stage: 'local_cache',
      status: 'cache_hit',
      durationMs: Date.now() - startedAt,
      period: input.period,
      source: 'local',
    });
  }
  if (input.options?.cacheOnly && local) return local;
  const inFlightKey = `${key}:${input.options?.cacheOnly ? 'cache' : 'ensure'}`;
  const current = inFlight.get(inFlightKey);
  if (current) {
    logForecastDiagnostic('INFO', traceId, {
      stage: 'in_flight', status: 'in_progress', period: input.period,
    });
    return current;
  }

  const request = (async () => {
    const serverCached = await fetchCached({ ...resolved, traceId }).catch((error: PersonalForecastClientError) => {
      const retryableCacheFailure = Number(error.status) >= 500;
      if (input.options?.cacheOnly || !retryableCacheFailure) throw error;
      return null;
    });
    if (serverCached) {
      writeStored(key, serverCached);
      logForecastDiagnostic('INFO', traceId, {
        stage: 'finished',
        status: 'ok',
        durationMs: Date.now() - startedAt,
        period: input.period,
        source: serverCached.source,
      });
      return serverCached;
    }
    if (input.options?.cacheOnly) {
      const error = new Error('Personal forecast is not cached') as PersonalForecastClientError;
      error.status = 404;
      error.code = 'PERSONAL_FORECAST_NOT_READY';
      throw error;
    }
    const generated = await generate({
      ...resolved,
      traceId,
      maxInProgressRetries: Math.min(
        60,
        Math.max(0, input.options?.maxInProgressRetries ?? 60),
      ),
    });
    writeStored(key, generated);
    logForecastDiagnostic('INFO', traceId, {
      stage: 'finished',
      status: 'ok',
      durationMs: Date.now() - startedAt,
      period: input.period,
      source: generated.source,
    });
    return { ...generated, generatedDuringRequest: true };
  })().catch((error) => {
    logForecastDiagnostic('ERROR', traceId, {
      stage: 'finished',
      status: 'error',
      durationMs: Date.now() - startedAt,
      httpStatus: diagnosticHttpStatus(error),
      errorCode: diagnosticErrorCode(error, 'PERSONAL_FORECAST_FAILED'),
      period: input.period,
    });
    showRuntimeDiagnosticsForFailure('personal forecast failed', error);
    throw error;
  }).finally(() => {
    if (inFlight.get(inFlightKey) === request) inFlight.delete(inFlightKey);
  });
  inFlight.set(inFlightKey, request);
  return request;
}

export function clearPersonalForecastSessionCache(): void {
  memoryCache.clear();
  inFlight.clear();
}
