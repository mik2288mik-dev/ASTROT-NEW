import type { NextApiRequest, NextApiResponse } from 'next';
import type { NatalChartDataV2 } from '../../../../lib/natalChartV2Types';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { generationInProgressPayload } from '../../../../lib/contentGenerationLock';
import {
  isHumanPaidSectionKey,
  type HumanPaidSectionKey,
} from '../../../../lib/natalHumanShared';
import { ensureValidContext } from '../../../../lib/natalReading/apiHelper';
import {
  adaptUnifiedToLegacyHumanSection,
  legacyInterpretationEnvelope,
} from '../../../../lib/natalReading/legacyCompatibility';
import { loadUnifiedReadingForLegacyEndpoint } from '../../../../lib/natalReading/legacyCompatibilityApi';

export const config = { maxDuration: 90 };

function readSectionKey(req: NextApiRequest): HumanPaidSectionKey | null {
  const raw = req.method === 'GET' ? req.query.sectionKey : req.body?.sectionKey;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isHumanPaidSectionKey(String(value || '').trim())
    ? String(value || '').trim() as HumanPaidSectionKey
    : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  const sectionKey = readSectionKey(req);
  if (!sectionKey) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'sectionKey must be a paid human interpretation section key',
    });
  }
  const ready = await ensureValidContext(req, res, {
    requireCanonicalSnapshot: true,
    repairCanonicalSnapshot: false,
  });
  if (!ready) return;
  const { userId, ctx } = ready;

  const entitlement = await getPremiumEntitlementState(userId);
  if (!entitlement.isPremium) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      message: 'Этот раздел доступен в Premium.',
    });
  }

  try {
    const unified = await loadUnifiedReadingForLegacyEndpoint({
      userId,
      ctx,
      method: req.method,
    });
    if (unified.status === 'not_found') {
      return res.status(404).json({ error: 'NOT_FOUND', code: 'HUMAN_SECTION_NOT_READY' });
    }
    if (unified.status === 'in_progress') {
      return res.status(202).json(generationInProgressPayload(unified.retryAfterMs));
    }

    const content = adaptUnifiedToLegacyHumanSection({
      reading: unified.interpretation.content,
      chart: ctx.chartData as unknown as NatalChartDataV2,
      profile: ctx.profile,
      sectionKey,
    });
    return res.status(200).json({
      interpretation: legacyInterpretationEnvelope(unified.interpretation, content, 'premium'),
      source: 'natal_unified_compat_v1',
      accessTier: 'premium',
    });
  } catch (error) {
    console.error(`[natal/human-section:${sectionKey}] compatibility projection failed:`, error instanceof Error ? error.message : error);
    return res.status(503).json({
      error: 'HUMAN_SECTION_GENERATION_FAILED',
      code: 'HUMAN_SECTION_GENERATION_FAILED',
      retryable: true,
    });
  }
}
