import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentInterpretation, NatalAnchorReading, NatalChartData, UserProfile } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { db } from '../../../../lib/db';
import { getContentLayer } from '../../../../lib/contentArchitecture';
import { generateNatalAnchorReading } from '../../../../lib/natalContent';
import {
  coerceNatalAnchorReading,
  NATAL_ANCHOR_CACHE_KEY,
  NATAL_ANCHOR_PROMPT_VERSION,
} from '../../../../lib/natalReadings';

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
  language: 'ru' | 'en'
): ContentInterpretation<NatalAnchorReading> | null {
  if (!interpretation) return null;
  return {
    ...interpretation,
    content: coerceNatalAnchorReading(interpretation.content, language),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = (req.method === 'GET' ? req.query.userId : req.body?.userId) as string | undefined;
  const chartIdRaw = req.method === 'GET' ? req.query.chartId : req.body?.chartId;
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
      message: context.profile.language === 'ru'
        ? 'Для натального разбора нужна сохранённая натальная карта.'
        : 'A saved natal chart is required for the natal reading.',
    });
  }

  if (req.method === 'GET') {
    const result = await getContentLayer({
      userId: userId.trim(),
      chartId: context.chartId,
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'anchor',
      cacheKey: NATAL_ANCHOR_CACHE_KEY,
    });

    if (!result.interpretation) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        code: 'NATAL_ANCHOR_NOT_FOUND',
        message: context.profile.language === 'ru'
          ? 'Натальная карта пока не подготовлена.'
          : 'Base natal reading was not found yet.',
      });
    }

    const interpretation = normalizeInterpretation(result.interpretation, context.profile.language);
    return res.status(200).json({
      interpretation,
      source: result.source,
      chartId: result.chartId,
      cacheKey: result.cacheKey,
    });
  }

  const existing = await getContentLayer({
    userId: userId.trim(),
    chartId: context.chartId,
    accessTier: 'free',
    contentSurface: 'natal',
    contentVariant: 'anchor',
    cacheKey: NATAL_ANCHOR_CACHE_KEY,
  });

  if (existing.interpretation) {
    const interpretation = normalizeInterpretation(existing.interpretation, context.profile.language);
    return res.status(200).json({
      interpretation,
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
    });
  }

  const reading = await generateNatalAnchorReading(context.profile, context.chartData);
  const { modelTier } = await getOpenAIModelForContent({
    accessTier: 'free',
    contentSurface: 'natal',
    contentVariant: 'anchor',
  });
  const interpretation = context.chartId != null
    ? await db.content_interpretations.upsertByChart(context.chartId, {
        accessTier: 'free',
        contentSurface: 'natal',
        contentVariant: 'anchor',
        cacheKey: NATAL_ANCHOR_CACHE_KEY,
        inputHash: NATAL_ANCHOR_CACHE_KEY,
        content: reading,
        modelTier,
        isPersistent: true,
        canRegenerateForLumi: true,
        regenerationCostLumi: 250,
        legacySource: NATAL_ANCHOR_PROMPT_VERSION,
      }, userId.trim())
    : await db.content_interpretations.upsertByUser(userId.trim(), {
        accessTier: 'free',
        contentSurface: 'natal',
        contentVariant: 'anchor',
        cacheKey: NATAL_ANCHOR_CACHE_KEY,
        inputHash: NATAL_ANCHOR_CACHE_KEY,
        content: reading,
        modelTier,
        isPersistent: true,
        canRegenerateForLumi: true,
        regenerationCostLumi: 250,
        legacySource: NATAL_ANCHOR_PROMPT_VERSION,
      });

  return res.status(200).json({
    interpretation: normalizeInterpretation(interpretation, context.profile.language),
    source: 'generated',
    chartId: context.chartId,
    cacheKey: NATAL_ANCHOR_CACHE_KEY,
  });
}
