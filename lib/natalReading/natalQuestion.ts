import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { APP_VOICE_VERSION, getAppSystemVoice, withAppVoiceVersion } from '../appVoice';
import {
  createLunaStructuredResponse,
  OPENAI_LUNA_MODEL,
  type StrictJsonSchema,
} from '../openaiResponses';
import {
  moderatePersonalForecastCustomQuestion,
  normalizePersonalForecastQuestionInput,
  type PersonalForecastQuestionModerationReason,
} from '../personalForecastQuestionModeration';
import {
  buildNatalModelContext,
  buildNatalPromptContext,
  getNatalNarrativeEvidenceIds,
  hasNatalPersonalityCopyViolation,
  isNatalReliabilityTextAllowed,
  NATAL_PERMANENT_CONTRACT_VERSION,
  type BuiltNatalModelContext,
  type NatalPermanentPremiumReport,
  type NatalReadingLanguage,
} from './permanentReport';
import type {
  NatalQuestionStoredMessage,
  NatalQuestionUsage,
} from './natalQuestionStore';

const MAX_ANSWER_ATTEMPTS = 2;

export const NATAL_QUESTION_PROMPT_VERSION = withAppVoiceVersion(
  'natal-question.v3.responses-strict-schema-repair',
);
export const NATAL_QUESTION_CONTRACT_VERSION = 'natal-question-v3';

const NATAL_QUESTION_RESPONSE_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    evidence_ids: { type: 'array', items: { type: 'string' } },
  },
  required: ['answer', 'evidence_ids'],
  additionalProperties: false,
};

export type NatalQuestionModeration = {
  status: 'approved' | 'rejected';
  reason: PersonalForecastQuestionModerationReason | 'relevant_natal_question';
  normalizedQuestion: string;
};

export type NatalQuestionAnswer = {
  text: string;
  evidenceIds: string[];
  model?: string;
  generationAttempts?: 1 | 2;
};

export type NatalQuestionValidationCode =
  | 'ANSWER_TOO_SHORT'
  | 'ANSWER_TOO_LONG'
  | 'SENTENCE_COUNT_INVALID'
  | 'EVIDENCE_REQUIRED'
  | 'EVIDENCE_UNKNOWN'
  | 'COPY_VIOLATION'
  | 'DIAGNOSTIC_CLAIM'
  | 'PROFESSIONAL_IMPERATIVE'
  | 'GUARANTEED_OUTCOME'
  | 'KARMIC_CLAIM'
  | 'STRONG_GUARANTEE'
  | 'HIGH_STAKES_PRESCRIPTION'
  | 'UNSUPPORTED_FUTURE_TIMING'
  | 'UNSUPPORTED_FUTURE_EVENT'
  | 'RELIABILITY_VIOLATION';

export class NatalQuestionValidationError extends Error {
  readonly code = 'NATAL_QUESTION_VALIDATION_FAILED';

  constructor(
    readonly validationCodes: readonly NatalQuestionValidationCode[],
    readonly attempts: number,
  ) {
    super('NATAL_QUESTION_VALIDATION_FAILED');
    this.name = 'NatalQuestionValidationError';
  }
}

export type NatalQuestionSnapshot = {
  chartId: number;
  messages: NatalQuestionStoredMessage[];
  usage: NatalQuestionUsage;
  promptVersion: string;
  voiceVersion: string;
};

export type NatalQuestionPromptContext = {
  chartId: number;
  chart: ReturnType<typeof buildNatalPromptContext>;
  permanentReport: NatalPermanentPremiumReport;
  recentMessages: Array<{
    role: 'user' | 'assistant';
    text: string;
    evidenceIds: string[];
  }>;
  question: string;
};

type RawNatalQuestionAnswer = {
  answer?: unknown;
  evidence_ids?: unknown;
};

type NatalQuestionAnswerRequester = (input: {
  language: NatalReadingLanguage;
  prompt: string;
}) => Promise<RawNatalQuestionAnswer>;

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function evidenceIdsFromPayload(payload: Record<string, unknown> | null): string[] {
  const value = payload?.evidenceIds || payload?.evidence_ids;
  return Array.isArray(value)
    ? [...new Set(value.map(text).filter(Boolean))]
    : [];
}

