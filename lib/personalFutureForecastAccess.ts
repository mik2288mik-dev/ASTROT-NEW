import { getPersonalForecastPeriodKey, normalizeForecastTimezone } from './personalForecastContract';
import { getPersonalFutureTimelineStops, type PersonalFutureForecastPeriod } from './personalFutureForecastContract';

/** Every future date and topic requires Premium, including tomorrow. */
export function getPersonalFutureForecastDateAccess(input: {
  date: string;
  period?: PersonalFutureForecastPeriod;
  endDate?: string;
  accessTier: 'free' | 'premium';
  timezone?: string | null;
  now?: Date;
}) {
  const timezone = normalizeForecastTimezone(input.timezone);
  const now = input.now || new Date();
  const accessDay = getPersonalForecastPeriodKey('day', now, timezone);
  const stops = getPersonalFutureTimelineStops(accessDay);
  const tomorrow = stops[0].date;
  const period = input.period || 'day';
  const selected = stops.find((stop) => stop.period === period && stop.date === input.date && stop.endDate === input.endDate);
  const access = !selected ? 'outside_horizon'
    : input.accessTier === 'free' ? 'premium_required' : 'allowed';
  const periodStops = stops.filter((stop) => stop.period === period);
  const last = periodStops[periodStops.length - 1];
  return { access, accessDay, tomorrow, timezone, firstDate: periodStops[0]?.date, lastDate: last?.endDate || last?.date };
}
