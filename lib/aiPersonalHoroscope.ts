import { fromZonedTime } from 'date-fns-tz';
import type { UserProfile } from '../types';

export const AI_PERSONAL_HOROSCOPE_VERSION = 'ai-personal-horoscope-v3' as const;
export const AI_PERSONAL_HOROSCOPE_PROMPT_VERSION = 'ai-personal-horoscope.simple-voice.v1' as const;
export const AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION = 'ai-personal-horoscope-simple-v1' as const;
export const AI_PERSONAL_HOROSCOPE_CACHE_VERSION = 'ai-personal-horoscope-no-calculation-v1' as const;
export const AI_PERSONAL_HOROSCOPE_TIMEZONE: string = 'Europe/Moscow';

export type AiPersonalHoroscopePeriod = 'day' | 'week' | 'month';

export type AiPersonalHoroscopeWindow = {
  period: AiPersonalHoroscopePeriod;
  periodKey: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  startsAt: Date;
  endsAt: Date;
  validTo: Date;
};

export type AiPersonalHoroscopeReading = {
  opening: string;
  forecast: string;
  advice: string[];
};

export type AiPersonalHoroscopeContinuity = {
  themeKeywords: string[];
  adviceKeywords: string[];
};

export type AiPersonalHoroscopeRecentMemory = AiPersonalHoroscopeContinuity & {
  period: AiPersonalHoroscopePeriod;
  periodKey: string;
};

export type AiPersonalHoroscopePackage = {
  version: typeof AI_PERSONAL_HOROSCOPE_VERSION;
  period: AiPersonalHoroscopePeriod;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dateLabel: string;
  timezone: string;
  reading: AiPersonalHoroscopeReading;
  continuity: AiPersonalHoroscopeContinuity;
  meta: {
    model: string;
    promptVersion: typeof AI_PERSONAL_HOROSCOPE_PROMPT_VERSION;
    contractVersion: typeof AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION;
    cacheVersion: typeof AI_PERSONAL_HOROSCOPE_CACHE_VERSION;
    generationAttempts: 1 | 2;
    generatedAt: string;
    status: 'ready';
  };
};

export type AiPersonalHoroscopeAccessPayload = {
  horoscope: AiPersonalHoroscopePackage;
  accessTier: 'free' | 'premium';
  lockedAdviceIndexes: number[];
  periodLocked: boolean;
  source: 'cache' | 'stale' | 'generated';
};

function clean(value: unknown, maxLength: number): string | null {
  const text = typeof value === 'string'
    ? value.trim().replace(/\s+/gu, ' ')
    : '';
  return text ? text.slice(0, maxLength) : null;
}

export function buildAiPersonalHoroscopeProfileSnapshot(profile: UserProfile) {
  return {
    name: clean(profile.name, 80),
    birthDate: clean(profile.birthDate, 10),
    birthTime: clean(profile.birthTime, 8),
    birthPlace: clean(profile.birthPlace, 160),
    gender: profile.gender === 'male' || profile.gender === 'female'
      ? profile.gender
      : 'unspecified',
    language: profile.language === 'en' ? 'en' : 'ru',
  } as const;
}

export function aiPersonalHoroscopeStableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildAiPersonalHoroscopeProfileFingerprint(profile: UserProfile): string {
  return aiPersonalHoroscopeStableHash(
    JSON.stringify(buildAiPersonalHoroscopeProfileSnapshot(profile)),
  ).toString(36);
}

export function normalizeAiPersonalHoroscopeTimezone(value?: string | null): string {
  const candidate = String(value || '').trim() || AI_PERSONAL_HOROSCOPE_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return AI_PERSONAL_HOROSCOPE_TIMEZONE;
  }
}

