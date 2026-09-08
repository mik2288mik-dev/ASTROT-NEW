import { buildPersonalForecastDateContext } from './personalForecastDateContext';
import { getPersonalHoroscopeVoice, getDirectHoroscopeVoiceViolationCodes } from './personalForecastGeneration';
import { createHash } from 'crypto';
import type { ContentInterpretation } from '../types';
import { PERSONAL_FORECAST_VOICE_VERSION } from './appVoice';
import { withContentGenerationLock } from './contentGenerationLock';
import { db, getPool } from './db';
import { buildCanonicalNatalInputHash, isCanonicalNatalChartDataComplete } from './natalChartCanonical';
import { natalChartV2Repository } from './natalChartV2Repository';
import { getCachedPersonalForecast } from './personalForecastCache';
import {
  resolvePersonalForecastWindow,
  type PersonalForecastRawProfile,
} from './personalForecastContract';
import { buildLunaStructuredResponseParams, getOpenAIResponsesClient, OPENAI_LUNA_MODEL, readLunaResponseContent } from './openaiResponses';
import { checkRateLimit } from './rateLimit';
import { isPersonalFutureForecast, PERSONAL_FUTURE_FORECAST_VERSION, type PersonalFutureForecast, type PersonalFutureForecastTopic, type PersonalFutureForecastPeriod } from './personalFutureForecastContract';
import { getPersonalFutureForecastDateAccess } from './personalFutureForecastAccess';

type Input = {
  userId: string;
  profile: PersonalForecastRawProfile;
  accessTier: 'free' | 'premium';
  date: string;
  period: PersonalFutureForecastPeriod;
  endDate?: string;
  topic: PersonalFutureForecastTopic;
  birthTimeRangeStart?: string | null;
  birthTimeRangeEnd?: string | null;
};
type StoredFutureForecast = PersonalFutureForecast & {
  meta: {
    version: string; voiceVersion: string; model: string; generatedAt: string; profileHash: string;
  };
};
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class PersonalFutureForecastError extends Error {
  constructor(public code: string, public status = 503, public freeUsedTopic?: PersonalFutureForecastTopic) { super(code); }
}

const TOPIC_MEANINGS: Record<PersonalFutureForecastTopic, string> = {
  general: 'Общее: одно главное наблюдение о выбранном дне, отрезке недели или месяце. Не перечисляй все жизненные темы.',
  work: 'Работа: дела, учёба, профессиональные договорённости. Не выдумывай должность, место работы и текущие задачи.',
  love: 'Любовь: близость, симпатия, романтическое общение. Не предполагай наличие партнёра и не утверждай, что знаешь чувства другого человека.',
  money: 'Деньги: обычные покупки, траты, денежные договорённости. Никаких инвестсоветов, конкретных сумм, гарантированной прибыли или обещаний подарков.',
  family: 'Семья: общение с родными и повседневные домашние вопросы. Не выдумывай состав семьи, детей и прошлые конфликты.',
  communication: 'Общение: разговоры, переписка, знакомство, обсуждение разных мнений. Не выдумывай запланированные встречи и решения других людей.',
  luck: 'Удача: возможность приятного совпадения или неожиданно простого решения обычного дела. Без гарантий, процентов, счастливых чисел, азартных игр и обещаний выигрыша.',
};

