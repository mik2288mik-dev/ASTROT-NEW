import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentInterpretation, NatalChartData, NatalLivingReading, UserProfile } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { db } from '../../../../lib/db';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import {
  buildContentGenerationLockKey,
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';
import { generateNatalLivingReading } from '../../../../lib/natalContent';
import {
  buildNatalLivingCacheKey,
  coerceNatalLivingReading,
  getCurrentNatalPeriodKey,
  NATAL_LIVING_PROMPT_VERSION,
} from '../../../../lib/natalReadings';
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

  return {
    user,
    profile: toProfile(user, profileFallback),
    chartId: chart?.id ?? null,
    chartData: (chartDataFallback || chart?.chart_data || null) as NatalChartData | null,
  };
}

function getMoscowPeriodWindow(periodKey: string) {
  const [yearPart, monthPart, dayPart] = periodKey.split('-');
  const year = Number.parseInt(yearPart || '', 10);
  const month = Number.parseInt(monthPart || '', 10);
  const day = Number.parseInt(dayPart || '', 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { validFrom: null, validTo: null };
  }

  const startUtc = new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0));
  const endUtc = new Date(Date.UTC(year, month - 1, day + 1, -3, 0, 0, 0));
  return {
    validFrom: startUtc.toISOString(),
    validTo: endUtc.toISOString(),
  };
}

function normalizeInterpretation(
  interpretation: ContentInterpretation | null | undefined,
  language: 'ru' | 'en',
  periodKey: string,
  chartData?: NatalChartData | null
): ContentInterpretation<NatalLivingReading> | null {
  if (!interpretation) return null;
  return {
    ...interpretation,
    content: coerceNatalLivingReading(interpretation.content, language, periodKey, chartData),
  };
}

function isCurrentPromptVersion(interpretation: ContentInterpretation | null | undefined) {
  return interpretation?.promptVersion === NATAL_LIVING_PROMPT_VERSION;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = (req.method === 'GET' ? req.query.userId : req.body?.userId) as string | undefined;
  const chartIdRaw = req.method === 'GET' ? req.query.chartId : req.body?.chartId;
  const chartId = typeof chartIdRaw === 'string'
    ? Number.parseInt(chartIdRaw, 10)
    : typeof chartIdRaw === 'number'
      ? chartIdRaw
      : null;
  const periodKey = req.method === 'GET'
    ? (typeof req.query.periodKey === 'string' && req.query.periodKey.trim() ? req.query.periodKey.trim() : getCurrentNatalPeriodKey())
    : (typeof req.body?.periodKey === 'string' && req.body.periodKey.trim() ? req.body.periodKey.trim() : getCurrentNatalPeriodKey());
  const cacheKey = buildNatalLivingCacheKey(periodKey);

  if (!userId?.trim()) {
    return res.status(400).json({ error: 'Bad request', message: 'userId is required' });
  }
  const safeUserId = userId.trim();
  try {
    requireTelegramUserId(req, safeUserId);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
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
        ? 'Для ежедневной натальной карты нужна сохранённая карта рождения.'
        : 'A saved natal chart is required for the daily natal reading.',
    });
  }

  const chartData = context.chartData;

  const entitlement = await getPremiumEntitlementState(userId.trim());
  if (!entitlement.isPremium) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      message: context.profile.language === 'ru'
        ? 'Ежедневная карта открывается после доступа к полной карте.'
        : 'The daily natal reading is available after unlocking the full chart.',
    });
  }

  const existing = await getContentLayer({
    userId: userId.trim(),
    chartId: context.chartId,
    accessTier: 'premium',
    contentSurface: 'natal',
    contentVariant: 'living',
    cacheKey,
  });

  if (req.method === 'GET') {
    if (!existing.interpretation || !isCurrentPromptVersion(existing.interpretation)) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        code: existing.interpretation ? 'NATAL_LIVING_STALE' : 'NATAL_LIVING_NOT_FOUND',
        message: context.profile.language === 'ru'
          ? 'Ежедневная натальная карта ещё не подготовлена в новой версии.'
          : 'The daily natal reading is not ready in the current version yet.',
      });
    }

    return res.status(200).json({
      interpretation: normalizeInterpretation(existing.interpretation, context.profile.language, periodKey, context.chartData),
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
      entitlement: entitlement.entitlement,
    });
  }

  if (existing.interpretation && isCurrentPromptVersion(existing.interpretation)) {
    return res.status(200).json({
      interpretation: normalizeInterpretation(existing.interpretation, context.profile.language, periodKey, context.chartData),
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
      entitlement: entitlement.entitlement,
    });
  }

  const lockResult = await withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({
      userId: userId.trim(),
      chartId: context.chartId,
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant: 'living',
      cacheKey,
      promptVersion: NATAL_LIVING_PROMPT_VERSION,
    }),
    operation: 'natal-living-generation',
    readCached: async () => {
      const layer = await getContentLayer({
        userId: userId.trim(),
        chartId: context.chartId,
        accessTier: 'premium',
        contentSurface: 'natal',
        contentVariant: 'living',
        cacheKey,
      });
      if (!layer.interpretation || !isCurrentPromptVersion(layer.interpretation)) {
        return null;
      }
      return { value: layer.interpretation, source: layer.source };
    },
    generate: async () => {
      const reading = await generateNatalLivingReading(context.profile, chartData, periodKey);
      const { modelTier } = await getOpenAIModelForContent({
        accessTier: 'premium',
        contentSurface: 'natal',
        contentVariant: 'living',
      });
      const periodWindow = getMoscowPeriodWindow(periodKey);

      return context.chartId != null
        ? await db.content_interpretations.upsertByChart(context.chartId, {
            accessTier: 'premium',
            contentSurface: 'natal',
            contentVariant: 'living',
            cacheKey,
            inputHash: cacheKey,
            content: reading,
            modelTier,
            promptVersion: NATAL_LIVING_PROMPT_VERSION,
            calculationVersion: chartData.calculationVersion || null,
            validFrom: periodWindow.validFrom,
            validTo: periodWindow.validTo,
            isPersistent: false,
            legacySource: 'natal_content_unified_v3',
          }, userId.trim())
        : await db.content_interpretations.upsertByUser(userId.trim(), {
            accessTier: 'premium',
            contentSurface: 'natal',
            contentVariant: 'living',
            cacheKey,
            inputHash: cacheKey,
            content: reading,
            modelTier,
            promptVersion: NATAL_LIVING_PROMPT_VERSION,
            calculationVersion: chartData.calculationVersion || null,
            validFrom: periodWindow.validFrom,
            validTo: periodWindow.validTo,
            isPersistent: false,
            legacySource: 'natal_content_unified_v3',
          });
    },
  });

  if (lockResult.status === 'in_progress') {
    return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
  }

  return res.status(200).json({
    interpretation: normalizeInterpretation(lockResult.value, context.profile.language, periodKey, context.chartData),
    source: lockResult.fromCache ? (lockResult.source || 'content_v1') : 'generated',
    chartId: context.chartId,
    cacheKey,
    entitlement: entitlement.entitlement,
  });
}
