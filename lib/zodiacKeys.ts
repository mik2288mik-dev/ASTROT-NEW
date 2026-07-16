export const ZODIAC_KEYS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

export type ZodiacKey = (typeof ZODIAC_KEYS)[number];

export function normalizeZodiacKey(value: string | null | undefined): ZodiacKey | null {
  const raw = String(value || '').trim();
  return ZODIAC_KEYS.find((key) => key.toLowerCase() === raw.toLowerCase()) || null;
}
