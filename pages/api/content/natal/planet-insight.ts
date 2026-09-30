import type { NextApiRequest, NextApiResponse } from 'next';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { resolveNatalContentChartContext, natalContentChartErrorStatus } from '../../../../lib/natalContentChartContext';
import { resolvePlanetInsightRequest } from '../../../../lib/planetInsights';
import { buildPlanetInsight } from '../../../../lib/planetInsightContent';
import type { NatalPlanetKey } from '../../../../lib/natalPlanetMeta';
import { getCachedNatalUnifiedReading } from '../../../../lib/natalReading/unifiedApi';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = (req.method === 'GET' ? req.query.userId : req.body?.userId) as string | undefined;
  const chartIdRaw = req.method === 'GET' ? req.query.chartId : req.body?.chartId;
  const planetIdRaw = (req.method === 'GET' ? req.query.planetId : req.body?.planetId) as string | undefined;
  const chartId = typeof chartIdRaw === 'string'
    ? Number.parseInt(chartIdRaw, 10)
    : typeof chartIdRaw === 'number'
      ? chartIdRaw
      : null;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!userId?.trim()) {
    return res.status(400).json({ error: 'Bad request', message: 'userId is required' });
  }
  const safeUserId = userId.trim();
  try {
    await requireAppUser(req, { expectedUserId: safeUserId, allowGuest: false });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    throw error;
  }

  const language = ((req.method === 'POST' ? req.body?.profile?.language : req.query.language) === 'en' ? 'en' : 'ru') as 'ru' | 'en';
  let context: Awaited<ReturnType<typeof resolveNatalContentChartContext>>;
  try {
    context = await resolveNatalContentChartContext(
      safeUserId,
      Number.isFinite(chartId as number) ? chartId : null,
      req.method === 'POST' ? req.body?.profile : undefined,
    );
  } catch (error: any) {
    const status = natalContentChartErrorStatus(error);
    if (status) return res.status(status).json({ error: error.message, code: error.code });
    throw error;
  }

  if (!context) {
    return res.status(404).json({ error: 'User not found', message: 'Profile not found' });
  }

  if (!context.chartData) {
    return res.status(409).json({
      error: 'PRIMARY_CHART_MISSING',
      message: language === 'ru'
        ? 'Для этой панели нужна сохранённая натальная карта.'
        : 'A saved natal chart is required for this panel.',
    });
  }

  const chartData = context.chartData;

  let planetRequest: { planetId: NatalPlanetKey; cacheKey: string };
  try {
    planetRequest = resolvePlanetInsightRequest(
      planetIdRaw,
      language,
      context.chartData.calculationVersion
    );
  } catch (error: any) {
    return res.status(400).json({
      error: 'INVALID_PLANET_ID',
      message: error.message,
    });
  }

  planetRequest.cacheKey += ":natal:" + context.snapshotKey;

  const entitlement = await getPremiumEntitlementState(safeUserId);
  const isPremium = entitlement.isPremium;
  const accessTier = 'premium' as const;

  if (!isPremium) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      premiumRequired: true,
      message: 'Planet insight is available in Premium.',
    });
  }

  const cached = await getCachedNatalUnifiedReading({ user: null, profile: context.profile, chartId: context.chartId, chartData }, 'premium');
  if (!cached) return res.status(404).json({ error: 'NOT_FOUND', code: 'NATAL_UNIFIED_READING_NOT_READY' });
  return res.status(200).json({
    interpretation: { ...cached, content: buildPlanetInsight(chartData, planetRequest.planetId, language) },
    source: 'natal_unified_compat_v1', chartId: context.chartId, cacheKey: cached.cacheKey,
  });
}
