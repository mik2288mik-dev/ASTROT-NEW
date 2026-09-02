export * from './reportCatalogGenerationBase';

import type { NatalChartData, UserProfile } from '../../types';
import type { NatalChartDataV2 } from '../natalChartV2Types';
import {
  callStructuredWithBudgetRetry,
} from '../openaiResponses';
import {
  hasNatalPersonalityCopyViolation,
  isNatalReliabilityTextAllowed,
  type BuiltNatalModelContext,
} from './permanentReport';
import {
  buildNatalReportCatalogContext,
} from './reportCatalogEvidence';
import type {
  NatalReportAnswer,
  NatalReportAnswerKey,
  NatalReportCategoryKey,
  NatalReportCategoryPack,
} from './reportCatalog';
import {
  buildNatalReportAnswerPrompt,
  buildNatalReportAnswerSchema,
  buildNatalReportCategoryPrompt,
  buildNatalReportCategorySchema,
  getNatalReportAnswerValidationIssues,
  getNatalReportCatalogSystemPrompt,
  getNatalReportCategoryValidationIssues,
  hasNatalReportCatalogCopyViolation,
  materializeNatalReportAnswer,
  materializeNatalReportCategoryPack,
  type RawNatalReportAnswerPayload,
  type RawNatalReportCategoryPayload,
} from './reportCatalogGenerationBase';

const NATAL_REPORT_REPAIR_ATTEMPTS = 3;

type StructuredRequester = Exclude<
  NonNullable<Parameters<typeof callStructuredWithBudgetRetry>[3]>['request'],
  undefined
>;

type TextFieldIssue = {
  path: string;
  reasons: string[];
};

const VISIBLE_ASTROLOGY = /(?:(?:^|[^\p{L}])(?:асцендент[\p{L}]*|десцендент[\p{L}]*|ретроград[\p{L}]*|куспид[\p{L}]*|орб[\p{L}]*|солнц[\p{L}]*|лун[\p{L}]*|меркур[\p{L}]*|венер[\p{L}]*|марс[\p{L}]*|юпитер[\p{L}]*|сатурн[\p{L}]*|уран[\p{L}]*|нептун[\p{L}]*|плутон[\p{L}]*|хирон[\p{L}]*|узел[\p{L}]*|соединени[\p{L}]*|секстил[\p{L}]*|квадрат[\p{L}]*|трин[\p{L}]*|оппозиц[\p{L}]*)(?=$|[^\p{L}])|\b(?:ascendant|midheaven|retrograde|sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|chiron|node|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|conjunction|sextile|square|trine|opposition)\b)/iu;
const COACHING_OR_ADVICE = /(?:позволь\s+себе|прислушайся|тебе\s+(?:важно|нужно|стоит)|(?:^|[^\p{L}])(?:попробуй|старайся|практикуй)(?=$|[^\p{L}])|отпусти\s+контрол|allow\s+yourself|listen\s+to\s+yourself|you\s+(?:need|ought)\s+to|try\s+to|practice)/iu;
const FORBIDDEN_JARGON = /(?:(?:^|[^\p{L}])(?:психолог[\p{L}]*|психотип[\p{L}]*|коуч[\p{L}]*|энерги[\p{L}]*|ресурс[\p{L}]*|опор[\p{L}]*|границ[\p{L}]*|паттерн[\p{L}]*|триггер[\p{L}]*|потенциал[\p{L}]*|предназначени[\p{L}]*|карм[\p{L}]*|вибрац[\p{L}]*|мисси[\p{L}]*|проработ[\p{L}]*|самореализац[\p{L}]*)(?=$|[^\p{L}])|внутренн(?:ий|его)\s+мир|\b(?:psycholog\w*|coach\w*|energy|resources?|support point|boundar\w*|patterns?|triggers?|potential|destiny|karma|vibration|mission|self-realization)\b)/iu;
const TIME_OR_FUTURE = /(?:(?:^|[^\p{L}])(?:сегодня|завтра|скоро)(?=$|[^\p{L}])|на этой неделе|в этом месяце|в этом году|тебя\s+жд[её]т|произойд[её]т|случится|\b(?:today|tomorrow|soon|this week|this month|this year|awaits you|will happen)\b|(?:^|[^\p{N}])20\d{2}(?=$|[^\p{N}]))/iu;

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function parseJson<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error('NATAL_REPORT_CATALOG_INVALID_JSON');
  }
}

