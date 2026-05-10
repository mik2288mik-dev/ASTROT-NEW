import type { NextApiRequest, NextApiResponse } from 'next';
import type { ForecastDailyReading, NatalChartData, UserProfile } from '../../../../types';
import { db } from '../../../../lib/db';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { getContentLayer } from '../../../../lib/contentArchitecture';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import { generateFreeDailyForecast } from '../../../../lib/forecastContent';
import {
  buildSignDailyFallback,
  getCachedSignDailyHoroscope,
  getOrGenerateSignDailyHoroscope,
  normalizeZodiacKey,
} from '../../../../lib/horoscope/signDaily';
import { LockKeys, releaseLock, tryAcquireLock } from '../../../../lib/serverLocks';
import { buildTodayOverview, hydrateReactionSummaryLabels } from '../../../../lib/todayOverview';
import { invalidUserIdPayload, isValidUserId } from '../../../../lib/userId';

export const config = { maxDuration: 90 };

const GENERATION_RETRY_AFTER_MS = 2500;

type ApiErrorWithCode = Error & {
  code?: string;
  status?: number;
};

function buildApiError(message: string, code: string, status = 500): ApiErrorWithCode {
  const error = new Error(message) as ApiErrorWithCode;
  error.code = code;
  error.status = status;
  return error;
}

function isForecastDailyReading(value: unknown): value is ForecastDailyReading {
  const reading = value as ForecastDailyReading | null;
  return !!reading &&
    typeof reading === 'object' &&
    typeof reading.date === 'string' &&
    typeof reading.headline === 'string' &&
    typeof reading.summary === 'string' &&
    typeof reading.chance === 'string' &&
    typeof reading.risk === 'string' &&
    typeof reading.focus === 'string' &&
    typeof reading.reading === 'string' &&
    typeof reading.context === 'string' &&
    Array.isArray(reading.advice);
}

function toProfile(user: any, fallback?: Partial<UserProfile>): UserProfile {
  return {
    id: user.id,
    name: fallback?.name || user.name || '',
    birthDate: fallback?.birthDate || user.birth_date || '',
    birthTime: fallback?.birthTime || user.birth_time || '12:00',
    birthPlace: fallback?.birthPlace || user.birth_place || '',
    isSetup: user.is_setup ?? true,
    language: (fallback?.language as 'ru' | 'en') || user.language || 'ru',
    theme: (fallback?.theme as 'dark' | 'light') || user.theme || 'dark',
    isPremium: !!user.is_premium,
    isAdmin: !!user.is_admin,
    lumiBalance: user.lumi_balance ?? 0,
    loginStreak: user.login_streak ?? 0,
    chartSlots: user.chart_slots ?? 1,
    generatedContent: fallback?.generatedContent,
  };
}

async function resolveContext(
  userId: string,
  chartId?: number | null,
  profileFallback?: Partial<UserProfile>,
  chartDataFallback?: NatalChartData | null
) {
  const user = await db.users.get(userId);
  if (!user) return null;

  const chart = chartId != null
    ? await db.natal_charts.getById(chartId)
    : await db.natal_charts.getPrimary(userId);

  const chartData = (chartDataFallback || chart?.chart_data || null) as NatalChartData | null;
  return {
    user,
    profile: toProfile(user, profileFallback),
    chartId: chart?.id ?? null,
    chartData,
  };
}

async function getSavedPersonalForecast(
  userId: string,
  chartId: number | null,
  dateKey: string
): Promise<ForecastDailyReading | null> {
  const existing = await getContentLayer({
    userId,
    chartId,
    accessTier: 'free',
    contentSurface: 'forecast',
    contentVariant: 'daily',
    cacheKey: dateKey,
  }).catch((error: any) => {
    console.warn('[API/content/today/overview] personal forecast cache read failed:', error?.message || error);
    return { interpretation: null } as Awaited<ReturnType<typeof getContentLayer>>;
  });

  if (isForecastDailyReading(existing.interpretation?.content)) {
    return existing.interpretation.content as ForecastDailyReading;
  }

  return null;
}

async function generateAndPersistPersonalForecast(
  userId: string,
  chartId: number | null,
  profile: UserProfile,
  chartData: NatalChartData,
  dateKey: string
): Promise<ForecastDailyReading> {
  const existing = await getSavedPersonalForecast(userId, chartId, dateKey);
  if (existing) {
    return existing;
  }

  const forecast = await generateFreeDailyForecast(profile, chartData, dateKey, {
    allowStaticFallback: true,
  });
  const { modelTier } = await getOpenAIModelForContent({
    accessTier: 'free',
    contentSurface: 'forecast',
    contentVariant: 'daily',
  }).catch(() => ({ modelTier: 'base' as const }));

  const data = {
    accessTier: 'free' as const,
    contentSurface: 'forecast' as const,
    contentVariant: 'daily' as const,
    cacheKey: dateKey,
    inputHash: dateKey,
    content: forecast,
    modelTier,
    validFrom: `${dateKey}T00:00:00.000Z`,
    validTo: `${dateKey}T23:59:59.999Z`,
    isPersistent: false,
    canRegenerateForLumi: false,
    legacySource: 'today_overview.forecast_daily',
  };

  try {
    if (chartId != null) {
      await db.content_interpretations.upsertByChart(chartId, data, userId);
    } else {
      await db.content_interpretations.upsertByUser(userId, data);
    }
  } catch (error: any) {
    console.warn('[API/content/today/overview] personal forecast cache write failed:', error?.message || error);
  }

  return forecast;
}

