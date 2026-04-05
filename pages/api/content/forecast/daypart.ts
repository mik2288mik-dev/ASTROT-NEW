import type { NextApiRequest, NextApiResponse } from 'next';
import type { ForecastDaypartSlot, NatalChartData, UserProfile } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { unlockContentLayer, getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { db } from '../../../../lib/db';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import { generatePremiumDaypartForecast } from '../../../../lib/forecastContent';
import {
  buildForecastDaypartCacheKey,
  buildForecastFullDayUnlockCacheKey,
  FORECAST_FULL_DAY_LUMI_COST,
} from '../../../../lib/forecastFullDay';

const ALLOWED_SLOTS = new Set(['morning', 'day', 'evening']);

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

function getLockedMessage(lang: 'ru' | 'en', lumiCost: number) {
  return lang === 'ru'
    ? `Полный слой дня доступен в Lumia Premium или открывается разово за ${lumiCost} Lumi.`
    : `The full day layer is available in Lumia Premium or as a one-off unlock for ${lumiCost} Lumi.`;
}

function getLumiRequiredMessage(lang: 'ru' | 'en', lumiCost: number) {
  return lang === 'ru'
    ? `Полный день открывается за ${lumiCost} Lumi. Подтверди списание и попробуй ещё раз.`
    : `The full day opens for ${lumiCost} Lumi. Confirm the spend and try again.`;
}

type ResolvedAccess = {
  accessTier: 'premium' | 'lumi';
  entitlement: Awaited<ReturnType<typeof getPremiumEntitlementState>>['entitlement'];
};

async function resolveAccess(userId: string, chartId: number | null, unlockCacheKey: string): Promise<ResolvedAccess | null> {
  const entitlement = await getPremiumEntitlementState(userId);
  if (entitlement.isPremium) {
    return {
      accessTier: 'premium',
      entitlement: entitlement.entitlement,
    };
  }

  const lumiUnlock = await db.content_unlocks.getLatestActive(userId, {
    accessTier: 'lumi',
    contentSurface: 'forecast',
    contentVariant: 'full',
    chartId,
    cacheKey: unlockCacheKey,
  });

  if (lumiUnlock) {
    return {
      accessTier: 'lumi',
      entitlement: entitlement.entitlement,
    };
  }

  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = (req.method === 'GET' ? req.query.userId : req.body?.userId) as string | undefined;
  const chartIdRaw = req.method === 'GET' ? req.query.chartId : req.body?.chartId;
  const chartId = typeof chartIdRaw === 'string'
    ? Number.parseInt(chartIdRaw, 10)
    : typeof chartIdRaw === 'number'
      ? chartIdRaw
      : null;
  const slotValue = (req.method === 'GET' ? req.query.slot : req.body?.slot) as string | undefined;
  const slot = (slotValue || '').trim() as ForecastDaypartSlot;
  const requestedAccessTierRaw = (req.method === 'GET' ? req.query.accessTier : req.body?.accessTier) as string | undefined;
  const requestedAccessTier = requestedAccessTierRaw === 'lumi' ? 'lumi' : 'premium';
  const allowLumiSpend = req.method === 'POST' && Boolean(req.body?.allowLumiSpend);
  const dateKey = req.method === 'GET'
    ? (typeof req.query.date === 'string' && req.query.date.trim() ? req.query.date.trim() : getMoscowTodayKey())
    : (typeof req.body?.date === 'string' && req.body.date.trim() ? req.body.date.trim() : getMoscowTodayKey());

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!userId?.trim() || !slot) {
    return res.status(400).json({ error: 'Bad request', message: 'userId and slot are required' });
  }

  if (!ALLOWED_SLOTS.has(slot)) {
    return res.status(400).json({ error: 'Bad request', message: 'slot must be one of morning, day, evening' });
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
        ? 'Для прогноза нужна сохранённая натальная карта.'
        : 'A saved natal chart is required for the forecast.',
    });
  }

  const lang = context.profile.language === 'en' ? 'en' : 'ru';
  const unlockCacheKey = buildForecastFullDayUnlockCacheKey(dateKey);
  const cacheKey = buildForecastDaypartCacheKey(dateKey, slot);
  const lumiCost = FORECAST_FULL_DAY_LUMI_COST;
  let access = await resolveAccess(userId.trim(), context.chartId, unlockCacheKey);

  if (req.method === 'GET') {
    if (!access) {
      return res.status(403).json({
        error: 'Full day locked',
        code: 'FULL_DAY_LOCKED',
        message: getLockedMessage(lang, lumiCost),
        lumiCost,
        lumiBalance: context.user.lumi_balance ?? 0,
      });
    }

    const result = await getContentLayer({
      userId: userId.trim(),
      chartId: context.chartId,
      accessTier: access.accessTier,
      contentSurface: 'forecast',
      contentVariant: slot,
      cacheKey,
    });

    if (!result.interpretation) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        code: 'FORECAST_DAYPART_NOT_FOUND',
        message: lang === 'ru'
          ? 'Полный прогноз на этот отрезок дня пока не подготовлен.'
          : 'The full forecast for this part of the day is not ready yet.',
      });
    }

    return res.status(200).json({
      interpretation: result.interpretation,
      source: result.source,
      chartId: result.chartId,
      cacheKey: result.cacheKey,
      entitlement: access.entitlement,
      lumiBalance: context.user.lumi_balance ?? 0,
      accessTier: access.accessTier,
    });
  }

  if (!access) {
    if (requestedAccessTier !== 'lumi' || !allowLumiSpend) {
      return res.status(409).json({
        error: 'Lumi required',
        code: 'LUMI_REQUIRED',
        message: getLumiRequiredMessage(lang, lumiCost),
        lumiCost,
        lumiBalance: context.user.lumi_balance ?? 0,
      });
    }

    const balanceBefore = await db.lumi_transactions.getBalance(userId.trim());
    if (balanceBefore < lumiCost) {
      return res.status(402).json({
        error: 'Insufficient Lumi',
        code: 'INSUFFICIENT_LUMI',
        message: lang === 'ru' ? 'Недостаточно Lumi для полного дня.' : 'Not enough Lumi for the full day.',
        lumiCost,
        lumiBalance: balanceBefore,
      });
    }

    await unlockContentLayer({
      userId: userId.trim(),
      chartId: context.chartId,
      accessTier: 'lumi',
      contentSurface: 'forecast',
      contentVariant: 'full',
      cacheKey: unlockCacheKey,
      lumiCost,
    });

    access = await resolveAccess(userId.trim(), context.chartId, unlockCacheKey);
  }

  if (!access) {
    return res.status(500).json({
      error: 'Unlock failed',
      code: 'FORECAST_FULL_UNLOCK_FAILED',
      message: lang === 'ru'
        ? 'Не получилось открыть полный слой дня.'
        : 'Failed to unlock the full day layer.',
    });
  }

  const existing = await getContentLayer({
    userId: userId.trim(),
    chartId: context.chartId,
    accessTier: access.accessTier,
    contentSurface: 'forecast',
    contentVariant: slot,
    cacheKey,
  });

  if (existing.interpretation) {
    const lumiBalance = await db.lumi_transactions.getBalance(userId.trim());
    return res.status(200).json({
      interpretation: existing.interpretation,
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
      entitlement: access.entitlement,
      lumiBalance,
      accessTier: access.accessTier,
    });
  }

  const forecast = await generatePremiumDaypartForecast(context.profile, context.chartData, slot, dateKey);
  const { modelTier } = await getOpenAIModelForContent({
    accessTier: access.accessTier,
    contentSurface: 'forecast',
    contentVariant: slot,
  });
  const interpretation = context.chartId != null
    ? await db.content_interpretations.upsertByChart(context.chartId, {
        accessTier: access.accessTier,
        contentSurface: 'forecast',
        contentVariant: slot,
        cacheKey,
        inputHash: cacheKey,
        content: forecast,
        modelTier,
        validFrom: `${dateKey}T00:00:00.000Z`,
        validTo: `${dateKey}T23:59:59.999Z`,
        isPersistent: false,
        canRegenerateForLumi: false,
        legacySource: `forecast_v2.${slot}.${access.accessTier}`,
      }, userId.trim())
    : await db.content_interpretations.upsertByUser(userId.trim(), {
        accessTier: access.accessTier,
        contentSurface: 'forecast',
        contentVariant: slot,
        cacheKey,
        inputHash: cacheKey,
        content: forecast,
        modelTier,
        validFrom: `${dateKey}T00:00:00.000Z`,
        validTo: `${dateKey}T23:59:59.999Z`,
        isPersistent: false,
        canRegenerateForLumi: false,
        legacySource: `forecast_v2.${slot}.${access.accessTier}`,
      });

  const lumiBalance = await db.lumi_transactions.getBalance(userId.trim());

  return res.status(200).json({
    interpretation,
    source: 'generated',
    chartId: context.chartId,
    cacheKey,
    entitlement: access.entitlement,
    lumiBalance,
    accessTier: access.accessTier,
  });
}
