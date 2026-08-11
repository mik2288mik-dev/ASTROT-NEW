import type { NatalChartData, UserProfile } from '../types';
import type { NatalChartDataV2 } from './natalChartV2Types';
import { isNatalChartDataV2 } from './natal/canonicalReport';
import {
  APP_VOICE_VERSION,
  getPersonalForecastSystemVoice,
  hasPersonalForecastVoiceViolation,
} from './appVoice';
import {
  createLunaStructuredResponse,
  type StrictJsonSchema,
} from './openaiResponses';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  formatPersonalForecastDateLabel,
  getPersonalForecastPackageValidationError,
  isPersonalForecastPackage,
  selectTodayFreeSections,
  stableHash,
  type CrossPeriodLink,
  type ExplanationAnchor,
  type ForecastContentBlock,
  type ForecastEvidenceView,
  type ForecastSection,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
  type PersonalForecastWindow,
} from './personalForecastContract';
type ForecastWriterLanguage = 'ru' | 'en';

export const PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS = 2;

/**
 * A strict monthly response needs room for the model's internal work as well
 * as the 150-word JSON payload. Day and week keep their proven budget.
 */
export const PERSONAL_FORECAST_WRITER_MAX_OUTPUT_TOKENS: Record<
  PersonalForecastPeriod,
  number
> = {
  day: 1_000,
  week: 1_000,
  month: 1_400,
};

export function getPersonalForecastWriterMaxOutputTokens(
  period: PersonalForecastPeriod,
  retryAfterIncomplete = false,
): number {
  if (period === 'month' && retryAfterIncomplete) return 1_800;
  return PERSONAL_FORECAST_WRITER_MAX_OUTPUT_TOKENS[period];
}

export const PERSONAL_FORECAST_WORD_LIMITS: Record<PersonalForecastPeriod, number> = {
  day: 150,
  week: 150,
  month: 150,
};

export const PERSONAL_FORECAST_WORD_MINIMUMS: Record<PersonalForecastPeriod, number> = {
  day: 90,
  week: 80,
  month: 100,
};

export const PERSONAL_FORECAST_FRAGMENT_LIMITS: Record<
  PersonalForecastPeriod,
  { minimum: number; maximum: number }
> = {
  day: { minimum: 4, maximum: 6 },
  week: { minimum: 1, maximum: 1 },
  month: { minimum: 1, maximum: 1 },
};

export const PERSONAL_FORECAST_HEADLINE_WORD_LIMITS = {
  minimum: 3,
  maximum: 8,
} as const;

export const PERSONAL_FORECAST_PHRASE_WORD_LIMITS = PERSONAL_FORECAST_HEADLINE_WORD_LIMITS;

const TODAY_FRAGMENT_WORD_LIMITS = { minimum: 12, maximum: 42 } as const;

export function getPersonalForecastSystemPrompt(
  language: ForecastWriterLanguage,
  period: PersonalForecastPeriod = 'day',
): string {
  const limits = `${PERSONAL_FORECAST_WORD_MINIMUMS[period]} to ${PERSONAL_FORECAST_WORD_LIMITS[period]} words`;
  const ru = language === 'ru';
  const periodRules = period === 'day'
    ? (ru
        ? 'TODAY: напиши от 4 до 6 последовательных текстовых фрагментов. Первый — главный; каждый следующий продолжает чтение, добавляет новую мысль и не повторяет предыдущий. Это единая лента без видимых категорий, названий рубрик, карточек, утренних/дневных/вечерних частей и почасовой структуры.'
        : 'TODAY: write 4 to 6 sequential text fragments. The first is the main fragment; every next fragment advances the reading with a genuinely new point. This is one continuous feed with no visible categories, section labels, cards, morning/day/evening parts, or hourly structure.')
    : (ru
        ? `${period.toUpperCase()}: напиши ровно один цельный фрагмент-историю. Не дроби его на рубрики, этапы периода или календарные части.`
        : `${period.toUpperCase()}: write exactly one cohesive story fragment. Do not split it into topics, period stages, or calendar parts.`);
  const outputRules = ru
    ? `- Общий заголовок — 3–8 слов: живой крючок, а не категория.
- Весь видимый текст — от ${limits}, включая заголовок.
- Не пиши Markdown, списки, вопросы пользователю, CTA или технические пояснения.
- Сохранённый натальный контекст — только скрытый источник персонализации. Переводи его в обычный язык; не показывай и не называй астрологию.
- Выбранный период — рамка рассказа, а не доказательство рассчитанных транзитов. Не придумывай транзиты, события, биографию, профессию, родственников, диагнозы, медицинские или финансовые утверждения и гарантии будущего.
- Обращайся только на «ты». Имя используй максимум один раз и только если оно звучит естественно.
- Скрытые main_idea_key, life_plot_key, advice_key и comparison_key заполни после написания текста как короткие служебные описания фактически использованной мысли, ситуации, совета и сравнения. Пустая строка допустима для отсутствующего совета или сравнения. Никогда не печатай эти ключи внутри text.`
    : `- The shared headline is 3–8 words: a vivid hook, never a category.
- Produce ${limits} in all visible copy, including the headline.
- No Markdown, lists, reader questions, CTAs, or technical explanations.
- The saved natal context is a hidden personalisation source only. Translate it into ordinary language; never expose or name astrology.
- The selected period is a storytelling frame, not evidence of calculated transits. Never invent transits, events, biography, occupation, relatives, diagnoses, medical or financial claims, or guaranteed outcomes.
- Address the reader only as “you”. Use the name at most once and only when natural.
- Fill hidden main_idea_key, life_plot_key, advice_key, and comparison_key after writing as short service descriptions of the actual idea, situation, advice, and comparison used. An empty string is allowed when there is no advice or comparison. Never print these keys inside text.`;
  return `${getPersonalForecastSystemVoice(language)}\n\nPERSONAL FORECAST WRITER\n${periodRules}\n\n${outputRules}\n- The supplied period window is context only: never print dates or split the text into time segments.\n- Recent copy in anti_repeat_context is negative context only. Do not repeat its openings, advice, life plot, central thought, signature comparison, or close paraphrases. Never mention this history.\n\nReturn valid JSON only. Every evidence_ids value must be exactly ["profile:personal"]; it is a service reference and is never shown to the reader.`;
}

type GeneratedTextBlock = {
  text?: unknown;
  evidence_ids?: unknown;
};

type GeneratedFragmentBlock = GeneratedTextBlock & {
  main_idea_key?: unknown;
  life_plot_key?: unknown;
  advice_key?: unknown;
  comparison_key?: unknown;
};

type GeneratedFeedPayload = {
  headline?: GeneratedTextBlock | null | unknown;
  fragments?: GeneratedFragmentBlock[];
};

/**
 * This is intentionally narrower than the persisted forecast package. Luna
 * writes only user copy and evidence references; the server materializes and
 * persists all trusted package metadata after semantic validation.
 */
export const PERSONAL_FORECAST_RESPONSE_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    headline: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        evidence_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['text', 'evidence_ids'],
      additionalProperties: false,
    },
    fragments: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          main_idea_key: { type: 'string' },
          life_plot_key: { type: 'string' },
          advice_key: { type: 'string' },
          comparison_key: { type: 'string' },
          evidence_ids: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'text',
          'main_idea_key',
          'life_plot_key',
          'advice_key',
          'comparison_key',
          'evidence_ids',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'fragments'],
  additionalProperties: false,
};

