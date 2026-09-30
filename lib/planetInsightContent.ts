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
} from './natalPlanetMeta';
import { getElementForSign, type ZodiacSign } from './zodiac-utils';
import { buildNatalInterpretation } from './natalInterpretation';
import type { NatalChartDataV2 } from './natalChartV2Types';

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

function buildFallbackBody(chart: NatalChartData, planetId: NatalPlanetKey, language: Language): string {
  if (chart.schemaVersion === 'natal-chart-data-v2') {
    const key = planetId === 'rising' ? 'ascendant' : planetId;
    const interpretation = buildNatalInterpretation(chart as unknown as NatalChartDataV2, language === 'en' ? 'en' : 'ru');
    const meanings = interpretation.meanings.filter(meaning => meaning.evidenceIds.some(id => (
      id === `position:${key}:sign` || id === `angle:${key}:sign`
    )));
    if (meanings.length) return meanings.map(meaning => meaning.text).join(' ');
  }
  return language === 'en'
    ? 'This placement alone is not enough to make a personal claim about you.'
    : 'Одного положения этой точки недостаточно, чтобы сделать вывод о тебе.';
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
    body: compact(content?.body) || buildFallbackBody(chartData, planetId, language),
    tags: buildPlanetInsightTags(sign, house, language),
  };
}
