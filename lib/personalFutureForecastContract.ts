export const PERSONAL_FUTURE_FORECAST_VERSION = 'personal-future-v10-dated-natal-horoscope';
export const PERSONAL_FUTURE_FORECAST_TOPICS = ['general', 'work', 'love', 'money', 'family', 'communication', 'luck'] as const;
export type PersonalFutureForecastTopic = typeof PERSONAL_FUTURE_FORECAST_TOPICS[number];
export type PersonalFutureForecastPeriod = 'day' | 'week' | 'month';
export type PersonalFutureTimelineStop = { date: string; period: PersonalFutureForecastPeriod; endDate?: string };

/** Calendar arithmetic uses date-only UTC values; today is already the owner's local date. */
export function getPersonalFutureTimelineStops(today: string): PersonalFutureTimelineStop[] {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(today)) return [];
  const start = new Date(`${today}T12:00:00Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== today) return [];
  const dateKey = (date: Date) => date.toISOString().slice(0, 10);
  const shift = (date: Date, days: number) => {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  };
  const stops: PersonalFutureTimelineStop[] = [];
  for (let day = 1; day <= 7; day += 1) stops.push({ date: dateKey(shift(start, day)), period: 'day' });
  const monthEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 12));
  let cursor = shift(start, 8);
  while (cursor.getTime() <= monthEnd.getTime()) {
    const sunday = shift(cursor, (7 - cursor.getUTCDay()) % 7);
    const end = sunday.getTime() > monthEnd.getTime() ? monthEnd : sunday;
    stops.push({ date: dateKey(cursor), endDate: dateKey(end), period: 'week' });
    cursor = shift(end, 1);
  }
  for (let month = 1; month <= 6; month += 1) {
    stops.push({ date: dateKey(new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + month, 1, 12))), period: 'month' });
  }
  return stops;
}

export type PersonalFutureForecast = {
  date: string;
  period: PersonalFutureForecastPeriod;
  endDate?: string;
  topic: PersonalFutureForecastTopic;
  status: 'ready' | 'generating' | 'unavailable';
  text: string;
  code?: string;
  freeUsedTopic?: PersonalFutureForecastTopic;
};

export function isPersonalFutureForecast(value: unknown): value is PersonalFutureForecast {
  if (!value || typeof value !== 'object') return false;
  const item = value as PersonalFutureForecast;
  if (typeof item.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(item.date)
    || !['day', 'week', 'month'].includes(item.period) || (item.period === 'month' && !item.date.endsWith('-01'))
    || (item.period === 'week' ? typeof item.endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(item.endDate) || item.endDate < item.date : item.endDate !== undefined)
    || !PERSONAL_FUTURE_FORECAST_TOPICS.includes(item.topic)
    || (item.freeUsedTopic !== undefined && !PERSONAL_FUTURE_FORECAST_TOPICS.includes(item.freeUsedTopic))
    || !['ready', 'generating', 'unavailable'].includes(item.status)
    || typeof item.text !== 'string') return false;
  return item.status === 'ready'
    ? item.text.trim().length >= 30 && item.text.length <= 650
    : item.text === '';
}