type FreeGeneratedBlock = {
  text: string;
  role: 'lead' | 'insight';
  evidenceIds: string[];
};

type FreeGeneratedSection = {
  title: string | null;
  evidenceIds: string[];
  blocks: FreeGeneratedBlock[];
  mainIdeaKey: string;
  lifePlotKey: string;
  adviceKey: string;
  comparisonKey: string;
};

type ValidatedFreeWriterResult = {
  sections: FreeGeneratedSection[];
  errors: string[];
};

type GenerationResult = {
  overview: ForecastSection;
  sections: ForecastSection[];
  generationAttempts: 0 | 1 | 2;
  validationStatus: 'valid' | 'deterministic_fallback';
};

export const PERSONAL_FORECAST_PROFILE_EVIDENCE_ID = 'profile:personal';

export type PersonalForecastRecentFragment = {
  kind?: 'headline' | 'fragment';
  text: string;
  semanticFingerprint: string | null;
};

export type PersonalForecastRecentReading = {
  periodKey: string;
  fragments: PersonalForecastRecentFragment[];
};

function boundedRecentForecasts(
  readings: readonly PersonalForecastRecentReading[] | undefined,
): PersonalForecastRecentReading[] {
  return (readings || []).slice(0, 4).map((reading) => ({
    periodKey: String(reading.periodKey || '').slice(0, 32),
    fragments: reading.fragments.slice(0, 7).flatMap((fragment) => {
      const text = modelText(fragment.text);
      if (!text) return [];
      return [{
        kind: fragment.kind === 'headline' ? 'headline' as const : 'fragment' as const,
        text: text.slice(0, 700),
        semanticFingerprint: modelText(fragment.semanticFingerprint)?.slice(0, 600) || null,
      }];
    }),
  })).filter((reading) => reading.periodKey && reading.fragments.length);
}

export function buildPersonalForecastFeedPrompt(input: {
  language: ForecastWriterLanguage;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  profile: UserProfile;
  natalContext: Record<string, unknown>;
  recentForecasts?: PersonalForecastRecentReading[];
  rejectedDraftFragments?: PersonalForecastRecentFragment[];
  repairErrors?: string[];
}): string {
  const repair = input.repairErrors?.length
    ? `\nPREVIOUS RESPONSE ERRORS. Rebuild the response rather than patching its wording:\n${input.repairErrors.join('\n')}`
    : '';
  const profile = {
    name: input.profile.name.trim().slice(0, 80) || null,
    birth_date: input.profile.birthDate || null,
    birth_time: input.profile.birthTime || null,
    birth_place: input.profile.birthPlace?.trim().slice(0, 160) || null,
    birth_timezone: input.profile.birthTimezone || input.window.timezone,
    language: input.language,
  };
  const promptContext = {
    language: input.language,
    selected_period: {
      kind: input.period,
      key: input.window.periodKey,
      start: input.window.periodStart,
      end: input.window.periodEnd,
      timezone: input.window.timezone,
    },
    personal_profile: profile,
    saved_natal_context: input.natalContext,
    anti_repeat_context: {
      recent_forecasts: boundedRecentForecasts(input.recentForecasts),
      rejected_draft: (input.rejectedDraftFragments || []).slice(0, 7).map((fragment) => ({
        kind: fragment.kind === 'headline' ? 'headline' : 'fragment',
        text: String(fragment.text || '').trim().slice(0, 700),
        semanticFingerprint: modelText(fragment.semanticFingerprint)?.slice(0, 600) || null,
      })).filter((fragment) => fragment.text),
    },
  };
  return `Use only this private server context. Do not quote or explain it:\n${JSON.stringify(promptContext, null, 2)}${repair}`;
}

function modelText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

export type PersonalForecastRepeatFragment = {
  kind?: 'headline' | 'fragment';
  text: string;
  mainIdeaKey?: string;
  lifePlotKey?: string;
  adviceKey?: string;
  comparisonKey?: string;
  semanticFingerprint?: string | null;
};

export function normalizePersonalForecastText(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/gu, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function normalizedTokens(value: string): string[] {
  const normalized = normalizePersonalForecastText(value);
  return normalized ? normalized.split(' ') : [];
}

function shingles(value: string, size: number): Set<string> {
  const tokens = normalizedTokens(value);
  const result = new Set<string>();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    result.add(tokens.slice(index, index + size).join(' '));
  }
  return result;
}

function containmentSimilarity(left: Set<string>, right: Set<string>): number {
  const denominator = Math.min(left.size, right.size);
  if (!denominator) return 0;
  let matches = 0;
  for (const item of left) {
    if (right.has(item)) matches += 1;
  }
  return matches / denominator;
}

function isNearDuplicate(left: string, right: string): boolean {
  const leftNormalized = normalizePersonalForecastText(left);
  const rightNormalized = normalizePersonalForecastText(right);
  if (!leftNormalized || !rightNormalized) return false;
  if (leftNormalized === rightNormalized) return true;
  const leftTrigrams = shingles(leftNormalized, 3);
  const rightTrigrams = shingles(rightNormalized, 3);
  if (Math.min(leftTrigrams.size, rightTrigrams.size) < 6) return false;
  return containmentSimilarity(leftTrigrams, rightTrigrams) >= 0.6;
}

function openingKey(value: string): string | null {
  const tokens = normalizedTokens(value);
  return tokens.length >= 5 ? tokens.slice(0, 5).join(' ') : null;
}

function lexicalStem(token: string): string {
  return token.length > 6 ? token.slice(0, 5) : token;
}

const LEXICAL_STOPWORDS = new Set([
  'ты', 'тебе', 'тебя', 'твой', 'твоя', 'твое', 'твои', 'свой', 'своя', 'свое', 'свои',
  'и', 'а', 'но', 'или', 'в', 'во', 'на', 'о', 'об', 'для', 'с', 'со', 'к', 'по', 'из', 'от',
  'до', 'перед', 'после', 'это', 'этот', 'эта', 'эти', 'сейчас', 'сегодня', 'лучше', 'стоит',
  'важно', 'нужно', 'надо', 'как', 'словно', 'будто',
  'главная', 'главный', 'мысль', 'жизненный', 'сюжет', 'совет', 'сравнение',
  'you', 'your', 'yours', 'and', 'or', 'but', 'the', 'a', 'an', 'to', 'of', 'for', 'with',
  'from', 'before', 'after', 'now', 'today', 'better', 'should', 'need', 'important', 'like',
  'as', 'if', 'main', 'idea', 'life', 'plot', 'advice', 'comparison',
].map(lexicalStem));

function meaningfulLexicalTokens(value: string): Set<string> {
  return new Set(normalizedTokens(value)
    .map(lexicalStem)
    .filter((token) => token.length > 1 && !LEXICAL_STOPWORDS.has(token)));
}

function lexicalContainment(left: string, right: string): number {
  const leftTokens = meaningfulLexicalTokens(left);
  const rightTokens = meaningfulLexicalTokens(right);
  return containmentSimilarity(leftTokens, rightTokens);
}

