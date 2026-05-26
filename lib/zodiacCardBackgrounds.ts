import type { Language, UserProfile } from '../types';

export const ZODIAC_CARD_BACKGROUND_COUNT = 4;

export type ZodiacKey =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

const ZODIAC_ALIASES: Record<string, ZodiacKey> = {
  aries: 'aries',
  овен: 'aries',
  taurus: 'taurus',
  телец: 'taurus',
  gemini: 'gemini',
  близнецы: 'gemini',
  cancer: 'cancer',
  рак: 'cancer',
  leo: 'leo',
  лев: 'leo',
  virgo: 'virgo',
  дева: 'virgo',
  libra: 'libra',
  весы: 'libra',
  scorpio: 'scorpio',
  скорпион: 'scorpio',
  sagittarius: 'sagittarius',
  стрелец: 'sagittarius',
  capricorn: 'capricorn',
  козерог: 'capricorn',
  aquarius: 'aquarius',
  водолей: 'aquarius',
  pisces: 'pisces',
  рыбы: 'pisces',
};

export function normalizeZodiacKey(sign: string | null | undefined): ZodiacKey | null {
  if (!sign) return null;
  const normalized = sign.trim().toLowerCase();
  return ZODIAC_ALIASES[normalized] ?? null;
}

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getZodiacCardBackground(sign: string | null | undefined, seed = ''): string {
  const key = normalizeZodiacKey(sign);
  if (!key) return '';

  const variant = (stableHash(`${key}:${seed || key}`) % ZODIAC_CARD_BACKGROUND_COUNT) + 1;
  return `/zodiac-card-backgrounds/${key}_card_bg_${String(variant).padStart(2, '0')}.webp`;
}

function formatDate(dateKey: string | undefined): string | null {
  if (!dateKey) return null;
  const [year, month, day] = dateKey.split('-');
  if (!year || !month || !day) return dateKey;
  return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`;
}

function formatTime(timeKey: string | undefined): string | null {
  if (!timeKey) return null;
  const match = timeKey.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return timeKey;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function formatPassportBirthLine(profile: Pick<UserProfile, 'birthDate' | 'birthTime' | 'birthPlace'>, language: Language): string {
  const parts = [
    formatDate(profile.birthDate),
    formatTime(profile.birthTime),
    profile.birthPlace?.trim() || null,
  ].filter((part): part is string => Boolean(part));

  if (parts.length > 0) return parts.join(' • ');
  return language === 'ru' ? 'Данные рождения не указаны' : 'Birth details missing';
}
