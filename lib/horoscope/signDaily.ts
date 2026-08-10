import type { Language, SignHoroscopeReadingV2 } from '../../types';
import {
  ZODIAC_KEYS,
  normalizeZodiacKey,
  type ZodiacKey,
} from '../zodiacKeys';
import {
  getCachedSignHoroscope,
  getSignHoroscopeCacheSnapshot,
  type SignHoroscopeCacheSnapshot,
} from './signCache';
import { getOrGenerateSignHoroscope } from './signOrchestrator';
export { normalizeEngagementKey } from './signEngagement';

export { ZODIAC_KEYS, normalizeZodiacKey };
export type { ZodiacKey };

export async function getCachedSignDailyHoroscope(
  sign: ZodiacKey,
  date: string,
  language: Language,
): Promise<SignHoroscopeReadingV2 | null> {
  return getCachedSignHoroscope('day', sign, date, language);
}

export async function getSignDailyHoroscopeSnapshot(
  sign: ZodiacKey,
  date: string,
  language: Language,
): Promise<SignHoroscopeCacheSnapshot | null> {
  return getSignHoroscopeCacheSnapshot('day', sign, date, language);
}

export async function getOrGenerateSignDailyHoroscope(
  sign: ZodiacKey,
  date: string,
  language: Language,
): Promise<SignHoroscopeReadingV2> {
  return getOrGenerateSignHoroscope('day', sign, date, language);
}
