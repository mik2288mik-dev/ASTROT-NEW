import type { NatalChartData, UserProfile } from '../types';
import { hasActivePremium } from '../lib/accessMatrix';
import {
  APP_VOICE_VERSION,
} from '../lib/appVoice';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildPersonalForecastChartFingerprint,
  buildPersonalForecastProfileFingerprint,
  getPersonalForecastPeriodKey,
  isPersonalForecastPackage,
  normalizeForecastTimezone,
  type PersonalForecastAccessPayload,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
} from '../lib/personalForecastContract';
import { getTelegramInitDataHeaders } from './sessionService';
import { apiFetch } from './apiClient';

type LoadOptions = {
  cacheOnly?: boolean;
  force?: boolean;
  maxInProgressRetries?: number;
  background?: boolean;
};

export type PersonalForecastClientResult = {
  forecast: PersonalForecastPackage;
  accessTier: 'free' | 'premium';
  lockedSectionIds: string[];
  periodLocked: boolean;
  source: 'local' | 'cache' | 'stale' | 'generated';
};

export type PersonalForecastClientError = Error & {
  status?: number;
  code?: string;
  retryAfterMs?: number;
};

type PersonalForecastPeriodResultState = {
  result: PersonalForecastClientResult | null;
};

const LOCAL_CACHE_PREFIX = 'tvoi-goroskop:personal-forecast-feed-v6';
const ALL_LOCAL_CACHE_PREFIX = 'tvoi-goroskop:personal-forecast-feed-';
const memoryCache = new Map<string, PersonalForecastClientResult>();
const inFlight = new Map<string, Promise<PersonalForecastClientResult>>();
const startupPrewarmInFlight = new Map<string, Promise<void>>();

function userId(profile: UserProfile): string {
  return String(profile.id || '').trim();
}

function contextKey(input: {
  profile: UserProfile;
  chartData?: NatalChartData | null;
  chartId?: number | null;
  period: PersonalForecastPeriod;
  periodKey: string;
}): string {
  const timezone = normalizeForecastTimezone(
    input.chartData?.timezone || input.profile.birthTimezone,
  );
  return [
    userId(input.profile),
    input.chartId ?? 'primary',
    input.period,
    input.periodKey,
    timezone,
    input.profile.language === 'en' ? 'en' : 'ru',
    hasActivePremium(input.profile) ? 'premium' : 'free',
    input.chartData
      ? buildPersonalForecastChartFingerprint(input.chartData)
      : 'chart:missing',
    buildPersonalForecastProfileFingerprint(input.profile),
    PERSONAL_FORECAST_CALCULATION_VERSION,
    PERSONAL_FORECAST_CONTRACT_VERSION,
    PERSONAL_FORECAST_PROMPT_VERSION,
    APP_VOICE_VERSION,
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
        || section.inlineAstroAccent
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

function removeStored(key: string): void {
  memoryCache.delete(key);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(localStorageKey(key));
  } catch {
    // Storage can be unavailable in restricted webviews.
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
  chartId?: number | null;
  period: PersonalForecastPeriod;
  periodKey: string;
}): string {
  const params = new URLSearchParams({
    period: input.period,
    periodKey: input.periodKey,
  });
  if (input.chartId != null) params.set('chartId', String(input.chartId));
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
  chartId?: number | null;
  period: PersonalForecastPeriod;
  periodKey: string;
}): Promise<PersonalForecastClientResult | null> {
  const response = await apiFetch(buildUrl(input), {
    method: 'GET',
    headers: getTelegramInitDataHeaders(),
  });
  if (response.status === 404 || response.status === 204) return null;
  if (!response.ok) throw await parseError(response);
  const payload = await response.json().catch(() => null);
  return parseAccessPayload(payload, 'cache', input);
}

function generationRequest(
  input: {
    chartId?: number | null;
    period: PersonalForecastPeriod;
    periodKey: string;
  },
  options: {
    regenerate: boolean;
    regenerationAfter?: string;
  },
) {
  return apiFetch('/api/content/forecast/personal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getTelegramInitDataHeaders(),
    },
    body: JSON.stringify({
      chartId: input.chartId,
      period: input.period,
      periodKey: input.periodKey,
      regenerate: options.regenerate,
      ...(options.regenerationAfter
        ? { regenerationAfter: options.regenerationAfter }
        : {}),
    }),
  });
}

async function generate(input: {
  profile: UserProfile;
  chartId?: number | null;
  period: PersonalForecastPeriod;
  periodKey: string;
  maxInProgressRetries: number;
  regenerate: boolean;
}): Promise<PersonalForecastClientResult> {
  const regenerationAfter = input.regenerate ? new Date().toISOString() : undefined;
  let response = await generationRequest(input, {
    regenerate: input.regenerate,
    regenerationAfter,
  });
  if (response.status !== 202) {
    if (!response.ok) throw await parseError(response);
    const payload = await response.json().catch(() => null);
    return parseAccessPayload(payload, undefined, input);
  }

  let payload = await response.json().catch(() => ({}));
  let retryAfterMs = Math.min(
    3_000,
    Math.max(500, Number(payload?.retryAfterMs) || 1500),
  );
  for (let attempt = 0; attempt < input.maxInProgressRetries; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
    response = await generationRequest(input, {
      regenerate: false,
      regenerationAfter,
    });
    if (response.status === 202) {
      payload = await response.json().catch(() => ({}));
      retryAfterMs = Math.min(
        3_000,
        Math.max(500, Number(payload?.retryAfterMs) || retryAfterMs),
      );
      continue;
    }
    if (!response.ok) throw await parseError(response);
    const readyPayload = await response.json().catch(() => null);
    return parseAccessPayload(readyPayload, undefined, input);
  }
  const error = new Error('Personal forecast generation is still in progress') as PersonalForecastClientError;
  error.status = 202;
  error.code = 'GENERATION_IN_PROGRESS';
  error.retryAfterMs = retryAfterMs;
  throw error;
}

