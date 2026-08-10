import {
  getMoscowTodayKey,
  isValidMoscowIsoWeekKey,
  isValidMoscowMonthKey,
  isoWeekToValidRangeUtc,
} from '../date-utils';
import { normalizeZodiacKey } from '../zodiacKeys';

export type HoroscopeEngagementPeriod = 'today' | 'week' | 'month';

/** Canonical engagement key for a sign, sign pair, or Major Arcana card. */
export function normalizeEngagementKey(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (raw.startsWith('arcana_')) {
    const number = Number.parseInt(raw.slice(7), 10);
    return Number.isInteger(number) && number >= 1 && number <= 22
      ? `arcana_${number}`
      : null;
  }
  if (raw.includes('_')) {
    const parts = raw.split('_');
    if (parts.length !== 2) return null;
    const first = normalizeZodiacKey(parts[0]);
    const second = normalizeZodiacKey(parts[1]);
    return first && second ? [first, second].sort().join('_') : null;
  }
  return normalizeZodiacKey(raw);
}

export function normalizeHoroscopeEngagementPeriod(value: unknown): HoroscopeEngagementPeriod {
  const period = String(value || '').trim().toLowerCase();
  return period === 'week' || period === 'month' ? period : 'today';
}

/** One identity shared by views and reactions for the same forecast. */
export function buildHoroscopeEngagementKey(
  value: string | null | undefined,
  period: HoroscopeEngagementPeriod,
): string | null {
  const base = normalizeEngagementKey(value);
  if (!base) return null;
  return period === 'today' ? base : `${base}#${period}`;
}

/** Convert day/week/month period keys to the DATE column used by engagement tables. */
export function getHoroscopeEngagementDateKey(
  period: HoroscopeEngagementPeriod,
  periodKey: string,
): string {
  const key = String(periodKey || '').trim();
  if (period === 'week' && isValidMoscowIsoWeekKey(key)) {
    return isoWeekToValidRangeUtc(key).validFrom.slice(0, 10);
  }
  if (period === 'month' && isValidMoscowMonthKey(key)) {
    return `${key}-01`;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : getMoscowTodayKey();
}
