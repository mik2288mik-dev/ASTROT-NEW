import type { Language, SignHoroscopePeriod, SignHoroscopeReadingV2 } from '../../types';
import { getAppSystemVoice } from '../appVoice';
import { getModelForTier } from '../appSettings';
import { getContentAiClient } from '../contentAiClient';
import { getContentPolicy } from '../contentMatrix';
import { buildOpenAIChatParams } from '../openaiChat';
import { ZODIAC_KEYS, normalizeZodiacKey, type ZodiacKey } from '../zodiacKeys';
import {
  collectAllowedEvidenceIds,
  type SignSkyBatchDigest,
} from './signSkyDigest';
import {
  extractRawSignReadings,
  parseSignBatchJson,
  validateSignHoroscopeReading,
} from './signContract';

export type SignBatchGenerationErrorCode =
  | 'SIGN_BATCH_GENERATION_UNAVAILABLE'
  | 'SIGN_BATCH_GENERATION_FAILED'
  | 'SIGN_BATCH_VALIDATION_FAILED';

export class SignBatchGenerationError extends Error {
  readonly code: SignBatchGenerationErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: SignBatchGenerationErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'SignBatchGenerationError';
    this.code = code;
    this.status = code === 'SIGN_BATCH_GENERATION_UNAVAILABLE' ? 503 : 500;
    this.details = details;
  }
}

export type SignBatchModelRunner = (request: {
  system: string;
  user: string;
  maxTokens: number;
}) => Promise<string>;

const PERIOD_INSTRUCTIONS: Record<SignHoroscopePeriod, { ru: string; en: string }> = {
  day: {
    ru: 'Дай цельный короткий срез московского дня без глобальных выводов по одному дню.',
    en: 'Give one coherent concise snapshot of the Moscow day without drawing global conclusions from one day.',
  },
  week: {
    ru: 'Собери главный вектор и несколько действительно разных фокусов недели. Учитывай движение факторов внутри недели, не превращай ответ в семь дневных заметок.',
    en: 'Build the main vector and a few genuinely distinct focuses for the week. Use movement within the week without turning the result into seven daily notes.',
  },
  month: {
    ru: 'Дай крупный стратегический расклад месяца без дневного шума. Сопоставляй устойчивые медленные влияния с конкретными периодами быстрых планет.',
    en: 'Give a strategic view of the month without daily noise. Connect durable slow-planet influences with concrete fast-planet intervals.',
  },
};

function outputContract(language: Language) {
  const textDescription = language === 'en'
    ? 'Plain non-empty text in the current user language.'
    : 'Непустой обычный текст на текущем языке пользователя.';
  const blockSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['text', 'evidenceIds'],
    properties: {
      text: { type: 'string', description: textDescription },
      evidenceIds: {
        type: 'array',
        minItems: 1,
        items: { type: 'string', description: 'An existing supplied evidenceId' },
      },
    },
  };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['readings'],
    properties: {
      readings: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['sign', 'period', 'headline', 'mood', 'relationships', 'work', 'innerState', 'advice', 'warning', 'astrology'],
          properties: {
            sign: { type: 'string', description: 'One supplied canonical English zodiac key' },
            period: { type: 'string', enum: ['day', 'week', 'month'] },
            headline: {
              type: 'string',
              description: language === 'en'
                ? '2-8 words; direct, exact, no astrological decoration'
                : '2–8 слов; прямо, точно, без астрологических украшений',
            },
            mood: blockSchema,
            relationships: blockSchema,
            work: blockSchema,
            innerState: blockSchema,
            advice: blockSchema,
            warning: {
              anyOf: [
                { type: 'null' },
                blockSchema,
              ],
              description: 'Use null when no calculated tense factor supports a warning.',
            },
            astrology: blockSchema,
          },
        },
      },
    },
  };
}

