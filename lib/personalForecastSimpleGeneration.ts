import type { UserProfile } from '../types';
import { PERSONAL_FORECAST_VOICE_VERSION } from './appVoice';
import { callStructuredWithBudgetRetry, type StrictJsonSchema } from './openaiResponses';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  formatPersonalForecastDateLabel,
  selectTodayFreeSections,
  stableHash,
  type FixedForecastSectionKey,
  type ForecastSection,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
  type PersonalForecastSemanticSignature,
  type PersonalForecastWindow,
} from './personalForecastContract';

export const PERSONAL_FORECAST_CROSS_USER_REPEAT_FRAGMENT_LIMIT = 0;

export type PersonalForecastRepeatFragment = {
  kind: 'title' | 'forecast' | 'closing';
  text: string;
  semanticFingerprint?: string | null;
};

export type PersonalForecastRecentReading = {
  period: PersonalForecastPeriod;
  periodKey: string;
  fragments: PersonalForecastRepeatFragment[];
  semanticSignature?: PersonalForecastSemanticSignature;
  briefSignature?: string;
};

type SimpleSectionPayload = {
  title: string;
  teaser: string;
  text: string;
};

type SimpleForecastPayload = {
  title: string;
  summary: string;
  relationships: SimpleSectionPayload;
  things: SimpleSectionPayload;
  self: SimpleSectionPayload;
  closing: string;
};

const SIMPLE_FORECAST_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    relationships: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        teaser: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['title', 'teaser', 'text'],
      additionalProperties: false,
    },
    things: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        teaser: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['title', 'teaser', 'text'],
      additionalProperties: false,
    },
    self: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        teaser: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['title', 'teaser', 'text'],
      additionalProperties: false,
    },
    closing: { type: 'string' },
  },
  required: ['title', 'summary', 'relationships', 'things', 'self', 'closing'],
  additionalProperties: false,
};

function text(value: unknown, fallback: string): string {
  const result = typeof value === 'string' ? value.trim() : '';
  return result || fallback;
}

function payloadValid(value: unknown): value is SimpleForecastPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  const section = (candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    const row = candidate as Record<string, unknown>;
    return ['title', 'teaser', 'text'].every((key) => typeof row[key] === 'string' && Boolean(String(row[key]).trim()));
  };
  return typeof item.title === 'string' && Boolean(item.title.trim())
    && typeof item.summary === 'string' && Boolean(item.summary.trim())
    && section(item.relationships) && section(item.things) && section(item.self)
    && typeof item.closing === 'string' && Boolean(item.closing.trim());
}

function sectionFingerprint(id: string, value: string) {
  return `simple:${Math.abs(stableHash(`${id}|${value}`)).toString(36)}`;
}

function section(input: {
  id: string;
  fixedKey?: FixedForecastSectionKey;
  title?: string;
  text: string;
  teaser: string;
  importance: number;
  role?: 'detail' | 'action';
  visualCue?: ForecastSection['visualCue'];
}): ForecastSection {
  const factId = `fact:${input.id}`;
  return {
    id: input.id,
    kind: input.fixedKey ? 'fixed' : 'dynamic',
    status: 'ready',
    diagnosticCode: null,
    ...(input.fixedKey ? { fixedKey: input.fixedKey, sourceTopicKey: input.fixedKey } : {}),
    ...(input.title ? { title: input.title } : {}),
    text: input.text,
    contentBlocks: [{
      id: `${input.id}:body`,
      role: input.role || 'detail',
      text: input.text,
      semanticFactId: factId,
      atomId: input.id,
    }],
    semanticFactIds: [factId],
    semanticFingerprint: sectionFingerprint(input.id, input.text),
    importance: input.importance,
    visualTag: input.fixedKey || 'overview',
    visualCue: input.visualCue || null,
    premiumTeaser: input.teaser,
    lockedPreview: buildForecastLockedPreview(input.text, input.teaser),
    explanationAnchors: [],
  };
}

function overview(title: string, summary: string): ForecastSection {
  const factId = 'fact:overview';
  return {
    id: 'overview',
    kind: 'overview',
    status: 'ready',
    diagnosticCode: null,
    sourceTopicKey: 'overview',
    title,
    text: summary,
    contentBlocks: [{ id: 'overview:body', role: 'detail', text: summary, semanticFactId: factId, atomId: 'overview' }],
    semanticFactIds: [factId],
    semanticFingerprint: sectionFingerprint('overview', summary),
    importance: 100,
    visualTag: 'overview',
    visualCue: 'opportunities',
    premiumTeaser: title,
    lockedPreview: buildForecastLockedPreview(summary, title),
    explanationAnchors: [],
  };
}

