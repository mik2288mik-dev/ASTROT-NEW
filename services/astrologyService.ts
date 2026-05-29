import { UserProfile, NatalChartData, DailyHoroscope, SynastryResult, UserEvolution, OracleChatResponse, OracleHistoryEntry, ForecastDailyReading, ForecastDaypartReading, ForecastDaypartSlot, ForecastMonthlyReading, ForecastWeeklyReading, NatalAnchorReading, NatalFullReading, NatalLivingReading, AskLumiaState, AskLumiaTier, ContentAccessTier, PlanetInsight, TodayOverview, TodayOverviewResult, TodayPulseResult, HoroscopeReactionKey, HoroscopeReactionSummary, TodayAssistantHomeResult, DailyCheckInInput, DailyCheckInSubmitResult, ActionTimingKey, ActionTimingRecommendation } from "../types";
import { SYSTEM_INSTRUCTION_ASTRA } from "../constants";
import { getElementForSign } from "../lib/zodiac-utils";
import { coerceNatalAnchorReading, coerceNatalFullReading, coerceNatalLivingReading, getCurrentNatalPeriodKey, mapNatalAnchorToLegacyIntro } from "../lib/natalReadings";
import { isForecastLegacyFallbackEnabled } from "../lib/forecastLegacyConfig";
import { buildForecastFullDayUnlockCacheKey } from "../lib/forecastFullDay";
import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { isValidUserId } from "../lib/userId";
import type { NatalPlanetKey } from "../lib/natalPlanetMeta";

// API base URL - используем локальные Next.js API routes
const API_BASE_URL = typeof window !== 'undefined' ? '' : process.env.NEXT_PUBLIC_API_URL || '';

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
};

const DAILY_FORECAST_HEADLINE_FALLBACK: Record<'ru' | 'en', string> = {
  ru: 'Сегодня важно держаться за главное',
  en: 'Today is about holding on to what matters',
};

const DAILY_FORECAST_SUMMARY_FALLBACK: Record<'ru' | 'en', string> = {
  ru: 'День просит меньше суеты и больше внутренней собранности.',
  en: 'The day asks for less noise and more inner steadiness.',
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
    response = await fetchWithTimeout(url, init, timeoutMs);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw buildApiError('Request timed out', 408, 'TIMEOUT');
    }
    throw error;
  }

  if (response.status === 404 && options?.notFoundAsNull) {
    return null;
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
    } catch {
      const errorText = await response.text().catch(() => '');
      errorMessage = errorText || errorMessage;
    }

    throw buildApiError(errorMessage, response.status, errorCode, errorDetails);
  }

  return await response.json() as ContentApiResponse<T>;
}

function getLegacyHoroscopeSource(source?: string): DailyHoroscope['source'] {
  if (source === 'generated') return 'generated';
  if (source === 'generated-not-persisted') return 'generated-not-persisted';
  return 'cache';
}

export function mapForecastDailyToLegacyHoroscope(
  reading: ForecastDailyReading,
  options?: {
    source?: string;
    persisted?: boolean;
    code?: DailyHoroscope['code'];
    message?: string;
  }
): DailyHoroscope {
  return {
    date: reading.date,
    content: reading.reading,
    advice: [reading.chance, reading.risk, reading.focus].filter(Boolean),
    moonImpact: reading.context,
    transitFocus: reading.focus,
    persisted: options?.persisted,
    source: getLegacyHoroscopeSource(options?.source),
    code: options?.code,
    message: options?.message,
  };
}

export function mapLegacyHoroscopeToForecastDailyReading(
  horoscope: DailyHoroscope,
  language: 'ru' | 'en'
): ForecastDailyReading {
  return {
    date: horoscope.date || '',
    headline: horoscope.transitFocus || horoscope.advice?.[2] || horoscope.advice?.[0] || DAILY_FORECAST_HEADLINE_FALLBACK[language],
    summary: horoscope.moonImpact || horoscope.transitFocus || DAILY_FORECAST_SUMMARY_FALLBACK[language],
    chance: horoscope.advice?.[0] || DAILY_FORECAST_SUMMARY_FALLBACK[language],
    risk: horoscope.advice?.[1] || DAILY_FORECAST_SUMMARY_FALLBACK[language],
    focus: horoscope.transitFocus || horoscope.advice?.[2] || horoscope.advice?.[0] || DAILY_FORECAST_HEADLINE_FALLBACK[language],
    reading: horoscope.content || DAILY_FORECAST_SUMMARY_FALLBACK[language],
    context: horoscope.moonImpact || horoscope.transitFocus || DAILY_FORECAST_SUMMARY_FALLBACK[language],
    advice: (horoscope.advice || []).map((item) => String(item).trim()).filter(Boolean).slice(0, 3),
  };
}

export const getDailyForecastLayer = async (
  profile: UserProfile,
  chartData: NatalChartData
): Promise<ForecastDailyReading> => {
  const url = `${API_BASE_URL}/api/content/forecast/daily`;
  log.info('[getDailyForecastLayer] Starting request', { userId: profile.id });

  const data = await fetchContentApi<ForecastDailyReading>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: profile.id,
      profile,
      chartData,
    }),
  });

  const reading = data?.interpretation?.content;
  if (!reading) {
    throw buildApiError('Daily forecast content is missing');
  }

  return reading;
};

export const getCachedDailyForecastLayer = async (
  userId: string,
  chartId?: number | null
): Promise<ForecastDailyReading | null> => {
  if (!userId) return null;

  const params = new URLSearchParams({ userId });
  if (chartId != null) {
    params.set('chartId', String(chartId));
  }

  const url = `${API_BASE_URL}/api/content/forecast/daily?${params.toString()}`;
  log.info('[getCachedDailyForecastLayer] Starting request', { userId, chartId: chartId ?? null });

  const data = await fetchContentApi<ForecastDailyReading>(
    url,
    { method: 'GET', cache: 'no-store' },
    { notFoundAsNull: true }
  );

  return data?.interpretation?.content ?? null;
};

