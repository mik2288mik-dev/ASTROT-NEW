import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentInterpretation, NatalChartData, PlanetInsight, UserProfile } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { getContentLayer } from '../../../../lib/contentArchitecture';
import { db } from '../../../../lib/db';
import {
  PLANET_INSIGHT_PROMPT_VERSION,
  generatePlanetInsight,
  resolvePlanetInsightRequest,
} from '../../../../lib/planetInsights';
import { buildPlanetInsight } from '../../../../lib/planetInsightContent';
import { type NatalPlanetKey } from '../../../../lib/natalPlanetMeta';

function toProfile(user: any, fallback?: Partial<UserProfile>): UserProfile {
  return {
    id: user.id,
    name: fallback?.name || user.name || '',
    birthDate: fallback?.birthDate || user.birth_date || '',
    birthTime: fallback?.birthTime || user.birth_time || '12:00',
    birthPlace: fallback?.birthPlace || user.birth_place || '',
    isSetup: user.is_setup ?? true,
    language: (fallback?.language as 'ru' | 'en') || user.language || 'ru',
    theme: (fallback?.theme as 'dark' | 'light') || user.theme || 'dark',
    isPremium: !!user.is_premium,
    isAdmin: !!user.is_admin,
    lumiBalance: user.lumi_balance ?? 0,
    loginStreak: user.login_streak ?? 0,
    chartSlots: user.chart_slots ?? 1,
    generatedContent: fallback?.generatedContent,
  };
}

async function resolveContext(
  userId: string,
  chartId?: number | null,
  profileFallback?: Partial<UserProfile>,
  chartDataFallback?: NatalChartData | null
) {
  const user = await db.users.get(userId);
  if (!user) return null;

  const chart = chartId != null
    ? await db.natal_charts.getById(chartId)
    : await db.natal_charts.getPrimary(userId);

  if (!chart?.chart_data && !chartDataFallback) {
    return { user, profile: toProfile(user, profileFallback), chartId: chart?.id ?? null, chartData: null };
  }

  return {
    user,
    profile: toProfile(user, profileFallback),
    chartId: chart?.id ?? null,
    chartData: (chartDataFallback || chart?.chart_data || null) as NatalChartData | null,
  };
}

function normalizeInsight(
  interpretation: ContentInterpretation | null | undefined,
  chartData: NatalChartData,
  planetId: NatalPlanetKey,
  language: 'ru' | 'en'
): ContentInterpretation<PlanetInsight> | null {
  if (!interpretation) return null;
  return {
    ...interpretation,
    content: buildPlanetInsight(chartData, planetId, language, interpretation.content as PlanetInsight),
  };
}

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

  const language = ((req.method === 'POST' ? req.body?.profile?.language : req.query.language) === 'en' ? 'en' : 'ru') as 'ru' | 'en';
  const context = await resolveContext(
    userId.trim(),
    Number.isFinite(chartId as number) ? chartId : null,
    req.method === 'POST' ? req.body?.profile : undefined,
    req.method === 'POST' ? req.body?.chartData : undefined
  );

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

  const entitlement = await db.premium_entitlements.getActive(userId.trim());
  const isPremium = !!entitlement || !!context.profile.isPremium;
  const accessTier = isPremium ? 'premium' : 'free';

  const existing = await getContentLayer({
    userId: userId.trim(),
    chartId: context.chartId,
    accessTier,
    contentSurface: 'natal',
    contentVariant: 'planet_insight',
    cacheKey: planetRequest.cacheKey,
  });

  if (existing.interpretation) {
    return res.status(200).json({
      interpretation: normalizeInsight(existing.interpretation, context.chartData, planetRequest.planetId, language),
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
    });
  }

  if (req.method === 'GET') {
    return res.status(404).json({
      error: 'NOT_FOUND',
      code: 'PLANET_INSIGHT_NOT_FOUND',
      message: language === 'ru'
        ? 'Инсайт для этой планеты пока не готов.'
        : 'This planet insight is not ready yet.',
    });
  }

  try {
    const profileForGeneration: UserProfile = { ...context.profile, isPremium };
    const reading = await generatePlanetInsight(profileForGeneration, context.chartData, planetRequest.planetId);
    const { modelTier } = await getOpenAIModelForContent({
      accessTier,
      contentSurface: 'natal',
      contentVariant: 'planet_insight',
    });

    const interpretation = context.chartId != null
      ? await db.content_interpretations.upsertByChart(context.chartId, {
          accessTier,
          contentSurface: 'natal',
          contentVariant: 'planet_insight',
          cacheKey: planetRequest.cacheKey,
          inputHash: planetRequest.cacheKey,
          content: reading,
          modelTier,
          promptVersion: PLANET_INSIGHT_PROMPT_VERSION,
          calculationVersion: context.chartData.calculationVersion || null,
          isPersistent: false,
          canRegenerateForLumi: false,
          legacySource: 'natal_v2.planet_insight',
        }, userId.trim())
      : await db.content_interpretations.upsertByUser(userId.trim(), {
          accessTier,
          contentSurface: 'natal',
          contentVariant: 'planet_insight',
          cacheKey: planetRequest.cacheKey,
          inputHash: planetRequest.cacheKey,
          content: reading,
          modelTier,
          promptVersion: PLANET_INSIGHT_PROMPT_VERSION,
          calculationVersion: context.chartData.calculationVersion || null,
          isPersistent: false,
          canRegenerateForLumi: false,
          legacySource: 'natal_v2.planet_insight',
        });

    return res.status(200).json({
      interpretation: normalizeInsight(interpretation, context.chartData, planetRequest.planetId, language),
      source: 'generated',
      chartId: context.chartId,
      cacheKey: planetRequest.cacheKey,
    });
  } catch {
    return res.status(200).json({
      interpretation: {
        content: buildPlanetInsight(context.chartData, planetRequest.planetId, language),
      },
      source: 'fallback',
      chartId: context.chartId,
      cacheKey: planetRequest.cacheKey,
    });
  }
}
