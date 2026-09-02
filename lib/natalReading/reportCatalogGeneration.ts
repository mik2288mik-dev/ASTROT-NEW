import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import { getAppSystemVoice } from '../appVoice';
import {
  callStructuredWithBudgetRetry,
  type StrictJsonSchema,
} from '../openaiResponses';
import {
  hasNatalPersonalityCopyViolation,
  isNatalReliabilityTextAllowed,
  type BuiltNatalModelContext,
} from './permanentReport';
import {
  getNatalReportAnswer,
  getNatalReportCategory,
  isNatalReportAnswerFree,
  localizeNatalReportList,
  localizeNatalReportText,
  NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  NATAL_REPORT_MAIN_PREVIEW_KEYS,
  type NatalReportAnswer,
  type NatalReportAnswerKey,
  type NatalReportCategoryKey,
  type NatalReportCategoryPack,
  type NatalReportStatement,
} from './reportCatalog';
import {
  buildNatalReportCatalogContext,
  buildNatalReportEvidencePromptContext,
  resolveNatalReportAnswerEvidence,
  resolveNatalReportCategoryEvidence,
  type NatalReportAnswerEvidencePlan,
} from './reportCatalogEvidence';

type RawStatement = {
  text?: unknown;
  evidence_ids?: unknown;
};

type RawPreview = {
  answer_key?: unknown;
  preview?: unknown;
  evidence_ids?: unknown;
};

type RawAnswer = {
  answer_key?: unknown;
  paragraphs?: RawStatement[];
};

export type RawNatalReportCategoryPayload = {
  summary?: RawStatement[];
  observations?: RawStatement[];
  previews?: RawPreview[];
  free_answers?: RawAnswer[];
};

export type RawNatalReportAnswerPayload = RawAnswer;

const FORBIDDEN_CATALOG_COPY = /(?:(?:^|[^\p{L}])(?:психолог[\p{L}]*|психическ[\p{L}]*|психотип[\p{L}]*|коуч[\p{L}]*|самовыраж[\p{L}]*|самореализац[\p{L}]*|ценност[\p{L}]*|энерги[\p{L}]*|потенциал[\p{L}]*|рекомендац[\p{L}]*|практик(?:а|и|е|у|ой|ою|ам|ами|ах)?|границ[\p{L}]*|ресурс[\p{L}]*|опор[\p{L}]*|паттерн[\p{L}]*|триггер[\p{L}]*|предназначени[\p{L}]*|карм(?:а|ы|е|у|ой|ою|ею|ам|ами|ах|ическ[\p{L}]*|ичн[\p{L}]*)|вибрац[\p{L}]*|мисси[\p{L}]*|проработ[\p{L}]*|psycholog(?:y|ies|ical|ically|ist|ists)|coach(?:es|ed|ing)?|self(?:-|\s)?express(?:ion|ions|ive|ively)|self-actuali[sz][\p{L}]*|self-reali[sz][\p{L}]*|values|(?:personal|core)\s+value|energ(?:y|ies|etic|etically)|potential(?:s|ly)?|recommend(?:ation|ations|ed|ing|s)?|practic(?:e|es|ed|ing)|practis(?:e|es|ed|ing)|boundar(?:y|ies)|resources?|support(?:s|ed|ing|ive)?|patterns?|triggers?|triggered|triggering|destiny|karma|karmic|vibration|mission)(?:$|[^\p{L}])|позволь\s+себе|тебе\s+важно\s+научиться|важно\s+научиться|прислушайся\s+к\s+себе|чувствуешь\s+глубже|снаружи[^.!?]{0,80}внутри|inner\s+resource|support\s+point|work\s+through|allow\s+yourself|learn\s+to|listen\s+to\s+yourself)/iu;
const CHANGING_TIME_COPY = /(?:(?:^|[^\p{L}])(?:сегодня|завтра|скоро|на этой неделе|в этом месяце|в этом году|тебя жд[её]т|обязательно произойд[её]т|today|tomorrow|soon|this week|this month|this year|you will definitely|awaits you)(?:$|[^\p{L}])|(?:^|[^\p{N}])20\d{2}(?:$|[^\p{N}]))/iu;

export const NATAL_REPORT_MAIN_SUMMARY_MIN_CHARS = 600;
export const NATAL_REPORT_MAIN_SUMMARY_MAX_CHARS = 1050;
const NATAL_REPORT_MAIN_PARAGRAPH_MIN_CHARS = 200;
const NATAL_REPORT_MAIN_PARAGRAPH_MAX_CHARS = 210;
const NATAL_REPORT_SEMANTIC_ATTEMPTS = 3;

type StructuredRequester = Exclude<
  NonNullable<Parameters<typeof callStructuredWithBudgetRetry>[3]>['request'],
  undefined