export const loadDailySignHoroscope = async (
  sign: string,
  date: string,
  language: 'ru' | 'en' = 'ru'
): Promise<ForecastDailyReading> => {
  const params = new URLSearchParams({ sign, date, language });
  const url = `${API_BASE_URL}/api/content/horoscope/sign-daily?${params.toString()}`;
  log.info('[loadDailySignHoroscope] Starting request', { sign, date, language });

  let response = await fetchWithTimeout(url, { method: 'GET', cache: 'no-store' }, 4500);
  if (response.status === 404) {
    response = await fetchWithTimeout(`${API_BASE_URL}/api/content/horoscope/sign-daily`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sign, date, language, strict: true }),
    }, 12000);
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

  return payload.reading as ForecastDailyReading;
};

export const getTodayOverview = async (
  profile: UserProfile,
  chartData: NatalChartData,
  chartId?: number | null,
  date?: string
): Promise<TodayOverviewResult> => {
  if (!isValidUserId(profile.id)) {
    throw buildApiError('Profile id is required');
  }

  const body = {
    userId: profile.id,
    profile,
    chartData,
    chartId,
    date,
  };
  let response: Response;
  try {
    response = await fetchWithTimeout(`${API_BASE_URL}/api/content/today/overview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }, 60000);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return {
        status: 'generating',
        code: 'GENERATION_IN_PROGRESS',
        retryAfterMs: 3000,
        chartId: chartId ?? null,
      };
    }
    throw error;
  }

  if (response.status === 202) {
    const payload = await response.json().catch(() => ({}));
    return {
      status: 'generating',
      code: 'GENERATION_IN_PROGRESS',
      retryAfterMs: Number(payload.retryAfterMs || 2500),
      chartId: typeof payload.chartId === 'number' ? payload.chartId : null,
    };
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw buildApiError(
      errorData.message || `Today overview failed: ${response.status} ${response.statusText}`,
      response.status,
      errorData.code || errorData.error
    );
  }

  const payload = await response.json();
  if (!payload?.overview) {
    throw buildApiError('Today overview content is missing');
  }
  return {
    status: 'ready',
    overview: payload.overview as TodayOverview,
    chartId: typeof payload.chartId === 'number' ? payload.chartId : null,
    source: String(payload.source || 'today_overview_v1'),
  };
};

const TODAY_PULSE_CLIENT_CACHE_TTL_MS = 10 * 60 * 1000;
const todayPulseClientCache = new Map<string, { result?: TodayPulseResult; promise?: Promise<TodayPulseResult>; expiresAt: number }>();

function todayPulseClientCacheKey(profile: UserProfile, chartId?: number | null, date?: string, chartData?: NatalChartData | null) {
  const chartFingerprint = chartData
    ? [
        chartData.sun?.sign,
        chartData.sun?.longitude ?? chartData.sun?.degree,
        chartData.moon?.sign,
        chartData.moon?.longitude ?? chartData.moon?.degree,
        chartData.rising?.sign,
        chartData.rising?.longitude ?? chartData.rising?.degree,
      ].join('|')
    : 'no-chart';
  return [
    profile.id || 'anonymous',
    chartId ?? 'primary',
    date || 'today',
    profile.language || 'ru',
    profile.birthDate || 'no-date',
    profile.birthTime || 'no-time',
    profile.birthPlace || 'no-place',
    chartFingerprint,
  ].join(':');
}

export function getCachedTodayPulse(profile: UserProfile, chartId?: number | null, date?: string, chartData?: NatalChartData | null): TodayPulseResult | null {
  const entry = todayPulseClientCache.get(todayPulseClientCacheKey(profile, chartId, date, chartData));
  if (!entry || !entry.result || entry.expiresAt <= Date.now()) return null;
  return entry.result;
}

export const getTodayPulse = async (
  profile: UserProfile,
  chartData: NatalChartData | null,
  chartId?: number | null,
  date?: string
): Promise<TodayPulseResult> => {
  if (!isValidUserId(profile.id)) {
    throw buildApiError('Profile id is required');
  }

  const cacheKey = todayPulseClientCacheKey(profile, chartId, date, chartData);
  const cached = todayPulseClientCache.get(cacheKey);
  if (cached?.result && cached.expiresAt > Date.now()) return cached.result;
  if (cached?.promise && cached.expiresAt > Date.now()) return cached.promise;

  const expiresAt = Date.now() + TODAY_PULSE_CLIENT_CACHE_TTL_MS;
  const promise = (async (): Promise<TodayPulseResult> => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/content/today/pulse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.id,
        profile,
        chartData,
        chartId,
        date,
      }),
    }, 60000);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw buildApiError(
        errorData.message || `Today pulse failed: ${response.status} ${response.statusText}`,
        response.status,
        errorData.code || errorData.error
      );
    }

    const payload = await response.json();
    if (payload?.status === 'ready' && payload?.pulse) {
      return {
        status: 'ready',
        pulse: payload.pulse,
        chartId: typeof payload.chartId === 'number' ? payload.chartId : null,
        source: String(payload.source || 'today_pulse_v1'),
      };
    }
    if (payload?.status === 'needs_setup') {
      return {
        status: 'needs_setup',
        code: 'PROFILE_BIRTH_DATA_REQUIRED',
        message: String(payload.message || 'Add birth data to calculate the day pulse.'),
        actionLabel: String(payload.actionLabel || 'Complete profile'),
      };
    }
    throw buildApiError('Today pulse payload is invalid');
  })();

  todayPulseClientCache.set(cacheKey, { promise, expiresAt });

  try {
    const result = await promise;
    todayPulseClientCache.set(cacheKey, { result, expiresAt });
    return result;
  } catch (error) {
    todayPulseClientCache.delete(cacheKey);
    throw error;
  }
};

const TODAY_ASSISTANT_CLIENT_CACHE_TTL_MS = 10 * 60 * 1000;
const todayAssistantClientCache = new Map<string, { result?: TodayAssistantHomeResult; promise?: Promise<TodayAssistantHomeResult>; expiresAt: number }>();

function todayAssistantClientCacheKey(profile: UserProfile, chartId?: number | null, date?: string, chartData?: NatalChartData | null) {
  return todayPulseClientCacheKey(profile, chartId, date, chartData);
}

function assistantToPulseResult(result: TodayAssistantHomeResult): TodayPulseResult {
  if (result.status === 'ready') {
    return {
      status: 'ready',
      pulse: result.pulse,
      chartId: result.chartId,
      source: result.source,
    };
  }
  return result;
}

export function getCachedTodayAssistantHome(
  profile: UserProfile,
  chartId?: number | null,
  date?: string,
  chartData?: NatalChartData | null
): TodayAssistantHomeResult | null {
  const entry = todayAssistantClientCache.get(todayAssistantClientCacheKey(profile, chartId, date, chartData));
  if (!entry || !entry.result || entry.expiresAt <= Date.now()) return null;
  return entry.result;
}

function setCachedTodayAssistantHome(
  profile: UserProfile,
  result: TodayAssistantHomeResult,
  chartId?: number | null,
  date?: string,
  chartData?: NatalChartData | null
) {
  const expiresAt = Date.now() + TODAY_ASSISTANT_CLIENT_CACHE_TTL_MS;
  todayAssistantClientCache.set(todayAssistantClientCacheKey(profile, chartId, date, chartData), { result, expiresAt });
  todayPulseClientCache.set(todayPulseClientCacheKey(profile, chartId, date, chartData), {
    result: assistantToPulseResult(result),
    expiresAt,
  });
}

export const getTodayAssistantHome = async (
  profile: UserProfile,
  chartData: NatalChartData | null,
  chartId?: number | null,
  date?: string
): Promise<TodayAssistantHomeResult> => {
  if (!isValidUserId(profile.id)) {
    throw buildApiError('Profile id is required');
  }

  const cacheKey = todayAssistantClientCacheKey(profile, chartId, date, chartData);
  const cached = todayAssistantClientCache.get(cacheKey);
  if (cached?.result && cached.expiresAt > Date.now()) return cached.result;
  if (cached?.promise && cached.expiresAt > Date.now()) return cached.promise;

  const expiresAt = Date.now() + TODAY_ASSISTANT_CLIENT_CACHE_TTL_MS;
  const promise = (async (): Promise<TodayAssistantHomeResult> => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/api/content/today/home`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.id,
        profile,
        chartData,
        chartId,
        date,
      }),
    }, 60000);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw buildApiError(
        errorData.message || `Today home failed: ${response.status} ${response.statusText}`,
        response.status,
        errorData.code || errorData.error
      );
    }

    const payload = await response.json();
    if (payload?.status === 'ready' && payload?.pulse) {
      return payload as TodayAssistantHomeResult;
    }
    if (payload?.status === 'needs_setup') {
      return {
        status: 'needs_setup',
        code: 'PROFILE_BIRTH_DATA_REQUIRED',
        message: String(payload.message || 'Add birth data to calculate Today.'),
        actionLabel: String(payload.actionLabel || 'Complete profile'),
      };
    }
    throw buildApiError('Today home payload is invalid');
  })();

  todayAssistantClientCache.set(cacheKey, { promise, expiresAt });

  try {
    const result = await promise;
    setCachedTodayAssistantHome(profile, result, chartId, date, chartData);
    return result;
  } catch (error) {
    todayAssistantClientCache.delete(cacheKey);
    throw error;
  }
};

