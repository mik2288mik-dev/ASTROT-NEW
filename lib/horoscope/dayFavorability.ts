/**
 * Deterministic day "favorability" + lucky elements for the home calendar.
 *
 * Pure functions — the same (sign, dateKey) always yields the same result (no
 * randomness, no clock), so future-day previews are stable and need no storage.
 * This is a heuristic, moon-phase-flavored preview — NOT the full AI forecast,
 * which generates on the actual day.
 */
import { getMoonPhase, type MoonPhaseSlot } from './moonPhase';

const ZODIAC_ORDER = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;

// Base favorability per moon slot (40..95), tuned to each phase's meaning.
const SLOT_BASE: Record<MoonPhaseSlot, number> = {
  'new': 62,
  'waxing-crescent': 70,
  'first-quarter': 64,
  'waxing-gibbous': 76,
  'full': 84,
  'waning-gibbous': 72,
  'last-quarter': 58,
  'waning-crescent': 52,
};

function signIndex(sign: string): number {
  const i = ZODIAC_ORDER.findIndex((s) => s.toLowerCase() === String(sign || '').toLowerCase());
  return i < 0 ? 0 : i;
}

function dateAtNoonUTC(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
}

function weekday(dateKey: string): number {
  return dateAtNoonUTC(dateKey).getUTCDay();
}

// Stable 32-bit hash from sign + date (FNV-1a).
function hash(sign: string, dateKey: string): number {
  const base = `${signIndex(sign)}:${dateKey}`;
  let h = 2166136261;
  for (let i = 0; i < base.length; i += 1) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export type DayFavorability = {
  score: number;            // 40..95
  moonSlot: MoonPhaseSlot;
  moonLabel: string;
  moonShort: string;
  moonMeaning: string;
  illumination: number;     // 0..100
};

export function getDayFavorability(sign: string, dateKey: string): DayFavorability {
  const moon = getMoonPhase(dateAtNoonUTC(dateKey));
  // Deterministic sign×weekday resonance in [-8, +8].
  const resonance = ((signIndex(sign) * 7 + weekday(dateKey) * 13) % 17) - 8;
  const score = Math.max(40, Math.min(95, SLOT_BASE[moon.slot] + resonance));
  return {
    score,
    moonSlot: moon.slot,
    moonLabel: moon.label,
    moonShort: moon.shortLabel,
    moonMeaning: moon.meaning,
    illumination: moon.illumination,
  };
}

const LUCKY_COLORS = [
  { ru: 'Коралловый', en: 'Coral', hex: '#FF8A8A' },
  { ru: 'Лавандовый', en: 'Lavender', hex: '#C9B8F0' },
  { ru: 'Мятный', en: 'Mint', hex: '#8BE08A' },
  { ru: 'Небесный', en: 'Sky', hex: '#7CC8F0' },
  { ru: 'Янтарный', en: 'Amber', hex: '#F6C64F' },
  { ru: 'Розовый', en: 'Rose', hex: '#F2A0BC' },
  { ru: 'Фиолетовый', en: 'Violet', hex: '#7B5CF6' },
  { ru: 'Бирюзовый', en: 'Teal', hex: '#3FB7A0' },
] as const;

const LUCKY_KEYWORDS_RU = ['Ясность', 'Смелость', 'Спокойствие', 'Поток', 'Тепло', 'Фокус', 'Лёгкость', 'Доверие'];
const LUCKY_KEYWORDS_EN = ['Clarity', 'Courage', 'Calm', 'Flow', 'Warmth', 'Focus', 'Ease', 'Trust'];

export type LuckyElements = {
  color: { name: string; hex: string };
  number: number;     // 1..99
  time: string;       // "HH:00"
  keyword: string;
};

export function getLuckyElements(sign: string, dateKey: string, language: 'ru' | 'en'): LuckyElements {
  const h = hash(sign, dateKey);
  const color = LUCKY_COLORS[h % LUCKY_COLORS.length];
  const number = (h % 99) + 1;
  const hour = 7 + (Math.floor(h / 7) % 15); // 07..21
  const keywords = language === 'ru' ? LUCKY_KEYWORDS_RU : LUCKY_KEYWORDS_EN;
  const keyword = keywords[Math.floor(h / 13) % keywords.length];
  return {
    color: { name: language === 'ru' ? color.ru : color.en, hex: color.hex },
    number,
    time: `${String(hour).padStart(2, '0')}:00`,
    keyword,
  };
}
