import { UserProfile, NatalChartData, DailyHoroscope, SynastryResult, UserEvolution, OracleChatResponse, OracleHistoryEntry, ForecastDailyReading, ForecastDaypartReading, ForecastDaypartSlot, NatalAnchorReading, NatalLivingReading } from "../types";
import { SYSTEM_INSTRUCTION_ASTRA } from "../constants";
import { getElementForSign } from "../lib/zodiac-utils";
import { coerceNatalAnchorReading, coerceNatalLivingReading, getCurrentNatalPeriodKey, mapNatalAnchorToLegacyIntro } from "../lib/natalReadings";

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
  options?: { notFoundAsNull?: boolean }
): Promise<ContentApiResponse<T> | null> {
  const response = await fetch(url, init);
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

export const getPremiumDaypartForecast = async (
  profile: UserProfile,
  chartData: NatalChartData,
  slot: ForecastDaypartSlot
): Promise<ForecastDaypartReading> => {
  const url = `${API_BASE_URL}/api/content/forecast/daypart`;
  log.info('[getPremiumDaypartForecast] Starting request', { userId: profile.id, slot });

  const data = await fetchContentApi<ForecastDaypartReading>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: profile.id,
      profile,
      chartData,
      slot,
    }),
  });

  const reading = data?.interpretation?.content;
  if (!reading) {
    throw buildApiError(`Premium ${slot} forecast is missing`);
  }

  return reading;
};

export const getCachedPremiumDaypartForecast = async (
  userId: string,
  slot: ForecastDaypartSlot,
  chartId?: number | null
): Promise<ForecastDaypartReading | null> => {
  if (!userId) return null;

  const params = new URLSearchParams({ userId, slot });
  if (chartId != null) {
    params.set('chartId', String(chartId));
  }

  const url = `${API_BASE_URL}/api/content/forecast/daypart?${params.toString()}`;
  log.info('[getCachedPremiumDaypartForecast] Starting request', { userId, slot, chartId: chartId ?? null });

  const data = await fetchContentApi<ForecastDaypartReading>(
    url,
    { method: 'GET', cache: 'no-store' },
    { notFoundAsNull: true }
  );

  return data?.interpretation?.content ?? null;
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
    log.info('[getNatalIntro] Loading natal_v2 anchor layer', {
      userId: profile.id,
      chartId: chartId ?? null,
    });
    const reading = await getNatalAnchorLayer(profile, chartData, chartId);
    return mapNatalAnchorToLegacyIntro(reading);
  } catch (error: any) {
    log.error('[getNatalIntro] natal_v2 request failed, falling back to legacy endpoint', {
      error: error?.message,
    });

    const url = `${API_BASE_URL}/api/astrology/natal-intro`;
    log.info(`[getNatalIntro] Sending legacy POST request to: ${url}`);
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
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[calculateBriefSynastry] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to calculate brief synastry: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as SynastryResult;
    log.info('[calculateBriefSynastry] Successfully calculated brief synastry');
    return result;
  } catch (error: any) {
    log.error('[calculateBriefSynastry] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    // Пробрасываем ошибку вместо fallback
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
      const errorText = await response.text().catch(() => 'Unable to read error response');
      log.error(`[calculateFullSynastry] Server returned error status ${response.status}`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to calculate full synastry: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as SynastryResult;
    log.info('[calculateFullSynastry] Successfully calculated full synastry');
    return result;
  } catch (error: any) {
    log.error('[calculateFullSynastry] Error occurred', {
      error: error.message,
      stack: error.stack
    });
    // Пробрасываем ошибку вместо fallback
    throw error;
  }
};


/**
 * Get daily horoscope
 * 
 * API проверяет БД - если гороскоп за сегодня уже есть, возвращает его.
 * Генерация происходит только один раз в сутки.
 */
const legacyGetDailyHoroscopeViaAstrologyEndpoint = async (profile: UserProfile, chartData: NatalChartData): Promise<DailyHoroscope> => {
  const url = `${API_BASE_URL}/api/astrology/daily-horoscope`;
  log.info('[getDailyHoroscope] Starting request', { userId: profile.id });

  try {
    log.info(`[getDailyHoroscope] Sending POST request to: ${url}`);
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        userId: profile.id, // Важно для кэширования в БД
        profile, 
        chartData 
      })
    });

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
    const response = await fetch(url, { method: 'GET', cache: 'no-store' });
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

export const getOracleHistory = async (profile: UserProfile, limit = 12): Promise<OracleHistoryEntry[]> => {
  const url = `${API_BASE_URL}/api/astrology/chat?userId=${encodeURIComponent(profile.id || '')}&limit=${limit}`;
  log.info('[getOracleHistory] Starting history request', {
    userId: profile.id,
    limit,
  });

  try {
    const startTime = Date.now();
    const response = await fetch(url);
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
  profile: UserProfile
): Promise<OracleChatResponse> => {
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
        userId: profile.id,
        history,
        message,
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
      let errorMessage = `Failed to chat with Astra: ${response.status} ${response.statusText}`;
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

    const data = await response.json() as OracleChatResponse;
    log.info('[chatWithAstra] Successfully received response', {
      responseLength: data.answer?.length || 0,
      reusedRecent: !!data.reusedRecent
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