export function moderateNatalQuestion(input: {
  question: unknown;
  language: NatalReadingLanguage;
  existingQuestions?: readonly string[];
}): NatalQuestionModeration {
  const question = normalizePersonalForecastQuestionInput(input.question);
  const shared = moderatePersonalForecastCustomQuestion({
    question,
    language: input.language,
    period: 'month',
    existingCustomQuestions: input.existingQuestions,
  });
  if (shared.status === 'rejected') {
    return {
      status: 'rejected',
      reason: shared.reason,
      normalizedQuestion: shared.normalizedQuestion,
    };
  }
  // The shared moderator deliberately leaves non-forecast wording pending.
  // On this surface that is the expected form: permanent natal questions are
  // about character and recurring behaviour, not about a forecast window.
  return {
    status: 'approved',
    reason: 'relevant_natal_question',
    normalizedQuestion: shared.normalizedQuestion,
  };
}

export function buildNatalQuestionPromptContext(input: {
  chartId: number;
  profile: UserProfile;
  chartData: NatalChartData | NatalChartDataV2;
  permanentReport: NatalPermanentPremiumReport;
  history: readonly NatalQuestionStoredMessage[];
  question: string;
}): { built: BuiltNatalModelContext; context: NatalQuestionPromptContext } {
  const built = buildNatalModelContext(input.profile, input.chartData);
  const promptChart = buildNatalPromptContext(built);
  const narrativeEvidenceIds = getNatalNarrativeEvidenceIds(built);
  const hasNarrativeEvidence = (value: Record<string, unknown>) => (
    narrativeEvidenceIds.has(text(value.evidenceId))
  );
  const { angles: allAngles, houses: allHouses, ...chartWithoutTimeDependentFacts } = promptChart.chart;
  const positions = Object.fromEntries(
    Object.entries(promptChart.chart.positions).filter(([, value]) => hasNarrativeEvidence(value)),
  );
  const aspects = promptChart.chart.aspects.filter(hasNarrativeEvidence);
  const angles = allAngles
    ? Object.fromEntries(Object.entries(allAngles).filter(([, value]) => hasNarrativeEvidence(value)))
    : {};
  const houses = allHouses?.filter(hasNarrativeEvidence) || [];
  const questionChart: ReturnType<typeof buildNatalPromptContext> = {
    ...promptChart,
    chart: {
      ...chartWithoutTimeDependentFacts,
      positions,
      aspects,
      ...(Object.keys(angles).length > 0 ? { angles } : {}),
      ...(houses.length > 0 ? { houses } : {}),
    },
    evidence: promptChart.evidence.filter((fact) => narrativeEvidenceIds.has(fact.id)),
  };
  const chartMessages = input.history.filter((message) => message.chartId === input.chartId);
  const answersByQuestionId = new Map<number, NatalQuestionStoredMessage>();
  for (const message of chartMessages) {
    if (message.role !== 'assistant') continue;
    const questionMessageId = Number(message.payload?.questionMessageId);
    if (!Number.isInteger(questionMessageId) || questionMessageId <= 0) continue;
    const current = answersByQuestionId.get(questionMessageId);
    if (!current || current.createdAt < message.createdAt) {
      answersByQuestionId.set(questionMessageId, message);
    }
  }
  const recentMessages = chartMessages
    .filter((message) => message.role === 'user' && answersByQuestionId.has(message.id))
    .map((question) => [question, answersByQuestionId.get(question.id)!] as const)
    .sort(([left], [right]) => (
      left.createdAt.localeCompare(right.createdAt) || left.id - right.id
    ))
    .slice(-8)
    .flatMap(([question, answer]) => [question, answer])
    .map((message) => ({
      role: message.role,
      text: message.text,
      evidenceIds: evidenceIdsFromPayload(message.payload),
    }));
  return {
    built,
    context: {
      chartId: input.chartId,
      chart: questionChart,
      permanentReport: input.permanentReport,
      recentMessages,
      question: normalizePersonalForecastQuestionInput(input.question),
    },
  };
}

