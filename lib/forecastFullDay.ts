export function buildForecastFullDayUnlockCacheKey(dateKey: string) {
  return dateKey;
}

export function buildForecastDaypartCacheKey(dateKey: string, slot: 'morning' | 'day' | 'evening') {
  return `${dateKey}:${slot}`;
}
