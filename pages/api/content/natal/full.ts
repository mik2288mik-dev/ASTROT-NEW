import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentInterpretation, NatalChartData, NatalFullReading, UserProfile } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { db } from '../../../../lib/db';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import {
  buildContentGenerationLockKey,
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';
import { generateNatalFullReading } from '../../../../lib/natalContent';
import {
  coerceNatalFullReading,
  NATAL_FULL_CACHE_KEY,
  NATAL_FULL_PROMPT_VERSION,
} from '../../../../lib/natalReadings';
import { AdminAuthError, handleAdminError, requireTelegramUserId } from '../../../../lib/adminAuth';
import { persistNatalReadingHistory } from '../../../../lib/astrologyHistoryPersistence';

function toProfile(user: any, fallback?: Partial<UserProfile>): UserProfile {
  return {
    id: user.id,
    name: fallback?.name || user.name || '',
    birthDate: fallback?.birthDate || user.birth_date || '',
    birthTime: fallback?.birthTime ?? user.birth_time ?? '',
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

function normalizeInterpretation(
  interpretation: ContentInterpretation | null | undefined,
  language: 'ru' | 'en',
  chartData?: NatalChartData | null
): ContentInterpretation<NatalFullReading> | null {
  if (!interpretation) return null;
  return {
    ...interpretation,
    content: coerceNatalFullReading(interpretation.content, language, chartData),
  };
}

function isCurrentPromptVersion(interpretation: ContentInterpretation | null | undefined) {
  return interpretation?.promptVersion === NATAL_FULL_PROMPT_VERSION;
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
        ? 'Для полной натальной карты нужна сохранённая карта рождения.'
        : 'A saved natal chart is required for the full natal reading.',
    });
  }

  const chartData = context.chartData;

  const entitlement = await getPremiumEntitlementState(userId.trim());
  if (!entitlement.isPremium) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      message: context.profile.language === 'ru'
        ? 'Полная карта открывается после доступа к полной карте.'
        : 'The full natal reading is available after unlocking the full chart.',
    });
  }

  const existing = await getContentLayer({
    userId: userId.trim(),
    chartId: context.chartId,
    accessTier: 'premium',
    contentSurface: 'natal',
    contentVariant: 'full',
    cacheKey: NATAL_FULL_CACHE_KEY,
  });

  if (req.method === 'GET') {
    if (!existing.interpretation || !isCurrentPromptVersion(existing.interpretation)) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        code: existing.interpretation ? 'NATAL_FULL_STALE' : 'NATAL_FULL_NOT_FOUND',
        message: context.profile.language === 'ru'
          ? 'Полная натальная карта ещё не подготовлена в новой версии.'
          : 'The full natal reading is not ready in the current version yet.',
      });
    }

    return res.status(200).json({
      interpretation: normalizeInterpretation(existing.interpretation, context.profile.language, context.chartData),
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
      entitlement: entitlement.entitlement,
    });
  }

  if (existing.interpretation && isCurrentPromptVersion(existing.interpretation)) {
    return res.status(200).json({
      interpretation: normalizeInterpretation(existing.interpretation, context.profile.language, context.chartData),
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
      contentVariant: 'full',
      cacheKey: NATAL_FULL_CACHE_KEY,
      promptVersion: NATAL_FULL_PROMPT_VERSION,
    }),
    operation: 'natal-full-generation',
    readCached: async () => {
      const layer = await getContentLayer({
        userId: userId.trim(),
        chartId: context.chartId,
        accessTier: 'premium',
        contentSurface: 'natal',
        contentVariant: 'full',
        cacheKey: NATAL_FULL_CACHE_KEY,
      });
      if (!layer.interpretation || !isCurrentPromptVersion(layer.interpretation)) {
        return null;
      }
      return { value: layer.interpretation, source: layer.source };
    },
    generate: async () => {
      const reading = await generateNatalFullReading(context.profile, chartData);
      const { model, modelTier } = await getOpenAIModelForContent({
        accessTier: 'premium',
        contentSurface: 'natal',
        contentVariant: 'full',
      });

      if (context.chartId == null) {
        return db.content_interpretations.upsertByUser(userId.trim(), {
          accessTier: 'premium',
          contentSurface: 'natal',
          contentVariant: 'full',
          cacheKey: NATAL_FULL_CACHE_KEY,
          inputHash: NATAL_FULL_CACHE_KEY,
          content: reading,
          modelTier,
          promptVersion: NATAL_FULL_PROMPT_VERSION,
          calculationVersion: chartData.calculationVersion || null,
          isPersistent: true,
          legacySource: 'natal_content_unified_v4',
        });
      }

      const saved = await db.content_interpretations.upsertByChart(context.chartId, {
            accessTier: 'premium',
            contentSurface: 'natal',
            contentVariant: 'full',
            cacheKey: NATAL_FULL_CACHE_KEY,
            inputHash: NATAL_FULL_CACHE_KEY,
            content: reading,
            modelTier,
            promptVersion: NATAL_FULL_PROMPT_VERSION,
            calculationVersion: chartData.calculationVersion || null,
            isPersistent: true,
            legacySource: 'natal_content_unified_v4',
          }, userId.trim());
      await persistNatalReadingHistory({
        userId: userId.trim(),
        chartId: context.chartId,
        chart: chartData,
        rawBirthTime: context.profile.birthTime,
        language: context.profile.language === 'en' ? 'en' : 'ru',
        accessTier: 'premium',
        contentVariant: 'full',
        cacheKey: NATAL_FULL_CACHE_KEY,
        inputHash: NATAL_FULL_CACHE_KEY,
        promptVersion: NATAL_FULL_PROMPT_VERSION,
        content: reading,
        generation: { modelId: model },
      }).catch((error) => {
        console.error('[natal/history] full history append failed:', error);
      });
      return saved;
    },
  });

  if (lockResult.status === 'in_progress') {
    return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
  }

  return res.status(200).json({
    interpretation: normalizeInterpretation(lockResult.value, context.profile.language, context.chartData),
    source: lockResult.fromCache ? (lockResult.source || 'content_v1') : 'generated',
    chartId: context.chartId,
    cacheKey: NATAL_FULL_CACHE_KEY,
    entitlement: entitlement.entitlement,
  });
}
