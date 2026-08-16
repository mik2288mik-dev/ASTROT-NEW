import type { UserProfile } from '../types';
import { hasActivePremium } from '../lib/accessMatrix';
import {
  AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
  AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION,
  AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
  AI_PERSONAL_HOROSCOPE_TIMEZONE,
  AI_PERSONAL_HOROSCOPE_VERSION,
  buildAiPersonalHoroscopeProfileFingerprint,
  getAiPersonalHoroscopeCurrentDate,
  getAiPersonalHoroscopePeriodKey,
  isAiPersonalHoroscopePackage,
  normalizeAiPersonalHoroscopeTimezone,
  resolveAiPersonalHoroscopeWindow,
  type AiPersonalHoroscopeAccessPayload,
  type AiPersonalHoroscopePackage,
  type AiPersonalHoroscopePeriod,
} from '../lib/aiPersonalHoroscope';
import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

type LoadOptions = {
  cacheOnly?: boolean;
  force?: boolean;
  maxInProgressRetries?: number;
};

export type PersonalForecastClientResult = {
  horoscope: AiPersonalHoroscopePackage;
  accessTier: 'free' | 'premium';
  lockedAdviceIndexes: number[];
  periodLocked: boolean;
  source: 'local' | 'cache' | 'generated';
};

export type PersonalForecastClientError = Error & {
  status?: number;
  code?: string;
  retryAfterMs?: number;
};

type PersonalForecastPeriodResultState = {
  result: PersonalForecastClientResult | null;
};

type ResolvedPersonalHoroscopeRequest = {
  period: AiPersonalHoroscopePeriod;
  periodKey: string;
  currentDate: string;
  timezone: string;
};

const LOCAL_CACHE_PREFIX = 'tvoi-goroskop:ai-personal-horoscope-v4';
const ALL_LOCAL_CACHE_PREFIX = 'tvoi-goroskop:ai-personal-horoscope-';
const memoryCache = new Map<string, PersonalForecastClientResult>();
const inFlight = new Map<string, Promise<PersonalForecastClientResult>>();

function userId(profile: UserProfile): string {
  return String(profile.id || '').trim();
}

function contextKey(input: {
  profile: UserProfile;
  period: AiPersonalHoroscopePeriod;
  periodKey: string;
  currentDate: string;
  timezone: string;
}): string {
  return [
    AI_PERSONAL_HOROSCOPE_VERSION,
    userId(input.profile),
    buildAiPersonalHoroscopeProfileFingerprint(input.profile),
    input.period,
    input.periodKey,
    input.currentDate,
    normalizeAiPersonalHoroscopeTimezone(input.timezone),
    input.profile.language === 'en' ? 'en' : 'ru',
    hasActivePremium(input.profile) ? 'premium' : 'free',
    AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
    AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION,
    AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
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

function lockedIndexesValid(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.every((index) => Number.isInteger(index) && index >= 0 && index <= 2)
    && new Set(value).size === value.length;
}

function sameIndexes(left: number[], right: number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isStoredResult(value: unknown): value is PersonalForecastClientResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as PersonalForecastClientResult;
  if (
    !isAiPersonalHoroscopePackage(result.horoscope, { allowRedacted: true })
    || (result.accessTier !== 'free' && result.accessTier !== 'premium')
    || typeof result.periodLocked !== 'boolean'
    || !lockedIndexesValid(result.lockedAdviceIndexes)
    || !(['local', 'cache', 'generated'] as const).includes(result.source)
  ) return false;

  if (result.accessTier === 'premium') {
    return !result.periodLocked
      && result.lockedAdviceIndexes.length === 0
      && isAiPersonalHoroscopePackage(result.horoscope);
  }

  if (result.horoscope.period !== 'day') {
    return result.periodLocked
      && sameIndexes(result.lockedAdviceIndexes, [0, 1, 2])
      && !result.horoscope.reading.opening
      && !result.horoscope.reading.forecast
      && result.horoscope.reading.advice.length === 0;
  }

  return !result.periodLocked
    && sameIndexes(result.lockedAdviceIndexes, [1, 2])
    && !!result.horoscope.reading.opening.trim()
    && !!result.horoscope.reading.forecast.trim()
    && result.horoscope.reading.advice.length === 1
    && !!result.horoscope.reading.advice[0]?.trim();
}

function invalidResponseError(): PersonalForecastClientError {
  const error = new Error(
    'Personal horoscope response does not match the direct AI contract',
  ) as PersonalForecastClientError;
  error.code = 'PERSONAL_HOROSCOPE_RESPONSE_INVALID';
  return error;
}

function parseAccessPayload(
  value: unknown,
  sourceOverride?: PersonalForecastClientResult['source'],
  expected?: Pick<AiPersonalHoroscopePackage, 'period' | 'periodKey' | 'currentDate'>,
): PersonalForecastClientResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidResponseError();
  }
  const payload = value as AiPersonalHoroscopeAccessPayload;
  const source = payload.source || sourceOverride;
  const result: PersonalForecastClientResult = {
    horoscope: payload.horoscope,
    accessTier: payload.accessTier,
    lockedAdviceIndexes: payload.lockedAdviceIndexes,
    periodLocked: payload.periodLocked,
    source: source === 'generated' ? 'generated' : 'cache',
  };
  if (!isStoredResult(result)) throw invalidResponseError();
  if (
    expected
    && (
      result.horoscope.period !== expected.period
      || result.horoscope.periodKey !== expected.periodKey
      || result.horoscope.currentDate !== expected.currentDate
    )
  ) throw invalidResponseError();
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
  memoryCache.set(key, result);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(localStorageKey(key), JSON.stringify(result));
  } catch {
    // A storage quota failure must not break the horoscope screen.
  }
}

