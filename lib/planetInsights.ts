import type { Language } from '../types';
import { buildPlanetInsightCacheKey, normalizePlanetKey } from './natalPlanetMeta';
export function resolvePlanetInsightRequest(
  planetIdRaw: string | null | undefined,
  language: Language,
  calculationVersion?: string | null
) {
  const planetId = normalizePlanetKey(String(planetIdRaw || ''));
  if (!planetId) {
    throw new Error(language === 'en' ? 'Invalid planet id' : 'Некорректная планета');
  }

  return {
    planetId,
    cacheKey: buildPlanetInsightCacheKey(planetId, language, calculationVersion),
  };
}

export { buildPlanetInsight } from './planetInsightContent';
