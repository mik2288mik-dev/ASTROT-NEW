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

  try {
    const result = await generateNatalUnifiedReadingWithLock({ userId, ctx, tier });
    if (result.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(result.retryAfterMs));
    }
    return res.status(200).json({
      interpretation: {
        ...result.value,
        content: projectNatalUnifiedReadingForTier(result.value.content, tier),
      },
      source: result.fromCache ? (result.source || 'natal_unified_v1') : 'generated',
      accessTier: tier,
    });
  } catch (error) {
    console.error(
      `[natal/unified] ${tier} generation failed:`,
      error instanceof Error ? error.message : error,
    );
    return res.status(503).json({
      error: 'NATAL_UNIFIED_READING_GENERATION_FAILED',
      code: 'NATAL_UNIFIED_READING_GENERATION_FAILED',
      retryable: true,
    });
  }
}
