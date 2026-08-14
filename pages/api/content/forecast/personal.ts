import type { NextApiRequest, NextApiResponse } from 'next';
import type { UserProfile } from '../../../../types';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { generationInProgressPayload } from '../../../../lib/contentGenerationLock';
import { db } from '../../../../lib/db';
import { AI_PERSONAL_HOROSCOPE_TIMEZONE } from '../../../../lib/aiPersonalHoroscope';
import {
  getAiPersonalHoroscopeGenerationDiagnosticCode,
} from '../../../../lib/aiPersonalHoroscopeGeneration';
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

function readTimezone(req: NextApiRequest): string {
  const raw = String(req.method === 'GET' ? req.query.timezone || '' : req.body?.timezone || '').trim();
  return normalizeForecastTimezone(raw || AI_PERSONAL_HOROSCOPE_TIMEZONE);
}

function dateOnly(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function timeOnly(value: unknown): string {
  if (!value) return '';
  return String(value).trim().slice(0, 8);
}

function profileFromUser(
  userId: string,
  user: any,
  auth: Awaited<ReturnType<typeof requireAppUser>>,
): UserProfile {
  return {
    id: userId,
    authProvider: auth.provider,
    isGuest: auth.isGuest,
    name: String(user.name || '').trim(),
    birthDate: dateOnly(user.birth_date),
    birthTime: timeOnly(user.birth_time),
    birthPlace: String(user.birth_place || '').trim(),
    gender: user.gender === 'male' || user.gender === 'female'
      ? user.gender
      : 'unspecified',
    isSetup: user.is_setup !== false,
    language: user.language === 'en' ? 'en' : 'ru',
    theme: user.theme === 'dark' ? 'dark' : 'light',
    isPremium: !!user.is_premium,
    premiumUntil: user.premium_until
      ? new Date(user.premium_until).toISOString()
      : null,
    isAdmin: !!user.is_admin,
    loginStreak: Number(user.login_streak || 0),
    chartSlots: Number(user.chart_slots || 1),
  };
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

  let userId = '';
  let profile: UserProfile;
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    userId = auth.userId;
    const user = await db.users.get(userId, { hydratePrimaryChart: false });
    if (!user) {
      return res.status(404).json({
        error: 'Profile not found',
        code: 'PERSONAL_FORECAST_PROFILE_NOT_FOUND',
      });
    }
    profile = profileFromUser(userId, user, auth);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      handleAdminError(res, error);
      return;
    }
    throw error;
  }

  const period = readPeriod(req);
  if (!period) {
    return res.status(400).json({
      error: 'Bad request',
      code: 'PERSONAL_FORECAST_PERIOD_INVALID',
    });
  }

  const timezone = readTimezone(req);
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

  const cacheInput = { profile, period, periodKey, timezone };

  try {
    const entitlement = await getPremiumEntitlementState(userId);
    const cached = await getCachedPersonalForecast(cacheInput).catch((error) => {
      if (req.method === 'GET') throw error;
      console.error(
        '[ai-personal-horoscope] initial cache read failed; generating directly:',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    });
    if (cached) {
      return res.status(200).json(responsePayload(cached.forecast, entitlement.isPremium, 'cache'));
    }

    const stale = await getCompatibleStalePersonalForecast(cacheInput).catch((error) => {
      console.warn(
        '[ai-personal-horoscope] compatible stale read failed:',
        error instanceof Error ? error.message : String(error),
      );
      return null;
    });
    if (stale) {
      if (entitlement.isPremium || period === 'day') {
        void ensurePersonalForecast(cacheInput).catch((error) => {
          console.error(
            '[ai-personal-horoscope] lazy refresh failed:',
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
    // PERSONAL_FORECAST_NOT_READY is represented by HTTP 204 for the cache-only GET.
    if (req.method === 'GET') return res.status(204).end();

    const generated = await ensurePersonalForecast(cacheInput);
    if (generated.status === 'in_progress') {
      return res.status(202).json({
        ...generationInProgressPayload(generated.retryAfterMs),
        forecast: createUnavailablePersonalForecast(
          period,
          periodKey,
          timezone,
          profile.language === 'en' ? 'en' : 'ru',
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
    const diagnosticCode = getAiPersonalHoroscopeGenerationDiagnosticCode(error);
    console.error('[ai-personal-horoscope] request failed', {
      userId,
      period,
      periodKey,
      diagnosticCode,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(503).json({
      error: 'Personal horoscope unavailable',
      code: diagnosticCode,
    });
  }
}