function promptSystem(language: Language): string {
  const task = language === 'en'
    ? `You interpret a deterministic Swiss Ephemeris digest for general Sun-sign horoscopes.
The calculation is complete. Never recalculate, alter, or invent positions, signs, houses, aspects, or dates.
Write all requested signs in one JSON response. Treat modern and traditional co-rulers as parallel factual lenses, not competing answers.
Every block must cite at least one evidenceId that exists in the supplied shared sky or that sign's rulers/solar-house placements.
The whole-sign house is a solar-sign house for a general sign horoscope, never a personal natal house.
Do not use generic filler or identical text with sign names swapped. Positive openings matter as much as risk.
The fields mood, relationships, work, and innerState are consecutive paragraphs of one reading, not mandatory life topics. Let the calculated facts decide the life context.
Their combined text must not exceed 130 words. Keep advice to one short sentence of no more than 18 words.
Write mood, relationships, work, innerState, advice, and warning in direct everyday language: no planet names, signs, houses, aspects, transits, or retrograde jargon.
Put the concise factual technical explanation in astrology only, and ground it in its cited evidence.
Return JSON only and preserve the exact field names. Do not add Markdown.`
    : `Ты интерпретируешь детерминированный дайджест Swiss Ephemeris для общего гороскопа по солнечному знаку.
Расчёт уже завершён. Никогда не пересчитывай, не меняй и не выдумывай положения, знаки, дома, аспекты или даты.
Верни все запрошенные знаки одним JSON-ответом. Современный и традиционный соуправители — параллельные фактические линзы, а не конкурирующие ответы.
Каждый блок обязан сослаться минимум на один evidenceId из общего неба либо из управителей/solar-house выбранного знака.
Whole-sign house здесь является домом от солнечного знака для общего гороскопа, а не личным натальным домом.
Не пиши универсальную воду и одинаковый текст с заменой названия знака. Хорошие возможности важны наравне с рисками.
Поля mood, relationships, work и innerState — последовательные абзацы одного разбора, а не обязательные жизненные темы. Жизненный контекст выбирай только по расчётным фактам.
Их общий объём — не больше 130 слов. Advice — одна короткая фраза не больше 18 слов.
В mood, relationships, work, innerState, advice и warning используй прямой человеческий язык: без названий планет, знаков, домов, аспектов, транзитов и ретроградности.
Короткое фактическое техническое объяснение помещай только в astrology и привязывай его к указанным evidenceId.
Верни только JSON с точными именами полей, без Markdown.`;
  return `${getAppSystemVoice(language === 'en' ? 'en' : 'ru')}\n\n${task}`;
}

function digestForTargets(digest: SignSkyBatchDigest, targetSigns: readonly ZodiacKey[]) {
  const targetSet = new Set(targetSigns);
  return {
    ...digest,
    signs: digest.signs.filter((item) => targetSet.has(item.sign)),
  };
}

function promptUser(
  digest: SignSkyBatchDigest,
  language: Language,
  targetSigns: readonly ZodiacKey[],
  repairIssues?: Record<string, string[]>,
): string {
  const periodInstruction = PERIOD_INSTRUCTIONS[digest.period][language === 'en' ? 'en' : 'ru'];
  const instruction = language === 'en'
    ? `Generate readings only for targetSigns. ${periodInstruction}
Use the complete supplied numeric/structural calculation and decide the main story for each sign yourself.
Do not copy a ready-made interpretation: none is supplied. Do not rank factors by array order.
Keep the main reading at 130 words or fewer, with the short advice separate. The astrology field is the only field for technical astrology terms.
The response must contain exactly one valid reading per target sign.`
    : `Сгенерируй разборы только для targetSigns. ${periodInstruction}
Используй полный переданный числовой и структурный расчёт и сам выбери главный сюжет каждого знака.
Не перефразируй готовую трактовку: её во входе нет. Не считай порядок массивов рейтингом важности.
Основной разбор — не больше 130 слов, короткий совет идёт отдельно. Поле astrology — единственное место для технических астрологических терминов.
В ответе должен быть ровно один валидный разбор на каждый целевой знак.`;

  return JSON.stringify({
    task: instruction,
    language: language === 'en' ? 'en' : 'ru',
    targetSigns,
    repairIssues: repairIssues || null,
    outputContract: outputContract(language),
    calculatedDigest: digestForTargets(digest, targetSigns),
  });
}

