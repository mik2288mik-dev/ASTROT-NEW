import type { NextApiRequest, NextApiResponse } from 'next';
import type { ForecastDaypartSlot, NatalChartData, UserProfile } from '../../../../types';
import { getOpenAIModelForContent } from '../../../../lib/appSettings';
import { getContentLayer, getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { getContentAccessConfig } from '../../../../lib/contentAccessMatrix';
import {
  buildContentAccessUserState,
  canAccessForecastDaypart,
  hasExistingUnlock,
} from '../../../../lib/contentAccessUserState';
import { db } from '../../../../lib/db';
import { getMoscowTodayKey } from '../../../../lib/date-utils';
import { generatePremiumDaypartForecast } from '../../../../lib/forecastContent';
import {
  buildForecastDaypartCacheKey,
  buildForecastFullDayUnlockCacheKey,
  FORECAST_FULL_DAY_STARS_COST,
} from '../../../../lib/forecastFullDay';
import { logger } from '../../../../lib/logger';
import { unlockContentAfterStarsPayment, unlockContentAfterStarsPaymentNonce, StarsPaymentError } from '../../../../lib/starsContentUnlock';
import { invalidUserIdPayload, isValidUserId } from '../../../../lib/userId';

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

function getLockedMessage(lang: 'ru' | 'en', starsCost: number) {
  return lang === 'ru'
    ? `Полный слой дня доступен в Lumia Premium или открывается разово за ${starsCost} Stars.`
    : `The full day layer is available in Lumia Premium or as a one-off unlock for ${starsCost} Stars.`;
}

function getStarsRequiredMessage(lang: 'ru' | 'en', starsCost: number) {
  return lang === 'ru'
    ? `Полный прогноз дня можно открыть за ${starsCost} Stars.`
    : `The full day forecast can be unlocked for ${starsCost} Stars.`;
}

function getStarsPendingMessage(lang: 'ru' | 'en') {
  return lang === 'ru'
    ? 'Платёж ещё подтверждается. Подождите пару секунд.'
    : 'Payment is still being confirmed. Please wait a moment.';
}

function buildLockedPayload(starsCost: number, dateKey: string, unlockCacheKey: string) {
  return {
    starsCost,
    starsPaymentRequired: true,
    invoiceType: 'forecast_full_day' as const,
    canCreateInvoice: true,
    date: dateKey,
    cacheKey: unlockCacheKey,
  };
}

type ResolvedAccess = {
  accessTier: 'premium' | 'stars';
  entitlement: Awaited<ReturnType<typeof getPremiumEntitlementState>>['entitlement'];
};

async function resolveAccess(
  userId: string,
  chartId: number | null,
  slot: ForecastDaypartSlot,
  unlockCacheKey: string
): Promise<ResolvedAccess | null> {
  const [userState, entitlementState] = await Promise.all([
    buildContentAccessUserState(userId, chartId),
    getPremiumEntitlementState(userId),
  ]);
  const accessConfig = getContentAccessConfig('forecast', slot);
  const starsCost = accessConfig?.starsCost ?? FORECAST_FULL_DAY_STARS_COST;

  logger.info({
    scope: 'forecast-daypart',
    event: 'access_check',
    userId,
    chartId,
    surface: 'forecast',
    variant: slot,
    accessTier: accessConfig?.defaultAccessTier,
    metadata: {
      unlockCacheKey,
      starsCost,
      isPremium: userState.isPremium,
      hasFullDayUnlock: hasExistingUnlock(userState, 'forecast', 'full', unlockCacheKey),
      matrixAllowed: canAccessForecastDaypart(userState, slot, unlockCacheKey),
    },
  });

  if (userState.isPremium) {
    logger.info({
      scope: 'forecast-daypart',
      event: 'premium_allowed',
      userId,
      chartId,
      surface: 'forecast',
      variant: slot,
      accessTier: 'premium',
    });
    return {
      accessTier: 'premium',
      entitlement: entitlementState.entitlement,
    };
  }

  if (canAccessForecastDaypart(userState, slot, unlockCacheKey)) {
    logger.info({
      scope: 'forecast-daypart',
      event: 'stars_unlock_found',
      userId,
      chartId,
      surface: 'forecast',
      variant: slot,
      accessTier: 'stars',
    });
    return {
      accessTier: 'stars',
      entitlement: entitlementState.entitlement,
    };
  }

  logger.warn({
    scope: 'forecast-daypart',
    event: 'access_denied',
    userId,
    chartId,
    surface: 'forecast',
    variant: slot,
    status: 'denied',
  });

  return null;
}

async function loadDaypartLayer(
  userId: string,
  chartId: number | null,
  accessTier: 'premium' | 'stars',
  slot: ForecastDaypartSlot,
  cacheKey: string
) {
  const primary = await getContentLayer({
    userId,
    chartId,
    accessTier,
    contentSurface: 'forecast',
    contentVariant: slot,
    cacheKey,
  });
  if (primary.interpretation || accessTier !== 'stars') {
    return primary;
  }

  // Legacy-only: read interpretations stored under pre-Stars `lumi` access tier.
  return getContentLayer({
    userId,
    chartId,
    accessTier: 'lumi',
    contentSurface: 'forecast',
    contentVariant: slot,
    cacheKey,
  });
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
  const starsPaymentChargeId = req.method === 'POST'
    ? String(req.body?.starsPaymentChargeId || req.body?.telegramPaymentChargeId || '').trim()
    : '';
  const paymentNonce = req.method === 'POST'
    ? String(req.body?.paymentNonce || '').trim()
    : '';
  const dateKey = req.method === 'GET'
    ? (typeof req.query.date === 'string' && req.query.date.trim() ? req.query.date.trim() : getMoscowTodayKey())
    : (typeof req.body?.date === 'string' && req.body.date.trim() ? req.body.date.trim() : getMoscowTodayKey());

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const languageFromRequest = req.method === 'POST' && req.body?.profile?.language === 'en' ? 'en' : 'ru';
  if (!isValidUserId(userId)) {
    return res.status(400).json(invalidUserIdPayload(languageFromRequest));
  }
  const safeUserId = String(userId).trim();

  if (!slot) {
    return res.status(400).json({ error: 'Bad request', message: 'slot is required' });
  }

  if (!ALLOWED_SLOTS.has(slot)) {
    return res.status(400).json({ error: 'Bad request', message: 'slot must be one of morning, day, evening' });
  }

  const context = await resolveContext(
    safeUserId,
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
  const daypartConfig = getContentAccessConfig('forecast', slot);
  const starsCost = daypartConfig?.starsCost ?? FORECAST_FULL_DAY_STARS_COST;
  let access = await resolveAccess(safeUserId, context.chartId, slot, unlockCacheKey);

  if (req.method === 'GET') {
    if (!access) {
      logger.warn({
        scope: 'forecast-daypart',
        event: 'premium_required',
        userId: safeUserId,
        chartId: context.chartId,
        surface: 'forecast',
        variant: slot,
        errorCode: 'FULL_DAY_LOCKED',
        metadata: { starsCost },
      });
      return res.status(403).json({
        error: 'Full day locked',
        code: 'FULL_DAY_LOCKED',
        message: getLockedMessage(lang, starsCost),
        ...buildLockedPayload(starsCost, dateKey, unlockCacheKey),
      });
    }

    const result = await loadDaypartLayer(
      safeUserId,
      context.chartId,
      access.accessTier,
      slot,
      cacheKey
    );

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
      accessTier: access.accessTier,
      starsPaymentRequired: false,
    });
  }

  if (!access) {
    const hasPaymentCredential = !!paymentNonce || !!starsPaymentChargeId;
    if (!hasPaymentCredential) {
      logger.warn({
        scope: 'forecast-daypart',
        event: 'stars_payment_required',
        userId: safeUserId,
        chartId: context.chartId,
        surface: 'forecast',
        variant: slot,
        errorCode: 'STARS_PAYMENT_REQUIRED',
        metadata: { starsCost, hasPaymentNonce: false, paymentStatus: 'missing', dateKey },
      });
      return res.status(409).json({
        error: 'Stars payment required',
        code: 'STARS_PAYMENT_REQUIRED',
        message: getStarsRequiredMessage(lang, starsCost),
        ...buildLockedPayload(starsCost, dateKey, unlockCacheKey),
      });
    }

    if (paymentNonce) {
      const confirmedPayment = await db.star_payments.findConfirmedUnconsumedForPayload({
        userId: safeUserId,
        paymentType: 'content_unlock',
        contentSurface: 'forecast',
        contentVariant: 'full',
        starsAmount: starsCost,
        nonce: paymentNonce,
        cacheKey: unlockCacheKey,
      });

      logger.info({
        scope: 'forecast-daypart',
        event: 'stars_payment_lookup',
        userId: safeUserId,
        chartId: context.chartId,
        surface: 'forecast',
        variant: slot,
        metadata: {
          hasPaymentNonce: true,
          paymentStatus: confirmedPayment ? 'confirmed' : 'pending',
          dateKey,
        },
      });

      if (!confirmedPayment) {
        return res.status(409).json({
          error: 'Stars payment pending',
          code: 'STARS_PAYMENT_PENDING',
          message: getStarsPendingMessage(lang),
          retryAfterMs: 1200,
          ...buildLockedPayload(starsCost, dateKey, unlockCacheKey),
        });
      }
    }

    try {
      if (paymentNonce) {
        await unlockContentAfterStarsPaymentNonce({
          userId: safeUserId,
          chartId: context.chartId,
          contentSurface: 'forecast',
          contentVariant: 'full',
          cacheKey: unlockCacheKey,
          starsAmount: starsCost,
          paymentNonce,
        });
      } else {
        await unlockContentAfterStarsPayment({
          userId: safeUserId,
          chartId: context.chartId,
          contentSurface: 'forecast',
          contentVariant: 'full',
          cacheKey: unlockCacheKey,
          starsAmount: starsCost,
          starsPaymentChargeId,
        });
      }
    } catch (error: any) {
      const unlockCode = error instanceof StarsPaymentError
        ? error.code
        : error?.message || 'FORECAST_FULL_UNLOCK_FAILED';
      const statusCode = unlockCode === 'STARS_PAYMENT_PENDING' ? 409 : 500;
      logger.warn({
        scope: 'forecast-daypart',
        event: 'stars_unlock_failed',
        userId: safeUserId,
        chartId: context.chartId,
        surface: 'forecast',
        variant: slot,
        errorCode: unlockCode,
        metadata: {
          hasPaymentNonce: !!paymentNonce,
          paymentStatus: unlockCode,
          dateKey,
        },
      });
      return res.status(statusCode).json({
        error: 'Unlock failed',
        code: unlockCode,
        message: unlockCode === 'STARS_PAYMENT_PENDING'
          ? getStarsPendingMessage(lang)
          : (lang === 'ru'
            ? 'Не получилось подтвердить оплату Stars для полного слоя дня.'
            : 'Failed to confirm Telegram Stars payment for the full day layer.'),
        retryAfterMs: unlockCode === 'STARS_PAYMENT_PENDING' ? 1200 : undefined,
        ...buildLockedPayload(starsCost, dateKey, unlockCacheKey),
      });
    }

    access = await resolveAccess(safeUserId, context.chartId, slot, unlockCacheKey);
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

  const existing = await loadDaypartLayer(
    safeUserId,
    context.chartId,
    access.accessTier,
    slot,
    cacheKey
  );

  if (existing.interpretation) {
    return res.status(200).json({
      interpretation: existing.interpretation,
      source: existing.source,
      chartId: existing.chartId,
      cacheKey: existing.cacheKey,
      entitlement: access.entitlement,
      accessTier: access.accessTier,
      starsPaymentRequired: false,
    });
  }

  let forecast;
  try {
    forecast = await generatePremiumDaypartForecast(context.profile, context.chartData, slot, dateKey, {
      allowStaticFallback: false,
    });
  } catch (error: any) {
    const status = error?.status === 503 ? 503 : 500;
    const code = error?.code || (status === 503 ? 'CONTENT_GENERATION_UNAVAILABLE' : 'FORECAST_DAYPART_FAILED');
    return res.status(status).json({
      error: code,
      code,
      message:
        lang === 'ru'
          ? 'Этот слой сейчас не удалось сгенерировать. Попробуй ещё раз.'
          : 'This layer could not be generated right now. Please try again.',
    });
  }
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
      }, safeUserId)
    : await db.content_interpretations.upsertByUser(safeUserId, {
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

  return res.status(200).json({
    interpretation,
    source: 'generated',
    chartId: context.chartId,
    cacheKey,
    entitlement: access.entitlement,
    accessTier: access.accessTier,
    starsPaymentRequired: false,
  });
}
