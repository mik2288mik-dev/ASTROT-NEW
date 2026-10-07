import { SLEEP_STORIES } from './sleepStories';
import { ensureAudio } from './tts/ttsStore';
import { listWeeklySleepStories } from './sleepStoriesWeekly';

/**
 * Voices every authored sleep story once after the server starts, so the first listener
 * opens a ready recording instead of waiting for speech synthesis. Stored audio never expires,
 * so on later starts this only checks the cache.
 */
export function scheduleSleepStoryPrewarm(delayMs = 90_000): void {
  if (!process.env.OPENAI_API_KEY) return;
  const timer = setTimeout(async () => {
    for (const story of SLEEP_STORIES) {
      try {
        await ensureAudio({ text: story.text.ru, voice: story.voice, style: 'sleep', ttlDays: null });
      } catch (error) {
        console.warn('[sleep-stories] prewarm failed for', story.id, error instanceof Error ? error.message : error);
      }
    }
    try {
      for (const story of await listWeeklySleepStories({ withText: true })) {
        await ensureAudio({ text: story.text.ru, voice: story.voice, style: 'sleep', ttlDays: null });
      }
    } catch (error) {
      console.warn('[sleep-stories] weekly prewarm failed', error instanceof Error ? error.message : error);
    }
  }, delayMs);
  timer.unref?.();
}