>;

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function sentenceCount(value: string): number {
  return value
    .split(/(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .length;
}

function normalizedCopy(value: string): string {
  return value
    .toLocaleLowerCase('ru-RU')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function hasNatalReportCatalogCopyViolation(value: string): boolean {
  return FORBIDDEN_CATALOG_COPY.test(value) || CHANGING_TIME_COPY.test(value);
}

export function isNatalReportMainSummaryLengthAllowed(values: readonly string[]): boolean {
  if (values.length < 3 || values.length > 5) return false;
  const totalLength = values.reduce((sum, value) => sum + text(value).length, 0);
  return totalLength >= NATAL_REPORT_MAIN_SUMMARY_MIN_CHARS
    && totalLength <= NATAL_REPORT_MAIN_SUMMARY_MAX_CHARS;
}

function isCopyAllowed(value: string, built: BuiltNatalModelContext): boolean {
  return value.length > 0
    && !hasNatalPersonalityCopyViolation(value)
    && !hasNatalReportCatalogCopyViolation(value)
    && isNatalReliabilityTextAllowed(value, built);
}

export type NatalReportCopyValidationKind =
  | 'PERSONALITY_COPY'
  | 'CATALOG_COPY'
  | 'RELIABILITY';

export function getNatalReportCopyValidationKinds(
  value: string,
  built: BuiltNatalModelContext,
): NatalReportCopyValidationKind[] {
  const kinds: NatalReportCopyValidationKind[] = [];
  if (!value || hasNatalPersonalityCopyViolation(value)) kinds.push('PERSONALITY_COPY');
  if (!value || hasNatalReportCatalogCopyViolation(value)) kinds.push('CATALOG_COPY');
  if (!value || !isNatalReliabilityTextAllowed(value, built)) kinds.push('RELIABILITY');
  return unique(kinds) as NatalReportCopyValidationKind[];
}

function appendCopyValidationIssues(
  issues: string[],
  path: string,
  value: string,
  built: BuiltNatalModelContext,
): void {
  for (const kind of getNatalReportCopyValidationKinds(value, built)) {
    issues.push(`COPY_VIOLATION:${path}:${kind}`);
  }
}

function parsedEvidenceIds(
  value: unknown,
  allowed: ReadonlySet<string>,
): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = unique(value.map(text).filter(Boolean));
  return ids.length > 0 && ids.length <= 10 && ids.every((id) => allowed.has(id))
    ? ids
    : null;
}

function parseStatement(
  raw: RawStatement | null | undefined,
  allowed: ReadonlySet<string>,
  built: BuiltNatalModelContext,
  limits: { min: number; max: number; maxSentences?: number },
): NatalReportStatement | null {
  const value = text(raw?.text);
  const evidenceIds = parsedEvidenceIds(raw?.evidence_ids, allowed);
  if (
    !evidenceIds
    || value.length < limits.min
    || value.length > limits.max
    || (limits.maxSentences != null && sentenceCount(value) > limits.maxSentences)
    || !isCopyAllowed(value, built)
  ) return null;
  return { text: value, evidenceIds };
}

function parseAnswer(
  raw: RawAnswer | null | undefined,
  answerKey: NatalReportAnswerKey,
  plan: NatalReportAnswerEvidencePlan,
  built: BuiltNatalModelContext,
  language: 'ru' | 'en',
): NatalReportAnswer | null {
  const definition = getNatalReportAnswer(answerKey);
  if (!definition || text(raw?.answer_key) !== answerKey || !Array.isArray(raw?.paragraphs)) {
    return null;
  }
  if (raw.paragraphs.length < 3 || raw.paragraphs.length > 5) return null;
  const allowed = new Set(plan.evidenceIds);
  const paragraphs = raw.paragraphs.map((paragraph) => (
    parseStatement(paragraph, allowed, built, { min: 35, max: 300, maxSentences: 2 })
  ));
  if (paragraphs.some((paragraph) => paragraph == null)) return null;
  const parsed = paragraphs as NatalReportStatement[];
  const totalLength = parsed.reduce((sum, paragraph) => sum + paragraph.text.length, 0);
  if (totalLength > 1200) return null;
  const usedEvidenceIds = unique(parsed.flatMap((paragraph) => paragraph.evidenceIds));
  if (plan.requiredEvidenceIds.some((id) => !usedEvidenceIds.includes(id))) return null;
  if (new Set(parsed.map((paragraph) => normalizedCopy(paragraph.text))).size !== parsed.length) {
    return null;
  }
  return {
    schemaVersion: 'natal-report-answer-v1',
    contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
    answerKey,
    categoryKey: definition.categoryKey,
    title: localizeNatalReportText(definition.title, language),
    access: definition.access,
    paragraphs: parsed,
    evidenceIds: usedEvidenceIds,
    related: definition.related,
    fullAnswerIncludes: localizeNatalReportList(definition.fullAnswerIncludes, language),
  };
}

function statementSchema(minLength: number, maxLength: number) {
  return {
    type: 'object',
    properties: {
      text: { type: 'string', minLength, maxLength },
      evidence_ids: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        maxItems: 10,
      },
    },
    required: ['text', 'evidence_ids'],
    additionalProperties: false,
  };
}

function answerSchema(answerKeys: readonly NatalReportAnswerKey[]) {
  return {
    type: 'object',
    properties: {
      answer_key: { type: 'string', enum: answerKeys },
      paragraphs: {
        type: 'array',
        minItems: 3,
        maxItems: 5,
        items: statementSchema(35, 300),
      },
    },
    required: ['answer_key', 'paragraphs'],
    additionalProperties: false,
  };
}

export function buildNatalReportCategorySchema(
  categoryKey: NatalReportCategoryKey,
): StrictJsonSchema {
  const category = getNatalReportCategory(categoryKey);
  if (!category) throw new Error('NATAL_REPORT_CATEGORY_NOT_FOUND');
  const previewKeys: readonly NatalReportAnswerKey[] = categoryKey === 'main'
    ? NATAL_REPORT_MAIN_PREVIEW_KEYS
    : category.answerKeys;
  const freeKeys = category.answerKeys.filter(isNatalReportAnswerFree);
  const isMain = categoryKey === 'main';
  return {
    type: 'object',
    properties: {
      summary: {
        type: 'array',
        minItems: isMain ? 3 : 0,
        maxItems: isMain ? 5 : 0,
        items: statementSchema(
          isMain ? NATAL_REPORT_MAIN_PARAGRAPH_MIN_CHARS : 45,
          isMain ? NATAL_REPORT_MAIN_PARAGRAPH_MAX_CHARS : 300,
        ),
      },
      observations: {
        type: 'array',
        minItems: isMain ? 5 : 0,
        maxItems: isMain ? 5 : 0,
        items: statementSchema(35, 150),
      },
      previews: {
        type: 'array',
        minItems: previewKeys.length,
        maxItems: previewKeys.length,
        items: {
          type: 'object',
          properties: {
            answer_key: { type: 'string', enum: previewKeys },
            preview: { type: 'string', minLength: 55, maxLength: 150 },
            evidence_ids: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 10,
            },
          },
          required: ['answer_key', 'preview', 'evidence_ids'],
          additionalProperties: false,
        },
      },
      free_answers: {
        type: 'array',
        minItems: freeKeys.length,
        maxItems: freeKeys.length,
        items: answerSchema(freeKeys),
      },
    },
    required: ['summary', 'observations', 'previews', 'free_answers'],
    additionalProperties: false,
  };
}

