import type { Language, SignHoroscopePeriod } from '../../types';
import { buildContentGenerationLockKey } from '../contentGenerationLock';
import { signHoroscopePromptVersion } from './signCache';

export function buildSignHoroscopeLockKey(
  period: SignHoroscopePeriod,
  periodKey: string,
  language: Language,
): string {
  return buildContentGenerationLockKey({
    userId: `sign-batch:${language}`,
    accessTier: period === 'day' ? 'free' : 'premium',
    contentSurface: 'forecast',
    contentVariant: period === 'day' ? 'daily' : period === 'week' ? 'weekly' : 'monthly',
    cacheKey: `${period}:${periodKey}:${language}`,
    promptVersion: signHoroscopePromptVersion(period),
  });
}