export const submitDailyCheckIn = async (
  profile: UserProfile,
  chartData: NatalChartData | null,
  chartId: number | null | undefined,
  checkIn: DailyCheckInInput,
  date?: string
): Promise<DailyCheckInSubmitResult> => {
  if (!isValidUserId(profile.id)) {
    throw buildApiError('Profile id is required');
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/content/today/checkin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: profile.id,
      profile,
      chartData,
      chartId,
      date,
      checkIn,
    }),
  }, 60000);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw buildApiError(
      errorData.message || `Daily check-in failed: ${response.status} ${response.statusText}`,
      response.status,
      errorData.code || errorData.error
    );
  }

  const payload = await response.json();
  if (payload?.status !== 'saved' || !payload?.checkIn) {
    throw buildApiError('Daily check-in payload is invalid');
  }

  const cached = getCachedTodayAssistantHome(profile, chartId, date, chartData);
  if (cached?.status === 'ready') {
    setCachedTodayAssistantHome(profile, {
      ...cached,
      checkIn: { status: 'completed', entry: payload.checkIn },
      accuracySummary: payload.accuracySummary,
      patternTeaser: payload.patternTeaser,
      insights: payload.insights || [],
    }, chartId, date, chartData);
  }

  return payload as DailyCheckInSubmitResult;
};

export const getActionTimingRecommendation = async (
  profile: UserProfile,
  chartData: NatalChartData | null,
  chartId: number | null | undefined,
  actionKey: ActionTimingKey,
  date?: string
): Promise<ActionTimingRecommendation> => {
  if (!isValidUserId(profile.id)) {
    throw buildApiError('Profile id is required');
  }

  const response = await fetchWithTimeout(`${API_BASE_URL}/api/content/today/action-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: profile.id,
      profile,
      chartData,
      chartId,
      actionKey,
      date,
    }),
  }, 60000);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw buildApiError(
      errorData.message || `Action timing failed: ${response.status} ${response.statusText}`,
      response.status,
      errorData.code || errorData.error
    );
  }

  const payload = await response.json();
  if (payload?.status !== 'ready' || !payload?.recommendation) {
    throw buildApiError('Action timing payload is invalid');
  }
  return payload.recommendation as ActionTimingRecommendation;
};

export const setHoroscopeReaction = async (
  userId: string,
  sign: string,
  date: string,
  reactionKey: HoroscopeReactionKey,
  language: 'ru' | 'en' = 'ru'
): Promise<HoroscopeReactionSummary> => {
  if (!isValidUserId(userId)) {
    throw buildApiError('User id is required', 400, 'INVALID_USER_ID');
  }
  const response = await fetchWithTimeout(`${API_BASE_URL}/api/content/horoscope/reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, sign, date, reactionKey, language }),
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

