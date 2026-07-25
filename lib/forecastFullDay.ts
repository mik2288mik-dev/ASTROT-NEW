import { withAppVoiceCacheKey } from './appVoice';

export function buildForecastFullDayUnlockCacheKey(dateKey: string) {
  return dateKey;
}

export function buildForecastDailyCacheKey(dateKey: string) {
  return withAppVoiceCacheKey(dateKey);
}

export function buildForecastDaypartCacheKey(dateKey: string, slot: 'morning' | 'day' | 'evening') {
  return withAppVoiceCacheKey(`${dateKey}:${slot}`);
}