function fieldReasons(value: string, built: BuiltNatalModelContext): string[] {
  const reasons: string[] = [];
  if (!value) reasons.push('EMPTY_TEXT');
  if (VISIBLE_ASTROLOGY.test(value)) reasons.push('VISIBLE_ASTROLOGY');
  if (COACHING_OR_ADVICE.test(value)) reasons.push('COACHING_OR_ADVICE');
  if (FORBIDDEN_JARGON.test(value)) reasons.push('FORBIDDEN_JARGON');
  if (TIME_OR_FUTURE.test(value)) reasons.push('TIME_OR_FUTURE');
  if (!isNatalReliabilityTextAllowed(value, built)) reasons.push('UNRELIABLE_ANGLE_OR_HOUSE');
  if (
    value
    && hasNatalPersonalityCopyViolation(value)
    && reasons.length === 0
  ) reasons.push('APP_VOICE_OR_PERSONALITY_COPY');
  if (
    value
    && hasNatalReportCatalogCopyViolation(value)
    && !reasons.includes('FORBIDDEN_JARGON')
    && !reasons.includes('TIME_OR_FUTURE')
  ) reasons.push('CATALOG_COPY_POLICY');
  return unique(reasons);
}

function categoryTextFields(raw: RawNatalReportCategoryPayload): Array<{ path: string; value: string }> {
  const result: Array<{ path: string; value: string }> = [];
  const summary = Array.isArray(raw.summary) ? raw.summary : [];
  const observations = Array.isArray(raw.observations) ? raw.observations : [];
  const previews = Array.isArray(raw.previews) ? raw.previews : [];
  const answers = Array.isArray(raw.free_answers) ? raw.free_answers : [];

  summary.forEach((item, index) => result.push({
    path: `summary[${index}].text`,
    value: text(item?.text),
  }));
  observations.forEach((item, index) => result.push({
    path: `observations[${index}].text`,
    value: text(item?.text),
  }));
  previews.forEach((item, index) => result.push({
    path: `previews[${text(item?.answer_key) || index}].preview`,
    value: text(item?.preview),
  }));
  answers.forEach((answer, answerIndex) => {
    const paragraphs = Array.isArray(answer?.paragraphs) ? answer.paragraphs : [];
    paragraphs.forEach((paragraph, paragraphIndex) => result.push({
      path: `free_answers[${text(answer?.answer_key) || answerIndex}].paragraphs[${paragraphIndex}].text`,
      value: text(paragraph?.text),
    }));
  });
  return result;
}

function answerTextFields(raw: RawNatalReportAnswerPayload): Array<{ path: string; value: string }> {
  const paragraphs = Array.isArray(raw.paragraphs) ? raw.paragraphs : [];
  return paragraphs.map((paragraph, index) => ({
    path: `paragraphs[${index}].text`,
    value: text(paragraph?.text),
  }));
}

function diagnoseTextFields(
  fields: Array<{ path: string; value: string }>,
  built: BuiltNatalModelContext,
): TextFieldIssue[] {
  return fields.flatMap((field) => {
    const reasons = fieldReasons(field.value, built);
    return reasons.length > 0 ? [{ path: field.path, reasons }] : [];
  });
}

function hardenedSystemPrompt(language: 'ru' | 'en'): string {
  const runtimeRules = language === 'ru'
    ? `ПРОВЕРКА ПЕРЕД ОТВЕТОМ
- Ни в одном пользовательском поле не называй планеты, знаки, дома, аспекты, градусы, асцендент, MC или саму астрологию.
- Не используй советы и команды читателю.
- Не используй психологический, коучинговый и эзотерический жаргон.
- Не упоминай текущую дату, ближайшее будущее или обещанные события.
- Проверь каждое поле отдельно. Одна запрещённая фраза отклонит весь JSON.`
    : `FINAL CHECK BEFORE ANSWERING
- Do not name planets, signs, houses, aspects, degrees, the ascendant, MC, or astrology in any user-facing field.
- Give no advice or commands to the reader.
- Use no psychological, coaching, or mystical jargon.
- Mention no current date, near future, or promised event.
- Check every text field separately. One forbidden phrase rejects the complete JSON.`;
  return `${getNatalReportCatalogSystemPrompt(language)}\n\n${runtimeRules}`;
}

function repairPrompt(input: {
  language: 'ru' | 'en';
  basePrompt: string;
  aggregateIssues: string[];
  fieldIssues: TextFieldIssue[];
  previousCandidate: unknown;
}): string {
  const instruction = input.language === 'ru'
    ? `ПРЕДЫДУЩИЙ JSON ОТКЛОНЁН СЕРВЕРОМ.
Перепиши JSON полностью. Не сохраняй формулировки из проблемных полей.
Исправь каждую указанную причину, но не меняй answer_key и используй только разрешённые evidence_ids.
Если причина относится к надёжности, убери из текста любое упоминание угла или дома, а не пытайся его оговорить.`
    : `THE PREVIOUS JSON WAS REJECTED BY THE SERVER.
Rewrite the complete JSON. Do not preserve wording from any flagged field.
Fix every listed reason, keep every answer_key unchanged, and use only allowed evidence_ids.
For a reliability issue, remove every angle or house reference instead of qualifying it.`;
  return `${input.basePrompt}

${instruction}

AGGREGATE_VALIDATION_ISSUES:
${JSON.stringify(input.aggregateIssues, null, 2)}

FIELD_VALIDATION_ISSUES:
${JSON.stringify(input.fieldIssues, null, 2)}

PREVIOUS_CANDIDATE_TO_REWRITE:
${JSON.stringify(input.previousCandidate, null, 2)}`;
}