function scheduleStartupPrewarm(input: {
  profile: UserProfile;
  chartData?: NatalChartData | null;
  chartId?: number | null;
}): void {
  const id = userId(input.profile);
  if (!id) return;
  const timezone = normalizeForecastTimezone(
    input.chartData?.timezone || input.profile.birthTimezone,
  );
  const now = new Date();
  const periods: PersonalForecastPeriod[] = hasActivePremium(input.profile)
    ? ['day', 'week', 'month']
    : ['day'];
  const periodKeys = Object.fromEntries(periods.map((period) => [
    period,
    getPersonalForecastPeriodKey(period, now, timezone),
  ])) as Partial<Record<PersonalForecastPeriod, string>>;
  const key = [
    id,
    input.chartId ?? 'primary',
    input.chartData
      ? buildPersonalForecastChartFingerprint(input.chartData)
      : 'chart:missing',
    buildPersonalForecastProfileFingerprint(input.profile),
    getPersonalForecastPeriodKey('day', now, timezone),
    hasActivePremium(input.profile) ? 'premium' : 'free',
  ].join(':');
  if (startupPrewarmInFlight.has(key)) return;

  const task = (async () => {
    for (const period of periods) {
      try {
        await loadPersonalForecast({
          ...input,
          period,
          periodKey: periodKeys[period],
          options: {
            background: true,
            maxInProgressRetries: 60,
          },
        });
      } catch (error) {
        console.warn(
          `[personal-forecast] background ${period} generation failed:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  })().finally(() => {
    if (startupPrewarmInFlight.get(key) === task) {
      startupPrewarmInFlight.delete(key);
    }
  });
  startupPrewarmInFlight.set(key, task);
}

export function readLocalPersonalForecast(input: {
  profile: UserProfile;
  chartData?: NatalChartData | null;
  chartId?: number | null;
  period: PersonalForecastPeriod;
  periodKey?: string;
}): PersonalForecastClientResult | null {
  const timezone = normalizeForecastTimezone(
    input.chartData?.timezone || input.profile.birthTimezone,
  );
  const periodKey = input.periodKey
    || getPersonalForecastPeriodKey(input.period, new Date(), timezone);
  return readStored(contextKey({ ...input, periodKey }));
}

export async function loadPersonalForecast(input: {
  profile: UserProfile;
  chartData?: NatalChartData | null;
  chartId?: number | null;
  period: PersonalForecastPeriod;
  periodKey?: string;
  options?: LoadOptions;
}): Promise<PersonalForecastClientResult> {
  const timezone = normalizeForecastTimezone(
    input.chartData?.timezone || input.profile.birthTimezone,
  );
  const periodKey = input.periodKey
    || getPersonalForecastPeriodKey(input.period, new Date(), timezone);
  const resolved = { ...input, periodKey };
  const key = contextKey(resolved);
  const force = input.options?.force === true;
  if (force) removeStored(key);
  const local = force ? null : readStored(key);
  if (local) {
    if (!input.options?.background) {
      scheduleStartupPrewarm({
        profile: input.profile,
        chartData: input.chartData,
        chartId: input.chartId,
      });
    }
    return local;
  }
  const inFlightKey = `${key}:${input.options?.cacheOnly ? 'cache' : force ? 'regenerate' : 'ensure'}`;
  const current = inFlight.get(inFlightKey);
  if (current) return current;

  const request = (async () => {
    const shouldReadServerCache = input.options?.cacheOnly === true || !force;
    if (shouldReadServerCache) {
      const serverCached = await fetchCached(resolved).catch((error: PersonalForecastClientError) => {
        const retryableCacheFailure = Number(error.status) >= 500;
        if (input.options?.cacheOnly || !retryableCacheFailure) throw error;
        return null;
      });
      if (serverCached) {
        writeStored(key, serverCached);
        return serverCached;
      }
    }
    if (input.options?.cacheOnly) {
      const error = new Error('Personal forecast is not cached') as PersonalForecastClientError;
      error.status = 404;
      error.code = 'PERSONAL_FORECAST_NOT_READY';
      throw error;
    }
    const generated = await generate({
      ...resolved,
      regenerate: force,
      maxInProgressRetries: Math.min(
        60,
        Math.max(0, input.options?.maxInProgressRetries ?? 60),
      ),
    });
    writeStored(key, generated);
    return generated;
  })().finally(() => {
    if (inFlight.get(inFlightKey) === request) inFlight.delete(inFlightKey);
  });
  inFlight.set(inFlightKey, request);
  const result = await request;
  if (!input.options?.background) {
    scheduleStartupPrewarm({
      profile: input.profile,
      chartData: input.chartData,
      chartId: input.chartId,
    });
  }
  return result;
}

export function clearPersonalForecastSessionCache(): void {
  memoryCache.clear();
  inFlight.clear();
  startupPrewarmInFlight.clear();
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(ALL_LOCAL_CACHE_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Storage can be unavailable in restricted webviews.
  }
}
