import {
  FORECAST_FULL_DAY_STARS_COST,
  FORECAST_FULL_DAY_LUMI_COST,
} from './starsPricing';

export { FORECAST_FULL_DAY_STARS_COST, FORECAST_FULL_DAY_LUMI_COST };

export function buildForecastFullDayUnlockCacheKey(dateKey: string) {
  return dateKey;
}

export function buildForecastDaypartCacheKey(dateKey: string, slot: 'morning' | 'day' | 'evening') {
  return `${dateKey}:${slot}`;
}