export function buildNatalQuestionPrompt(
  language: NatalReadingLanguage,
  context: NatalQuestionPromptContext,
  repairErrors: readonly NatalQuestionValidationCode[] = [],
): string {
  const languageRule = language === 'ru'
    ? 'Answer in Russian and address the reader as «ты».'
    : 'Answer in English and address the reader as “you”.';
  return `${languageRule}

Answer the user's question from the permanent calculated birth chart and the permanent report below.

Rules:
- Return JSON only: {"answer":"3-5 complete sentences","evidence_ids":["existing evidence id"]}.
- Give a direct answer first, then connect it to concrete chart factors.
- Translate those factors into ordinary human language. Do not name planets, signs, houses, aspects, angles, retrograde motion, orbs, or degrees in the answer; keep technical facts only in evidence_ids for the closed “Why?” layer.
- Use previous messages only for conversational continuity. They are not calculation evidence.
- Every astrological claim must be supported by one or more evidence_ids that exist in chart.evidence.
- Never recalculate or invent placements, houses, aspects, biography, trauma, diagnoses, relationship history, guaranteed events, financial outcomes, karmic facts, or professional prescriptions.
- This context is a permanent birth-chart portrait. If the user asks when something will happen, whether today/tomorrow is favorable, or requests a dated forecast, say that the natal chart alone cannot supply a date. Do not fabricate or endorse a calendar answer.
- For a Russian timing question, a safe natural boundary is: «По натальной карте нельзя определить, лучший ли сегодня день, или назвать подходящую дату». For English: “The natal chart cannot determine whether today is the best day or name a suitable date.” Then answer only what the permanent chart supports about the reader's recurring way of making this kind of choice.
- Do not change or rewrite the permanent report.

QUESTION CONTEXT:
${JSON.stringify(context, null, 2)}${repairErrors.length ? `

REPAIR REQUIRED:
- The previous candidate was rejected by server validation: ${JSON.stringify(repairErrors)}.
- Write a completely new candidate. Correct every listed issue while keeping the same chart evidence and question.
- Return only the required JSON object.` : ''}`;
}

