import type {
  SignHoroscopePeriod,
  SignHoroscopeReadingV2,
  SignHoroscopeTextBlock,
} from '../../types';
import { normalizeZodiacKey, type ZodiacKey } from '../zodiacKeys';

export const SIGN_HOROSCOPE_READING_SCHEMA_VERSION = 'sign-horoscope-reading-v2' as const;
export const SIGN_HOROSCOPE_CACHE_VERSION = 'sign-horoscope-batch-v2.1' as const;

const BLOCK_KEYS = [
  'mood',
  'relationships',
  'work',
  'innerState',
  'advice',
] as const;

export type SignHoroscopeBlockKey = (typeof BLOCK_KEYS)[number];

export type SignReadingValidationResult =
  | { ok: true; reading: SignHoroscopeReadingV2 }
  | { ok: false; issues: string[] };

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
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
): SignHoroscopeTextBlock | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(`${path} must be an object`);
    return null;
  }
  const raw = value as Record<string, unknown>;
  const text = cleanText(raw.text);
  const evidenceIds = normalizeEvidenceIds(raw.evidenceIds ?? raw.evidence_ids, allowedEvidenceIds);
  if (!text) issues.push(`${path}.text is required`);
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

  const blocks = {} as Record<SignHoroscopeBlockKey, SignHoroscopeTextBlock | null>;
  for (const key of BLOCK_KEYS) {
    blocks[key] = normalizeBlock(input[key], expected.allowedEvidenceIds, key, issues);
  }

  let warning: SignHoroscopeTextBlock | null = null;
  if (input.warning != null) {
    warning = normalizeBlock(input.warning, expected.allowedEvidenceIds, 'warning', issues);
  }

  if (issues.length || !sign || BLOCK_KEYS.some((key) => !blocks[key])) {
    return { ok: false, issues };
  }

  return {
    ok: true,
    reading: {
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
    },
  };
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
