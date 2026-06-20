import type { Language } from '../types';
import { endOfISOWeek, getISOWeek, getISOWeekYear, parseISO, setISOWeek, startOfISOWeek } from 'date-fns';

export const MOSCOW_TIME_ZONE = 'Europe/Moscow';

type DateLike = string | number | Date | null | undefined;

function getDatePartsForTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error(`Failed to format date parts for time zone: ${timeZone}`);
  }

  return { year, month, day };
}

function getDateOnlyParts(value: DateLike) {
  if (!value) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      return {
        year: dateOnlyMatch[1],
        month: dateOnlyMatch[2],
        day: dateOnlyMatch[3],
      };
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return {
        year: String(parsed.getUTCFullYear()),
        month: String(parsed.getUTCMonth() + 1).padStart(2, '0'),
        day: String(parsed.getUTCDate()).padStart(2, '0'),
      };
    }

    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, '0'),
    day: String(date.getUTCDate()).padStart(2, '0'),
  };
}

export function getMoscowTodayKey(now: Date = new Date()): string {
  const { year, month, day } = getDatePartsForTimeZone(now, MOSCOW_TIME_ZONE);
  return `${year}-${month}-${day}`;
}

export function toDateInputValue(value: DateLike): string {
  const parts = getDateOnlyParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

export function formatLumiaDate(value: DateLike, language: Language | string = 'ru'): string {
  const parts = getDateOnlyParts(value);
  if (!parts) return '';

  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  const normalizedDate = new Date(Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    12,
    0,
    0
  ));

  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(normalizedDate);
}

/** ISO week key for current calendar day in Moscow (e.g. `2026-W13`). */
export function getMoscowIsoWeekKey(now: Date = new Date()): string {
  const { year, month, day } = getDatePartsForTimeZone(now, MOSCOW_TIME_ZONE);
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0));
  const y = getISOWeekYear(d);
  const w = getISOWeek(d);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

/** Calendar month in Moscow `YYYY-MM`. */
export function getMoscowMonthKey(now: Date = new Date()): string {
  const { year, month } = getDatePartsForTimeZone(now, MOSCOW_TIME_ZONE);
  return `${year}-${month}`;
}

const ISO_WEEK_KEY = /^(\d{4})-W(\d{2})$/;
const MONTH_KEY = /^(\d{4})-(\d{2})$/;

export function isValidMoscowIsoWeekKey(key: string): boolean {
  return ISO_WEEK_KEY.test(String(key || '').trim());
}

export function isValidMoscowMonthKey(key: string): boolean {
  const m = MONTH_KEY.exec(String(key || '').trim());
  if (!m) return false;
  const mo = Number(m[2]);
  return mo >= 1 && mo <= 12;
}

function utcDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Monday–Sunday date range label for an ISO week (UTC boundaries of ISO week). */
export function formatIsoWeekPeriodLabel(periodKey: string, language: Language | string = 'ru'): string {
  const m = ISO_WEEK_KEY.exec(periodKey.trim());
  if (!m) return periodKey;
  const year = Number(m[1]);
  const week = Number(m[2]);
  const ref = parseISO(`${year}-01-04T12:00:00.000Z`);
  const withWeek = setISOWeek(ref, week);
  const start = startOfISOWeek(withWeek);
  const end = endOfISOWeek(withWeek);
  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    opts.year = 'numeric';
  }
  const a = new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(start);
  const b = new Intl.DateTimeFormat(locale, { ...opts, year: 'numeric', timeZone: 'UTC' }).format(end);
  return `${a} — ${b}`;
}

export function formatMonthPeriodLabel(periodKey: string, language: Language | string = 'ru'): string {
  const m = MONTH_KEY.exec(periodKey.trim());
  if (!m) return periodKey;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = new Date(Date.UTC(y, mo, 1, 12, 0, 0));
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** Диапазон недели датами: «с 22 по 28 июня 2026 г.» (без дней недели). */
export function formatWeekRangePretty(periodKey: string, language: Language | string = 'ru'): string {
  const m = ISO_WEEK_KEY.exec(periodKey.trim());
  if (!m) return periodKey;
  const ref = parseISO(`${Number(m[1])}-01-04T12:00:00.000Z`);
  const withWeek = setISOWeek(ref, Number(m[2]));
  const start = startOfISOWeek(withWeek);
  const end = endOfISOWeek(withWeek);
  const year = end.getUTCFullYear();
  if (language === 'ru') {
    const dayFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', timeZone: 'UTC' });
    const dayMonthFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    const sameMonth = start.getUTCMonth() === end.getUTCMonth();
    return sameMonth
      ? `с ${dayFmt.format(start)} по ${dayMonthFmt.format(end)} ${year} г.`
      : `с ${dayMonthFmt.format(start)} по ${dayMonthFmt.format(end)} ${year} г.`;
  }
  const a = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(start);
  const b = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(end);
  return `${a} – ${b}`;
}

/** Месяц прогноза: «на июнь 2026» / «for June 2026». */
export function formatMonthPretty(periodKey: string, language: Language | string = 'ru'): string {
  const m = MONTH_KEY.exec(periodKey.trim());
  if (!m) return periodKey;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1, 12, 0, 0));
  const month = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', timeZone: 'UTC' }).format(d);
  return language === 'ru' ? `на ${month} ${Number(m[1])}` : `for ${month} ${Number(m[1])}`;
}

export function isoWeekToValidRangeUtc(periodKey: string): { validFrom: string; validTo: string } {
  const m = ISO_WEEK_KEY.exec(periodKey.trim());
  if (!m) {
    const today = getMoscowTodayKey();
    return { validFrom: `${today}T00:00:00.000Z`, validTo: `${today}T23:59:59.999Z` };
  }
  const year = Number(m[1]);
  const week = Number(m[2]);
  const ref = parseISO(`${year}-01-04T12:00:00.000Z`);
  const withWeek = setISOWeek(ref, week);
  const start = startOfISOWeek(withWeek);
  const end = endOfISOWeek(withWeek);
  return {
    validFrom: `${utcDateKey(start)}T00:00:00.000Z`,
    validTo: `${utcDateKey(end)}T23:59:59.999Z`,
  };
}

export function monthKeyToValidRangeUtc(periodKey: string): { validFrom: string; validTo: string } {
  const m = MONTH_KEY.exec(periodKey.trim());
  if (!m) {
    const today = getMoscowTodayKey();
    return { validFrom: `${today}T00:00:00.000Z`, validTo: `${today}T23:59:59.999Z` };
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo, 0, 23, 59, 59, 999));
  return {
    validFrom: `${utcDateKey(start)}T00:00:00.000Z`,
    validTo: `${utcDateKey(end)}T23:59:59.999Z`,
  };
}
