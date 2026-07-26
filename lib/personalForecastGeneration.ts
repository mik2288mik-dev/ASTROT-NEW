import OpenAI from 'openai';
import type { NatalChartData, UserProfile } from '../types';
import { APP_VOICE_VERSION, getAppSystemVoice, hasAppVoiceViolation } from './appVoice';
import { buildOpenAIChatParams } from './openaiChat';
import {
  FIXED_FORECAST_TOPIC_KEYS,
  FORECAST_OVERVIEW_TITLES,
  FORECAST_TOPIC_TITLES,
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  personalForecastAstrologyLimit,
  personalForecastReadingLimit,
  type ForecastTopicKey,
  type DynamicForecastTopicKey,
  type ForecastTopicText,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
  type PersonalForecastWindow,
  type TopicEvidence,
} from './personalForecastContract';
import { calculatePersonalForecastEvidence } from './personalForecastEvidence';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type GeneratedTopicPayload = {
  card?: unknown;
  reading?: unknown;
  astrology?: {
    explanation?: unknown;
    evidence_ids?: unknown;
  };
};

function compactEvidence(evidence: TopicEvidence) {
  const compact = (items: TopicEvidence['primary']) => items.map((item) => ({
    id: item.id,
    kind: item.kind,
    transitPlanet: item.transitPlanet ?? null,
    natalPoint: item.natalPoint ?? null,
    aspect: item.aspect ?? null,
    house: item.house ?? null,
    orb: item.orb ?? null,
    status: item.status,
    exactAt: item.exactAt ?? null,
    startsAt: item.startsAt ?? null,
    endsAt: item.endsAt ?? null,
    strength: item.strength,
    polarity: item.polarity,
  }));
  return {
    primary: compact(evidence.primary),
    supporting: compact(evidence.supporting),
    conflicting: compact(evidence.conflicting),
    confidence: evidence.confidence,
  };
}

function periodOverviewInstruction(period: PersonalForecastPeriod, language: 'ru' | 'en'): string {
  if (language === 'en') {
    if (period === 'day') return 'Explain how the day is likely to unfold.';
    if (period === 'week') return 'Explain how the week develops and where its emphasis changes.';
    if (period === 'month') return 'Explain how the month develops and which calculated windows define it.';
    return 'Explain the main personal picture of the year and its calculated periods of emphasis.';
  }
  if (period === 'day') return 'Расскажи, как будет проходить день.';
  if (period === 'week') return 'Расскажи, как будет развиваться неделя и когда меняется акцент.';
  if (period === 'month') return 'Расскажи, как будет развиваться месяц и какие рассчитанные окна его определяют.';
  return 'Расскажи главную персональную картину года и рассчитанные периоды усиления.';
}

export function buildPersonalForecastTopicPrompt(input: {
  language: 'ru' | 'en';
  period: PersonalForecastPeriod;
  periodStart: string;
  periodEnd: string;
  timezone: string;
  topicKey: ForecastTopicKey;
  topicTitle: string;
  evidence: TopicEvidence;
  repairErrors?: string[];
}): string {
  const readingLimit = personalForecastReadingLimit(input.period);
  const astrologyLimit = personalForecastAstrologyLimit(input.period);
  const overviewInstruction = input.topicKey === 'overview'
    ? periodOverviewInstruction(input.period, input.language)
    : '';
  const repair = input.repairErrors?.length
    ? `\nPrevious JSON was rejected for these reasons:\n- ${input.repairErrors.join('\n- ')}\nReturn a corrected object.`
    : '';
  const task = input.language === 'en'
    ? `Write the personal forecast for the supplied topic and period.

Topic key: ${input.topicKey}
Static topic title: ${input.topicTitle}
Period: ${input.period}
Calculated interval: ${input.periodStart} — ${input.periodEnd}
Timezone: ${input.timezone}
${overviewInstruction}

The server has already calculated and assigned the evidence below. Do not calculate astrology and do not add facts.
${JSON.stringify(compactEvidence(input.evidence), null, 2)}

Return one JSON object:
{
  "card": "a direct short answer, maximum 280 characters",
  "reading": "the forecast based only on this topic's evidence, maximum ${readingLimit} characters",
  "astrology": {
    "explanation": "why these factors support the conclusion, maximum ${astrologyLimit} characters",
    "evidence_ids": ["one to four IDs from the supplied evidence"]
  }
}

Technical constraints:
- card is not a title, hook, CTA, or teaser;
- explain primary, supporting, and conflicting factors together when present;
- do not invent a life scene, event, person, job, purchase, conflict, or advice;
- use a date or part of the period only when it exists in the supplied evidence;
- when confidence is low, say so briefly instead of adding filler;
- evidence_ids must contain only supplied IDs, at most four;
- no markdown and no fields beyond the schema.${repair}`
    : `Напиши персональный прогноз для переданной темы и периода.

Ключ темы: ${input.topicKey}
Статическое название темы: ${input.topicTitle}
Период: ${input.period}
Рассчитанный интервал: ${input.periodStart} — ${input.periodEnd}
Часовой пояс: ${input.timezone}
${overviewInstruction}

Сервер уже рассчитал и распределил evidence ниже. Не вычисляй астрологию и не добавляй факты.
${JSON.stringify(compactEvidence(input.evidence), null, 2)}

Верни один JSON-объект:
{
  "card": "прямой короткий ответ, максимум 280 символов",
  "reading": "прогноз только по evidence этой темы, максимум ${readingLimit} символов",
  "astrology": {
    "explanation": "почему эти факторы дали такой вывод, максимум ${astrologyLimit} символов",
    "evidence_ids": ["от одного до четырёх ID из переданного evidence"]
  }
}

Технические ограничения:
- card — не заголовок, не интрига, не hook, не CTA и не тизер;
- объясни совместное действие primary, supporting и conflicting, когда они есть;
- не придумывай бытовую сцену, событие, человека, работу, покупку, конфликт или совет;
- называй дату или часть периода только при наличии в evidence;
- при низкой confidence скажи это коротко и не заполняй поле пустотой;
- evidence_ids содержит только переданные ID, максимум четыре;
- без markdown и без полей вне схемы.${repair}`;
  return task;
}

