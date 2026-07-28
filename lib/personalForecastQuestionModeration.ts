import {
  APPROVED_PERSONAL_FORECAST_QUESTIONS,
  getApprovedPersonalForecastQuestions,
  normalizePersonalForecastQuestionSearch,
  questionSupportsPeriod,
  type ApprovedPersonalForecastQuestion,
  type LocalizedPersonalForecastQuestion,
  type PersonalForecastQuestionLanguage,
  type PersonalForecastQuestionPeriod,
  type PersonalForecastQuestionTheme,
} from './personalForecastQuestionCatalog';

export const PERSONAL_FORECAST_QUESTION_DAILY_LIMIT = 20;
export const PERSONAL_FORECAST_CUSTOM_QUESTION_DAILY_LIMIT = 3;

export type PersonalForecastQuestionModerationStatus =
  | 'approved'
  | 'pending'
  | 'rejected';

export type PersonalForecastQuestionModerationReason =
  | 'relevant'
  | 'needs_manual_review'
  | 'empty'
  | 'too_short'
  | 'too_long'
  | 'nonsense'
  | 'unsafe'
  | 'off_topic'
  | 'duplicate_catalog'
  | 'duplicate_custom';

export type PersonalForecastQuestionModerationResult = {
  status: PersonalForecastQuestionModerationStatus;
  reason: PersonalForecastQuestionModerationReason;
  normalizedQuestion: string;
  matchedApprovedQuestionId: string | null;
  suggestions: LocalizedPersonalForecastQuestion[];
};

const MAX_CUSTOM_QUESTION_LENGTH = 300;
const MIN_CUSTOM_QUESTION_LETTERS = 5;
const SUGGESTION_LIMIT = 3;

export function normalizePersonalForecastQuestionInput(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    // Format controls (zero-width joiners, bidi controls, BOM, etc.) can split
    // blacklist tokens without changing how the model interprets the text.
    .replace(/\p{Cf}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'а', 'в', 'во', 'для', 'и', 'как', 'ли', 'мне', 'мой', 'моя', 'моей', 'мои',
  'на', 'о', 'об', 'по', 'с', 'со', 'сейчас', 'что', 'это', 'я',
  'a', 'about', 'am', 'and', 'for', 'how', 'i', 'in', 'is', 'me', 'my', 'now',
  'of', 'on', 'or', 'should', 'the', 'this', 'to', 'what',
]);

const THEME_KEYWORDS: Readonly<
  Record<PersonalForecastQuestionTheme, readonly string[]>
> = {
  daily: [
    'сегодня', 'день', 'daily', 'today',
  ],
  relationships: [
    'любов', 'отношен', 'партнер', 'партнёр', 'знакомств', 'роман', 'love',
    'relationship', 'partner', 'dating', 'romance',
  ],
  family: [
    'семь', 'семья', 'родител', 'дом', 'близк', 'family', 'parent', 'home', 'relative',
  ],
  friends: [
    'друг', 'друз', 'общени', 'friend', 'social circle',
  ],
  career: [
    'работ', 'карьер', 'ваканси', 'повышен', 'зарплат', 'руководител', 'job', 'work',
    'career', 'vacancy', 'promotion', 'salary', 'manager',
  ],
  profession: [
    'професси', 'профессион', 'специальност', 'призвани', 'profession',
    'professional', 'occupation', 'field',
  ],
  work_environment: [
    'команд', 'коллег', 'рабочая среда', 'офис', 'удален', 'удалён', 'team',
    'colleague', 'work environment', 'office', 'remote',
  ],
  it: [
    ' it ', 'айти', 'разработ', 'программист', 'аналитик', 'дизайн', 'продукт',
    'техническ', 'software', 'developer', 'programmer', 'analytics', 'product role',
    'technical role',
  ],
  business: [
    'бизнес', 'предприним', 'делов', 'компани', 'стартап', 'business',
    'entrepreneur', 'company', 'startup',
  ],
  money: [
    'деньг', 'доход', 'финанс', 'инвест', 'покупк', 'накоплен', 'бюджет',
    'money', 'income', 'financial', 'invest', 'purchase', 'saving', 'budget',
  ],
  relocation: [
    'переезд', 'переех', 'релокац', 'другой город', 'другая страна', 'move abroad',
    'relocat', 'moving', 'new city', 'new country',
  ],
  decisions: [
    'решен', 'выбор', 'риск', 'договор', 'контракт', 'начать', 'запуск',
    'decision', 'choice', 'risk', 'agreement', 'contract', 'start', 'launch',
  ],
  future: [
    'будущ', 'вперед', 'вперёд', 'ближайшие месяцы', 'год', 'future', 'ahead',
    'coming months', 'year',
  ],
  strengths: [
    'сильн', 'способност', 'талант', 'навык', 'strength', 'ability', 'talent', 'skill',
  ],
};

