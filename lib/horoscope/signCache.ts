import type {
  Language,
  SignHoroscopePeriod,
  SignHoroscopeReadingV2,
} from '../../types';
import { getContentPolicy, type GeneratedContentType } from '../contentMatrix';
import { getPool } from '../db';
import { isoWeekToValidRangeUtc, monthKeyToValidRangeUtc } from '../date-utils';
import { normalizeZodiacKey, ZODIAC_KEYS, type ZodiacKey } from '../zodiacKeys';
import {
  MAX_SIGN_HOROSCOPE_WORDS,
  SIGN_HOROSCOPE_CACHE_VERSION,
  SIGN_HOROSCOPE_MODEL,
  SIGN_HOROSCOPE_READING_SCHEMA_VERSION,
  cleanSignHoroscopeText,
  countSignHoroscopeWords,
  validateSignHoroscopeReading,
} from './signContract';

export type SignHoroscopeCacheSnapshot = {
  reading: SignHoroscopeReadingV2;
  stale: boolean;
};

function policyType(period: SignHoroscopePeriod): GeneratedContentType {
  if (period === 'day') return 'sign_daily_horoscope';
  if (period === 'week') return 'sign_weekly_horoscope';
  return 'sign_monthly_horoscope';
}

export function signHoroscopePromptVersion(period: SignHoroscopePeriod): string {
  return `${getContentPolicy(policyType(period)).promptVersion}:${SIGN_HOROSCOPE_CACHE_VERSION}`;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function legacyBlockText(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  return cleanSignHoroscopeText((value as Record<string, unknown>).text);
}

function fitLegacyText(headline: string, paragraphs: string[]): string {
  const remaining = Math.max(0, MAX_SIGN_HOROSCOPE_WORDS - countSignHoroscopeWords(headline));
  const fitted: string[] = [];
  let used = 0;
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/u).filter(Boolean);
    if (used + words.length > remaining) break;
    fitted.push(paragraph);
    used += words.length;
  }
  if (fitted.length) return fitted.join(' ');
  return paragraphs[0]?.split(/\s+/u).filter(Boolean).slice(0, remaining).join(' ') || '';
}

function coerceCachedSignReading(
  payload: unknown,
  expected: { sign: ZodiacKey; period: SignHoroscopePeriod },
  fallbackPeriodKey?: string,
): SignHoroscopeReadingV2 | null {
  const value = parseJson(payload);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (normalizeZodiacKey(String(input.sign || '')) !== expected.sign || input.period !== expected.period) return null;

  const periodKey = cleanSignHoroscopeText(input.periodKey) || cleanSignHoroscopeText(fallbackPeriodKey);
  if (!periodKey) return null;

  if (input.schemaVersion === SIGN_HOROSCOPE_READING_SCHEMA_VERSION) {
    const validated = validateSignHoroscopeReading(
      { headline: input.headline, text: input.text },
      { ...expected, periodKey },
    );
    return validated.ok ? validated.reading : null;
  }

  const headline = cleanSignHoroscopeText(input.headline);
  const text = fitLegacyText(headline, [
    legacyBlockText(input.mood),
    legacyBlockText(input.relationships),
    legacyBlockText(input.work),
    legacyBlockText(input.innerState),
    legacyBlockText(input.advice),
    legacyBlockText(input.warning),
  ].filter(Boolean));
  const migrated = validateSignHoroscopeReading(
    { headline, text },
    { ...expected, periodKey, enforceVoice: false },
  );
  return migrated.ok ? migrated.reading : null;
}

export function parseCachedSignReading(
  payload: unknown,
  expected: { sign: ZodiacKey; period: SignHoroscopePeriod; periodKey: string },
): SignHoroscopeReadingV2 | null {
  const reading = coerceCachedSignReading(payload, expected, expected.periodKey);
  return reading?.periodKey === expected.periodKey ? reading : null;
}

async function readCurrentSignHoroscope(
  period: SignHoroscopePeriod,
  sign: ZodiacKey,
  periodKey: string,
  language: Language,
): Promise<SignHoroscopeReadingV2 | null> {
  const result = await getPool().query(
    `SELECT payload FROM content_cache
     WHERE content_type = $1 AND period_key = $2 AND zodiac_sign = $3
       AND content_key = $4 AND prompt_version = $5
     LIMIT 1`,
    [policyType(period), periodKey, sign, language, signHoroscopePromptVersion(period)],
  );
  return parseCachedSignReading(result.rows[0]?.payload, { sign, period, periodKey });
}

async function readLatestContentCacheForecast(
  period: SignHoroscopePeriod,
  sign: ZodiacKey,
  currentPeriodKey: string,
  language: Language,
): Promise<SignHoroscopeReadingV2 | null> {
  const result = await getPool().query(
    `SELECT payload, period_key
     FROM content_cache
     WHERE content_type = $1 AND zodiac_sign = $2 AND content_key = $3
     ORDER BY (period_key = $4) DESC, updated_at DESC, created_at DESC
     LIMIT 24`,
    [policyType(period), sign, language, currentPeriodKey],
  );
  for (const row of result.rows) {
    const reading = coerceCachedSignReading(row.payload, { sign, period }, String(row.period_key || ''));
    if (reading) return reading;
  }
  return null;
}