export function buildNatalReportAnswerSchema(
  answerKey: NatalReportAnswerKey,
): StrictJsonSchema {
  return answerSchema([answerKey]) as StrictJsonSchema;
}

function promptCatalogDefinition(
  answerKey: NatalReportAnswerKey,
  language: 'ru' | 'en',
) {
  const definition = getNatalReportAnswer(answerKey)!;
  return {
    answer_key: answerKey,
    question: localizeNatalReportText(definition.title, language),
    full_answer_covers: localizeNatalReportList(definition.fullAnswerIncludes, language),
    access: definition.access,
  };
}

export function getNatalReportCatalogSystemPrompt(language: 'ru' | 'en'): string {
  const rules = language === 'ru'
    ? `ЗАДАЧА
- Пиши о человеке прямо, живо и обычными словами. Обращайся на «ты».
- Первый вывод давай сразу. Потом покажи его через простую ситуацию: знакомство, переписку, спор, покупку, работу, срок или договорённость.
- Никакой психологии, коучинга, воспитания, мистики и астрологического языка. Не используй «ресурс», «опора», «границы», «паттерн», «потенциал», «энергия», «предназначение» и похожие слова.
- Вообще не называй планеты, знаки, дома, аспекты, градусы, углы, асцендент или MC. Не упоминай сегодня, завтра, даты и будущие события.
- Не используй готовые обороты «это про тебя», «считывается», «проверка фактов», «что стоит заметить», «внутренняя точность» и рекламные недосказанности.
- Не пиши советы, практики, диагнозы, обещания, биографию и будущие события.
- Не используй универсальные формулы вроде «чувствуешь глубже, чем показываешь», «снаружи один, внутри другой» или «тебя не всегда понимают».
 - Preview — одно короткое законченное предложение с персональным выводом. Полный ответ — 3–5 коротких абзацев, первый абзац самый сильный.
- Каждый текст возвращает только разрешённые evidence_ids и не печатает их для читателя.
- Верни каждый указанный answer_key ровно один раз, без пропусков и дублей.
- В полном бесплатном ответе сумма evidence_ids всех абзацев обязана включать каждый required_evidence_id этого ответа.
- Ответ только JSON, без Markdown.`
    : `TASK
- Write directly, vividly, and in ordinary words. Address the reader as “you”.
- Give the strongest conclusion first, then show it through an ordinary situation: meeting someone, texting, an argument, a purchase, work, a deadline, or an agreement.
- No psychology, coaching, instruction, mysticism, or visible astrology. Avoid report jargon such as resource, support point, boundaries, pattern, potential, energy, or destiny.
- Never name planets, signs, houses, aspects, degrees, angles, Ascendant, or MC. Mention no current dates or future events.
- Avoid canned phrases, pseudo-insight, report language, and advertising cliffhangers.
- Do not give advice, practices, diagnoses, promises, biography, or future events.
- Avoid universal formulas such as “you feel more deeply than you show” or “one way outside, another inside”.
 - A preview is one short, complete sentence with a personal conclusion. A full answer is 3–5 short paragraphs, with the strongest paragraph first.
- Every text returns only allowed evidence_ids and never prints them for the reader.
- Return every listed answer_key exactly once, with no omissions or duplicates.
- Across a full free answer, paragraph evidence_ids must include every required_evidence_id for that answer.
- Return JSON only, with no Markdown.`;
  return `${getAppSystemVoice(language)}\n\n${rules}`;
}

