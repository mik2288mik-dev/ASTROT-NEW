import type { NextApiRequest, NextApiResponse } from 'next';
import type { NatalInterpretationReport } from '../../../../types';
import {
  ensureValidContext,
  getCachedReading,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import {
  buildPermanentNatalCacheKey,
  buildPermanentNatalInputHash,
  NATAL_PERMANENT_FREE_CACHE_KEY,
  NATAL_PERMANENT_FREE_PROMPT_VERSION,
} from '../../../../lib/natalReading/permanentReport';
import { generatePermanentNatalFreeReport } from '../../../../lib/natalReading/permanentGeneration';
import {
  buildContentGenerationLockKey,
  generationInProgressPayload,
  withContentGenerationLock,
} from '../../../../lib/contentGenerationLock';

export const config = { maxDuration: 90 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const ready = await ensureValidContext(req, res, {
    allowGuest: true,
    requireCanonicalSnapshot: true,
    repairCanonicalSnapshot: false,
  });
  if (!ready) return;
  const { userId, ctx } = ready;

  const inputHash = buildPermanentNatalInputHash({
    profile: ctx.profile,
    chartData: ctx.chartData!,
    tier: 'free',
    promptVersion: NATAL_PERMANENT_FREE_PROMPT_VERSION,
  });
  const language = ctx.profile.language === 'en' ? 'en' : 'ru';
  const cacheKey = buildPermanentNatalCacheKey(NATAL_PERMANENT_FREE_CACHE_KEY, language);

  const cacheOpts = {
    accessTier: 'free' as const,
    contentVariant: 'anchor' as const,
    cacheKey,
    inputHash,
    promptVersion: NATAL_PERMANENT_FREE_PROMPT_VERSION,
    isPersistent: true,
  };

  const cached = await getCachedReading<NatalInterpretationReport>(ctx, cacheOpts);

  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'HUMAN_BASE_NOT_READY' });
    }
    return res.status(200).json({ interpretation: cached, source: 'natal_permanent_free_v2' });
  }

  if (cached) {
    return res.status(200).json({ interpretation: cached, source: 'natal_permanent_free_v2' });
  }

  try {
    const lockResult = await withContentGenerationLock({
      lockKey: buildContentGenerationLockKey({
        userId,
        chartId: ctx.chartId,
        accessTier: 'free',
        contentSurface: 'natal',
        contentVariant: 'anchor',
        cacheKey,
        promptVersion: NATAL_PERMANENT_FREE_PROMPT_VERSION,
      }),
      operation: 'natal-human-base-generation',
      readCached: async () => {
        const again = await getCachedReading<NatalInterpretationReport>(ctx, cacheOpts);
        return again ? { value: again, source: 'natal_permanent_free_v2' } : null;
      },
      generate: async () => {
        const report = await generatePermanentNatalFreeReport(ctx.profile, ctx.chartData!);
        return saveReading(ctx, cacheOpts, report);
      },
    });

    if (lockResult.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
    }

    return res.status(200).json({
      interpretation: lockResult.value,
      source: lockResult.fromCache ? (lockResult.source || 'natal_permanent_free_v2') : 'generated',
    });
  } catch (error) {
    console.error('[natal/human-base] generation failed:', error instanceof Error ? error.message : error);
    return res.status(503).json({
      error: 'NATAL_REPORT_GENERATION_FAILED',
      code: 'NATAL_REPORT_GENERATION_FAILED',
      message: language === 'en'
        ? 'The reading could not be prepared right now. Try again — the saved chart has not changed.'
        : 'Разбор сейчас не собрался. Попробуй ещё раз — сохранённая карта не изменилась.',
      retryable: true,
    });
  }
}