function readDate(req: NextApiRequest): string {
  const raw = String((req.method === 'GET' ? req.query.date : req.body?.date) || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getMoscowTodayKey();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = String((req.method === 'GET' ? req.query.userId : req.body?.userId) || '').trim();
  const chartIdRaw = req.method === 'GET' ? req.query.chartId : req.body?.chartId;
  const chartId = typeof chartIdRaw === 'string'
    ? Number.parseInt(chartIdRaw, 10)
    : typeof chartIdRaw === 'number'
      ? chartIdRaw
      : null;
  const dateKey = readDate(req);

  const languageFromRequest = req.method === 'POST' && req.body?.profile?.language === 'en' ? 'en' : 'ru';
  if (!isValidUserId(userId)) {
    return res.status(400).json(invalidUserIdPayload(languageFromRequest));
  }

  try {
    const context = await resolveContext(
      userId,
      Number.isFinite(chartId as number) ? chartId : null,
      req.method === 'POST' ? req.body?.profile : undefined,
      req.method === 'POST' ? req.body?.chartData : undefined
    );

    if (!context) {
      return res.status(404).json({ error: 'USER_NOT_FOUND', message: 'Profile not found' });
    }

    if (!context.chartData) {
      return res.status(409).json({
        error: 'CHART_REQUIRED',
        code: 'CHART_REQUIRED',
        message: context.profile.language === 'ru'
          ? 'Для твоего дня нужна сохранённая натальная карта.'
          : 'A saved natal chart is required for your day.',
      });
    }

    const language = context.profile.language === 'en' ? 'en' : 'ru';
    const sign = normalizeZodiacKey(context.chartData.sun?.sign) || 'Aries';
    const [savedPersonalForecast, savedSignHoroscope, rawReactions] = await Promise.all([
      getSavedPersonalForecast(userId, context.chartId, dateKey),
      getCachedSignDailyHoroscope(sign, dateKey, language).catch((error: any) => {
        console.warn('[API/content/today/overview] sign horoscope cache read failed:', error?.message || error);
        return null;
      }),
      db.horoscope_reactions.getSummary(userId, sign, dateKey).catch(() => null),
    ]);

    if (savedPersonalForecast && savedSignHoroscope) {
      const overview = await buildTodayOverview({
        profileLanguage: language,
        chartData: context.chartData,
        dateKey,
        personalForecast: savedPersonalForecast,
        signHoroscope: savedSignHoroscope,
        reactions: hydrateReactionSummaryLabels(rawReactions, language),
      });

      return res.status(200).json({
        status: 'ready',
        overview,
        chartId: context.chartId,
        source: 'today_overview_v1',
      });
    }

    const lockKey = LockKeys.todayOverview(userId, context.chartId, dateKey);
    if (!tryAcquireLock(lockKey, 'today-overview-generation')) {
      return res.status(202).json({
        status: 'generating',
        code: 'GENERATION_IN_PROGRESS',
        retryAfterMs: GENERATION_RETRY_AFTER_MS,
        chartId: context.chartId,
      });
    }

    try {
      const [personalForecast, signHoroscope, latestReactions] = await Promise.all([
        savedPersonalForecast
          ? Promise.resolve(savedPersonalForecast)
          : generateAndPersistPersonalForecast(userId, context.chartId, context.profile, context.chartData, dateKey),
        savedSignHoroscope
          ? Promise.resolve(savedSignHoroscope)
          : getOrGenerateSignDailyHoroscope(sign, dateKey, language, {
              allowStaticFallback: true,
              requirePersistence: false,
            }).catch((error: any) => {
              console.warn('[API/content/today/overview] sign horoscope generation failed:', error?.message || error);
              return buildSignDailyFallback(sign, dateKey, language);
            }),
        db.horoscope_reactions.getSummary(userId, sign, dateKey).catch(() => null),
      ]);

      const overview = await buildTodayOverview({
        profileLanguage: language,
        chartData: context.chartData,
        dateKey,
        personalForecast,
        signHoroscope,
        reactions: hydrateReactionSummaryLabels(latestReactions, language),
      });

      return res.status(200).json({
        status: 'ready',
        overview,
        chartId: context.chartId,
        source: savedPersonalForecast && savedSignHoroscope ? 'cache' : 'generated_or_fallback',
      });
    } finally {
      releaseLock(lockKey);
    }
  } catch (error: any) {
    console.error('[API/content/today/overview]', error?.message || error);
    const status = error?.status === 503 ? 503 : 500;
    const code = error?.code || (status === 503 ? 'CONTENT_GENERATION_UNAVAILABLE' : 'TODAY_OVERVIEW_FAILED');
    return res.status(status).json({
      error: code,
      code,
      message:
        status === 503
          ? 'Сегодняшняя интерпретация временно недоступна.'
          : 'Не удалось собрать сегодняшний разбор.',
    });
  }
}
