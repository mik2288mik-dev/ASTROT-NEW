import type { NextApiRequest, NextApiResponse } from 'next';
import {
  ensureValidContext,
  getCachedReading,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import { generateAspects } from '../../../../lib/natalReading/generate';
import {
  NATAL_READING_ASPECTS_KEY,
  NATAL_READING_ASPECTS_PROMPT,
  type NatalReadingAspects,
} from '../../../../lib/natalReading/types';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { ctx } = ready;

  const cacheOpts = {
    accessTier: 'free' as const,
    contentVariant: 'anchor' as const,
    cacheKey: NATAL_READING_ASPECTS_KEY,
    promptVersion: NATAL_READING_ASPECTS_PROMPT,
    isPersistent: true,
  };

  const cached = await getCachedReading<NatalReadingAspects>(ctx, cacheOpts);

  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'ASPECTS_NOT_READY' });
    }
    return res.status(200).json({ interpretation: cached, source: 'content_v1' });
  }

  if (cached) {
    return res.status(200).json({ interpretation: cached, source: 'content_v1' });
  }

  try {
    const aspects = await generateAspects(ctx.profile, ctx.chartData!);
    const saved = await saveReading(ctx, cacheOpts, aspects);
    return res.status(200).json({ interpretation: saved, source: 'generated' });
  } catch (error) {
    console.error('[natal/aspects] generation failed', error);
    return res.status(500).json({
      error: 'GENERATION_FAILED',
      message: error instanceof Error ? error.message : 'Generation failed',
    });
  }
}
