import type { Language, NatalChartData, PlanetInsightTag, PlanetPosition } from '../types';
import { getElementForSign, ZODIAC_SIGNS, type ZodiacSign } from './zodiac-utils';

export type NatalPlanetKey =
  | 'sun'
  | 'moon'
  | 'rising'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'chiron';

export type ZodiacElementKey = 'Fire' | 'Earth' | 'Air' | 'Water';
export type ZodiacModalityKey = 'Cardinal' | 'Fixed' | 'Mutable';

type LocalizedText = { ru: string; en: string };
type PlanetTextMeta = { label: LocalizedText };

const PLANET_META: Record<NatalPlanetKey, PlanetTextMeta> = {
  sun: { label: { ru: 'Солнце', en: 'Sun' } },
  moon: { label: { ru: 'Луна', en: 'Moon' } },
  rising: { label: { ru: 'ASC', en: 'ASC' } },
  mercury: { label: { ru: 'Меркурий', en: 'Mercury' } },
  venus: { label: { ru: 'Венера', en: 'Venus' } },
  mars: { label: { ru: 'Марс', en: 'Mars' } },
  jupiter: { label: { ru: 'Юпитер', en: 'Jupiter' } },
  saturn: { label: { ru: 'Сатурн', en: 'Saturn' } },
  uranus: { label: { ru: 'Уран', en: 'Uranus' } },
  neptune: { label: { ru: 'Нептун', en: 'Neptune' } },
  pluto: { label: { ru: 'Плутон', en: 'Pluto' } },
  chiron: { label: { ru: 'Хирон', en: 'Chiron' } },
};

export const ZODIAC_ELEMENT_STYLES: Record<
  ZodiacElementKey,
  { fill: string; border: string; text: string; tagTone: PlanetInsightTag['tone'] }
> = {
  Fire: { fill: '#FFF5F5', border: '#FFCDD2', text: '#C0392B', tagTone: 'fire' },
  Earth: { fill: '#F5FFF7', border: '#C8E6C9', text: '#27AE60', tagTone: 'earth' },
  Air: { fill: '#FFFEF5', border: '#FFF9C4', text: '#F39C12', tagTone: 'air' },
  Water: { fill: '#F5F8FF', border: '#BBDEFB', text: '#2980B9', tagTone: 'water' },
};

export const MODALITY_BY_SIGN: Record<ZodiacSign, ZodiacModalityKey> = {
  Aries: 'Cardinal',
  Taurus: 'Fixed',
  Gemini: 'Mutable',
  Cancer: 'Cardinal',
  Leo: 'Fixed',
  Virgo: 'Mutable',
  Libra: 'Cardinal',
  Scorpio: 'Fixed',
  Sagittarius: 'Mutable',
  Capricorn: 'Cardinal',
  Aquarius: 'Fixed',
  Pisces: 'Mutable',
};

const HOUSE_THEME_LABELS: Record<number, LocalizedText> = {
  1: { ru: 'Дом · личность', en: 'House · Identity' },
  2: { ru: 'Дом · деньги и вещи', en: 'House · Money and assets' },
  3: { ru: 'Дом · общение', en: 'House · Communication' },
  4: { ru: 'Дом · дом и семья', en: 'House · Home and family' },
  5: { ru: 'Дом · интерес и творчество', en: 'House · Interest and creativity' },
  6: { ru: 'Дом · быт и работа', en: 'House · Routine and work' },
  7: { ru: 'Дом · отношения', en: 'House · Relationships' },
  8: { ru: 'Дом · общие деньги и кризисы', en: 'House · Shared money and pressure' },
  9: { ru: 'Дом · обучение и взгляды', en: 'House · Learning and beliefs' },
  10: { ru: 'Дом · карьера', en: 'House · Career' },
  11: { ru: 'Дом · друзья и команда', en: 'House · Friends and groups' },
  12: { ru: 'Дом · личные ограничения', en: 'House · Private limits' },
};

export function normalizePlanetKey(value: string): NatalPlanetKey | null {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'asc' || key === 'ascendant' || key === 'rising') return 'rising';
  if (key in PLANET_META) return key as NatalPlanetKey;
  return null;
}

export function getPlanetPositionFromChart(chartData: NatalChartData, key: NatalPlanetKey): PlanetPosition | null {
  if (key === 'rising') return chartData.rising || null;
  return (chartData[key] as PlanetPosition | null | undefined) || null;
}

export function getPlanetDisplayName(key: NatalPlanetKey, language: Language): string {
  return PLANET_META[key].label[language === 'en' ? 'en' : 'ru'];
}

export function getZodiacElementStyle(sign: string | null | undefined) {
  if (!sign || !ZODIAC_SIGNS.includes(sign as ZodiacSign)) {
    return ZODIAC_ELEMENT_STYLES.Air;
  }
  const element = getElementForSign(sign as ZodiacSign);
  return ZODIAC_ELEMENT_STYLES[element];
}

export function getModalityForSign(sign: string | null | undefined): ZodiacModalityKey {
  if (!sign || !ZODIAC_SIGNS.includes(sign as ZodiacSign)) return 'Mutable';
  return MODALITY_BY_SIGN[sign as ZodiacSign];
}

export function getLocalizedElement(language: Language, element: ZodiacElementKey): string {
  if (language === 'en') return element;
  if (element === 'Fire') return 'Огонь';
  if (element === 'Earth') return 'Земля';
  if (element === 'Air') return 'Воздух';
  return 'Вода';
}

export function getLocalizedModality(language: Language, modality: ZodiacModalityKey): string {
  if (language === 'en') return modality;
  if (modality === 'Cardinal') return 'Кардинальный';
  if (modality === 'Fixed') return 'Фиксированный';
  return 'Мутабельный';
}

export function getHouseThemeLabel(house: number | null | undefined, language: Language): string {
  if (!house || !HOUSE_THEME_LABELS[house]) {
    return language === 'en' ? 'House · Topic' : 'Дом · тема';
  }
  return HOUSE_THEME_LABELS[house][language === 'en' ? 'en' : 'ru'];
}

export function buildPlanetInsightCacheKey(
  planetId: NatalPlanetKey,
  language: Language,
  calculationVersion?: string | null
): string {
  const safeVersion = String(calculationVersion || 'default').trim() || 'default';
  return `planet:${planetId}:lang:${language === 'en' ? 'en' : 'ru'}:calc:${safeVersion}`;
}
