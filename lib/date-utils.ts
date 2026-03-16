import type { Language } from '../types';

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
