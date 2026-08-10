import type { PersonalForecastPeriod } from './personalForecastContract';

type ForecastTarget = {
  period: PersonalForecastPeriod;
  periodKey: string;
};

export function buildPersonalForecastPrewarmTargets(
  _now: Date,
  _timezone: string,
): ForecastTarget[] {
  return [];
}
