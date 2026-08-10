import type { Language, SignHoroscopePeriod, SignHoroscopeReadingV2 } from '../../types';
import { getAppSystemVoice } from '../appVoice';
import { getContentAiClient } from '../contentAiClient';
import { buildOpenAIChatParams } from '../openaiChat';
import type { ZodiacKey } from '../zodiacKeys';
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
    ? `Write one shared Sun-sign forecast from a completed deterministic server calculation.
The calculation is context, not user-facing copy. Never mention astrology, planets, signs, houses, aspects, transits, retrogrades, or technical calculation details.
Return JSON only with exactly two string fields: headline and text.
The headline and text together must contain no more than ${MAX_SIGN_HOROSCOPE_WORDS} words.
The text must be one coherent human story without section labels, lists, mandatory life areas, Markdown, fatalism, guarantees, or invented concrete events.
Be direct, confident, specific, calm, and useful. Stop when the thought is complete.`
    : `Напиши один общий прогноз по солнечному знаку на основе готового детерминированного серверного расчёта.
Расчёт — только скрытый контекст. Не упоминай астрологию, планеты, знаки, дома, аспекты, транзиты, ретроградность и технические детали расчёта.
Верни только JSON ровно с двумя строковыми полями: headline и text.
Заголовок и текст вместе — не больше ${MAX_SIGN_HOROSCOPE_WORDS} слов.
Текст — один цельный человеческий рассказ без рубрик, списков, обязательных жизненных сфер, Markdown, фатализма, гарантий и выдуманных конкретных событий.
Пиши прямо, уверенно, конкретно, спокойно и полезно. Остановись, когда мысль закончена.`;
  return `${getAppSystemVoice(language === 'en' ? 'en' : 'ru')}\n\n${task}`;
}

function digestForSign(digest: SignSkyBatchDigest, sign: ZodiacKey): unknown {
  return {
    ...digest,
    signs: digest.signs.filter((item) => item.sign === sign),
  };
}

function promptUser(
  digest: SignSkyBatchDigest,
  sign: ZodiacKey,
  language: Language,
  repairIssues?: string[],
): string {
  return JSON.stringify({
    sign,
    period: digest.period,
    periodKey: digest.periodKey,
    language: language === 'en' ? 'en' : 'ru',
    instruction: PERIOD_INSTRUCTIONS[digest.period][language === 'en' ? 'en' : 'ru'],
    repairIssues: repairIssues || null,
    outputContract: {
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'text'],
      properties: {
        headline: { type: 'string' },
        text: { type: 'string' },
      },
      maxWordsTogether: MAX_SIGN_HOROSCOPE_WORDS,
    },
    calculatedContext: digestForSign(digest, sign),
  });
}

async function runAttempt(
  digest: SignSkyBatchDigest,
  sign: ZodiacKey,
  language: Language,
  runner: SignHoroscopeModelRunner,
  repairIssues?: string[],
) {
  const content = await runner({
    system: promptSystem(language),
    user: promptUser(digest, sign, language, repairIssues),
    maxTokens: 900,
  });
  return validateSignHoroscopeReading(parseSignHoroscopeJson(content), {
    sign,
    period: digest.period,
    periodKey: digest.periodKey,
  });
}

export async function generateSignHoroscopeWithRunner(
  digest: SignSkyBatchDigest,
  sign: ZodiacKey,
  language: Language,
  runner: SignHoroscopeModelRunner,
): Promise<SignHoroscopeReadingV2> {
  const first = await runAttempt(digest, sign, language, runner);
  if (first.ok) return first.reading;

  const repair = await runAttempt(digest, sign, language, runner, first.issues);
  if (repair.ok) return repair.reading;
  throw new SignHoroscopeGenerationError(
    'SIGN_HOROSCOPE_VALIDATION_FAILED',
    `Invalid sign horoscope for ${sign}`,
    repair.issues,
  );
}

export async function generateSignHoroscope(
  digest: SignSkyBatchDigest,
  sign: ZodiacKey,
  language: Language,
): Promise<SignHoroscopeReadingV2> {
  const client = getContentAiClient(SIGN_HOROSCOPE_MODEL);
  if (!client) {
    throw new SignHoroscopeGenerationError(
      'SIGN_HOROSCOPE_GENERATION_UNAVAILABLE',
      'DeepSeek content generation is not configured',
    );
  }

  try {
    return await generateSignHoroscopeWithRunner(digest, sign, language, async (request) => {
      const completion = await client.chat.completions.create(buildOpenAIChatParams(SIGN_HOROSCOPE_MODEL, {
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
