import { fromZonedTime } from 'date-fns-tz';
import type { UserProfile } from '../types';

export const AI_PERSONAL_HOROSCOPE_VERSION = 'ai-personal-horoscope-v5' as const;
export const AI_PERSONAL_HOROSCOPE_PROMPT_VERSION = 'ai-personal-horoscope.exact-user-prompt.v3' as const;
export const AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION = 'ai-personal-horoscope-direct-v3' as const;
export const AI_PERSONAL_HOROSCOPE_CACHE_VERSION = 'ai-personal-horoscope-history-15-v3' as const;
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

export type AiPersonalHoroscopeHistoryItem = {
  period: AiPersonalHoroscopePeriod;
  periodKey: string;
  currentDate: string;
  opening: string;
  forecast: string;
  advice: string[];
};

export type AiPersonalHoroscopePackage = {
  version: typeof AI_PERSONAL_HOROSCOPE_VERSION;
  period: AiPersonalHoroscopePeriod;
  periodKey: string;
  currentDate: string;
  periodStart: string;
  periodEnd: string;
  dateLabel: string;
  timezone: string;
  reading: AiPersonalHoroscopeReading;
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
  source: 'cache' | 'generated';
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
  currentDate: string;
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
    input.currentDate,
    normalizeAiPersonalHoroscopeTimezone(input.timezone),
    input.language,
    input.modelId,
    AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
    AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION,
    AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
  ].join('|');
  return `${AI_PERSONAL_HOROSCOPE_VERSION}:${aiPersonalHoroscopeStableHash(identity).toString(36)}:${input.period}:${input.periodKey}:${input.currentDate}`;
}

export function buildAiPersonalHoroscopeInputHash(input: {
  profile: UserProfile;
  period: AiPersonalHoroscopePeriod;
  periodKey: string;
  currentDate: string;
  timezone: string;
  language: 'ru' | 'en';
  modelId: string;
}): string {
  return aiPersonalHoroscopeStableHash(JSON.stringify({
    version: AI_PERSONAL_HOROSCOPE_VERSION,
    profile: buildAiPersonalHoroscopeProfileSnapshot(input.profile),
    period: input.period,
    periodKey: input.periodKey,
    currentDate: input.currentDate,
    timezone: normalizeAiPersonalHoroscopeTimezone(input.timezone),
    language: input.language,
    modelId: input.modelId,
    promptVersion: AI_PERSONAL_HOROSCOPE_PROMPT_VERSION,
    contractVersion: AI_PERSONAL_HOROSCOPE_CONTRACT_VERSION,
    cacheVersion: AI_PERSONAL_HOROSCOPE_CACHE_VERSION,
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

function validDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/u.test(value);
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
    || !validDateKey(horoscope.currentDate)
    || typeof horoscope.periodStart !== 'string'
    || typeof horoscope.periodEnd !== 'string'
    || horoscope.currentDate < horoscope.periodStart
    || horoscope.currentDate > horoscope.periodEnd
    || typeof horoscope.dateLabel !== 'string'
    || !horoscope.dateLabel.trim()
    || typeof horoscope.timezone !== 'string'
    || horoscope.timezone !== normalizeAiPersonalHoroscopeTimezone(horoscope.timezone)
    || !horoscope.reading
    || typeof horoscope.reading.opening !== 'string'
    || typeof horoscope.reading.forecast !== 'string'
    || !Array.isArray(horoscope.reading.advice)
    || horoscope.reading.advice.some((item) => typeof item !== 'string')
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
    && horoscope.reading.advice.length >= 2
    && horoscope.reading.advice.length <= 3
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
  const allAdviceIndexes = horoscope.reading.advice.map((_, index) => index);
  if (horoscope.period !== 'day') {
    return {
      horoscope: {
        ...horoscope,
        reading: { opening: '', forecast: '', advice: [] },
      },
      lockedAdviceIndexes: allAdviceIndexes,
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
    lockedAdviceIndexes: allAdviceIndexes.slice(1),
    periodLocked: false,
  };
}
