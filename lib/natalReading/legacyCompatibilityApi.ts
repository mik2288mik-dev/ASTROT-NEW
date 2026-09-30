import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../auth/appAuth';
import { AdminAuthError, handleAdminError } from '../adminAuth';
import { getPremiumEntitlementState } from '../contentArchitecture';
import { resolveNatalContentChartContext, natalContentChartErrorStatus } from '../natalContentChartContext';
import { adaptUnifiedToLegacyAnchor, adaptUnifiedToLegacyFull, adaptUnifiedToLegacyLiving, legacyInterpretationEnvelope } from './legacyCompatibility';
import { getCurrentNatalPeriodKey } from '../natalReadings';
import { buildCanonicalNatalReport } from '../natal/canonicalReport';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import type { ContentInterpretation } from '../../types';
import type { ReadingContext } from './apiHelper';
import {
  getCachedNatalUnifiedReading,
} from './unifiedApi';
import type { NatalUnifiedReading } from './unifiedReading';

export type LegacyUnifiedLoadResult =
  | {
      status: 'ready';
      interpretation: ContentInterpretation<NatalUnifiedReading>;
      source: string;
      fromCache: boolean;
    }
  | {
      status: 'not_found';
    }
  | {
      status: 'in_progress';
      retryAfterMs: number;
    };

export async function loadUnifiedReadingForLegacyEndpoint(input: {
  userId: string;
  ctx: ReadingContext;
  method: 'GET' | 'POST';
}): Promise<LegacyUnifiedLoadResult> {
  const cached = await getCachedNatalUnifiedReading(input.ctx, 'premium');
  if (cached) {
    return {
      status: 'ready',
      interpretation: cached,
      source: 'natal_unified_v1',
      fromCache: true,
    };
  }

  return { status: 'not_found' };
}

/** Published routes share the saved report; even POST is a read operation. */
export function legacyNatalReadingHandler(kind: 'anchor' | 'full' | 'living') {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    const fields = req.method === 'GET' ? req.query : req.body || {};
    const userId = typeof fields.userId === 'string' ? fields.userId.trim() : '';
    if (!userId) return res.status(400).json({ error: 'BAD_REQUEST' });
    try {
      await requireAppUser(req, { expectedUserId: userId, allowGuest: false });
      const chartId = Number.parseInt(String(fields.chartId), 10);
      const context = await resolveNatalContentChartContext(userId, Number.isFinite(chartId) ? chartId : null);
      if (!context) return res.status(404).json({ error: 'NOT_FOUND' });
      if (!context.chartData || context.chartData.schemaVersion !== 'natal-chart-data-v2') return res.status(409).json({ error: 'CHART_REPAIR_REQUIRED', code: 'CHART_REPAIR_REQUIRED' });
      const tier = kind === 'anchor' ? 'free' : 'premium';
      const entitlement = tier === 'premium' ? await getPremiumEntitlementState(userId) : null;
      if (entitlement && !entitlement.isPremium) return res.status(403).json({ error: 'Premium required', code: 'PREMIUM_REQUIRED', premiumRequired: true });
      const ctx = { user: null, profile: context.profile, chartId: context.chartId, chartData: context.chartData };
      const cached = await getCachedNatalUnifiedReading(ctx, 'premium');
      if (!cached) return res.status(404).json({ error: 'NOT_FOUND', code: 'NATAL_UNIFIED_READING_NOT_READY' });
      const language = context.profile.language === 'en' ? 'en' : 'ru';
      const reading = cached.content;
      const chart = context.chartData as unknown as NatalChartDataV2;
      const content = kind === 'anchor' ? adaptUnifiedToLegacyAnchor(reading, language, chart)
        : kind === 'full' ? adaptUnifiedToLegacyFull(reading, language, chart)
        : adaptUnifiedToLegacyLiving(reading, language, typeof fields.periodKey === 'string' ? fields.periodKey : getCurrentNatalPeriodKey(), chart);
      return res.status(200).json({ interpretation: legacyInterpretationEnvelope(cached, content, tier),
        source: 'natal_unified_compat_v1', chartId: context.chartId, cacheKey: cached.cacheKey,
        ...(kind === 'anchor' ? { baseReport: buildCanonicalNatalReport(chart) } : {}),
        ...(entitlement ? { entitlement: entitlement.entitlement } : {}) });
    } catch (error) {
      if (error instanceof AdminAuthError) return handleAdminError(res, error);
      const status = natalContentChartErrorStatus(error);
      if (status) return res.status(status).json({ error: (error as Error).message, code: (error as { code?: string }).code });
      console.error('[natal/legacy] saved reading unavailable:', error instanceof Error ? error.message : error);
      return res.status(503).json({ error: 'NATAL_READING_UNAVAILABLE' });
    }
  };
}