const ADVICE_SENTENCE_PATTERN = /(?:лучше|стоит|важно|не\s+нужно|тебе\s+нужно|проверь|выбери|оставь|скажи|сделай|откажись|\bbetter\b|\bshould\b|\bneed\s+to\b|\bmake\s+sure\b|\bcheck\b|\bchoose\b|\bleave\b|\bsay\b|\bdo\b)/iu;
const COMPARISON_PATTERN = /(?:(?:^|[^\p{L}])(?:как|словно|будто)(?!\p{L})|(?:^|[^\p{L}])(?:напоминает|похож\p{L}*)(?!\p{L})|\b(?:like|as\s+if|resembles|reminds)\b)[^.!?\n]*/giu;

function sentencesMatching(value: string, pattern: RegExp): string[] {
  return value
    .split(/[.!?\n]+/u)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && pattern.test(sentence));
}

function comparisons(value: string): string[] {
  return [...value.matchAll(COMPARISON_PATTERN)]
    .map((match) => match[0]?.trim() || '')
    .filter(Boolean);
}

function keyHash(value: string | undefined): string | null {
  const normalized = normalizePersonalForecastText(value || '');
  return normalized ? Math.abs(stableHash(normalized)).toString(36) : null;
}

type RepeatKeySignal = {
  exact: string | null;
  tokens: Set<string>;
};

type RepeatKeySignals = {
  mainIdea: RepeatKeySignal;
  lifePlot: RepeatKeySignal;
  advice: RepeatKeySignal;
  comparison: RepeatKeySignal;
};

function emptyKeySignal(): RepeatKeySignal {
  return { exact: null, tokens: new Set() };
}

function signalForKey(value: string | undefined): RepeatKeySignal {
  return {
    exact: keyHash(value),
    tokens: new Set([...meaningfulLexicalTokens(value || '')]
      .map((token) => Math.abs(stableHash(token)).toString(36))
      .sort()),
  };
}

function fingerprintKeyComponent(value: string | undefined): string {
  const signal = signalForKey(value);
  if (!signal.exact) return '0';
  const tokens = [...signal.tokens].join('.');
  return tokens ? `${signal.exact}~${tokens}` : signal.exact;
}

function signalFromComponent(component: string | undefined): RepeatKeySignal {
  if (!component || component === '0') return emptyKeySignal();
  const [exact, tokenList = ''] = component.split('~', 2);
  return {
    exact: exact || null,
    tokens: new Set(tokenList.split('.').filter(Boolean)),
  };
}

function signalsFromFingerprint(value: string | null | undefined): RepeatKeySignals {
  const empty = () => ({
    mainIdea: emptyKeySignal(),
    lifePlot: emptyKeySignal(),
    advice: emptyKeySignal(),
    comparison: emptyKeySignal(),
  });
  const v4 = String(value || '').match(/^direct:v4:m([^:]+):p([^:]+):a([^:]+):c([^:]+):t[^:]+$/u);
  if (v4) {
    return {
      mainIdea: signalFromComponent(v4[1]),
      lifePlot: signalFromComponent(v4[2]),
      advice: signalFromComponent(v4[3]),
      comparison: signalFromComponent(v4[4]),
    };
  }
  const v3 = String(value || '').match(/^direct:v3:m([^:]+):p([^:]+):a([^:]+):c([^:]+):t[^:]+$/u);
  if (!v3) return empty();
  const legacy = (hash: string | undefined): RepeatKeySignal => ({
    exact: hash && hash !== '0' ? hash : null,
    tokens: new Set(),
  });
  return {
    mainIdea: legacy(v3[1]),
    lifePlot: legacy(v3[2]),
    advice: legacy(v3[3]),
    comparison: legacy(v3[4]),
  };
}

function fragmentKeySignals(fragment: PersonalForecastRepeatFragment): RepeatKeySignals {
  const persisted = signalsFromFingerprint(fragment.semanticFingerprint);
  const currentOrPersisted = (value: string | undefined, fallback: RepeatKeySignal) => (
    keyHash(value) ? signalForKey(value) : fallback
  );
  return {
    mainIdea: currentOrPersisted(fragment.mainIdeaKey, persisted.mainIdea),
    lifePlot: currentOrPersisted(fragment.lifePlotKey, persisted.lifePlot),
    advice: currentOrPersisted(fragment.adviceKey, persisted.advice),
    comparison: currentOrPersisted(fragment.comparisonKey, persisted.comparison),
  };
}

function keysRepeat(left: RepeatKeySignal, right: RepeatKeySignal): boolean {
  if (left.exact && left.exact === right.exact) return true;
  if (Math.min(left.tokens.size, right.tokens.size) < 2) return false;
  let matches = 0;
  for (const token of left.tokens) {
    if (right.tokens.has(token)) matches += 1;
  }
  return matches >= 2 && containmentSimilarity(left.tokens, right.tokens) >= 0.66;
}

export function buildPersonalForecastRepeatFingerprint(
  fragment: PersonalForecastRepeatFragment,
): string {
  return [
    'direct:v4',
    `m${fingerprintKeyComponent(fragment.mainIdeaKey)}`,
    `p${fingerprintKeyComponent(fragment.lifePlotKey)}`,
    `a${fingerprintKeyComponent(fragment.adviceKey)}`,
    `c${fingerprintKeyComponent(fragment.comparisonKey)}`,
    `t${Math.abs(stableHash(normalizePersonalForecastText(fragment.text))).toString(36)}`,
  ].join(':');
}

export function findPersonalForecastRepeatViolations(
  current: readonly PersonalForecastRepeatFragment[],
  recent: readonly PersonalForecastRepeatFragment[] = [],
): string[] {
  const errors = new Set<string>();
  const comparePair = (
    left: PersonalForecastRepeatFragment,
    right: PersonalForecastRepeatFragment,
  ) => {
    const leftKind = left.kind || 'fragment';
    const rightKind = right.kind || 'fragment';
    if (leftKind !== rightKind) return;
    if (leftKind === 'headline') {
      if (isNearDuplicate(left.text, right.text)) errors.add('repeated headline');
      return;
    }
    const leftOpening = openingKey(left.text);
    const rightOpening = openingKey(right.text);
    if (leftOpening && leftOpening === rightOpening) {
      errors.add('repeated opening');
    }
    if (isNearDuplicate(left.text, right.text)) {
      errors.add('near-duplicate forecast text');
    }
    const leftAdvice = sentencesMatching(left.text, ADVICE_SENTENCE_PATTERN);
    const rightAdvice = sentencesMatching(right.text, ADVICE_SENTENCE_PATTERN);
    if (
      leftAdvice.some((a) => rightAdvice.some((b) => lexicalContainment(a, b) >= 0.5))
      || (leftAdvice.length > 0
        && rightAdvice.length > 0
        && lexicalContainment(left.text, right.text) >= 0.45)
    ) {
      errors.add('repeated advice');
    }
    const leftComparisons = comparisons(left.text);
    const rightComparisons = comparisons(right.text);
    if (leftComparisons.some((a) => rightComparisons.some((b) => (
      isNearDuplicate(a, b) || lexicalContainment(a, b) >= 0.72
    )))) {
      errors.add('repeated comparison');
    }
    const leftKeys = fragmentKeySignals(left);
    const rightKeys = fragmentKeySignals(right);
    if (keysRepeat(leftKeys.mainIdea, rightKeys.mainIdea)) {
      errors.add('repeated main idea');
    }
    if (keysRepeat(leftKeys.lifePlot, rightKeys.lifePlot)) {
      errors.add('repeated life plot');
    }
    if (keysRepeat(leftKeys.advice, rightKeys.advice)) {
      errors.add('repeated advice key');
    }
    if (keysRepeat(leftKeys.comparison, rightKeys.comparison)) {
      errors.add('repeated comparison key');
    }
  };
  current.forEach((fragment, index) => {
    current.slice(index + 1).forEach((other) => comparePair(fragment, other));
    recent.forEach((previous) => comparePair(fragment, previous));
  });
  return [...errors];
}

