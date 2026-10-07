import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { ensureWeeklySleepStory, listWeeklySleepStories } from '../../../lib/sleepStoriesWeekly';
import { storyGenerationEnabled } from '../../../lib/stories/repository';

/** The weekly bedtime stories (no texts), newest first. The first request of a new week starts writing that week's story. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  try {
    await requireAppUser(req, { allowGuest: true });
    if (storyGenerationEnabled()) {
      void ensureWeeklySleepStory().catch((error: unknown) => {
        console.warn('[sleep-stories] weekly failed', error instanceof Error ? error.message : error);
      });
    }
    const stories = await listWeeklySleepStories();
    return res.status(200).json({
      stories: stories.map((story) => ({
        id: story.id,
        kind: story.kind,
        free: story.free,
        voice: story.voice,
        title: story.title.ru,
        teaser: story.teaser.ru,
        voiceLabel: story.voiceLabel.ru,
        minutes: story.minutes ?? null,
      })),
    });
  } catch (error: unknown) {
    const status = (error as { status?: number })?.status;
    if (status === 401 || status === 403) return res.status(status).json({ code: 'UNAUTHORIZED' });
    console.warn('[sleep-stories] list failed', error instanceof Error ? error.message : error);
    return res.status(200).json({ stories: [] });
  }
}
