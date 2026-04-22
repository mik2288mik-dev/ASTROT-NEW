import type { NextApiRequest, NextApiResponse } from 'next';
import type { ContentInterpretation, NatalChartData, NatalLivingReading, UserProfile } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { db } from '../../../../lib/db';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { generateNatalLivingReading } from '../../../../lib/natalContent';
import {
  buildNatalLivingCacheKey,
  coerceNatalLivingReading,
  getCurrentNatalPeriodKey,
  NATAL_LIVING_PROMPT_VERSION,
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

function getPeriodWindow(periodKey: string) {
  const [yearPart, monthPart, dayPart] = periodKey.split('-');
  const year = Number.parseInt(yearPart || '', 10);
  const month = Number.parseInt(monthPart || '', 10);
  const day = Number.parseInt(dayPart || '', 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return { validFrom: null, validTo: null };
  }

  if (Number.isFinite(day) && day >= 1 && day <= 31) {
    const start = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0, 0));
    return {
      validFrom: start.toISOString(),
      validTo: end.toISOString(),
    };
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return {
    validFrom: start.toISOString(),
    validTo: end.toISOString(),
  };
}

function normalizeInterpretation(
  interpretation: ContentInterpretation | null | undefined,
  language: 'ru' | 'en',
  periodKey: string
): ContentInterpretation<NatalLivingReading> | null {
  if (!interpretation) return null;
  return {
    ...interpretation,
    content: coerceNatalLivingReading(interpretation.content, language, periodKey),
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
  const periodKey = req.method === 'GET'
    ? (typeof req.query.periodKey === 'string' && req.query.periodKey.trim() ? req.query.periodKey.trim() : getCurrentNatalPeriodKey())
    : (typeof req.body?.periodKey === 'string' && req.body.periodKey.trim() ? req.body.periodKey.trim() : getCurrentNatalPeriodKey());
  const cacheKey = buildNatalLivingCacheKey(periodKey);

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
        ? 'Для этой части натальной карты нужна сохранённая карта.'
        : 'A saved natal chart is required for this natal reading.',
    });
  }

  const entitlement = await getPremiumEntitlementState(userId.trim());
  if (!entitlement.isPremium) {
    return res.status(403).json({
      error: 'Premium required',
      code: 'PREMIUM_REQUIRED',
      message: context.profile.language === 'ru'
        ? 'Эта часть натальной карты доступна после открытия полного чтения.'
        : 'This part of the natal reading is available after unlocking the full reading.',
    });
  }

  if (req.method === 'GET') {
    const result = await getContentLayer({
      userId: userId.trim(),
      chartId: context.chartId,
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant: 'living',
      cacheKey,
    });

    if (!result.interpretation) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        code: 'NATAL_LIVING_NOT_FOUND',
        message: context.profile.language === 'ru'
          ? 'Ежедневная интерпретация пока не подготовлена.'
          : 'The daily natal reading is not ready yet.',
      });
    }

    return res.status(200).json({
      interpretation: normalizeInterpretation(result.interpretation, context.profile.language, periodKey),
      source: result.source,
      chartId: result.chartId,
      cacheKey: result.cacheKey,
      entitlement: entitlement.entitlement,
    });
  }

  const existing = await getContentLayer({
    userId: userId.trim(),
    chartId: context.chartId,
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant: 'living',
      cacheKey,
  });

  if (existing.interpretation) {
    return res.status(200).json({
      interpretation: normalizeInterpretation(existing.interpretation, context.profile.language, periodKey),
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
      entitlement: entitlement.entitlement,
    });
  }

  const reading = await generateNatalLivingReading(context.profile, context.chartData, periodKey);
  const { modelTier } = await getOpenAIModelForContent({
    accessTier: 'premium',
    contentSurface: 'natal',
    contentVariant: 'living',
  });
  const periodWindow = getPeriodWindow(periodKey);
  const interpretation = context.chartId != null
    ? await db.content_interpretations.upsertByChart(context.chartId, {
        accessTier: 'premium',
        contentSurface: 'natal',
        contentVariant: 'living',
        cacheKey,
        inputHash: cacheKey,
        content: reading,
        modelTier,
        validFrom: periodWindow.validFrom,
        validTo: periodWindow.validTo,
        isPersistent: false,
        canRegenerateForLumi: false,
        legacySource: NATAL_LIVING_PROMPT_VERSION,
      }, userId.trim())
    : await db.content_interpretations.upsertByUser(userId.trim(), {
        accessTier: 'premium',
        contentSurface: 'natal',
        contentVariant: 'living',
        cacheKey,
        inputHash: cacheKey,
        content: reading,
        modelTier,
        validFrom: periodWindow.validFrom,
        validTo: periodWindow.validTo,
        isPersistent: false,
        canRegenerateForLumi: false,
        legacySource: NATAL_LIVING_PROMPT_VERSION,
      });

  return res.status(200).json({
    interpretation: normalizeInterpretation(interpretation, context.profile.language, periodKey),
    source: 'generated',
    chartId: context.chartId,
    cacheKey,
    entitlement: entitlement.entitlement,
  });
}
