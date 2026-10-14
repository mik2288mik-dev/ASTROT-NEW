import crypto from 'crypto';
import { stat } from 'fs/promises';
import path from 'path';
import { RECORDED_SLEEP_STORIES, type RecordedSleepStory } from '../recordedSleepStories';
import type { AudioTicket } from './ttsStore';

// Bump when replacing an MP3: previously cached bearer URLs are immutable.
const ASSET_VERSION = '2';
const assetPath = (story: RecordedSleepStory) => path.join(process.cwd(), 'server-assets', 'audio', 'stories', `${story.id}.mp3`);

function recordingId(story: RecordedSleepStory): string {
  const configured = String(process.env.APP_SESSION_SECRET || '').trim();
  const secret = /^(?:replace-with|your[_-])/i.test(configured) ? '' : configured;
  if (process.env.NODE_ENV === 'production' && Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('APP_SESSION_SECRET must contain at least 32 bytes');
  }
  // The file URL is a bearer ticket, like cached TTS. A public catalogue ID or
  // a hash of the public-domain source must not grant access to Premium audio.
  return crypto.createHmac('sha256', secret || 'lumia-local-development-session-secret')
    .update(`nebo:recorded-story:${ASSET_VERSION}\0${story.id}`)
    .digest('hex');
}

export async function recordedStoryTicket(story: RecordedSleepStory): Promise<AudioTicket> {
  const file = await stat(assetPath(story));
  if (!file.isFile() || !file.size) throw new Error('RECORDED_STORY_MISSING');
  return { id: recordingId(story), durationSec: story.durationSec, cached: true };
}

export type RecordedStoryFile = { path: string; size: number; mime: 'audio/mpeg' };

/**
 * Finds the recording behind an opaque id without reading it: a story is up to
 * 47 MB and the player asks for it many times while seeking, so the file is
 * streamed by byte range instead of being loaded into memory per request.
 */
export async function findRecordedStoryFile(id: string): Promise<RecordedStoryFile | null> {
  const story = RECORDED_SLEEP_STORIES.find((item) => recordingId(item) === id);
  if (!story) return null;
  const file = await stat(assetPath(story));
  return { path: assetPath(story), size: file.size, mime: 'audio/mpeg' };
}
