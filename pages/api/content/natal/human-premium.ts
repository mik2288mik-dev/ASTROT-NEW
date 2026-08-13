import type { NextApiRequest, NextApiResponse } from 'next';
import {
  ensureValidContext,
} from '../../../../lib/natalReading/apiHelper';
import {
  generatePermanentPremiumWithLock,
  getCachedPermanentPremiumReport,
} from '../../../../lib/natalReading/permanentApi';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { generationInProgressPayload } from '../../../../lib/contentGenerationLock';

export const config = { maxDuration: 90 };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const ready = await ensureValidContext(req, res, {
    requireCanonicalSnapshot: true,
    repairCanonicalSnapshot: false,
  });
  if (!ready) return;
  const { userId, ctx } = ready;
  const language = ctx.profile.language === 'en' ? 'en' : 'ru';
  const entitlement = await getPremiumEntitlementState(userId);
  if (!entitlement.isPremium) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
    });
  }

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
    return res.status(503).json({
      error: 'NATAL_PREMIUM_GENERATION_FAILED',
      code: 'NATAL_PREMIUM_GENERATION_FAILED',
      message: language === 'en'
        ? 'The detailed reading could not be prepared right now. Try again — the saved chart has not changed.'
        : 'Подробный разбор сейчас не собрался. Попробуй ещё раз — сохранённая карта не изменилась.',
      retryable: true,
    });
  }
}
