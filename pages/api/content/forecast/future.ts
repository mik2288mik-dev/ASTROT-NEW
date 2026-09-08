import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { birthProfileRepository } from '../../../../lib/birthProfileRepository';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { db } from '../../../../lib/db';
import { buildPersonalForecastPrewarmProfile } from '../../../../lib/personalForecastPrewarm';
import { ensurePersonalFutureForecast, PersonalFutureForecastError } from '../../../../lib/personalFutureForecastGeneration';
import { checkRateLimit } from '../../../../lib/rateLimit';
import { PERSONAL_FUTURE_FORECAST_TOPICS, type PersonalFutureForecastTopic, type PersonalFutureForecastPeriod } from '../../../../lib/personalFutureForecastContract';

export const config = { maxDuration: 120 };

/** Independent date answer. Existing daily forecasts and released APK routes are untouched. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  }
  let date = '';
  let topic: PersonalFutureForecastTopic = 'general';
  let period: PersonalFutureForecastPeriod = 'day';
  let endDate: string | undefined;
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const userId = String(auth.userId);
    if (typeof req.query.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(req.query.date)) {
      throw new PersonalFutureForecastError('PERSONAL_FUTURE_DATE_INVALID', 400);
    }
    date = req.query.date;
    if (req.query.period !== undefined && (typeof req.query.period !== 'string' || !['day', 'week', 'month'].includes(req.query.period))) {
      throw new PersonalFutureForecastError('PERSONAL_FUTURE_PERIOD_INVALID', 400);
    }
    if (typeof req.query.period === 'string') period = req.query.period as PersonalFutureForecastPeriod;
    if (period === 'week') {
      if (typeof req.query.endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(req.query.endDate)) {
        throw new PersonalFutureForecastError('PERSONAL_FUTURE_DATE_INVALID', 400);
      }
      endDate = req.query.endDate;
    } else if (req.query.endDate !== undefined) {
      throw new PersonalFutureForecastError('PERSONAL_FUTURE_DATE_INVALID', 400);
    }
    if (req.query.topic !== undefined && (typeof req.query.topic !== 'string'
      || !PERSONAL_FUTURE_FORECAST_TOPICS.includes(req.query.topic as PersonalFutureForecastTopic))) {
      throw new PersonalFutureForecastError('PERSONAL_FUTURE_TOPIC_INVALID', 400);
    }
    if (typeof req.query.topic === 'string') topic = req.query.topic as PersonalFutureForecastTopic;
    const quota = checkRateLimit(userId, { name: 'personal-future-read', windowMs: 60_000, maxRequests: 60 });
    if (!quota.allowed) throw new PersonalFutureForecastError('PERSONAL_FUTURE_RATE_LIMITED', 429);
    const [user, birthSettings, entitlement] = await Promise.all([
      db.users.get(userId, { hydratePrimaryChart: false }),
      birthProfileRepository.get(userId),
      getPremiumEntitlementState(userId),
    ]);
    if (!entitlement.isPremium) throw new PersonalFutureForecastError('PERSONAL_FUTURE_PREMIUM_REQUIRED', 403);
    const profile = buildPersonalForecastPrewarmProfile(userId, user, birthSettings);
    if (!profile) throw new PersonalFutureForecastError('PERSONAL_FUTURE_PROFILE_REQUIRED', 409);
    const result = await ensurePersonalFutureForecast({
      userId, profile, date, topic, period, endDate, accessTier: entitlement.isPremium ? 'premium' : 'free',
      birthTimeRangeStart: birthSettings?.birth_time_range_start,
      birthTimeRangeEnd: birthSettings?.birth_time_range_end,
    });
    if (result.status === 'generating') res.setHeader('Retry-After', '3');
    return res.status(result.status === 'generating' ? 202 : 200).json(result);
  } catch (error) {
    if (error instanceof AdminAuthError) return handleAdminError(res, error);
    const known = error instanceof PersonalFutureForecastError;
    const code = known ? error.code : 'PERSONAL_FUTURE_UNAVAILABLE';
    const status = known ? error.status : 503;
    if (status === 429) res.setHeader('Retry-After', '60');
    console.warn('[personal-future-forecast]', { code, status });
    return res.status(status).json({ date, period, topic, status: 'unavailable', text: '', code,
      ...(endDate !== undefined ? { endDate } : {}),
      ...(known && error.freeUsedTopic ? { freeUsedTopic: error.freeUsedTopic } : {}),
    });
  }
}
