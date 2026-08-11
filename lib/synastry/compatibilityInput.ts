import { sunSignFromDate } from './compatScore';
import { normalizeZodiacKey, type ZodiacKey } from '../zodiacKeys';

export type CompatibilityPersonSource = 'birth' | 'saved' | 'sign';
export type CompatibilityPersonLevel = 'exact' | 'unknown_time' | 'date_only' | 'sign';
export type CompatibilityPairLevel = 'full' | 'reduced' | 'date_only' | 'hybrid_sign' | 'sign_only';

export type CompatibilityPersonInput = {
  source?: CompatibilityPersonSource | string | null;
  chartId?: number | null;
  name?: string | null;
  date?: string | null;
  time?: string | null;
  place?: string | null;
  sign?: string | null;
  chartBirthTimeQuality?: string | null;
};

export type ClassifiedCompatibilityPerson = {
  source: CompatibilityPersonSource;
  level: CompatibilityPersonLevel;
  sign: ZodiacKey | null;
};

export function normalizeCompatibilityPersonSource(input: CompatibilityPersonInput): CompatibilityPersonSource {
  if (input.source === 'saved' || input.source === 'birth' || input.source === 'sign') return input.source;
  if (input.chartId != null) return 'saved';
  if (normalizeZodiacKey(input.sign)) return 'sign';
  return 'birth';
}

export function classifyCompatibilityPerson(input: CompatibilityPersonInput): ClassifiedCompatibilityPerson {
  const source = normalizeCompatibilityPersonSource(input);
  const sign = normalizeZodiacKey(input.sign) || normalizeZodiacKey(sunSignFromDate(input.date));

  if (source === 'sign') return { source, level: 'sign', sign };

  const hasDate = Boolean(String(input.date || '').trim());
  const hasPlace = Boolean(String(input.place || '').trim());
  const hasTime = Boolean(String(input.time || '').trim());
  const savedQuality = String(input.chartBirthTimeQuality || '').trim().toLowerCase();
  const exactSaved = source === 'saved' && (savedQuality === 'exact' || (!savedQuality && hasTime && hasPlace));
  const unknownSaved = source === 'saved' && (savedQuality === 'unknown' || (!savedQuality && hasPlace && !hasTime));

  if (exactSaved || (source === 'birth' && hasDate && hasPlace && hasTime)) {
    return { source, level: 'exact', sign };
  }
  if (unknownSaved || (source === 'birth' && hasDate && hasPlace)) {
    return { source, level: 'unknown_time', sign };
  }
  return { source, level: 'date_only', sign };
}

export function resolveCompatibilityPairLevel(
  subject: ClassifiedCompatibilityPerson,
  partner: ClassifiedCompatibilityPerson,
): CompatibilityPairLevel {
  if (subject.level === 'sign' && partner.level === 'sign') return 'sign_only';
  if (subject.level === 'sign' || partner.level === 'sign') return 'hybrid_sign';
  if (subject.level === 'date_only' || partner.level === 'date_only') return 'date_only';
  if (subject.level === 'unknown_time' || partner.level === 'unknown_time') return 'reduced';
  return 'full';
}

export function compatibilityPairLevelLabel(level: CompatibilityPairLevel, language: 'ru' | 'en'): string {
  const labels: Record<CompatibilityPairLevel, { ru: string; en: string }> = {
    full: { ru: 'Максимальная точность', en: 'Maximum precision' },
    reduced: { ru: 'Без точного времени', en: 'Without exact birth time' },
    date_only: { ru: 'Расчёт по датам рождения', en: 'Birth-date calculation' },
    hybrid_sign: { ru: 'Карта и знак · базовый уровень', en: 'Chart and sign · basic level' },
    sign_only: { ru: 'Бесплатный разбор по знакам', en: 'Free zodiac-sign reading' },
  };
  return labels[level][language];
}