const FORBIDDEN_ASTROLOGY_PATTERNS = [
  /(?:^|[^\p{L}])(?:астролог\p{L}*|гороскоп\p{L}*|натальн\p{L}*|транзит\p{L}*|аспект\p{L}*|асцендент\p{L}*|орб(?:ис)?\p{L}*|ретроград\p{L}*|секстил\p{L}*|трин\p{L}*|тригон\p{L}*|квадратур\p{L}*|квадрат(?:е|а|ом|у)?|оппозиц\p{L}*|соединени\p{L}*|солнц\p{L}*|лун\p{L}*|меркур\p{L}*|венер\p{L}*|марс\p{L}*|юпитер\p{L}*|сатурн\p{L}*|уран\p{L}*|нептун\p{L}*|плутон\p{L}*|овен|овна|овну|овном|овне|телец|тельца|тельцу|тельцом|тельце|близнец\p{L}*|рак|рака|раку|раком|раке|лев|льва|льву|львом|льве|дева|девы|деве|деву|девой|весы|весов|весам|весами|весах|скорпион\p{L}*|стрелец|стрельца|стрельцу|стрельцом|стрельце|козерог\p{L}*|водоле\p{L}*|рыб|рыбы|рыбам|рыбами|рыбах)(?!\p{L})/iu,
  /\b(?:astrolog\w*|horoscope\w*|natal|transit\w*|aspect\w*|ascendant|orb|retrograde|sextile|trine|square|opposition|conjunction|sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b/iu,
  /(?:^|[^\p{L}\d])(?:[1-9]|1[0-2])(?:-?(?:й|м|ом|ый))?\s+дом(?:е|а|ом)?(?!\p{L})/iu,
  /\b(?:(?:[1-9]|1[0-2])(?:st|nd|rd|th)?\s+house|house\s+(?:[1-9]|1[0-2]))\b/iu,
];

const FORMAL_RUSSIAN_ADDRESS_PATTERN = /(?:^|[^\p{L}])(?:вы|вас|вам|вами|ваш\p{L}*|будьте|помните|следите|держите|составьте|сделайте|дайте|выберите|проверьте|обсудите|отложите|используйте|обратите|постарайтесь|избегайте|планируйте|сохраните|позвольте|уделите|решите|начните|остановитесь|подождите|[\p{L}-]+йте|[\p{L}-]+йтесь)(?!\p{L})/iu;

const WEEKDAY_PATTERNS = [
  /(?:^|[^\p{L}])понедельник\p{L}*(?!\p{L})/iu,
  /(?:^|[^\p{L}])вторник\p{L}*(?!\p{L})/iu,
  /(?:^|[^\p{L}])сред(?:а|у|ы|е|ой)(?!\p{L})/iu,
  /(?:^|[^\p{L}])четверг\p{L}*(?!\p{L})/iu,
  /(?:^|[^\p{L}])пятниц\p{L}*(?!\p{L})/iu,
  /(?:^|[^\p{L}])суббот\p{L}*(?!\p{L})/iu,
  /(?:^|[^\p{L}])воскресень\p{L}*(?!\p{L})/iu,
  /\bmonday\b/iu,
  /\btuesday\b/iu,
  /\bwednesday\b/iu,
  /\bthursday\b/iu,
  /\bfriday\b/iu,
  /\bsaturday\b/iu,
  /\bsunday\b/iu,
];

function containsForbiddenAstrologyTerm(value: string): boolean {
  return FORBIDDEN_ASTROLOGY_PATTERNS.some((pattern) => pattern.test(value));
}

function containsFormalRussianAddress(value: string): boolean {
  return FORMAL_RUSSIAN_ADDRESS_PATTERN.test(value);
}

const GUARANTEED_EVENT_PATTERNS = [
  /(?:^|[^\p{L}])ты\s+(?:обязательно|непременно|точно)\s+(?:получишь|встретишь|найд[её]шь|станешь|разбогатеешь|победишь|добь[её]шься)(?!\p{L})/iu,
  /(?:^|[^\p{L}])тебя\s+жд[её]т(?:\s|$)/iu,
  /(?:^|[^\p{L}])(?:сегодня|на\s+этой\s+неделе|в\s+этом\s+месяце)?\s*тебе\s+(?:позвонит|напишет|предложат|сообщат|вернут|подарят|встретится|попад[её]тся|появится|прид[её]т)(?!\p{L})/iu,
  /(?:^|[^\p{L}])(?:гарантированно|неизбежно|без\s+сомнения)\s+[^.!?]*(?:случится|произойд[её]т|получишь|встретишь)(?!\p{L})/iu,
  /\byou\s+(?:will\s+)?(?:definitely|certainly)\s+(?:get|meet|find|become|win|succeed)\b/iu,
  /\b(?:today|this\s+week|this\s+month),?\s+(?:someone\s+will\s+)?(?:call|write|offer|tell|return|give|arrive)\b/iu,
  /\b(?:you\s+are\s+guaranteed|a\s+guaranteed\s+outcome|will\s+inevitably)\b/iu,
];

const INVENTED_BIOGRAPHY_PATTERNS = [
  /(?:^|[^\p{L}])ты\s+работаешь\s+(?:в|на|[\p{L}-]+(?:ом|ем|кой|цей))(?!\p{L})/iu,
  /(?:^|[^\p{L}])(?:с\s+детства|в\s+школе\s+ты|после\s+(?:развода|переезда|увольнения))(?!\p{L})/iu,
  /(?:^|[^\p{L}])тво(?:й|я|и)\s+(?:муж|жена|сын|дочь|дети|начальник|руководитель)(?!\p{L})/iu,
  /\byou\s+(?:work\s+as|have\s+worked\s+as|live\s+in|are\s+married|are\s+divorced)\b/iu,
  /\byour\s+(?:husband|wife|son|daughter|children|boss|manager)\b/iu,
];

const MEDICAL_CLAIM_PATTERNS = [
  /(?:^|[^\p{L}])(?:диагноз\p{L}*|болезн\p{L}*|заболеван\p{L}*|симптом\p{L}*|мигрен\p{L}*|лечени\p{L}*|лекарств\p{L}*|таблет\p{L}*|дозиров\p{L}*)(?!\p{L})/iu,
  /\b(?:diagnos\w*|disease\w*|symptom\w*|migraine\w*|treatment\w*|medication\w*|dosage\w*)\b/iu,
];

const FINANCIAL_CLAIM_PATTERNS = [
  /(?:^|[^\p{L}])(?:купи|покупай|продай|продавай|вложи|инвестируй)\s+[^.!?]*(?:акци\p{L}*|облигаци\p{L}*|криптовалют\p{L}*|инвестиц\p{L}*)(?!\p{L})/iu,
  /(?:^|[^\p{L}])(?:инвестиц\p{L}*|вложени\p{L}*|акци\p{L}*|криптовалют\p{L}*)\s+[^.!?]*(?:гарантир\p{L}*|принес\p{L}*|дадут|обеспечат)\s+[^.!?]*(?:прибыл\p{L}*|доход\p{L}*)(?!\p{L})/iu,
  /(?:^|[^\p{L}])(?:доход|прибыль)\s+(?:точно|обязательно|гарантированно)?\s*(?:вырастет|увеличится|прид[её]т)(?!\p{L})/iu,
  /\b(?:buy|sell|invest\s+in)\s+[^.!?]*(?:stocks?|bonds?|crypto|investment)\b/iu,
  /\b(?:guaranteed\s+(?:profit|return)|income\s+will\s+(?:rise|increase))\b/iu,
];

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

const VISIBLE_CATEGORY_LABEL_PATTERN = /(?:^|[\n.!?]\s*)(?:любовь|отношения|работа|карьера|деньги|настроение|самочувствие|love|relationships?|work|career|money|mood)\s*[:—-]/iu;

function isPredominantlyRussian(value: string): boolean {
  const letters = value.match(/\p{L}/gu) || [];
  if (!letters.length) return false;
  const cyrillic = value.match(/\p{Script=Cyrillic}/gu) || [];
  return cyrillic.length / letters.length >= 0.7;
}

const CHRONOLOGICAL_TIME_SEGMENT_PATTERNS = [
  ...WEEKDAY_PATTERNS,
  /(?:^|[^\p{L}])(?:с\s+утра|утром|дн[её]м|после\s+полудня|к\s+вечеру|вечером|ночью)(?!\p{L})/iu,
  /(?:^|[^\p{L}])(?:в\s+начале|в\s+середине|в\s+конце|к\s+(?:середине|концу)|ближе\s+к)\s+(?:дня|недели|месяца)(?!\p{L})/iu,
  /(?:^|[^\p{L}])(?:в\s+)?(?:перв(?:ой|ую)|втор(?:ой|ую)|последн(?:ей|юю))\s+(?:части|половине)\s+(?:дня|недели|месяца)(?!\p{L})/iu,
  /(?:^|[^\p{L}])(?:к\s+выходным|в\s+выходные|на\s+выходных|в\s+ближайш\p{L}*\s+(?:дн\p{L}*|недел\p{L}*|месяц\p{L}*))(?!\p{L})/iu,
  /(?:^|[^\p{L}\d])(?:после|до)\s+\d{1,2}(?::\d{2})?(?!\d)/iu,
  /\b\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\b/iu,
  /\b\d{4}-\d{2}-\d{2}\b/u,
  /\b(?:this|in\s+the|by\s+the|toward(?:s)?)\s+(?:morning|afternoon|evening|night)\b/iu,
  /\b(?:at\s+the|in\s+the|by\s+the|toward(?:s)?\s+the)\s+(?:beginning|middle|end)\s+of\s+(?:the\s+)?(?:day|week|month)\b/iu,
  /\b(?:first|second|last)\s+(?:half|part)\s+of\s+(?:the\s+)?(?:day|week|month)\b/iu,
  /\b(?:this|next|coming|following)\s+weekend\b/iu,
  /\b(?:in|within)\s+(?:the\s+)?(?:next|coming)\s+\d+\s+(?:hours?|days?|weeks?|months?)\b/iu,
  /\b(?:after|before|by)\s+\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?)?\b/iu,
  /\b\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b/iu,
  /\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/iu,
];

