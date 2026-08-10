import type {
  SignHoroscopePeriod,
  SignHoroscopeReadingV2,
  SignHoroscopeTextBlock,
} from '../../types';
import { normalizeZodiacKey, type ZodiacKey } from '../zodiacKeys';

export const SIGN_HOROSCOPE_READING_SCHEMA_VERSION = 'sign-horoscope-reading-v3' as const;
export const SIGN_HOROSCOPE_CACHE_VERSION = 'sign-horoscope-batch-v3.1-human-copy' as const;
export const MAX_SIGN_HOROSCOPE_WORDS = 130;

const BLOCK_KEYS = [
  'mood',
  'relationships',
  'work',
  'innerState',
  'advice',
] as const;
const ASTROLOGY_TERMS = /\b(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|planet|aspect|transit|retrograde|natal|zodiac|horoscope|ruler|ascendant|conjunction|opposition|trine|sextile|orb|astrological\s+houses?|whole-sign\s+house|solar\s+house)\b|(?:солнц|лун|меркур|венер|марс|юпитер|сатурн|уран|нептун|плутон|планет|аспект|транзит|ретроград|натал|зодиак|гороскоп|управител|асцендент|соединени|оппозиц|трин|секстил|орб|астрологическ[а-яё]*\s+дом|солнечн[а-яё]*\s+дом|дом[а-яё]*\s+от\s+знака)/iu;

export type SignHoroscopeBlockKey = (typeof BLOCK_KEYS)[number];

export type SignReadingValidationResult =
  | { ok: true; reading: SignHoroscopeReadingV2 }
  | { ok: false; issues: string[] };

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function normalizeEvidenceIds(value: unknown, allowedEvidenceIds: ReadonlySet<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter((item) => item && allowedEvidenceIds.has(item)),
  )];
}

function normalizeBlock(
  value: unknown,
  allowedEvidenceIds: ReadonlySet<string>,
  path: string,
  issues: string[],
  options: { allowAstrologyTerms?: boolean } = {},
): SignHoroscopeTextBlock | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(`${path} must be an object`);
    return null;
  }
  const raw = value as Record<string, unknown>;
  const text = cleanText(raw.text);
  const evidenceIds = normalizeEvidenceIds(raw.evidenceIds ?? raw.evidence_ids, allowedEvidenceIds);
  if (!text) issues.push(`${path}.text is required`);
  if (text && !options.allowAstrologyTerms && ASTROLOGY_TERMS.test(text)) {
    issues.push(`${path}.text must use plain life language without astrology terms`);
  }
  if (!evidenceIds.length) issues.push(`${path}.evidenceIds must cite supplied evidence`);
  return text && evidenceIds.length ? { text, evidenceIds } : null;
}

export function validateSignHoroscopeReading(
  raw: unknown,
  expected: {
    sign: ZodiacKey;
    period: SignHoroscopePeriod;
    periodKey: string;
    allowedEvidenceIds: ReadonlySet<string>;
  },
): SignReadingValidationResult {
  const issues: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, issues: ['reading must be an object'] };
  }
  const input = raw as Record<string, unknown>;
  const sign = normalizeZodiacKey(String(input.sign || ''));
  if (sign !== expected.sign) issues.push(`sign must be ${expected.sign}`);
  if (input.period !== expected.period) issues.push(`period must be ${expected.period}`);

  const headline = cleanText(input.headline);
  const headlineWords = headline ? headline.split(/\s+/).length : 0;
  if (!headline) issues.push('headline is required');
  if (headlineWords < 2 || headlineWords > 8) issues.push('headline must contain 2-8 words');
  if (headline && ASTROLOGY_TERMS.test(headline)) issues.push('headline must use plain life language without astrology terms');

  const blocks = {} as Record<SignHoroscopeBlockKey, SignHoroscopeTextBlock | null>;
  for (const key of BLOCK_KEYS) {
    blocks[key] = normalizeBlock(input[key], expected.allowedEvidenceIds, key, issues);
  }

  let warning: SignHoroscopeTextBlock | null = null;
  if (input.warning != null) {
    warning = normalizeBlock(input.warning, expected.allowedEvidenceIds, 'warning', issues);
  }
  const astrology = normalizeBlock(input.astrology, expected.allowedEvidenceIds, 'astrology', issues, { allowAstrologyTerms: true });

  if (issues.length || !sign || !astrology || BLOCK_KEYS.some((key) => !blocks[key])) {
    return { ok: false, issues };
  }

  const reading: SignHoroscopeReadingV2 = {
    schemaVersion: SIGN_HOROSCOPE_READING_SCHEMA_VERSION,
    sign,
    period: expected.period,
    periodKey: expected.periodKey,
    headline,
    mood: blocks.mood!,
    relationships: blocks.relationships!,
    work: blocks.work!,
    innerState: blocks.innerState!,
    advice: blocks.advice!,
    warning,
    astrology,
  };

  const readingWords = [
    reading.headline,
    reading.mood.text,
    reading.relationships.text,
    reading.work.text,
    reading.innerState.text,
    reading.advice.text,
    reading.warning?.text,
    reading.astrology.text,
  ].filter((text): text is string => Boolean(text)).reduce((total, text) => total + countWords(text), 0);

  if (readingWords > MAX_SIGN_HOROSCOPE_WORDS) {
    return { ok: false, issues: [`reading exceeds ${MAX_SIGN_HOROSCOPE_WORDS} words`] };
  }
  if (countWords(reading.advice.text) > 18) {
    return { ok: false, issues: ['advice exceeds 18 words'] };
  }

  return { ok: true, reading };
}

export function extractRawSignReadings(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const source = payload as Record<string, unknown>;
  if (Array.isArray(source.readings)) return source.readings;
  if (source.readings && typeof source.readings === 'object') {
    return Object.entries(source.readings as Record<string, unknown>).map(([sign, value]) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? { sign, ...(value as Record<string, unknown>) }
        : value);
  }
  return [];
}

export function parseSignBatchJson(content: unknown): unknown {
  if (content && typeof content === 'object') return content;
  if (typeof content !== 'string') return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, ''),
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
      // Try the next safe wrapper; never evaluate model output.
    }
  }
  return null;
}