async function context(input: Input) {
  const dateAccess = getPersonalFutureForecastDateAccess({ accessTier: input.accessTier, period: input.period, date: input.date, endDate: input.endDate, timezone: input.profile.birthTimezone });
  if (dateAccess.access === 'outside_horizon') throw new PersonalFutureForecastError('PERSONAL_FUTURE_DATE_INVALID', 400);
  if (dateAccess.access === 'premium_required') throw new PersonalFutureForecastError('PERSONAL_FUTURE_PREMIUM_REQUIRED', 403);
  const { timezone } = dateAccess;
  // Read only the authenticated owner's saved natal calculation, never calculate or repair it.
  const chart = await natalChartV2Repository.getPrimary(input.userId);
  if (!chart || String(chart.user_id) !== input.userId || !isCanonicalNatalChartDataComplete(chart.chart_data)) {
    throw new PersonalFutureForecastError('PERSONAL_FUTURE_CHART_REQUIRED', 409);
  }
  const natal = chart.chart_data;
  const expectedChartHash = buildCanonicalNatalInputHash({
    birthDate: input.profile.birthDate, birthPlace: input.profile.birthPlace,
    birthTime: input.profile.birthTime, birthTimeMode: input.profile.birthTimeMode,
    birthTimeUncertaintyMinutes: input.profile.birthTimeUncertaintyMinutes,
    birthTimeRangeStart: input.birthTimeRangeStart, birthTimeRangeEnd: input.birthTimeRangeEnd,
    latitude: natal.birth.latitude, longitude: natal.birth.longitude, timezone: natal.birth.timezone,
  });
  if (chart.input_hash !== expectedChartHash) throw new PersonalFutureForecastError('PERSONAL_FUTURE_CHART_OUTDATED', 409);
  // Week stops can begin midweek and end before Sunday at the month boundary.
  // Build the exact inclusive interval from day boundaries; never expand to an ISO week.
  const window = input.period === 'week'
    ? (() => {
      if (!input.endDate) throw new PersonalFutureForecastError('PERSONAL_FUTURE_DATE_INVALID', 400);
      const start = resolvePersonalForecastWindow('day', input.date, timezone);
      const end = resolvePersonalForecastWindow('day', input.endDate, timezone);
      return { ...start, period: 'week' as const, periodKey: `${input.date}:${input.endDate}`,
        periodEnd: input.endDate, endsAt: end.endsAt, validTo: end.validTo };
    })()
    : resolvePersonalForecastWindow(input.period, input.period === 'month' ? input.date.slice(0, 7) : input.date, timezone);
  const profileHash = digest({ profile: input.profile, chart: digest(natal), timezone });
  const inputHash = digest({
    user: input.userId, date: input.date, endDate: input.endDate, period: input.period, topic: input.topic, profileHash,
    timezone, accessTier: input.accessTier, version: PERSONAL_FUTURE_FORECAST_VERSION,
    voice: PERSONAL_FORECAST_VOICE_VERSION, model: OPENAI_LUNA_MODEL,
  });
  return { natal, window, inputHash, profileHash, cacheKey: `${PERSONAL_FUTURE_FORECAST_VERSION}:${inputHash}` };
}

async function readCached(input: Input, resolved: Awaited<ReturnType<typeof context>>): Promise<PersonalFutureForecast | null> {
  const row = await db.content_interpretations.getByUser(input.userId, input.accessTier, 'forecast', 'brief', resolved.cacheKey) as ContentInterpretation<StoredFutureForecast> | null;
  const value = row?.content;
  if (!value || !isPersonalFutureForecast(value) || value.status !== 'ready' || value.date !== input.date || value.endDate !== input.endDate || value.period !== input.period || value.topic !== input.topic
    || row?.inputHash !== resolved.inputHash || row.promptVersion !== PERSONAL_FUTURE_FORECAST_VERSION
    || value.meta?.version !== PERSONAL_FUTURE_FORECAST_VERSION
    || value.meta.voiceVersion !== PERSONAL_FORECAST_VOICE_VERSION || value.meta.model !== OPENAI_LUNA_MODEL) return null;
  return { date: value.date, period: value.period, topic: value.topic, status: 'ready', text: value.text,
    ...(value.endDate !== undefined ? { endDate: value.endDate } : {}),
  };
}

async function recentAnswers(userId: string): Promise<Array<{ date: string; endDate?: string; period: PersonalFutureForecastPeriod; topic: PersonalFutureForecastTopic; text: string }>> {
  const rows = await getPool().query<{ content: unknown }>(
    `SELECT content FROM content_interpretations WHERE user_id=$1 AND chart_id IS NULL
     AND content_surface='forecast' AND content_variant='brief' AND content->'meta'->>'version' LIKE 'personal-future-v%'
     ORDER BY updated_at DESC LIMIT 12`, [userId],
  );
  return rows.rows.flatMap(({ content }) => isPersonalFutureForecast(content) && content.status === 'ready'
    ? [{ date: content.date, period: content.period, topic: content.topic, text: content.text,
      ...(content.endDate !== undefined ? { endDate: content.endDate } : {}),
    }] : []);
}