function safeValidationLog(input: {
  kind: 'category' | 'answer';
  itemKey: string;
  attempt: number;
  aggregateIssues: string[];
  fieldIssues: TextFieldIssue[];
}): void {
  console.warn('[natal-report-validation]', JSON.stringify({
    kind: input.kind,
    itemKey: input.itemKey,
    attempt: input.attempt,
    aggregateIssues: input.aggregateIssues,
    fieldIssues: input.fieldIssues.map((issue) => ({
      path: issue.path,
      reasons: issue.reasons,
    })),
  }));
}

function finalValidationCodes(
  aggregateIssues: string[],
  fieldIssues: TextFieldIssue[],
): string[] {
  return unique([
    ...aggregateIssues,
    ...fieldIssues.flatMap((issue) => (
      issue.reasons.map((reason) => `${issue.path}:${reason}`)
    )),
  ]).slice(0, 16);
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
  let aggregateIssues: string[] = [];
  let fieldIssues: TextFieldIssue[] = [];
  let previousCandidate: RawNatalReportCategoryPayload | null = null;

  for (let attempt = 1; attempt <= NATAL_REPORT_REPAIR_ATTEMPTS; attempt += 1) {
    const { result } = await callStructuredWithBudgetRetry({
      instructions: hardenedSystemPrompt(language),
      input: attempt === 1
        ? basePrompt
        : repairPrompt({
            language,
            basePrompt,
            aggregateIssues,
            fieldIssues,
            previousCandidate,
          }),
      maxOutputTokens: 2800,
      store: false,
      reasoningEffort: 'low',
      verbosity: 'low',
      schemaName: `natal_report_category_${input.categoryKey}`,
      schema: buildNatalReportCategorySchema(input.categoryKey),
    }, [2800, 4000] as const, undefined, {
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

    aggregateIssues = getNatalReportCategoryValidationIssues({
      raw,
      built,
      categoryKey: input.categoryKey,
    });
    if (aggregateIssues.length === 0) aggregateIssues = ['SEMANTIC_CONTRACT_INVALID'];
    fieldIssues = diagnoseTextFields(categoryTextFields(raw), built);
    previousCandidate = raw;
    safeValidationLog({
      kind: 'category',
      itemKey: input.categoryKey,
      attempt,
      aggregateIssues,
      fieldIssues,
    });
  }

  throw new Error(
    `NATAL_REPORT_CATEGORY_VALIDATION_FAILED:${finalValidationCodes(
      aggregateIssues,
      fieldIssues,
    ).join(',')}`,
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
  let aggregateIssues: string[] = [];
  let fieldIssues: TextFieldIssue[] = [];
  let previousCandidate: RawNatalReportAnswerPayload | null = null;

  for (let attempt = 1; attempt <= NATAL_REPORT_REPAIR_ATTEMPTS; attempt += 1) {
    const { result } = await callStructuredWithBudgetRetry({
      instructions: hardenedSystemPrompt(language),
      input: attempt === 1
        ? basePrompt
        : repairPrompt({
            language,
            basePrompt,
            aggregateIssues,
            fieldIssues,
            previousCandidate,
          }),
      maxOutputTokens: 1600,
      store: false,
      reasoningEffort: 'low',
      verbosity: 'low',
      schemaName: `natal_report_answer_${input.answerKey}`,
      schema: buildNatalReportAnswerSchema(input.answerKey),
    }, [1600, 2400] as const, undefined, {
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

    aggregateIssues = getNatalReportAnswerValidationIssues({
      raw,
      built,
      answerKey: input.answerKey,
    });
    if (aggregateIssues.length === 0) aggregateIssues = ['SEMANTIC_CONTRACT_INVALID'];
    fieldIssues = diagnoseTextFields(answerTextFields(raw), built);
    previousCandidate = raw;
    safeValidationLog({
      kind: 'answer',
      itemKey: input.answerKey,
      attempt,
      aggregateIssues,
      fieldIssues,
    });
  }

  throw new Error(
    `NATAL_REPORT_ANSWER_VALIDATION_FAILED:${finalValidationCodes(
      aggregateIssues,
      fieldIssues,
    ).join(',')}`,
  );
}
