import type { NextApiRequest, NextApiResponse } from 'next';
import { generationInProgressPayload } from '../../../../lib/contentGenerationLock';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { ensureValidContext } from '../../../../lib/natalReading/apiHelper';
import {
  generateNatalUnifiedReadingWithLock,
  getCachedNatalUnifiedReading,
} from '../../../../lib/natalReading/unifiedApi';
import {
  projectNatalUnifiedReadingForTier,
  type NatalUnifiedReadingTier,
} from '../../../../lib/natalReading/unifiedReading';

export const config = { maxDuration: 90 };

function readTier(req: NextApiRequest): NatalUnifiedReadingTier {
  const raw = req.method === 'GET' ? req.query.tier : req.body?.tier;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'premium' ? 'premium' : 'free';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const tier = readTier(req);
  const ready = await ensureValidContext(req, res, {
    allowGuest: true,
    requireCanonicalSnapshot: true,
    repairCanonicalSnapshot: false,
  });
  if (!ready) return;

  const { userId, ctx } = ready;
  if (tier === 'premium') {
    const entitlement = await getPremiumEntitlementState(userId);
    if (!entitlement.isPremium) {
      return res.status(403).json({
        error: 'Premium required',
        code: 'PREMIUM_REQUIRED',
        premiumRequired: true,
      });
    }
  }

  const cached = await getCachedNatalUnifiedReading(ctx, tier);
  if (req.method === 'GET') {
    if (!cached) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        code: 'NATAL_UNIFIED_READING_NOT_READY',
      });
    }
    return res.status(200).json({
      interpretation: {
        ...cached,
        content: projectNatalUnifiedReadingForTier(cached.content, tier),
      },
      source: 'natal_unified_v1',
      accessTier: tier,
    });
  }

  if (cached) {
    return res.status(200).json({
      interpretation: {
        ...cached,
        content: projectNatalUnifiedReadingForTier(cached.content, tier),
      },
      source: 'natal_unified_v1',
      accessTier: tier,
    });
  }

  // The app runs as a long-lived standalone Docker server. Do not hold the user's
  // HTTP request open while the canonical report is written. The client already
  // understands 202 and polls GET until the persisted reading is available.
  void generateNatalUnifiedReadingWithLock({ userId, ctx, tier })
    .then((result) => {
      if (result.status === 'in_progress') return;
      console.info('[natal/unified] generation completed', {
        userId,
        chartId: ctx.chartId,
        source: result.fromCache ? (result.source || 'cache') : 'generated',
      });
    })
    .catch((error) => {
      console.error(
        `[natal/unified] ${tier} background generation failed:`,
        error instanceof Error ? error.message : error,
      );
    });

  return res.status(202).json(generationInProgressPayload(750));
}
