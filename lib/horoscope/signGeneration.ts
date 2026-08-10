import type { Language, SignHoroscopePeriod, SignHoroscopeReadingV2 } from '../../types';
import { getAppSystemVoice } from '../appVoice';
import { getDeepSeekClient } from '../deepseekClient';
import { buildDeepSeekChatParams } from '../deepseekChat';
import { normalizeZodiacKey, type ZodiacKey } from '../zodiacKeys';
import type { SignSkyBatchDigest } from './signSkyDigest';
import {
  MAX_SIGN_HOROSCOPE_WORDS,
  SIGN_HOROSCOPE_MODEL,
  parseSignHoroscopeJson,
  validateSignHoroscopeReading,
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
};

export type SignHoroscopeBatchGenerationResult = {
  readings: SignHoroscopeReadingV2[];
  failures: SignHoroscopeBatchFailure[];
};

const PERIOD_INSTRUCTIONS: Record<SignHoroscopePeriod, { ru: string; en: string }> = {
  day: {
    ru: 'Опиши один ясный вектор этого дня. Не делай глобальных выводов из короткого периода.',
    en: 'Describe one clear vector for this day. Do not draw global conclusions from a short period.',
  },
  week: {
    ru: 'Собери главный вектор недели в один рассказ, без семи отдельных дневных заметок.',
    en: 'Turn the main vector of the week into one story, not seven separate daily notes.',
  },
  month: {
    ru: 'Дай цельный взгляд на месяц без календарного перечисления каждого дня.',
    en: 'Give one coherent view of the month without listing every calendar day.',
  },
};

function promptSystem(language: Language): string {
  const task = language === 'en'
    ? `Write one shared Sun-sign forecast for every requested sign from a completed deterministic server calculation.
The calculation is context, not user-facing copy. Never mention astrology, planets, signs, houses, aspects, transits, retrogrades, or technical calculation details in headline or text.
Return JSON only with exactly one top-level field named readings. readings must contain every requested sign exactly once. Each item has exactly sign, headline, and text.
For every item, headline and text together must contain no more than ${MAX_SIGN_HOROSCOPE_WORDS} words.
Each text is one coherent human story without section labels, lists, mandatory life areas, Markdown, fatalism, guarantees, or invented concrete events.
Be direct, confident, specific, calm, and useful. Stop when the thought is complete.`
    : `Напиши по одному общему прогнозу для каждого запрошенного солнечного знака на основе готового детерминированного серверного расчёта.
Расчёт — только скрытый контекст. Не упоминай в headline и text астрологию, планеты, знаки, дома, аспекты, транзиты, ретроградность и технические детали расчёта.
Верни только JSON ровно с одним верхнеуровневым полем readings. В readings должен быть каждый запрошенный знак ровно один раз. У каждого элемента ровно три поля: sign, headline и text.
Для каждого элемента headline и text вместе — не больше ${MAX_SIGN_HOROSCOPE_WORDS} слов.
Каждый text — один цельный человеческий рассказ без рубрик, списков, обязательных жизненных сфер, Markdown, фатализма, гарантий и выдуманных конкретных событий.
Пиши прямо, уверенно, конкретно, спокойно и полезно. Остановись, когда мысль закончена.`;
  return `${getAppSystemVoice(language === 'en' ? 'en' : 'ru')}\n\n${task}`;
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
      maxWordsTogetherPerSign: MAX_SIGN_HOROSCOPE_WORDS,
    },
    calculatedContext: digestForSigns(digest, signs),
  });
}

function validateBatchAttempt(
  content: unknown,
  digest: SignSkyBatchDigest,
  requestedSigns: readonly ZodiacKey[],
): SignHoroscopeBatchGenerationResult {
  const parsed = parseSignHoroscopeJson(content);
  const rawReadings = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>).readings
    : null;
  if (!Array.isArray(rawReadings)) {
    return {
      readings: [],
      failures: requestedSigns.map((sign) => ({ sign, issues: ['readings must be an array'] })),
    };
  }

  const entries = new Map<ZodiacKey, Array<Record<string, unknown>>>();
  rawReadings.forEach((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const input = raw as Record<string, unknown>;
    const sign = normalizeZodiacKey(String(input.sign || ''));
    if (!sign) return;
    const list = entries.get(sign) || [];
    list.push(input);
    entries.set(sign, list);
  });

  const readings: SignHoroscopeReadingV2[] = [];
  const failures: SignHoroscopeBatchFailure[] = [];
  requestedSigns.forEach((sign) => {
    const matches = entries.get(sign) || [];
    if (matches.length !== 1) {
      failures.push({
        sign,
        issues: [matches.length === 0 ? 'reading is missing' : 'reading is duplicated'],
      });
      return;
    }

    const input = matches[0];
    const unexpected = Object.keys(input).filter((key) => !['sign', 'headline', 'text'].includes(key));
    const validated = validateSignHoroscopeReading(
      { headline: input.headline, text: input.text },
      { sign, period: digest.period, periodKey: digest.periodKey },
    );
    const issues = [
      ...(unexpected.length ? [`unexpected fields: ${unexpected.join(', ')}`] : []),
      ...(validated.ok ? [] : validated.issues),
    ];
    if (issues.length || !validated.ok) {
      failures.push({ sign, issues });
      return;
    }
    readings.push(validated.reading);
  });
  return { readings, failures };
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
  return validateBatchAttempt(content, digest, signs);
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