export function buildNatalReportCategoryPrompt(input: {
  language: 'ru' | 'en';
  built: BuiltNatalModelContext;
  categoryKey: NatalReportCategoryKey;
  mainAnchor?: NatalReportCategoryPack | null;
}): string {
  const category = getNatalReportCategory(input.categoryKey);
  if (!category) throw new Error('NATAL_REPORT_CATEGORY_NOT_FOUND');
  const previewKeys: readonly NatalReportAnswerKey[] = input.categoryKey === 'main'
    ? NATAL_REPORT_MAIN_PREVIEW_KEYS
    : category.answerKeys;
  const plans = resolveNatalReportCategoryEvidence(input.built, input.categoryKey);
  const isMain = input.categoryKey === 'main';
  const task = input.language === 'ru'
    ? `${isMain
      ? `Напиши общий разбор на 40–60 секунд чтения: 3–5 коротких абзацев summary, суммарно ${NATAL_REPORT_MAIN_SUMMARY_MIN_CHARS}–${NATAL_REPORT_MAIN_SUMMARY_MAX_CHARS} знаков, ровно 5 коротких наблюдений и два полных бесплатных ответа.`
      : 'Для каждого вопроса напиши персональный preview. Затем напиши один полный бесплатный ответ, указанный в каталоге.'}
Для main каждый абзац summary содержит 200–210 знаков.
Preview не пересказывает название и не обрывается рекламной интригой. Закрытый preview даёт настоящий вывод, но не весь разбор.
В каждом полном ответе 3–5 коротких абзацев. Не добавляй совет в конце.`
    : `${isMain
      ? `Write a 40–60 second main reading: 3–5 short summary paragraphs, ${NATAL_REPORT_MAIN_SUMMARY_MIN_CHARS}–${NATAL_REPORT_MAIN_SUMMARY_MAX_CHARS} characters total, exactly 5 short observations, and both full free answers.`
      : 'Write a personal preview for every question, then the single full free answer marked in the catalog.'}
For main, every summary paragraph contains 200–210 characters.
A preview does not repeat the title and does not end with an advertising cliffhanger. A locked preview gives a real conclusion, not the whole answer.
Every full answer has 3–5 short paragraphs. Do not add advice at the end.`;
  const anchor = input.mainAnchor && input.categoryKey !== 'main'
    ? {
        summary: input.mainAnchor.summary.map((item) => item.text),
        observations: input.mainAnchor.observations.map((item) => item.text),
      }
    : null;
  return `${task}

CATEGORY:
${JSON.stringify({
    category_key: category.key,
    title: localizeNatalReportText(category.title, input.language),
    answers: previewKeys.map((key) => promptCatalogDefinition(key, input.language)),
  }, null, 2)}

${anchor ? `MAIN READING ANCHOR — KEEP THE SAME PERSON, DO NOT COPY IT:\n${JSON.stringify(anchor, null, 2)}\n\n` : ''}CALCULATED EVIDENCE:
${JSON.stringify(buildNatalReportEvidencePromptContext(input.built, plans), null, 2)}`;
}

export function buildNatalReportAnswerPrompt(input: {
  language: 'ru' | 'en';
  built: BuiltNatalModelContext;
  answerKey: NatalReportAnswerKey;
  preview?: string | null;
  mainAnchor?: NatalReportCategoryPack | null;
}): string {
  const plan = resolveNatalReportAnswerEvidence(input.built, input.answerKey);
  const definition = getNatalReportAnswer(input.answerKey);
  if (!definition) throw new Error('NATAL_REPORT_ANSWER_NOT_FOUND');
  const task = input.language === 'ru'
    ? `Ответь на один вопрос. Дай самый сильный вывод в первом абзаце, затем 2–4 коротких абзаца с обычными ситуациями и важной оговоркой. Раскрой уже показанный preview, но не копируй его дословно. Не давай советов.`
    : `Answer one question. Give the strongest conclusion in the first paragraph, then 2–4 short paragraphs with ordinary situations and an important qualification. Expand the existing preview without copying it verbatim. Give no advice.`;
  return `${task}

QUESTION:
${JSON.stringify(promptCatalogDefinition(input.answerKey, input.language), null, 2)}

${input.preview ? `EXISTING PREVIEW:\n${JSON.stringify(input.preview)}\n\n` : ''}${input.mainAnchor ? `MAIN READING ANCHOR — KEEP THE SAME PERSON, DO NOT COPY IT:\n${JSON.stringify({
    summary: input.mainAnchor.summary.map((item) => item.text),
    observations: input.mainAnchor.observations.map((item) => item.text),
  }, null, 2)}\n\n` : ''}CALCULATED EVIDENCE:
${JSON.stringify(buildNatalReportEvidencePromptContext(input.built, [plan]), null, 2)}`;
}

