import type { NextApiRequest, NextApiResponse } from 'next';
import type { NatalChartData, UserProfile } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { db } from '../../../../lib/db';
import { generatePremiumMonthlyForecast } from '../../../../lib/forecastContent';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import {
  buildContentGenerationLockKey,
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';
import { getContentAccessConfig } from '../../../../lib/contentAccessMatrix';
import { logContentApi, warnContentApi } from '../../../../lib/contentApiLogging';
import {
  formatMonthPeriodLabel,
  getMoscowMonthKey,
  isValidMoscowMonthKey,
  monthKeyToValidRangeUtc,
} from '../../../../lib/date-utils';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../../lib/adminAuth';

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
    loginStreak: user.login_streak ?? 0,
    chartSlots: user.chart_slots ?? 1,
    generatedContent: fallback?.generatedContent,
  };
}

async function resolveContext(userId: string, chartId?: number | null, profileFallback?: Partial<UserProfile>, chartDataFallback?: NatalChartData | null) {
  const user = await db.users.get(userId);
  if (!user) return null;

  const chart = chartId != null
    ? await db.natal_charts.getById(chartId)
    : await db.natal_charts.getPrimary(userId);

  if (!chart?.chart_data && !chartDataFallback) {
    return { user, profile: toProfile(user, profileFallback), chartId: chart?.id ?? null, chartData: null };
  }

  return {
    user,
    profile: toProfile(user, profileFallback),
    chartId: chart?.id ?? null,
    chartData: (chartDataFallback || chart?.chart_data || null) as NatalChartData | null,
  };
}

