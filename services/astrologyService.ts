import { UserProfile, NatalChartData, SynastryResult, UserEvolution, ForecastDailyReading, NatalAnchorReading, NatalFullReading, NatalLivingReading, ContentAccessTier, PlanetInsight, HoroscopeReactionKey, HoroscopeReactionSummary, HoroscopeEngagementSummary } from "../types";
import { getElementForSign } from "../lib/zodiac-utils";
import { coerceNatalAnchorReading, coerceNatalFullReading, coerceNatalLivingReading, getCurrentNatalPeriodKey, mapNatalAnchorToLegacyIntro } from "../lib/natalReadings";
import { apiFetch, getApiBaseUrl } from "./apiClient";
import { isValidUserId } from "../lib/userId";
import type { NatalPlanetKey } from "../lib/natalPlanetMeta";
import type { SignCompatibilityResult } from '../lib/synastry/signCompatibility';
import { buildLocalSignCompatibility } from '../lib/synastry/localSignText';
import type { RelationshipContext } from '../lib/synastry/relationshipContext';
import { getTelegramInitDataHeaders } from "./sessionService";
import type { SkyTodaySnapshot } from '../lib/skyToday';

// API base URL - используем локальные Next.js API routes
const API_BASE_URL = getApiBaseUrl();

// Logging utility
const log = {
  info: (message: string, data?: any) => {
    console.log(`[AstrologyService] ${message}`, data || '');
  },
  error: (message: string, error?: any) => {
    console.error(`[AstrologyService] ERROR: ${message}`, error || '');
  },
  warn: (message: string, data?: any) => {
    console.warn(`[AstrologyService] WARNING: ${message}`, data || '');
  }
};

// Log API configuration
log.info(`API_BASE_URL configured: ${API_BASE_URL}`);

type ApiErrorWithCode = Error & {
  status?: number;
  code?: string;
  details?: any;
};

type ContentApiResponse<T> = {
  interpretation?: {
    content: T;
  } | null;
  source?: string;
  chartId?: number | null;
  cacheKey?: string;
  entitlement?: unknown;
  starsCost?: number;
  starsPaymentRequired?: boolean;
  accessTier?: ContentAccessTier;
  locked?: boolean;
};