function sentenceCount(value: string): number {
  return value
    .split(/(?<=[.!?…])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

const DIAGNOSTIC_ANSWER_EN = /\b(?:diagnos(?:e|ed|es|ing|is|tic)|disorders?|diseases?|illness(?:es)?)\b/iu;
const DIAGNOSTIC_ANSWER_RU = /(?:диагноз\w*|диагностир\w*|расстройств\w*|болезн\w*)/iu;
const PROFESSIONAL_IMPERATIVE_EN = /(?:\b(?:stop|start|change|skip|increase|decrease)\s+(?:taking\s+)?(?:medication|medicine|pills?)\b|\b(?:invest|borrow)\b)/iu;
const PROFESSIONAL_IMPERATIVE_RU = /(?:(?:прекрати|начни|измени|отмени|увеличь|снизь)\w*[^.!?\n]{0,40}(?:лекарств\w*|препарат\w*|таблет\w*)|(?:инвестируй|вложи\s+деньги|возьми\s+кредит|одолжи\s+деньги))/iu;
const GUARANTEED_OUTCOME_EN = /(?:\b(?:guaranteed?|definitely|certainly)\s+(?:will\s+)?(?:happen|occur|return|profit|win|earn|get rich)\b|\b(?:risk[- ]free|guaranteed returns?)\b)/iu;
const GUARANTEED_OUTCOME_RU = /(?:(?:гарантирован\w*|обязательно)\s+(?:случ\w*|произойд\w*|доход\w*|прибыл\w*|выигра\w*|разбогате\w*)|точно\s+произойд[её]т|безрисков\w*)/iu;
const INVENTED_KARMIC_FACT = /(?:\b(?:in (?:a|your) past life|your karma proves|destined by karma)\b|(?:в прошлой жизни|твоя карма доказывает|кармой предопределено))/iu;
const FUTURE_TIMING_EN = /(?:\b(?:today|tomorrow|tonight|next (?:week|month|year)|this (?:week|month|year)|(?:on|by|before) (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b|\b(?:in|within)\s+\d+\s+(?:days?|weeks?|months?|years?)\b|\b20\d{2}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b|\b(?:will|shall)\s+(?:happen|occur|arrive|begin)\b)/iu;
const FUTURE_TIMING_RU = /(?:(?<!\p{L})(?:сегодня|завтра)(?!\p{L})|на\s+следующ(?:ей|ую)\s+(?:недел[\p{L}-]*|месяц[\p{L}-]*)|в\s+этом\s+(?:месяц[\p{L}-]*|году)|(?:в|до)\s+(?:понедельник[\p{L}-]*|вторник[\p{L}-]*|сред[\p{L}-]*|четверг[\p{L}-]*|пятниц[\p{L}-]*|суббот[\p{L}-]*|воскресень[\p{L}-]*)|через\s+\d+\s+(?:дн[\p{L}-]*|недел[\p{L}-]*|месяц[\p{L}-]*|лет|год[\p{L}-]*)|в\s+течение\s+\d+\s+(?:дн[\p{L}-]*|недел[\p{L}-]*|месяц[\p{L}-]*)|\b20\d{2}\b|(?<!\p{L})(?:январ[\p{L}-]*|феврал[\p{L}-]*|март[\p{L}-]*|апрел[\p{L}-]*|май|мая|мае|июн[\p{L}-]*|июл[\p{L}-]*|август[\p{L}-]*|сентябр[\p{L}-]*|октябр[\p{L}-]*|ноябр[\p{L}-]*|декабр[\p{L}-]*|случится|произойд[её]т|наступит)(?!\p{L}))/iu;
const TIMING_REFUSAL_EN = /(?:natal|birth) chart[^.!?\n]{0,140}(?:(?:cannot|can't|does not|doesn't|is unable to|is not able to)\s+(?:determine|tell|say|show|predict|provide|identify|confirm|choose)?|(?:is not|isn't)\s+(?:a\s+)?(?:calendar|forecast))[^.!?\n]{0,140}(?:today|tomorrow|date|when|timing|forecast|whether|best\s+(?:day|time)|right\s+(?:day|time))/iu;
const TIMING_REFUSAL_RU = /натальн[\p{L}-]*\s+карт[\p{L}-]*[^.!?\n]{0,140}(?:(?:не\s+(?:может|способна|позволяет)\s+(?:определить|подсказать|сказать|показать|предсказать|назвать|выбрать|подтвердить)?)|(?:не\s+(?:определяет|подсказывает|говорит|показывает|предсказывает|называет|выбирает|подтверждает|да[её]т))|(?:нельзя\s+(?:определить|подсказать|сказать|показать|предсказать|назвать|выбрать|подтвердить)))[^.!?\n]{0,140}(?:сегодня|завтра|дат[\p{L}-]*|когда|тайминг[\p{L}-]*|прогноз[\p{L}-]*|лучш[\p{L}-]*\s+(?:день|врем[\p{L}-]*)|подходящ[\p{L}-]*\s+(?:день|врем[\p{L}-]*)|стоит\s+ли|получится\s+ли|случится\s+ли|произойд[её]т\s+ли)/iu;
const STRONG_GUARANTEE_EN = /(?:\b(?:you\s+)?(?:will|are going to)\s+(?:definitely|certainly)\b|\bthe chart (?:proves|guarantees)\b)/iu;
const STRONG_GUARANTEE_RU = /(?:(?:ты\s+)?обязательно\s+(?:получишь|встретишь|станешь|сможешь|добь[её]шься|разбогатеешь|выйдешь|женишься)|карт\w*\s+(?:доказывает|гарантирует))/iu;
const SPECIFIC_FUTURE_EVENT_EN = /\b(?:will|shall)\s+(?:meet\s+(?:(?:a|an|the|your)\s+)?(?:new\s+)?(?:partner|spouse|husband|wife|lover|love|person)|receive\s+(?:money|payment|an?\s+(?:offer|promotion|award|inheritance|diagnosis)|the\s+(?:offer|promotion|award|inheritance|diagnosis)))\b/iu;
const SPECIFIC_FUTURE_EVENT_RU = /(?:(?<!\p{L})(?:ты\s+)?встретишь\s+(?:нов[\p{L}-]*\s+)?(?:партн[её]р[\p{L}-]*|любов[\p{L}-]*|мужчин[\p{L}-]*|женщин[\p{L}-]*|человек[\p{L}-]*)(?!\p{L})|(?<!\p{L})(?:ты\s+)?получишь\s+(?:деньг[\p{L}-]*|выплат[\p{L}-]*|предложен[\p{L}-]*|повышен[\p{L}-]*|наград[\p{L}-]*|наследств[\p{L}-]*|диагноз[\p{L}-]*)(?!\p{L}))/iu;
const PRESCRIPTIVE_HIGH_STAKES_EN = /\b(?:quit your job|file a lawsuit|ignore (?:a|your) doctor|avoid medical care)\b/iu;
const PRESCRIPTIVE_HIGH_STAKES_RU = /(?:увольняйся\s+с\s+работы|подавай\s+в\s+суд|не\s+слушай\s+врач\w*|откажись\s+от\s+лечен\w*)/iu;

function hasUnsupportedFutureTiming(value: string): boolean {
  return value
    .split(/(?:(?<=[.!?…])\s+|\n+)/u)
    .flatMap((sentence) => sentence.split(
      /(?:,\s*(?:but|however|yet|and|но|однако|зато|а|и)\s+|[;:—–]\s*|\s+-\s+)/iu,
    ))
    .map((part) => part.trim())
    .filter(Boolean)
    .some((sentence) => {
      const hasTiming = FUTURE_TIMING_EN.test(sentence) || FUTURE_TIMING_RU.test(sentence);
      if (!hasTiming) return false;
      return !TIMING_REFUSAL_EN.test(sentence) && !TIMING_REFUSAL_RU.test(sentence);
    });
}

export function validateNatalQuestionAnswer(
  raw: RawNatalQuestionAnswer,
  allowedEvidenceIds: Set<string>,
  reliability?: BuiltNatalModelContext,
): NatalQuestionAnswer | null {
  if (getNatalQuestionAnswerValidationErrors(raw, allowedEvidenceIds, reliability).length > 0) {
    return null;
  }
  const answer = text(raw?.answer);
  const ids = Array.isArray(raw?.evidence_ids)
    ? [...new Set(raw.evidence_ids.map(text).filter(Boolean))]
    : [];
  return { text: answer, evidenceIds: ids };
}

export function getNatalQuestionAnswerValidationErrors(
  raw: RawNatalQuestionAnswer,
  allowedEvidenceIds: Set<string>,
  reliability?: BuiltNatalModelContext,
): NatalQuestionValidationCode[] {
  const answer = text(raw?.answer);
  const narrativeEvidenceIds = reliability
    ? getNatalNarrativeEvidenceIds(reliability)
    : allowedEvidenceIds;
  const ids = Array.isArray(raw?.evidence_ids)
    ? [...new Set(raw.evidence_ids.map(text).filter(Boolean))]
    : [];
  const errors = new Set<NatalQuestionValidationCode>();
  const sentences = sentenceCount(answer);

  if (answer.length < 40) errors.add('ANSWER_TOO_SHORT');
  if (answer.length > 1600) errors.add('ANSWER_TOO_LONG');
  if (sentences < 3 || sentences > 5) errors.add('SENTENCE_COUNT_INVALID');
  if (ids.length === 0) errors.add('EVIDENCE_REQUIRED');
  if (ids.some((id) => !allowedEvidenceIds.has(id) || !narrativeEvidenceIds.has(id))) {
    errors.add('EVIDENCE_UNKNOWN');
  }
  if (hasNatalPersonalityCopyViolation(answer)) errors.add('COPY_VIOLATION');
  if (DIAGNOSTIC_ANSWER_EN.test(answer) || DIAGNOSTIC_ANSWER_RU.test(answer)) {
    errors.add('DIAGNOSTIC_CLAIM');
  }
  if (PROFESSIONAL_IMPERATIVE_EN.test(answer) || PROFESSIONAL_IMPERATIVE_RU.test(answer)) {
    errors.add('PROFESSIONAL_IMPERATIVE');
  }
  if (GUARANTEED_OUTCOME_EN.test(answer) || GUARANTEED_OUTCOME_RU.test(answer)) {
    errors.add('GUARANTEED_OUTCOME');
  }
  if (INVENTED_KARMIC_FACT.test(answer)) errors.add('KARMIC_CLAIM');
  if (STRONG_GUARANTEE_EN.test(answer) || STRONG_GUARANTEE_RU.test(answer)) {
    errors.add('STRONG_GUARANTEE');
  }
  if (PRESCRIPTIVE_HIGH_STAKES_EN.test(answer) || PRESCRIPTIVE_HIGH_STAKES_RU.test(answer)) {
    errors.add('HIGH_STAKES_PRESCRIPTION');
  }
  if (hasUnsupportedFutureTiming(answer)) errors.add('UNSUPPORTED_FUTURE_TIMING');
  if (SPECIFIC_FUTURE_EVENT_EN.test(answer) || SPECIFIC_FUTURE_EVENT_RU.test(answer)) {
    errors.add('UNSUPPORTED_FUTURE_EVENT');
  }
  if (reliability != null && !isNatalReliabilityTextAllowed(answer, reliability)) {
    errors.add('RELIABILITY_VIOLATION');
  }
  return [...errors];
}

async function requestStructuredNatalQuestionAnswer(input: {
  language: NatalReadingLanguage;
  prompt: string;
}): Promise<RawNatalQuestionAnswer> {
  const response = await createLunaStructuredResponse({
    instructions: getAppSystemVoice(input.language),
    input: input.prompt,
    maxOutputTokens: 900,
    schemaName: 'natal_question_answer',
    schema: NATAL_QUESTION_RESPONSE_SCHEMA,
  });
  try {
    return JSON.parse(response.content) as RawNatalQuestionAnswer;
  } catch {
    const error = new Error('NATAL_QUESTION_INVALID_JSON') as Error & { code?: string };
    error.code = 'NATAL_QUESTION_INVALID_JSON';
    throw error;
  }
}

export async function generateNatalQuestionAnswer(input: {
  chartId: number;
  profile: UserProfile;
  chartData: NatalChartData | NatalChartDataV2;
  permanentReport: NatalPermanentPremiumReport;
  history: readonly NatalQuestionStoredMessage[];
  question: string;
  requestAnswer?: NatalQuestionAnswerRequester;
}): Promise<NatalQuestionAnswer> {
  const language: NatalReadingLanguage = input.profile.language === 'en' ? 'en' : 'ru';
  const { built, context } = buildNatalQuestionPromptContext(input);
  const allowedEvidenceIds = getNatalNarrativeEvidenceIds(built);
  const requestAnswer = input.requestAnswer || requestStructuredNatalQuestionAnswer;
  let validationCodes: NatalQuestionValidationCode[] = [];

  for (let attempt = 1; attempt <= MAX_ANSWER_ATTEMPTS; attempt += 1) {
    const raw = await requestAnswer({
      language,
      prompt: buildNatalQuestionPrompt(language, context, validationCodes),
    });
    validationCodes = getNatalQuestionAnswerValidationErrors(
      raw,
      allowedEvidenceIds,
      built,
    );
    if (validationCodes.length === 0) {
      return {
        ...validateNatalQuestionAnswer(raw, allowedEvidenceIds, built)!,
        model: OPENAI_LUNA_MODEL,
        generationAttempts: attempt as 1 | 2,
      };
    }
  }
  throw new NatalQuestionValidationError(validationCodes, MAX_ANSWER_ATTEMPTS);
}

export const NATAL_QUESTION_IDENTITY = {
  contractVersion: NATAL_QUESTION_CONTRACT_VERSION,
  permanentReportContractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
  promptVersion: NATAL_QUESTION_PROMPT_VERSION,
  voiceVersion: APP_VOICE_VERSION,
} as const;