type DateReference = {
  raw: string;
  isoDate?: string;
  monthDay?: string;
};

const MONTH_BY_NAME: Record<string, number> = {
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12,
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function dateReference(
  raw: string,
  day: number,
  month: number,
  year?: number,
): DateReference | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    raw,
    monthDay,
    isoDate: year ? `${year}-${monthDay}` : undefined,
  };
}

function datesInText(value: string): DateReference[] {
  const references: DateReference[] = (value.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [])
    .map((raw) => ({ raw, isoDate: raw, monthDay: raw.slice(5) }));
  const russian = /(?:^|[^\p{L}\d])(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?/giu;
  for (const match of value.matchAll(russian)) {
    const raw = `${match[1]} ${match[2]}${match[3] ? ` ${match[3]}` : ''}`;
    const parsed = dateReference(
      raw,
      Number(match[1]),
      MONTH_BY_NAME[match[2].toLowerCase()],
      match[3] ? Number(match[3]) : undefined,
    );
    if (parsed) references.push(parsed);
  }
  const englishMonthFirst = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/giu;
  for (const match of value.matchAll(englishMonthFirst)) {
    const parsed = dateReference(
      match[0],
      Number(match[2]),
      MONTH_BY_NAME[match[1].toLowerCase()],
      match[3] ? Number(match[3]) : undefined,
    );
    if (parsed) references.push(parsed);
  }
  const englishDayFirst = /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?\b/giu;
  for (const match of value.matchAll(englishDayFirst)) {
    const parsed = dateReference(
      match[0],
      Number(match[1]),
      MONTH_BY_NAME[match[2].toLowerCase()],
      match[3] ? Number(match[3]) : undefined,
    );
    if (parsed) references.push(parsed);
  }
  return references;
}

function allowedDates(evidence: TopicEvidence): Set<string> {
  const values = [
    ...evidence.primary,
    ...evidence.supporting,
    ...evidence.conflicting,
  ].flatMap((item) => [item.exactAt, item.startsAt, item.endsAt]);
  return new Set(
    values
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.slice(0, 10)),
  );
}