export const getPremiumDaypartForecast = async (
  profile: UserProfile,
  chartData: NatalChartData,
  slot: ForecastDaypartSlot
): Promise<ForecastDaypartReading> => {
  const result = await getFullDaypartForecast(profile, chartData, slot, { accessTier: 'premium' });
  return result.reading;
};

export const getFullDaypartForecast = async (
  profile: UserProfile,
  chartData: NatalChartData,
  slot: ForecastDaypartSlot,
  options?: {
    accessTier?: 'premium' | 'stars' | 'lumi';
    starsPaymentChargeId?: string;
  }
): Promise<{ reading: ForecastDaypartReading; starsCost?: number }> => {
  const accessTier = options?.accessTier === 'lumi' ? 'stars' : (options?.accessTier || 'premium');
  const url = `${API_BASE_URL}/api/content/forecast/daypart`;
  log.info('[getFullDaypartForecast] Starting request', { userId: profile.id, slot, accessTier });

  const data = await fetchContentApi<ForecastDaypartReading>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: profile.id,
      profile,
      chartData,
      slot,
      accessTier,
      starsPaymentChargeId: options?.starsPaymentChargeId,
    }),
  });

  const reading = data?.interpretation?.content;
  if (!reading) {
    throw buildApiError(`Full ${slot} forecast is missing`);
  }

  return {
    reading,
    starsCost: typeof data?.starsCost === 'number' ? data.starsCost : undefined,
  };
};

export const getCachedPremiumDaypartForecast = async (
  userId: string,
  slot: ForecastDaypartSlot,
  chartId?: number | null
): Promise<ForecastDaypartReading | null> => {
  return getCachedFullDaypartForecast(userId, slot, {
    chartId,
    accessTier: 'premium',
  });
};

export const getCachedFullDaypartForecast = async (
  userId: string,
  slot: ForecastDaypartSlot,
  options?: {
    chartId?: number | null;
    accessTier?: 'premium' | 'stars' | 'lumi';
    dateKey?: string;
  }
): Promise<ForecastDaypartReading | null> => {
  if (!userId) return null;
  const accessTier = options?.accessTier || 'premium';
  const cacheKey = buildForecastFullDayUnlockCacheKey(options?.dateKey || '');

  const params = new URLSearchParams({ userId, slot });
  if (options?.chartId != null) {
    params.set('chartId', String(options.chartId));
  }
  params.set('accessTier', accessTier);
  if (cacheKey) params.set('date', cacheKey);

  const url = `${API_BASE_URL}/api/content/forecast/daypart?${params.toString()}`;
  log.info('[getCachedFullDaypartForecast] Starting request', {
    userId,
    slot,
    chartId: options?.chartId ?? null,
    accessTier,
  });

  let data: ContentApiResponse<ForecastDaypartReading> | null = null;
  try {
    data = await fetchContentApi<ForecastDaypartReading>(
      url,
      { method: 'GET', cache: 'no-store' },
      { notFoundAsNull: true }
    );
  } catch (error: any) {
    if (error?.status === 403 || error?.status === 409) {
      return null;
    }
    throw error;
  }

  return data?.interpretation?.content ?? null;
};

function coerceForecastWeeklyReading(raw: any): ForecastWeeklyReading {
  if (!raw || typeof raw !== 'object') {
    return { periodKey: '', periodLabel: '', headline: '', summary: '', focus: '' };
  }
  return {
    periodKey: String(raw.periodKey ?? ''),
    periodLabel: String(raw.periodLabel ?? ''),
    headline: String(raw.headline ?? ''),
    summary: String(raw.summary ?? ''),
    focus: String(raw.focus ?? ''),
    theme: raw.theme != null ? String(raw.theme) : undefined,
    opportunities: raw.opportunities != null ? String(raw.opportunities) : undefined,
    challenges: raw.challenges != null ? String(raw.challenges) : undefined,
    relationships: raw.relationships != null ? String(raw.relationships) : undefined,
    career: raw.career != null ? String(raw.career) : undefined,
    guidance: raw.guidance != null ? String(raw.guidance) : undefined,
    reading: raw.reading != null ? String(raw.reading) : undefined,
  };
}

function coerceForecastMonthlyReading(raw: any): ForecastMonthlyReading {
  if (!raw || typeof raw !== 'object') {
    return { periodKey: '', periodLabel: '', headline: '', summary: '', focus: '' };
  }
  return {
    periodKey: String(raw.periodKey ?? ''),
    periodLabel: String(raw.periodLabel ?? ''),
    headline: String(raw.headline ?? ''),
    summary: String(raw.summary ?? ''),
    focus: String(raw.focus ?? ''),
    theme: raw.theme != null ? String(raw.theme) : undefined,
    opportunities: raw.opportunities != null ? String(raw.opportunities) : undefined,
    challenges: raw.challenges != null ? String(raw.challenges) : undefined,
    relationships: raw.relationships != null ? String(raw.relationships) : undefined,
    money: raw.money != null ? String(raw.money) : undefined,
    guidance: raw.guidance != null ? String(raw.guidance) : undefined,
    reading: raw.reading != null ? String(raw.reading) : undefined,
  };
}

