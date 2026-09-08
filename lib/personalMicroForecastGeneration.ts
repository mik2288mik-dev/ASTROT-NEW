import { buildPersonalForecastDateContext } from './personalForecastDateContext';
import { getPersonalHoroscopeVoice, getDirectHoroscopeVoiceViolationCodes } from './personalForecastGeneration';
import { createHash } from 'crypto';
import type { ContentInterpretation } from '../types';
import { PERSONAL_FORECAST_VOICE_VERSION } from './appVoice';
import { withContentGenerationLock } from './contentGenerationLock';
import { db, getPool } from './db';
import { natalChartV2Repository } from './natalChartV2Repository';
import { buildCanonicalNatalInputHash, isCanonicalNatalChartDataComplete } from './natalChartCanonical';
import { getCachedPersonalForecast, type PersonalForecastCacheContext } from './personalForecastCache';
import { normalizeForecastTimezone, resolvePersonalForecastWindow, type PersonalForecastPackage } from './personalForecastContract';
import { buildLunaStructuredResponseParams, getOpenAIResponsesClient, OPENAI_LUNA_MODEL, readLunaResponseContent } from './openaiResponses';
import { checkRateLimit } from './rateLimit';
import {
  PERSONAL_MICRO_FORECAST_TOPICS, PERSONAL_MICRO_FORECAST_VERSION,
  isPersonalMicroForecast, isPersonalMicroForecastQuestion,
  type PersonalMicroForecast, type PersonalMicroForecastTopicId,
} from './personalMicroForecastContract';

type Input = PersonalForecastCacheContext & {
  birthTimeRangeStart?: string | null;
  birthTimeRangeEnd?: string | null;
};
type StoredMicroForecast = PersonalMicroForecast & {
  meta: { version: string; voiceVersion: string; model: string; generatedAt: string };
};
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export class PersonalMicroForecastError extends Error {
  constructor(public code: string, public status = 503) { super(code); }
}

const TOPIC_MEANINGS: Record<PersonalMicroForecastTopicId, string> = {
  relationships: 'Отношения: общение с людьми, встречи, близость. Не предполагай наличие партнёра.',
  things: 'Дела: обычные договорённости, работа, учёба, домашние дела. Не выдумывай профессию и планы.',
  yourself: 'Настроение: какие события могут порадовать, удивить или вызвать раздражение в выбранные даты. Не предлагай занятия, хобби, уход за собой или уборку.',
  career: 'Карьера и дела: возможности в работе, учёбе и договорённостях. Никаких инвестсоветов, сумм и обещаний дохода.',
  wellbeing: 'Настроение на неделе: что может порадовать, удивить или раздражать. Прогноз возможных событий, без советов по отдыху и занятиям, без утверждений о здоровье.',
  themes: 'Главное в месяце: одно самостоятельное короткое наблюдение о выбранном месяце, которое не пересказывает общий прогноз.',
};

function words(text: string): string[] {
  return text.toLocaleLowerCase('ru').replace(/ё/gu, 'е').match(/[\p{L}\p{N}]+/gu) || [];
}

function repeats(text: string, previous: string): boolean {
  const current = words(text);
  const older = words(previous);
  if (current.length >= 4 && current.join(' ') === older.join(' ')) return true;
  if (current.length < 6 || older.length < 6) return false;
  const oldText = ` ${older.join(' ')} `;
  for (let index = 0; index <= current.length - 6; index += 1) {
    if (oldText.includes(` ${current.slice(index, index + 6).join(' ')} `)) return true;
  }
  const a = new Set(current.filter((word) => word.length > 3));
  const b = new Set(older.filter((word) => word.length > 3));
  const overlap = [...a].filter((word) => b.has(word)).length;
  return a.size >= 5 && overlap / a.size > 0.7;
}

