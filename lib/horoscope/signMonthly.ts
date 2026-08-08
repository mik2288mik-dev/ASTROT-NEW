import type { Language, SignHoroscopeReadingV2 } from '../../types';
import { normalizeZodiacKey, type ZodiacKey } from '../zodiacKeys';
import { getCachedSignHoroscope } from './signCache';
import { getOrGenerateSignHoroscope } from './signOrchestrator';

export async function getCachedSignMonthlyHoroscope(
  sign: ZodiacKey,
  periodKey: string,
  language: Language,
): Promise<SignHoroscopeReadingV2 | null> {
  return getCachedSignHoroscope('month', sign, periodKey, language);
}

export async function getOrGenerateSignMonthlyHoroscope(
  signInput: string,
  periodKey: string,
  language: Language,
): Promise<SignHoroscopeReadingV2> {
  const sign = normalizeZodiacKey(signInput);
  if (!sign) throw new Error('Invalid zodiac sign');
  return getOrGenerateSignHoroscope('month', sign, periodKey, language);
}