function containsChronologicalTimeSegment(value: string): boolean {
  return CHRONOLOGICAL_TIME_SEGMENT_PATTERNS.some((pattern) => pattern.test(value));
}

export type PersonalForecastGenerationDiagnosticCode =
  | 'PERSONAL_FORECAST_EVIDENCE_EMPTY'
  | 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED'
  | 'PERSONAL_FORECAST_WRITER_OUTPUT_LIMIT'
  | 'PERSONAL_FORECAST_WRITER_INCOMPLETE'
  | 'PERSONAL_FORECAST_WRITER_REFUSED'
  | 'PERSONAL_FORECAST_WRITER_UNAVAILABLE'
  | 'PERSONAL_FORECAST_GENERATION_FAILED';

/** Do not expose provider errors to clients; map them to stable UI states. */
export function getPersonalForecastGenerationDiagnosticCode(
  error: unknown,
): PersonalForecastGenerationDiagnosticCode {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('PERSONAL_FORECAST_EVIDENCE_EMPTY')) {
    return 'PERSONAL_FORECAST_EVIDENCE_EMPTY';
  }
  if (message.startsWith('PERSONAL_FORECAST_GENERATION_INVALID')) {
    return 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED';
  }
  if (message.startsWith('PERSONAL_FORECAST_WRITER_REQUEST_FAILED')) {
    if (message.includes('OPENAI_RESPONSE_REFUSAL')) {
      return 'PERSONAL_FORECAST_WRITER_REFUSED';
    }
    if (message.includes('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens')) {
      return 'PERSONAL_FORECAST_WRITER_OUTPUT_LIMIT';
    }
    return message.includes('OPENAI_RESPONSE_INCOMPLETE')
      ? 'PERSONAL_FORECAST_WRITER_INCOMPLETE'
      : 'PERSONAL_FORECAST_WRITER_UNAVAILABLE';
  }
  return 'PERSONAL_FORECAST_GENERATION_FAILED';
}

function validatedEvidenceIds(
  value: unknown,
  availableEvidenceIds: ReadonlySet<string>,
): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter(Boolean);
  if (
    !ids.length
    || new Set(ids).size !== ids.length
    || ids.some((id) => !availableEvidenceIds.has(id))
  ) return null;
  return ids;
}

function generatedBlock(
  value: unknown,
  role: FreeGeneratedBlock['role'],
  availableEvidenceIds: ReadonlySet<string>,
): FreeGeneratedBlock | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as GeneratedTextBlock;
  const text = modelText(candidate.text);
  const evidenceIds = validatedEvidenceIds(candidate.evidence_ids, availableEvidenceIds);
  return text && evidenceIds ? { text, role, evidenceIds } : null;
}

function generatedServiceKey(value: unknown, allowEmpty: boolean): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (!normalized) return allowEmpty ? '' : null;
  return normalized.length <= 120 && wordCount(normalized) <= 12 ? normalized : null;
}

function generatedSection(
  value: unknown,
  role: FreeGeneratedBlock['role'],
  availableEvidenceIds: ReadonlySet<string>,
): FreeGeneratedSection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as GeneratedFragmentBlock;
  const block = generatedBlock(candidate, role, availableEvidenceIds);
  const mainIdeaKey = generatedServiceKey(candidate.main_idea_key, false);
  const lifePlotKey = generatedServiceKey(candidate.life_plot_key, false);
  const adviceKey = generatedServiceKey(candidate.advice_key, true);
  const comparisonKey = generatedServiceKey(candidate.comparison_key, true);
  if (!block || mainIdeaKey == null || lifePlotKey == null || adviceKey == null || comparisonKey == null) {
    return null;
  }
  return {
    title: null,
    evidenceIds: block.evidenceIds,
    blocks: [block],
    mainIdeaKey,
    lifePlotKey,
    adviceKey,
    comparisonKey,
  };
}

export type PersonalForecastValidationOptions = {
  language?: ForecastWriterLanguage;
  recentFragments?: PersonalForecastRepeatFragment[];
  rejectedDraftFragments?: PersonalForecastRepeatFragment[];
};

