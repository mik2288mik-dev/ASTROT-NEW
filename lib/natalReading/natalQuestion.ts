import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { llmJson } from '../anthropic';
import { APP_VOICE_VERSION, getAppSystemVoice, withAppVoiceVersion } from '../appVoice';
import {
  moderatePersonalForecastCustomQuestion,
  normalizePersonalForecastQuestionInput,
  type PersonalForecastQuestionModerationReason,
} from '../personalForecastQuestionModeration';
import {
  buildNatalModelContext,
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

export const NATAL_QUESTION_PROMPT_VERSION = withAppVoiceVersion('natal-question.v2');
export const NATAL_QUESTION_CONTRACT_VERSION = 'natal-question-v2';

export type NatalQuestionModeration = {
  status: 'approved' | 'rejected';
  reason: PersonalForecastQuestionModerationReason | 'relevant_natal_question';
  normalizedQuestion: string;
};

export type NatalQuestionAnswer = {
  text: string;
  evidenceIds: string[];
  model?: string;
};

export type NatalQuestionSnapshot = {
  chartId: number;
  messages: NatalQuestionStoredMessage[];
  usage: NatalQuestionUsage;
  promptVersion: string;
  voiceVersion: string;
};

export type NatalQuestionPromptContext = {
  chartId: number;
  chart: BuiltNatalModelContext['context'];
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
      chart: built.context,
      permanentReport: input.permanentReport,
      recentMessages,
      question: normalizePersonalForecastQuestionInput(input.question),
    },
  };
}

