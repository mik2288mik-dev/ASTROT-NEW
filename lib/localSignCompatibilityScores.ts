import type { Language } from '../types';
import { getZodiacSign } from '../constants';
import { normalizeZodiacKey, ZODIAC_KEYS, type ZodiacKey } from './zodiacKeys';

type Element = 'fire' | 'earth' | 'air' | 'water';

const ELEMENT: Record<ZodiacKey, Element> = {
  Aries: 'fire',
  Taurus: 'earth',
  Gemini: 'air',
  Cancer: 'water',
  Leo: 'fire',
  Virgo: 'earth',
  Libra: 'air',
  Scorpio: 'water',
  Sagittarius: 'fire',
  Capricorn: 'earth',
  Aquarius: 'air',
  Pisces: 'water',
};

export type LocalCompatScores = {
  overall: number;
  friendship: number;
  talk: number;
  spark: number;
  friction: number;
};

function pairKey(a: Element, b: Element): string {
  return [a, b].sort().join(':');
}

const BASE: Record<string, Partial<LocalCompatScores>> = {
  'fire:fire': { friendship: 78, talk: 74, spark: 86, friction: 42 },
  'fire:earth': { friendship: 58, talk: 52, spark: 64, friction: 58 },
  'fire:air': { friendship: 82, talk: 88, spark: 80, friction: 38 },
  'fire:water': { friendship: 62, talk: 60, spark: 78, friction: 55 },
  'earth:earth': { friendship: 76, talk: 70, spark: 68, friction: 40 },
  'earth:air': { friendship: 60, talk: 66, spark: 58, friction: 52 },
  'earth:water': { friendship: 74, talk: 72, spark: 70, friction: 44 },
  'air:air': { friendship: 80, talk: 90, spark: 72, friction: 36 },
  'air:water': { friendship: 64, talk: 68, spark: 66, friction: 50 },
  'water:water': { friendship: 84, talk: 78, spark: 74, friction: 38 },
};

function tweak(value: number, a: ZodiacKey, b: ZodiacKey, salt: number): number {
  const delta = ((a.charCodeAt(0) + b.charCodeAt(0) + salt) % 9) - 4;
  return Math.max(35, Math.min(94, Math.round(value + delta)));
}

export function getLocalSignCompatibility(aRaw: string, bRaw: string): LocalCompatScores | null {
  const a = normalizeZodiacKey(aRaw);
  const b = normalizeZodiacKey(bRaw);
  if (!a || !b) return null;

  const base = BASE[pairKey(ELEMENT[a], ELEMENT[b])] || { friendship: 65, talk: 65, spark: 65, friction: 48 };
  const friendship = tweak(base.friendship ?? 65, a, b, 1);
  const talk = tweak(base.talk ?? 65, a, b, 2);
  const spark = tweak(base.spark ?? 65, a, b, 3);
  const friction = tweak(base.friction ?? 48, a, b, 4);
  const overall = Math.round((friendship + talk + spark + (100 - friction)) / 4);

  return { overall, friendship, talk, spark, friction };
}

export function formatSignPairLabel(aRaw: string, bRaw: string, language: Language): string {
  const a = normalizeZodiacKey(aRaw);
  const b = normalizeZodiacKey(bRaw);
  if (!a || !b) return '';
  return `${getZodiacSign(language, a)} + ${getZodiacSign(language, b)}`;
}

export { ZODIAC_KEYS };
