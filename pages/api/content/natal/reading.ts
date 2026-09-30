import type { NextApiRequest, NextApiResponse } from 'next';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { ensureValidContext } from '../../../../lib/natalReading/apiHelper';
import { hasFailedNatalReadingPreparation } from '../../../../lib/natalReading/preparation';
import { getCachedNatalUnifiedReading } from '../../../../lib/natalReading/unifiedApi';
import {
  projectNatalUnifiedReadingForTier,
  type NatalUnifiedReadingTier,
} from '../../../../lib/natalReading/unifiedReading';

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
  // POST is retained for published clients, but is also a read-only request.
  if (!cached) {
    if (await hasFailedNatalReadingPreparation(ctx)) {
      return res.status(503).json({ error: 'NATAL_PREPARATION_FAILED', code: 'NATAL_PREPARATION_FAILED' });
    }
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
