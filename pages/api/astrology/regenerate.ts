import type { NextApiRequest, NextApiResponse } from 'next';
import { getOpenAIModelForContent } from '../../../lib/appSettings';
import { db } from '../../../lib/db';
import { generateNatalAnchorReading, generateNatalFullReading } from '../../../lib/natalContent';
import {
  mapNatalAnchorToLegacyIntro,
  NATAL_ANCHOR_CACHE_KEY,
  NATAL_ANCHOR_PROMPT_VERSION,
  NATAL_FULL_CACHE_KEY,
  NATAL_FULL_PROMPT_VERSION,
} from '../../../lib/natalReadings';
import { withRateLimit, RATE_LIMIT_CONFIGS } from '../../../lib/rateLimit';
import type { NatalFullReading } from '../../../types';

const REGENERATION_COST_STARS = 50;

const log = {
  info: (message: string, data?: any) => console.log(`[API/astrology/regenerate] ${message}`, data || ''),
  error: (message: string, error?: any) => console.error(`[API/astrology/regenerate] ERROR: ${message}`, error || ''),
  warn: (message: string, data?: any) => console.warn(`[API/astrology/regenerate] WARNING: ${message}`, data || ''),
};

async function checkRegenerationLimits(userId: string, isPremium: boolean) {
  if (!isPremium) {
    return {
      canRegenerate: false,
      isFree: false,
      costInStars: 0,
      message: 'Regeneration is available only for Premium users',
    };
  }

  const countThisWeek = await db.lumi_transactions.getRegenerationCountThisWeek(userId);
  if (countThisWeek === 0) {
    return {
      canRegenerate: true,
      isFree: true,
      costInStars: 0,
      message: 'First regeneration this week is included',
    };
  }

  const lumiBalance = await db.lumi_transactions.getBalance(userId);
  if (lumiBalance < REGENERATION_COST_STARS) {
    return {
      canRegenerate: false,
      isFree: false,
      costInStars: REGENERATION_COST_STARS,
      message: `Not enough Lumi. Required: ${REGENERATION_COST_STARS}, current: ${lumiBalance}`,
    };
  }

  return {
    canRegenerate: true,
    isFree: false,
    costInStars: REGENERATION_COST_STARS,
    message: 'Regeneration will spend Lumi',
  };
}

function selectFullSection(reading: NatalFullReading, contentType: string) {
  const topic = contentType.replace('deep_dive_', '');
  switch (topic) {
    case 'love':
      return `Как ты строишь близость\n\n${reading.closeness}`;
    case 'career':
      return `Как ты выбираешь и действуешь\n\n${reading.choices}\n\n${reading.strengths}`;
    case 'weakness':
      return `Где повторяется напряжение\n\n${reading.tensionPattern}\n\n${reading.integration}`;
    case 'karma':
      return `Как с этим обращаться\n\n${reading.integration}`;
    default:
      return `Полная интерпретация личности\n\n${reading.mainConfiguration}\n\n${reading.reactions}\n\n${reading.choices}`;
  }
}

async function upsertAnchor(userId: string, chartId: number | null, chartData: any, content: any) {
  const { modelTier } = await getOpenAIModelForContent({
    accessTier: 'free',
    contentSurface: 'natal',
    contentVariant: 'anchor',
  });

  const payload = {
    accessTier: 'free' as const,
    contentSurface: 'natal' as const,
    contentVariant: 'anchor' as const,
    cacheKey: NATAL_ANCHOR_CACHE_KEY,
    inputHash: NATAL_ANCHOR_CACHE_KEY,
    content,
    modelTier,
    promptVersion: NATAL_ANCHOR_PROMPT_VERSION,
    calculationVersion: chartData?.calculationVersion || null,
    isPersistent: true,
    canRegenerateForLumi: true,
    regenerationCostLumi: 250,
    legacySource: 'natal_content_unified_v4.regenerate',
  };

  if (chartId != null) {
    await db.content_interpretations.upsertByChart(chartId, payload, userId);
  } else {
    await db.content_interpretations.upsertByUser(userId, payload);
  }
}