export function validateCopy(result: PersonalMicroForecast, priorCopy: string[], language: string): string[] {
  const errors: string[] = [];
  result.topics.forEach((topic, index) => {
    const teaserWords = words(topic.teaser);
    if (!isPersonalMicroForecastQuestion(topic.teaser)
      || words(topic.text).slice(0, teaserWords.length).join(' ') === teaserWords.join(' ')) errors.push(`${topic.id}:TEASER`);
    const count = words(topic.text).length;
    if (count < 15 || count > 30 || /[\n<>?]|https?:|\d\s*%/iu.test(topic.text)) errors.push(`${topic.id}:FORMAT`);
    if (language === 'ru') errors.push(...getDirectHoroscopeVoiceViolationCodes(`${topic.teaser}. ${topic.text}`).map(code => `${topic.id}:${code}`));
    if (language === 'ru' && /(?<!\p{L})(?:запиши|собери|выбери|разбери|сформулируй|начни|оставь|проверь|сохрани|отложи|сравни|границ\p{L}*|индивидуальност\p{L}*)(?!\p{L})|личн\p{L}*\s+ритм\p{L}*|подач\p{L}*\s+себя/iu.test(`${topic.teaser} ${topic.text}`)) errors.push(`${topic.id}:ADVICE_OR_ABSTRACTION`);
    if (/(?:гарантирован\p{L}*|диагноз\p{L}*|лечени\p{L}*|лекарств\p{L}*|терапи\p{L}*|точно\s+произойд\p{L}*|buy\s+(?:stocks|crypto)|diagnos\p{L}*|guaranteed)/iu.test(`${topic.teaser} ${topic.text}`)) errors.push(`${topic.id}:SAFETY`);
    const earlierTopics = result.topics.slice(0, index).flatMap((item) => [item.teaser, item.text]);
    if ([...priorCopy, ...earlierTopics].some((copy) => repeats(topic.text, copy) || repeats(topic.teaser, copy))) errors.push(`${topic.id}:REPEAT`);
  });
  return errors;
}

async function context(input: Input) {
  // This is a read of the owner's saved calculation. Never repair or calculate here.
  const chart = await natalChartV2Repository.getPrimary(input.userId);
  if (!chart || String(chart.user_id) !== input.userId || !isCanonicalNatalChartDataComplete(chart.chart_data)) {
    throw new PersonalMicroForecastError('PERSONAL_MICRO_CHART_REQUIRED', 409);
  }
  const natal = chart.chart_data;
  const expectedChartHash = buildCanonicalNatalInputHash({
    birthDate: input.profile.birthDate, birthPlace: input.profile.birthPlace,
    birthTime: input.profile.birthTime, birthTimeMode: input.profile.birthTimeMode,
    birthTimeUncertaintyMinutes: input.profile.birthTimeUncertaintyMinutes,
    birthTimeRangeStart: input.birthTimeRangeStart, birthTimeRangeEnd: input.birthTimeRangeEnd,
    latitude: natal.birth.latitude, longitude: natal.birth.longitude, timezone: natal.birth.timezone,
  });
  if (chart.input_hash !== expectedChartHash) throw new PersonalMicroForecastError('PERSONAL_MICRO_CHART_OUTDATED', 409);
  const window = resolvePersonalForecastWindow(input.period, input.periodKey, normalizeForecastTimezone(input.profile.birthTimezone));
  const inputHash = digest({
    user: input.userId, tier: input.accessTier, period: input.period, periodKey: input.periodKey,
    profile: input.profile, natalHash: digest(natal), window,
    version: PERSONAL_MICRO_FORECAST_VERSION, voice: PERSONAL_FORECAST_VOICE_VERSION, model: OPENAI_LUNA_MODEL,
  });
  return { natal, window, inputHash, cacheKey: `${PERSONAL_MICRO_FORECAST_VERSION}:${inputHash}` };
}

