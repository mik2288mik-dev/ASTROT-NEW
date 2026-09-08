import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { checkRateLimit } from '../../../../lib/rateLimit';
import { normalizeZodiacKey } from '../../../../lib/zodiacKeys';
import { SIGN_FUTURE_TOPICS, type SignFutureSelection } from '../../../../lib/horoscope/signFutureContract';
import { ensureSignFuture, SignFutureError } from '../../../../lib/horoscope/signFutureGeneration';

export const config = { maxDuration: 120 };
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' }); }
  try {
    const { userId } = await requireAppUser(req, { allowGuest: true });
    if (!checkRateLimit(userId, { name: 'zodiac-future-read', windowMs: 60000, maxRequests: 60 }).allowed) throw new SignFutureError('RATE_LIMITED', 429);
    const body = req.body || {}, sign = typeof body.sign === 'string' ? normalizeZodiacKey(body.sign) : null;
    if (!sign || typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(body.date) || !['day', 'week', 'month'].includes(body.period)
      || !SIGN_FUTURE_TOPICS.includes(body.topic) || !['ru', 'en'].includes(body.language)
      || (body.period === 'week' ? typeof body.endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(body.endDate) : body.endDate !== undefined)) throw new SignFutureError('INVALID_SELECTION', 400);
    const selection: SignFutureSelection = { sign, date: body.date, topic: body.topic, period: body.period, language: body.language, ...(body.endDate ? { endDate: body.endDate } : {}) };
    const entitlement = await getPremiumEntitlementState(userId);
    if (!entitlement.isPremium) throw new SignFutureError('PREMIUM_REQUIRED', 403);
    const result = await ensureSignFuture({ ...selection, userId, premium: entitlement.isPremium });
    if (result.status === 'generating') res.setHeader('Retry-After', '3');
    return res.status(result.status === 'generating' ? 202 : 200).json(result);
  } catch (error) {
    if (error instanceof AdminAuthError) return handleAdminError(res, error);
    const known = error instanceof SignFutureError;
    const status = known ? error.status : 503;
    if (status === 429) res.setHeader('Retry-After', '60');
    return res.status(status).json({ code: known ? error.code : 'ZODIAC_FUTURE_UNAVAILABLE', ...(known && error.freeChoice ? { freeChoice: error.freeChoice } : {}) });
  }
}
