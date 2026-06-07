import type { NextApiRequest, NextApiResponse } from 'next';
import type { ForecastDaypartReading, ForecastDaypartSlot, NatalChartData, UserProfile } from '../../../../types';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import {
  buildContentGenerationLockKey,
  type ContentGenerationLockResult,
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';
import { db } from '../../../../lib/db';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import { buildPremiumDaypartFallback, generatePremiumDaypartForecast } from '../../../../lib/forecastContent';
import {
  buildForecastDaypartCacheKey,
  buildForecastFullDayUnlockCacheKey,
} from '../../../../lib/forecastFullDay';
import { logger } from '../../../../lib/logger';
import { invalidUserIdPayload, isValidUserId } from '../../../../lib/userId';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../../lib/adminAuth';

const ALLOWED_SLOTS = new Set(['morning', 'day', 'evening']);

type DaypartResponseSource = 'content_v1' | 'generated' | 'fallback' | 'fallback_unsaved';
type DaypartPersistenceStatus = 'saved' | 'failed';

function isUsableDaypartReading(value: unknown): value is ForecastDaypartReading {
  if (!value || typeof value !== 'object') return false;
  const reading = value as Partial<ForecastDaypartReading>;
  return (
    typeof reading.headline === 'string' &&
    reading.headline.trim().length > 0 &&
    typeof reading.summary === 'string' &&
    reading.summary.trim().length > 0
  );
}

function buildUnsavedDaypartInterpretation(input: {
  userId: string;
  chartId: number | null;
  slot: ForecastDaypartSlot;
  cacheKey: string;
  dateKey: string;
  content: ForecastDaypartReading;
}) {
  return {
    id: 0,
    userId: input.userId,
    chartId: input.chartId,
    accessTier: 'premium' as const,
    contentSurface: 'forecast' as const,
    contentVariant: input.slot,
    modelTier: 'premium' as const,
    cacheKey: input.cacheKey,
    inputHash: input.cacheKey,
    content: input.content,
    promptVersion: null,
    calculationVersion: null,
    validFrom: `${input.dateKey}T00:00:00.000Z`,
    validTo: `${input.dateKey}T23:59:59.999Z`,
    isPersistent: false,
    canRegenerateForLumi: false,
    regenerationCostLumi: null,
    legacySource: `forecast_v2.${input.slot}.premium`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
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

  if (!entitlementState.isPremium) {
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
  try {
    requireTelegramUserId(req, safeUserId);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

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

  const fallback = buildPremiumDaypartFallback(context.profile, dateKey, slot);
  const unsavedFallback = () => buildUnsavedDaypartInterpretation({
    userId: safeUserId,
    chartId: context.chartId,
    slot,
    cacheKey,
    dateKey,
    content: fallback,
  });
  const saveDaypartReading = async (content: ForecastDaypartReading) => {
    const payload = {
      accessTier: 'premium' as const,
      contentSurface: 'forecast' as const,
      contentVariant: slot,
      cacheKey,
      inputHash: cacheKey,
      content,
      modelTier: 'premium' as const,
      validFrom: `${dateKey}T00:00:00.000Z`,
      validTo: `${dateKey}T23:59:59.999Z`,
      isPersistent: false,
      canRegenerateForLumi: false,
      legacySource: `forecast_v2.${slot}.premium`,
    };
    return context.chartId != null
      ? db.content_interpretations.upsertByChart(context.chartId, payload, safeUserId)
      : db.content_interpretations.upsertByUser(safeUserId, payload);
  };

  let existing: Awaited<ReturnType<typeof getContentLayer>> | null = null;
  let cacheReadFailed = false;
  try {
    existing = await getContentLayer({
      userId: safeUserId,
      chartId: context.chartId,
      accessTier: 'premium',
      contentSurface: 'forecast',
      contentVariant: slot,
      cacheKey,
    });
  } catch (error: any) {
    cacheReadFailed = true;
    logger.warn({
      scope: 'forecast-daypart',
      event: 'cache_read_failed',
      userId: safeUserId,
      chartId: context.chartId,
      status: 'failed',
      errorCode: error?.message || 'CACHE_READ_FAILED',
      metadata: { slot, dateKey },
    });
  }

  const existingInterpretation = existing?.interpretation ?? null;
  const cached = existingInterpretation && isUsableDaypartReading((existingInterpretation as any).content)
    ? existing
    : null;

  if (existingInterpretation && !cached) {
    logger.warn({
      scope: 'forecast-daypart',
      event: 'invalid_cached_row',
      userId: safeUserId,
      chartId: context.chartId,
      status: 'failed',
      errorCode: 'EMPTY_INTERPRETATION',
      metadata: { slot, dateKey, cacheKey },
    });
  } else if (!cached && !cacheReadFailed) {
    logger.info({
      scope: 'forecast-daypart',
      event: 'cache_miss',
      userId: safeUserId,
      chartId: context.chartId,
      metadata: { slot, dateKey, cacheKey },
    });
  }

  if (cacheReadFailed) {
    logger.warn({
      scope: 'forecast-daypart',
      event: 'persistence_failed',
      userId: safeUserId,
      chartId: context.chartId,
      status: 'ready',
      errorCode: 'CACHE_READ_FAILED',
      metadata: { slot, dateKey, source: 'fallback_unsaved' },
    });
    return res.status(200).json({
      interpretation: unsavedFallback(),
      source: 'fallback_unsaved' satisfies DaypartResponseSource,
      persistenceStatus: 'failed' satisfies DaypartPersistenceStatus,
      chartId: context.chartId,
      cacheKey,
      entitlement: access.entitlement,
      accessTier: access.accessTier,
    });
  }

  if (cached?.interpretation) {
    logger.info({
      scope: 'forecast-daypart',
      event: 'cache_hit',
      userId: safeUserId,
      chartId: context.chartId,
      status: 'ready',
      metadata: { slot, dateKey, cacheKey },
    });
    return res.status(200).json({
      interpretation: cached.interpretation,
      source: cached.source,
      persistenceStatus: 'saved' satisfies DaypartPersistenceStatus,
      chartId: cached.chartId,
      cacheKey: cached.cacheKey,
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

  let lockResult: ContentGenerationLockResult<any>;
  let generatedSource: DaypartResponseSource = 'generated';
  let generatedPersistenceStatus: DaypartPersistenceStatus = 'saved';
  try {
    let lockCacheReadFailed = false;
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
        let layer: Awaited<ReturnType<typeof getContentLayer>> | null = null;
        try {
          layer = await getContentLayer({
            userId: safeUserId,
            chartId: context.chartId,
            accessTier: 'premium',
            contentSurface: 'forecast',
            contentVariant: slot,
            cacheKey,
          });
        } catch (error: any) {
          lockCacheReadFailed = true;
          logger.warn({
            scope: 'forecast-daypart',
            event: 'cache_read_failed',
            userId: safeUserId,
            chartId: context.chartId,
            status: 'failed',
            errorCode: error?.message || 'CACHE_READ_FAILED',
            metadata: { slot, dateKey, phase: 'inside_lock' },
          });
          return null;
        }
        if (layer.interpretation && !isUsableDaypartReading((layer.interpretation as any).content)) {
          logger.warn({
            scope: 'forecast-daypart',
            event: 'invalid_cached_row',
            userId: safeUserId,
            chartId: context.chartId,
            status: 'failed',
            errorCode: 'EMPTY_INTERPRETATION',
            metadata: { slot, dateKey, phase: 'inside_lock' },
          });
        }
        return layer.interpretation && isUsableDaypartReading((layer.interpretation as any).content)
          ? { value: layer.interpretation, source: layer.source }
          : null;
      },
      generate: async () => {
        if (lockCacheReadFailed) {
          generatedSource = 'fallback_unsaved';
          generatedPersistenceStatus = 'failed';
          logger.warn({
            scope: 'forecast-daypart',
            event: 'persistence_failed',
            userId: safeUserId,
            chartId: context.chartId,
            status: 'ready',
            errorCode: 'CACHE_READ_FAILED_INSIDE_LOCK',
            metadata: { slot, dateKey, source: 'fallback_unsaved' },
          });
          return unsavedFallback() as any;
        }

        let savedFallback;
        try {
          savedFallback = await saveDaypartReading(fallback);
          generatedSource = 'fallback';
          generatedPersistenceStatus = 'saved';
          logger.info({
            scope: 'forecast-daypart',
            event: 'fallback_saved',
            userId: safeUserId,
            chartId: context.chartId,
            status: 'ready',
            metadata: { slot, dateKey },
          });
        } catch (error: any) {
          generatedSource = 'fallback_unsaved';
          generatedPersistenceStatus = 'failed';
          logger.warn({
            scope: 'forecast-daypart',
            event: 'persistence_failed',
            userId: safeUserId,
            chartId: context.chartId,
            status: 'ready',
            errorCode: error?.message || 'FALLBACK_SAVE_FAILED',
            metadata: { slot, dateKey, source: 'fallback_unsaved' },
          });
          return unsavedFallback() as any;
        }

        try {
          const forecast = await generatePremiumDaypartForecast(context.profile, chartData, slot, dateKey, {
            allowStaticFallback: false,
          });
          if (!isUsableDaypartReading(forecast)) {
            throw new Error('EMPTY_FORECAST_DAYPART');
          }
          const savedGenerated = await saveDaypartReading(forecast);
          generatedSource = 'generated';
          generatedPersistenceStatus = 'saved';
          logger.info({
            scope: 'forecast-daypart',
            event: 'generation_saved',
            userId: safeUserId,
            chartId: context.chartId,
            status: 'ready',
            metadata: { slot, dateKey },
          });
          return savedGenerated;
        } catch (error: any) {
          generatedSource = 'fallback';
          generatedPersistenceStatus = 'saved';
          logger.warn({
            scope: 'forecast-daypart',
            event: 'generation_failed',
            userId: safeUserId,
            chartId: context.chartId,
            status: 'ready',
            errorCode: error?.code || error?.message || 'FORECAST_DAYPART_FAILED',
            metadata: { slot, dateKey },
          });
          return savedFallback;
        }
      },
    });
  } catch (error: any) {
    generatedSource = 'fallback_unsaved';
    generatedPersistenceStatus = 'failed';
    logger.warn({
      scope: 'forecast-daypart',
      event: 'persistence_failed',
      userId: safeUserId,
      chartId: context.chartId,
      status: 'ready',
      errorCode: error?.code || error?.message || 'LOCK_OR_FALLBACK_FLOW_FAILED',
      metadata: { slot, dateKey, source: 'fallback_unsaved' },
    });
    lockResult = {
      status: 'ready',
      value: unsavedFallback(),
      fromCache: false,
    };
  }

  if (lockResult.status === 'in_progress') {
    return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
  }

  return res.status(200).json({
    interpretation: lockResult.value,
    source: lockResult.fromCache ? (lockResult.source || 'content_v1') : generatedSource,
    persistenceStatus: lockResult.fromCache ? 'saved' : generatedPersistenceStatus,
    chartId: context.chartId,
    cacheKey,
    entitlement: access.entitlement,
    accessTier: access.accessTier,
  });
}
