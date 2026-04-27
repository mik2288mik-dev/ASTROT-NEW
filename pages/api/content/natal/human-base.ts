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

export const config = { maxDuration: 90 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { ctx } = ready;

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
    return res.status(200).json({ interpretation: cached, source: 'human_v1' });
  }

  if (cached) {
    return res.status(200).json({ interpretation: cached, source: 'human_v1' });
  }

  try {
    const report = await generateHumanBaseReport(ctx.profile, ctx.chartData!);
    const saved = await saveReading(ctx, cacheOpts, report);
    return res.status(200).json({ interpretation: saved, source: 'generated' });
  } catch (error) {
    console.error('[natal/human-base] generation failed:', error instanceof Error ? error.message : error);
    const fallback = buildHumanBaseFallback(ctx.profile, ctx.chartData!);
    const saved = await saveReading(
      ctx,
      { ...cacheOpts, isPersistent: false, validTo: new Date(Date.now() + 6 * 60 * 60 * 1000) },
      fallback
    ).catch(() => null);
    return res.status(200).json({
      interpretation: saved || { content: fallback, promptVersion: cacheOpts.promptVersion },
      source: saved ? 'fallback' : 'fallback-inline',
    });
  }
}
