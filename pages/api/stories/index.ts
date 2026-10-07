import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';
import { episodeAccess, releasedEpisodeNumbers } from '../../../lib/stories/access';
import { ensureEpisodeBuffer, listEpisodes, moscowDayKey, readUnlocks, storyGenerationEnabled } from '../../../lib/stories/repository';
import { loadStorySeries } from '../../../lib/stories/catalog';

/** Series with released episodes and what this person can open today. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  try {
    const user = await requireAppUser(req, { allowGuest: true });
    const userId = String(user.userId);
    const today = moscowDayKey();
    const [entitlement, unlocks] = await Promise.all([getPremiumEntitlementState(userId), readUnlocks(userId)]);
    const series = await Promise.all((await loadStorySeries()).map(async (item) => {
      const episodes = await listEpisodes(item.id);
      const released = new Set(releasedEpisodeNumbers(episodes, today));
      // A new series must not wait for the nightly job: write the first episodes now
      // (in the background; the next visit shows them). Runs once per series at a time.
      if (!released.size && storyGenerationEnabled()) {
        void ensureEpisodeBuffer(item.id).catch((error: unknown) => {
          console.warn('[stories] first episodes failed', item.id, error instanceof Error ? error.message : error);
        });
      }
      const usedToday = unlocks.some((unlock) => unlock.seriesId === item.id && unlock.unlockedOn === today);
      return {
        id: item.id,
        genre: item.genre,
        title: item.title,
        tagline: item.tagline,
        episodes: episodes.filter((episode) => released.has(episode.number)).map((episode) => ({
          number: episode.number,
          title: episode.title,
          releaseDate: episode.releaseDate,
          access: episodeAccess({
            seriesId: item.id,
            number: episode.number,
            premium: entitlement.isPremium,
            unlocked: unlocks.some((unlock) => unlock.seriesId === item.id && unlock.number === episode.number),
            usedTodayInSeries: usedToday,
          }),
        })),
      };
    }));
    return res.status(200).json({ today, premium: entitlement.isPremium, series });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 503;
    return res.status(status).json({ code: status >= 500 ? 'STORIES_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
