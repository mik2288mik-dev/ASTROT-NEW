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
  resolveNatalReportNarrativeEvidence,
  type NatalReportAnswerEvidencePlan,
} from './reportCatalogEvidence';

type RawStatement = {
  text?: unknown;
  evidence_ids?: unknown;
};

type RawNarrativeStatement = RawStatement & { focus?: unknown };

export const NATAL_REPORT_NARRATIVE_FOCI: Record<NatalReportCategoryKey, readonly string[]> = {
  main: ['initiative', 'decisions', 'communication', 'closeness', 'work', 'money', 'pleasure', 'disagreement', 'first_impression'],
  character: ['starting', 'deciding', 'changing_course', 'persisting', 'curiosity', 'disagreement', 'ease', 'pressure'],
  love: ['interest', 'approach', 'affection', 'shared_time', 'autonomy', 'disagreement', 'reliability', 'choice'],
  communication: ['first_contact', 'explaining', 'listening', 'humour', 'disagreement', 'criticism', 'requests', 'repairing_contact'],
  work: ['starting', 'pace', 'quality', 'completion', 'teamwork', 'authority', 'initiative', 'routine'],
  money: ['small_purchases', 'large_choices', 'pleasure', 'saving', 'risk', 'naming_price', 'shared_money', 'independence'],
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
  summary?: RawNarrativeStatement[];
  observations?: RawStatement[];
  previews?: RawPreview[] | Partial<Record<NatalReportAnswerKey, Omit<RawPreview, 'answer_key'>>>;
  free_answers?: RawAnswer[];
};

export type RawNatalReportAnswerPayload = RawAnswer;

function categoryPreviews(raw: RawNatalReportCategoryPayload): RawPreview[] {
  if (Array.isArray(raw.previews)) return raw.previews.filter((value) => value && typeof value === 'object');
  if (!raw.previews || typeof raw.previews !== 'object') return [];
  return Object.entries(raw.previews).flatMap(([answerKey, preview]) => (
    preview && typeof preview === 'object' ? [{ ...preview, answer_key: answerKey }] : []
  ));
}

const FORBIDDEN_CATALOG_COPY = /(?:(?:^|[^\p{L}])(?:психолог[\p{L}]*|психическ[\p{L}]*|психотип[\p{L}]*|коуч[\p{L}]*|самовыраж[\p{L}]*|самореализац[\p{L}]*|ценност[\p{L}]*|энерги[\p{L}]*|потенциал[\p{L}]*|рекомендац[\p{L}]*|практик(?:а|и|е|у|ой|ою|ам|ами|ах)?|границ[\p{L}]*|ресурс[\p{L}]*|опор[\p{L}]*|паттерн[\p{L}]*|триггер[\p{L}]*|предназначени[\p{L}]*|карм(?:а|ы|е|у|ой|ою|ею|ам|ами|ах|ическ[\p{L}]*|ичн[\p{L}]*)|вибрац[\p{L}]*|мисси[\p{L}]*|проработ[\p{L}]*|psycholog(?:y|ies|ical|ically|ist|ists)|coach(?:es|ed|ing)?|self(?:-|\s)?express(?:ion|ions|ive|ively)|self-actuali[sz][\p{L}]*|self-reali[sz][\p{L}]*|values|(?:personal|core)\s+value|energ(?:y|ies|etic|etically)|potential(?:s|ly)?|recommend(?:ation|ations|ed|ing|s)?|practic(?:e|es|ed|ing)|practis(?:e|es|ed|ing)|boundar(?:y|ies)|resources?|support(?:s|ed|ing|ive)?|patterns?|triggers?|triggered|triggering|destiny|karma|karmic|vibration|mission)(?:$|[^\p{L}])|позволь\s+себе|тебе\s+важно\s+научиться|важно\s+научиться|прислушайся\s+к\s+себе|чувствуешь\s+глубже|снаружи[^.!?]{0,80}внутри|inner\s+resource|support\s+point|work\s+through|allow\s+yourself|learn\s+to|listen\s+to\s+yourself)/iu;
const CHANGING_TIME_COPY = /(?:(?:^|[^\p{L}])(?:сегодня|завтра|скоро|на этой неделе|в этом месяце|в этом году|тебя жд[её]т|обязательно произойд[её]т|today|tomorrow|soon|this week|this month|this year|you will definitely|awaits you)(?:$|[^\p{L}])|(?:^|[^\p{N}])20\d{2}(?:$|[^\p{N}]))/iu;
const OFFICE_NARRATIVE_COPY = /(?:трезв[\p{L}]*\s+отбор|(?:^|[^\p{L}])подвижност[\p{L}]*|довод[\p{L}]*\s+начат[\p{L}]*\s+до\s+форм[\p{L}]*|планк[\p{L}]*\s+качеств[\p{L}]*|профессиональн[\p{L}]*\s+позици[\p{L}]*|имеет\s+продолжение\s+в\s+реальном\s+деле|интерес\s+легко\s+опередит\s+результат|^\s*(?:в\s+итоге|таким\s+образом)(?=$|[^\p{L}]))/iu;

