import type {
  Language,
  SignHoroscopePeriod,
  SignHoroscopeReadingV2,
  SignHoroscopeTextBlock,
} from '../../types';
import { getModelForTier } from '../appSettings';
import { getContentPolicy, type GeneratedContentType } from '../contentMatrix';
import { db, getPool } from '../db';
import { isoWeekToValidRangeUtc, monthKeyToValidRangeUtc } from '../date-utils';
import type { ZodiacKey } from '../zodiacKeys';
import {
  SIGN_HOROSCOPE_CACHE_VERSION,
  SIGN_HOROSCOPE_READING_SCHEMA_VERSION,
} from './signContract';

function policyType(period: SignHoroscopePeriod): GeneratedContentType {
  if (period === 'day') return 'sign_daily_horoscope';
  if (period === 'week') return 'sign_weekly_horoscope';
  return 'sign_monthly_horoscope';
}

export function signHoroscopePromptVersion(period: SignHoroscopePeriod): string {
  return `${getContentPolicy(policyType(period)).promptVersion}:${SIGN_HOROSCOPE_CACHE_VERSION}`;
}

function dailyCacheSign(sign: ZodiacKey, language: Language): string {
  return `${sign.toLowerCase()}:${language}:${signHoroscopePromptVersion('day')}`;
}

function periodContentKey(language: Language): string {
  return language;
}

function isBlock(value: unknown): value is SignHoroscopeTextBlock {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const block = value as Record<string, unknown>;
  return typeof block.text === 'string'
    && block.text.trim().length > 0
    && Array.isArray(block.evidenceIds)
    && block.evidenceIds.length > 0
    && block.evidenceIds.every((id) => typeof id === 'string' && id.length > 0);
}

export function parseCachedSignReading(
  payload: unknown,
  expected: { sign: ZodiacKey; period: SignHoroscopePeriod; periodKey: string },
): SignHoroscopeReadingV2 | null {
  let value = payload;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const reading = value as Partial<SignHoroscopeReadingV2>;
  if (
    reading.schemaVersion !== SIGN_HOROSCOPE_READING_SCHEMA_VERSION
    || reading.sign !== expected.sign
    || reading.period !== expected.period
    || reading.periodKey !== expected.periodKey
    || typeof reading.headline !== 'string'
    || !reading.headline.trim()
    || !isBlock(reading.mood)
    || !isBlock(reading.relationships)
    || !isBlock(reading.work)
    || !isBlock(reading.innerState)
    || !isBlock(reading.advice)
    || (reading.warning != null && !isBlock(reading.warning))
  ) return null;
  return reading as SignHoroscopeReadingV2;
}

export async function getCachedSignHoroscope(
  period: SignHoroscopePeriod,
  sign: ZodiacKey,
  periodKey: string,
  language: Language,
): Promise<SignHoroscopeReadingV2 | null> {
  if (period === 'day') {
    const payload = await db.daily_horoscopes.get(dailyCacheSign(sign, language), periodKey);
    return parseCachedSignReading(payload, { sign, period, periodKey });
  }

  const contentType = policyType(period);
  const result = await getPool().query(
    `SELECT payload FROM content_cache
     WHERE content_type = $1 AND period_key = $2 AND zodiac_sign = $3
       AND content_key = $4 AND prompt_version = $5
       AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [contentType, periodKey, sign, periodContentKey(language), signHoroscopePromptVersion(period)],
  );
  return parseCachedSignReading(result.rows[0]?.payload, { sign, period, periodKey });
}

function flattenReading(reading: SignHoroscopeReadingV2): string {
  return [
    reading.headline,
    reading.mood.text,
    reading.relationships.text,
    reading.work.text,
    reading.innerState.text,
    reading.advice.text,
    reading.warning?.text,
  ].filter(Boolean).join('\n\n');
}

export async function storeSignHoroscopeBatch(
  period: SignHoroscopePeriod,
  periodKey: string,
  language: Language,
  readings: Record<ZodiacKey, SignHoroscopeReadingV2>,
): Promise<void> {
  if (period === 'day') {
    await Promise.all(Object.entries(readings).map(([sign, reading]) =>
      db.daily_horoscopes.set(
        dailyCacheSign(sign as ZodiacKey, language),
        periodKey,
        JSON.stringify(reading),
      )));
    return;
  }

  const contentType = policyType(period);
  const policy = getContentPolicy(contentType);
  const model = await getModelForTier(policy.modelTier);
  const expiresAt = period === 'week'
    ? isoWeekToValidRangeUtc(periodKey).validTo
    : monthKeyToValidRangeUtc(periodKey).validTo;

  await Promise.all(Object.entries(readings).map(([sign, reading]) =>
    getPool().query(
      `INSERT INTO content_cache
       (content_type, content_key, period_key, zodiac_sign, access_level, model_tier, model_used, prompt_version, payload, text, expires_at)
       VALUES ($1, $2, $3, $4, 'pro', $5, $6, $7, $8::jsonb, $9, $10)
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
        contentType,
        periodContentKey(language),
        periodKey,
        sign,
        policy.modelTier,
        model,
        signHoroscopePromptVersion(period),
        JSON.stringify(reading),
        flattenReading(reading),
        expiresAt,
      ],
    )));
}

export async function isSignHoroscopeBatchCached(
  period: SignHoroscopePeriod,
  periodKey: string,
  language: Language,
): Promise<boolean> {
  const { ZODIAC_KEYS } = await import('../zodiacKeys');
  const readings = await Promise.all(
    ZODIAC_KEYS.map((sign) => getCachedSignHoroscope(period, sign, periodKey, language)),
  );
  return readings.every(Boolean);
}
