import type { NextApiRequest, NextApiResponse } from 'next';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { generationInProgressPayload } from '../../../../lib/contentGenerationLock';
import {
  ensurePersonalForecast,
  getCompatibleStalePersonalForecast,
  getCachedPersonalForecast,
} from '../../../../lib/personalForecastCache';
import {
  createUnavailablePersonalForecast,
  getPersonalForecastPeriodKey,
  isCurrentPersonalForecastPeriodKey,
  normalizeForecastTimezone,
  slicePersonalForecastForAccess,
  type PersonalForecastAccessPayload,
  type PersonalForecastPeriod,
  resolvePersonalForecastWindow,
} from '../../../../lib/personalForecastContract';
import { getPersonalForecastGenerationDiagnosticCode } from '../../../../lib/personalForecastGeneration';
import { ensureValidContext } from '../../../../lib/natalReading/apiHelper';

export const config = { maxDuration: 180 };

function readPeriod(req: NextApiRequest): PersonalForecastPeriod | null {
  const raw = String(req.method === 'GET' ? req.query.period || '' : req.body?.period || '').trim();
  return (['day', 'week', 'month'] as const).includes(raw as PersonalForecastPeriod)
    ? raw as PersonalForecastPeriod
    : null;
}

function readPeriodKey(req: NextApiRequest): string {
  return String(req.method === 'GET' ? req.query.periodKey || '' : req.body?.periodKey || '').trim();
}

function responsePayload(
  forecast: Parameters<typeof slicePersonalForecastForAccess>[0],
  isPremium: boolean,
  source: PersonalForecastAccessPayload['source'],
): PersonalForecastAccessPayload {
  const sliced = slicePersonalForecastForAccess(forecast, isPremium);
  return {
    forecast: sliced.forecast,
    accessTier: isPremium ? 'premium' : 'free',
    lockedSectionIds: sliced.lockedSectionIds,
    periodLocked: sliced.periodLocked,
    source,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
  const ready = await ensureValidContext(req, res, { requireSelfChart: true });
  if (!ready) return;
  const { userId, ctx } = ready;
  if (!ctx.chartData) {
    return res.status(409).json({
      error: 'Natal chart required',
      code: 'PERSONAL_FORECAST_CHART_REQUIRED',
    });
  }
  const period = readPeriod(req);
  if (!period) {
    return res.status(400).json({
      error: 'Bad request',
      code: 'PERSONAL_FORECAST_PERIOD_INVALID',
    });
  }
  const timezone = normalizeForecastTimezone(
    ctx.chartData.timezone || ctx.profile.birthTimezone,
  );
  const requestedPeriodKey = readPeriodKey(req);
  const periodKey = requestedPeriodKey
    || getPersonalForecastPeriodKey(period, new Date(), timezone);
  if (
    requestedPeriodKey
    && !isCurrentPersonalForecastPeriodKey(period, periodKey, timezone)
  ) {
    return res.status(400).json({
      error: 'Only the current personal forecast period can be requested',
      code: 'PERSONAL_FORECAST_PERIOD_KEY_INVALID',
    });
  }
  const cacheInput = { ctx, period, periodKey };

  try {
    const entitlement = await getPremiumEntitlementState(userId);
    const cached = await getCachedPersonalForecast(cacheInput).catch((error) => {
      if (req.method === 'GET') throw error;
      console.error(
        '[personal-forecast-feed-v5] initial cache read failed; generating directly:',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    });
    if (cached) {
      return res.status(200).json(responsePayload(cached.forecast, entitlement.isPremium, 'cache'));
    }
    const stale = await getCompatibleStalePersonalForecast(cacheInput).catch((error) => {
      console.error(
        '[personal-forecast-feed-v5] compatible stale read failed:',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    });
    if (stale) {
      if (entitlement.isPremium || period === 'day') {
        void ensurePersonalForecast(cacheInput).catch((error) => {
          console.error(
            '[personal-forecast-feed-v5] lazy refresh failed:',
            error instanceof Error ? error.message : String(error),
          );
        });
      }
      return res.status(200).json(responsePayload(
        stale.forecast,
        entitlement.isPremium,
        'stale',
      ));
    }
    if (!entitlement.isPremium && period !== 'day') {
      return res.status(403).json({
        error: 'Premium required',
        code: 'PERSONAL_FORECAST_PREMIUM_REQUIRED',
      });
    }
    if (req.method === 'GET') {
      return res.status(404).json({
        error: 'Not found',
        code: 'PERSONAL_FORECAST_NOT_READY',
        forecast: createUnavailablePersonalForecast(
          period,
          periodKey,
          timezone,
          ctx.profile.language === 'en' ? 'en' : 'ru',
          'unavailable',
          'PERSONAL_FORECAST_NOT_READY',
        ),
      });
    }

    const generated = await ensurePersonalForecast(cacheInput);
    if (generated.status === 'in_progress') {
      return res.status(202).json({
        ...generationInProgressPayload(generated.retryAfterMs),
        forecast: createUnavailablePersonalForecast(
          period,
          periodKey,
          timezone,
          ctx.profile.language === 'en' ? 'en' : 'ru',
          'generating',
          'PERSONAL_FORECAST_GENERATING',
        ),
      });
    }
    return res.status(200).json(responsePayload(
      generated.value,
      entitlement.isPremium,
      generated.fromCache ? 'cache' : 'generated',
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnosticCode = getPersonalForecastGenerationDiagnosticCode(error);
    console.error('[personal-forecast-feed-v5] request failed', {
      userId,
      period,
      periodKey,
      diagnosticCode,
      name: error instanceof Error ? error.name : 'UnknownError',
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(503).json({
      error: 'Personal forecast unavailable',
      code: diagnosticCode,
      forecast: createUnavailablePersonalForecast(
        period,
        periodKey,
        timezone,
        ctx.profile.language === 'en' ? 'en' : 'ru',
        'unavailable',
        diagnosticCode,
      ),
    });
  }
}