export function validateFreeGeneratedForecastFeed(
  raw: GeneratedFeedPayload,
  availableEvidenceIds: ReadonlySet<string> = new Set(),
  period: PersonalForecastPeriod = 'day',
  options: PersonalForecastValidationOptions = {},
): ValidatedFreeWriterResult {
  if (!Array.isArray(raw.fragments)) {
    return { sections: [], errors: ['payload requires fragments with valid evidence_ids and hidden diversity keys'] };
  }
  const headline = generatedBlock(raw.headline, 'lead', availableEvidenceIds);
  const headlineWords = headline ? wordCount(headline.text) : 0;
  const rawFragments = raw.fragments || [];
  const fragments = rawFragments.map((fragment, index) => (
    generatedSection(fragment, index === 0 ? 'lead' : 'insight', availableEvidenceIds)
  ));
  if (!fragments.length || fragments.some((fragment) => !fragment)) {
    return { sections: [], errors: ['a fragment has invalid text, hidden keys, or evidence_ids'] };
  }
  const errors: string[] = [];
  if (!headline) {
    errors.push('headline requires valid text and existing evidence_ids');
  } else if (
    headlineWords < PERSONAL_FORECAST_HEADLINE_WORD_LIMITS.minimum
    || headlineWords > PERSONAL_FORECAST_HEADLINE_WORD_LIMITS.maximum
  ) {
    errors.push(
      `headline has ${headlineWords} words; expected ${PERSONAL_FORECAST_HEADLINE_WORD_LIMITS.minimum}-${PERSONAL_FORECAST_HEADLINE_WORD_LIMITS.maximum}`,
    );
  }
  const fragmentLimits = PERSONAL_FORECAST_FRAGMENT_LIMITS[period];
  if (rawFragments.length < fragmentLimits.minimum || rawFragments.length > fragmentLimits.maximum) {
    errors.push(period === 'day'
      ? `Today requires 4-6 fragments; received ${rawFragments.length}`
      : `${period} requires exactly one fragment; received ${rawFragments.length}`);
  }
  const readingSections = fragments.filter((fragment): fragment is FreeGeneratedSection => !!fragment);
  if (period === 'day') {
    readingSections.forEach((section, index) => {
      const count = wordCount(section.blocks[0]?.text || '');
      if (count < TODAY_FRAGMENT_WORD_LIMITS.minimum || count > TODAY_FRAGMENT_WORD_LIMITS.maximum) {
        errors.push(
          `Today fragment ${index + 1} has ${count} words; expected ${TODAY_FRAGMENT_WORD_LIMITS.minimum}-${TODAY_FRAGMENT_WORD_LIMITS.maximum}`,
        );
      }
    });
  }
  const visibleCopy = [headline?.text, ...readingSections.map((section) => section.blocks[0]?.text)]
    .filter((value): value is string => !!value);
  if (visibleCopy.some(containsForbiddenAstrologyTerm)) {
    errors.push('visible forecast copy contains a forbidden astrology term');
  }
  if (visibleCopy.some(containsFormalRussianAddress)) {
    errors.push('visible forecast copy contains formal Russian address');
  }
  if (visibleCopy.some(containsChronologicalTimeSegment)) {
    errors.push('visible forecast copy contains a chronological time segment');
  }
  if (visibleCopy.some((value) => VISIBLE_CATEGORY_LABEL_PATTERN.test(value))) {
    errors.push('visible forecast copy contains a visible category label');
  }
  if (visibleCopy.some(hasPersonalForecastVoiceViolation)) {
    errors.push('visible forecast copy contains a banned forecast voice phrase');
  }
  if (visibleCopy.some((value) => matchesAny(value, GUARANTEED_EVENT_PATTERNS))) {
    errors.push('visible forecast copy contains an unsupported event guarantee');
  }
  if (visibleCopy.some((value) => matchesAny(value, INVENTED_BIOGRAPHY_PATTERNS))) {
    errors.push('visible forecast copy contains an invented biography claim');
  }
  if (visibleCopy.some((value) => matchesAny(value, MEDICAL_CLAIM_PATTERNS))) {
    errors.push('visible forecast copy contains a medical claim');
  }
  if (visibleCopy.some((value) => matchesAny(value, FINANCIAL_CLAIM_PATTERNS))) {
    errors.push('visible forecast copy contains a financial claim');
  }
  if (options.language === 'ru' && visibleCopy.some((value) => !isPredominantlyRussian(value))) {
    errors.push('Russian forecast must be predominantly Russian in every visible fragment');
  }
  const totalWords = visibleCopy.reduce((sum, value) => sum + wordCount(value), 0);
  const wordMinimum = PERSONAL_FORECAST_WORD_MINIMUMS[period];
  const wordLimit = PERSONAL_FORECAST_WORD_LIMITS[period];
  if (totalWords < wordMinimum) {
    errors.push(`forecast has ${totalWords} words; minimum for ${period} is ${wordMinimum}`);
  }
  if (totalWords > wordLimit) {
    errors.push(`forecast has ${totalWords} words; maximum for ${period} is ${wordLimit}`);
  }
  const repeatFragments: PersonalForecastRepeatFragment[] = [
    ...(headline ? [{ kind: 'headline' as const, text: headline.text }] : []),
    ...readingSections.map((section) => ({
      kind: 'fragment' as const,
      text: section.blocks[0]?.text || '',
      mainIdeaKey: section.mainIdeaKey,
      lifePlotKey: section.lifePlotKey,
      adviceKey: section.adviceKey,
      comparisonKey: section.comparisonKey,
    })),
  ];
  errors.push(...findPersonalForecastRepeatViolations(
    repeatFragments,
    [...(options.recentFragments || []), ...(options.rejectedDraftFragments || [])],
  ));
  if (errors.length) return { sections: [], errors };
  if (readingSections[0]) readingSections[0].title = headline?.text || null;
  return {
    errors: [],
    sections: readingSections,
  };
}

export function parseGeneratedFeedPayload(content: string): GeneratedFeedPayload | null {
  const unwrapped = content
    .trim()
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim();
  const candidates = [unwrapped];
  const firstObject = unwrapped.indexOf('{');
  const lastObject = unwrapped.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) {
    candidates.push(unwrapped.slice(firstObject, lastObject + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const payload = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : null;
      if (!payload) continue;
      const isGeneratedPayload = (value: unknown): value is Record<string, unknown> => (
        !!value
        && typeof value === 'object'
        && !Array.isArray(value)
        && ['headline', 'fragments']
          .some((key) => Object.prototype.hasOwnProperty.call(value, key))
      );
      const nested = [payload, payload.data, payload.result, payload.output, payload.response]
        .find(isGeneratedPayload);
      if (nested && typeof nested === 'object') return nested as GeneratedFeedPayload;
    } catch {
      // Try the next safe JSON representation.
    }
  }
  return null;
}

function evidenceForIds(
  evidenceIds: readonly string[],
  evidenceViews: Record<string, ForecastEvidenceView>,
): ForecastEvidenceView[] {
  return evidenceIds
    .map((id) => evidenceViews[id])
    .filter((item): item is ForecastEvidenceView => !!item);
}

function directSemanticFingerprint(section: FreeGeneratedSection, text: string): string {
  return buildPersonalForecastRepeatFingerprint({
    text,
    mainIdeaKey: section.mainIdeaKey,
    lifePlotKey: section.lifePlotKey,
    adviceKey: section.adviceKey,
    comparisonKey: section.comparisonKey,
  });
}