async function upsertFull(userId: string, chartId: number | null, chartData: any, content: NatalFullReading) {
  const { modelTier } = await getOpenAIModelForContent({
    accessTier: 'premium',
    contentSurface: 'natal',
    contentVariant: 'full',
  });

  const payload = {
    accessTier: 'premium' as const,
    contentSurface: 'natal' as const,
    contentVariant: 'full' as const,
    cacheKey: NATAL_FULL_CACHE_KEY,
    inputHash: NATAL_FULL_CACHE_KEY,
    content,
    modelTier,
    promptVersion: NATAL_FULL_PROMPT_VERSION,
    calculationVersion: chartData?.calculationVersion || null,
    isPersistent: true,
    canRegenerateForLumi: false,
    legacySource: 'natal_content_unified_v4.regenerate',
  };

  if (chartId != null) {
    await db.content_interpretations.upsertByChart(chartId, payload, userId);
  } else {
    await db.content_interpretations.upsertByUser(userId, payload);
  }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, contentType, profile, chartData, chartId } = req.body || {};
    const userKey = String(userId || '').trim();
    const effectiveChartId = chartId != null ? Number.parseInt(String(chartId), 10) : null;
    const safeChartId = Number.isFinite(effectiveChartId as number) ? effectiveChartId : null;

    log.info('Regeneration request received', {
      userId: userKey,
      chartId: safeChartId,
      contentType,
      isPremium: profile?.isPremium,
    });

    if (!userKey || !contentType || !profile || !chartData) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'userId, contentType, profile and chartData are required',
      });
    }

    if (!profile.isPremium) {
      return res.status(403).json({
        error: 'Premium required',
        message: 'Regeneration is available only for Premium users',
      });
    }

    const limits = await checkRegenerationLimits(userKey, !!profile.isPremium);
    if (!limits.canRegenerate) {
      return res.status(403).json({
        error: 'Regeneration not allowed',
        message: limits.message,
        limits,
      });
    }

    let newBalance = await db.lumi_transactions.getBalance(userKey);
    if (!limits.isFree) {
      try {
        const result = await db.lumi_transactions.deduct(
          userKey,
          REGENERATION_COST_STARS,
          contentType === 'natal_intro' ? 'regenerate_natal' : 'regenerate_deep_dive'
        );
        newBalance = result.newBalance;
      } catch (error: any) {
        log.error('Failed to deduct Lumi', { error: error.message });
        return res.status(400).json({
          error: 'Payment failed',
          message: 'Failed to spend Lumi',
        });
      }
    }

    let regeneratedData: any;
    let regeneratedReading: any;

    try {
      if (contentType === 'natal_intro') {
        regeneratedReading = await generateNatalAnchorReading(profile, chartData);
        regeneratedData = mapNatalAnchorToLegacyIntro(regeneratedReading);
        await upsertAnchor(userKey, safeChartId, chartData, regeneratedReading);
      } else if (String(contentType).startsWith('deep_dive_')) {
        regeneratedReading = await generateNatalFullReading(profile, chartData);
        regeneratedData = selectFullSection(regeneratedReading, String(contentType));
        await upsertFull(userKey, safeChartId, chartData, regeneratedReading);
      } else {
        return res.status(400).json({
          error: 'Invalid content type',
          message: `Unsupported content type: ${contentType}. Supported: natal_intro and deep_dive_*`,
        });
      }

      log.info('Text regenerated successfully', {
        userId: userKey,
        contentType,
        dataLength: typeof regeneratedData === 'string' ? regeneratedData.length : JSON.stringify(regeneratedData).length,
      });
    } catch (error: any) {
      log.error('Failed to regenerate text', { error: error.message, contentType });
      if (!limits.isFree) {
        await db.lumi_transactions.add(userKey, REGENERATION_COST_STARS, 'refund');
      }
      return res.status(500).json({
        error: 'Regeneration failed',
        message: error.message,
      });
    }

    try {
      const reason = contentType === 'natal_intro' ? 'regenerate_natal' : 'regenerate_deep_dive';
      await db.lumi_transactions.add(userKey, 0, reason);
    } catch (error: any) {
      log.warn('Failed to record regeneration', { error: error.message });
    }

    return res.status(200).json({
      success: true,
      data: regeneratedData,
      reading: regeneratedReading,
      newBalance,
      wasPaid: !limits.isFree,
      costInStars: limits.isFree ? 0 : REGENERATION_COST_STARS,
    });
  } catch (error: any) {
    log.error('Error in regeneration handler', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}

export default withRateLimit(handler, RATE_LIMIT_CONFIGS.AI_PREMIUM);