export function buildAiPersonalHoroscopeCacheKey(input: {
  profile: UserProfile;
  period: AiPersonalHoroscopePeriod;
  periodKey: string;
  timezone: string;
  language: 'ru' | 'en';
  modelId: string;
}): string {
  const identity = [
    AI_PERSONAL_HOROSCOPE_VERSION,
    String(input.profile.id || '').trim(),
    buildAiPersonalHoroscopeProfileFingerprint(input.profile),
    input.period,
    input.periodKey,
    normalizeAiPersonalHoroscopeTimezone(input.timezone),
    input.language,
    input.modelId,
    AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
    AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION,
  ].join('|');
  return `${AI_PERSONAL_HOROSCOPE_VERSION}:${aiPersonalHoroscopeStableHash(identity).toString(36)}:${input.period}:${input.periodKey}`;
}

export function buildAiPersonalHoroscopeInputHash(input: {
  profile: UserProfile;
  period: AiPersonalHoroscopePeriod;
  periodKey: string;
  timezone: string;
  language: 'ru' | 'en';
  modelId: string;
}): string {
  return aiPersonalHoroscopeStableHash(JSON.stringify({
    version: AI_PERSONAL_HOROSCOPE_VERSION,
    profile: buildAiPersonalHoroscopeProfileSnapshot(input.profile),
    period: input.period,
    periodKey: input.periodKey,
    timezone: normalizeAiPersonalHoroscopeTimezone(input.timezone),
    language: input.language,
    modelId: input.modelId,
    promptVersion: AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
    contractVersion: AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION,
  })).toString(36);
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function datePartsInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: read('year'), month: read('month'), day: read('day') };
}

function isoWeekFromDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - weekday);
  const weekYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(weekYear, 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  return { weekYear, week };
}

export function getAiPersonalHoroscopePeriodKey(
  period: AiPersonalHoroscopePeriod,
  date = new Date(),
  timezone: string = AI_PERSONAL_HOROSCOPE_TIMEZONE,
): string {
  const safeTimezone = normalizeAiPersonalHoroscopeTimezone(timezone);
  const { year, month, day } = datePartsInTimezone(date, safeTimezone);
  if (period === 'day') return isoDate(year, month, day);
  if (period === 'month') return `${year}-${pad2(month)}`;
  const iso = isoWeekFromDate(year, month, day);
  return `${iso.weekYear}-W${pad2(iso.week)}`;
}

export function isCurrentAiPersonalHoroscopePeriodKey(
  period: AiPersonalHoroscopePeriod,
  periodKey: string,
  timezone: string = AI_PERSONAL_HOROSCOPE_TIMEZONE,
  now = new Date(),
): boolean {
  return periodKey === getAiPersonalHoroscopePeriodKey(period, now, timezone);
}

function parsePeriodKey(period: AiPersonalHoroscopePeriod, periodKey: string) {
  if (period === 'day') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(periodKey);
    if (!match) return null;
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  if (period === 'week') {
    const match = /^(\d{4})-W(\d{2})$/u.exec(periodKey);
    if (!match) return null;
    const year = Number(match[1]);
    const week = Number(match[2]);
    if (week < 1 || week > 53) return null;
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Weekday = jan4.getUTCDay() || 7;
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - jan4Weekday + 1 + (week - 1) * 7);
    return {
      year: monday.getUTCFullYear(),
      month: monday.getUTCMonth() + 1,
      day: monday.getUTCDate(),
    };
  }
  const match = /^(\d{4})-(\d{2})$/u.exec(periodKey);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: 1 };
}

