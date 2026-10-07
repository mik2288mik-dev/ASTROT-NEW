import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';
import type { SleepStory } from '../lib/sleepStories';
import type { TtsVoice } from '../lib/tts/openaiSpeech';

type WeeklyRow = {
  id: string;
  kind: 'sleep' | 'calm';
  free: boolean;
  voice: TtsVoice;
  title: string;
  teaser: string;
  voiceLabel: string;
  minutes: number | null;
};

/** The weekly bedtime stories (newest first); an empty list when they cannot be loaded. */
export async function loadWeeklySleepStories(): Promise<SleepStory[]> {
  try {
    const response = await apiFetch('/api/sleep-stories', {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json', ...getTelegramInitDataHeaders() },
    });
    if (!response.ok) return [];
    const payload = await response.json().catch(() => null) as { stories?: WeeklyRow[] } | null;
    return (payload?.stories ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      free: row.free,
      voice: row.voice,
      title: { ru: row.title, en: row.title },
      teaser: { ru: row.teaser, en: row.teaser },
      voiceLabel: { ru: row.voiceLabel, en: row.voiceLabel },
      text: { ru: '', en: '' },
      minutes: row.minutes ?? undefined,
    }));
  } catch {
    return [];
  }
}
