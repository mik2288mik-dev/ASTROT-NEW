import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';
import { db } from '../../../lib/db';
import { birthProfileRepository } from '../../../lib/birthProfileRepository';
import { buildPersonalForecastPrewarmProfile } from '../../../lib/personalForecastPrewarm';
import { getPersonalForecastPeriodKey, normalizeForecastTimezone } from '../../../lib/personalForecastContract';
import { claimableGift, daysToStreakGift, readGiftClaims, saveWeekGift } from '../../../lib/forecastGifts';

/**
 * GET — the streak, a gifted week (if any) and what can be claimed now.
 * POST — claims the gift: conditions are re-checked here, never trusted from the client.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const userId = String(auth.userId);
    const [user, birthSettings, entitlement, claims] = await Promise.all([
      db.users.get(userId, { hydratePrimaryChart: false }),
      birthProfileRepository.get(userId),
      getPremiumEntitlementState(userId),
      readGiftClaims(userId),
    ]);
    const profile = buildPersonalForecastPrewarmProfile(userId, user, birthSettings);
    const timezone = normalizeForecastTimezone(profile?.birthTimezone);
    const weekKey = getPersonalForecastPeriodKey('week', new Date(), timezone);
    // login_streak is counted by the database date, so the gift rules use the same calendar.
    const today = new Date().toISOString().slice(0, 10);
    const streak = Number((user as { login_streak?: number } | null)?.login_streak) || 0;
    const createdAt = (user as { created_at?: string | Date } | null)?.created_at;
    const created = createdAt ? new Date(createdAt).toISOString() : null;
    const weekGift = claims.find((claim) => claim.periodKey === weekKey) ?? null;
    const claimable = entitlement.isPremium || weekGift || !profile ? null : claimableGift({ today, streak, createdAt: created, claims });

    if (req.method === 'POST') {
      const reason = (req.body || {}).reason;
      if (!claimable || reason !== claimable) return res.status(409).json({ code: 'GIFT_NOT_AVAILABLE' });
      await saveWeekGift({ userId, periodKey: weekKey, reason: claimable, streak, today });
      return res.status(200).json({ ok: true, weekGift: { periodKey: weekKey, reason: claimable } });
    }

    return res.status(200).json({
      streak,
      daysToGift: daysToStreakGift(streak, claims, today),
      weekGift: weekGift ? { periodKey: weekGift.periodKey, reason: weekGift.reason } : null,
      claimable,
      premium: entitlement.isPremium,
    });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 503;
    return res.status(status).json({ code: status >= 500 ? 'GIFT_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