function buildApiError(
  fallbackMessage: string,
  status?: number,
  code?: string,
  details?: any
): ApiErrorWithCode {
  const error = new Error(fallbackMessage) as ApiErrorWithCode;
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

async function fetchContentApi<T>(
  url: string,
  init: RequestInit,
  options?: { notFoundAsNull?: boolean; timeoutMs?: number }
): Promise<ContentApiResponse<T> | null> {
  const method = String(init.method || 'GET').toUpperCase();
  const timeoutMs = options?.timeoutMs ?? (method === 'GET' ? 4500 : 12000);

  let response: Response;
  try {
    response = await apiFetch(url, init, timeoutMs);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw buildApiError('Request timed out', 408, 'TIMEOUT');
    }
    throw error;
  }

  if (response.status === 404 && options?.notFoundAsNull) {
    return null;
  }

  if (response.status === 202) {
    let payload: { message?: string; code?: string; retryAfterMs?: number } = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    throw buildApiError(
      payload.message || 'Generation in progress',
      202,
      payload.code || 'GENERATION_IN_PROGRESS',
      { retryAfterMs: payload.retryAfterMs }
    );
  }

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status} ${response.statusText}`;
    let errorCode: string | undefined;
    let errorDetails: any;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
      errorCode = errorData.code;
      errorDetails = errorData.details;
      if (errorData.retryAfterMs != null) {
        errorDetails = { ...(errorDetails || {}), retryAfterMs: errorData.retryAfterMs };
      }
    } catch {
      const errorText = await response.text().catch(() => '');
      errorMessage = errorText || errorMessage;
    }

    throw buildApiError(errorMessage, response.status, errorCode, errorDetails);
  }

  return await response.json() as ContentApiResponse<T>;
}

const signDailyClientCache = new Map<string, ForecastDailyReading>();
const signWeeklyClientCache = new Map<string, ForecastDailyReading>();
const signMonthlyClientCache = new Map<string, ForecastDailyReading>();

function signWeeklyClientCacheKey(sign: string, periodKey: string, language: 'ru' | 'en') {
  return `${sign.toLowerCase()}:${periodKey}:${language}`;
}

function signDailyClientCacheKey(sign: string, date: string, language: 'ru' | 'en') {
  return `${sign.toLowerCase()}:${date}:${language}`;
}

export const loadDailySignHoroscope = async (
  sign: string,
  date: string,
  language: 'ru' | 'en' = 'ru'
): Promise<ForecastDailyReading> => {
  return ensureDailySignHoroscope(sign, date, language);
};

export const getCachedDailySignHoroscope = async (
  sign: string,
  date: string,
  language: 'ru' | 'en' = 'ru'
): Promise<ForecastDailyReading | null> => {
  const memoryKey = signDailyClientCacheKey(sign, date, language);
  const memoryCached = signDailyClientCache.get(memoryKey);
  if (memoryCached) return memoryCached;

  const params = new URLSearchParams({ sign, date, language });
  const url = `${API_BASE_URL}/api/content/horoscope/sign-daily?${params.toString()}`;
  log.info('[getCachedDailySignHoroscope] Starting request', { sign, date, language });

  const response = await apiFetch(url, { method: 'GET', cache: 'no-store' }, 4500);
  if (response.status === 404) return null;

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw buildApiError(
      errorData.message || `Sign horoscope failed: ${response.status} ${response.statusText}`,
      response.status,
      errorData.code || errorData.error
    );
  }

  const payload = await response.json();
  if (!payload?.reading) {
    throw buildApiError('Sign horoscope content is missing');
  }

  const reading = payload.reading as ForecastDailyReading;
  signDailyClientCache.set(memoryKey, reading);
  return reading;
};

export const ensureDailySignHoroscope = async (
  sign: string,
  date: string,
  language: 'ru' | 'en' = 'ru'
): Promise<ForecastDailyReading> => {
  const cached = await getCachedDailySignHoroscope(sign, date, language);
  if (cached) return cached;

  log.info('[ensureDailySignHoroscope] Generating missing sign horoscope', { sign, date, language });
  const response = await apiFetch(`${API_BASE_URL}/api/content/horoscope/sign-daily`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify({ sign, date, language, strict: true }),
  }, 12000);

  if (response.status === 202) {
    const payload = await response.json().catch(() => ({}));
    const error = buildApiError(
      payload.message || 'Generation in progress',
      202,
      payload.code || 'GENERATION_IN_PROGRESS',
      { retryAfterMs: payload.retryAfterMs }
    );
    throw error;
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw buildApiError(
      errorData.message || `Sign horoscope failed: ${response.status} ${response.statusText}`,
      response.status,
      errorData.code || errorData.error
    );
  }

  const payload = await response.json();
  if (!payload?.reading) {
    throw buildApiError('Sign horoscope content is missing');
  }

  const reading = payload.reading as ForecastDailyReading;
  signDailyClientCache.set(signDailyClientCacheKey(sign, date, language), reading);
  return reading;
};

export const getCachedWeeklySignHoroscope = async (
  sign: string,
  periodKey: string,
  language: 'ru' | 'en' = 'ru'
): Promise<ForecastDailyReading | null> => {
  const key = signWeeklyClientCacheKey(sign, periodKey, language);
  const memory = signWeeklyClientCache.get(key);
  if (memory) return memory;
  const params = new URLSearchParams({ sign, periodKey, language });
  const response = await apiFetch(`${API_BASE_URL}/api/content/horoscope/sign-weekly?${params}`, { method: 'GET', cache: 'no-store' }, 4500);
  if (response.status === 404) return null;
  if (!response.ok) throw buildApiError(`Weekly sign horoscope failed: ${response.status}`, response.status);
  const payload = await response.json();
  if (!payload?.reading) throw buildApiError('Weekly sign horoscope content is missing');
  signWeeklyClientCache.set(key, payload.reading);
  return payload.reading as ForecastDailyReading;
};

export const ensureWeeklySignHoroscope = async (
  sign: string,
  periodKey: string,
  language: 'ru' | 'en' = 'ru'
): Promise<ForecastDailyReading> => {
  const cached = await getCachedWeeklySignHoroscope(sign, periodKey, language);
  if (cached) return cached;
  const response = await apiFetch(`${API_BASE_URL}/api/content/horoscope/sign-weekly`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() }, body: JSON.stringify({ sign, periodKey, language }),
  }, 15000);
  if (!response.ok) throw buildApiError(`Weekly sign horoscope failed: ${response.status}`, response.status);
  const payload = await response.json();
  if (!payload?.reading) throw buildApiError('Weekly sign horoscope content is missing');
  signWeeklyClientCache.set(signWeeklyClientCacheKey(sign, periodKey, language), payload.reading);
  return payload.reading as ForecastDailyReading;
};

export const getCachedMonthlySignHoroscope = async (
  sign: string,
  periodKey: string,
  language: 'ru' | 'en' = 'ru'
): Promise<ForecastDailyReading | null> => {
  const key = signWeeklyClientCacheKey(sign, periodKey, language);
  const memory = signMonthlyClientCache.get(key);
  if (memory) return memory;
  const params = new URLSearchParams({ sign, periodKey, language });
  const response = await apiFetch(`${API_BASE_URL}/api/content/horoscope/sign-monthly?${params}`, { method: 'GET', cache: 'no-store' }, 4500);
  if (response.status === 404) return null;
  if (!response.ok) throw buildApiError(`Monthly sign horoscope failed: ${response.status}`, response.status);
  const payload = await response.json();
  if (!payload?.reading) throw buildApiError('Monthly sign horoscope content is missing');
  signMonthlyClientCache.set(key, payload.reading);
  return payload.reading as ForecastDailyReading;
};

export const ensureMonthlySignHoroscope = async (
  sign: string,
  periodKey: string,
  language: 'ru' | 'en' = 'ru'
): Promise<ForecastDailyReading> => {
  const cached = await getCachedMonthlySignHoroscope(sign, periodKey, language);
  if (cached) return cached;
  const response = await apiFetch(`${API_BASE_URL}/api/content/horoscope/sign-monthly`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() }, body: JSON.stringify({ sign, periodKey, language }),
  }, 15000);
  if (!response.ok) throw buildApiError(`Monthly sign horoscope failed: ${response.status}`, response.status);
  const payload = await response.json();
  if (!payload?.reading) throw buildApiError('Monthly sign horoscope content is missing');
  signMonthlyClientCache.set(signWeeklyClientCacheKey(sign, periodKey, language), payload.reading);
  return payload.reading as ForecastDailyReading;
};

export const setHoroscopeReaction = async (
  userId: string,
  sign: string,
  date: string,
  reactionKey: HoroscopeReactionKey,
  language: 'ru' | 'en' = 'ru',
  period: 'today' | 'week' | 'month' = 'today'
): Promise<HoroscopeReactionSummary> => {
  if (!isValidUserId(userId)) {
    throw buildApiError('User id is required', 400, 'INVALID_USER_ID');
  }
  const response = await apiFetch(`${API_BASE_URL}/api/content/horoscope/reactions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify({ userId, sign, date, reactionKey, language, period }),
  }, 6000);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw buildApiError(
      errorData.message || `Horoscope reaction failed: ${response.status} ${response.statusText}`,
      response.status,
      errorData.code || errorData.error
    );
  }

  const payload = await response.json();
  return payload.summary as HoroscopeReactionSummary;
};