export function selectActiveReadyPersonalForecast(
  period: AiPersonalHoroscopePeriod,
  states: Record<AiPersonalHoroscopePeriod, PersonalForecastPeriodResultState>,
): PersonalForecastClientResult | null {
  const candidate = states[period]?.result;
  if (
    !candidate
    || candidate.horoscope.period !== period
    || candidate.horoscope.meta.status !== 'ready'
  ) return null;
  return candidate;
}

function buildUrl(input: ResolvedPersonalHoroscopeRequest): string {
  const params = new URLSearchParams({
    period: input.period,
    periodKey: input.periodKey,
    timezone: input.timezone,
  });
  return `/api/content/forecast/personal?${params.toString()}`;
}

async function parseError(response: Response): Promise<PersonalForecastClientError> {
  const payload = await response.json().catch(() => ({}));
  const error = new Error(
    payload?.message || payload?.error || `Personal horoscope failed (${response.status})`,
  ) as PersonalForecastClientError;
  error.status = response.status;
  error.code = payload?.code;
  error.retryAfterMs = Number(payload?.retryAfterMs) || undefined;
  return error;
}

async function fetchCached(
  input: ResolvedPersonalHoroscopeRequest,
): Promise<PersonalForecastClientResult | null> {
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
  input: ResolvedPersonalHoroscopeRequest,
  regenerate: boolean,
) {
  return apiFetch('/api/content/forecast/personal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getTelegramInitDataHeaders(),
    },
    body: JSON.stringify({
      period: input.period,
      periodKey: input.periodKey,
      timezone: input.timezone,
      regenerate,
    }),
  });
}

async function generate(input: ResolvedPersonalHoroscopeRequest & {
  maxInProgressRetries: number;
  regenerate: boolean;
}): Promise<PersonalForecastClientResult> {
  let response = await generationRequest(input, input.regenerate);
  if (response.status !== 202) {
    if (!response.ok) throw await parseError(response);
    const payload = await response.json().catch(() => null);
    return parseAccessPayload(payload, undefined, input);
  }

  let payload = await response.json().catch(() => ({}));
  let retryAfterMs = Math.min(
    3_000,
    Math.max(500, Number(payload?.retryAfterMs) || 1_500),
  );
  for (let attempt = 0; attempt < input.maxInProgressRetries; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
    // Regeneration is requested only once. Polls use the ordinary path so they
    // can return the freshly written cache instead of starting another rewrite.
    response = await generationRequest(input, false);
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
  const error = new Error('Personal horoscope generation is still in progress') as PersonalForecastClientError;
  error.status = 202;
  error.code = 'GENERATION_IN_PROGRESS';
  error.retryAfterMs = retryAfterMs;
  throw error;
}

function resolveRequest(input: {
  profile: UserProfile;
  period: AiPersonalHoroscopePeriod;
  periodKey?: string;
}): ResolvedPersonalHoroscopeRequest {
  const timezone = normalizeAiPersonalHoroscopeTimezone(
    input.profile.birthTimezone || AI_PERSONAL_HOROSCOPE_TIMEZONE,
  );
  const periodKey = input.periodKey
    || getAiPersonalHoroscopePeriodKey(input.period, new Date(), timezone);
  const window = resolveAiPersonalHoroscopeWindow(input.period, periodKey, timezone);
  return {
    period: input.period,
    periodKey,
    currentDate: getAiPersonalHoroscopeCurrentDate(window),
    timezone,
  };
}

export function readLocalPersonalForecast(input: {
  profile: UserProfile;
  period: AiPersonalHoroscopePeriod;
  periodKey?: string;
}): PersonalForecastClientResult | null {
  const resolved = resolveRequest(input);
  return readStored(contextKey({ profile: input.profile, ...resolved }));
}

export async function loadPersonalForecast(input: {
  profile: UserProfile;
  period: AiPersonalHoroscopePeriod;
  periodKey?: string;
  options?: LoadOptions;
}): Promise<PersonalForecastClientResult> {
  const resolved = resolveRequest(input);
  const key = contextKey({ profile: input.profile, ...resolved });
  const force = input.options?.force === true;
  if (force) removeStored(key);
  const local = force ? null : readStored(key);
  if (local) return local;

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
      const error = new Error('Personal horoscope is not cached') as PersonalForecastClientError;
      error.status = 404;
      error.code = 'PERSONAL_HOROSCOPE_NOT_READY';
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
  return request;
}

export function clearPersonalForecastSessionCache(): void {
  memoryCache.clear();
  inFlight.clear();
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