function materializeDirectSection(input: {
  section: FreeGeneratedSection;
  evidenceViews: Record<string, ForecastEvidenceView>;
  language: ForecastWriterLanguage;
  overview: boolean;
  sectionIndex: number;
}): ForecastSection {
  const title = input.section.title || undefined;
  const sectionId = input.overview
    ? 'overview'
    : `semantic:direct-${input.sectionIndex}-${Math.abs(stableHash(input.section.blocks.map((block) => block.text).join(':'))).toString(36)}`;
  const blocks: ForecastContentBlock[] = input.section.blocks.map((block, index) => {
    const blockEvidence = evidenceForIds(block.evidenceIds, input.evidenceViews);
    return {
      id: `${sectionId}:generated:${index + 1}`,
      role: block.role,
      text: block.text,
      semanticFactId: block.evidenceIds[0],
      atomId: `generated:${sectionId}:${index + 1}`,
      evidenceIds: block.evidenceIds,
      astro_evidence: blockEvidence.map((item) => item.factor).join(' · ') || null,
      explanationAnchorId: `anchor:${sectionId}:${index + 1}`,
    };
  });
  const text = blocks.map((block) => block.text).join('\n\n');
  const teaser = input.language === 'ru'
    ? 'Открой полный текст личного прогноза.'
    : 'Open the full personal forecast.';
  const factualAnchorPrefix = input.language === 'ru'
    ? 'Контекст личного профиля: '
    : 'Personal profile context: ';
  const anchors: ExplanationAnchor[] = input.section.blocks.flatMap((block, index) => {
    const evidence = evidenceForIds(block.evidenceIds, input.evidenceViews);
    if (!evidence.length) return [];
    return [{
      id: `anchor:${sectionId}:${index + 1}`,
      conclusion: block.text,
      explanation: `${factualAnchorPrefix}${evidence
        .map((item) => item.factor)
        .join(' · ')}`.trim(),
      evidenceIds: evidence.map((item) => item.id),
    }];
  });
  return {
    id: sectionId,
    kind: input.overview ? 'overview' : 'dynamic',
    status: 'ready', diagnosticCode: null,
    title,
    sourceTopicKey: input.overview ? 'overview' : undefined,
    text, contentBlocks: blocks,
    semanticFactIds: [...new Set(input.section.blocks.flatMap((block) => block.evidenceIds))],
    semanticFingerprint: directSemanticFingerprint(input.section, text),
    importance: Math.max(1, 100 - input.sectionIndex),
    visualTag: 'personal-story',
    visualCue: null,
    premiumTeaser: teaser,
    lockedPreview: buildForecastLockedPreview(text, teaser),
    explanationAnchors: anchors,
    inlineAstroAccent: null,
  };
}

async function requestGeneratedFeed(input: {
  language: ForecastWriterLanguage;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  profile: UserProfile;
  natalContext: Record<string, unknown>;
  recentForecasts?: PersonalForecastRecentReading[];
  onMetrics?: (metrics: { model: string; inputTokens: number; outputTokens: number; latencyMs: number; validationPassed: boolean }) => void;
}): Promise<GenerationResult> {
  const availableEvidenceIds = new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]);
  const evidenceViews: Record<string, ForecastEvidenceView> = {
    [PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]: {
      id: PERSONAL_FORECAST_PROFILE_EVIDENCE_ID,
      factor: input.language === 'ru' ? 'Приватный личный контекст' : 'Private personal context',
      orb: null,
      status: 'active',
      period: input.window.periodKey,
      meaning: input.language === 'ru'
        ? 'Текст использует сохранённый личный контекст и выбранный период.'
        : 'The reading uses saved personal context and the selected period.',
    },
  };

  let errors: string[] = [];
  let writerRequestFailures = 0;
  let retryAfterIncomplete = false;
  let rejectedDraftFragments: PersonalForecastRepeatFragment[] = [];
  const recentFragments: PersonalForecastRepeatFragment[] = (input.recentForecasts || [])
    .flatMap((reading) => reading.fragments)
    .map((fragment) => ({
      kind: fragment.kind,
      text: fragment.text,
      semanticFingerprint: fragment.semanticFingerprint,
    }));
  for (
    let attempt = 1;
    attempt <= PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS;
    attempt += 1
  ) {
    let content = '';
    const startedAt = Date.now();
    let usage = { inputTokens: 0, outputTokens: 0 };
    try {
      const response = await createLunaStructuredResponse({
        instructions: getPersonalForecastSystemPrompt(input.language, input.period),
        input: buildPersonalForecastFeedPrompt({
          language: input.language,
          period: input.period,
          window: input.window,
          profile: input.profile,
          natalContext: input.natalContext,
          recentForecasts: input.recentForecasts,
          rejectedDraftFragments: rejectedDraftFragments.map((fragment) => ({
            kind: fragment.kind,
            text: fragment.text,
            semanticFingerprint: fragment.semanticFingerprint || null,
          })),
          repairErrors: attempt === 2 ? errors : undefined,
        }),
        maxOutputTokens: getPersonalForecastWriterMaxOutputTokens(
          input.period,
          retryAfterIncomplete,
        ),
        schemaName: 'personal_forecast',
        schema: PERSONAL_FORECAST_RESPONSE_SCHEMA,
      });
      content = response.content;
      usage = { inputTokens: response.inputTokens, outputTokens: response.outputTokens };
      retryAfterIncomplete = false;
    } catch (error) {
      writerRequestFailures += 1;
      const message = error instanceof Error ? error.message : String(error);
      retryAfterIncomplete = message.startsWith('OPENAI_RESPONSE_INCOMPLETE');
      errors = [`writer request failed: ${message}`];
      continue;
    }
    const raw = parseGeneratedFeedPayload(content);
    if (!raw) {
      errors = ['response is not valid JSON'];
      continue;
    }
    const validation = validateFreeGeneratedForecastFeed(
      raw,
      availableEvidenceIds,
      input.period,
      {
        language: input.language,
        recentFragments,
        rejectedDraftFragments,
      },
    );
    if (!validation.errors.length) {
      const [rawOverview] = validation.sections;
      if (!rawOverview) {
        errors = ['overview section is missing after validation'];
        continue;
      }
      const overview = materializeDirectSection({
        section: rawOverview,
        evidenceViews,
        language: input.language,
        overview: true,
        sectionIndex: 0,
      });
      input.onMetrics?.({ model: input.model, ...usage, latencyMs: Date.now() - startedAt, validationPassed: true });
      const sections = validation.sections.slice(1).map((section, index) => materializeDirectSection({
        section,
        evidenceViews,
        language: input.language,
        overview: false,
        sectionIndex: index + 1,
      }));
      return {
        overview,
        sections,
        generationAttempts: attempt as 1 | 2,
        validationStatus: 'valid',
      };
    }
    input.onMetrics?.({ model: input.model, ...usage, latencyMs: Date.now() - startedAt, validationPassed: false });
    errors = validation.errors;
    const rejectedHeadline = raw.headline && typeof raw.headline === 'object' && !Array.isArray(raw.headline)
      ? modelText((raw.headline as GeneratedTextBlock).text)
      : null;
    rejectedDraftFragments = [
      ...(rejectedHeadline ? [{
        kind: 'headline' as const,
        text: rejectedHeadline,
        semanticFingerprint: null,
      }] : []),
      ...(raw.fragments || []).flatMap((fragment) => {
        if (!fragment || typeof fragment !== 'object' || Array.isArray(fragment)) return [];
        const candidate = fragment as GeneratedFragmentBlock;
        const text = modelText(candidate.text);
        if (!text) return [];
        return [{
          kind: 'fragment' as const,
          text,
          mainIdeaKey: generatedServiceKey(candidate.main_idea_key, true) || '',
          lifePlotKey: generatedServiceKey(candidate.life_plot_key, true) || '',
          adviceKey: generatedServiceKey(candidate.advice_key, true) || '',
          comparisonKey: generatedServiceKey(candidate.comparison_key, true) || '',
          semanticFingerprint: null,
        }];
      }),
    ];
  }

  if (writerRequestFailures === PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS) {
    throw new Error(`PERSONAL_FORECAST_WRITER_REQUEST_FAILED:${errors.join(' | ')}`);
  }

  throw new Error(`PERSONAL_FORECAST_GENERATION_INVALID:${errors.join(' | ')}`);
}

