import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';
import { db } from '../../../lib/db';
import { birthProfileRepository } from '../../../lib/birthProfileRepository';
import { buildPersonalForecastPrewarmProfile } from '../../../lib/personalForecastPrewarm';
import { getCompatibleStalePersonalForecast } from '../../../lib/personalForecastCache';
import { isCurrentPersonalForecastPeriodKey, normalizeForecastTimezone, type PersonalForecastPeriod } from '../../../lib/personalForecastContract';
import { buildForecastListenScript } from '../../../lib/tts/forecastListenScript';
import { TTS_DEFAULT_VOICE } from '../../../lib/tts/openaiSpeech';
import { ensureAudio } from '../../../lib/tts/ttsStore';
import { findSleepStory } from '../../../lib/sleepStories';
import { findManagedSeries } from '../../../lib/stories/catalog';
import { listEpisodes, moscowDayKey } from '../../../lib/stories/repository';
import { releasedEpisodeNumbers } from '../../../lib/stories/access';

export const config = { api: { bodyParser: { sizeLimit: '4kb' } }, maxDuration: 120 };

const TTL_DAYS: Record<PersonalForecastPeriod, number> = { day: 3, week: 9, month: 35 };

/**
 * «Слушать прогноз» (NEBO+). The client names the reading, never the text: the
 * server reads the person's own saved forecast, so the endpoint cannot be used
 * to voice arbitrary text. Returns the id of cached audio for /api/audio/file.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ code: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const userId = String(auth.userId);
    const source = (req.body || {}).source as { type?: unknown; period?: unknown; periodKey?: unknown; id?: unknown; language?: unknown; seriesId?: unknown; number?: unknown } | undefined;
    if (source?.type === 'story_episode') {
      // One narrator per series; the episode is voiced once for all listeners (NEBO+).
      const series = typeof source.seriesId === 'string' ? await findManagedSeries(source.seriesId) : null;
      const number = Number(source.number);
      if (!series || !Number.isSafeInteger(number)) return res.status(400).json({ code: 'LISTEN_SOURCE_INVALID' });
      if (!(await getPremiumEntitlementState(userId)).isPremium) return res.status(403).json({ code: 'LISTEN_PREMIUM_REQUIRED' });
      const episodes = await listEpisodes(series.id);
      const episode = episodes.find((item) => item.number === number);
      if (!episode || !releasedEpisodeNumbers(episodes, moscowDayKey()).includes(number)) return res.status(404).json({ code: 'EPISODE_NOT_RELEASED' });
      const ticket = await ensureAudio({ text: `${episode.title}.\n\n${episode.body}`, voice: series.narrator, style: 'story', ttlDays: null });
      return res.status(200).json({ audioId: ticket.id, durationSec: ticket.durationSec, cached: ticket.cached });
    }
    if (source?.type === 'sleep_story') {
      // Authored stories: voiced once for everyone, kept without expiry.
      const story = typeof source.id === 'string' ? findSleepStory(source.id) : null;
      if (!story) return res.status(400).json({ code: 'LISTEN_SOURCE_INVALID' });
      if (!story.free && !(await getPremiumEntitlementState(userId)).isPremium) {
        return res.status(403).json({ code: 'LISTEN_PREMIUM_REQUIRED' });
      }
      const language = source.language === 'en' ? 'en' : 'ru';
      const ticket = await ensureAudio({ text: story.text[language], voice: story.voice, style: 'sleep', ttlDays: null });
      return res.status(200).json({ audioId: ticket.id, durationSec: ticket.durationSec, cached: ticket.cached });
    }
    const period = source?.period;
    if (source?.type !== 'personal_forecast' || (period !== 'day' && period !== 'week' && period !== 'month') || typeof source.periodKey !== 'string') {
      return res.status(400).json({ code: 'LISTEN_SOURCE_INVALID' });
    }
    const entitlement = await getPremiumEntitlementState(userId);
    if (!entitlement.isPremium) return res.status(403).json({ code: 'LISTEN_PREMIUM_REQUIRED' });

    const [user, birthSettings] = await Promise.all([
      db.users.get(userId, { hydratePrimaryChart: false }),
      birthProfileRepository.get(userId),
    ]);
    const profile = buildPersonalForecastPrewarmProfile(userId, user, birthSettings);
    if (!profile) return res.status(409).json({ code: 'PERSONAL_FORECAST_PROFILE_REQUIRED' });
    const timezone = normalizeForecastTimezone(profile.birthTimezone);
    if (period !== 'day' && !isCurrentPersonalForecastPeriodKey(period, source.periodKey, timezone, new Date())) {
      return res.status(400).json({ code: 'LISTEN_PERIOD_INVALID' });
    }
    const cached = await getCompatibleStalePersonalForecast({
      userId,
      profile,
      accessTier: 'premium',
      period,
      periodKey: source.periodKey,
    });
    if (!cached || cached.forecast.meta.status !== 'ready') return res.status(404).json({ code: 'LISTEN_FORECAST_NOT_READY' });

    const language = profile.language === 'en' ? 'en' : 'ru';
    const text = buildForecastListenScript({ forecast: cached.forecast, name: profile.name, language });
    const ticket = await ensureAudio({ text, voice: TTS_DEFAULT_VOICE, style: 'forecast', ttlDays: TTL_DAYS[period] });
    return res.status(200).json({ audioId: ticket.id, durationSec: ticket.durationSec, cached: ticket.cached });
  } catch (error: any) {
    const status = typeof error?.status === 'number' ? error.status : 503;
    if (status >= 500) console.error('[audio/listen] failed', error instanceof Error ? error.message : error);
    return res.status(status).json({ code: status >= 500 ? 'LISTEN_UNAVAILABLE' : error?.code || 'AUTH_REQUIRED' });
  }
}