/** Remove the user's reaction (like toggle off) for a sign+date. */
export const removeHoroscopeReaction = async (
  userId: string,
  sign: string,
  date: string,
  language: 'ru' | 'en' = 'ru',
  period: 'today' | 'week' | 'month' = 'today'
): Promise<HoroscopeReactionSummary | null> => {
  if (!isValidUserId(userId)) return null;
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/content/horoscope/reactions`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
      body: JSON.stringify({ userId, sign, date, remove: true, language, period }),
    }, 6000);
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload?.summary as HoroscopeReactionSummary) ?? null;
  } catch {
    return null;
  }
};

/** Read the aggregated reaction counts for a sign+date (across all users). Null on any failure. */
export const getHoroscopeReactionSummary = async (
  userId: string,
  sign: string,
  date: string,
  language: 'ru' | 'en' = 'ru',
  period: 'today' | 'week' | 'month' = 'today'
): Promise<HoroscopeReactionSummary | null> => {
  if (!isValidUserId(userId)) return null;
  try {
    const url = `${API_BASE_URL}/api/content/horoscope/reactions`
      + `?userId=${encodeURIComponent(userId)}`
      + `&sign=${encodeURIComponent(sign)}`
      + `&date=${encodeURIComponent(date)}`
      + `&language=${language}`
      + `&period=${period}`;
    const response = await apiFetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { ...getTelegramInitDataHeaders() },
    }, 6000);
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload?.summary as HoroscopeReactionSummary) ?? null;
  } catch {
    return null;
  }
};

/** Read aggregate views/reposts for a sign+date horoscope. Null on any failure. */
export const getHoroscopeEngagement = async (
  userId: string,
  sign: string,
  date: string
): Promise<HoroscopeEngagementSummary | null> => {
  if (!isValidUserId(userId)) return null;
  try {
    const url = `${API_BASE_URL}/api/content/horoscope/engagement`
      + `?userId=${encodeURIComponent(userId)}`
      + `&sign=${encodeURIComponent(sign)}`
      + `&date=${encodeURIComponent(date)}`;
    const response = await apiFetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { ...getTelegramInitDataHeaders() },
    }, 6000);
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload?.summary as HoroscopeEngagementSummary) ?? null;
  } catch {
    return null;
  }
};

const postHoroscopeEngagement = async (
  userId: string,
  sign: string,
  date: string,
  action: 'view' | 'repost'
): Promise<HoroscopeEngagementSummary | null> => {
  if (!isValidUserId(userId)) return null;
  try {
    const response = await apiFetch(`${API_BASE_URL}/api/content/horoscope/engagement`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
      body: JSON.stringify({ userId, sign, date, action }),
    }, 6000);
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload?.summary as HoroscopeEngagementSummary) ?? null;
  } catch {
    return null;
  }
};

/** Count this user as a viewer of the sign+date horoscope (deduped server-side). */
export const markHoroscopeView = (userId: string, sign: string, date: string) =>
  postHoroscopeEngagement(userId, sign, date, 'view');

/** Record a repost (share) of the sign+date horoscope and return updated counts. */
export const markHoroscopeRepost = (userId: string, sign: string, date: string) =>
  postHoroscopeEngagement(userId, sign, date, 'repost');

export const getNatalAnchorLayer = async (
  profile: UserProfile,
  chartData: NatalChartData,
  chartId?: number | null
): Promise<NatalAnchorReading> => {
  const url = `${API_BASE_URL}/api/content/natal/anchor`;
  log.info('[getNatalAnchorLayer] Starting request', { userId: profile.id, chartId: chartId ?? null });

  const data = await fetchContentApi<NatalAnchorReading>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify({
      userId: profile.id,
      profile,
      chartData,
      chartId: chartId ?? undefined,
    }),
  });

  const reading = data?.interpretation?.content;
  if (!reading) {
    throw buildApiError('Natal anchor content is missing');
  }

  return coerceNatalAnchorReading(reading, profile.language === 'en' ? 'en' : 'ru');
};

export const getCachedNatalAnchorLayer = async (
  userId: string,
  language: 'ru' | 'en' = 'ru',
  chartId?: number | null
): Promise<NatalAnchorReading | null> => {
  if (!userId) return null;

  const params = new URLSearchParams({ userId });
  if (chartId != null) {
    params.set('chartId', String(chartId));
  }

  const url = `${API_BASE_URL}/api/content/natal/anchor?${params.toString()}`;
  log.info('[getCachedNatalAnchorLayer] Starting request', { userId, chartId: chartId ?? null });

  const data = await fetchContentApi<NatalAnchorReading>(
    url,
    { method: 'GET', cache: 'no-store' },
    { notFoundAsNull: true }
  );

  return data?.interpretation?.content
    ? coerceNatalAnchorReading(data.interpretation.content, language)
    : null;
};

export const getPremiumNatalLivingLayer = async (
  profile: UserProfile,
  chartData: NatalChartData,
  chartId?: number | null,
  periodKey = getCurrentNatalPeriodKey()
): Promise<NatalLivingReading> => {
  const url = `${API_BASE_URL}/api/content/natal/living`;
  log.info('[getPremiumNatalLivingLayer] Starting request', { userId: profile.id, chartId: chartId ?? null, periodKey });

  const data = await fetchContentApi<NatalLivingReading>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify({
      userId: profile.id,
      profile,
      chartData,
      chartId: chartId ?? undefined,
      periodKey,
    }),
  });

  const reading = data?.interpretation?.content;
  if (!reading) {
    throw buildApiError('Natal living content is missing');
  }

  return coerceNatalLivingReading(reading, profile.language === 'en' ? 'en' : 'ru', periodKey);
};

export const getCachedPremiumNatalLivingLayer = async (
  userId: string,
  language: 'ru' | 'en' = 'ru',
  chartId?: number | null,
  periodKey = getCurrentNatalPeriodKey()
): Promise<NatalLivingReading | null> => {
  if (!userId) return null;

  const params = new URLSearchParams({ userId, periodKey });
  if (chartId != null) {
    params.set('chartId', String(chartId));
  }

  const url = `${API_BASE_URL}/api/content/natal/living?${params.toString()}`;
  log.info('[getCachedPremiumNatalLivingLayer] Starting request', { userId, chartId: chartId ?? null, periodKey });

  const data = await fetchContentApi<NatalLivingReading>(
    url,
    { method: 'GET', cache: 'no-store' },
    { notFoundAsNull: true }
  );

  return data?.interpretation?.content
    ? coerceNatalLivingReading(data.interpretation.content, language, periodKey)
    : null;
};

export const getPremiumNatalFullLayer = async (
  profile: UserProfile,
  chartData: NatalChartData,
  chartId?: number | null
): Promise<NatalFullReading> => {
  const url = `${API_BASE_URL}/api/content/natal/full`;
  log.info('[getPremiumNatalFullLayer] Starting request', { userId: profile.id, chartId: chartId ?? null });

  const data = await fetchContentApi<NatalFullReading>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify({
      userId: profile.id,
      profile,
      chartData,
      chartId: chartId ?? undefined,
    }),
  }, { timeoutMs: 18000 });

  const reading = data?.interpretation?.content;
  if (!reading) {
    throw buildApiError('Natal full content is missing');
  }

  return coerceNatalFullReading(reading, profile.language === 'en' ? 'en' : 'ru', chartData);
};

export const getCachedPremiumNatalFullLayer = async (
  userId: string,
  language: 'ru' | 'en' = 'ru',
  chartId?: number | null
): Promise<NatalFullReading | null> => {
  if (!userId) return null;

  const params = new URLSearchParams({ userId });
  if (chartId != null) {
    params.set('chartId', String(chartId));
  }

  const url = `${API_BASE_URL}/api/content/natal/full?${params.toString()}`;
  log.info('[getCachedPremiumNatalFullLayer] Starting request', { userId, chartId: chartId ?? null });

  const data = await fetchContentApi<NatalFullReading>(
    url,
    { method: 'GET', cache: 'no-store' },
    { notFoundAsNull: true }
  );

  return data?.interpretation?.content
    ? coerceNatalFullReading(data.interpretation.content, language)
    : null;
};

export const getCachedPlanetInsight = async (
  userId: string,
  planetId: NatalPlanetKey,
  language: 'ru' | 'en' = 'ru',
  chartId?: number | null
): Promise<PlanetInsight | null> => {
  if (!userId) return null;

  const params = new URLSearchParams({
    userId,
    planetId,
    language,
  });
  if (chartId != null) {
    params.set('chartId', String(chartId));
  }

  const url = `${API_BASE_URL}/api/content/natal/planet-insight?${params.toString()}`;
  const data = await fetchContentApi<PlanetInsight>(
    url,
    { method: 'GET', cache: 'no-store' },
    { notFoundAsNull: true }
  );

  return data?.interpretation?.content || null;
};

export const getPlanetInsight = async (
  profile: UserProfile,
  chartData: NatalChartData,
  planetId: NatalPlanetKey,
  chartId?: number | null
): Promise<PlanetInsight> => {
  const url = `${API_BASE_URL}/api/content/natal/planet-insight`;
  const data = await fetchContentApi<PlanetInsight>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify({
      userId: profile.id,
      profile,
      chartData,
      chartId: chartId ?? undefined,
      planetId,
    }),
  });

  const insight = data?.interpretation?.content;
  if (!insight) {
    throw buildApiError('Planet insight content is missing');
  }

  return insight;
};

/**
 * Calculate natal chart - calls backend API
 * 
 * API является идемпотентным:
 * - Если карта уже есть в БД и данные не изменились - возвращает из кэша
 * - Если карты нет или данные изменились - рассчитывает и сохраняет
 */
export const calculateNatalChart = async (profile: UserProfile, forceRecalculate = false): Promise<NatalChartData> => {
  const url = `${API_BASE_URL}/api/charts`;
  log.info('[calculateNatalChart] Starting calculation', {
    userId: profile.id,
    name: profile.name,
    birthDate: profile.birthDate,
    birthPlace: profile.birthPlace,
    forceRecalculate
  });

  try {
    const requestBody = {
      userId: profile.id, // Важно для идемпотентности
      name: profile.name,
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      birthPlace: profile.birthPlace,
      language: profile.language,
      forceRecalculate
    };

    log.info(`[calculateNatalChart] Sending POST request to: ${url}`);

    const startTime = Date.now();
    const response = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
      body: JSON.stringify(requestBody)
    });

    const duration = Date.now() - startTime;
    log.info(`[calculateNatalChart] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      let errorMessage = '';
      let errorDetails: any = null;
      
      try {
        const errorData = await response.json();
        // Используем новую структуру ошибок с полем message
        errorMessage = errorData.message || errorData.error || 'Unknown error';
        errorDetails = errorData.errors || errorData.details;
      } catch {
        // Если не удалось распарсить JSON, пробуем прочитать как текст
        try {
          errorMessage = await response.text();
        } catch {
          errorMessage = `Ошибка сервера: ${response.status} ${response.statusText}`;
        }
      }
      
      log.error(`[calculateNatalChart] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorMessage,
        errorDetails,
        url,
        contentType: response.headers.get('content-type')
      });
      
      // Для ошибок валидации (400) возвращаем понятное сообщение
      if (response.status === 400) {
        const validationError = errorMessage || 'Ошибка валидации данных';
        throw new Error(validationError);
      }
      
      // Для ошибок инициализации (500) возвращаем понятное сообщение
      if (response.status === 500 && errorMessage) {
        // Используем сообщение от сервера, если оно есть
        throw new Error(errorMessage);
      }
      
      // Для других ошибок возвращаем понятное сообщение
      const userFriendlyError = errorMessage || `Ошибка сервера: ${response.status}`;
      throw new Error(userFriendlyError);
    }

    let payload: any;
    let chartData: NatalChartData;
    try {
      payload = await response.json();
      chartData = (payload?.chart_data || payload?.chartData || payload) as NatalChartData;
    } catch (parseError: any) {
      log.error('[calculateNatalChart] Failed to parse response JSON', {
        error: parseError.message
      });
      throw new Error('Invalid response format from server');
    }

    // Валидация полученных данных
    if (!chartData || !chartData.sun) {
      log.error('[calculateNatalChart] Invalid chart data received', {
        hasData: !!chartData,
        hasSun: !!chartData?.sun
      });
      throw new Error('Invalid chart data received from server');
    }

    log.info('[calculateNatalChart] Successfully calculated natal chart', {
      hasSun: !!chartData.sun,
      hasMoon: !!chartData.moon,
      element: chartData.element
    });
    return chartData;
  } catch (error: any) {
    log.error('[calculateNatalChart] Error occurred', {
      error: error.message,
      stack: error.stack,
      name: error.name
    });
    
    // Всегда пробрасываем ошибку - не используем mock данные
    throw error;
  }
};

/**
 * Get Natal Chart Introduction (новый формат вместо "трех ключей")
 * @param chartId - optional; when provided, cache is chart-level (multi-chart)
 */
export const getNatalIntro = async (
  profile: UserProfile,
  chartData: NatalChartData,
  chartId?: number | null
): Promise<string> => {
  log.info('[getNatalIntro] Loading canonical natal anchor layer', {
    userId: profile.id,
    chartId: chartId ?? null,
  });
  const reading = await getNatalAnchorLayer(profile, chartData, chartId);
  return mapNatalAnchorToLegacyIntro(reading);
};

const signCompatibilityClientCache = new Map<string, SignCompatibilityResult>();

export async function getSignCompatibility(
  signA: string,
  signB: string,
  language: 'ru' | 'en',
  genderA?: string | null,
  genderB?: string | null,
  relationshipContext: RelationshipContext = 'romance',
): Promise<SignCompatibilityResult> {
  // Порядок и пол ВАЖНЫ для текста (м+ж ≠ ж+м), поэтому ключ кеша не сортируем и включаем пол.
  const g = (v?: string | null) => (v === 'male' || v === 'female' ? v : 'x');
  const key = `${signA.toLowerCase()}:${g(genderA)}:${signB.toLowerCase()}:${g(genderB)}:${relationshipContext}:${language}`;
  const cachedLocal = signCompatibilityClientCache.get(key);
  if (cachedLocal) return cachedLocal;
  // Текст совместимости по знакам — из нашей базы (локальный композитор), без OpenAI.
  const result = buildLocalSignCompatibility(
    signA,
    signB,
    language,
    genderA,
    genderB,
    relationshipContext,
  );
  if (!result) throw buildApiError('Sign compatibility content is missing');
  signCompatibilityClientCache.set(key, result);
  return result;
}

export type SynastryExtendedApiOutcome = {
  result: SynastryResult;
  fromCache: boolean;
};

/** Полный разбор синастрии: только Premium. */
export const calculateExtendedSynastry = async (
  profile: UserProfile,
  partnerName: string,
  partnerDate: string,
  partnerTime?: string,
  partnerPlace?: string,
  relationshipType?: string,
  partnerChartId?: number
): Promise<SynastryExtendedApiOutcome> => {
  const url = `${API_BASE_URL}/api/content/synastry/extended`;
  log.info('[calculateExtendedSynastry] Starting', { partnerName, partnerDate });

  const response = await apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify({
      partnerName,
      partnerDate,
      partnerTime,
      partnerPlace,
      language: profile.language,
      relationshipType,
      partnerChartId,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Synastry full failed: ${response.status}`;
    let errorCode: string | undefined;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
      errorCode = errorData.code;
    } catch {
      const errorText = await response.text().catch(() => '');
      errorMessage = errorText || errorMessage;
    }
    const apiError = new Error(errorMessage) as ApiErrorWithCode;
    apiError.status = response.status;
    apiError.code = errorCode;
    throw apiError;
  }

  const data = (await response.json()) as {
    result: SynastryResult;
    fromCache?: boolean;
  };

  return {
    result: data.result,
    fromCache: !!data.fromCache,
  };
};


