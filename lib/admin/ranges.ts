import { formatInTimeZone } from 'date-fns-tz';
import { moscowDayStart, moscowDaysBack, moscowMonthStart, type Period } from '../productMetrics';

export const RANGE_KEYS = ['today', 'yesterday', '7d', '30d', 'month', '90d'] as const;
export type RangeKey = typeof RANGE_KEYS[number];
export type AdminRange = Period & { key: RangeKey; label: string; previous: Period; days: number };

const dm = (date: Date) => formatInTimeZone(date, 'Europe/Moscow', 'dd.MM');

/** Admin periods are Moscow days; «previous» is the same span right before, for comparisons. */
export function resolveRange(raw: unknown, now = new Date()): AdminRange {
  const key = (RANGE_KEYS as readonly string[]).includes(String(raw)) ? String(raw) as RangeKey : '7d';
  const today = moscowDayStart(now);
  if (key === 'today') {
    const yesterday = moscowDaysBack(now, 1);
    return { key, start: today, end: now, days: 1, label: `Сегодня, ${dm(today)}`,
      previous: { start: yesterday, end: new Date(yesterday.getTime() + (now.getTime() - today.getTime())) } };
  }
  if (key === 'yesterday') {
    const start = moscowDaysBack(now, 1);
    return { key, start, end: today, days: 1, label: `Вчера, ${dm(start)}`,
      previous: { start: moscowDaysBack(now, 2), end: start } };
  }
  if (key === 'month') {
    const start = moscowMonthStart(now);
    const days = Math.max(1, Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1);
    const previousStart = moscowMonthStart(new Date(start.getTime() - 86_400_000));
    return { key, start, end: now, days, label: `Этот месяц, с ${dm(start)}`,
      previous: { start: previousStart, end: new Date(previousStart.getTime() + (now.getTime() - start.getTime())) } };
  }
  const days = key === '30d' ? 30 : key === '90d' ? 90 : 7;
  const start = moscowDaysBack(now, days - 1);
  const length = now.getTime() - start.getTime();
  return { key, start, end: now, days, label: `${days} дней, ${dm(start)} – ${dm(now)}`,
    previous: { start: new Date(start.getTime() - length), end: start } };
}
