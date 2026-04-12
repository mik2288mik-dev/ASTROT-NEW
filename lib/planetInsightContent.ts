import type { Language, NatalChartData, PlanetInsight, PlanetInsightTag } from '../types';
import {
  getHouseThemeLabel,
  getLocalizedElement,
  getLocalizedModality,
  getPlanetDisplayName,
  getPlanetPositionFromChart,
  getModalityForSign,
  getZodiacElementStyle,
  type NatalPlanetKey,
} from './natalWheel';
import { getElementForSign, type ZodiacSign } from './zodiac-utils';

function compact(value?: string | null): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildPlanetInsightTags(
  sign: string | null | undefined,
  house: number | null | undefined,
  language: Language
): PlanetInsightTag[] {
  const resolvedElement = sign ? getElementForSign(sign as ZodiacSign) : 'Air';
  const elementTone = getZodiacElementStyle(sign).tagTone;

  return [
    {
      id: 'element',
      label: getLocalizedElement(language, resolvedElement),
      tone: elementTone,
    },
    {
      id: 'modality',
      label: getLocalizedModality(language, getModalityForSign(sign)),
      tone: 'neutral',
    },
    {
      id: 'house',
      label: getHouseThemeLabel(house, language),
      tone: 'neutral',
    },
  ];
}

function buildFallbackBody(
  planetLabel: string,
  sign: string,
  house: number | null,
  language: Language
): string {
  if (language === 'en') {
    return `${planetLabel} in ${sign}${house ? ` in house ${house}` : ''} shows how this part of you naturally moves through life. It tends to reveal itself in your habits, emotional tone, and the situations you return to when something truly matters.`;
  }

  return `${planetLabel} в знаке ${sign}${house ? ` и ${house} доме` : ''} показывает, как эта часть тебя естественно проявляется в жизни. Обычно она слышна в привычных реакциях, внутреннем тоне и в тех ситуациях, к которым ты возвращаешься, когда для тебя что-то по-настоящему важно.`;
}

function buildFallbackTitle(planetLabel: string, sign: string, language: Language): string {
  if (language === 'en') {
    return `${planetLabel} in ${sign}`;
  }
  return `${planetLabel} в ${sign}`;
}

export function buildPlanetInsight(
  chartData: NatalChartData,
  planetId: NatalPlanetKey,
  language: Language,
  content?: Partial<{ title: string; body: string }>
): PlanetInsight {
  const position = getPlanetPositionFromChart(chartData, planetId);
  if (!position) {
    throw new Error(`PLANET_POSITION_MISSING:${planetId}`);
  }

  const sign = compact(position.sign) || 'Unknown';
  const house = typeof position.house === 'number' ? position.house : Number(position.house) || null;
  const degree =
    typeof position.degree === 'number' && Number.isFinite(position.degree)
      ? Math.round(position.degree)
      : null;
  const planetLabel = getPlanetDisplayName(planetId, language);

  return {
    planetId,
    title: compact(content?.title) || buildFallbackTitle(planetLabel, sign, language),
    sign,
    degree,
    house,
    body: compact(content?.body) || buildFallbackBody(planetLabel, sign, house, language),
    tags: buildPlanetInsightTags(sign, house, language),
  };
}
