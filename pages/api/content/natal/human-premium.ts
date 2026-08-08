import type { NextApiRequest, NextApiResponse } from 'next';
import {
  ensureValidContext,
  saveReading,
} from '../../../../lib/natalReading/apiHelper';
import {
  buildPermanentPremiumFallback,
} from '../../../../lib/natalReading/permanentReport';
import {
  generatePermanentPremiumWithLock,
  getCachedPermanentPremiumReport,
  permanentPremiumCacheOptions,
} from '../../../../lib/natalReading/permanentApi';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { generationInProgressPayload } from '../../../../lib/contentGenerationLock';

export const config = { maxDuration: 90 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const ready = await ensureValidContext(req, res);
  if (!ready) return;
  const { userId, ctx } = ready;
  const entitlement = await getPremiumEntitlementState(userId);
  if (!entitlement.isPremium) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
    });
  }

  const cacheOptions = permanentPremiumCacheOptions(ctx);
  const cached = await getCachedPermanentPremiumReport(ctx);
  if (cached) {
    return res.status(200).json({
      interpretation: cached,
      source: 'natal_permanent_premium_v2',
      accessTier: 'premium',
    });
  }
  if (req.method === 'GET') {
    return res.status(404).json({
      error: 'NOT_FOUND',
      code: 'NATAL_PREMIUM_NOT_READY',
    });
  }

  try {
    const lockResult = await generatePermanentPremiumWithLock({ userId, ctx });
    if (lockResult.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(lockResult.retryAfterMs));
    }
    return res.status(200).json({
      interpretation: lockResult.value,
      source: lockResult.fromCache
        ? (lockResult.source || 'natal_permanent_premium_v2')
        : 'generated',
      accessTier: 'premium',
    });
  } catch (error) {
    console.error(
      '[natal/human-premium] generation failed:',
      error instanceof Error ? error.message : error,
    );
    const fallback = buildPermanentPremiumFallback(ctx.profile, ctx.chartData!);
    const saved = await saveReading(
      ctx,
      {
        ...cacheOptions,
        isPersistent: false,
        validTo: new Date(Date.now() + 6 * 60 * 60 * 1000),
        history: { source: 'deterministic_fallback', generationAttempts: 0 },
      },
      fallback,
    ).catch(() => null);
    return res.status(200).json({
      interpretation: saved || { content: fallback, promptVersion: cacheOptions.promptVersion },
      source: saved ? 'fallback' : 'fallback-inline',
      accessTier: 'premium',
    });
  }
}
