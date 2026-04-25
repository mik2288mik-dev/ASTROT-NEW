import type { NextApiRequest, NextApiResponse } from 'next';
import {
  ensureValidContext,
  getCachedReading,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import { generatePortrait } from '../../../../lib/natalReading/generate';
import {
  NATAL_READING_PORTRAIT_KEY,
  NATAL_READING_PORTRAIT_PROMPT,
  type NatalReadingPortrait,
} from '../../../../lib/natalReading/types';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { ctx } = ready;

  const cacheOpts = {
    accessTier: 'free' as const,
    contentVariant: 'anchor' as const,
    cacheKey: NATAL_READING_PORTRAIT_KEY,
    promptVersion: NATAL_READING_PORTRAIT_PROMPT,
    isPersistent: true,
  };

  const cached = await getCachedReading<NatalReadingPortrait>(ctx, cacheOpts);

  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'PORTRAIT_NOT_READY' });
    }
    return res.status(200).json({ interpretation: cached, source: 'content_v1' });
  }

  if (cached) {
    return res.status(200).json({ interpretation: cached, source: 'content_v1' });
  }

  try {
    const portrait = await generatePortrait(ctx.profile, ctx.chartData!);
    const saved = await saveReading(ctx, cacheOpts, portrait);
    return res.status(200).json({ interpretation: saved, source: 'generated' });
  } catch (error) {
    console.error('[natal/portrait] generation failed', error);
    return res.status(500).json({
      error: 'GENERATION_FAILED',
      message: error instanceof Error ? error.message : 'Generation failed',
    });
  }
}