export function validateGeneratedForecastTopic(input: {
  raw: GeneratedTopicPayload;
  period: PersonalForecastPeriod;
  evidence: TopicEvidence;
}): { value: ForecastTopicText | null; errors: string[] } {
  const errors: string[] = [];
  const card = typeof input.raw?.card === 'string' ? input.raw.card.trim() : '';
  const reading = typeof input.raw?.reading === 'string' ? input.raw.reading.trim() : '';
  const explanation = typeof input.raw?.astrology?.explanation === 'string'
    ? input.raw.astrology.explanation.trim()
    : '';
  const ids = Array.isArray(input.raw?.astrology?.evidence_ids)
    ? input.raw.astrology.evidence_ids.filter((item): item is string => typeof item === 'string')
    : [];
  const suppliedIds = new Set([
    ...input.evidence.primary,
    ...input.evidence.supporting,
    ...input.evidence.conflicting,
  ].map((item) => item.id));
  if (!card) errors.push('card is empty');
  if (card.length > 280) errors.push('card exceeds 280 characters');
  if (!reading) errors.push('reading is empty');
  if (reading.length > personalForecastReadingLimit(input.period)) errors.push('reading exceeds its period limit');
  if (!explanation) errors.push('astrology.explanation is empty');
  if (explanation.length > personalForecastAstrologyLimit(input.period)) {
    errors.push('astrology.explanation exceeds its period limit');
  }
  if (ids.length < 1 || ids.length > 4) errors.push('evidence_ids must contain one to four IDs');
  if (ids.some((id) => !suppliedIds.has(id))) errors.push('evidence_ids contains an ID outside the topic input');
  const dateWhitelist = allowedDates(input.evidence);
  const unsupportedDates = datesInText(`${card}\n${reading}\n${explanation}`)
    .filter((date) => date.isoDate
      ? !dateWhitelist.has(date.isoDate)
      : ![...dateWhitelist].some((allowed) => allowed.endsWith(date.monthDay || '')))
    .map((date) => date.raw);
  if (unsupportedDates.length) errors.push(`unsupported dates: ${unique(unsupportedDates).join(', ')}`);
  if (hasAppVoiceViolation(`${card}\n${reading}\n${explanation}`)) errors.push('app voice violation');
  return {
    value: errors.length
      ? null
      : {
          card,
          reading,
          astrology: {
            explanation,
            evidence_ids: unique(ids).slice(0, 4),
          },
        },
    errors,
  };
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

async function generateTopic(input: {
  language: 'ru' | 'en';
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  topicKey: ForecastTopicKey;
  topicTitle: string;
  evidence: TopicEvidence;
}): Promise<ForecastTopicText> {
  if (!openai) throw new Error('OPENAI_CONTENT_NOT_CONFIGURED');
  let repairErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildPersonalForecastTopicPrompt({
      language: input.language,
      period: input.period,
      periodStart: input.window.periodStart,
      periodEnd: input.window.periodEnd,
      timezone: input.window.timezone,
      topicKey: input.topicKey,
      topicTitle: input.topicTitle,
      evidence: input.evidence,
      repairErrors,
    });
    const completion = await openai.chat.completions.create(buildOpenAIChatParams(input.model, {
      messages: [
        { role: 'system', content: getAppSystemVoice(input.language) },
        { role: 'user', content: prompt },
      ],
      maxTokens: 1800,
      temperature: 0.45,
      jsonMode: true,
    }));
    const content = completion.choices[0]?.message?.content || '{}';
    let raw: GeneratedTopicPayload = {};
    try {
      raw = JSON.parse(content) as GeneratedTopicPayload;
    } catch {
      repairErrors = ['response is not valid JSON'];
      continue;
    }
    const validation = validateGeneratedForecastTopic({
      raw,
      period: input.period,
      evidence: input.evidence,
    });
    if (validation.value) return validation.value;
    repairErrors = validation.errors;
  }
  const error = new Error(`PERSONAL_FORECAST_TOPIC_INVALID:${input.topicKey}`) as Error & {
    validationErrors?: string[];
  };
  error.validationErrors = repairErrors;
  throw error;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const output = Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(1, concurrency), Math.max(1, items.length)) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        output[index] = await worker(items[index]);
      }
    },
  );
  await Promise.all(runners);
  return output;
}

export async function generatePersonalForecastPackage(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  previousDynamicKeys?: DynamicForecastTopicKey[];
}): Promise<PersonalForecastPackage> {
  const language = input.profile.language === 'en' ? 'en' : 'ru';
  const calculated = await calculatePersonalForecastEvidence({
    chartData: input.chartData,
    period: input.period,
    window: input.window,
    language,
    previousDynamicKeys: input.previousDynamicKeys,
  });
  const topicKeys: ForecastTopicKey[] = [
    ...FIXED_FORECAST_TOPIC_KEYS,
    ...calculated.dynamicTopicKeys,
  ];
  const generated = await mapWithConcurrency(topicKeys, 3, async (topicKey) => generateTopic({
    language,
    model: input.model,
    period: input.period,
    window: input.window,
    topicKey,
    topicTitle: topicKey === 'overview'
      ? FORECAST_OVERVIEW_TITLES[language][input.period]
      : FORECAST_TOPIC_TITLES[language][topicKey],
    evidence: calculated.topicEvidence[topicKey],
  }));
  const byTopic = new Map(topicKeys.map((key, index) => [key, generated[index]]));
  const usedEvidenceIds = new Set(generated.flatMap((topic) => topic.astrology.evidence_ids));
  return {
    period: input.period,
    periodKey: input.window.periodKey,
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    timezone: input.window.timezone,
    overview: byTopic.get('overview')!,
    love: byTopic.get('love')!,
    work: byTopic.get('work')!,
    money: byTopic.get('money')!,
    mood_energy: byTopic.get('mood_energy')!,
    communication: byTopic.get('communication')!,
    luck: byTopic.get('luck')!,
    dynamic: calculated.dynamicTopicKeys.map((key) => ({
      key,
      title: FORECAST_TOPIC_TITLES[language][key],
      text: byTopic.get(key)!,
    })),
    evidence: Object.fromEntries(
      Object.entries(calculated.evidenceViews).filter(([id]) => usedEvidenceIds.has(id)),
    ),
    visual: {
      heroAssetId: null,
      topicAssetIds: Object.fromEntries(topicKeys.map((key) => [key, null])),
    },
    meta: {
      model: input.model,
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: APP_VOICE_VERSION,
      calculationVersion: input.chartData.calculationVersion
        || PERSONAL_FORECAST_CALCULATION_VERSION,
      generatedAt: new Date().toISOString(),
      status: 'ready',
      diagnosticCode: null,
    },
  };
}
