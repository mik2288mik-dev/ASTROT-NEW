import type { NextApiRequest, NextApiResponse } from 'next';
import {
  endOfDayMoscow,
  ensureValidContext,
  getCachedReading,
  isPremium,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import { generateToday } from '../../../../lib/natalReading/generate';
import { buildTodayFallback } from '../../../../lib/natalReading/fallbacks';
import { serializeChartForPrompt } from '../../../../lib/natalReading/chartSerializer';
import {
  NATAL_READING_TODAY_PROMPT,
  readingTodayCacheKey,
  type NatalReadingToday,
} from '../../../../lib/natalReading/types';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { userId, ctx } = ready;

  if (!(await isPremium(userId))) {
    return res.status(403).json({
      error: 'PREMIUM_REQUIRED',
      message: 'Today\'s reading is part of premium.',
    });
  }

  const cacheKey = readingTodayCacheKey();
  const validTo = endOfDayMoscow();

  const cacheOpts = {
    accessTier: 'premium' as const,
    contentVariant: 'daily' as const,
    cacheKey,
    promptVersion: NATAL_READING_TODAY_PROMPT,
    isPersistent: false,
    validTo,
  };

  const cached = await getCachedReading<NatalReadingToday>(ctx, cacheOpts);

  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'TODAY_NOT_READY' });
    }
    return res.status(200).json({ interpretation: cached, source: 'content_v1' });
  }

  if (cached) {
    return res.status(200).json({ interpretation: cached, source: 'content_v1' });
  }

  try {
    const today = await generateToday(ctx.profile, ctx.chartData!);
    const saved = await saveReading(ctx, cacheOpts, today);
    return res.status(200).json({ interpretation: saved, source: 'generated' });
  } catch (error) {
    console.error(
      '[natal/today] generation failed:',
      error instanceof Error ? error.message : error
    );
    const fallback = buildTodayFallback(serializeChartForPrompt(ctx.profile, ctx.chartData!));
    // Today cache anyway expires at end of day
    try {
      const saved = await saveReading(ctx, cacheOpts, fallback);
      return res.status(200).json({ interpretation: saved, source: 'fallback' });
    } catch {
      return res.status(200).json({
        interpretation: { content: fallback, promptVersion: cacheOpts.promptVersion },
        source: 'fallback-inline',
      });
    }
  }
}
