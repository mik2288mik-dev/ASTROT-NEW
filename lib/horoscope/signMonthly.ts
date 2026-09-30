import type { Language, SignHoroscopeReadingV2 } from '../../types';
import type { ZodiacKey } from '../zodiacKeys';
import {
  getCachedSignHoroscope,
  getSignHoroscopeCacheSnapshot,
  type SignHoroscopeCacheSnapshot,
} from './signCache';

export async function getCachedSignMonthlyHoroscope(
  sign: ZodiacKey,
  periodKey: string,
  language: Language,
): Promise<SignHoroscopeReadingV2 | null> {
  return getCachedSignHoroscope('month', sign, periodKey, language);
}

export async function getSignMonthlyHoroscopeSnapshot(
  sign: ZodiacKey,
  periodKey: string,
  language: Language,
): Promise<SignHoroscopeCacheSnapshot | null> {
  return getSignHoroscopeCacheSnapshot('month', sign, periodKey, language);
}