const UNSAFE_PATTERNS = [
  /самоубий/iu,
  /суицид/iu,
  /самоповреж/iu,
  /навредить\s+себе/iu,
  /убить\s+(?:себя|кого|человека)/iu,
  /как\s+(?:убить|отравить|взорвать)/iu,
  /сексуальн\w*\s+(?:ребен|ребён|несовершеннолет)/iu,
  /kill\s+(?:myself|someone|a person)/iu,
  /suicid/iu,
  /self[\s-]?harm/iu,
  /how\s+to\s+(?:kill|poison|bomb)/iu,
  /sexual\w*\s+(?:child|minor)/iu,
  /\b(?:poison|murder|assassinat\w*|stab|shoot|strangle|kidnap|torture|rape|bomb|explosive|weapon)\b/iu,
  /\b(?:hurt|harm)\s+(?:myself|someone|a person|my boss|my partner|my family)\b/iu,
  /\b(?:launder\s+money|blackmail|doxx|commit\s+fraud|forge\s+(?:a|the)?\s*(?:document|signature))\b/iu,
  /(?:отрав\w*|убийств\w*|задуш\w*|зарез\w*|застрел\w*|похит\w*|пытк\w*|изнасил\w*|взрывчат\w*|оружи\w*)/iu,
  /(?:навред\w*|причин\w+\s+вред)\s+(?:себе|кому|человек\w*|начальник\w*|партнер\w*|партнёр\w*|семь\w*)/iu,
  /(?:отмы\w+\s+ден\w*|шантаж\w*|докс\w*|соверш\w+\s+мошенн\w*|поддел\w+\s+(?:документ\w*|подпис\w*))/iu,
] as const;

