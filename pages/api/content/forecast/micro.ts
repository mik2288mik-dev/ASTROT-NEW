import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { birthProfileRepository } from '../../../../lib/birthProfileRepository';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { db } from '../../../../lib/db';
import {
  getPersonalForecastPeriodAccess, getPersonalForecastPeriodKey, normalizeForecastTimezone,
  type PersonalForecastPeriod,
} from '../../../../lib/personalForecastContract';
import { buildPersonalForecastPrewarmProfile } from '../../../../lib/personalForecastPrewarm';
import { ensurePersonalMicroForecast, PersonalMicroForecastError } from '../../../../lib/personalMicroForecastGeneration';
import { checkRateLimit } from '../../../../lib/rateLimit';

export const config = { maxDuration: 120 };

/** Separate opt-in home product. The released APK never calls this route. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  }
  let period: PersonalForecastPeriod = 'day';
  let periodKey = '';
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const userId = String(auth.userId);
    if (typeof req.query.period !== 'string' || !['day', 'week', 'month'].includes(req.query.period)
      || (req.query.periodKey !== undefined && typeof req.query.periodKey !== 'string')) {
      throw new PersonalMicroForecastError('PERSONAL_MICRO_PERIOD_INVALID', 400);
    }
    period = req.query.period as PersonalForecastPeriod;
    const quota = checkRateLimit(userId, { name: 'personal-micro-read', windowMs: 60_000, maxRequests: 60 });
    if (!quota.allowed) throw new PersonalMicroForecastError('PERSONAL_MICRO_RATE_LIMITED', 429);
    const [user, birthSettings, entitlement] = await Promise.all([
      db.users.get(userId, { hydratePrimaryChart: false }),
      birthProfileRepository.get(userId),
      getPremiumEntitlementState(userId),
    ]);
    const profile = buildPersonalForecastPrewarmProfile(userId, user, birthSettings);
    if (!profile) throw new PersonalMicroForecastError('PERSONAL_MICRO_PROFILE_REQUIRED', 409);
    const timezone = normalizeForecastTimezone(profile.birthTimezone);
    periodKey = (typeof req.query.periodKey === 'string' ? req.query.periodKey.trim() : '')
      || getPersonalForecastPeriodKey(period, new Date(), timezone);
    const accessTier = entitlement.isPremium ? 'premium' as const : 'free' as const;
    const access = getPersonalForecastPeriodAccess({ period, periodKey, timezone, accessTier });
    if (access === 'outside_horizon') throw new PersonalMicroForecastError('PERSONAL_MICRO_PERIOD_INVALID', 400);
    if (access === 'premium_required') throw new PersonalMicroForecastError('PERSONAL_MICRO_PREMIUM_REQUIRED', 403);
    const result = await ensurePersonalMicroForecast({
      userId, profile, accessTier, period, periodKey,
      birthTimeRangeStart: birthSettings?.birth_time_range_start,
      birthTimeRangeEnd: birthSettings?.birth_time_range_end,
    });
    if (result.status === 'generating') res.setHeader('Retry-After', '3');
    return res.status(result.status === 'generating' ? 202 : 200).json(result);
  } catch (error) {
    if (error instanceof AdminAuthError) return handleAdminError(res, error);
    const known = error instanceof PersonalMicroForecastError;
    const code = known ? error.code : 'PERSONAL_MICRO_UNAVAILABLE';
    const status = known ? error.status : 503;
    if (status === 429) res.setHeader('Retry-After', '60');
    // Log only bounded diagnostic labels, never provider messages, birth data or readings.
    console.warn('[personal-micro-forecast]', { code, status, period });
    return res.status(status).json({ period, periodKey, status: 'unavailable', topics: [], code });
  }
}
