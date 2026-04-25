/**
 * Client-side moon phase calculator (no Swiss Ephemeris).
 * Uses the synodic period from a known new moon (2000-01-06 18:14 UTC).
 * Accuracy is ±a few hours — fine for "what phase are we in" labels.
 */

const SYNODIC_MONTH_DAYS = 29.530588853;
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

export type MoonPhaseSlot =
  | 'new'
  | 'waxing-crescent'
  | 'first-quarter'
  | 'waxing-gibbous'
  | 'full'
  | 'waning-gibbous'
  | 'last-quarter'
  | 'waning-crescent';

export type MoonPhaseInfo = {
  slot: MoonPhaseSlot;
  /** 0..1 — how far through the synodic cycle. 0 = new, 0.5 = full. */
  fraction: number;
  /** 0..100 — illuminated portion of the disc as seen from Earth. */
  illumination: number;
  label: string;        // RU label, e.g. "Растущая Луна"
  shortLabel: string;   // RU short, e.g. "Растущая"
  meaning: string;      // RU one-liner — what to do in this phase
};

const SLOT_LABEL: Record<MoonPhaseSlot, MoonPhaseInfo['label']> = {
  'new': 'Новолуние',
  'waxing-crescent': 'Растущий серп',
  'first-quarter': 'Первая четверть',
  'waxing-gibbous': 'Растущая Луна',
  'full': 'Полнолуние',
  'waning-gibbous': 'Убывающая Луна',
  'last-quarter': 'Последняя четверть',
  'waning-crescent': 'Убывающий серп',
};

const SLOT_SHORT: Record<MoonPhaseSlot, string> = {
  'new': 'Новая',
  'waxing-crescent': 'Растущая',
  'first-quarter': 'Первая ¼',
  'waxing-gibbous': 'Растущая',
  'full': 'Полная',
  'waning-gibbous': 'Убывающая',
  'last-quarter': 'Последняя ¼',
  'waning-crescent': 'Убывающая',
};

const SLOT_MEANING: Record<MoonPhaseSlot, string> = {
  'new': 'Время начинать. Тихий старт лучше шумного — задай себе одно намерение и иди в его сторону.',
  'waxing-crescent': 'Энергия копится. Делай маленькие шаги, не пытаясь обогнать сам себя.',
  'first-quarter': 'Появляется напряжение — это не сбой, это рост. Можно настаивать на своём, но мягко.',
  'waxing-gibbous': 'Уточняй, шлифуй, корректируй. Многое уже движется — важно не сбавлять темп ради рывка.',
  'full': 'Кульминация и видимость. То, что назрело, выходит наружу. Не торопись с выводами — посмотри.',
  'waning-gibbous': 'Время делиться и закрывать долги — слова, обещания, мелкие задачи.',
  'last-quarter': 'Отпускай то, что больше не работает. Не насильно, а спокойно — место освободится само.',
  'waning-crescent': 'Тихая пауза перед новым витком. Меньше дел, больше сна и наблюдения.',
};

function detectSlot(fraction: number): MoonPhaseSlot {
  // 8 equal-ish slots around the cycle
  if (fraction < 0.0345) return 'new';
  if (fraction < 0.2155) return 'waxing-crescent';
  if (fraction < 0.2845) return 'first-quarter';
  if (fraction < 0.4655) return 'waxing-gibbous';
  if (fraction < 0.5345) return 'full';
  if (fraction < 0.7155) return 'waning-gibbous';
  if (fraction < 0.7845) return 'last-quarter';
  if (fraction < 0.9655) return 'waning-crescent';
  return 'new';
}

export function getMoonPhase(date: Date = new Date()): MoonPhaseInfo {
  const elapsed = (date.getTime() - REFERENCE_NEW_MOON_MS) / 86_400_000;
  const cycles = elapsed / SYNODIC_MONTH_DAYS;
  let fraction = cycles - Math.floor(cycles);
  if (fraction < 0) fraction += 1;

  const slot = detectSlot(fraction);
  // Illumination: 0% at new, 100% at full, sinusoidal between.
  const illumination = Math.round(50 * (1 - Math.cos(2 * Math.PI * fraction)));

  return {
    slot,
    fraction,
    illumination,
    label: SLOT_LABEL[slot],
    shortLabel: SLOT_SHORT[slot],
    meaning: SLOT_MEANING[slot],
  };
}