const OFF_TOPIC_PATTERNS = [
  /(?:рецепт|как\s+приготовить|сколько\s+калори)/iu,
  /(?:прогноз\s+погоды|температура\s+на\s+улице)/iu,
  /(?:счет|счёт)\s+(?:матча|игры)/iu,
  /(?:ставк\w*\s+на\s+спорт|казино|лотере)/iu,
  /(?:реши|сделай)\s+(?:домашн|контрольн|экзамен)/iu,
  /(?:переведи|перевод)\s+(?:текст|фразу|слово)/iu,
  /(?:напиши|исправь|отладь)\s+(?:код|программу|скрипт)/iu,
  /(?:поставь\s+диагноз|дозировк\w*\s+лекарств|какое\s+лекарство)/iu,
  /(?:как\s+выиграть\s+суд|юридическ\w*\s+стратег)/iu,
  /(?:игнорируй|забудь|отмени)\s+(?:предыдущ[а-яё]*\s+)?(?:инструкц|правил|промпт)/iu,
  /(?:системн[а-яё]*\s+промпт|раскрой\s+(?:инструкц|промпт)|покажи\s+(?:скрыт[а-яё]*\s+)?инструкц)/iu,
  /(?:recipe|how\s+to\s+cook|how\s+many\s+calories)/iu,
  /(?:weather\s+forecast|temperature\s+outside)/iu,
  /(?:match|game)\s+score/iu,
  /(?:sports?\s+bet|casino|lottery)/iu,
  /(?:do|solve)\s+my\s+(?:homework|exam)/iu,
  /translate\s+(?:this|the)\s+(?:text|phrase|word)/iu,
  /(?:write|fix|debug)\s+(?:my\s+)?(?:code|program|script)/iu,
  /(?:diagnose\s+me|medicine\s+dosage|which\s+medicine)/iu,
  /(?:how\s+to\s+win\s+a\s+lawsuit|legal\s+strategy)/iu,
  /(?:ignore|forget|override)\s+(?:all\s+)?(?:previous\s+)?(?:instructions|rules|prompt)/iu,
  /(?:system\s+prompt|reveal\s+(?:the\s+)?(?:instructions|prompt)|show\s+(?:hidden\s+)?instructions)/iu,
  /(?:disregard|bypass|circumvent)\s+(?:all\s+|any\s+|the\s+)?(?:previous\s+)?(?:instructions|rules|policy|policies|prompt)/iu,
  /(?:print|show|return|output|repeat|expose)\s+(?:your\s+|the\s+)?(?:system|developer|hidden)\s+(?:message|prompt|instructions?)/iu,
  /(?:developer\s+message|system\s+message|hidden\s+prompt|jailbreak|prompt\s+injection)/iu,
  /(?:act\s+as|pretend\s+to\s+be)\s+(?:a\s+)?(?:system|developer|unrestricted|unfiltered)/iu,
  /(?:игнорируй|проигнорируй|забудь|отмени|обойди|нарушь|не\s+соблюдай)\s+(?:все\s+|любые\s+|эти\s+)?(?:предыдущ\w+\s+)?(?:инструкц\w*|правил\w*|политик\w*|промпт\w*)/iu,
  /(?:выведи|напечатай|покажи|верни|повтори|раскрой)\s+(?:свой\s+|твой\s+|скрыт\w+\s+)?(?:системн\w+|разработч\w+|служебн\w+)\s+(?:промпт\w*|сообщен\w*|инструкц\w*)/iu,
  /(?:сообщен\w+\s+разработчик\w*|системн\w+\s+сообщен\w*|скрыт\w+\s+промпт\w*|джейлбрейк|инъекц\w+\s+промпт\w*)/iu,
] as const;