export const updateUserEvolution = async (profile: UserProfile, chartData?: NatalChartData): Promise<UserEvolution> => {
  // If no evolution exists, initialize with personalized values based on natal chart
  if (!profile.evolution) {
    // Начальные значения зависят от натальной карты пользователя
    const initialStats = calculateInitialStats(profile, chartData);
    
    return {
      level: 1,
      title: profile.language === 'ru' ? "Искатель" : "Seeker",
      stats: initialStats,
      lastUpdated: Date.now()
    };
  }

  const currentEvo = profile.evolution;

  // Simulate growth based on usage - каждый пользователь растет по-своему
  const updatedStats = {
    intuition: Math.min(100, currentEvo.stats.intuition + Math.floor(Math.random() * 5)),
    confidence: Math.min(100, currentEvo.stats.confidence + Math.floor(Math.random() * 3)),
    awareness: Math.min(100, currentEvo.stats.awareness + Math.floor(Math.random() * 4)),
  };
  
  let newLevel = currentEvo.level;
  const avgStat = (updatedStats.intuition + updatedStats.confidence + updatedStats.awareness) / 3;
  if (avgStat > (newLevel * 30)) {
    newLevel += 1;
  }

  const titles = profile.language === 'ru' 
    ? ["Искатель", "Ученик", "Мистик", "Проводник", "Мастер"]
    : ["Seeker", "Apprentice", "Mystic", "Guide", "Master"];
  const newTitle = titles[Math.min(newLevel - 1, 4)];

  return {
    level: newLevel,
    title: newTitle,
    stats: updatedStats,
    lastUpdated: Date.now()
  };
};

