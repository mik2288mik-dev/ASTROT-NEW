import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentInterpretation, NatalChartData, UserProfile, WheelInsight } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { getContentLayer } from '../../../../lib/contentArchitecture';
import { db } from '../../../../lib/db';
import {
  WHEEL_INSIGHT_PROMPT_VERSION,
  buildWheelInsight,
  generateWheelInsight,
  resolveWheelInsightEntityRequest,
} from '../../../../lib/wheelInsights';

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

function normalizeInterpretation(
  interpretation: ContentInterpretation | null | undefined,
  chartData: NatalChartData,
  language: 'ru' | 'en',
  entityType: string,
  entityId: string
): ContentInterpretation<WheelInsight> | null {
  if (!interpretation) return null;
  const { request } = resolveWheelInsightEntityRequest(chartData, entityType, entityId, language);
  return {
    ...interpretation,
    content: buildWheelInsight(chartData, request, language, interpretation.content as Partial<WheelInsight>),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = (req.method === 'GET' ? req.query.userId : req.body?.userId) as string | undefined;
  const chartIdRaw = req.method === 'GET' ? req.query.chartId : req.body?.chartId;
  const entityTypeRaw = (req.method === 'GET' ? req.query.entityType : req.body?.entityType) as string | undefined;
  const entityIdRaw = (req.method === 'GET' ? req.query.entityId : req.body?.entityId) as string | undefined;
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

  if (!entityTypeRaw || !entityIdRaw) {
    return res.status(400).json({ error: 'Bad request', message: 'entityType and entityId are required' });
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
        ? 'Для интерактивного круга нужна сохранённая натальная карта.'
        : 'A saved natal chart is required for the interactive wheel.',
    });
  }

  let insightRequest: { request: ReturnType<typeof resolveWheelInsightEntityRequest>['request']; cacheKey: string };
  try {
    insightRequest = resolveWheelInsightEntityRequest(
      context.chartData,
      entityTypeRaw,
      entityIdRaw,
      language
    );
  } catch (error: any) {
    return res.status(400).json({
      error: 'INVALID_WHEEL_ENTITY',
      message: error.message,
    });
  }

  const existing = await getContentLayer({
    userId: userId.trim(),
    chartId: context.chartId,
    accessTier: 'free',
    contentSurface: 'natal',
    contentVariant: 'wheel_insight',
    cacheKey: insightRequest.cacheKey,
  });

  if (existing.interpretation) {
    return res.status(200).json({
      interpretation: normalizeInterpretation(
        existing.interpretation,
        context.chartData,
        language,
        insightRequest.request.entityType,
        insightRequest.request.entityId
      ),
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
    });
  }

  if (req.method === 'GET') {
    return res.status(404).json({
      error: 'NOT_FOUND',
      code: 'WHEEL_INSIGHT_NOT_FOUND',
      message: language === 'ru'
        ? 'Объяснение для этого элемента круга ещё не готово.'
        : 'This wheel insight is not ready yet.',
    });
  }

  try {
    const reading = await generateWheelInsight(context.profile, context.chartData, insightRequest.request);
    const { modelTier } = await getOpenAIModelForContent({
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'wheel_insight',
    });

    const interpretation = context.chartId != null
      ? await db.content_interpretations.upsertByChart(context.chartId, {
          accessTier: 'free',
          contentSurface: 'natal',
          contentVariant: 'wheel_insight',
          cacheKey: insightRequest.cacheKey,
          inputHash: insightRequest.cacheKey,
          content: reading,
          modelTier,
          promptVersion: WHEEL_INSIGHT_PROMPT_VERSION,
          calculationVersion: context.chartData.calculationVersion || null,
          isPersistent: true,
          canRegenerateForLumi: false,
          legacySource: 'natal_v2.wheel_insight',
        }, userId.trim())
      : await db.content_interpretations.upsertByUser(userId.trim(), {
          accessTier: 'free',
          contentSurface: 'natal',
          contentVariant: 'wheel_insight',
          cacheKey: insightRequest.cacheKey,
          inputHash: insightRequest.cacheKey,
          content: reading,
          modelTier,
          promptVersion: WHEEL_INSIGHT_PROMPT_VERSION,
          calculationVersion: context.chartData.calculationVersion || null,
          isPersistent: true,
          canRegenerateForLumi: false,
          legacySource: 'natal_v2.wheel_insight',
        });

    return res.status(200).json({
      interpretation: normalizeInterpretation(
        interpretation,
        context.chartData,
        language,
        insightRequest.request.entityType,
        insightRequest.request.entityId
      ),
      source: 'generated',
      chartId: context.chartId,
      cacheKey: insightRequest.cacheKey,
    });
  } catch {
    return res.status(200).json({
      interpretation: {
        content: buildWheelInsight(context.chartData, insightRequest.request, language),
      },
      source: 'fallback',
      chartId: context.chartId,
      cacheKey: insightRequest.cacheKey,
    });
  }
}
