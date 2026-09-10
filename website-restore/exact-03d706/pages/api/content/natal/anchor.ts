import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentInterpretation, NatalAnchorReading, NatalChartData, UserProfile } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { db } from '../../../../lib/db';
import { resolveNatalContentChartContext, natalContentChartErrorStatus } from '../../../../lib/natalContentChartContext';
import { getContentLayer } from '../../../../lib/contentArchitecture';
import {
  buildContentGenerationLockKey,
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';
import { generateNatalAnchorReading } from '../../../../lib/natalContent';
import {
  coerceNatalAnchorReading,
  NATAL_ANCHOR_CACHE_KEY,
  NATAL_ANCHOR_PROMPT_VERSION,
} from '../../../../lib/natalReadings';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { persistNatalReadingHistory } from '../../../../lib/astrologyHistoryPersistence';
import { buildCanonicalNatalReport, isNatalChartDataV2 } from '../../../../lib/natal/canonicalReport';

function normalizeInterpretation(
  interpretation: ContentInterpretation | null | undefined,
  language: 'ru' | 'en',
  chartData?: NatalChartData | null
): ContentInterpretation<NatalAnchorReading> | null {
  if (!interpretation) return null;
  return {
    ...interpretation,
    content: coerceNatalAnchorReading(interpretation.content, language, chartData),
  };
}

function isCurrentPromptVersion(interpretation: ContentInterpretation | null | undefined) {
  return interpretation?.promptVersion === NATAL_ANCHOR_PROMPT_VERSION;
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
    await requireAppUser(req, { expectedUserId: safeUserId, allowGuest: false });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

  let context: Awaited<ReturnType<typeof resolveNatalContentChartContext>>;
  try {
    context = await resolveNatalContentChartContext(
      safeUserId,
      Number.isFinite(chartId as number) ? chartId : null,
      req.method === 'POST' ? req.body?.profile : undefined,
    );
  } catch (error: any) {
    const status = natalContentChartErrorStatus(error);
    if (status) return res.status(status).json({ error: error.message, code: error.code });
    throw error;
  }

  if (!context) {
    return res.status(404).json({ error: 'User not found', message: 'Profile not found' });
  }

  if (!context.chartData) {
    return res.status(409).json({
      error: 'PRIMARY_CHART_MISSING',
      message: context.profile.language === 'ru'
        ? 'Для натальной карты нужна сохранённая карта рождения.'
        : 'A saved natal chart is required for the natal reading.',
    });
  }

  const chartData = context.chartData;
  const cacheKey = NATAL_ANCHOR_CACHE_KEY + ":natal:" + context.snapshotKey;
  const baseReport = isNatalChartDataV2(chartData) ? buildCanonicalNatalReport(chartData) : undefined;

  const existing = await getContentLayer({
    userId: userId.trim(),
    chartId: context.chartId,
    accessTier: 'free',
    contentSurface: 'natal',
    contentVariant: 'anchor',
    cacheKey,
  });

  if (req.method === 'GET') {
    if (!existing.interpretation || !isCurrentPromptVersion(existing.interpretation)) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        code: existing.interpretation ? 'NATAL_ANCHOR_STALE' : 'NATAL_ANCHOR_NOT_FOUND',
        message: context.profile.language === 'ru'
          ? 'Натальная карта ещё не подготовлена в новой версии.'
          : 'The natal reading is not ready in the current version yet.',
      });
    }

    return res.status(200).json({
      interpretation: normalizeInterpretation(existing.interpretation, context.profile.language, context.chartData),
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
      ...(baseReport ? { baseReport } : {}),
    });
  }

  if (existing.interpretation && isCurrentPromptVersion(existing.interpretation)) {
    return res.status(200).json({
      interpretation: normalizeInterpretation(existing.interpretation, context.profile.language, context.chartData),
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
      ...(baseReport ? { baseReport } : {}),
    });
  }

  const lockResult = await withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({
      userId: userId.trim(),
      chartId: context.chartId,
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'anchor',
      cacheKey,
      promptVersion: NATAL_ANCHOR_PROMPT_VERSION,
    }),
    operation: 'natal-anchor-generation',
    readCached: async () => {
      const layer = await getContentLayer({
        userId: userId.trim(),
        chartId: context.chartId,
        accessTier: 'free',
        contentSurface: 'natal',
        contentVariant: 'anchor',
        cacheKey,
      });
      if (!layer.interpretation || !isCurrentPromptVersion(layer.interpretation)) {
        return null;
      }
      return { value: layer.interpretation, source: layer.source };
    },
    generate: async () => {
      const reading = await generateNatalAnchorReading(context.profile, chartData);
      const { model, modelTier } = await getOpenAIModelForContent({
        accessTier: 'free',
        contentSurface: 'natal',
        contentVariant: 'anchor',
      });

      if (context.chartId == null) {
        return db.content_interpretations.upsertByUser(userId.trim(), {
          accessTier: 'free',
          contentSurface: 'natal',
          contentVariant: 'anchor',
          cacheKey,
          inputHash: cacheKey,
          content: reading,
          modelTier,
          promptVersion: NATAL_ANCHOR_PROMPT_VERSION,
          calculationVersion: chartData.calculationVersion || null,
          isPersistent: true,
          legacySource: 'natal_content_unified_v4',
        });
      }

      const saved = await db.content_interpretations.upsertByChart(context.chartId, {
            accessTier: 'free',
            contentSurface: 'natal',
            contentVariant: 'anchor',
            cacheKey,
            inputHash: cacheKey,
            content: reading,
            modelTier,
            promptVersion: NATAL_ANCHOR_PROMPT_VERSION,
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
        accessTier: 'free',
        contentVariant: 'anchor',
        cacheKey,
        inputHash: cacheKey,
        promptVersion: NATAL_ANCHOR_PROMPT_VERSION,
        content: reading,
        generation: { modelId: model },
      }).catch((error) => {
        console.error('[natal/history] anchor history append failed:', error);
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
    cacheKey,
    ...(baseReport ? { baseReport } : {}),
  });
}
