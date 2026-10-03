import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

export type StoryAccess = 'open' | 'free_unlock_available' | 'locked';
export type StorySeriesSummary = {
  id: string;
  genre: 'detective' | 'romance' | 'scifi' | 'comedy';
  title: string;
  tagline: string;
  episodes: Array<{ number: number; title: string; releaseDate: string; access: StoryAccess }>;
};
export type StoriesOverview = { today: string; premium: boolean; series: StorySeriesSummary[] };
export type StoryEpisode = {
  seriesId: string;
  number: number;
  title: string;
  text: string;
  releaseDate: string;
  next: number | null;
  nextReleaseTomorrow: boolean;
};
export type StoryError = Error & { code?: string; status?: number };

async function call<T>(path: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const response = await apiFetch(path, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: method === 'POST' ? '{}' : undefined,
  }, 15_000);
  const payload = await response.json().catch(() => ({})) as T & { code?: string };
  if (!response.ok) {
    const error = new Error(payload.code || 'STORIES_UNAVAILABLE') as StoryError;
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function loadStories(): Promise<StoriesOverview> {
  return call<StoriesOverview>('/api/stories');
}

/** `unlock` spends today's free episode of the series. */
export function loadEpisode(seriesId: string, number: number, unlock = false): Promise<StoryEpisode> {
  return call<StoryEpisode>(`/api/stories/${encodeURIComponent(seriesId)}/${number}`, unlock ? 'POST' : 'GET');
}
