import type { NextApiRequest, NextApiResponse } from 'next';
import type { NatalChartDataV2 } from '../../../../lib/natalChartV2Types';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { generationInProgressPayload } from '../../../../lib/contentGenerationLock';
import { ensureValidContext } from '../../../../lib/natalReading/apiHelper';
import {
  adaptUnifiedToLegacyCatalogCategory,
  legacyInterpretationEnvelope,
} from '../../../../lib/natalReading/legacyCompatibility';
import { loadUnifiedReadingForLegacyEndpoint } from '../../../../lib/natalReading/legacyCompatibilityApi';
import {
  isNatalReportCategoryKey,
  type NatalReportCategoryKey,
} from '../../../../lib/natalReading/reportCatalog';

export const config = { maxDuration: 90 };

function readCategoryKey(req: NextApiRequest): NatalReportCategoryKey | null {
  const raw = req.method === 'GET' ? req.query.categoryKey : req.body?.categoryKey;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isNatalReportCategoryKey(value) ? value : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const categoryKey = readCategoryKey(req);
  if (!categoryKey) {
    return res.status(400).json({
      error: 'INVALID_CATEGORY_KEY',
      code: 'INVALID_CATEGORY_KEY',
    });
  }
  const ready = await ensureValidContext(req, res, {
    allowGuest: true,
    requireCanonicalSnapshot: true,
    repairCanonicalSnapshot: false,
  });
  if (!ready) return;
  const { userId, ctx } = ready;
  const language = ctx.profile.language === 'en' ? 'en' : 'ru';
  const accessTier = categoryKey === 'main' ? 'free' : 'premium';
  if (accessTier === 'premium') {
    const entitlement = await getPremiumEntitlementState(userId);
    if (!entitlement.isPremium) {
      return res.status(403).json({
        error: 'Premium required',
        code: 'PREMIUM_REQUIRED',
        premiumRequired: true,
      });
    }
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
        code: 'NATAL_REPORT_CATEGORY_NOT_READY',
      });
    }
    if (unified.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(unified.retryAfterMs));
    }

    const content = adaptUnifiedToLegacyCatalogCategory({
      reading: unified.interpretation.content,
      chart: ctx.chartData as unknown as NatalChartDataV2,
      profile: ctx.profile,
      categoryKey,
    });
    return res.status(200).json({
      interpretation: legacyInterpretationEnvelope(unified.interpretation, content, accessTier),
      source: 'natal_unified_compat_v1',
      accessTier,
    });
  } catch (error) {
    console.error(`[natal/catalog] ${categoryKey} compatibility projection failed:`, error instanceof Error ? error.message : error);
    return res.status(503).json({
      error: 'NATAL_REPORT_CATEGORY_GENERATION_FAILED',
      code: 'NATAL_REPORT_CATEGORY_GENERATION_FAILED',
      message: language === 'en'
        ? 'This part of the chart did not open right now. Try again, your saved chart has not changed.'
        : 'Эта часть карты сейчас не открылась. Попробуй ещё раз, сохранённая карта не изменилась.',
      retryable: true,
    });
  }
}
