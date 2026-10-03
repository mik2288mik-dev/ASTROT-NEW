import { apiFetch, apiUrl } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

export type ListenSource =
  | { type: 'personal_forecast'; period: 'day' | 'week' | 'month'; periodKey: string }
  | { type: 'sleep_story'; id: string; language: 'ru' | 'en' }
  | { type: 'story_episode'; seriesId: string; number: number };
export type ListenTicket = { src: string; durationSec: number };
export type ListenError = Error & { code?: string; status?: number };

/** Absolute URL of cached audio (the native app serves pages from its own bundle). */
export function audioFileUrl(audioId: string): string {
  return apiUrl(`/api/audio/file/${audioId}.mp3`);
}

/**
 * Asks the server for the audio of a reading. The first request synthesizes
 * it (a few seconds), later ones return the stored file at once.
 */
export async function requestListen(source: ListenSource): Promise<ListenTicket> {
  const response = await apiFetch('/api/audio/listen', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getTelegramInitDataHeaders() },
    body: JSON.stringify({ source }),
  }, 90_000);
  const payload = await response.json().catch(() => ({})) as { audioId?: string; durationSec?: number; code?: string };
  if (!response.ok || !payload.audioId) {
    const error = new Error(payload.code || 'LISTEN_UNAVAILABLE') as ListenError;
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return { src: audioFileUrl(payload.audioId), durationSec: Number(payload.durationSec) || 0 };
}