export const NATAL_REPORT_MAIN_SUMMARY_MIN_WORDS = 350;
export const NATAL_REPORT_MAIN_SUMMARY_MAX_WORDS = 500;
export const NATAL_REPORT_CATEGORY_SUMMARY_MIN_WORDS = 300;
export const NATAL_REPORT_CATEGORY_SUMMARY_MAX_WORDS = 450;
const NATAL_REPORT_NARRATIVE_MIN_PARAGRAPHS = 5;
const NATAL_REPORT_NARRATIVE_MAX_PARAGRAPHS = 8;
const NATAL_REPORT_NARRATIVE_PARAGRAPH_MIN_CHARS = 80;
const NATAL_REPORT_NARRATIVE_PARAGRAPH_MAX_CHARS = 1200;
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
  return FORBIDDEN_CATALOG_COPY.test(value) || CHANGING_TIME_COPY.test(value)
    || OFFICE_NARRATIVE_COPY.test(value);
}

export function isNatalReportMainSummaryLengthAllowed(values: readonly string[]): boolean {
  return isNatalReportNarrativeLengthAllowed(values, 'main');
}

function wordCount(values: readonly string[]): number {
  return values.reduce((sum, value) => (
    sum + (value.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu)?.length || 0)
  ), 0);
}

function narrativeWordLimits(categoryKey: NatalReportCategoryKey): [number, number] {
  return categoryKey === 'main'
    ? [NATAL_REPORT_MAIN_SUMMARY_MIN_WORDS, NATAL_REPORT_MAIN_SUMMARY_MAX_WORDS]
    : [NATAL_REPORT_CATEGORY_SUMMARY_MIN_WORDS, NATAL_REPORT_CATEGORY_SUMMARY_MAX_WORDS];
}

export function isNatalReportNarrativeLengthAllowed(
  values: readonly string[],
  categoryKey: NatalReportCategoryKey,
): boolean {
  const [min, max] = narrativeWordLimits(categoryKey);
  const words = wordCount(values);
  return values.length >= NATAL_REPORT_NARRATIVE_MIN_PARAGRAPHS
    && values.length <= NATAL_REPORT_NARRATIVE_MAX_PARAGRAPHS
    && words >= min && words <= max;
}