async function readCache(input: Input, resolved: Awaited<ReturnType<typeof context>>) {
  // 'brief' and the versioned cache key keep these texts out of the APK's daily/weekly/monthly namespace.
  const row = await db.content_interpretations.getByUser(input.userId, input.accessTier, 'forecast', 'brief', resolved.cacheKey) as ContentInterpretation<StoredMicroForecast> | null;
  const value = row?.content;
  if (!value || row?.inputHash !== resolved.inputHash || row.promptVersion !== PERSONAL_MICRO_FORECAST_VERSION
    || !isPersonalMicroForecast(value) || value.status !== 'ready'
    || value.period !== input.period || value.periodKey !== input.periodKey
    || value.meta?.version !== PERSONAL_MICRO_FORECAST_VERSION
    || value.meta.voiceVersion !== PERSONAL_FORECAST_VOICE_VERSION || value.meta.model !== OPENAI_LUNA_MODEL) return null;
  return { period: value.period, periodKey: value.periodKey, topics: value.topics, status: 'ready' as const };
}

async function recentCopy(userId: string): Promise<string[]> {
  const result = await getPool().query<{ content: unknown }>(
    `SELECT content FROM content_interpretations WHERE user_id=$1 AND chart_id IS NULL
     AND content_surface='forecast' AND content_variant='brief' AND prompt_version=$2
     ORDER BY updated_at DESC LIMIT 12`, [userId, PERSONAL_MICRO_FORECAST_VERSION],
  );
  return result.rows.flatMap((row) => isPersonalMicroForecast(row.content) ? row.content.topics.flatMap((topic) => [topic.teaser, topic.text]) : []);
}

async function writeTopics(input: Input, resolved: Awaited<ReturnType<typeof context>>, mainCopy: string[], calculatedPeriodEvidence: PersonalForecastPackage['evidence']): Promise<StoredMicroForecast> {
  return generatePersonalMicroForecastText(input, resolved, mainCopy, calculatedPeriodEvidence, await recentCopy(input.userId));
}

/** The production writer, also used for explicit local samples without database writes. */
export async function generatePersonalMicroForecastText(input: Input, resolved: Pick<Awaited<ReturnType<typeof context>>, 'natal' | 'window'>, mainCopy: string[], calculatedPeriodEvidence: PersonalForecastPackage['evidence'], history: string[] = []): Promise<StoredMicroForecast> {
  const selectedDateCalculation = buildPersonalForecastDateContext(resolved.natal, resolved.window);
  const provider = getOpenAIResponsesClient();
  if (!provider) throw new PersonalMicroForecastError('PERSONAL_MICRO_PROVIDER_UNAVAILABLE');
  const ids = PERSONAL_MICRO_FORECAST_TOPICS[input.period];
  const priorCopy = [...mainCopy, ...history];
  let errors: string[] = [];
  let previousDraft: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await provider.responses.create(buildLunaStructuredResponseParams({
      instructions: getPersonalHoroscopeVoice(input.profile.language === 'en' ? 'en' : 'ru') + '\n' + "Для каждой выбранной темы верни teaser — короткий вопрос о событиях выбранного дня, недели или месяца, и text — ответ на него из одного-двух предложений. Это прогноз, а не совет выбрать занятие. Вопрос и ответ должны относиться к одной теме. Ответ короткий: 15–30 слов; вопрос — 4–8 слов. Темы различаются по содержанию. Не повторяй общий гороскоп. Верни только topics с заданными id в исходном порядке.",
      input: JSON.stringify({
        language: input.profile.language === 'en' ? 'en' : 'ru',
        profile: { birthDate: input.profile.birthDate, birthTimeMode: input.profile.birthTimeMode, gender: input.profile.gender },
        natal_calculation: {
          birth: resolved.natal.birth, positions: resolved.natal.positions,
          aspects: resolved.natal.aspects, houses: resolved.natal.houses,
          angles: resolved.natal.angles, quality: resolved.natal.chartQuality,
        },
        selected_period: { period: input.period, key: input.periodKey, from: resolved.window.periodStart, to: resolved.window.periodEnd, timezone: resolved.window.timezone },
        selected_date_calculation: selectedDateCalculation,
        calculated_period_evidence: calculatedPeriodEvidence,
        topics: ids.map((id) => ({ id, meaning: TOPIC_MEANINGS[id] })),
        main_forecast_do_not_repeat: mainCopy, recent_topics_do_not_repeat: history,
        validation_errors: errors,
        previous_draft_to_repair: previousDraft,
      }),
      maxOutputTokens: 2400, reasoningEffort: 'medium', verbosity: 'low', store: false,
      schemaName: 'personal_micro_forecast', schema: {
        type: 'object', additionalProperties: false, required: ['topics'],
        properties: { topics: { type: 'array', minItems: ids.length, maxItems: ids.length, items: {
          type: 'object', additionalProperties: false, required: ['id', 'teaser', 'text'],
          properties: { id: { type: 'string', enum: [...ids] }, teaser: { type: 'string' }, text: { type: 'string' } },
        } } },
      },
    }), { signal: AbortSignal.timeout(40_000), maxRetries: 0 });
    const payload = JSON.parse(readLunaResponseContent(response)) as { topics?: unknown };
    previousDraft = payload;
    const candidate = { period: input.period, periodKey: input.periodKey, status: 'ready', topics: payload.topics };
    if (!isPersonalMicroForecast(candidate)) { errors = ['INVALID_TOPIC_STRUCTURE']; continue; }
    errors = validateCopy(candidate, priorCopy, input.profile.language || 'ru');
    if (errors.length) continue;
    return { ...candidate, meta: { version: PERSONAL_MICRO_FORECAST_VERSION, voiceVersion: PERSONAL_FORECAST_VOICE_VERSION, model: OPENAI_LUNA_MODEL, generatedAt: new Date().toISOString() } };
  }
  throw Object.assign(new PersonalMicroForecastError('PERSONAL_MICRO_COPY_REJECTED'), { diagnostics: errors });
}

