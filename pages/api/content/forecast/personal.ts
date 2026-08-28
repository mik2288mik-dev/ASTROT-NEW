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
} from '../../../../lib/personalForecastContract';
import { getPersonalForecastGenerationDiagnosticCode } from '../../../../lib/personalForecastGeneration';
import {
  buildPersonalForecastPrewarmProfile,
  queuePersonalForecastPrewarm,
} from '../../../../lib/personalForecastPrewarm';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { birthProfileRepository } from '../../../../lib/birthProfileRepository';
import { db } from '../../../../lib/db';
import { diagnosticErrorCode } from '../../../../lib/diagnosticTrace';
import { startServerOperationalDiagnostic } from '../../../../lib/serverOperationalDiagnostics';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';

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

function readRegenerate(req: NextApiRequest): boolean {
  return req.method === 'POST' && req.body?.regenerate === true;
}

function readRegenerationAfter(req: NextApiRequest): string | null {
  if (req.method !== 'POST' || typeof req.body?.regenerationAfter !== 'string') {
    return null;
  }
  const timestamp = new Date(req.body.regenerationAfter).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
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
  const diagnostic = startServerOperationalDiagnostic(req, res, 'personal_forecast');
  if (req.method !== 'GET' && req.method !== 'POST') {
    diagnostic.log('request', 'error', { httpStatus: 405, errorCode: 'METHOD_NOT_ALLOWED' });
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
  try {
  const auth = await requireAppUser(req, { allowGuest: true });
  const userId = String(auth.userId);
  const [user, birthSettings] = await Promise.all([
    db.users.get(userId, { hydratePrimaryChart: false }),
    birthProfileRepository.get(userId),
  ]);
  const profile = buildPersonalForecastPrewarmProfile(userId, user, birthSettings);
  if (!profile) {
    diagnostic.log('profile', 'error', { httpStatus: 409, errorCode: 'PERSONAL_FORECAST_PROFILE_REQUIRED' });
    return res.status(409).json({ error: 'Birth profile required', code: 'PERSONAL_FORECAST_PROFILE_REQUIRED' });
  }
  const period = readPeriod(req);
  if (!period) {
    diagnostic.log('validation', 'error', { httpStatus: 400, errorCode: 'PERSONAL_FORECAST_PERIOD_INVALID' });
    return res.status(400).json({
      error: 'Bad request',
      code: 'PERSONAL_FORECAST_PERIOD_INVALID',
    });
  }
  const timezone = normalizeForecastTimezone(profile.birthTimezone);
  const requestedPeriodKey = readPeriodKey(req);
  const periodKey = requestedPeriodKey
    || getPersonalForecastPeriodKey(period, new Date(), timezone);
  if (
    requestedPeriodKey
    && !isCurrentPersonalForecastPeriodKey(period, periodKey, timezone)
  ) {
    diagnostic.log('validation', 'error', { period, httpStatus: 400, errorCode: 'PERSONAL_FORECAST_PERIOD_KEY_INVALID' });
    return res.status(400).json({
      error: 'Only the current personal forecast period can be requested',
      code: 'PERSONAL_FORECAST_PERIOD_KEY_INVALID',
    });
  }
  const regenerate = readRegenerate(req);
  const regenerationAfter = readRegenerationAfter(req);
  const entitlement = await getPremiumEntitlementState(userId);
  const cacheInput = { userId, profile, accessTier: entitlement.isPremium ? 'premium' as const : 'free' as const, period, periodKey };
  if (!entitlement.isPremium && period !== 'day') {
    diagnostic.log('access', 'error', { period, httpStatus: 403, errorCode: 'PERSONAL_FORECAST_PREMIUM_REQUIRED' });
    return res.status(403).json({
      error: 'Premium required',
      code: 'PERSONAL_FORECAST_PREMIUM_REQUIRED',
    });
  }
  const queueRollingPrewarm = () => queuePersonalForecastPrewarm({
    userId,
    profile,
    accessTier: cacheInput.accessTier,
    reason: 'forecast_open',
  });

  try {
    if (!regenerate) {
      const cached = await getCachedPersonalForecast(cacheInput).catch((error) => {
        if (req.method === 'GET') throw error;
        diagnostic.error('cache_read', error, 'PERSONAL_FORECAST_CACHE_READ_FAILED', { period });
        return null;
      });
      if (cached) {
        const generatedAt = new Date(cached.forecast.meta.generatedAt).getTime();
        const minimumGeneratedAt = regenerationAfter
          ? new Date(regenerationAfter).getTime()
          : Number.NaN;
        if (
          !Number.isFinite(minimumGeneratedAt)
          || generatedAt > minimumGeneratedAt
        ) {
          queueRollingPrewarm();
          diagnostic.log('cache_read', 'cache_hit', { period, source: 'cache', httpStatus: 200 });
          return res.status(200).json(
            responsePayload(cached.forecast, entitlement.isPremium, 'cache'),
          );
        }
      }
      const stale = regenerationAfter
        ? null
        : await getCompatibleStalePersonalForecast(cacheInput).catch((error) => {
          diagnostic.error('stale_read', error, 'PERSONAL_FORECAST_STALE_READ_FAILED', { period });
          return null;
        });
      if (stale) {
        void ensurePersonalForecast(cacheInput).catch((error) => {
          diagnostic.error('lazy_refresh', error, 'PERSONAL_FORECAST_LAZY_REFRESH_FAILED', { period });
        });
        queueRollingPrewarm();
        diagnostic.log('stale_read', 'cache_hit', { period, source: 'stale', httpStatus: 200 });
        return res.status(200).json(responsePayload(
          stale.forecast,
          entitlement.isPremium,
          'stale',
        ));
      }
    }
    if (req.method === 'GET') {
      // A JSON cache-miss response remains consumable by older Android APKs
      // whose native Response adapter cannot represent an empty HTTP 204.
      diagnostic.log('cache_read', 'cache_miss', { period, source: 'cache', httpStatus: 404 });
      return res.status(404).json({
        error: 'Personal forecast not ready',
        code: 'PERSONAL_FORECAST_NOT_READY',
      });
    }

    const generated = await ensurePersonalForecast(cacheInput, {
      forceRegenerate: regenerate,
      minimumGeneratedAt: regenerationAfter,
    });
    if (generated.status === 'in_progress') {
      diagnostic.log('generation', 'in_progress', { period, httpStatus: 202 });
      return res.status(202).json({
        ...generationInProgressPayload(generated.retryAfterMs),
        forecast: createUnavailablePersonalForecast(
          period,
          periodKey,
          timezone,
          profile.language,
          'generating',
          'PERSONAL_FORECAST_GENERATING',
        ),
      });
    }
    queueRollingPrewarm();
    diagnostic.log('generation', 'ok', {
      period,
      source: generated.fromCache ? 'cache' : 'generated',
      httpStatus: 200,
    });
    return res.status(200).json(responsePayload(
      generated.value,
      entitlement.isPremium,
      generated.fromCache ? 'cache' : 'generated',
    ));
  } catch (error) {
    const diagnosticCode = getPersonalForecastGenerationDiagnosticCode(error);
    diagnostic.error('generation', error, diagnosticCode, {
      period,
      errorCode: diagnosticCode,
      httpStatus: 503,
    });
    return res.status(503).json({
      error: 'Personal forecast unavailable',
      code: diagnosticCode,
      forecast: createUnavailablePersonalForecast(
        period,
        periodKey,
        timezone,
        profile.language,
        'unavailable',
        diagnosticCode,
      ),
    });
  }
  } catch (error) {
    if (error instanceof AdminAuthError) {
      diagnostic.error('request', error, error.code, {
        httpStatus: error.status,
        errorCode: error.code,
      });
      return handleAdminError(res, error);
    }
    diagnostic.error('request', error, diagnosticErrorCode(error, 'PERSONAL_FORECAST_REQUEST_FAILED'), {
      httpStatus: 503,
    });
    return res.status(503).json({
      error: 'Personal forecast unavailable',
      code: diagnosticErrorCode(error, 'PERSONAL_FORECAST_REQUEST_FAILED'),
    });
  }
}
