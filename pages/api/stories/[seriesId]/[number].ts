import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../../../../lib/contentArchitecture';
import { episodeAccess, releasedEpisodeNumbers } from '../../../../lib/stories/access';
import { addFreeUnlock, listEpisodes, moscowDayKey, readUnlocks } from '../../../../lib/stories/repository';
import { findStorySeries } from '../../../../lib/stories/series';

/**
 * One episode. GET returns it when it is open; POST spends today's free
 * unlock of this series on it (one per series per day, enforced in the database).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  try {
    const user = await requireAppUser(req, { allowGuest: true });
    const userId = String(user.userId);
    const series = findStorySeries(String(req.query.seriesId || ''));
    const number = Number(req.query.number);
    if (!series || !Number.isSafeInteger(number) || number < 1) return res.status(404).json({ code: 'EPISODE_NOT_FOUND' });
    const today = moscowDayKey();
    const episodes = await listEpisodes(series.id);
    const released = new Set(releasedEpisodeNumbers(episodes, today));
    const episode = episodes.find((item) => item.number === number);
    if (!episode || !released.has(number)) return res.status(404).json({ code: 'EPISODE_NOT_RELEASED' });

    const [entitlement, unlocks] = await Promise.all([getPremiumEntitlementState(userId), readUnlocks(userId)]);
    let access = episodeAccess({
      number,
      premium: entitlement.isPremium,
      unlocked: unlocks.some((unlock) => unlock.seriesId === series.id && unlock.number === number),
      usedTodayInSeries: unlocks.some((unlock) => unlock.seriesId === series.id && unlock.unlockedOn === today),
    });
    if (req.method === 'POST' && access === 'free_unlock_available') {
      access = (await addFreeUnlock(userId, series.id, number, today)) ? 'open' : 'locked';
    }
    if (access !== 'open') {
      return res.status(403).json({ code: access === 'free_unlock_available' ? 'EPISODE_FREE_UNLOCK_AVAILABLE' : 'EPISODE_LOCKED', access });
    }
    const next = released.has(number + 1) ? number + 1 : null;
    return res.status(200).json({
      seriesId: series.id,
      number,
      title: episode.title,
      text: episode.body,
      releaseDate: episode.releaseDate,
      next,
      nextReleaseTomorrow: !next && episodes.some((item) => item.number === number + 1),
    });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 503;
    return res.status(status).json({ code: status >= 500 ? 'STORIES_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
