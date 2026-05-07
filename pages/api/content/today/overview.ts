import type { NextApiRequest, NextApiResponse } from 'next';
import type { ForecastDailyReading, NatalChartData, UserProfile } from '../../../../types';
import { db } from '../../../../lib/db';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { getContentLayer } from '../../../../lib/contentArchitecture';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import { generateFreeDailyForecast } from '../../../../lib/forecastContent';
import { getOrGenerateSignDailyHoroscope, normalizeZodiacKey } from '../../../../lib/horoscope/signDaily';
import { buildTodayOverview, hydrateReactionSummaryLabels } from '../../../../lib/todayOverview';

export const config = { maxDuration: 90 };

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

async function getOrCreatePersonalForecast(
  userId: string,
  chartId: number | null,
  profile: UserProfile,
  chartData: NatalChartData,
  dateKey: string
): Promise<ForecastDailyReading> {
  const existing = await getContentLayer({
    userId,
    chartId,
    accessTier: 'free',
    contentSurface: 'forecast',
    contentVariant: 'daily',
    cacheKey: dateKey,
  });

  if (existing.interpretation?.content) {
    return existing.interpretation.content as ForecastDailyReading;
  }

  const forecast = await generateFreeDailyForecast(profile, chartData, dateKey);
  const { modelTier } = await getOpenAIModelForContent({
    accessTier: 'free',
    contentSurface: 'forecast',
    contentVariant: 'daily',
  });

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

  if (chartId != null) {
    await db.content_interpretations.upsertByChart(chartId, data, userId);
  } else {
    await db.content_interpretations.upsertByUser(userId, data);
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

  if (!userId) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'userId is required' });
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
        error: 'PRIMARY_CHART_MISSING',
        message: context.profile.language === 'ru'
          ? 'Для твоего дня нужна сохранённая натальная карта.'
          : 'A saved natal chart is required for your day.',
      });
    }

    const language = context.profile.language === 'en' ? 'en' : 'ru';
    const sign = normalizeZodiacKey(context.chartData.sun?.sign) || 'Aries';
    const [personalForecast, signHoroscope, rawReactions] = await Promise.all([
      getOrCreatePersonalForecast(userId, context.chartId, context.profile, context.chartData, dateKey),
      getOrGenerateSignDailyHoroscope(sign, dateKey, language),
      db.horoscope_reactions.getSummary(userId, sign, dateKey).catch(() => null),
    ]);

    const overview = await buildTodayOverview({
      profileLanguage: language,
      chartData: context.chartData,
      dateKey,
      personalForecast,
      signHoroscope,
      reactions: hydrateReactionSummaryLabels(rawReactions, language),
    });

    return res.status(200).json({
      overview,
      chartId: context.chartId,
      source: 'today_overview_v1',
    });
  } catch (error: any) {
    console.error('[API/content/today/overview]', error?.message || error);
    return res.status(500).json({ error: 'TODAY_OVERVIEW_FAILED', message: error?.message || 'Failed' });
  }
}
