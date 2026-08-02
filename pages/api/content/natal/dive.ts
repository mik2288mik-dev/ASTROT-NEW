import type { NextApiRequest, NextApiResponse } from 'next';
import {
  ensureValidContext,
  getCachedReading,
  isPremium,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import { generateDeepDive } from '../../../../lib/natalReading/generate';
import { buildDeepDiveFallback } from '../../../../lib/natalReading/fallbacks';
import { serializeChartForPrompt } from '../../../../lib/natalReading/chartSerializer';
import {
  NATAL_READING_DIVE_PROMPT,
  readingDiveCacheKey,
  type NatalReadingDeepDive,
  type NatalReadingDeepDiveKey,
} from '../../../../lib/natalReading/types';

export const config = { maxDuration: 90 };

const VALID_TOPICS: NatalReadingDeepDiveKey[] = ['love', 'career', 'health', 'karma', 'strengths'];

function readTopic(req: NextApiRequest): NatalReadingDeepDiveKey | null {
  const raw = (req.method === 'GET' ? req.query.topic : req.body?.topic) as string | undefined;
  if (!raw) return null;
  return VALID_TOPICS.includes(raw as NatalReadingDeepDiveKey)
    ? (raw as NatalReadingDeepDiveKey)
    : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { userId, ctx } = ready;

  const topic = readTopic(req);
  if (!topic) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: `topic must be one of: ${VALID_TOPICS.join(', ')}`,
    });
  }

  if (!(await isPremium(userId))) {
    return res.status(403).json({
      error: 'PREMIUM_REQUIRED',
      message: 'Deep dive readings are part of premium.',
    });
  }

  const cacheOpts = {
    accessTier: 'premium' as const,
    contentVariant: 'full' as const,
    cacheKey: readingDiveCacheKey(topic),
    promptVersion: NATAL_READING_DIVE_PROMPT,
    isPersistent: true,
  };

  const cached = await getCachedReading<NatalReadingDeepDive>(ctx, cacheOpts);

  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'DIVE_NOT_READY' });
    }
    return res.status(200).json({ interpretation: cached, source: 'content_v1', topic });
  }

  if (cached) {
    return res.status(200).json({ interpretation: cached, source: 'content_v1', topic });
  }

  try {
    const dive = await generateDeepDive(ctx.profile, ctx.chartData!, topic);
    const saved = await saveReading(ctx, cacheOpts, dive);
    return res.status(200).json({ interpretation: saved, source: 'generated', topic });
  } catch (error) {
    console.error(
      `[natal/dive:${topic}] generation failed:`,
      error instanceof Error ? error.message : error
    );
    const fallback = buildDeepDiveFallback(topic, serializeChartForPrompt(ctx.profile, ctx.chartData!));
    const fallbackTtl = new Date(Date.now() + 6 * 60 * 60 * 1000);
    try {
      const saved = await saveReading(ctx, {
        ...cacheOpts,
        validTo: fallbackTtl,
        isPersistent: false,
        history: { source: 'deterministic_fallback', generationAttempts: 0 },
      }, fallback);
      return res.status(200).json({ interpretation: saved, source: 'fallback', topic });
    } catch {
      return res.status(200).json({
        interpretation: { content: fallback, promptVersion: cacheOpts.promptVersion },
        source: 'fallback-inline',
        topic,
      });
    }
  }
}
