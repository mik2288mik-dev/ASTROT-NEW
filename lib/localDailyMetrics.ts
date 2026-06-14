import type { Language, TodayPulse } from '../types';
import { normalizeZodiacKey, type ZodiacKey } from './horoscope/signDaily';

export type DailyMetricKey = 'mood' | 'energy' | 'communication' | 'focus';

export type DailyMetrics = {
  mood: number;
  energy: number;
  communication: number;
  focus: number;
  footnote: string;
};

const SIGN_INDEX: Record<ZodiacKey, number> = {
  Aries: 0,
  Taurus: 1,
  Gemini: 2,
  Cancer: 3,
  Leo: 4,
  Virgo: 5,
  Libra: 6,
  Scorpio: 7,
  Sagittarius: 8,
  Capricorn: 9,
  Aquarius: 10,
  Pisces: 11,
};

function clampPct(value: number): number {
  return Math.max(38, Math.min(92, Math.round(value)));
}

function localScore(sign: ZodiacKey, weekday: number, salt: number): number {
  const base = (SIGN_INDEX[sign] * 7 + weekday * 11 + salt * 13) % 55;
  return clampPct(45 + base);
}

function peakLabel(hour: number, language: Language): string {
  const start = `${String(hour).padStart(2, '0')}:00`;
  const end = `${String(Math.min(hour + 3, 23)).padStart(2, '0')}:00`;
  return language === 'en'
    ? `Peak ${start}–${end} · stay with one priority`
    : `Пик ${start}–${end} · держись одного приоритета`;
}

export function getLocalDailyMetrics(signRaw: string, dateKey: string, language: Language): DailyMetrics | null {
  const sign = normalizeZodiacKey(signRaw);
  if (!sign) return null;
  const d = new Date(`${dateKey}T12:00:00`);
  const weekday = Number.isFinite(d.getTime()) ? d.getDay() : 0;
  const peakHour = 10 + ((SIGN_INDEX[sign] + weekday) % 6);
  return {
    mood: localScore(sign, weekday, 1),
    energy: localScore(sign, weekday, 2),
    communication: localScore(sign, weekday, 3),
    focus: localScore(sign, weekday, 4),
    footnote: peakLabel(peakHour, language),
  };
}

export function getPulseDailyMetrics(pulse: TodayPulse, language: Language): DailyMetrics {
  const layers = pulse.layers;
  const peak = pulse.peakPoint;
  const start = peak.time.slice(0, 5);
  const endHour = Math.min(peak.hour + 3, 23);
  const end = `${String(endHour).padStart(2, '0')}:00`;
  const footnote =
    language === 'en'
      ? `Peak ${start}–${end} · ${peak.summary}`
      : `Пик ${start}–${end} · ${peak.summary}`;

  return {
    mood: clampPct(layers.emotions),
    energy: clampPct(layers.energy),
    communication: clampPct(layers.relationships),
    focus: clampPct(layers.focus),
    footnote,
  };
}

export function getMetricLabels(language: Language): Record<DailyMetricKey, string> {
  if (language === 'en') {
    return { mood: 'Mood', energy: 'Energy', communication: 'Talk', focus: 'Focus' };
  }
  return { mood: 'Настроение', energy: 'Энергия', communication: 'Общение', focus: 'Фокус' };
}
