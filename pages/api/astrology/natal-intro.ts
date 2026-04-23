import type { NextApiRequest, NextApiResponse } from 'next';
import { getOpenAIModelForContent } from '../../../lib/appSettings';
import { db } from '../../../lib/db';
import { generateNatalAnchorReading } from '../../../lib/natalContent';
import {
  coerceNatalAnchorReading,
  mapNatalAnchorToLegacyIntro,
  NATAL_ANCHOR_CACHE_KEY,
  NATAL_ANCHOR_PROMPT_VERSION,
} from '../../../lib/natalReadings';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit';

const log = {
  info: (message: string, data?: any) => console.log(`[API/astrology/natal-intro] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/astrology/natal-intro] ERROR: ${message}`, error || ''),
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { profile, chartData, chartId } = req.body;

    if (!profile || !chartData) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Profile and chartData are required',
      });
    }

    const userId = String(profile.id || profile.name || '').trim();
    const effectiveChartId = chartId != null ? parseInt(String(chartId), 10) : null;
    const lang = profile.language === 'en' ? 'en' : 'ru';

    log.info('Natal intro request received', {
      userId,
      chartId: effectiveChartId,
      language: profile.language,
      hasSun: !!chartData.sun,
      hasMoon: !!chartData.moon,
      hasRising: !!chartData.rising,
    });

    const cached = effectiveChartId != null
      ? await db.content_interpretations.getByChart(effectiveChartId, 'free', 'natal', 'anchor', NATAL_ANCHOR_CACHE_KEY)
      : userId
        ? await db.content_interpretations.getByUser(userId, 'free', 'natal', 'anchor', NATAL_ANCHOR_CACHE_KEY)
        : null;

    if (cached?.content && cached.promptVersion === NATAL_ANCHOR_PROMPT_VERSION) {
      const reading = coerceNatalAnchorReading(cached.content, lang, chartData);
      return res.status(200).json({
        intro: mapNatalAnchorToLegacyIntro(reading),
        reading,
        timestamp: Date.now(),
        persisted: true,
        source: 'cache',
      });
    }

    const reading = await generateNatalAnchorReading(profile, chartData);
    const intro = mapNatalAnchorToLegacyIntro(reading);
    const { modelTier } = await getOpenAIModelForContent({
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'anchor',
    });

    if (effectiveChartId != null) {
      await db.content_interpretations.upsertByChart(effectiveChartId, {
        accessTier: 'free',
        contentSurface: 'natal',
        contentVariant: 'anchor',
        cacheKey: NATAL_ANCHOR_CACHE_KEY,
        inputHash: NATAL_ANCHOR_CACHE_KEY,
        content: reading,
        modelTier,
        promptVersion: NATAL_ANCHOR_PROMPT_VERSION,
        calculationVersion: chartData.calculationVersion || null,
        isPersistent: true,
        canRegenerateForLumi: true,
        regenerationCostLumi: 250,
        legacySource: 'natal_content_unified_v3.legacy_intro',
      }, userId || null);
    } else if (userId) {
      await db.content_interpretations.upsertByUser(userId, {
        accessTier: 'free',
        contentSurface: 'natal',
        contentVariant: 'anchor',
        cacheKey: NATAL_ANCHOR_CACHE_KEY,
        inputHash: NATAL_ANCHOR_CACHE_KEY,
        content: reading,
        modelTier,
        promptVersion: NATAL_ANCHOR_PROMPT_VERSION,
        calculationVersion: chartData.calculationVersion || null,
        isPersistent: true,
        canRegenerateForLumi: true,
        regenerationCostLumi: 250,
        legacySource: 'natal_content_unified_v3.legacy_intro',
      });
    }

    return res.status(200).json({
      intro,
      reading,
      timestamp: Date.now(),
      persisted: true,
      source: 'generated',
    });
  } catch (error: any) {
    log.error('Unexpected error in handler', {
      error: error.message,
      stack: error.stack,
    });

    return res.status(500).json({
      error: 'Internal server error',
      code: 'NATAL_INTRO_INTERNAL_ERROR',
      message: error.message,
    });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.AI_FREE);
