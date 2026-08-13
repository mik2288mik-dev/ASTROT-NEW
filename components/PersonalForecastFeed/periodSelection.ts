import type { PersonalForecastPeriod } from '../../lib/personalForecastContract';

export function resolveRequestedPersonalForecastPeriod(
  requestedPeriod: PersonalForecastPeriod | undefined,
): PersonalForecastPeriod {
  return requestedPeriod || 'day';
}

export function updatePersonalForecastPeriodBucket<T>(
  current: Readonly<Record<PersonalForecastPeriod, T>>,
  period: PersonalForecastPeriod,
  next: T,
): Record<PersonalForecastPeriod, T> {
  return { ...current, [period]: next };
}