export const getCachedWeeklyForecastLayer = async (
  userId: string,
  chartId?: number | null,
  period?: string
): Promise<ForecastWeeklyReading | null> => {
  if (!userId) return null;
  const params = new URLSearchParams({ userId });
  if (chartId != null) params.set('chartId', String(chartId));
  if (period) params.set('period', period);
  const url = `${API_BASE_URL}/api/content/forecast/weekly?${params.toString()}`;
  const data = await fetchContentApi<ForecastWeeklyReading>(
    url,
    { method: 'GET', cache: 'no-store' },
    { notFoundAsNull: true }
  );
  const c = data?.interpretation?.content;
  return c ? coerceForecastWeeklyReading(c) : null;
};

export const ensureWeeklyForecastLayer = async (
  profile: UserProfile,
  chartData: NatalChartData,
  period?: string
): Promise<ForecastWeeklyReading> => {
  const userId = String(profile.id || '');
  if (!userId) throw buildApiError('userId is required', 400);

  const cached = await getCachedWeeklyForecastLayer(userId, undefined, period);
  if (cached?.headline) return cached;

  const tier = profile.isPremium ? 'premium' : 'free';
  const url = `${API_BASE_URL}/api/content/forecast/weekly`;
  const data = await fetchContentApi<ForecastWeeklyReading>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      profile,
      chartData,
      period,
      tier,
    }),
  });
  const c = data?.interpretation?.content;
  if (!c) throw buildApiError('Weekly forecast content is missing', 500);
  return coerceForecastWeeklyReading(c);
};

export const getCachedMonthlyForecastLayer = async (
  userId: string,
  chartId?: number | null,
  period?: string
): Promise<ForecastMonthlyReading | null> => {
  if (!userId) return null;
  const params = new URLSearchParams({ userId });
  if (chartId != null) params.set('chartId', String(chartId));
  if (period) params.set('period', period);
  const url = `${API_BASE_URL}/api/content/forecast/monthly?${params.toString()}`;
  const data = await fetchContentApi<ForecastMonthlyReading>(
    url,
    { method: 'GET', cache: 'no-store' },
    { notFoundAsNull: true }
  );
  const c = data?.interpretation?.content;
  return c ? coerceForecastMonthlyReading(c) : null;
};

export const ensureMonthlyForecastLayer = async (
  profile: UserProfile,
  chartData: NatalChartData,
  period?: string
): Promise<ForecastMonthlyReading> => {
  const userId = String(profile.id || '');
  if (!userId) throw buildApiError('userId is required', 400);

  const cached = await getCachedMonthlyForecastLayer(userId, undefined, period);
  if (cached?.headline) return cached;

  const tier = profile.isPremium ? 'premium' : 'free';
  const url = `${API_BASE_URL}/api/content/forecast/monthly`;
  const data = await fetchContentApi<ForecastMonthlyReading>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      profile,
      chartData,
      period,
      tier,
    }),
  });
  const c = data?.interpretation?.content;
  if (!c) throw buildApiError('Monthly forecast content is missing', 500);
  return coerceForecastMonthlyReading(c);
};

export const getNatalAnchorLayer = async (
  profile: UserProfile,
  chartData: NatalChartData,
  chartId?: number | null
): Promise<NatalAnchorReading> => {
  const url = `${API_BASE_URL}/api/content/natal/anchor`;
  log.info('[getNatalAnchorLayer] Starting request', { userId: profile.id, chartId: chartId ?? null });

  const data = await fetchContentApi<NatalAnchorReading>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
    headers: { 'Content-Type': 'application/json' },
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
  const url = `${API_BASE_URL}/api/astrology/natal-chart`;
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
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    let chartData: NatalChartData;
    try {
      chartData = await response.json() as NatalChartData;
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
  try {
    log.info('[getNatalIntro] Loading canonical natal anchor layer', {
      userId: profile.id,
      chartId: chartId ?? null,
    });
    const reading = await getNatalAnchorLayer(profile, chartData, chartId);
    return mapNatalAnchorToLegacyIntro(reading);
  } catch (error: any) {
    log.error('[getNatalIntro] canonical anchor request failed, falling back to compatibility endpoint', {
      error: error?.message,
    });

    const url = `${API_BASE_URL}/api/astrology/natal-intro`;
    log.info(`[getNatalIntro] Sending compatibility POST request to: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, chartData, chartId: chartId ?? undefined })
    });

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`;
      let errorCode: string | undefined;
      let errorDetails: any = null;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        errorCode = errorData.code;
        errorDetails = errorData.details;
      } catch {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        errorMessage = errorText || errorMessage;
      }

      const apiError = new Error(errorMessage) as ApiErrorWithCode;
      apiError.status = response.status;
      apiError.code = errorCode;
      apiError.details = errorDetails;
      throw apiError;
    }

    const data = await response.json();
    return data.intro;
  }
};

/** Приводит ответ brief API (плоский JSON или с briefOverview) к SynastryResult для UI. */
export function normalizeBriefSynastryPayload(raw: any): SynastryResult {
  if (!raw || typeof raw !== 'object') {
    return { summary: '—' };
  }
  if (raw.briefOverview && typeof raw.briefOverview === 'object') {
    return {
      summary: String(raw.summary ?? '').trim() || String(raw.briefOverview.introduction ?? '').trim() || '—',
      compatibilityScore: typeof raw.compatibilityScore === 'number' ? raw.compatibilityScore : undefined,
      briefOverview: raw.briefOverview,
    };
  }
  if (
    raw.introduction != null ||
    raw.harmony != null ||
    raw.challenges != null ||
    raw.tips != null
  ) {
    const tips = Array.isArray(raw.tips) ? raw.tips.map((t: any) => String(t)) : [];
    return {
      summary: String(raw.summary ?? raw.introduction ?? '').trim() || '—',
      compatibilityScore: typeof raw.compatibilityScore === 'number' ? raw.compatibilityScore : undefined,
      briefOverview: {
        introduction: String(raw.introduction ?? ''),
        harmony: String(raw.harmony ?? ''),
        challenges: String(raw.challenges ?? ''),
        tips,
      },
    };
  }
  return raw as SynastryResult;
}

