/**
 * Looping video backgrounds. The clips live in public/video/library and are
 * streamed from the server (the Android build leaves them out); the poster of
 * each one ships with the app and is what shows first, offline, or when
 * motion is switched off.
 */
export const VIDEO_BACKGROUND_IDS = [
  'onboarding-day', 'onboarding-self', 'onboarding-people', 'onboarding-choice', 'onboarding-birth', 'onboarding-future', 'onboarding-more', 'onboarding-calculating',
  'sounds-rain', 'sounds-forest', 'sounds-stream', 'sounds-sea', 'sounds-fire', 'sounds-cafe', 'sounds-night',
  'stories-catalog', 'story-quiet-lane', 'story-stair-neighbours', 'story-polyn-station', 'story-family-chat',
  'sleep-sea-house', 'sleep-night-train', 'sleep-garden-rain',
  'breathing', 'premium', 'tests', 'mood-week',
] as const;

export type VideoBackgroundId = (typeof VIDEO_BACKGROUND_IDS)[number];

export const VIDEO_LIBRARY_FILES: ReadonlySet<string> = new Set(VIDEO_BACKGROUND_IDS.map((id) => `${id}.mp4`));

export const videoBackgroundPoster = (id: VideoBackgroundId): string => `/assets/video-posters/${id}.webp`;
export const videoBackgroundPath = (id: VideoBackgroundId): string => `/api/video/library/${id}.mp4`;
