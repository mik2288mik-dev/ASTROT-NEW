import type { SignHoroscopePeriod, SignHoroscopeReadingV2 } from '../../types';
import { hasAppVoiceViolation } from '../appVoice';
import type { ZodiacKey } from '../zodiacKeys';

export const SIGN_HOROSCOPE_READING_SCHEMA_VERSION = 'sign-horoscope-reading-v4' as const;
export const SIGN_HOROSCOPE_CACHE_VERSION = 'sign-horoscope-v5-batch-deepseek' as const;
export const SIGN_HOROSCOPE_MODEL = 'deepseek-v4-flash' as const;
export const MAX_SIGN_HOROSCOPE_WORDS = 130;

const USER_COPY_ASTROLOGY_TERMS = /\b(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|planet|astrology|astrological|aspect|transit|retrograde|natal|zodiac|horoscope|ruler|ascendant|conjunction|opposition|trine|sextile|orb|solar\s+house|whole-sign\s+house)\b|(?:солнц|лун|меркур|венер|марс|юпитер|сатурн|уран|нептун|плутон|планет|астролог|аспект|транзит|ретроград|натал|зодиак|гороскоп|управител|асцендент|соединени|оппозиц|трин|секстил|орб|солнечн[а-яё]*\s+дом|дом[а-яё]*\s+от\s+знака)/iu;

export type SignReadingValidationResult =
  | { ok: true; reading: SignHoroscopeReadingV2 }
  | { ok: false; issues: string[] };

export function cleanSignHoroscopeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

export function countSignHoroscopeWords(text: string): number {
  return cleanSignHoroscopeText(text).split(/\s+/u).filter(Boolean).length;
}

export function validateSignHoroscopeReading(
  raw: unknown,
  expected: {
    sign: ZodiacKey;
    period: SignHoroscopePeriod;
    periodKey: string;
    enforceVoice?: boolean;
  },
): SignReadingValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, issues: ['reading must be an object'] };
  }

  const input = raw as Record<string, unknown>;
  const issues: string[] = [];
  const unexpected = Object.keys(input).filter((key) => key !== 'headline' && key !== 'text');
  if (unexpected.length) issues.push(`unexpected fields: ${unexpected.join(', ')}`);

  const headline = cleanSignHoroscopeText(input.headline);
  const text = cleanSignHoroscopeText(input.text);
  if (!headline) issues.push('headline is required');
  if (!text) issues.push('text is required');
  if (headline && USER_COPY_ASTROLOGY_TERMS.test(headline)) {
    issues.push('headline contains astrology terminology');
  }
  if (text && USER_COPY_ASTROLOGY_TERMS.test(text)) {
    issues.push('text contains astrology terminology');
  }
  if (expected.enforceVoice !== false && headline && hasAppVoiceViolation(headline)) {
    issues.push('headline violates the application voice');
  }
  if (expected.enforceVoice !== false && text && hasAppVoiceViolation(text)) {
    issues.push('text violates the application voice');
  }
  if (headline && text && countSignHoroscopeWords(`${headline} ${text}`) > MAX_SIGN_HOROSCOPE_WORDS) {
    issues.push(`headline and text exceed ${MAX_SIGN_HOROSCOPE_WORDS} words`);
  }

  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    reading: {
      schemaVersion: SIGN_HOROSCOPE_READING_SCHEMA_VERSION,
      sign: expected.sign,
      period: expected.period,
      periodKey: expected.periodKey,
      headline,
      text,
    },
  };
}

export function parseSignHoroscopeJson(content: unknown): unknown {
  if (content && typeof content === 'object') return content;
  if (typeof content !== 'string') return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/iu, '').replace(/\s*```$/u, ''),
  ];
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Model output is data only. Try the next safe wrapper and never evaluate it.
    }
  }
  return null;
}