// Вычисляет начальные статы на основе натальной карты пользователя
function calculateInitialStats(profile: UserProfile, chartData?: NatalChartData): { intuition: number, confidence: number, awareness: number } {
  if (!chartData) {
    // Если нет данных карты - используем случайные, но уникальные для каждого пользователя значения
    const seed = profile.name?.length || 0;
    return {
      intuition: 40 + (seed % 20),
      confidence: 40 + ((seed * 2) % 20),
      awareness: 40 + ((seed * 3) % 20)
    };
  }

  // Используем централизованные данные о знаках для избежания дублирования

  // Интуиция зависит от Луны и водных знаков
  let intuition = 50;
  const moonSign = chartData.moon?.sign;
  const moonElement = moonSign ? getElementForSign(moonSign as any) : null;
  if (moonElement === 'Water') {
    intuition += 15;
  } else if (moonElement === 'Air') {
    intuition += 10;
  }

  // Уверенность зависит от Солнца и огненных знаков
  let confidence = 50;
  const sunSign = chartData.sun?.sign;
  const sunElement = sunSign ? getElementForSign(sunSign as any) : null;
  if (sunElement === 'Fire') {
    confidence += 15;
  } else if (sunElement === 'Earth') {
    confidence += 10;
  }

  // Осознанность зависит от элемента и Меркурия
  let awareness = 50;
  const element = chartData.element;
  if (element === 'Air') {
    awareness += 15;
  } else if (element === 'Earth') {
    awareness += 12;
  } else if (element === 'Water') {
    awareness += 8;
  }

  log.info('[updateUserEvolution] Calculated personalized initial stats', {
    userId: profile.id,
    sunSign,
    moonSign,
    element,
    stats: { intuition, confidence, awareness }
  });

  return { intuition, confidence, awareness };
}



let skyTodayCache: { key: string; data: SkyTodaySnapshot } | null = null;
let skyTodayRequest: { key: string; promise: Promise<SkyTodaySnapshot | null> } | null = null;

export async function getSkyToday(todayKey: string): Promise<SkyTodaySnapshot | null> {
  if (skyTodayCache?.key === todayKey) return skyTodayCache.data;
  if (skyTodayRequest?.key === todayKey) return skyTodayRequest.promise;

  const promise = (async () => {
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/content/today/sky`, {
        method: 'GET',
        headers: getTelegramInitDataHeaders(),
      });
      if (!response.ok) throw new Error(`sky ${response.status}`);
      const data = (await response.json()) as SkyTodaySnapshot;
      if (data?.source !== 'swisseph' || !data.moon || !data.mercury) return null;
      skyTodayCache = { key: todayKey, data };
      return data;
    } catch {
      return null;
    } finally {
      if (skyTodayRequest?.key === todayKey) skyTodayRequest = null;
    }
  })();

  skyTodayRequest = { key: todayKey, promise };
  return promise;
}