export function resolveAiPersonalHoroscopeWindow(
  period: AiPersonalHoroscopePeriod,
  periodKey: string,
  timezone?: string | null,
): AiPersonalHoroscopeWindow {
  const safeTimezone = normalizeAiPersonalHoroscopeTimezone(timezone);
  const parsed = parsePeriodKey(period, periodKey);
  if (!parsed) throw new Error('INVALID_AI_PERSONAL_HOROSCOPE_PERIOD_KEY');

  const startDay = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  const endExclusive = new Date(startDay);
  if (period === 'day') endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  if (period === 'week') endExclusive.setUTCDate(endExclusive.getUTCDate() + 7);
  if (period === 'month') endExclusive.setUTCMonth(endExclusive.getUTCMonth() + 1);

  const endDay = new Date(endExclusive);
  endDay.setUTCDate(endDay.getUTCDate() - 1);
  const periodStart = isoDate(
    startDay.getUTCFullYear(),
    startDay.getUTCMonth() + 1,
    startDay.getUTCDate(),
  );
  const periodEnd = isoDate(
    endDay.getUTCFullYear(),
    endDay.getUTCMonth() + 1,
    endDay.getUTCDate(),
  );
  const endExclusiveKey = isoDate(
    endExclusive.getUTCFullYear(),
    endExclusive.getUTCMonth() + 1,
    endExclusive.getUTCDate(),
  );

  return {
    period,
    periodKey,
    timezone: safeTimezone,
    periodStart,
    periodEnd,
    startsAt: fromZonedTime(`${periodStart}T00:00:00`, safeTimezone),
    endsAt: fromZonedTime(`${periodEnd}T23:59:59`, safeTimezone),
    validTo: fromZonedTime(`${endExclusiveKey}T00:00:00`, safeTimezone),
  };
}

export function getPreviousAiPersonalHoroscopePeriodKey(
  period: AiPersonalHoroscopePeriod,
  periodKey: string,
  timezone?: string | null,
): string {
  const window = resolveAiPersonalHoroscopeWindow(period, periodKey, timezone);
  return getAiPersonalHoroscopePeriodKey(
    period,
    new Date(window.startsAt.getTime() - 60_000),
    window.timezone,
  );
}

export function getAiPersonalHoroscopeCurrentDate(
  window: AiPersonalHoroscopeWindow,
  now = new Date(),
): string {
  const parts = datePartsInTimezone(now, window.timezone);
  const current = isoDate(parts.year, parts.month, parts.day);
  if (current < window.periodStart) return window.periodStart;
  if (current > window.periodEnd) return window.periodEnd;
  return current;
}

export function formatAiPersonalHoroscopeDateLabel(
  window: Pick<AiPersonalHoroscopeWindow, 'period' | 'periodStart' | 'periodEnd'>,
  language: 'ru' | 'en',
): string {
  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  const start = new Date(`${window.periodStart}T12:00:00Z`);
  const end = new Date(`${window.periodEnd}T12:00:00Z`);
  if (window.period === 'day') {
    const weekday = new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(start);
    const date = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(start);
    return `${weekday.toLocaleUpperCase(locale)}\n${date.toLocaleUpperCase(locale)}`;
  }
  if (window.period === 'month') {
    return new Intl.DateTimeFormat(locale, {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(start).toLocaleUpperCase(locale);
  }
  const format = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  return `${format.format(start)} — ${format.format(end)}`.toLocaleUpperCase(locale);
}

const KEYWORD_STOP_WORDS = new Set([
  'этот', 'эта', 'это', 'эти', 'того', 'тому', 'тебя', 'тебе', 'твой', 'твоя', 'твои',
  'сегодня', 'неделя', 'месяц', 'день', 'будет', 'будут', 'может', 'можно', 'нужно',
  'когда', 'если', 'чтобы', 'который', 'которая', 'которые', 'просто', 'очень', 'сейчас',
  'после', 'перед', 'через', 'между', 'вместо', 'только', 'свою', 'свой', 'свои', 'себя',
  'your', 'you', 'this', 'that', 'today', 'week', 'month', 'will', 'with', 'from', 'into',
  'when', 'then', 'just', 'very', 'about', 'have', 'what', 'which', 'while', 'before', 'after',
]);

function normalizedTokens(value: string, excluded: Set<string>): string[] {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/gu, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !KEYWORD_STOP_WORDS.has(token))
    .filter((token) => !excluded.has(token));
}

function topKeywords(values: string[], excluded: Set<string>, limit: number): string[] {
  const counts = new Map<string, number>();
  values.flatMap((value) => normalizedTokens(value, excluded)).forEach((token) => {
    counts.set(token, (counts.get(token) || 0) + 1);
  });
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ru'))
    .slice(0, limit)
    .map(([token]) => token);
}

export function buildAiPersonalHoroscopeContinuity(
  reading: AiPersonalHoroscopeReading,
  profile?: UserProfile,
): AiPersonalHoroscopeContinuity {
  const excluded = new Set<string>();
  normalizedTokens(String(profile?.name || ''), new Set()).forEach((token) => excluded.add(token));
  return {
    themeKeywords: topKeywords([reading.opening, reading.forecast], excluded, 8),
    adviceKeywords: topKeywords(reading.advice, excluded, 8),
  };
}

function validStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value)
    && value.length <= maxItems
    && value.every((item) => (
      typeof item === 'string'
      && !!item.trim()
      && item.length <= maxLength
    ));
}