/** Приводит ответ full API к SynastryResult для UI. */
export function normalizeFullSynastryPayload(raw: any): SynastryResult {
  if (!raw || typeof raw !== 'object') {
    return { summary: '—' };
  }
  if (raw.fullAnalysis && typeof raw.fullAnalysis === 'object') {
    return {
      summary: String(raw.summary ?? '').trim() || '—',
      compatibilityScore: typeof raw.compatibilityScore === 'number' ? raw.compatibilityScore : undefined,
      fullAnalysis: raw.fullAnalysis,
    };
  }
  if (raw.generalTheme != null || raw.attraction != null || raw.difficulties != null) {
    const rec = Array.isArray(raw.recommendations)
      ? raw.recommendations.map((x: any) => String(x))
      : [];
    return {
      summary: String(raw.summary ?? '').trim() || '—',
      compatibilityScore: typeof raw.compatibilityScore === 'number' ? raw.compatibilityScore : undefined,
      fullAnalysis: {
        generalTheme: String(raw.generalTheme ?? ''),
        attraction: String(raw.attraction ?? ''),
        difficulties: String(raw.difficulties ?? ''),
        recommendations: rec,
        potential: String(raw.potential ?? ''),
      },
    };
  }
  return raw as SynastryResult;
}

/**
 * Краткий обзор синастрии (бесплатный) - тизер для всех пользователей
 */