function hasRepeatedNarrativeCopy(values: readonly string[]): boolean {
  const paragraphs = values.map(normalizedCopy);
  if (new Set(paragraphs).size !== paragraphs.length) return true;
  const sentences = values.flatMap((value) => value.split(/(?<=[.!?])\s+/u))
    .map(normalizedCopy).filter((value) => value.length >= 40);
  return new Set(sentences).size !== sentences.length;
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

function narrativeStatementSchema(categoryKey: NatalReportCategoryKey) {
  const statement = statementSchema(
    NATAL_REPORT_NARRATIVE_PARAGRAPH_MIN_CHARS,
    NATAL_REPORT_NARRATIVE_PARAGRAPH_MAX_CHARS,
  );
  return {
    ...statement,
    properties: { ...statement.properties, focus: { type: 'string', enum: NATAL_REPORT_NARRATIVE_FOCI[categoryKey] } },
    required: [...statement.required, 'focus'],
  };
}

export function buildNatalReportCategorySchema(
  categoryKey: NatalReportCategoryKey,
): StrictJsonSchema {
  const category = getNatalReportCategory(categoryKey);
  if (!category) throw new Error('NATAL_REPORT_CATEGORY_NOT_FOUND');
  const previewKeys: readonly NatalReportAnswerKey[] = categoryKey === 'main'
    ? NATAL_REPORT_MAIN_PREVIEW_KEYS
    : [];
  return {
    type: 'object',
    properties: {
      summary: {
        type: 'array',
        minItems: NATAL_REPORT_NARRATIVE_MIN_PARAGRAPHS,
        maxItems: NATAL_REPORT_NARRATIVE_MAX_PARAGRAPHS,
        items: narrativeStatementSchema(categoryKey),
      },
      observations: {
        type: 'array',
        minItems: 0,
        maxItems: 0,
        items: statementSchema(35, 150),
      },
      previews: {
        type: 'object',
        properties: Object.fromEntries(previewKeys.map((key) => [key, {
          type: 'object',
          properties: {
            preview: { type: 'string', minLength: 55, maxLength: 150 },
            evidence_ids: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 10,
            },
          },
          required: ['preview', 'evidence_ids'],
          additionalProperties: false,
        }])),
        required: [...previewKeys],
        additionalProperties: false,
      },
      free_answers: {
        type: 'array',
        minItems: 0,
        maxItems: 0,
        items: answerSchema(category.answerKeys),
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
- Пиши так, как объясняешь человеку вживую. Выбирай простые глаголы и видимые предметы: что сделать, что купить, какой разговор закончить, какую работу сдать. Большинство предложений короткие или средней длины; длинное нужно только для мысли, которой тесно в коротком. Не заменяй конкретное действие красивым названием качества.
- Никакого офисного и книжного пересказа: «трезвый отбор», «подвижность», «доводить начатое до формы», «планка качества», «профессиональная позиция», «продолжение в реальном деле». Если фразу трудно произнести в обычном разговоре, перепиши её проще.
- Минипары редактуры показывают ТОЛЬКО ясность языка, а не факты о читателе: «окончательная профессиональная позиция строится на последовательности» → «держишь слово и сдаёшь работу в срок»; «интерес легко опередит результат» → «начать легче, чем закончить»; «результат приобретает завершённую форму» → «работа готова, её можно показать». Не копируй эти выводы, ситуации или слова в разбор без собственных оснований в переданных фактах.
- Начни с одного узнаваемого вывода, который отличает именно эту карту. Дальше развивай мысль: как один способ действовать помогает в одной ситуации и усложняет другую. Связывай наблюдения, не составляй перечень качеств.
- Вместо «в тебе есть», «тебе свойственно», «для тебя важно», «твоя речь устроена интересно» сразу назови действие и условие: что человек начинает, выбирает, отказывается делать или доводит до конца и когда. Не объясняй одно и то же качество новыми словами в соседних абзацах.
- Пиши цельный рассказ с разным ритмом абзацев и предложений. Не повторяй в каждом абзаце схему «вывод, пример, оговорка». Уверенность, удовольствие, лёгкость и удачные решения столь же важны, как трудности; выбирай их по данным, без обязательного конфликта.
- Возможный бытовой пример — иллюстрация вывода, а не случившийся эпизод. Не приписывай человеку чувства, мысли других людей, пережитые события, профессию, отношения, детство или скрытые причины поведения. При ограниченных данных сужай вывод.
- Допустима максимум одна точная шутка во всём рассказе, если она вырастает из наблюдения. Шутка необязательна; без насмешки над человеком и без готовых острот для любой карты.
- Последний абзац заканчивает последнюю мысль, а не повторяет весь разбор. Без «В итоге», «Таким образом», списка качеств и торжественного вывода о личности. Нужный объём даёт новая мысль, а не ещё одно объяснение уже сказанного.
- Никакой психологии, коучинга, воспитания, мистики и астрологического языка. Не используй «ресурс», «опора», «границы», «паттерн», «потенциал», «энергия», «предназначение» и похожие слова.
- Вообще не называй планеты, знаки, дома, аспекты, градусы, углы, асцендент или MC. Не упоминай сегодня, завтра, даты и будущие события.
- Не используй готовые обороты «это про тебя», «считывается», «проверка фактов», «что стоит заметить», «внутренняя точность» и рекламные недосказанности.
- Не используй слова «ценность», «ценности» и схему «с одной стороны — с другой стороны». Скажи конкретно, что человек выбирает, проверяет или делает.
- Не пиши советы, практики, диагнозы, обещания, биографию и будущие события.
- Не используй универсальные формулы вроде «чувствуешь глубже, чем показываешь», «снаружи один, внутри другой» или «тебя не всегда понимают».
 - Preview — одно короткое законченное предложение с персональным выводом. Полный ответ — 3–5 коротких абзацев, первый абзац самый сильный.
- Каждый абзац возвращает только те разрешённые evidence_ids, которые обосновывают его конкретный вывод. Объясняй связь между наблюдениями в самом рассказе; отдельная кнопка «Почему» покажет рассчитанные факты. Набор всех фактов под каждым абзацем не считается обоснованием.
- Верни каждый указанный answer_key ровно один раз, без пропусков и дублей.
- В полном бесплатном ответе сумма evidence_ids всех абзацев обязана включать каждый required_evidence_id этого ответа.
- Ответ только JSON, без Markdown.`
    : `TASK
- Write directly, vividly, and in ordinary words. Address the reader as “you”.
- Write as if explaining this to someone in person: simple verbs, recognizable things, mostly short and medium sentences. Name the action, purchase, conversation, or finished piece of work, rather than giving a quality an impressive label.
- Avoid office prose and abstract summaries such as professional positioning, dynamic adaptability, quality thresholds, or translating intention into tangible outcomes. If a sentence sounds unnatural spoken aloud, simplify it.
- These editing pairs demonstrate clarity ONLY, never facts about the reader: “professional positioning rests on consistency” → “you keep your word and finish work on time”; “interest can outpace the outcome” → “starting is easier than finishing”; “the result attains its completed form” → “the work is ready to show”. Do not copy these claims, situations, or phrases without independent support in the supplied evidence.
- Open with one recognizable conclusion specific to this chart. Develop how the same way of acting helps in one situation and complicates another. Connect observations instead of listing traits.
- Replace “you have”, “you are someone who”, or “what matters to you” introductions with an action and its circumstances: what the person starts, chooses, declines, or completes, and when. Do not restate the same trait in neighbouring paragraphs.
- Write a continuous reading with varied paragraph and sentence lengths. Do not repeat a conclusion/example/qualification template. Include ease, enjoyment, confidence, and successful choices when supported; conflict is not obligatory.
- Everyday examples illustrate possibilities, not events that happened. Do not invent feelings, other people's thoughts, biography, relationships, occupation, childhood, or hidden causes. Narrow claims when the evidence is limited.
- At most one precise, affectionate joke may grow from an observation in the whole reading. Humour is optional; no ridicule or recycled jokes for every chart.
- Let the last paragraph finish its own thought instead of recapping the entire reading. No “in conclusion”, list of traits, or grand statement about the person. Reach the requested length with distinct ideas, not restatements.
- No psychology, coaching, instruction, mysticism, or visible astrology. Avoid report jargon such as resource, support point, boundaries, pattern, potential, energy, or destiny.
- Never name planets, signs, houses, aspects, degrees, angles, Ascendant, or MC. Mention no current dates or future events.
- Avoid canned phrases, pseudo-insight, report language, and advertising cliffhangers.
- Do not give advice, practices, diagnoses, promises, biography, or future events.
- Avoid universal formulas such as “you feel more deeply than you show” or “one way outside, another inside”.
 - A preview is one short, complete sentence with a personal conclusion. A full answer is 3–5 short paragraphs, with the strongest paragraph first.
- Each paragraph cites only allowed evidence_ids that support its specific conclusion. Explain how observations connect inside the reading; a separate Why control shows calculated facts. Attaching every fact to every paragraph is not grounding.
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
    : [];
  const plans = resolveNatalReportCategoryEvidence(input.built, input.categoryKey);
  const narrativeEvidence = resolveNatalReportNarrativeEvidence(input.built, input.categoryKey);
  const isMain = input.categoryKey === 'main';
  const task = input.language === 'ru'
    ? `${isMain
      ? `Напиши законченный бесплатный разбор на 2–3 минуты чтения: summary содержит 5–8 связанных абзацев, всего ${NATAL_REPORT_MAIN_SUMMARY_MIN_WORDS}–${NATAL_REPORT_MAIN_SUMMARY_MAX_WORDS} слов. Найди главную линию этой карты и раскрой её через несколько разных, обоснованных наблюдений. Это полноценный рассказ, а не тизер Premium.`
      : `Напиши самостоятельную подробную главу «${localizeNatalReportText(category.title, 'ru')}»: summary содержит 5–8 связанных абзацев, всего ${NATAL_REPORT_CATEGORY_SUMMARY_MIN_WORDS}–${NATAL_REPORT_CATEGORY_SUMMARY_MAX_WORDS} слов. Продолжи главную линию из MAIN READING ANCHOR применительно к этой теме, с новыми выводами и ситуациями. Не пересказывай вступление и не повторяй готовые фразы. Читатель сразу получает главу, без выбора вопроса.`}
Длину абзаца выбирай по мысли, не выравнивай абзацы. Наблюдения входят в рассказ: observations верни пустым массивом. Заверши мысль без списка качеств, морали и совета.
Каждый абзац получает служебный focus из разрешённого набора; читатель его не увидит. Выбери минимум четыре действительно разные области по основаниям этой карты, не более двух абзацев на один focus. Не нужно охватывать весь набор или сводить весь портрет к общительности, скорости ответа и первому впечатлению. Следующий абзац добавляет новое наблюдение, а не новый синоним прежнего.
Для summary выбирай только narrative_evidence_ids. Используй несколько разных фактов, но не пытайся охватить весь список или все вопросы каталога. Если основание одно, не делай из него несколько одинаковых выводов.
${isMain ? 'Дополнительно верни объект previews с указанными ключами для перехода к подробным главам. Каждый preview — законченный персональный вывод без рекламной интриги; не копируй предложение из рассказа. free_answers верни пустым массивом: отдельные ответы сейчас не нужны.' : 'previews верни пустым объектом, free_answers — пустым массивом: сейчас пишется одна глава, а не ответы на все вопросы.'}`
    : `${isMain
      ? `Write a complete free reading taking 2–3 minutes: summary contains 5–8 connected paragraphs, ${NATAL_REPORT_MAIN_SUMMARY_MIN_WORDS}–${NATAL_REPORT_MAIN_SUMMARY_MAX_WORDS} words total. Develop the chart's central thread through several distinct supported observations. This is a satisfying reading, not a Premium teaser.`
      : `Write a full chapter on ${localizeNatalReportText(category.title, 'en')}: summary contains 5–8 connected paragraphs, ${NATAL_REPORT_CATEGORY_SUMMARY_MIN_WORDS}–${NATAL_REPORT_CATEGORY_SUMMARY_MAX_WORDS} words total. Continue MAIN READING ANCHOR in this area with new conclusions and situations, without repeating its opening or sentences. The reader receives the chapter immediately, without choosing a question.`}
Let each thought determine paragraph length. Weave observations into the reading and return observations as an empty array. Close the thought without a trait list, moral, or advice.
Give each paragraph an internal focus from the allowed set; it is never shown to the reader. Choose at least four genuinely different areas supported by this chart, at most two paragraphs per focus. Do not cover the entire set or reduce the whole reading to sociability, response speed, and first impressions. Each next paragraph adds a new observation, not a synonym for the previous one.
Use only narrative_evidence_ids for summary. Draw on several different facts, without trying to cover every fact or catalog question. Do not turn one fact into several repeated conclusions.
${isMain ? 'Also return a previews object with the listed keys for links to full chapters. Each preview gives a complete personal conclusion without a cliffhanger; do not copy a sentence from the reading. Return free_answers as an empty array: individual answers are not needed now.' : 'Return previews as an empty object and free_answers as an empty array: write one chapter, not answers to every question.'}`;
  const anchor = input.mainAnchor && input.categoryKey !== 'main'
    ? {
        summary: input.mainAnchor.summary.map((item) => item.text),
      }
    : null;
  return `${task}

CATEGORY:
${JSON.stringify({
    category_key: category.key,
    title: localizeNatalReportText(category.title, input.language),
    narrative_focus_options: NATAL_REPORT_NARRATIVE_FOCI[input.categoryKey],
  }, null, 2)}

${anchor ? `MAIN READING ANCHOR — KEEP THE SAME PERSON, DO NOT COPY IT:\n${JSON.stringify(anchor, null, 2)}\n\n` : ''}CALCULATED EVIDENCE:
${JSON.stringify(buildNatalReportEvidencePromptContext(input.built, [], narrativeEvidence), null, 2)}

${isMain ? `OPTIONAL CONTINUATION LINKS — NOT THE READING PLAN:\n${JSON.stringify(previewKeys.map((key) => ({
    key,
    category: getNatalReportAnswer(key)?.categoryKey === 'main' ? 'character' : getNatalReportAnswer(key)?.categoryKey,
    allowed_evidence_ids: plans.find((plan) => plan.answerKey === key)?.evidenceIds || [],
  })), null, 2)}` : ''}`;
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

function narrativeValidationIssues(
  summary: readonly RawNarrativeStatement[],
  built: BuiltNatalModelContext,
  categoryKey: NatalReportCategoryKey,
): string[] {
  const issues: string[] = [];
  const values = summary.map((statement) => text(statement?.text));
  const [minWords, maxWords] = narrativeWordLimits(categoryKey);
  const words = wordCount(values);
  if (words < minWords) issues.push('SUMMARY_WORDS_TOO_SHORT:' + words);
  if (words > maxWords) issues.push('SUMMARY_WORDS_TOO_LONG:' + words);
  if (
    summary.length < NATAL_REPORT_NARRATIVE_MIN_PARAGRAPHS
    || summary.length > NATAL_REPORT_NARRATIVE_MAX_PARAGRAPHS
    || values.some((value) => value.length < NATAL_REPORT_NARRATIVE_PARAGRAPH_MIN_CHARS
      || value.length > NATAL_REPORT_NARRATIVE_PARAGRAPH_MAX_CHARS)
  ) issues.push('SUMMARY_SHAPE_INVALID');
  if (hasRepeatedNarrativeCopy(values)) issues.push('SUMMARY_REPEATED_COPY');
  const focusCounts = new Map<string, number>();
  for (const statement of summary) {
    const focus = text(statement?.focus);
    if (!NATAL_REPORT_NARRATIVE_FOCI[categoryKey].includes(focus)) issues.push('SUMMARY_FOCUS_INVALID');
    else focusCounts.set(focus, (focusCounts.get(focus) || 0) + 1);
  }
  if (focusCounts.size < 4 || [...focusCounts.values()].some((count) => count > 2)) {
    issues.push('SUMMARY_FOCUS_REPEATED');
  }
  const allowed = new Set(resolveNatalReportNarrativeEvidence(built, categoryKey).map((fact) => fact.id));
  const cited = summary.map((statement) => parsedEvidenceIds(statement?.evidence_ids, allowed));
  if (cited.some((ids) => ids == null)) issues.push('SUMMARY_EVIDENCE_INVALID');
  const used = new Set(cited.flatMap((ids) => ids || []));
  if (used.size < Math.min(3, allowed.size)) issues.push('SUMMARY_EVIDENCE_TOO_NARROW');
  return issues;
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
  const summary = Array.isArray(input.raw.summary) ? input.raw.summary : [];
  const observations = Array.isArray(input.raw.observations) ? input.raw.observations : [];
  const previews = categoryPreviews(input.raw);
  issues.push(...narrativeValidationIssues(summary, input.built, input.categoryKey));
  if (observations.length !== 0) {
    issues.push('OBSERVATION_COUNT_INVALID');
  }

  const expectedPreviewKeys: readonly NatalReportAnswerKey[] = isMain
    ? NATAL_REPORT_MAIN_PREVIEW_KEYS
    : [];
  const actualPreviewKeys = previews.map((preview) => text(preview?.answer_key));
  if (
    actualPreviewKeys.length !== expectedPreviewKeys.length
    || new Set(actualPreviewKeys).size !== expectedPreviewKeys.length
    || expectedPreviewKeys.some((key) => !actualPreviewKeys.includes(key))
  ) {
    issues.push('PREVIEW_KEYS_INVALID');
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
  const allowedAll = new Set(resolveNatalReportNarrativeEvidence(input.built, input.categoryKey).map((fact) => fact.id));
  const isMain = input.categoryKey === 'main';
  const previewKeys: readonly NatalReportAnswerKey[] = isMain
    ? NATAL_REPORT_MAIN_PREVIEW_KEYS
    : [];
  if (!Array.isArray(input.raw.summary) || !Array.isArray(input.raw.observations)) return null;
  if (
    narrativeValidationIssues(input.raw.summary, input.built, input.categoryKey).length > 0
    || input.raw.observations.length !== 0
  ) return null;
  const summary = input.raw.summary.map((statement) => (
    parseStatement(statement, allowedAll, input.built, {
      min: NATAL_REPORT_NARRATIVE_PARAGRAPH_MIN_CHARS,
      max: NATAL_REPORT_NARRATIVE_PARAGRAPH_MAX_CHARS,
    })
  ));
  const observations = input.raw.observations.map((statement) => (
    parseStatement(statement, allowedAll, input.built, { min: 35, max: 150, maxSentences: 1 })
  ));
  if (summary.some((item) => item == null) || observations.some((item) => item == null)) return null;
  const rawPreviewByKey = new Map(
    categoryPreviews(input.raw).map((preview) => [text(preview.answer_key), preview]),
  );
  // Auxiliary links can fall back to chapter labels; a bad link must not discard a valid reading.
  const previews = previewKeys.flatMap((answerKey) => {
    const raw = rawPreviewByKey.get(answerKey);
    const plan = planByKey.get(answerKey);
    const definition = getNatalReportAnswer(answerKey);
    if (!raw || !plan || !definition) return [];
    const previewText = text(raw.preview);
    const evidenceIds = parsedEvidenceIds(raw.evidence_ids, new Set(plan.evidenceIds));
    if (
      !evidenceIds
      || previewText.length < 55
      || previewText.length > 150
      || sentenceCount(previewText) > 1
      || !isCopyAllowed(previewText, input.built)
    ) return [];
    return [{
      answerKey,
      title: localizeNatalReportText(definition.title, input.language),
      preview: previewText,
      evidenceIds,
      access: definition.access,
      related: definition.related,
      fullAnswerIncludes: localizeNatalReportList(definition.fullAnswerIncludes, input.language),
    }];
  });
  const seenPreviews = new Set<string>();
  const parsedPreviews = previews.filter((preview) => {
    const normalized = normalizedCopy(preview.preview);
    if (seenPreviews.has(normalized)) return false;
    seenPreviews.add(normalized);
    return true;
  });
  return {
    schemaVersion: 'natal-report-category-v1',
    contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
    categoryKey: category.key,
    title: localizeNatalReportText(category.title, input.language),
    summary: summary as NatalReportStatement[],
    observations: observations as NatalReportStatement[],
    previews: parsedPreviews,
    freeAnswers: [],
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
      maxOutputTokens: input.categoryKey === 'main' ? 6000 : 4000,
      store: false,
      reasoningEffort: 'low',
      verbosity: 'low',
      schemaName: 'natal_report_category_' + input.categoryKey,
      schema: buildNatalReportCategorySchema(input.categoryKey),
    }, input.categoryKey === 'main' ? [6000, 8500] : [4000, 6000], undefined, {
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