function collectValidated(
  rawPayload: unknown,
  digest: SignSkyBatchDigest,
  targetSigns: readonly ZodiacKey[],
): {
  valid: Map<ZodiacKey, SignHoroscopeReadingV2>;
  issues: Record<string, string[]>;
} {
  const rawReadings = extractRawSignReadings(rawPayload);
  const rawBySign = new Map<ZodiacKey, unknown>();
  for (const raw of rawReadings) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const sign = normalizeZodiacKey(String((raw as Record<string, unknown>).sign || ''));
    if (sign && !rawBySign.has(sign)) rawBySign.set(sign, raw);
  }

  const valid = new Map<ZodiacKey, SignHoroscopeReadingV2>();
  const issues: Record<string, string[]> = {};
  for (const sign of targetSigns) {
    const raw = rawBySign.get(sign);
    if (!raw) {
      issues[sign] = ['reading is missing'];
      continue;
    }
    const result = validateSignHoroscopeReading(raw, {
      sign,
      period: digest.period,
      periodKey: digest.periodKey,
      allowedEvidenceIds: collectAllowedEvidenceIds(digest, sign),
    });
    if (result.ok) valid.set(sign, result.reading);
    else issues[sign] = result.issues;
  }
  return { valid, issues };
}

async function runAttempt(
  runner: SignBatchModelRunner,
  digest: SignSkyBatchDigest,
  language: Language,
  targetSigns: readonly ZodiacKey[],
  repairIssues?: Record<string, string[]>,
): Promise<ReturnType<typeof collectValidated>> {
  const content = await runner({
    system: promptSystem(language),
    user: promptUser(digest, language, targetSigns, repairIssues),
    maxTokens: digest.period === 'day' ? 6000 : digest.period === 'week' ? 7200 : 8000,
  });
  return collectValidated(parseSignBatchJson(content), digest, targetSigns);
}

/** First request covers all 12 signs; one repair request contains invalid signs only. */
export async function generateSignHoroscopeBatchWithRunner(
  digest: SignSkyBatchDigest,
  language: Language,
  runner: SignBatchModelRunner,
): Promise<Record<ZodiacKey, SignHoroscopeReadingV2>> {
  const first = await runAttempt(runner, digest, language, ZODIAC_KEYS);
  const invalidSigns = ZODIAC_KEYS.filter((sign) => !first.valid.has(sign));

  if (invalidSigns.length) {
    const repair = await runAttempt(runner, digest, language, invalidSigns, first.issues);
    for (const [sign, reading] of repair.valid) first.valid.set(sign, reading);
    for (const sign of invalidSigns) {
      if (repair.valid.has(sign)) delete first.issues[sign];
      else first.issues[sign] = repair.issues[sign] || first.issues[sign] || ['repair failed'];
    }
  }

  const stillInvalid = ZODIAC_KEYS.filter((sign) => !first.valid.has(sign));
  if (stillInvalid.length) {
    throw new SignBatchGenerationError(
      'SIGN_BATCH_VALIDATION_FAILED',
      `Invalid sign horoscope batch: ${stillInvalid.join(', ')}`,
      first.issues,
    );
  }

  return Object.fromEntries(ZODIAC_KEYS.map((sign) => [sign, first.valid.get(sign)!])) as Record<
    ZodiacKey,
    SignHoroscopeReadingV2
  >;
}

export async function generateSignHoroscopeBatch(
  digest: SignSkyBatchDigest,
  language: Language,
): Promise<Record<ZodiacKey, SignHoroscopeReadingV2>> {
  const policyType = digest.period === 'day'
    ? 'sign_daily_horoscope'
    : digest.period === 'week'
      ? 'sign_weekly_horoscope'
      : 'sign_monthly_horoscope';
  const policy = getContentPolicy(policyType);
  const model = await getModelForTier(policy.modelTier);
  const client = getContentAiClient(model);
  if (!client) {
    throw new SignBatchGenerationError(
      'SIGN_BATCH_GENERATION_UNAVAILABLE',
      'DeepSeek content generation is not configured',
    );
  }

  try {
    return await generateSignHoroscopeBatchWithRunner(digest, language, async (request) => {
      const completion = await client.chat.completions.create(buildOpenAIChatParams(model, {
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
    if (error instanceof SignBatchGenerationError) throw error;
    throw new SignBatchGenerationError(
      'SIGN_BATCH_GENERATION_FAILED',
      error instanceof Error ? error.message : 'Sign horoscope generation failed',
      error,
    );
  }
}