export function buildCrossPeriodLinks(_input?: unknown): CrossPeriodLink[] {
  return [];
}

type CompactNatalPosition = {
  sign: string | null;
  house: number | null;
  retrograde: boolean | null;
};

function compactLegacyPosition(value: NatalChartData[keyof NatalChartData] | null | undefined): CompactNatalPosition | null {
  if (!value || typeof value !== 'object' || !('sign' in value)) return null;
  const position = value as { sign?: unknown; house?: unknown; retrograde?: unknown };
  return {
    sign: typeof position.sign === 'string' && position.sign.trim() ? position.sign : null,
    house: typeof position.house === 'number' && Number.isFinite(position.house) ? position.house : null,
    retrograde: typeof position.retrograde === 'boolean' ? position.retrograde : null,
  };
}

/**
 * The saved natal chart is the durable personal base. Forecast creation does
 * not calculate transits or any other period-specific data. Stored natal
 * positions and aspects are copied as private writer context only.
 */
export function buildPersonalForecastNatalContext(chart: NatalChartData): Record<string, unknown> {
  const positionKeys = [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
    'chiron',
  ] as const;
  if (isNatalChartDataV2(chart)) {
    const v2 = chart as unknown as NatalChartDataV2;
    const positions = Object.fromEntries(positionKeys.map((key) => {
      const position = v2.positions[key];
      return [key, position ? {
        sign: position.sign,
        house: v2.chartQuality.housesReliable ? position.house : null,
        retrograde: position.retrograde,
      } : null];
    }));
    return {
      source: 'saved_natal_chart',
      birth_time_quality: v2.birthTimeQuality,
      positions,
      angles: {
        ascendant: v2.chartQuality.ascendantReliable && v2.angles.ascendant
          ? { sign: v2.angles.ascendant.sign }
          : null,
        midheaven: v2.angles.mc?.stableSign ? { sign: v2.angles.mc.sign } : null,
      },
      aspects: v2.aspects
        .filter((aspect) => aspect.reliable)
        .sort((left, right) => left.orb - right.orb)
        .slice(0, 12)
        .map((aspect) => ({
          from: aspect.fromKey,
          to: aspect.toKey,
          type: aspect.type,
          orb: Number(aspect.orb.toFixed(2)),
        })),
    };
  }
  const legacyPositions = Object.fromEntries(positionKeys.map((key) => [
    key,
    compactLegacyPosition(chart[key]),
  ]));
  return {
    source: 'saved_natal_chart',
    birth_time_quality: chart.birthTimeQuality || chart.chartQuality?.birthTimeQuality || 'unknown',
    positions: legacyPositions,
    angles: {
      ascendant: chart.chartQuality?.ascendantReliable !== false && chart.rising
        ? { sign: chart.rising.sign }
        : null,
    },
    aspects: (chart.aspects || [])
      .filter((aspect) => Number.isFinite(aspect.orb))
      .sort((left, right) => left.orb - right.orb)
      .slice(0, 12)
      .map((aspect) => ({
        from: aspect.from,
        to: aspect.to,
        type: aspect.type,
        orb: Number(aspect.orb.toFixed(2)),
      })),
  };
}

export async function generatePersonalForecastPackage(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  recentForecasts?: PersonalForecastRecentReading[];
  onMetrics?: (metrics: { model: string; inputTokens: number; outputTokens: number; latencyMs: number; validationPassed: boolean }) => void;
}): Promise<PersonalForecastPackage> {
  const language: ForecastWriterLanguage = input.profile.language === 'en' ? 'en' : 'ru';
  const natalContext = buildPersonalForecastNatalContext(input.chartData);
  const generated = await requestGeneratedFeed({
    language,
    model: input.model,
    period: input.period,
    window: input.window,
    profile: input.profile,
    natalContext,
    recentForecasts: input.recentForecasts,
    onMetrics: input.onMetrics,
  });
  const materializePackage = (
    result: GenerationResult,
    diagnosticCode: string | null,
  ): PersonalForecastPackage => {
    const referencedEvidenceIds = new Set(
      [result.overview, ...result.sections]
        .flatMap((section) => section.explanationAnchors)
        .flatMap((anchor) => anchor.evidenceIds),
    );
    const evidence = Object.fromEntries(
      [...referencedEvidenceIds]
        .filter((id) => id === PERSONAL_FORECAST_PROFILE_EVIDENCE_ID)
        .map((id) => [id, {
          id,
          factor: language === 'ru' ? 'Приватный личный контекст' : 'Private personal context',
          orb: null,
          status: 'active' as const,
          period: input.window.periodKey,
          meaning: language === 'ru'
            ? 'Текст использует сохранённый личный контекст пользователя.'
            : 'The reading uses the user’s saved private context.',
        }] as const),
    );
    const freeSelection = input.period === 'day'
      ? selectTodayFreeSections({
          sections: result.sections,
          userId: String(input.profile.id || 'guest'),
          periodKey: input.window.periodKey,
        })
      : {
          strongestSectionId: null,
          rotatedSectionId: null,
          sectionIds: [],
        };
    return {
      period: input.period,
      periodKey: input.window.periodKey,
      periodStart: input.window.periodStart,
      periodEnd: input.window.periodEnd,
      dateLabel: formatPersonalForecastDateLabel(input.window, language),
      timezone: input.window.timezone,
      overview: result.overview,
      sections: result.sections,
      suggestedCrossPeriodLinks: [],
      evidence,
      visual: {
        sectionAssetIds: Object.fromEntries(
          [result.overview, ...result.sections].map((section) => [section.id, null]),
        ),
      },
      meta: {
        model: input.model,
        promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
        voiceVersion: APP_VOICE_VERSION,
        calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
        semanticVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
        contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
        generationAttempts: result.generationAttempts,
        validationStatus: result.validationStatus,
        generatedAt: new Date().toISOString(),
        status: 'ready',
        diagnosticCode,
        freeSelection,
      },
    };
  };

  const primary = materializePackage(generated, null);
  if (isPersonalForecastPackage(primary)) return primary;
  const primaryValidationError = getPersonalForecastPackageValidationError(primary)
    || 'PACKAGE_UNKNOWN_INVALID';
  throw new Error(`PERSONAL_FORECAST_PACKAGE_INVALID:${primaryValidationError}`);
}
