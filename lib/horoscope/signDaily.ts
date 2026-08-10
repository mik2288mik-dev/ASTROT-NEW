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

export { ZODIAC_KEYS, normalizeZodiacKey };
export type { ZodiacKey };

/** Canonical engagement key for a sign, sign pair, or Major Arcana card. */
export function normalizeEngagementKey(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (raw.startsWith('arcana_')) {
    const number = Number.parseInt(raw.slice(7), 10);
    return Number.isInteger(number) && number >= 1 && number <= 22
      ? `arcana_${number}`
      : null;
  }
  if (raw.includes('_')) {
    const parts = raw.split('_');
    if (parts.length !== 2) return null;
    const first = normalizeZodiacKey(parts[0]);
    const second = normalizeZodiacKey(parts[1]);
    return first && second ? [first, second].sort().join('_') : null;
  }
  return normalizeZodiacKey(raw);
}

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
