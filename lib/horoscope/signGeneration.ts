import type { Language, SignHoroscopePeriod, SignHoroscopeReadingV2 } from '../../types';
import { getDeepSeekClient } from '../deepseekClient';
import { buildDeepSeekChatParams } from '../deepseekChat';
import { normalizeZodiacKey, type ZodiacKey } from '../zodiacKeys';
import type { SignSkyBatchDigest } from './signSkyDigest';
import {
  SIGN_HOROSCOPE_READING_SCHEMA_VERSION,
  SIGN_HOROSCOPE_MODEL,
  isReadableSignForecastText,
  parseSignHoroscopeJson,
} from './signContract';

export { SIGN_HOROSCOPE_MODEL } from './signContract';

export type SignHoroscopeGenerationErrorCode =
  | 'SIGN_HOROSCOPE_GENERATION_UNAVAILABLE'
  | 'SIGN_HOROSCOPE_GENERATION_FAILED'
  | 'SIGN_HOROSCOPE_VALIDATION_FAILED';

export class SignHoroscopeGenerationError extends Error {
  readonly code: SignHoroscopeGenerationErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: SignHoroscopeGenerationErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'SignHoroscopeGenerationError';
    this.code = code;
    this.status = code === 'SIGN_HOROSCOPE_GENERATION_UNAVAILABLE' ? 503 : 500;
    this.details = details;
  }
}

export type SignHoroscopeModelRunner = (request: {
  system: string;
  user: string;
  maxTokens: number;
}) => Promise<string>;

export type SignHoroscopeBatchFailure = {
  sign: ZodiacKey;
  issues: string[];
  kind?: 'invalid_response' | 'missing_sign' | 'duplicate_sign' | 'invalid_reading' | 'provider_error' | 'storage_error';
};

export type SignHoroscopeBatchGenerationResult = {
  readings: SignHoroscopeReadingV2[];
  failures: SignHoroscopeBatchFailure[];
};

const PERIOD_INSTRUCTIONS: Record<SignHoroscopePeriod, { ru: string; en: string }> = {
  day: {
    ru: 'Напиши прогноз на этот день.',
    en: 'Write a forecast for this day.',
  },
  week: {
    ru: 'Напиши прогноз на эту неделю.',
    en: 'Write a forecast for this week.',
  },
  month: {
    ru: 'Напиши прогноз на этот месяц.',
    en: 'Write a forecast for this month.',
  },
};

function promptSystem(language: Language): string {
  return language === 'en'
    ? `Write a friendly, meaningful forecast for each requested sign and period using the supplied calculation. Use natural, everyday language, without displaying astrology terms or inventing facts about the reader.
Return JSON with a readings array; each entry must identify the sign and include headline and text.`
    : `Напиши для каждого запрошенного знака содержательный и доброжелательный прогноз на указанный период по переданному расчёту. Пиши обычными понятными словами, без астрологических терминов и выдуманных фактов о жизни человека.
Верни JSON с массивом readings; для каждого прогноза укажи sign, headline и text.`;
}

function uniqueSigns(signs: readonly ZodiacKey[]): ZodiacKey[] {
  return signs.filter((sign, index) => signs.indexOf(sign) === index);
}

function digestForSigns(digest: SignSkyBatchDigest, signs: readonly ZodiacKey[]): SignSkyBatchDigest {
  const requested = new Set(signs);
  return {
    ...digest,
    signs: digest.signs.filter((item) => requested.has(item.sign)),
  };
}

function promptUser(
  digest: SignSkyBatchDigest,
  signs: readonly ZodiacKey[],
  language: Language,
  repairIssues?: Record<string, string[]>,
): string {
  return JSON.stringify({
    signs,
    period: digest.period,
    periodKey: digest.periodKey,
    language: language === 'en' ? 'en' : 'ru',
    instruction: PERIOD_INSTRUCTIONS[digest.period][language === 'en' ? 'en' : 'ru'],
    repairIssues: repairIssues || null,
    outputContract: {
      type: 'object',
      additionalProperties: false,
      required: ['readings'],
      properties: {
        readings: {
          type: 'array',
          requiredSigns: signs,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['sign', 'headline', 'text'],
            properties: {
              sign: { enum: signs },
              headline: { type: 'string' },
              text: { type: 'string' },
            },
          },
        },
      },
    },
    calculatedContext: digestForSigns(digest, signs),
  });
}