function parseJson<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error('NATAL_REPORT_CATALOG_INVALID_JSON');
  }
}

export function getNatalReportCategoryValidationIssues(input: {
  raw: RawNatalReportCategoryPayload;
  built: BuiltNatalModelContext;
  categoryKey: NatalReportCategoryKey;
}): string[] {
  const issues: string[] = [];
  const category = getNatalReportCategory(input.categoryKey);
  if (!category) return ['CATEGORY_UNKNOWN'];
  const isMain = input.categoryKey === 'main';
  const plans = resolveNatalReportCategoryEvidence(input.built, input.categoryKey);
  const planByKey = new Map(plans.map((plan) => [plan.answerKey, plan]));
  const summary = Array.isArray(input.raw.summary) ? input.raw.summary : [];
  const observations = Array.isArray(input.raw.observations) ? input.raw.observations : [];
  const previews = Array.isArray(input.raw.previews) ? input.raw.previews : [];
  const freeAnswers = Array.isArray(input.raw.free_answers) ? input.raw.free_answers : [];
  const summaryLength = summary.reduce((sum, statement) => sum + text(statement?.text).length, 0);

  if (isMain && summaryLength < NATAL_REPORT_MAIN_SUMMARY_MIN_CHARS) {
    issues.push('SUMMARY_TOTAL_TOO_SHORT:' + summaryLength);
  }
  if (isMain && summaryLength > NATAL_REPORT_MAIN_SUMMARY_MAX_CHARS) {
    issues.push('SUMMARY_TOTAL_TOO_LONG:' + summaryLength);
  }
  if (
    (isMain && summary.some((statement) => {
      const length = text(statement?.text).length;
      return length < NATAL_REPORT_MAIN_PARAGRAPH_MIN_CHARS
        || length > NATAL_REPORT_MAIN_PARAGRAPH_MAX_CHARS;
    }))
    || (!isMain && summary.length !== 0)
  ) {
    issues.push('SUMMARY_SHAPE_INVALID');
  }
  if (
    (isMain && observations.length !== 5)
    || (!isMain && observations.length !== 0)
  ) {
    issues.push('OBSERVATION_COUNT_INVALID');
  }

  const expectedPreviewKeys: readonly NatalReportAnswerKey[] = isMain
    ? NATAL_REPORT_MAIN_PREVIEW_KEYS
    : category.answerKeys;
  const actualPreviewKeys = previews.map((preview) => text(preview?.answer_key));
  if (
    actualPreviewKeys.length !== expectedPreviewKeys.length
    || new Set(actualPreviewKeys).size !== expectedPreviewKeys.length
    || expectedPreviewKeys.some((key) => !actualPreviewKeys.includes(key))
  ) {
    issues.push('PREVIEW_KEYS_INVALID');
  }

  const expectedFreeKeys = category.answerKeys.filter(isNatalReportAnswerFree);
  const actualFreeKeys = freeAnswers.map((answer) => text(answer?.answer_key));
  if (
    actualFreeKeys.length !== expectedFreeKeys.length
    || new Set(actualFreeKeys).size !== expectedFreeKeys.length
    || expectedFreeKeys.some((key) => !actualFreeKeys.includes(key))
  ) {
    issues.push('FREE_ANSWER_KEYS_INVALID');
  }
  for (const answerKey of expectedFreeKeys) {
    const rawAnswer = freeAnswers.find((answer) => text(answer?.answer_key) === answerKey);
    const plan = planByKey.get(answerKey);
    if (!rawAnswer || !plan || !Array.isArray(rawAnswer.paragraphs)) continue;
    const usedIds = new Set(rawAnswer.paragraphs.flatMap((paragraph) => (
      Array.isArray(paragraph?.evidence_ids)
        ? paragraph.evidence_ids.map(text).filter(Boolean)
        : []
    )));
    const missingCount = plan.requiredEvidenceIds.filter((id) => !usedIds.has(id)).length;
    if (missingCount > 0) {
      issues.push('FREE_ANSWER_REQUIRED_EVIDENCE_MISSING:' + answerKey + ':' + missingCount);
    }
  }

  const copyFields: Array<{ path: string; value: string }> = [
    ...summary.map((statement, index) => ({
      path: `summary[${index}]`,
      value: text(statement?.text),
    })),
    ...observations.map((statement, index) => ({
      path: `observations[${index}]`,
      value: text(statement?.text),
    })),
    ...previews.map((preview, index) => ({
      path: `previews[${index}]`,
      value: text(preview?.preview),
    })),
    ...freeAnswers.flatMap((answer, answerIndex) => (
      Array.isArray(answer?.paragraphs)
        ? answer.paragraphs.map((paragraph, paragraphIndex) => ({
            path: `free_answers[${answerIndex}].paragraphs[${paragraphIndex}]`,
            value: text(paragraph?.text),
          }))
        : []
    )),
  ].filter((field) => field.value.length > 0);
  const copyIssueCountBefore = issues.length;
  for (const field of copyFields) {
    appendCopyValidationIssues(issues, field.path, field.value, input.built);
  }
  if (issues.length > copyIssueCountBefore) {
    issues.push('COPY_OR_RELIABILITY_VIOLATION');
  }
  return unique(issues);
}