export function getSimplePersonalForecastSystemPrompt(language: 'ru' | 'en', period: PersonalForecastPeriod): string {
  if (language === 'en') {
    return `Write one personal NEBO horoscope for the current ${period}. Speak like a smart friend, not an astrologer, therapist or coach. Use ordinary modern language and concrete everyday phrasing. A dry joke or sharp line is welcome only when it naturally fits. Never mention planets, transits, houses, aspects, energy, psychology, trauma, healing, mindfulness, resources, transformation or personal-growth jargon. Do not invent a job, partner, purchase, trip, conflict or past event that was not supplied. Do not promise exact future events. Do not give medical, financial or legal instructions. Do not pad the answer to a word count and do not repeat the same thought across fields. Return only the requested strict JSON.`;
  }
  return `Напиши один личный гороскоп NEBO на текущий ${period === 'day' ? 'день' : period === 'week' ? 'неделю' : 'месяц'}.

Голос: как умный знакомый, который говорит коротко, понятно и по-человечески. Где реально подходит — сухая шутка, лёгкая дерзость или неожиданная бытовая фраза. Не шути по расписанию.

Не пиши языком астролога, психолога или коуча. В видимом тексте не должно быть планет, аспектов, транзитов, домов, «энергий», «ресурсов», «проработок», «осознанности», «трансформации», «внутренней опоры», «сценариев» и похожей воды. Не анализируй психику. Не учи жить.

Не придумывай человеку конкретную работу, партнёра, покупку, поездку, конфликт или прошлое событие, если этого нет во входных данных. Не обещай точные внешние события и не выдавай вероятность за факт. Никаких медицинских, финансовых или юридических указаний.

Пиши на «ты». Каждое поле должно добавлять новую понятную мысль. Не растягивай текст ради объёма. Заголовки короткие и живые. Верни только strict JSON.`;
}

function recentContext(readings: PersonalForecastRecentReading[] | undefined) {
  return (readings || []).slice(0, 3).map((reading) => ({
    period: reading.period,
    periodKey: reading.periodKey,
    fragments: reading.fragments.slice(0, 4).map((part) => part.text.slice(0, 320)),
  }));
}

export function buildSimplePersonalForecastInput(input: {
  profile: UserProfile;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  recentForecasts?: PersonalForecastRecentReading[];
}) {
  return JSON.stringify({
    task: 'Write the user-facing personal horoscope. Birth data are private context; do not quote them unless the user-facing text genuinely needs a date label.',
    period: input.period,
    periodKey: input.window.periodKey,
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    timezone: input.window.timezone,
    person: {
      name: input.profile.name,
      gender: input.profile.gender || 'unspecified',
      birthDate: input.profile.birthDate,
      birthTime: input.profile.birthTime || null,
      birthTimeMode: input.profile.birthTimeMode || (input.profile.birthTime ? 'exact' : 'unknown'),
      birthPlace: input.profile.birthPlace || null,
    },
    recent_copy_for_non_verbatim_reference_only: recentContext(input.recentForecasts),
    output_meaning: {
      title: 'one short headline for the whole period',
      summary: 'the main forecast shown in the large card; cohesive, concrete, easy to read',
      relationships: 'what may matter in contact with other people; do not invent an existing partner',
      things: 'work, errands, money or practical matters only as broad possibilities; do not invent a profession or transaction',
      self: 'the user’s own day/week/month in ordinary language without psychological analysis',
      closing: 'one short human final line, not a motivational slogan',
    },
  });
}