// A theme word alone is not enough to send arbitrary user text to the model.
// Auto-approval is intentionally narrow: the question must also be framed as
// a forecast about a period, direction, probability, or calculated influence.
// Everything readable but uncertain stays pending for human moderation.
const FORECAST_FRAME_PATTERNS = [
  /(?:сегодня|завтра|на\s+этой\s+недел|на\s+следующей\s+недел|в\s+этом\s+месяц|в\s+следующем\s+месяц|в\s+этом\s+году|в\s+следующем\s+году|ближайш\w+\s+(?:дн|недел|месяц|год)|этот\s+период|сейчас)/iu,
  /(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/iu,
  /(?:как|что|какие|какой|когда|стоит\s+ли|можно\s+ли|подходит\s+ли|будет\s+ли|есть\s+ли|повлияет\s+ли)\b[^?]{0,240}(?:влияет|повлияет|проявится|изменится|станет|ожидать|перспектив|тенденц|вероят|период|срок|момент|направлен)/iu,
  /(?:стоит\s+ли|можно\s+ли|подходит\s+ли|будет\s+ли|есть\s+ли|когда)\b/iu,
  /(?:today|tomorrow|this\s+week|next\s+week|this\s+month|next\s+month|this\s+year|next\s+year|coming\s+(?:days?|weeks?|months?|years?)|this\s+period|right\s+now)/iu,
  /(?:january|february|march|april|may|june|july|august|september|october|november|december)/iu,
  /(?:how|what|which|when|should|would|will|can|could|is|are|do|does)\b[^?]{0,240}(?:affect|influence|change|develop|become|expect|prospect|trend|likely|probab|period|timing|direction)/iu,
  /(?:should\s+i|would\s+it|will\s+there|is\s+this\s+period|when\s+(?:will|should|can))\b/iu,
] as const;

function padded(value: string): string {
  return ` ${value} `;
}

function keywordMatches(value: string, keyword: string): boolean {
  const normalizedKeyword = normalizePersonalForecastQuestionSearch(keyword);
  if (!normalizedKeyword) return false;
  if (keyword === ' it ') return padded(value).includes(' it ');
  return value.includes(normalizedKeyword);
}

function inferThemes(value: string): PersonalForecastQuestionTheme[] {
  return (Object.entries(THEME_KEYWORDS) as Array<
    [PersonalForecastQuestionTheme, readonly string[]]
  >)
    .filter(([, keywords]) => keywords.some((keyword) => keywordMatches(value, keyword)))
    .map(([theme]) => theme);
}

function significantTokens(value: string): string[] {
  return normalizePersonalForecastQuestionSearch(value)
    .split(' ')
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
}

function tokenSimilarity(left: string, right: string): number {
  const a = new Set(significantTokens(left));
  const b = new Set(significantTokens(right));
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  return intersection / new Set([...a, ...b]).size;
}

export function arePersonalForecastQuestionsDuplicates(
  left: string,
  right: string,
): boolean {
  const a = normalizePersonalForecastQuestionSearch(left);
  const b = normalizePersonalForecastQuestionSearch(right);
  if (!a || !b) return false;
  if (a === b) return true;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (shorter.length >= 12 && longer.includes(shorter) && shorter.length / longer.length >= 0.82) {
    return true;
  }

  const minTokenCount = Math.min(significantTokens(a).length, significantTokens(b).length);
  return minTokenCount >= 4 && tokenSimilarity(a, b) >= 0.8;
}

function findCatalogDuplicate(
  question: string,
): ApprovedPersonalForecastQuestion | null {
  return APPROVED_PERSONAL_FORECAST_QUESTIONS.find((candidate) => (
    arePersonalForecastQuestionsDuplicates(question, candidate.text.ru)
    || arePersonalForecastQuestionsDuplicates(question, candidate.text.en)
  )) || null;
}

function looksNonsensical(value: string): boolean {
  const compact = String(value || '').trim();
  const letters = compact.match(/\p{L}/gu) || [];
  if (letters.length < MIN_CUSTOM_QUESTION_LETTERS) return true;
  if (letters.length / Math.max(compact.length, 1) < 0.35) return true;
  if (/(.)\1{5,}/iu.test(compact)) return true;

  const normalized = normalizePersonalForecastQuestionSearch(compact);
  const tokens = normalized.split(' ').filter(Boolean);
  const uniqueTokens = new Set(tokens);
  if (tokens.length >= 4 && uniqueTokens.size === 1) return true;

  const joinedLetters = letters.join('').toLocaleLowerCase();
  if (joinedLetters.length >= 9 && !/[аеёиоуыэюяaeiouy]/iu.test(joinedLetters)) return true;
  return false;
}

function localize(
  question: ApprovedPersonalForecastQuestion,
  language: PersonalForecastQuestionLanguage,
): LocalizedPersonalForecastQuestion {
  return {
    id: question.id,
    theme: question.theme,
    periods: question.periods,
    text: question.text[language],
  };
}

export function findSimilarApprovedPersonalForecastQuestions(input: {
  question: string;
  language: PersonalForecastQuestionLanguage;
  period: PersonalForecastQuestionPeriod;
  limit?: number;
}): LocalizedPersonalForecastQuestion[] {
  const normalized = normalizePersonalForecastQuestionSearch(input.question);
  const themes = new Set(inferThemes(normalized));
  const limit = Math.max(1, Math.min(input.limit || SUGGESTION_LIMIT, 8));

  const ranked = APPROVED_PERSONAL_FORECAST_QUESTIONS
    .filter((question) => questionSupportsPeriod(question, input.period))
    .map((question, index) => {
      const sameLanguageScore = tokenSimilarity(normalized, question.text[input.language]);
      const otherLanguageScore = tokenSimilarity(
        normalized,
        question.text[input.language === 'ru' ? 'en' : 'ru'],
      );
      const themeScore = themes.has(question.theme) ? 0.55 : 0;
      return {
        question,
        index,
        score: Math.max(sameLanguageScore, otherLanguageScore) + themeScore,
      };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return ranked.slice(0, limit).map(({ question }) => localize(question, input.language));
}

function rejected(
  reason: PersonalForecastQuestionModerationReason,
  normalizedQuestion: string,
  language: PersonalForecastQuestionLanguage,
  period: PersonalForecastQuestionPeriod,
  matchedApprovedQuestionId: string | null = null,
): PersonalForecastQuestionModerationResult {
  const suggestions = findSimilarApprovedPersonalForecastQuestions({
    question: normalizedQuestion,
    language,
    period,
  });
  if (matchedApprovedQuestionId) {
    const exact = APPROVED_PERSONAL_FORECAST_QUESTIONS.find(
      (question) => question.id === matchedApprovedQuestionId
        && questionSupportsPeriod(question, period),
    );
    if (exact) {
      const localized = localize(exact, language);
      return {
        status: 'rejected',
        reason,
        normalizedQuestion,
        matchedApprovedQuestionId,
        suggestions: [
          localized,
          ...suggestions.filter((item) => item.id !== exact.id),
        ].slice(0, SUGGESTION_LIMIT),
      };
    }
  }
  return {
    status: 'rejected',
    reason,
    normalizedQuestion,
    matchedApprovedQuestionId,
    suggestions,
  };
}

export function moderatePersonalForecastCustomQuestion(input: {
  question: string;
  language: PersonalForecastQuestionLanguage;
  period: PersonalForecastQuestionPeriod;
  existingCustomQuestions?: readonly string[];
}): PersonalForecastQuestionModerationResult {
  const raw = normalizePersonalForecastQuestionInput(input.question);
  const normalizedQuestion = normalizePersonalForecastQuestionSearch(raw);

  if (!normalizedQuestion) {
    return rejected('empty', normalizedQuestion, input.language, input.period);
  }
  if ((raw.match(/\p{L}/gu) || []).length < MIN_CUSTOM_QUESTION_LETTERS) {
    return rejected('too_short', normalizedQuestion, input.language, input.period);
  }
  if (raw.length > MAX_CUSTOM_QUESTION_LENGTH) {
    return rejected('too_long', normalizedQuestion, input.language, input.period);
  }
  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(raw))) {
    return rejected('unsafe', normalizedQuestion, input.language, input.period);
  }
  if (looksNonsensical(raw)) {
    return rejected('nonsense', normalizedQuestion, input.language, input.period);
  }
  if (OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(raw))) {
    return rejected('off_topic', normalizedQuestion, input.language, input.period);
  }

  const catalogDuplicate = findCatalogDuplicate(raw);
  if (catalogDuplicate) {
    return rejected(
      'duplicate_catalog',
      normalizedQuestion,
      input.language,
      input.period,
      catalogDuplicate.id,
    );
  }

  const customDuplicate = (input.existingCustomQuestions || []).some(
    (question) => arePersonalForecastQuestionsDuplicates(raw, question),
  );
  if (customDuplicate) {
    return rejected('duplicate_custom', normalizedQuestion, input.language, input.period);
  }

  const suggestions = findSimilarApprovedPersonalForecastQuestions({
    question: raw,
    language: input.language,
    period: input.period,
  });
  if (
    inferThemes(normalizedQuestion).length > 0
    && FORECAST_FRAME_PATTERNS.some((pattern) => pattern.test(raw))
  ) {
    return {
      status: 'approved',
      reason: 'relevant',
      normalizedQuestion,
      matchedApprovedQuestionId: null,
      suggestions,
    };
  }

  return {
    status: 'pending',
    reason: 'needs_manual_review',
    normalizedQuestion,
    matchedApprovedQuestionId: null,
    suggestions: suggestions.length
      ? suggestions
      : getApprovedPersonalForecastQuestions({
          language: input.language,
          period: input.period,
        }).slice(0, SUGGESTION_LIMIT),
  };
}

export const moderateCustomPersonalForecastQuestion =
  moderatePersonalForecastCustomQuestion;