export function getNatalReportAnswerValidationIssues(input: {
  raw: RawNatalReportAnswerPayload;
  built: BuiltNatalModelContext;
  answerKey: NatalReportAnswerKey;
}): string[] {
  const issues: string[] = [];
  const plan = resolveNatalReportAnswerEvidence(input.built, input.answerKey);
  if (text(input.raw.answer_key) !== input.answerKey) issues.push('ANSWER_KEY_INVALID');
  const paragraphs = Array.isArray(input.raw.paragraphs) ? input.raw.paragraphs : [];
  if (paragraphs.length < 3 || paragraphs.length > 5) issues.push('PARAGRAPH_COUNT_INVALID');
  const usedIds = new Set(paragraphs.flatMap((paragraph) => (
    Array.isArray(paragraph?.evidence_ids)
      ? paragraph.evidence_ids.map(text).filter(Boolean)
      : []
  )));
  const missingCount = plan.requiredEvidenceIds.filter((id) => !usedIds.has(id)).length;
  if (missingCount > 0) issues.push('REQUIRED_EVIDENCE_MISSING:' + missingCount);
  const copyIssueCountBefore = issues.length;
  paragraphs.forEach((paragraph, index) => {
    appendCopyValidationIssues(
      issues,
      `paragraphs[${index}]`,
      text(paragraph?.text),
      input.built,
    );
  });
  if (issues.length > copyIssueCountBefore) {
    issues.push('COPY_OR_RELIABILITY_VIOLATION');
  }
  return unique(issues);
}

function buildSemanticRepairPrompt(
  prompt: string,
  issues: readonly string[],
  language: 'ru' | 'en',
): string {
  const guide = language === 'ru'
    ? `\nРасшифровка кодов:\n- PERSONALITY_COPY means: в указанном поле есть астрологические названия, мистика, психологическое клише, совет, коучинговая команда, диагноз, гарантия или универсальная фраза. Удали всё это.\n- CATALOG_COPY means: в указанном поле есть запрещённый жаргон, текущая дата, обещание будущего или рекламная интрига. Перепиши обычными словами.\n- RELIABILITY means: поле ссылается на дом, угол, асцендент, MC или другой вывод, которого нет среди надёжных входных данных. Удали такой вывод; не заменяй его догадкой.\nВо всём пользовательском тексте не называй планеты, знаки, дома, аспекты, градусы, углы, асцендент или MC. Не давай советов. Не упоминай сегодня, завтра, даты и будущие события. Перепиши каждое поле с указанным путём полностью, но верни весь JSON и сохрани разрешённые evidence_ids.`
    : `\nIssue guide:\n- PERSONALITY_COPY means: the field contains visible astrology, mysticism, a psychological cliché, advice, coaching language, a diagnosis, a guarantee, or a generic personality formula. Remove it.\n- CATALOG_COPY means: the field contains banned report jargon, a current date, a future promise, or an advertising cliffhanger. Rewrite it in ordinary words.\n- RELIABILITY means: the field refers to a house, angle, Ascendant, MC, or another claim not present in reliable input. Remove that claim and do not replace it with a guess.\nNever name planets, signs, houses, aspects, degrees, angles, Ascendant, or MC in user-facing text. Give no advice. Mention no current dates or future events. Fully rewrite every field whose path is listed, return the complete JSON, and keep only allowed evidence_ids.`;
  const instruction = language === 'ru'
    ? '\n\nREPAIR REQUIRED:\nПредыдущий вариант не прошёл серверную проверку: '
      + JSON.stringify(issues)
      + '. Не пытайся угадать одно запрещённое слово: используй путь и тип каждого кода, затем напиши весь JSON заново. Не копируй предыдущий текст.'
    : '\n\nREPAIR REQUIRED:\nThe previous candidate failed server validation: '
      + JSON.stringify(issues)
      + '. Do not guess one offending word: use every field path and issue type, then rewrite the complete JSON without copying the previous wording.';
  return prompt + instruction + guide;
}