const words = (text: string) => text.toLocaleLowerCase('ru').replace(/ё/gu, 'е').match(/[\p{L}\p{N}]+/gu) || [];

function repeats(text: string, previous: string): boolean {
  const tokens = words(text);
  const oldText = ` ${words(previous).join(' ')} `;
  for (let index = 0; index <= tokens.length - 6; index += 1) {
    if (oldText.includes(` ${tokens.slice(index, index + 6).join(' ')} `)) return true;
  }
  const current = new Set(tokens.filter((word) => word.length > 3));
  const older = new Set(words(previous).filter((word) => word.length > 3));
  return current.size >= 5 && [...current].filter((word) => older.has(word)).length / current.size > 0.7;
}

export function copyErrors(text: string, history: Array<{ text: string }>, language: string): string[] {
  const errors: string[] = [];
  const count = words(text).length;
  const sentences = text.split(/[.!?]+/u).filter((part) => part.trim()).length;
  if (count < 20 || count > 45 || sentences < 1 || sentences > 2 || /[\n<>?]|https?:|\d\s*%/iu.test(text)) errors.push('FORMAT');
  if (language === 'ru') errors.push(...getDirectHoroscopeVoiceViolationCodes(text));
  if (language === 'ru' && /(?<!\p{L})(?:запиши|собери|выбери|разбери|сформулируй|начни|оставь|проверь|сохрани|отложи|сравни|границ\p{L}*|индивидуальност\p{L}*)(?!\p{L})|личн\p{L}*\s+ритм\p{L}*|практическ\p{L}*\s+форм\p{L}*|романтика\s+любит|дорог\p{L}*\s+аксессуар/iu.test(text)) errors.push('ADVICE_OR_ABSTRACTION');
  if (/(?:гарантирован\p{L}*|диагноз\p{L}*|лечени\p{L}*|лекарств\p{L}*|терапи\p{L}*|точно\s+произойд\p{L}*|buy\s+(?:stocks|crypto)|diagnos\p{L}*|guaranteed)/iu.test(text)) errors.push('SAFETY');
  if (history.some((item) => repeats(text, item.text))) errors.push('REPEAT');
  return errors;
}

async function generateAnswer(input: Input, resolved: Awaited<ReturnType<typeof context>>): Promise<StoredFutureForecast> {
  const [history, cachedPeriod] = await Promise.all([
    recentAnswers(input.userId),
    // Optional read: absence of a general forecast never blocks or triggers its generation.
    // The existing weekly package covers a full ISO week, not these possibly clipped intervals.
    input.period === 'week' ? Promise.resolve(null)
      : getCachedPersonalForecast({ userId: input.userId, profile: input.profile, accessTier: input.accessTier, period: input.period, periodKey: input.period === 'month' ? input.date.slice(0, 7) : input.date }).catch(() => null),
  ]);
  return generatePersonalFutureForecastText(input, resolved, history, cachedPeriod?.forecast.evidence || {});
}