export function buildNatalQuestionPrompt(
  language: NatalReadingLanguage,
  context: NatalQuestionPromptContext,
): string {
  const languageRule = language === 'ru'
    ? 'Answer in Russian and address the reader as «ты».'
    : 'Answer in English and address the reader as “you”.';
  return `${languageRule}

Answer the user's question from the permanent calculated birth chart and the permanent report below.

Rules:
- Return JSON only: {"answer":"3-5 complete sentences","evidence_ids":["existing evidence id"]}.
- Give a direct answer first, then connect it to concrete chart factors.
- Use previous messages only for conversational continuity. They are not calculation evidence.
- Every astrological claim must be supported by one or more evidence_ids that exist in chart.evidence.
- Never recalculate or invent placements, houses, aspects, biography, trauma, diagnoses, relationship history, guaranteed events, financial outcomes, karmic facts, or professional prescriptions.
- This context is a permanent birth-chart portrait. If the user asks when something will happen or requests a dated forecast, say that the natal chart alone cannot supply a date and direct them to the forecast surface. Do not fabricate a calendar answer.
- Do not change or rewrite the permanent report.

QUESTION CONTEXT:
${JSON.stringify(context, null, 2)}`;
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
const FUTURE_TIMING_EN = /(?:\b(?:today|tomorrow|tonight|next (?:week|month|year)|this (?:week|month|year)|(?:on|by|before) (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b|\b(?:in|within)\s+\d+\s+(?:days?|weeks?|months?|years?)\b|\b20\d{2}\b|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b|\b(?:will|shall)\s+(?:happen|occur|arrive|begin|meet|receive)\b)/iu;
const FUTURE_TIMING_RU = /(?:сегодня|завтра|на следующ(?:ей|ую)\s+(?:недел\w*|месяц\w*)|в этом\s+(?:месяц\w*|году)|(?:в|до)\s+(?:понедельник\w*|вторник\w*|сред\w*|четверг\w*|пятниц\w*|суббот\w*|воскресень\w*)|через\s+\d+\s+(?:дн\w*|недел\w*|месяц\w*|лет|год\w*)|в\s+течение\s+\d+\s+(?:дн\w*|недел\w*|месяц\w*)|\b20\d{2}\b|январ\w*|феврал\w*|март\w*|апрел\w*|ма[йяе]|июн\w*|июл\w*|август\w*|сентябр\w*|октябр\w*|ноябр\w*|декабр\w*|случится|произойд[её]т|встретишь|получишь)/iu;
const TIMING_REFUSAL_EN = /(?:natal|birth) chart[^.!?\n]{0,100}(?:cannot|can't|does not|doesn't|is unable to)[^.!?\n]{0,80}(?:date|when|timing|forecast)/iu;
const TIMING_REFUSAL_RU = /натальн\w+\s+карт\w*[^.!?\n]{0,100}(?:не\s+(?:да[её]т|может|показывает|определяет))[^.!?\n]{0,80}(?:дат\w*|когда|тайминг\w*|прогноз\w*)/iu;
const STRONG_GUARANTEE_EN = /(?:\b(?:you\s+)?(?:will|are going to)\s+(?:definitely|certainly)\b|\bthe chart (?:proves|guarantees)\b)/iu;
const STRONG_GUARANTEE_RU = /(?:(?:ты\s+)?обязательно\s+(?:получишь|встретишь|станешь|сможешь|добь[её]шься|разбогатеешь|выйдешь|женишься)|карт\w*\s+(?:доказывает|гарантирует))/iu;
const PRESCRIPTIVE_HIGH_STAKES_EN = /\b(?:quit your job|file a lawsuit|ignore (?:a|your) doctor|avoid medical care)\b/iu;
const PRESCRIPTIVE_HIGH_STAKES_RU = /(?:увольняйся\s+с\s+работы|подавай\s+в\s+суд|не\s+слушай\s+врач\w*|откажись\s+от\s+лечен\w*)/iu;

function hasUnsupportedFutureTiming(value: string): boolean {
  return value
    .split(/(?<=[.!?…])\s+/u)
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
  const answer = text(raw?.answer);
  const ids = Array.isArray(raw?.evidence_ids)
    ? [...new Set(raw.evidence_ids.map(text).filter(Boolean))]
    : [];
  const sentences = sentenceCount(answer);
  if (
    answer.length < 40
    || answer.length > 1600
    || sentences < 3
    || sentences > 5
    || ids.length === 0
    || ids.some((id) => !allowedEvidenceIds.has(id))
    || DIAGNOSTIC_ANSWER_EN.test(answer)
    || DIAGNOSTIC_ANSWER_RU.test(answer)
    || PROFESSIONAL_IMPERATIVE_EN.test(answer)
    || PROFESSIONAL_IMPERATIVE_RU.test(answer)
    || GUARANTEED_OUTCOME_EN.test(answer)
    || GUARANTEED_OUTCOME_RU.test(answer)
    || INVENTED_KARMIC_FACT.test(answer)
    || STRONG_GUARANTEE_EN.test(answer)
    || STRONG_GUARANTEE_RU.test(answer)
    || PRESCRIPTIVE_HIGH_STAKES_EN.test(answer)
    || PRESCRIPTIVE_HIGH_STAKES_RU.test(answer)
    || hasUnsupportedFutureTiming(answer)
    || (reliability != null && !isNatalReliabilityTextAllowed(answer, reliability))
  ) return null;
  return { text: answer, evidenceIds: ids };
}

export async function generateNatalQuestionAnswer(input: {
  chartId: number;
  profile: UserProfile;
  chartData: NatalChartData | NatalChartDataV2;
  permanentReport: NatalPermanentPremiumReport;
  history: readonly NatalQuestionStoredMessage[];
  question: string;
}): Promise<NatalQuestionAnswer> {
  const language: NatalReadingLanguage = input.profile.language === 'en' ? 'en' : 'ru';
  const { built, context } = buildNatalQuestionPromptContext(input);
  const raw = await llmJson<RawNatalQuestionAnswer>({
    system: getAppSystemVoice(language),
    user: buildNatalQuestionPrompt(language, context),
    model: {
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant: 'full',
    },
    maxTokens: 900,
    temperature: 0.25,
  });
  const answer = validateNatalQuestionAnswer(raw, built.evidenceIds, built);
  if (!answer) throw new Error('NATAL_QUESTION_VALIDATION_FAILED');
  return answer;
}

export const NATAL_QUESTION_IDENTITY = {
  contractVersion: NATAL_QUESTION_CONTRACT_VERSION,
  permanentReportContractVersion: NATAL_PERMANENT_CONTRACT_VERSION,
  promptVersion: NATAL_QUESTION_PROMPT_VERSION,
  voiceVersion: APP_VOICE_VERSION,
} as const;