export function materializeNatalReportCategoryPack(input: {
  raw: RawNatalReportCategoryPayload;
  built: BuiltNatalModelContext;
  categoryKey: NatalReportCategoryKey;
  language: 'ru' | 'en';
}): NatalReportCategoryPack | null {
  const category = getNatalReportCategory(input.categoryKey);
  if (!category) return null;
  const plans = resolveNatalReportCategoryEvidence(input.built, input.categoryKey);
  const planByKey = new Map(plans.map((plan) => [plan.answerKey, plan]));
  const allowedAll = new Set(plans.flatMap((plan) => plan.evidenceIds));
  const isMain = input.categoryKey === 'main';
  const previewKeys: readonly NatalReportAnswerKey[] = isMain
    ? NATAL_REPORT_MAIN_PREVIEW_KEYS
    : category.answerKeys;
  if (!Array.isArray(input.raw.summary) || !Array.isArray(input.raw.observations)) return null;
  if (
    (isMain && (input.raw.summary.length < 3 || input.raw.summary.length > 5))
    || (!isMain && input.raw.summary.length !== 0)
    || (isMain && input.raw.observations.length !== 5)
    || (!isMain && input.raw.observations.length !== 0)
  ) return null;
  const summary = input.raw.summary.map((statement) => (
    parseStatement(statement, allowedAll, input.built, {
      min: isMain ? NATAL_REPORT_MAIN_PARAGRAPH_MIN_CHARS : 45,
      max: isMain ? NATAL_REPORT_MAIN_PARAGRAPH_MAX_CHARS : 300,
      maxSentences: 2,
    })
  ));
  const observations = input.raw.observations.map((statement) => (
    parseStatement(statement, allowedAll, input.built, { min: 35, max: 150, maxSentences: 1 })
  ));
  if (summary.some((item) => item == null) || observations.some((item) => item == null)) return null;
  if (
    isMain
    && !isNatalReportMainSummaryLengthAllowed(
      (summary as NatalReportStatement[]).map((item) => item.text),
    )
  ) return null;
  if (!Array.isArray(input.raw.previews) || input.raw.previews.length !== previewKeys.length) {
    return null;
  }
  const rawPreviewByKey = new Map(
    input.raw.previews.map((preview) => [text(preview.answer_key), preview]),
  );
  if (rawPreviewByKey.size !== previewKeys.length) return null;
  const previews = previewKeys.map((answerKey) => {
    const raw = rawPreviewByKey.get(answerKey);
    const plan = planByKey.get(answerKey);
    const definition = getNatalReportAnswer(answerKey);
    if (!raw || !plan || !definition) return null;
    const previewText = text(raw.preview);
    const evidenceIds = parsedEvidenceIds(raw.evidence_ids, new Set(plan.evidenceIds));
    if (
      !evidenceIds
      || previewText.length < 55
      || previewText.length > 150
      || sentenceCount(previewText) > 1
      || !isCopyAllowed(previewText, input.built)
    ) return null;
    return {
      answerKey,
      title: localizeNatalReportText(definition.title, input.language),
      preview: previewText,
      evidenceIds,
      access: definition.access,
      related: definition.related,
      fullAnswerIncludes: localizeNatalReportList(definition.fullAnswerIncludes, input.language),
    };
  });
  if (previews.some((preview) => preview == null)) return null;
  const parsedPreviews = previews as NatalReportCategoryPack['previews'];
  if (
    new Set(parsedPreviews.map((preview) => normalizedCopy(preview.preview))).size
      !== parsedPreviews.length
  ) return null;
  const freeKeys = category.answerKeys.filter(isNatalReportAnswerFree);
  if (!Array.isArray(input.raw.free_answers) || input.raw.free_answers.length !== freeKeys.length) {
    return null;
  }
  const rawAnswerByKey = new Map(
    input.raw.free_answers.map((answer) => [text(answer.answer_key), answer]),
  );
  if (rawAnswerByKey.size !== freeKeys.length) return null;
  const freeAnswers = freeKeys.map((answerKey) => {
    const plan = planByKey.get(answerKey);
    return plan
      ? parseAnswer(rawAnswerByKey.get(answerKey), answerKey, plan, input.built, input.language)
      : null;
  });
  if (freeAnswers.some((answer) => answer == null)) return null;
  return {
    schemaVersion: 'natal-report-category-v1',
    contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
    categoryKey: category.key,
    title: localizeNatalReportText(category.title, input.language),
    summary: summary as NatalReportStatement[],
    observations: observations as NatalReportStatement[],
    previews: parsedPreviews,
    freeAnswers: freeAnswers as NatalReportAnswer[],
  };
}

export function materializeNatalReportAnswer(input: {
  raw: RawNatalReportAnswerPayload;
  built: BuiltNatalModelContext;
  answerKey: NatalReportAnswerKey;
  language: 'ru' | 'en';
}): NatalReportAnswer | null {
  return parseAnswer(
    input.raw,
    input.answerKey,
    resolveNatalReportAnswerEvidence(input.built, input.answerKey),
    input.built,
    input.language,
  );
}

