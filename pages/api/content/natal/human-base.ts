import type { NextApiRequest, NextApiResponse } from 'next';
import type { NatalInterpretationReport } from '../../../../types';
import {
  ensureValidContext,
  getCachedReading,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import {
  buildHumanBaseFallback,
  buildHumanInputHash,
  generateHumanBaseReport,
} from '../../../../lib/natalHumanInterpretation';
import {
  HUMAN_BASE_CACHE_KEY,
  HUMAN_BASE_PROMPT_VERSION,
} from '../../../../lib/natalHumanShared';
import {
  buildContentGenerationLockKey,
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';

export const config = { maxDuration: 90 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ready = await ensureValidContext(req, res, { allowGuest: true });
  if (!ready) return;
  const { userId, ctx } = ready;
  const previewModel = req.method === 'POST' ? String(req.body?.previewModel || '').trim() : '';
  const isPreview = previewModel === 'deepseek-v4-flash' || previewModel === 'gpt-5.6-luna';
  if (previewModel && !isPreview) return res.status(400).json({ error: 'Invalid preview model', code: 'PREVIEW_MODEL_INVALID' });
  if (isPreview && !ctx.profile.isAdmin) return res.status(403).json({ error: 'Admin preview only', code: 'PREVIEW_FORBIDDEN' });
  if (isPreview) {
    try {
      let metrics = { model: previewModel, inputTokens: 0, outputTokens: 0, latencyMs: 0, validationPassed: false };
      const report = await generateHumanBaseReport(ctx.profile, ctx.chartData!, {
        modelOverride: previewModel,
        onMetrics: (next) => { metrics = { ...metrics, ...next }; },
        onValidation: (validationPassed) => { metrics.validationPassed = validationPassed; },
      });
      return res.status(200).json({ interpretation: report, source: 'preview', preview: metrics });
    } catch (error) {
      console.error('[natal/human-base] preview failed:', error instanceof Error ? error.message : error);
      return res.status(502).json({ error: 'Natal preview unavailable', code: 'NATAL_PREVIEW_FAILED' });
    }
  }

  const inputHash = buildHumanInputHash({
    profile: ctx.profile,
    chartData: ctx.chartData!,
    promptVersion: HUMAN_BASE_PROMPT_VERSION,
  });

  const cacheOpts = {
    accessTier: 'free' as const,
    contentVariant: 'anchor' as const,
    cacheKey: HUMAN_BASE_CACHE_KEY,
    inputHash,
    promptVersion: HUMAN_BASE_PROMPT_VERSION,
    isPersistent: true,
  };

  const cached = await getCachedReading<NatalInterpretationReport>(ctx, cacheOpts);

  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'HUMAN_BASE_NOT_READY' });
    }
    return res.status(200).json({ interpretation: cached, source: 'human_v3_semantic' });
  }

  if (cached) {
    return res.status(200).json({ interpretation: cached, source: 'human_v3_semantic' });
  }

  try {
    const lockResult = await withContentGenerationLock({
      lockKey: buildContentGenerationLockKey({
        userId,
        chartId: ctx.chartId,
        accessTier: 'free',
        contentSurface: 'natal',
        contentVariant: 'anchor',
        cacheKey: HUMAN_BASE_CACHE_KEY,
        promptVersion: HUMAN_BASE_PROMPT_VERSION,
      }),
      operation: 'natal-human-base-generation',
      readCached: async () => {
        const again = await getCachedReading<NatalInterpretationReport>(ctx, cacheOpts);
        return again ? { value: again, source: 'human_v3_semantic' } : null;
      },
      generate: async () => {
        const report = await generateHumanBaseReport(ctx.profile, ctx.chartData!);
        return saveReading(ctx, cacheOpts, report);
      },
    });

    if (lockResult.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
    }

    return res.status(200).json({
      interpretation: lockResult.value,
      source: lockResult.fromCache ? (lockResult.source || 'human_v3_semantic') : 'generated',
    });
  } catch (error) {
    console.error('[natal/human-base] generation failed:', error instanceof Error ? error.message : error);
    const fallback = buildHumanBaseFallback(ctx.profile, ctx.chartData!);
    const saved = await saveReading(
      ctx,
      {
        ...cacheOpts,
        isPersistent: false,
        validTo: new Date(Date.now() + 6 * 60 * 60 * 1000),
        history: { source: 'deterministic_fallback', generationAttempts: 0 },
      },
      fallback
    ).catch(() => null);
    return res.status(200).json({
      interpretation: saved || { content: fallback, promptVersion: cacheOpts.promptVersion },
      source: saved ? 'fallback' : 'fallback-inline',
    });
  }
}
