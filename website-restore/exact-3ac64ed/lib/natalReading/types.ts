import { withAppVoiceCacheKey, withAppVoiceVersion } from '../appVoice';

/**
 * Types for the new long-scroll natal reading screen.
 *
 * Storage map (re-uses existing content_interpretations CHECK constraints):
 *   Cache keys include APP_VOICE_VERSION through withAppVoiceCacheKey.
 */

export type NatalReadingArchetype = {
  title: string;     // 2–4 words
  subtitle: string;  // 7–10 words, image
};

export type NatalReadingPortrait = {
  archetypes: NatalReadingArchetype[]; // 5 rotating archetypes
  portrait: string;                    // 5–6 sentence narrative
  insight: string;                     // 2 sentences — what they don't realize
  energyA: { title: string; body: string };
  energyB: { title: string; body: string };
  synthesis: string;                   // superpower from union
};

export type NatalReadingAspect = {
  pl: string;        // "Planet · House" e.g. "Sun · X дом"
  badge: string;     // "Трин" | "Квадратура" | "Соединение" | "Скопление" | "Сильная позиция"
  color: string;     // hex
  text: string;      // 2–3 sentences
};

export type NatalReadingAspects = {
  aspects: NatalReadingAspect[]; // 5 items
  resume: string;                // 3–4 sentence summary
};

export type NatalReadingWeek = {
  title: string;
  body: string;
};

export type NatalReadingToday = {
  title: string;
  main: string;
  love: string;
  work: string;
  energy: string;
};

export type NatalReadingDeepDiveKey =
  | 'love'
  | 'career'
  | 'health'
  | 'karma'
  | 'strengths';

export type NatalReadingDeepDive = {
  title: string;
  body: string;            // long-form ~1200–1600 chars
  highlights?: string[];   // optional 3–5 bullet pointers
};

/** Cache key helpers — keep in sync with API endpoints. */
export const NATAL_READING_PORTRAIT_KEY = withAppVoiceCacheKey('reading.portrait.v1');
export const NATAL_READING_ASPECTS_KEY = withAppVoiceCacheKey('reading.aspects.v1');
export const NATAL_READING_PORTRAIT_PROMPT = withAppVoiceVersion('natal_reading.portrait.v1');
export const NATAL_READING_ASPECTS_PROMPT = withAppVoiceVersion('natal_reading.aspects.v1');
export const NATAL_READING_WEEK_PROMPT = withAppVoiceVersion('natal_reading.week.v1');
export const NATAL_READING_TODAY_PROMPT = withAppVoiceVersion('natal_reading.today.v1');
export const NATAL_READING_DIVE_PROMPT = withAppVoiceVersion('natal_reading.dive.v1');

export function readingDiveCacheKey(topic: NatalReadingDeepDiveKey): string {
  return withAppVoiceCacheKey(`reading.dive.${topic}.v1`);
}

export function readingWeekCacheKey(date: Date = new Date()): string {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (tmp.getUTCDay() + 6) % 7;
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((tmp.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
  );
  return withAppVoiceCacheKey(`reading.week.${tmp.getUTCFullYear()}-${String(week).padStart(2, '0')}`);
}

export function readingTodayCacheKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return withAppVoiceCacheKey(`reading.today.${y}-${m}-${d}`);
}