/** The production writer, also used for explicit local samples without database writes. */
export async function generatePersonalFutureForecastText(input: Input, resolved: Pick<Awaited<ReturnType<typeof context>>, 'natal' | 'window' | 'profileHash'>, history: Array<{ text: string }> = [], calculatedPeriodEvidence: Record<string, unknown> = {}): Promise<StoredFutureForecast> {
  const selectedDateCalculation = buildPersonalForecastDateContext(resolved.natal, resolved.window);
  const provider = getOpenAIResponsesClient();
  if (!provider) throw new PersonalFutureForecastError('PERSONAL_FUTURE_PROVIDER_UNAVAILABLE');
  let validationErrors: string[] = [];
  let previousDraft: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await provider.responses.create(buildLunaStructuredResponseParams({
      instructions: getPersonalHoroscopeVoice(input.profile.language === 'en' ? 'en' : 'ru') + '\n' + "Ответь только на выбранную тему и только о выбранных датах. Верни text: один короткий прогноз из одного-двух предложений, 20–45 слов. Не перечисляй остальные темы. Не повторяй бытовые советы или пожелания. Возвращай только text, без заголовка.",
      input: JSON.stringify({
        language: input.profile.language === 'en' ? 'en' : 'ru',
        selected_period: { period: input.period, date: input.date, from: resolved.window.periodStart, to: resolved.window.periodEnd, timezone: resolved.window.timezone },
        selected_topic: { id: input.topic, meaning: TOPIC_MEANINGS[input.topic] },
        known_profile: { birthDate: input.profile.birthDate, birthTimeMode: input.profile.birthTimeMode, gender: input.profile.gender },
        natal_calculation: {
          birth: resolved.natal.birth, positions: resolved.natal.positions, aspects: resolved.natal.aspects,
          houses: resolved.natal.houses, angles: resolved.natal.angles, quality: resolved.natal.chartQuality,
        },
        selected_date_calculation: selectedDateCalculation,
        calculated_period_evidence: calculatedPeriodEvidence,
        recent_own_answers: history, validation_errors: validationErrors,
        previous_draft_to_repair: previousDraft,
      }),
      maxOutputTokens: 2000, reasoningEffort: 'medium', verbosity: 'low', store: false,
      schemaName: 'personal_future_forecast', schema: {
        type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' } },
      },
    }), { signal: AbortSignal.timeout(40_000), maxRetries: 0 });
    const raw = JSON.parse(readLunaResponseContent(response)) as { text?: unknown };
    previousDraft = raw;
    const candidate = { date: input.date, period: input.period, topic: input.topic, status: 'ready', text: typeof raw.text === 'string' ? raw.text.trim() : '',
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    };
    if (!isPersonalFutureForecast(candidate)) { validationErrors = ['FORMAT']; continue; }
    validationErrors = copyErrors(candidate.text, history, input.profile.language || 'ru');
    if (validationErrors.length) continue;
    return { ...candidate, meta: { version: PERSONAL_FUTURE_FORECAST_VERSION, voiceVersion: PERSONAL_FORECAST_VOICE_VERSION, model: OPENAI_LUNA_MODEL, generatedAt: new Date().toISOString(), profileHash: resolved.profileHash } };
  }
  throw Object.assign(new PersonalFutureForecastError('PERSONAL_FUTURE_COPY_REJECTED'), { diagnostics: validationErrors });
}

export async function ensurePersonalFutureForecast(input: Input): Promise<PersonalFutureForecast> {
  if (input.accessTier !== 'premium') throw new PersonalFutureForecastError('PERSONAL_FUTURE_PREMIUM_REQUIRED', 403);
  const resolved = await context(input);
  const existing = await readCached(input, resolved);
  if (existing) return existing;
  const result = await withContentGenerationLock({
    lockKey: `personal-future:${input.userId}`, operation: 'personal-future-forecast',
    waitMs: 1500, allowLocalLockFallback: false,
    readCached: async () => {

      const value = await readCached(input, resolved);
      return value ? { value } : null;
    },
    generate: async () => {

      const quota = checkRateLimit(input.userId, { name: 'personal-future-generation', windowMs: 60 * 60 * 1000, maxRequests: 35 });
      if (!quota.allowed) throw new PersonalFutureForecastError('PERSONAL_FUTURE_RATE_LIMITED', 429);
      const value = await generateAnswer(input, resolved);
      await db.content_interpretations.upsertByUser(input.userId, {
        accessTier: input.accessTier, contentSurface: 'forecast', contentVariant: 'brief',
        cacheKey: resolved.cacheKey, inputHash: resolved.inputHash, content: value, modelTier: 'premium',
        promptVersion: PERSONAL_FUTURE_FORECAST_VERSION, calculationVersion: resolved.natal.calculationVersion,
        validFrom: resolved.window.startsAt, validTo: resolved.window.validTo, isPersistent: false,
      });
      return { date: value.date, period: value.period, topic: value.topic, status: 'ready' as const, text: value.text,
        ...(value.endDate !== undefined ? { endDate: value.endDate } : {}),
      };
    },
  });
  return result.status === 'ready' ? result.value
    : { date: input.date, period: input.period, topic: input.topic, status: 'generating', text: '', code: 'PERSONAL_FUTURE_GENERATING',
      ...(input.endDate !== undefined ? { endDate: input.endDate } : {}),
    };
}
