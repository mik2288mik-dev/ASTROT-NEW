function readForecastFullDayLumiCost() {
  const raw =
    process.env.FORECAST_FULL_DAY_LUMI_COST ||
    process.env.NEXT_PUBLIC_FORECAST_FULL_DAY_LUMI_COST;
  const parsed = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 80;
}

/**
 * One-off Lumi unlock for the same full daily reading that Premium opens.
 * Server reads `FORECAST_FULL_DAY_LUMI_COST`; client can read `NEXT_PUBLIC_FORECAST_FULL_DAY_LUMI_COST`.
 */
export const FORECAST_FULL_DAY_LUMI_COST = readForecastFullDayLumiCost();

export function buildForecastFullDayUnlockCacheKey(dateKey: string) {
  return dateKey;
}

export function buildForecastDaypartCacheKey(dateKey: string, slot: 'morning' | 'day' | 'evening') {
  return `${dateKey}:${slot}`;
}