export function isAiPersonalHoroscopePackage(
  value: unknown,
  options: { allowRedacted?: boolean } = {},
): value is AiPersonalHoroscopePackage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const horoscope = value as AiPersonalHoroscopePackage;
  if (
    horoscope.version !== AI_PERSONAL_HOROSCOPE_VERSION
    || !(['day', 'week', 'month'] as const).includes(horoscope.period)
    || typeof horoscope.periodKey !== 'string'
    || !horoscope.periodKey.trim()
    || typeof horoscope.periodStart !== 'string'
    || typeof horoscope.periodEnd !== 'string'
    || typeof horoscope.dateLabel !== 'string'
    || !horoscope.dateLabel.trim()
    || typeof horoscope.timezone !== 'string'
    || horoscope.timezone !== normalizeAiPersonalHoroscopeTimezone(horoscope.timezone)
    || !horoscope.reading
    || typeof horoscope.reading.opening !== 'string'
    || typeof horoscope.reading.forecast !== 'string'
    || !Array.isArray(horoscope.reading.advice)
    || horoscope.reading.advice.some((item) => typeof item !== 'string')
    || !horoscope.continuity
    || !validStringArray(horoscope.continuity.themeKeywords, 12, 80)
    || !validStringArray(horoscope.continuity.adviceKeywords, 12, 80)
    || !horoscope.meta
    || typeof horoscope.meta.model !== 'string'
    || !horoscope.meta.model.trim()
    || horoscope.meta.promptVersion !== AI_PERSONAL_HOROSCOPE_PROMPT_VERSION
    || horoscope.meta.contractVersion !== AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION
    || horoscope.meta.cacheVersion !== AI_PERSONAL_HOROSCOPE_CACHE_VERSION
    || !([1, 2] as const).includes(horoscope.meta.generationAttempts)
    || horoscope.meta.status !== 'ready'
    || typeof horoscope.meta.generatedAt !== 'string'
    || !Number.isFinite(new Date(horoscope.meta.generatedAt).getTime())
  ) return false;

  if (options.allowRedacted) return horoscope.reading.advice.length <= 3;
  return !!horoscope.reading.opening.trim()
    && !!horoscope.reading.forecast.trim()
    && horoscope.reading.advice.length === 3
    && horoscope.reading.advice.every((item) => !!item.trim());
}

export function readAiPersonalHoroscopeReading(
  horoscope: AiPersonalHoroscopePackage,
): AiPersonalHoroscopeReading {
  return horoscope.reading;
}

export function sliceAiPersonalHoroscopeForAccess(
  horoscope: AiPersonalHoroscopePackage,
  isPremium: boolean,
): {
  horoscope: AiPersonalHoroscopePackage;
  lockedAdviceIndexes: number[];
  periodLocked: boolean;
} {
  if (isPremium) {
    return { horoscope, lockedAdviceIndexes: [], periodLocked: false };
  }
  if (horoscope.period !== 'day') {
    return {
      horoscope: {
        ...horoscope,
        reading: { opening: '', forecast: '', advice: [] },
      },
      lockedAdviceIndexes: [0, 1, 2],
      periodLocked: true,
    };
  }
  return {
    horoscope: {
      ...horoscope,
      reading: {
        opening: horoscope.reading.opening,
        forecast: horoscope.reading.forecast,
        advice: horoscope.reading.advice.slice(0, 1),
      },
    },
    lockedAdviceIndexes: [1, 2],
    periodLocked: false,
  };
}