function parsePeriodKey(req: NextApiRequest): string {
  const raw = req.method === 'GET' ? req.query.period : req.body?.period;
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (s && isValidMoscowMonthKey(s)) return s;
  return getMoscowMonthKey();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startedAt = Date.now();
  const scope = 'forecast-monthly';
  const userId = (req.method === 'GET' ? req.query.userId : req.body?.userId) as string | undefined;
  const chartIdRaw = req.method === 'GET' ? req.query.chartId : req.body?.chartId;
  const chartId = typeof chartIdRaw === 'string'
    ? Number.parseInt(chartIdRaw, 10)
    : typeof chartIdRaw === 'number'
      ? chartIdRaw
      : null;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!userId?.trim()) {
    return res.status(400).json({ error: 'Bad request', message: 'userId is required' });
  }
  try {
    requireTelegramUserId(req, userId.trim());
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

  const periodKey = parsePeriodKey(req);

  const context = await resolveContext(
    userId.trim(),
    Number.isFinite(chartId as number) ? chartId : null,
    req.method === 'POST' ? req.body?.profile : undefined,
    req.method === 'POST' ? req.body?.chartData : undefined
  );

  if (!context) {
    return res.status(404).json({ error: 'User not found', message: 'Profile not found' });
  }

  if (!context.chartData) {
    return res.status(409).json({
      error: 'PRIMARY_CHART_MISSING',
      message: context.profile.language === 'ru'
        ? 'Для прогноза нужна сохранённая натальная карта.'
        : 'A saved natal chart is required for the forecast.',
    });
  }

  const chartData = context.chartData;

  const entitlement = await getPremiumEntitlementState(userId.trim());
  const lang = context.profile.language === 'en' ? 'en' : 'ru';
  const periodLabel = formatMonthPeriodLabel(periodKey, lang);
  const { validFrom, validTo } = monthKeyToValidRangeUtc(periodKey);

  const accessTier = 'premium' as const;
  const accessConfig = getContentAccessConfig('forecast', 'monthly');

  logContentApi(
    {
      scope,
      userId: userId.trim(),
      chartId: context.chartId,
      surface: 'forecast',
      variant: 'monthly',
    },
    'request_start',
    { metadata: { periodKey, method: req.method } }
  );

  logContentApi(
    {
      scope,
      userId: userId.trim(),
      chartId: context.chartId,
      surface: 'forecast',
      variant: 'monthly',
    },
    'access_check',
    {
      accessTier,
      metadata: {
        isPremium: entitlement.isPremium,
        matrixDefault: accessConfig?.defaultAccessTier,
        matrixEnforced: true,
      },
    }
  );

  if (!entitlement.isPremium) {
    warnContentApi(
      {
        scope,
        userId: userId.trim(),
        chartId: context.chartId,
        surface: 'forecast',
        variant: 'monthly',
      },
      'premium_required',
      { errorCode: 'PREMIUM_REQUIRED', metadata: { periodKey } }
    );
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      message: context.profile.language === 'ru'
        ? 'Monthly forecast is available in Premium.'
        : 'The full monthly forecast is available in Premium.',
    });
  }

  if (req.method === 'GET') {
    const result = await getContentLayer({
      userId: userId.trim(),
      chartId: context.chartId,
      accessTier,
      contentSurface: 'forecast',
      contentVariant: 'monthly',
      cacheKey: periodKey,
    });

    if (!result.interpretation) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        code: accessTier === 'premium' ? 'FORECAST_MONTHLY_PREMIUM_NOT_FOUND' : 'FORECAST_MONTHLY_FREE_NOT_FOUND',
        message: context.profile.language === 'ru'
          ? 'Прогноз на этот месяц пока не найден.'
          : 'No monthly forecast was found for this period.',
        periodKey,
      });
    }

    logContentApi(
      {
        scope,
        userId: userId.trim(),
        chartId: context.chartId,
        surface: 'forecast',
        variant: 'monthly',
      },
      'cache_hit',
      {
        accessTier,
        status: 'ready',
        durationMs: Date.now() - startedAt,
        metadata: { periodKey },
      }
    );

    return res.status(200).json({
      interpretation: result.interpretation,
      source: result.source,
      chartId: result.chartId,
      cacheKey: result.cacheKey,
      periodKey,
      entitlement: entitlement.entitlement,
    });
  }

  const requestedTier = accessTier;

  if (requestedTier === 'premium' && !entitlement.isPremium) {
    warnContentApi(
      {
        scope,
        userId: userId.trim(),
        chartId: context.chartId,
        surface: 'forecast',
        variant: 'monthly',
      },
      'unlock_required',
      { errorCode: 'PREMIUM_REQUIRED', metadata: { periodKey } }
    );
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      message: context.profile.language === 'ru'
        ? 'Полный месячный прогноз доступен в Premium.'
        : 'The full monthly forecast is available in Premium.',
    });
  }

  const tierToGenerate = accessTier;

  const existing = await getContentLayer({
    userId: userId.trim(),
    chartId: context.chartId,
    accessTier: tierToGenerate,
    contentSurface: 'forecast',
    contentVariant: 'monthly',
    cacheKey: periodKey,
  });

  if (existing.interpretation) {
    logContentApi(
      {
        scope,
        userId: userId.trim(),
        chartId: context.chartId,
        surface: 'forecast',
        variant: 'monthly',
      },
      'cache_hit',
      {
        accessTier: tierToGenerate,
        status: 'ready',
        durationMs: Date.now() - startedAt,
        metadata: { periodKey },
      }
    );
    return res.status(200).json({
      interpretation: existing.interpretation,
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
      periodKey,
      entitlement: entitlement.entitlement,
    });
  }

  logContentApi(
    {
      scope,
      userId: userId.trim(),
      chartId: context.chartId,
      surface: 'forecast',
      variant: 'monthly',
    },
    'generation_start',
    { accessTier: tierToGenerate, metadata: { periodKey } }
  );

  const lockResult = await withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({
      userId: userId.trim(),
      chartId: context.chartId,
      accessTier: tierToGenerate,
      contentSurface: 'forecast',
      contentVariant: 'monthly',
      cacheKey: periodKey,
    }),
    operation: 'forecast-monthly-generation',
    readCached: async () => {
      const layer = await getContentLayer({
        userId: userId.trim(),
        chartId: context.chartId,
        accessTier: tierToGenerate,
        contentSurface: 'forecast',
        contentVariant: 'monthly',
        cacheKey: periodKey,
      });
      return layer.interpretation
        ? { value: layer.interpretation, source: layer.source }
        : null;
    },
    generate: async () => {
      const forecast = await generatePremiumMonthlyForecast(context.profile, chartData, periodKey, periodLabel);
      const { modelTier } = await getOpenAIModelForContent({
        accessTier: tierToGenerate,
        contentSurface: 'forecast',
        contentVariant: 'monthly',
      });

      return context.chartId != null
        ? await db.content_interpretations.upsertByChart(context.chartId, {
            accessTier: tierToGenerate,
            contentSurface: 'forecast',
            contentVariant: 'monthly',
            cacheKey: periodKey,
            inputHash: periodKey,
            content: forecast,
            modelTier,
            validFrom,
            validTo,
            isPersistent: false,
            legacySource: `forecast_v2.monthly.${tierToGenerate}`,
          }, userId.trim())
        : await db.content_interpretations.upsertByUser(userId.trim(), {
            accessTier: tierToGenerate,
            contentSurface: 'forecast',
            contentVariant: 'monthly',
            cacheKey: periodKey,
            inputHash: periodKey,
            content: forecast,
            modelTier,
            validFrom,
            validTo,
            isPersistent: false,
            legacySource: `forecast_v2.monthly.${tierToGenerate}`,
          });
    },
  });

  if (lockResult.status === 'in_progress') {
    return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
  }

  logContentApi(
    {
      scope,
      userId: userId.trim(),
      chartId: context.chartId,
      surface: 'forecast',
      variant: 'monthly',
    },
    lockResult.fromCache ? 'cache_hit' : 'generation_success',
    {
      accessTier: tierToGenerate,
      status: 'ready',
      durationMs: Date.now() - startedAt,
      metadata: { periodKey },
    }
  );

  return res.status(200).json({
    interpretation: lockResult.value,
    source: lockResult.fromCache ? (lockResult.source || 'content_v1') : 'generated',
    chartId: context.chartId,
    cacheKey: periodKey,
    periodKey,
    entitlement: entitlement.entitlement,
  });
}
