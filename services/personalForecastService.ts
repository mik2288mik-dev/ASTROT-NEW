import type { NatalChartData, UserProfile } from '../types';
import { hasActivePremium } from '../lib/accessMatrix';
import {
  APP_VOICE_VERSION,
} from '../lib/appVoice';
import {
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildPersonalForecastChartFingerprint,
  getPersonalForecastPeriodKey,
  normalizeForecastTimezone,
  type ForecastTopicKey,
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
};

export type PersonalForecastClientResult = {
  forecast: PersonalForecastPackage;
  accessTier: 'free' | 'premium';
  lockedTopicKeys: ForecastTopicKey[];
  source: 'local' | 'cache' | 'generated';
};

export type PersonalForecastClientError = Error & {
  status?: number;
  code?: string;
  retryAfterMs?: number;
};

const LOCAL_CACHE_PREFIX = 'tvoi-goroskop:personal-forecast-v2';
const memoryCache = new Map<string, PersonalForecastClientResult>();
const inFlight = new Map<string, Promise<PersonalForecastClientResult>>();

function userId(profile: UserProfile): string {
  return String(profile.id || '').trim();
}

function contextKey(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number | null;
  period: PersonalForecastPeriod;
  periodKey: string;
}): string {
  const timezone = normalizeForecastTimezone(
    input.chartData.timezone || input.profile.birthTimezone,
  );
  return [
    userId(input.profile),
    input.chartId ?? 'primary',
    input.period,
    input.periodKey,
    timezone,
    input.profile.language === 'en' ? 'en' : 'ru',
    hasActivePremium(input.profile) ? 'premium' : 'free',
    input.chartData.calculationVersion || 'unknown',
    buildPersonalForecastChartFingerprint(input.chartData),
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
  return (
    !!forecast
    && typeof forecast === 'object'
    && (['day', 'week', 'month', 'year'] as const).includes(forecast.period)
    && forecast.meta?.promptVersion === PERSONAL_FORECAST_PROMPT_VERSION
    && forecast.meta?.voiceVersion === APP_VOICE_VERSION
    && forecast.meta?.status === 'ready'
    && typeof forecast.overview?.card === 'string'
    && !!forecast.overview.card.trim()
    && Array.isArray(result.lockedTopicKeys)
    && (result.accessTier === 'free' || result.accessTier === 'premium')
  );
}

function readStored(key: string): PersonalForecastClientResult | null {
  const memory = memoryCache.get(key);
  if (memory) return memory;
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
  memoryCache.set(key, result);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(localStorageKey(key), JSON.stringify(result));
  } catch {
    // A storage quota failure must not break the personal screen.
  }
}

function buildUrl(input: {
  profile: UserProfile;
  chartId?: number | null;
  period: PersonalForecastPeriod;
  periodKey: string;
}): string {
  const params = new URLSearchParams({
    userId: userId(input.profile),
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
  if (response.status === 404) return null;
  if (!response.ok) throw await parseError(response);
  const payload = await response.json() as PersonalForecastAccessPayload;
  return {
    forecast: payload.forecast,
    accessTier: payload.accessTier,
    lockedTopicKeys: payload.lockedTopicKeys,
    source: 'cache',
  };
}

async function generate(input: {
  profile: UserProfile;
  chartId?: number | null;
  period: PersonalForecastPeriod;
  periodKey: string;
  maxInProgressRetries: number;
}): Promise<PersonalForecastClientResult> {
  for (let attempt = 0; attempt <= input.maxInProgressRetries; attempt += 1) {
    const response = await apiFetch('/api/content/forecast/personal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getTelegramInitDataHeaders(),
      },
      body: JSON.stringify({
        userId: userId(input.profile),
        chartId: input.chartId,
        period: input.period,
        periodKey: input.periodKey,
      }),
    });
    if (response.status === 202) {
      const payload = await response.json().catch(() => ({}));
      if (attempt >= input.maxInProgressRetries) {
        const error = new Error('Personal forecast generation is still in progress') as PersonalForecastClientError;
        error.status = 202;
        error.code = 'GENERATION_IN_PROGRESS';
        error.retryAfterMs = Number(payload?.retryAfterMs) || 1500;
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, Number(payload?.retryAfterMs) || 1500));
      const cached = await fetchCached(input);
      if (cached) return cached;
      continue;
    }
    if (!response.ok) throw await parseError(response);
    const payload = await response.json() as PersonalForecastAccessPayload;
    return {
      forecast: payload.forecast,
      accessTier: payload.accessTier,
      lockedTopicKeys: payload.lockedTopicKeys,
      source: payload.source,
    };
  }
  throw new Error('PERSONAL_FORECAST_GENERATION_FAILED');
}

export function readLocalPersonalForecast(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number | null;
  period: PersonalForecastPeriod;
  periodKey?: string;
}): PersonalForecastClientResult | null {
  const timezone = normalizeForecastTimezone(
    input.chartData.timezone || input.profile.birthTimezone,
  );
  const periodKey = input.periodKey
    || getPersonalForecastPeriodKey(input.period, new Date(), timezone);
  return readStored(contextKey({ ...input, periodKey }));
}

export async function loadPersonalForecast(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number | null;
  period: PersonalForecastPeriod;
  periodKey?: string;
  options?: LoadOptions;
}): Promise<PersonalForecastClientResult> {
  const timezone = normalizeForecastTimezone(
    input.chartData.timezone || input.profile.birthTimezone,
  );
  const periodKey = input.periodKey
    || getPersonalForecastPeriodKey(input.period, new Date(), timezone);
  const resolved = { ...input, periodKey };
  const key = contextKey(resolved);
  const local = input.options?.force ? null : readStored(key);
  if (input.options?.cacheOnly && local) return local;
  const inFlightKey = `${key}:${input.options?.cacheOnly ? 'cache' : 'ensure'}`;
  const current = inFlight.get(inFlightKey);
  if (current) return current;

  const request = (async () => {
    const serverCached = await fetchCached(resolved);
    if (serverCached) {
      writeStored(key, serverCached);
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
      maxInProgressRetries: input.options?.maxInProgressRetries ?? 4,
    });
    writeStored(key, generated);
    return generated;
  })().finally(() => {
    if (inFlight.get(inFlightKey) === request) inFlight.delete(inFlightKey);
  });
  inFlight.set(inFlightKey, request);
  return request;
}

export function clearPersonalForecastSessionCache(): void {
  memoryCache.clear();
  inFlight.clear();
}