export const calculateBriefSynastry = async (
  profile: UserProfile, 
  partnerName: string, 
  partnerDate: string,
  partnerTime?: string,
  partnerPlace?: string,
  relationshipType?: string,
  partnerChartId?: number
): Promise<SynastryResult> => {
  const url = `${API_BASE_URL}/api/astrology/synastry-brief`;
  log.info('[calculateBriefSynastry] Starting calculation', { partnerName, partnerDate });

  try {
    log.info(`[calculateBriefSynastry] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        partnerName,
        partnerDate,
        partnerTime,
        partnerPlace,
        language: profile.language,
        relationshipType,
        partnerChartId
      })
    });

    const duration = Date.now() - startTime;
    log.info(`[calculateBriefSynastry] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      let errorMessage = `Failed to calculate brief synastry: ${response.status} ${response.statusText}`;
      let errorCode: string | undefined;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        errorCode = errorData.code;
      } catch {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        log.error(`[calculateBriefSynastry] Server returned error status ${response.status}`, {
          status: response.status,
          errorBody: errorText
        });
      }
      const apiError = new Error(errorMessage) as ApiErrorWithCode;
      apiError.status = response.status;
      apiError.code = errorCode;
      throw apiError;
    }

    const raw = await response.json();
    log.info('[calculateBriefSynastry] Successfully calculated brief synastry');
    return normalizeBriefSynastryPayload(raw);
  } catch (error: any) {
    log.error('[calculateBriefSynastry] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Полный анализ синастрии (премиум) - глубокий разбор для премиум пользователей
 */
export const calculateFullSynastry = async (
  profile: UserProfile, 
  partnerName: string, 
  partnerDate: string,
  partnerTime?: string,
  partnerPlace?: string,
  relationshipType?: string,
  partnerChartId?: number
): Promise<SynastryResult> => {
  const url = `${API_BASE_URL}/api/astrology/synastry-full`;
  log.info('[calculateFullSynastry] Starting calculation', { partnerName, partnerDate });

  try {
    log.info(`[calculateFullSynastry] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile,
        partnerName,
        partnerDate,
        partnerTime,
        partnerPlace,
        language: profile.language,
        relationshipType,
        partnerChartId
      })
    });

    const duration = Date.now() - startTime;
    log.info(`[calculateFullSynastry] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      let errorMessage = `Failed to calculate full synastry: ${response.status} ${response.statusText}`;
      let errorCode: string | undefined;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        errorCode = errorData.code;
      } catch {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        log.error(`[calculateFullSynastry] Server returned error status ${response.status}`, {
          status: response.status,
          errorBody: errorText
        });
      }
      const apiError = new Error(errorMessage) as ApiErrorWithCode;
      apiError.status = response.status;
      apiError.code = errorCode;
      throw apiError;
    }

    const raw = await response.json();
    log.info('[calculateFullSynastry] Successfully calculated full synastry');
    return normalizeFullSynastryPayload(raw);
  } catch (error: any) {
    log.error('[calculateFullSynastry] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

export type SynastryExtendedApiOutcome = {
  result: SynastryResult;
  starsSpent?: number;
  fromCache: boolean;
};

/**
 * Полный разбор синастрии: Premium или разовое открытие за Telegram Stars.
 */
export const calculateExtendedSynastry = async (
  profile: UserProfile,
  partnerName: string,
  partnerDate: string,
  partnerTime?: string,
  partnerPlace?: string,
  relationshipType?: string,
  partnerChartId?: number,
  starsPaymentChargeId?: string
): Promise<SynastryExtendedApiOutcome> => {
  const url = `${API_BASE_URL}/api/content/synastry/extended`;
  log.info('[calculateExtendedSynastry] Starting', { partnerName, partnerDate, hasStarsPayment: !!starsPaymentChargeId });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile,
      partnerName,
      partnerDate,
      partnerTime,
      partnerPlace,
      language: profile.language,
      relationshipType,
      partnerChartId,
      starsPaymentChargeId,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Synastry Stars full failed: ${response.status}`;
    let errorCode: string | undefined;
    let details: any;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
      errorCode = errorData.code;
      details = {
        starsCost: errorData.starsCost,
        starsPaymentRequired: errorData.starsPaymentRequired,
      };
    } catch {
      const errorText = await response.text().catch(() => '');
      errorMessage = errorText || errorMessage;
    }
    const apiError = new Error(errorMessage) as ApiErrorWithCode;
    apiError.status = response.status;
    apiError.code = errorCode;
    apiError.details = details;
    throw apiError;
  }

  const data = (await response.json()) as {
    result: SynastryResult;
    starsSpent?: number;
    fromCache?: boolean;
  };

  return {
    result: data.result,
    starsSpent: data.starsSpent ?? 0,
    fromCache: !!data.fromCache,
  };
};


/**
 * Legacy bridge: `/api/astrology/daily-horoscope` (deprecated; prefer `content/forecast/daily`).
 * Used only when the content API path fails, until the bridge can be removed safely.
 */
const legacyGetDailyHoroscopeViaAstrologyEndpoint = async (profile: UserProfile, chartData: NatalChartData): Promise<DailyHoroscope> => {
  const url = `${API_BASE_URL}/api/astrology/daily-horoscope`;
  log.info('[getDailyHoroscope] Starting request', { userId: profile.id });

  try {
    log.info(`[getDailyHoroscope] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: profile.id, // Важно для кэширования в БД
        profile, 
        chartData 
      })
    }, 12000);

    const duration = Date.now() - startTime;
    log.info(`[getDailyHoroscope] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      let errorMessage = `Failed to get daily horoscope: ${response.status} ${response.statusText}`;
      let errorCode: string | undefined;
      let errorDetails: any;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        errorCode = errorData.code;
        errorDetails = errorData.details;
      } catch {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        errorMessage = errorText || errorMessage;
      }

      log.error(`[getDailyHoroscope] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorCode,
        errorMessage,
        errorDetails,
      });
      const error = new Error(errorMessage) as ApiErrorWithCode;
      error.status = response.status;
      error.code = errorCode;
      error.details = errorDetails;
      throw error;
    }

    const horoscope = await response.json() as DailyHoroscope;
    log.info('[getDailyHoroscope] Successfully received daily horoscope');
    return horoscope;
  } catch (error: any) {
    log.error('[getDailyHoroscope] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    // Пробрасываем ошибку вместо fallback
    throw error;
  }
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



/**
 * @param chartId - optional; when provided, cache is chart-level (multi-chart)
 */
export const getDeepDiveAnalysis = async (
  profile: UserProfile,
  topic: string,
  chartData: NatalChartData,
  chartId?: number | null
): Promise<string> => {
  const url = `${API_BASE_URL}/api/astrology/deep-dive`;
  log.info('[getDeepDiveAnalysis] Starting request', { topic, userId: profile.id, chartId });

  try {
    log.info(`[getDeepDiveAnalysis] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, topic, chartData, chartId: chartId ?? undefined })
    });

    const duration = Date.now() - startTime;
    log.info(`[getDeepDiveAnalysis] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      let errorMessage = `Failed to get deep dive analysis: ${response.status} ${response.statusText}`;
      let errorCode: string | undefined;
      let errorDetails: any = null;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        errorCode = errorData.code;
        errorDetails = errorData.details;
      } catch {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        errorMessage = errorText || errorMessage;
      }

      log.error(`[getDeepDiveAnalysis] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorMessage,
        errorCode,
        errorDetails
      });

      const apiError = new Error(errorMessage) as ApiErrorWithCode;
      apiError.status = response.status;
      apiError.code = errorCode;
      apiError.details = errorDetails;
      throw apiError;
    }

    const data = await response.json();
    log.info('[getDeepDiveAnalysis] Successfully received analysis');
    return data.analysis || "Stars are silent.";
  } catch (error: any) {
    log.error('[getDeepDiveAnalysis] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    const lang = profile.language === 'ru';
    const fallback = lang
      ? `Глубокий анализ по теме "${topic}" для ${profile.name}. Ваша карта показывает интересные аспекты в этой области.`
      : `Deep analysis on "${topic}" for ${profile.name}. Your chart shows interesting aspects in this area.`;
    void fallback;
    throw error;
  }
};

const legacyGetCachedDailyHoroscopeViaAstrologyEndpoint = async (
  userId: string,
  language: 'ru' | 'en' = 'ru'
): Promise<DailyHoroscope | null> => {
  if (!userId) return null;

  const url = `${API_BASE_URL}/api/astrology/daily-horoscope?userId=${encodeURIComponent(userId)}&lang=${encodeURIComponent(language)}`;
  log.info('[getCachedDailyHoroscope] Starting request', { userId });

  try {
    const response = await fetchWithTimeout(url, { method: 'GET', cache: 'no-store' }, 4500);
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      let errorMessage = `Failed to get cached daily horoscope: ${response.status} ${response.statusText}`;
      let errorCode: string | undefined;
      let errorDetails: any;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        errorCode = errorData.code;
        errorDetails = errorData.details;
      } catch {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        errorMessage = errorText || errorMessage;
      }

      const error = new Error(errorMessage) as ApiErrorWithCode;
      error.status = response.status;
      error.code = errorCode;
      error.details = errorDetails;
      throw error;
    }

    return await response.json() as DailyHoroscope;
  } catch (error: any) {
    log.warn('[getCachedDailyHoroscope] Failed to load cached horoscope', {
      userId,
      error: error?.message,
    });
    throw error;
  }
};

export const getDailyHoroscope = async (profile: UserProfile, chartData: NatalChartData): Promise<DailyHoroscope> => {
  try {
    log.info('[getDailyHoroscope] Loading forecast_v2 daily layer', { userId: profile.id });
    const reading = await getDailyForecastLayer(profile, chartData);
    return mapForecastDailyToLegacyHoroscope(reading, {
      source: 'generated',
      persisted: true,
    });
  } catch (error: any) {
    if (!isForecastLegacyFallbackEnabled()) {
      log.error('[getDailyHoroscope] Forecast v2 failed; legacy fallback disabled', {
        error: error?.message,
      });
      throw error;
    }
    log.error('[getDailyHoroscope] Forecast v2 request failed, falling back to legacy endpoint', {
      error: error?.message,
    });
    return legacyGetDailyHoroscopeViaAstrologyEndpoint(profile, chartData);
  }
};

export const getCachedDailyHoroscope = async (
  userId: string,
  language: 'ru' | 'en' = 'ru'
): Promise<DailyHoroscope | null> => {
  try {
    log.info('[getCachedDailyHoroscope] Loading cached forecast_v2 daily layer', { userId, language });
    const reading = await getCachedDailyForecastLayer(userId);
    if (!reading) return null;

    return mapForecastDailyToLegacyHoroscope(reading, {
      source: 'cache',
      persisted: true,
    });
  } catch (error: any) {
    if (!isForecastLegacyFallbackEnabled()) {
      log.warn('[getCachedDailyHoroscope] Forecast v2 cache failed; legacy fallback disabled', {
        userId,
        error: error?.message,
      });
      return null;
    }
    log.warn('[getCachedDailyHoroscope] Forecast v2 cache request failed, falling back to legacy endpoint', {
      userId,
      error: error?.message,
    });
    return legacyGetCachedDailyHoroscopeViaAstrologyEndpoint(userId, language);
  }
};

const legacyChatWithAstra = async (history: { role: 'user' | 'model', text: string }[], message: string, profile: UserProfile): Promise<string> => {
  const url = `${API_BASE_URL}/api/astrology/chat`;
  log.info('[chatWithAstra] Starting chat request', {
    messageLength: message.length,
    historyLength: history.length,
    userId: profile.id
  });

  try {
    log.info(`[chatWithAstra] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        history,
        message,
        profile,
        systemInstruction: SYSTEM_INSTRUCTION_ASTRA
      })
    });

    const duration = Date.now() - startTime;
    log.info(`[chatWithAstra] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[chatWithAstra] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to chat with Astra: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    log.info('[chatWithAstra] Successfully received response', {
      responseLength: data.response?.length || 0
    });
    return data.response || "The stars are clouded.";
  } catch (error: any) {
    log.error('[chatWithAstra] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    const lang = profile.language === 'ru';
    return lang
      ? 'Звезды временно скрыты облаками. Попробуйте позже.'
      : 'The stars are temporarily clouded. Please try again later.';
  }
};

void legacyChatWithAstra;

export const getAskLumiaState = async (userId: string): Promise<AskLumiaState> => {
  const url = `${API_BASE_URL}/api/content/question/ask?userId=${encodeURIComponent(userId || '')}`;
  log.info('[getAskLumiaState] Starting request', { userId });

  const response = await fetch(url, { method: 'GET', cache: 'no-store' });
  if (!response.ok) {
    let errorMessage = `Failed to load Ask Lumia state: ${response.status} ${response.statusText}`;
    let errorCode: string | undefined;
    let errorDetails: any = null;

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
      errorCode = errorData.code;
      errorDetails = errorData.details;
    } catch {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      errorMessage = errorText || errorMessage;
    }

    const apiError = new Error(errorMessage) as ApiErrorWithCode;
    apiError.status = response.status;
    apiError.code = errorCode;
    apiError.details = errorDetails;
    throw apiError;
  }

  const data = await response.json();
  return data.state as AskLumiaState;
};

export const getOracleHistory = async (profile: UserProfile, limit = 12): Promise<OracleHistoryEntry[]> => {
  const url = `${API_BASE_URL}/api/content/question/history?userId=${encodeURIComponent(profile.id || '')}&limit=${limit}`;
  log.info('[getOracleHistory] Starting history request', {
    userId: profile.id,
    limit,
  });

  try {
    const startTime = Date.now();
    const response = await fetch(url, { cache: 'no-store' });
    const duration = Date.now() - startTime;

    log.info(`[getOracleHistory] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      let errorMessage = `Failed to load Oracle history: ${response.status} ${response.statusText}`;
      let errorCode: string | undefined;
      let errorDetails: any = null;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        errorCode = errorData.code;
        errorDetails = errorData.details;
      } catch {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        errorMessage = errorText || errorMessage;
      }

      const apiError = new Error(errorMessage) as ApiErrorWithCode;
      apiError.status = response.status;
      apiError.code = errorCode;
      apiError.details = errorDetails;
      throw apiError;
    }

    const data = await response.json();
    return data.items || [];
  } catch (error: any) {
    log.error('[getOracleHistory] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

export const chatWithAstra = async (
  history: { role: 'user' | 'model', text: string }[],
  message: string,
  profile: UserProfile,
  requestedTier?: AskLumiaTier,
  starsPaymentChargeId?: string
): Promise<OracleChatResponse> => {
  const url = `${API_BASE_URL}/api/content/question/ask`;
  const normalizedTier = (requestedTier as string | undefined) === 'lumi' ? 'stars' : requestedTier;
  log.info('[chatWithAstra] Starting Ask Lumia request', {
    messageLength: message.length,
    historyLength: history.length,
    userId: profile.id,
    requestedTier: normalizedTier || 'auto',
  });

  try {
    log.info(`[chatWithAstra] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: profile.id,
        history,
        message,
        requestedTier: normalizedTier,
        starsPaymentChargeId,
        systemInstruction: SYSTEM_INSTRUCTION_ASTRA
      })
    });

    const duration = Date.now() - startTime;
    log.info(`[chatWithAstra] Response received in ${duration}ms`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      let errorMessage = `Failed to ask Lumia: ${response.status} ${response.statusText}`;
      let errorCode: string | undefined;
      let errorDetails: any = null;

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
        errorCode = errorData.code;
        errorDetails = errorData.details || errorData.state;
      } catch {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        errorMessage = errorText || errorMessage;
      }

      const apiError = new Error(errorMessage) as ApiErrorWithCode;
      apiError.status = response.status;
      apiError.code = errorCode;
      apiError.details = errorDetails;
      throw apiError;
    }

    const data = await response.json() as OracleChatResponse;
    log.info('[chatWithAstra] Successfully received response', {
      responseLength: data.answer?.length || 0,
      reusedRecent: !!data.reusedRecent,
      tier: data.tier || 'unknown',
    });
    return data;
  } catch (error: any) {
    log.error('[chatWithAstra] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};
