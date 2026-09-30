import type { Language, SignHoroscopeReadingV2 } from '../../types';
import type { ZodiacKey } from '../zodiacKeys';
import {
  getCachedSignHoroscope,
  getSignHoroscopeCacheSnapshot,
  type SignHoroscopeCacheSnapshot,
} from './signCache';

export async function getCachedSignWeeklyHoroscope(
  sign: ZodiacKey,
  periodKey: string,
  language: Language,
): Promise<SignHoroscopeReadingV2 | null> {
  return getCachedSignHoroscope('week', sign, periodKey, language);
}

export async function getSignWeeklyHoroscopeSnapshot(
  sign: ZodiacKey,
  periodKey: string,
  language: Language,
): Promise<SignHoroscopeCacheSnapshot | null> {
  return getSignHoroscopeCacheSnapshot('week', sign, periodKey, language);
}
