import type { NextApiRequest, NextApiResponse } from 'next';
import type { NatalChartDataV2 } from '../../../../lib/natalChartV2Types';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { generationInProgressPayload } from '../../../../lib/contentGenerationLock';
import { ensureValidContext } from '../../../../lib/natalReading/apiHelper';
import {
  adaptUnifiedToLegacyPremiumReport,
  legacyInterpretationEnvelope,
} from '../../../../lib/natalReading/legacyCompatibility';
import { loadUnifiedReadingForLegacyEndpoint } from '../../../../lib/natalReading/legacyCompatibilityApi';

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

  try {
    const unified = await loadUnifiedReadingForLegacyEndpoint({
      userId,
      ctx,
      method: req.method,
    });
    if (unified.status === 'not_found') {
      return res.status(404).json({
        error: 'NOT_FOUND',
        code: 'NATAL_PREMIUM_NOT_READY',
      });
    }
    if (unified.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(unified.retryAfterMs));
    }

    const content = adaptUnifiedToLegacyPremiumReport({
      reading: unified.interpretation.content,
      chart: ctx.chartData as unknown as NatalChartDataV2,
      profile: ctx.profile,
    });
    return res.status(200).json({
      interpretation: legacyInterpretationEnvelope(unified.interpretation, content, 'premium'),
      source: 'natal_unified_compat_v1',
      accessTier: 'premium',
    });
  } catch (error) {
    console.error('[natal/human-premium] compatibility projection failed:', error instanceof Error ? error.message : error);
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
