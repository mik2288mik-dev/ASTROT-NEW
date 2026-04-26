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

export type NatalLayerMode = 'overview' | 'details';

export type ZodiacElementKey = 'Fire' | 'Earth' | 'Air' | 'Water';
export type ZodiacModalityKey = 'Cardinal' | 'Fixed' | 'Mutable';

type LocalizedText = { ru: string; en: string };

export type PlanetVisualMeta = {
  key: NatalPlanetKey;
  glyph: string;
  radius: number;
  color: string;
  label: LocalizedText;
  order: number;
  freeInteractive: boolean;
};

export const WHEEL_VIEWBOX = 358;
export const WHEEL_CENTER = 179;
export const INNER_CENTER_RADIUS = 18;
export const HOUSE_DOTTED_RADIUS = 72;
export const HOUSE_RING_RADIUS = 108;
export const ZODIAC_OUTER_RADIUS = 130;
export const ZODIAC_GLYPH_RADIUS = 119;
export const OUTER_RIM_RADIUS = 158;
export const PLANET_BASE_RADIUS = 88;
export const PLANET_COLLISION_RADII = [94, 76, 58] as const;

export const NATAL_PLANET_ORDER: NatalPlanetKey[] = [
  'sun',
  'moon',
  'rising',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'chiron',
];

export const ZODIAC_GLYPHS: Record<ZodiacSign, string> = {
  Aries: '♈',
  Taurus: '♉',
  Gemini: '♊',
  Cancer: '♋',
  Leo: '♌',
  Virgo: '♍',
  Libra: '♎',
  Scorpio: '♏',
  Sagittarius: '♐',
  Capricorn: '♑',
  Aquarius: '♒',
  Pisces: '♓',
};

export const PLANET_META: Record<NatalPlanetKey, PlanetVisualMeta> = {
  sun: {
    key: 'sun',
    glyph: '☉',
    radius: 14,
    color: '#E8873A',
    label: { ru: 'Солнце', en: 'Sun' },
    order: 0,
    freeInteractive: true,
  },
  moon: {
    key: 'moon',
    glyph: '☽',
    radius: 13,
    color: '#7B5EA7',
    label: { ru: 'Луна', en: 'Moon' },
    order: 1,
    freeInteractive: true,
  },
  rising: {
    key: 'rising',
    glyph: '↑',
    radius: 13,
    color: '#7B5EA7',
    label: { ru: 'ASC', en: 'ASC' },
    order: 2,
    freeInteractive: true,
  },
  mercury: {
    key: 'mercury',
    glyph: '☿',
    radius: 10,
    color: '#FB8C00',
    label: { ru: 'Меркурий', en: 'Mercury' },
    order: 3,
    freeInteractive: false,
  },
  venus: {
    key: 'venus',
    glyph: '♀',
    radius: 11,
    color: '#43A047',
    label: { ru: 'Венера', en: 'Venus' },
    order: 4,
    freeInteractive: false,
  },
  mars: {
    key: 'mars',
    glyph: '♂',
    radius: 11,
    color: '#E53935',
    label: { ru: 'Марс', en: 'Mars' },
    order: 5,
    freeInteractive: false,
  },
  jupiter: {
    key: 'jupiter',
    glyph: '♃',
    radius: 10,
    color: '#00897B',
    label: { ru: 'Юпитер', en: 'Jupiter' },
    order: 6,
    freeInteractive: false,
  },
  saturn: {
    key: 'saturn',
    glyph: '♄',
    radius: 10,
    color: '#757575',
    label: { ru: 'Сатурн', en: 'Saturn' },
    order: 7,
    freeInteractive: false,
  },
  uranus: {
    key: 'uranus',
    glyph: '♅',
    radius: 9,
    color: '#8E24AA',
    label: { ru: 'Уран', en: 'Uranus' },
    order: 8,
    freeInteractive: false,
  },
  neptune: {
    key: 'neptune',
    glyph: '♆',
    radius: 9,
    color: '#1E88E5',
    label: { ru: 'Нептун', en: 'Neptune' },
    order: 9,
    freeInteractive: false,
  },
  pluto: {
    key: 'pluto',
    glyph: '♇',
    radius: 9,
    color: '#5E35B1',
    label: { ru: 'Плутон', en: 'Pluto' },
    order: 10,
    freeInteractive: false,
  },
  chiron: {
    key: 'chiron',
    glyph: '⚷',
    radius: 8,
    color: '#9E9E9E',
    label: { ru: 'Хирон', en: 'Chiron' },
    order: 11,
    freeInteractive: false,
  },
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
  1: { ru: 'Дом · Личность', en: 'House · Identity' },
  2: { ru: 'Дом · Ресурсы', en: 'House · Resources' },
  3: { ru: 'Дом · Общение', en: 'House · Communication' },
  4: { ru: 'Дом · Семья', en: 'House · Family' },
  5: { ru: 'Дом · Творчество', en: 'House · Creativity' },
  6: { ru: 'Дом · Ритм', en: 'House · Routine' },
  7: { ru: 'Дом · Союз', en: 'House · Partnership' },
  8: { ru: 'Дом · Глубина', en: 'House · Depth' },
  9: { ru: 'Дом · Смысл', en: 'House · Meaning' },
  10: { ru: 'Дом · Карьера', en: 'House · Career' },
  11: { ru: 'Дом · Друзья', en: 'House · Community' },
  12: { ru: 'Дом · Внутренний мир', en: 'House · Inner world' },
};

export function normalizePlanetKey(value: string): NatalPlanetKey | null {
  const key = String(value || '').trim().toLowerCase();
  if (key === 'asc' || key === 'ascendant' || key === 'rising') return 'rising';
  if (key in PLANET_META) return key as NatalPlanetKey;
  return null;
}

export function getPlanetMeta(key: NatalPlanetKey): PlanetVisualMeta {
  return PLANET_META[key];
}

export function getPlanetPositionFromChart(chartData: NatalChartData, key: NatalPlanetKey): PlanetPosition | null {
  if (key === 'rising') return chartData.rising || null;
  return (chartData[key] as PlanetPosition | null | undefined) || null;
}

export function getPlanetDisplayName(key: NatalPlanetKey, language: Language): string {
  return PLANET_META[key].label[language === 'en' ? 'en' : 'ru'];
}

export function isPlanetInteractive(key: NatalPlanetKey, mode: NatalLayerMode, isPremium: boolean): boolean {
  if (mode === 'details' && isPremium) return true;
  return PLANET_META[key].freeInteractive;
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
    return language === 'en' ? 'House · Theme' : 'Дом · Тема';
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
