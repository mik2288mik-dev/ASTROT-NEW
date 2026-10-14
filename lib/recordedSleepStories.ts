import type { SleepStory } from './sleepStories';
import type { VideoBackgroundId } from './videoBackgrounds';

/** Existing Russian readings, streamed from private server assets without TTS. */
export type RecordedSleepStory = Pick<SleepStory, 'id' | 'free' | 'title' | 'teaser' | 'voiceLabel'> & {
  durationSec: number;
  video: VideoBackgroundId;
};

// The 14 recorded readings (241 MB) were removed on 2026-10-14: serving them took
// the 1 GB Timeweb server down. The list stays so the player code keeps working.
export const RECORDED_SLEEP_STORIES: readonly RecordedSleepStory[] = [];

export function findRecordedSleepStory(id: string): RecordedSleepStory | null {
  return RECORDED_SLEEP_STORIES.find((story) => story.id === id) ?? null;
}

export function recordedStoryDuration(durationSec: number): string {
  const seconds = Math.round(durationSec);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