export async function ensurePersonalMicroForecast(input: Input): Promise<PersonalMicroForecast> {
  const birthContext = await context(input);
  const pending: PersonalMicroForecast = { period: input.period, periodKey: input.periodKey, status: 'generating', topics: [], retryAfterMs: 2500 };
  // The existing reading may be generating in parallel. Do not generate it here or return a copied substitute.
  const main = await getCachedPersonalForecast(input);
  if (!main) return { ...pending, code: 'PERSONAL_MICRO_WAITING_FOR_FORECAST' };
  const mainCopy = [main.forecast.overview.title, ...[main.forecast.overview, ...main.forecast.sections].map((section) => section.text)]
    .filter((text): text is string => typeof text === 'string' && Boolean(text.trim()));
  // A regenerated main reading also invalidates its accompanying topic package.
  const inputHash = digest({ birthContext: birthContext.inputHash, mainCopy, calculatedPeriodEvidence: main.forecast.evidence });
  const resolved = { ...birthContext, inputHash, cacheKey: `${PERSONAL_MICRO_FORECAST_VERSION}:${inputHash}` };
  const existing = await readCache(input, resolved);
  if (existing) return existing;
  const result = await withContentGenerationLock({
    // Serialize this user's periods so the next period sees the just-written topic history.
    lockKey: `personal-micro:${input.userId}`, operation: 'personal-micro-forecast',
    waitMs: 1500, allowLocalLockFallback: false,
    readCached: async () => {
      const value = await readCache(input, resolved);
      return value ? { value } : null;
    },
    generate: async () => {
      const quota = checkRateLimit(input.userId, { name: 'personal-micro-generation', windowMs: 60 * 60 * 1000, maxRequests: 12 });
      if (!quota.allowed) throw new PersonalMicroForecastError('PERSONAL_MICRO_RATE_LIMITED', 429);
      const value = await writeTopics(input, resolved, mainCopy, main.forecast.evidence);
      await db.content_interpretations.upsertByUser(input.userId, {
        accessTier: input.accessTier, contentSurface: 'forecast', contentVariant: 'brief',
        cacheKey: resolved.cacheKey, inputHash: resolved.inputHash, content: value, modelTier: 'premium',
        promptVersion: PERSONAL_MICRO_FORECAST_VERSION, calculationVersion: resolved.natal.calculationVersion,
        validFrom: resolved.window.startsAt, validTo: resolved.window.validTo, isPersistent: false,
      });
      return { period: value.period, periodKey: value.periodKey, topics: value.topics, status: 'ready' as const };
    },
  });
  return result.status === 'ready' ? result.value : pending;
}