export function buildSimplePersonalForecastPackage(input: {
  payload: SimpleForecastPayload;
  profile: UserProfile;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  attempts: 1 | 2;
}): PersonalForecastPackage {
  const language: 'ru' | 'en' = input.profile.language === 'en' ? 'en' : 'ru';
  const relationship = section({
    id: 'fixed:love', fixedKey: 'love', title: text(input.payload.relationships.title, language === 'ru' ? 'В отношениях' : 'With people'),
    text: text(input.payload.relationships.text, input.payload.relationships.teaser), teaser: text(input.payload.relationships.teaser, input.payload.relationships.title), importance: 86, visualCue: 'love',
  });
  const things = section({
    id: 'fixed:work_money', fixedKey: 'work_money', title: text(input.payload.things.title, language === 'ru' ? 'В делах' : 'Things to handle'),
    text: text(input.payload.things.text, input.payload.things.teaser), teaser: text(input.payload.things.teaser, input.payload.things.title), importance: 80, visualCue: 'work_money',
  });
  const self = section({
    id: 'fixed:mood', fixedKey: 'mood', title: text(input.payload.self.title, language === 'ru' ? 'Для тебя' : 'For you'),
    text: text(input.payload.self.text, input.payload.self.teaser), teaser: text(input.payload.self.teaser, input.payload.self.title), importance: 74, visualCue: 'mood',
  });
  const closingText = text(input.payload.closing, language === 'ru' ? 'Без лишнего шума.' : 'Keep it simple.');
  const closing = section({ id: 'semantic:closing', text: closingText, teaser: closingText, importance: 60, role: 'action' });
  const sections = [relationship, things, self, closing];
  const summary = text(input.payload.summary, language === 'ru' ? 'Сегодня без лишней суеты.' : 'Keep the period simple.');
  const title = text(input.payload.title, language === 'ru' ? 'Без лишних дублей' : 'No extra loops');
  const summarySection = overview(title, summary);
  const freeSelection = input.period === 'day'
    ? selectTodayFreeSections({ sections, userId: String(input.profile.id || 'guest'), periodKey: input.window.periodKey })
    : { strongestSectionId: null, rotatedSectionId: null, sectionIds: [] };
  const semanticSignature: PersonalForecastSemanticSignature = {
    situation: summary,
    turn: relationship.text,
    outcome: closingText,
    title,
    forecast: [summary, relationship.text, things.text, self.text].join('\n\n'),
    closing: closingText,
  };
  return {
    period: input.period,
    periodKey: input.window.periodKey,
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    dateLabel: formatPersonalForecastDateLabel(input.window, language),
    timezone: input.window.timezone,
    overview: summarySection,
    sections,
    suggestedCrossPeriodLinks: [],
    evidence: {},
    visual: {
      sectionAssetIds: {
        overview: input.period === 'day' ? 'today' : input.period,
        'fixed:love': 'compatibility',
        'fixed:work_money': 'saved-cards',
        'fixed:mood': 'flower',
        'semantic:closing': null,
      },
    },
    meta: {
      model: input.model,
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: PERSONAL_FORECAST_VOICE_VERSION,
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      semanticVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      generationAttempts: input.attempts,
      validationStatus: 'valid',
      generatedAt: new Date().toISOString(),
      status: 'ready',
      diagnosticCode: null,
      astrologerBrief: {
        tone: 'mixed',
        observations: [summary, relationship.premiumTeaser, things.premiumTeaser, self.premiumTeaser],
        briefSignature: `simple:${Math.abs(stableHash([summary, relationship.text, things.text, self.text].join('|'))).toString(36)}`,
      },
      semanticSignature,
      freeSelection,
    },
  };
}

export async function generatePersonalForecastPackage(input: {
  profile: UserProfile;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  recentForecasts?: PersonalForecastRecentReading[];
  crossUserRepeatFragments?: PersonalForecastRepeatFragment[];
  crossUserSemanticSignatures?: PersonalForecastSemanticSignature[];
}): Promise<PersonalForecastPackage> {
  const language: 'ru' | 'en' = input.profile.language === 'en' ? 'en' : 'ru';
  let response;
  try {
    response = await callStructuredWithBudgetRetry({
      instructions: getSimplePersonalForecastSystemPrompt(language, input.period),
      input: buildSimplePersonalForecastInput(input),
      maxOutputTokens: 3200,
      reasoningEffort: 'medium',
      verbosity: 'low',
      store: false,
      schemaName: 'nebo_personal_forecast',
      schema: SIMPLE_FORECAST_SCHEMA,
    }, [3200, 6400], undefined, { incompleteErrorCode: 'PERSONAL_FORECAST_WRITER_INCOMPLETE' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`PERSONAL_FORECAST_WRITER_REQUEST_FAILED:${message}`);
  }
  let payload: unknown;
  try { payload = JSON.parse(response.result.content); }
  catch { throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:JSON'); }
  if (!payloadValid(payload)) throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:SHAPE');
  return buildSimplePersonalForecastPackage({ payload, profile: input.profile, model: input.model, period: input.period, window: input.window, attempts: response.attempts });
}

export type PersonalForecastGenerationDiagnosticCode =
  | 'PERSONAL_FORECAST_CACHE_WRITE_FAILED'
  | 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED'
  | 'PERSONAL_FORECAST_WRITER_OUTPUT_LIMIT'
  | 'PERSONAL_FORECAST_WRITER_INCOMPLETE'
  | 'PERSONAL_FORECAST_WRITER_REFUSED'
  | 'PERSONAL_FORECAST_WRITER_UNAVAILABLE'
  | 'PERSONAL_FORECAST_GENERATION_FAILED';

export function getPersonalForecastGenerationDiagnosticCode(error: unknown): PersonalForecastGenerationDiagnosticCode {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('PERSONAL_FORECAST_CACHE_WRITE_FAILED')) return 'PERSONAL_FORECAST_CACHE_WRITE_FAILED';
  if (message.startsWith('PERSONAL_FORECAST_GENERATION_INVALID')) return 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED';
  if (message.startsWith('PERSONAL_FORECAST_WRITER_REQUEST_FAILED')) {
    if (message.includes('OPENAI_RESPONSE_REFUSAL')) return 'PERSONAL_FORECAST_WRITER_REFUSED';
    if (message.includes('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens')) return 'PERSONAL_FORECAST_WRITER_OUTPUT_LIMIT';
    return message.includes('INCOMPLETE') ? 'PERSONAL_FORECAST_WRITER_INCOMPLETE' : 'PERSONAL_FORECAST_WRITER_UNAVAILABLE';
  }
  return 'PERSONAL_FORECAST_GENERATION_FAILED';
}
