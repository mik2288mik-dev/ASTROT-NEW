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
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { db } from '../../../../lib/db';

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
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }
  const auth = await requireAppUser(req, { allowGuest: true });
  const userId = String(auth.userId);
  const user = await db.users.get(userId);
  if (!user || !String(user.name || '').trim() || !String(user.birth_date || '').trim()) {
    return res.status(409).json({ error: 'Birth profile required', code: 'PERSONAL_FORECAST_PROFILE_REQUIRED' });
  }
  const stored = user as any;
  const profile = {
    id: userId, name: user.name || '', birthDate: String(user.birth_date || ''), birthTime: user.birth_time || '',
    birthTimeMode: stored.birth_time_mode || undefined, birthTimeUncertaintyMinutes: stored.birth_time_uncertainty_minutes ?? null,
    birthPlace: user.birth_place || '', birthTimezone: stored.birth_timezone || null,
    gender: stored.gender === 'male' || stored.gender === 'female' ? stored.gender : 'unspecified', language: user.language === 'en' ? 'en' as const : 'ru' as const,
  };
  const period = readPeriod(req);
  if (!period) {
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
    return res.status(400).json({
      error: 'Only the current personal forecast period can be requested',
      code: 'PERSONAL_FORECAST_PERIOD_KEY_INVALID',
    });
  }
  const regenerate = readRegenerate(req);
  const regenerationAfter = readRegenerationAfter(req);
  const entitlement = await getPremiumEntitlementState(userId);
  const cacheInput = { userId, profile, accessTier: entitlement.isPremium ? 'premium' as const : 'free' as const, period, periodKey };

  try {
    if (!regenerate) {
      const cached = await getCachedPersonalForecast(cacheInput).catch((error) => {
        if (req.method === 'GET') throw error;
        console.error(
          '[personal-forecast] initial cache read failed; generating directly:',
          error instanceof Error ? error.message : String(error),
        );
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
          return res.status(200).json(
            responsePayload(cached.forecast, entitlement.isPremium, 'cache'),
          );
        }
      }
      const stale = regenerationAfter
        ? null
        : await getCompatibleStalePersonalForecast(cacheInput).catch((error) => {
          console.error(
            '[personal-forecast] compatible stale read failed:',
            error instanceof Error ? error.message : String(error),
          );
          return null;
        });
      if (stale) {
        if (entitlement.isPremium || period === 'day') {
          void ensurePersonalForecast(cacheInput).catch((error) => {
            console.error(
              '[personal-forecast] lazy refresh failed:',
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
    }
    if (!entitlement.isPremium && period !== 'day') {
      return res.status(403).json({
        error: 'Premium required',
        code: 'PERSONAL_FORECAST_PREMIUM_REQUIRED',
      });
    }
    if (req.method === 'GET') return res.status(204).end();

    const generated = await ensurePersonalForecast(cacheInput, {
      forceRegenerate: regenerate,
      minimumGeneratedAt: regenerationAfter,
    });
    if (generated.status === 'in_progress') {
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
    return res.status(200).json(responsePayload(
      generated.value,
      entitlement.isPremium,
      generated.fromCache ? 'cache' : 'generated',
    ));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const diagnosticCode = getPersonalForecastGenerationDiagnosticCode(error);
    console.error('[personal-forecast] request failed', {
      userId,
      period,
      periodKey,
      regenerate,
      regenerationAfter,
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
        profile.language,
        'unavailable',
        diagnosticCode,
      ),
    });
  }
}