async function readLatestLegacyDailyForecast(
  sign: ZodiacKey,
  language: Language,
): Promise<SignHoroscopeReadingV2 | null> {
  const result = await getPool().query(
    `SELECT content, date::text AS period_key
     FROM daily_horoscopes
     WHERE zodiac_sign LIKE $1
     ORDER BY date DESC
     LIMIT 24`,
    [`${sign.toLowerCase()}:${language}:%`],
  );
  for (const row of result.rows) {
    const reading = coerceCachedSignReading(row.content, { sign, period: 'day' }, String(row.period_key || ''));
    if (reading) return reading;
  }
  return null;
}

export async function getCachedSignHoroscope(
  period: SignHoroscopePeriod,
  sign: ZodiacKey,
  periodKey: string,
  language: Language,
): Promise<SignHoroscopeReadingV2 | null> {
  return readCurrentSignHoroscope(period, sign, periodKey, language);
}

export async function getCachedSignHoroscopes(
  period: SignHoroscopePeriod,
  periodKey: string,
  language: Language,
  signs: readonly ZodiacKey[] = ZODIAC_KEYS,
): Promise<Partial<Record<ZodiacKey, SignHoroscopeReadingV2>>> {
  if (signs.length === 0) return {};
  const result = await getPool().query(
    `SELECT zodiac_sign, payload FROM content_cache
     WHERE content_type = $1 AND period_key = $2 AND content_key = $3
       AND prompt_version = $4 AND zodiac_sign = ANY($5::text[])`,
    [policyType(period), periodKey, language, signHoroscopePromptVersion(period), signs],
  );
  const requested = new Set(signs);
  const readings: Partial<Record<ZodiacKey, SignHoroscopeReadingV2>> = {};
  result.rows.forEach((row) => {
    const sign = normalizeZodiacKey(String(row.zodiac_sign || ''));
    if (!sign || !requested.has(sign)) return;
    const reading = parseCachedSignReading(row.payload, { sign, period, periodKey });
    if (reading) readings[sign] = reading;
  });
  return readings;
}

export async function getSignHoroscopeCacheSnapshot(
  period: SignHoroscopePeriod,
  sign: ZodiacKey,
  periodKey: string,
  language: Language,
): Promise<SignHoroscopeCacheSnapshot | null> {
  const current = await readCurrentSignHoroscope(period, sign, periodKey, language);
  if (current) return { reading: current, stale: false };

  const cached = await readLatestContentCacheForecast(period, sign, periodKey, language)
    || (period === 'day' ? await readLatestLegacyDailyForecast(sign, language) : null);
  return cached ? { reading: cached, stale: true } : null;
}

function dailyValidTo(periodKey: string): string {
  const [year, month, day] = periodKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 21, 0, 0)).toISOString();
}

function validTo(period: SignHoroscopePeriod, periodKey: string): string {
  if (period === 'day') return dailyValidTo(periodKey);
  if (period === 'week') return isoWeekToValidRangeUtc(periodKey).validTo;
  return monthKeyToValidRangeUtc(periodKey).validTo;
}

export async function storeSignHoroscope(
  period: SignHoroscopePeriod,
  periodKey: string,
  language: Language,
  reading: SignHoroscopeReadingV2,
): Promise<void> {
  if (reading.period !== period || reading.periodKey !== periodKey) {
    throw new Error('Sign horoscope identity does not match its cache key');
  }
  const policy = getContentPolicy(policyType(period));
  await getPool().query(
    `INSERT INTO content_cache
     (content_type, content_key, period_key, zodiac_sign, access_level, model_tier, model_used, prompt_version, payload, text, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
     ON CONFLICT (
       content_type,
       content_key,
       (COALESCE(date_key, DATE '0001-01-01')),
       (COALESCE(period_key, '')),
       (COALESCE(zodiac_sign, '')),
       (COALESCE(user_id, 0)),
       (COALESCE(chart_id, 0)),
       prompt_version
     ) DO UPDATE SET
       access_level = EXCLUDED.access_level,
       model_tier = EXCLUDED.model_tier,
       model_used = EXCLUDED.model_used,
       payload = EXCLUDED.payload,
       text = EXCLUDED.text,
       expires_at = EXCLUDED.expires_at,
       updated_at = NOW()`,
    [
      policyType(period),
      language,
      periodKey,
      reading.sign,
      period === 'day' ? 'free' : 'pro',
      policy.modelTier,
      SIGN_HOROSCOPE_MODEL,
      signHoroscopePromptVersion(period),
      JSON.stringify(reading),
      `${reading.headline}\n\n${reading.text}`,
      validTo(period, periodKey),
    ],
  );
}
