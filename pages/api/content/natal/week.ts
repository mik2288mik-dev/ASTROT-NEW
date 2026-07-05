import type { NextApiRequest, NextApiResponse } from 'next';
import {
  endOfIsoWeek,
  ensureValidContext,
  getCachedReading,
  isPremium,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import { generateWeek } from '../../../../lib/natalReading/generate';
import { buildWeekFallback } from '../../../../lib/natalReading/fallbacks';
import { serializeChartForPrompt } from '../../../../lib/natalReading/chartSerializer';
import {
  NATAL_READING_WEEK_PROMPT,
  readingWeekCacheKey,
  type NatalReadingWeek,
} from '../../../../lib/natalReading/types';

export const config = { maxDuration: 60 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { userId, ctx } = ready;

  if (!(await isPremium(userId))) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      message: ctx.profile.language === 'en'
        ? 'The weekly reading is available in Premium.'
        : 'Weekly reading is available in Premium.',
    });
  }

  const cacheKey = readingWeekCacheKey();
  const validTo = endOfIsoWeek();

  const cacheOpts = {
    accessTier: 'premium' as const,
    contentVariant: 'weekly' as const,
    cacheKey,
    promptVersion: NATAL_READING_WEEK_PROMPT,
    isPersistent: false,
    validTo,
  };

  const cached = await getCachedReading<NatalReadingWeek>(ctx, cacheOpts);

  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'WEEK_NOT_READY' });
    }
    return res.status(200).json({ interpretation: cached, source: 'content_v1' });
  }

  if (cached) {
    return res.status(200).json({ interpretation: cached, source: 'content_v1' });
  }

  try {
    const week = await generateWeek(ctx.profile, ctx.chartData!);
    const saved = await saveReading(ctx, cacheOpts, week);
    return res.status(200).json({ interpretation: saved, source: 'generated' });
  } catch (error) {
    console.error(
      '[natal/week] generation failed:',
      error instanceof Error ? error.message : error
    );
    const fallback = buildWeekFallback(serializeChartForPrompt(ctx.profile, ctx.chartData!));
    // Week cache anyway expires at end of week, so we just keep the original validTo
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