/** Recover only complete JSON entries if the provider truncated the outer array. */
function readCompleteTruncatedEntries(content: unknown): unknown[] | null {
  if (typeof content !== 'string') return null;
  const start = /^\s*(?:```(?:json)?\s*)?\{\s*"readings"\s*:\s*\[/iu.exec(content);
  if (!start) return null;
  const entries: unknown[] = [];
  let position = start[0].length;
  while (position < content.length) {
    while (/[\s,]/u.test(content[position] || '') && position < content.length) position += 1;
    if (content[position] !== '{') break;
    const begin = position;
    let depth = 0;
    let insideString = false;
    let escaped = false;
    for (; position < content.length; position += 1) {
      const char = content[position];
      if (insideString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') insideString = false;
      } else if (char === '"') insideString = true;
      else if (char === '{') depth += 1;
      else if (char === '}' && --depth === 0) {
        try { entries.push(JSON.parse(content.slice(begin, position + 1))); } catch { /* Not a complete JSON entry. */ }
        position += 1;
        break;
      }
    }
    if (depth !== 0) break;
  }
  return entries.length ? entries : null;
}

async function runAttempt(
  digest: SignSkyBatchDigest,
  signs: readonly ZodiacKey[],
  language: Language,
  runner: SignHoroscopeModelRunner,
  repairIssues?: Record<string, string[]>,
): Promise<SignHoroscopeBatchGenerationResult> {
  const content = await runner({
    system: promptSystem(language),
    user: promptUser(digest, signs, language, repairIssues),
    maxTokens: Math.min(5_200, Math.max(900, signs.length * 430)),
  });
  const parsed = parseSignHoroscopeJson(content);
  const items = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>).readings
    : readCompleteTruncatedEntries(content);
  if (!Array.isArray(items)) return {
    readings: [],
    failures: signs.map((sign) => ({ sign, kind: 'invalid_response', issues: ['readings must be an array'] })),
  };
  const requested = new Set(signs);
  const readings: SignHoroscopeReadingV2[] = [];
  const identified = new Set<ZodiacKey>();
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const raw = item as Record<string, unknown>;
    const sign = normalizeZodiacKey(typeof raw.sign === 'string' ? raw.sign : '');
    if (!sign || !requested.has(sign)) continue;
    identified.add(sign);
    const text = raw.text;
    if (readings.some((reading) => reading.sign === sign) || !isReadableSignForecastText(text)
      || (raw.period !== undefined && raw.period !== digest.period)
      || (raw.periodKey !== undefined && raw.periodKey !== digest.periodKey)) continue;
    readings.push({
      schemaVersion: SIGN_HOROSCOPE_READING_SCHEMA_VERSION,
      sign,
      period: digest.period,
      periodKey: digest.periodKey,
      headline: isReadableSignForecastText(raw.headline) ? raw.headline : (language === 'en' ? 'Forecast' : 'Прогноз'),
      text,
    });
  }
  const failures: SignHoroscopeBatchFailure[] = signs.filter((sign) => !readings.some((item) => item.sign === sign))
    .map((sign) => identified.has(sign)
      ? { sign, kind: 'invalid_reading', issues: ['reading has no readable text for this period'] }
      : { sign, kind: 'missing_sign', issues: ['reading is missing'] });
  return { readings, failures };
}

export async function generateSignHoroscopeBatchWithRunner(
  digest: SignSkyBatchDigest,
  requestedSigns: readonly ZodiacKey[],
  language: Language,
  runner: SignHoroscopeModelRunner,
): Promise<SignHoroscopeBatchGenerationResult> {
  const signs = uniqueSigns(requestedSigns);
  if (signs.length === 0) return { readings: [], failures: [] };

  const first = await runAttempt(digest, signs, language, runner);
  const completed = new Map(first.readings.map((reading) => [reading.sign as ZodiacKey, reading]));
  const failures: SignHoroscopeBatchFailure[] = [];

  for (const failed of first.failures) {
    try {
      const repaired = await runAttempt(
        digest,
        [failed.sign],
        language,
        runner,
        { [failed.sign]: failed.issues },
      );
      const reading = repaired.readings.find((item) => item.sign === failed.sign);
      if (reading) completed.set(failed.sign, reading);
      else failures.push(repaired.failures[0] || failed);
    } catch (error) {
      failures.push({
        sign: failed.sign,
        kind: 'provider_error',
        issues: [error instanceof Error ? error.message : 'repair request failed'],
      });
    }
  }

  return {
    readings: signs.flatMap((sign) => {
      const reading = completed.get(sign);
      return reading ? [reading] : [];
    }),
    failures,
  };
}

export async function generateSignHoroscopeBatch(
  digest: SignSkyBatchDigest,
  signs: readonly ZodiacKey[],
  language: Language,
): Promise<SignHoroscopeBatchGenerationResult> {
  const client = getDeepSeekClient();
  if (!client) {
    throw new SignHoroscopeGenerationError(
      'SIGN_HOROSCOPE_GENERATION_UNAVAILABLE',
      'DeepSeek content generation is not configured',
    );
  }

  try {
    return await generateSignHoroscopeBatchWithRunner(digest, signs, language, async (request) => {
      const completion = await client.chat.completions.create(buildDeepSeekChatParams(SIGN_HOROSCOPE_MODEL, {
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        maxTokens: request.maxTokens,
        jsonMode: true,
      }));
      return completion.choices[0]?.message?.content || '';
    });
  } catch (error) {
    if (error instanceof SignHoroscopeGenerationError) throw error;
    throw new SignHoroscopeGenerationError(
      'SIGN_HOROSCOPE_GENERATION_FAILED',
      error instanceof Error ? error.message : 'Sign horoscope generation failed',
      error,
    );
  }
}
