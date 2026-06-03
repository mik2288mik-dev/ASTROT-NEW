import type { NextApiRequest, NextApiResponse } from 'next';
import type { ForecastDaypartSlot, NatalChartData, UserProfile } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import {
  buildContentGenerationLockKey,
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';
import { db } from '../../../../lib/db';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import { generatePremiumDaypartForecast } from '../../../../lib/forecastContent';
import {
  buildForecastDaypartCacheKey,
  buildForecastFullDayUnlockCacheKey,
} from '../../../../lib/forecastFullDay';
import { logger } from '../../../../lib/logger';
import { invalidUserIdPayload, isValidUserId } from '../../../../lib/userId';

const ALLOWED_SLOTS = new Set(['morning', 'day', 'evening']);

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
    isPremium: fallback?.isPremium ?? !!user.is_premium,
    isAdmin: !!user.is_admin,
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

function getLockedMessage(lang: 'ru' | 'en') {
  return lang === 'ru'
    ? 'Полный слой дня доступен в Lumia Premium.'
    : 'The full day layer is available in Lumia Premium.';
}

type ResolvedAccess = {
  accessTier: 'premium';
  entitlement: Awaited<ReturnType<typeof getPremiumEntitlementState>>['entitlement'];
};

async function resolveAccess(userId: string, profile?: { isPremium?: boolean }): Promise<ResolvedAccess | null> {
  const entitlementState = await getPremiumEntitlementState(userId);

  if (!entitlementState.isPremium && !profile?.isPremium) {
    logger.warn({
      scope: 'forecast-daypart',
      event: 'premium_required',
      userId,
      surface: 'forecast',
      status: 'denied',
    });
    return null;
  }

  return {
    accessTier: 'premium',
    entitlement: entitlementState.entitlement,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = (req.method === 'GET' ? req.query.userId : req.body?.userId) as string | undefined;
  const chartIdRaw = req.method === 'GET' ? req.query.chartId : req.body?.chartId;
  const chartId = typeof chartIdRaw === 'string'
    ? Number.parseInt(chartIdRaw, 10)
    : typeof chartIdRaw === 'number'
      ? chartIdRaw
      : null;
  const slotValue = (req.method === 'GET' ? req.query.slot : req.body?.slot) as string | undefined;
  const slot = (slotValue || '').trim() as ForecastDaypartSlot;
  const dateKey = req.method === 'GET'
    ? (typeof req.query.date === 'string' && req.query.date.trim() ? req.query.date.trim() : getMoscowTodayKey())
    : (typeof req.body?.date === 'string' && req.body.date.trim() ? req.body.date.trim() : getMoscowTodayKey());

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const languageFromRequest = req.method === 'POST' && req.body?.profile?.language === 'en' ? 'en' : 'ru';
  if (!isValidUserId(userId)) {
    return res.status(400).json(invalidUserIdPayload(languageFromRequest));
  }
  const safeUserId = String(userId).trim();

  if (!slot) {
    return res.status(400).json({ error: 'Bad request', message: 'slot is required' });
  }

  if (!ALLOWED_SLOTS.has(slot)) {
    return res.status(400).json({ error: 'Bad request', message: 'slot must be one of morning, day, evening' });
  }

  const context = await resolveContext(
    safeUserId,
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

  const lang = context.profile.language === 'en' ? 'en' : 'ru';
  buildForecastFullDayUnlockCacheKey(dateKey);
  const cacheKey = buildForecastDaypartCacheKey(dateKey, slot);
  const access = await resolveAccess(safeUserId, context.profile);

  if (!access) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      message: getLockedMessage(lang),
    });
  }

  const existing = await getContentLayer({
    userId: safeUserId,
    chartId: context.chartId,
    accessTier: 'premium',
    contentSurface: 'forecast',
    contentVariant: slot,
    cacheKey,
  });

  if (existing.interpretation) {
    return res.status(200).json({
      interpretation: existing.interpretation,
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
      entitlement: access.entitlement,
      accessTier: access.accessTier,
    });
  }

  if (req.method === 'GET') {
    return res.status(404).json({
      error: 'NOT_FOUND',
      code: 'FORECAST_DAYPART_NOT_FOUND',
      message: lang === 'ru'
        ? 'Полный прогноз на этот отрезок дня пока не подготовлен.'
        : 'The full forecast for this part of the day is not ready yet.',
    });
  }

  let lockResult;
  try {
    lockResult = await withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({
      userId: safeUserId,
      chartId: context.chartId,
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: slot,
      cacheKey,
    }),
    operation: 'forecast-daypart-generation',
    readCached: async () => {
      const layer = await getContentLayer({
        userId: safeUserId,
        chartId: context.chartId,
        accessTier: 'premium',
        contentSurface: 'forecast',
        contentVariant: slot,
        cacheKey,
      });
      return layer.interpretation
        ? { value: layer.interpretation, source: layer.source }
        : null;
    },
    generate: async () => {
      let forecast;
      try {
        forecast = await generatePremiumDaypartForecast(context.profile, chartData, slot, dateKey, {
          allowStaticFallback: false,
        });
      } catch (error: any) {
        const status = error?.status === 503 ? 503 : 500;
        const code = error?.code || (status === 503 ? 'CONTENT_GENERATION_UNAVAILABLE' : 'FORECAST_DAYPART_FAILED');
        const generationError = new Error(code) as Error & { status?: number; code?: string };
        generationError.status = status;
        generationError.code = code;
        throw generationError;
      }

      const { modelTier } = await getOpenAIModelForContent({
        accessTier: 'premium',
        contentSurface: 'forecast',
        contentVariant: slot,
      });

      return context.chartId != null
        ? await db.content_interpretations.upsertByChart(context.chartId, {
            accessTier: 'premium',
            contentSurface: 'forecast',
            contentVariant: slot,
            cacheKey,
            inputHash: cacheKey,
            content: forecast,
            modelTier,
            validFrom: `${dateKey}T00:00:00.000Z`,
            validTo: `${dateKey}T23:59:59.999Z`,
            isPersistent: false,
            canRegenerateForLumi: false,
            legacySource: `forecast_v2.${slot}.premium`,
          }, safeUserId)
        : await db.content_interpretations.upsertByUser(safeUserId, {
            accessTier: 'premium',
            contentSurface: 'forecast',
            contentVariant: slot,
            cacheKey,
            inputHash: cacheKey,
            content: forecast,
            modelTier,
            validFrom: `${dateKey}T00:00:00.000Z`,
            validTo: `${dateKey}T23:59:59.999Z`,
            isPersistent: false,
            canRegenerateForLumi: false,
            legacySource: `forecast_v2.${slot}.premium`,
          });
    },
    });
  } catch (error: any) {
    const status = error?.status === 503 ? 503 : 500;
    const code = error?.code || (status === 503 ? 'CONTENT_GENERATION_UNAVAILABLE' : 'FORECAST_DAYPART_FAILED');
    return res.status(status).json({
      error: code,
      code,
      message:
        lang === 'ru'
          ? 'Этот слой сейчас не удалось сгенерировать. Попробуй ещё раз.'
          : 'This layer could not be generated right now. Please try again.',
    });
  }

  if (lockResult.status === 'in_progress') {
    return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
  }

  return res.status(200).json({
    interpretation: lockResult.value,
    source: lockResult.fromCache ? (lockResult.source || 'content_v1') : 'generated',
    chartId: context.chartId,
    cacheKey,
    entitlement: access.entitlement,
    accessTier: access.accessTier,
  });
}