export async function generateNatalReportCategoryPack(input: {
  profile: UserProfile;
  chart: NatalChartData | NatalChartDataV2;
  categoryKey: NatalReportCategoryKey;
  mainAnchor?: NatalReportCategoryPack | null;
  requestStructured?: StructuredRequester;
}): Promise<NatalReportCategoryPack> {
  const language: 'ru' | 'en' = input.profile.language === 'en' ? 'en' : 'ru';
  const built = buildNatalReportCatalogContext(input.profile, input.chart);
  const basePrompt = buildNatalReportCategoryPrompt({
    language,
    built,
    categoryKey: input.categoryKey,
    mainAnchor: input.mainAnchor,
  });
  let validationIssues: string[] = [];
  for (let attempt = 1; attempt <= NATAL_REPORT_SEMANTIC_ATTEMPTS; attempt += 1) {
    const { result } = await callStructuredWithBudgetRetry({
      instructions: getNatalReportCatalogSystemPrompt(language),
      input: attempt === 1
        ? basePrompt
        : buildSemanticRepairPrompt(basePrompt, validationIssues, language),
      maxOutputTokens: 2400,
      store: false,
      reasoningEffort: 'low',
      verbosity: 'low',
      schemaName: 'natal_report_category_' + input.categoryKey,
      schema: buildNatalReportCategorySchema(input.categoryKey),
    }, [2400, 3600], undefined, {
      incompleteErrorCode: 'NATAL_REPORT_CATEGORY_PROVIDER_INCOMPLETE',
      request: input.requestStructured,
    });
    const raw = parseJson<RawNatalReportCategoryPayload>(result.content);
    const report = materializeNatalReportCategoryPack({
      raw,
      built,
      categoryKey: input.categoryKey,
      language,
    });
    if (report) return report;
    validationIssues = getNatalReportCategoryValidationIssues({
      raw,
      built,
      categoryKey: input.categoryKey,
    });
    if (validationIssues.length === 0) validationIssues = ['SEMANTIC_CONTRACT_INVALID'];
    console.warn('[natal/catalog-validation]', JSON.stringify({
      kind: 'category',
      categoryKey: input.categoryKey,
      semanticAttempt: attempt,
      responseId: result.responseId,
      validationIssues,
    }));
  }
  throw new Error(
    'NATAL_REPORT_CATEGORY_VALIDATION_FAILED:' + validationIssues.join(','),
  );
}

export async function generateNatalReportAnswer(input: {
  profile: UserProfile;
  chart: NatalChartData | NatalChartDataV2;
  answerKey: NatalReportAnswerKey;
  preview?: string | null;
  mainAnchor?: NatalReportCategoryPack | null;
  requestStructured?: StructuredRequester;
}): Promise<NatalReportAnswer> {
  const language: 'ru' | 'en' = input.profile.language === 'en' ? 'en' : 'ru';
  const built = buildNatalReportCatalogContext(input.profile, input.chart);
  const basePrompt = buildNatalReportAnswerPrompt({
    language,
    built,
    answerKey: input.answerKey,
    preview: input.preview,
    mainAnchor: input.mainAnchor,
  });
  let validationIssues: string[] = [];
  for (let attempt = 1; attempt <= NATAL_REPORT_SEMANTIC_ATTEMPTS; attempt += 1) {
    const { result } = await callStructuredWithBudgetRetry({
      instructions: getNatalReportCatalogSystemPrompt(language),
      input: attempt === 1
        ? basePrompt
        : buildSemanticRepairPrompt(basePrompt, validationIssues, language),
      maxOutputTokens: 1400,
      store: false,
      reasoningEffort: 'low',
      verbosity: 'low',
      schemaName: 'natal_report_answer_' + input.answerKey,
      schema: buildNatalReportAnswerSchema(input.answerKey),
    }, [1400, 2200], undefined, {
      incompleteErrorCode: 'NATAL_REPORT_ANSWER_PROVIDER_INCOMPLETE',
      request: input.requestStructured,
    });
    const raw = parseJson<RawNatalReportAnswerPayload>(result.content);
    const report = materializeNatalReportAnswer({
      raw,
      built,
      answerKey: input.answerKey,
      language,
    });
    if (report) return report;
    validationIssues = getNatalReportAnswerValidationIssues({
      raw,
      built,
      answerKey: input.answerKey,
    });
    if (validationIssues.length === 0) validationIssues = ['SEMANTIC_CONTRACT_INVALID'];
    console.warn('[natal/catalog-validation]', JSON.stringify({
      kind: 'answer',
      answerKey: input.answerKey,
      semanticAttempt: attempt,
      responseId: result.responseId,
      validationIssues,
    }));
  }
  throw new Error(
    'NATAL_REPORT_ANSWER_VALIDATION_FAILED:' + validationIssues.join(','),
  );
}
