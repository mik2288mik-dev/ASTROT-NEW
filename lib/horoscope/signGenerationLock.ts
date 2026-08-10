import type { Language, SignHoroscopePeriod } from '../../types';
import { buildContentGenerationLockKey } from '../contentGenerationLock';
import type { ZodiacKey } from '../zodiacKeys';
import { signHoroscopePromptVersion } from './signCache';

export function buildSignHoroscopeLockKey(
  period: SignHoroscopePeriod,
  periodKey: string,
  language: Language,
  sign: ZodiacKey,
): string {
  return buildContentGenerationLockKey({
    userId: `sign:${sign.toLowerCase()}:${language}`,
    accessTier: period === 'day' ? 'free' : 'premium',
    contentSurface: 'forecast',
    contentVariant: period === 'day' ? 'daily' : period === 'week' ? 'weekly' : 'monthly',
    cacheKey: `${period}:${periodKey}:${language}:${sign.toLowerCase()}`,
    promptVersion: signHoroscopePromptVersion(period),
  });
}
