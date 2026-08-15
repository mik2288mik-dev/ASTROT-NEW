import type { AiPersonalHoroscopePeriod } from '../../lib/aiPersonalHoroscope';

export function resolveRequestedPersonalForecastPeriod(
  requestedPeriod: AiPersonalHoroscopePeriod | undefined,
): AiPersonalHoroscopePeriod {
  return requestedPeriod || 'day';
}

export function updatePersonalForecastPeriodBucket<T>(
  current: Readonly<Record<AiPersonalHoroscopePeriod, T>>,
  period: AiPersonalHoroscopePeriod,
  next: T,
): Record<AiPersonalHoroscopePeriod, T> {
  return { ...current, [period]: next };
}
