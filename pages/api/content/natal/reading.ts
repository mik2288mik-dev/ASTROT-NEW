import type { NextApiRequest, NextApiResponse } from 'next';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { ensureValidContext } from '../../../../lib/natalReading/apiHelper';
import { getCachedNatalUnifiedReading } from '../../../../lib/natalReading/unifiedApi';
import {
  projectNatalUnifiedReadingForTier,
  type NatalUnifiedReadingTier,
} from '../../../../lib/natalReading/unifiedReading';

function readTier(req: NextApiRequest): NatalUnifiedReadingTier {
  const raw = req.query.tier;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'premium' ? 'premium' : 'free';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      code: 'NATAL_READING_READ_ONLY',
    });
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
  if (!cached) {
    return res.status(404).json({
      error: 'NOT_FOUND',
      code: 'NATAL_UNIFIED_READING_NOT_PRECOMPUTED',
      message: 'Natal reading was not precomputed for this chart.',
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
