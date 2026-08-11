import type { NatalChartData, UserProfile } from '../types';
import type { NatalChartDataV2 } from './natalChartV2Types';
import { isNatalChartDataV2 } from './natal/canonicalReport';
import {
  APP_VOICE_VERSION,
  getAppSystemVoice,
  hasAppVoiceViolation,
} from './appVoice';
import {
  createLunaStructuredResponse,
  type StrictJsonSchema,
} from './openaiResponses';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  FORECAST_VISUAL_CUES,
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
  type ForecastVisualCue,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
  type PersonalForecastWindow,
} from './personalForecastContract';
type ForecastWriterLanguage = 'ru' | 'en';

export const PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS = 2;

/**
 * A strict monthly response needs room for the model's internal work as well
 * as the 130–175-word JSON payload. Day and week keep their proven budget.
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
  day: 95,
  week: 120,
  month: 145,
};

export const PERSONAL_FORECAST_WORD_MINIMUMS: Record<PersonalForecastPeriod, number> = {
  day: 60,
  week: 80,
  month: 100,
};

export const PERSONAL_FORECAST_MAX_PARAGRAPHS: Record<PersonalForecastPeriod, number> = {
  day: 2,
  week: 2,
  month: 2,
};

export const PERSONAL_FORECAST_PHRASE_WORD_LIMITS = {
  minimum: 3,
  maximum: 8,
} as const;

const PERIOD_EDITORIAL_BRIEFS: Record<ForecastWriterLanguage, Record<PersonalForecastPeriod, string>> = {
  ru: {
    day: 'Один день: поймай одну живую сцену выбора, контакта или личного жеста. Не пытайся объяснить всю жизнь.',
    week: 'Неделя: опиши одну линию поведения, которая поможет человеку не потерять себя среди дел и людей.',
    month: 'Месяц: расскажи о взрослом повороте или новом направлении, которое можно прожить без надрыва и суеты.',
  },
  en: {
    day: 'One day: catch one alive scene of choice, contact, or a personal gesture. Do not explain the whole life.',
    week: 'One week: describe one behavioural thread that helps the reader stay themselves among work and people.',
    month: 'One month: tell of a grown-up turn or a new direction that can unfold without drama or rush.',
  },
};

const ADVICE_LENSES: readonly string[] = [
  'one honest conversation',
  'one protected hour for yourself',
  'one unfinished practical task',
  'one boundary stated without apology',
  'one small change of scenery',
  'one deliberate yes or no',
  'one act of care for the body',
  'one idea worth saying aloud',
];

function pickEditorialCue(seed: string, options: readonly string[]): string {
  return options[Math.abs(stableHash(seed)) % options.length] || options[0] || '';
}

export function getPersonalForecastSystemPrompt(
  language: ForecastWriterLanguage,
  period: PersonalForecastPeriod = 'day',
): string {
  const limits = `${PERSONAL_FORECAST_WORD_MINIMUMS[period]} to ${PERSONAL_FORECAST_WORD_LIMITS[period]} words`;
  const brief = PERIOD_EDITORIAL_BRIEFS[language][period];
  const ru = language === 'ru';
  const task = ru
    ? `Ты пишешь личный прогноз как короткий, красивый и точный рассказ о человеке. Натальный профиль — твоя постоянная оптика, а не повод перечислять астрологические термины. Не обещай события и не выдавай догадки за факты.

${brief}

Текст должен ощущаться написанным для одного человека: с наблюдением, характером и ясной мыслью. Не превращай его в отчёт, инструкцию, список сфер жизни или тревожное предупреждение. Не начинай абзацы словами «с деньгами», «в общении», «при этом», «важно» и не повторяй одну мысль другими словами. Оставь только то, что хочется дочитать.

Заголовок — 3–8 слов, дерзкий, психологический и живой; не «Главный акцент», не «Ясность вместо…», не «Гибкость важнее…». Совет обязан быть другим по теме, чем основной текст, и не может начинаться с «проверь», «запиши», «составь» или «зафиксируй».

Не дели текст на утро, день, вечер, начало/середину/конец периода, дни недели, выходные или даты. Не используй эзотерику, астрологические слова, диагнозы и обращения на «вы».

Верни только валидный JSON. Во всех evidence_ids укажи ровно ["profile:personal"] — это служебная ссылка, читатель её не видит.`
    : `Write a personal forecast as a short, beautiful, precise story about one person. The natal profile is a stable lens, not a reason to list astrology terms. Do not promise events or present guesses as facts.

${brief}

The text must feel written for one person: observant, characterful, and clear. Never turn it into a report, instruction list, mandatory life areas, or an anxious warning. Do not begin paragraphs with filler such as “In finances”, “In communication”, “At the same time”, or “It is important”, and do not repeat one thought in different words.

The headline has 3–8 words and must be bold, psychological, and alive; never “Main focus”, “Clarity instead of…”, or “Flexibility matters…”. Advice must use a different theme from the story and must not begin with “check”, “write down”, “make a list”, or “document”.

Never divide the text into morning, afternoon, evening, beginning/middle/end, weekdays, weekends, or dates. No mysticism, astrology terms, diagnoses, or formal address.

Return valid JSON only. Every evidence_ids value must be exactly ["profile:personal"]; it is a service reference and is never shown to the reader.`;
  return `${getAppSystemVoice(language)}\n\nPERSONAL FORECAST TASK\n- Produce ${limits} in total, including headline and advice.\n- Use one or two natural paragraphs; no Markdown and no subheadings.\n- Advice is exactly one sentence, 6–16 words.\n- Pick one visual_cue that matches the emotional image of the story.\n\n${task}`;
}

type GeneratedTextBlock = {
  text?: unknown;
  evidence_ids?: unknown;
};

type GeneratedFeedPayload = {
  phrase?: GeneratedTextBlock | null | unknown;
  paragraphs?: GeneratedTextBlock[];
  advice?: GeneratedTextBlock | null | unknown;
  visual_cue?: {
    key?: unknown;
    evidence_ids?: unknown;
  } | null | unknown;
};

/**
 * This is intentionally narrower than the persisted forecast package. Luna
 * writes only user copy and evidence references; the server materializes and
 * persists all trusted package metadata after semantic validation.
 */
export const PERSONAL_FORECAST_RESPONSE_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    phrase: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        evidence_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['text', 'evidence_ids'],
      additionalProperties: false,
    },
    paragraphs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          evidence_ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['text', 'evidence_ids'],
        additionalProperties: false,
      },
    },
    advice: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        evidence_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['text', 'evidence_ids'],
      additionalProperties: false,
    },
    visual_cue: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          enum: [
            'communication',
            'decisions',
            'work_money',
            'home_family',
            'friends',
            'love',
            'mood',
            'opportunities',
          ],
        },
        evidence_ids: { type: 'array', items: { type: 'string' } },
      },
      required: ['key', 'evidence_ids'],
      additionalProperties: false,
    },
  },
  required: ['phrase', 'paragraphs', 'advice', 'visual_cue'],
  additionalProperties: false,
};

type FreeGeneratedBlock = {
  text: string;
  role: 'lead' | 'insight' | 'action';
  evidenceIds: string[];
};

type FreeGeneratedSection = {
  title: string | null;
  evidenceIds: string[];
  visualCue: ForecastVisualCue | null;
  blocks: FreeGeneratedBlock[];
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

function profileAdviceLenses(input: {
  profile: UserProfile;
  period: PersonalForecastPeriod;
  periodKey: string;
}): string[] {
  const seed = `${input.profile.id || input.profile.birthDate || 'guest'}:${input.periodKey}:${input.period}`;
  const first = pickEditorialCue(seed, ADVICE_LENSES);
  const second = pickEditorialCue(`${seed}:next`, ADVICE_LENSES.filter((item) => item !== first));
  return [first, second].filter(Boolean);
}

function profileNarrativeDirection(input: {
  profile: UserProfile;
  period: PersonalForecastPeriod;
  periodKey: string;
}): string {
  const directions = [
    'a choice that makes more room for the reader',
    'the difference between being visible and performing',
    'a small act of courage without proving anything',
    'a relationship with pace, attention, and private space',
    'the permission to choose the more honest version of a plan',
    'a quiet return to something the reader actually wants',
  ];
  return pickEditorialCue(
    `${input.profile.id || input.profile.birthDate || 'guest'}:${input.periodKey}:${input.period}:story`,
    directions,
  );
}

export function buildPersonalForecastFeedPrompt(input: {
  language: ForecastWriterLanguage;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  profile: UserProfile;
  natalContext: Record<string, unknown>;
  repairErrors?: string[];
}): string {
  const repair = input.repairErrors?.length
    ? `\nPREVIOUS RESPONSE ERRORS (fix these only):\n${input.repairErrors.join('\n')}`
    : '';
  const profile = {
    name: input.profile.name.trim().slice(0, 80),
    birth_date: input.profile.birthDate || null,
    language: input.language,
  };
  return `Language: ${input.language}.
Period: ${input.period}. Window: ${input.window.periodStart} — ${input.window.periodEnd}.

Personal profile:
${JSON.stringify(profile, null, 2)}

Natal profile:
${JSON.stringify({ natal_profile: input.natalContext }, null, 2)}

Editorial plan:
${JSON.stringify({
    story_direction: profileNarrativeDirection({
      profile: input.profile,
      period: input.period,
      periodKey: input.window.periodKey,
    }),
    advice_lenses: profileAdviceLenses({
      profile: input.profile,
      period: input.period,
      periodKey: input.window.periodKey,
    }),
  }, null, 2)}${repair}`;
}

function modelText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
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

function generatedVisualCue(
  value: unknown,
  availableEvidenceIds: ReadonlySet<string>,
): { key: ForecastVisualCue; evidenceIds: string[] } | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as { key?: unknown; evidence_ids?: unknown };
  const key = typeof candidate.key === 'string'
    && FORECAST_VISUAL_CUES.includes(candidate.key as ForecastVisualCue)
    ? candidate.key as ForecastVisualCue
    : null;
  const evidenceIds = validatedEvidenceIds(candidate.evidence_ids, availableEvidenceIds);
  return key && evidenceIds ? { key, evidenceIds } : null;
}

export function validateFreeGeneratedForecastFeed(
  raw: GeneratedFeedPayload,
  availableEvidenceIds: ReadonlySet<string> = new Set(),
  period: PersonalForecastPeriod = 'day',
): ValidatedFreeWriterResult {
  if (!Array.isArray(raw.paragraphs)) {
    return { sections: [], errors: ['payload requires paragraphs with valid evidence_ids'] };
  }
  const phrase = generatedBlock(raw.phrase, 'lead', availableEvidenceIds);
  const visualCue = generatedVisualCue(raw.visual_cue, availableEvidenceIds);
  const phraseWords = phrase ? wordCount(phrase.text) : 0;
  const rawParagraphs = raw.paragraphs || [];
  const paragraphs = rawParagraphs.map((paragraph, index) => (
    generatedBlock(paragraph, index === 0 ? 'lead' : 'insight', availableEvidenceIds)
  ));
  if (!paragraphs.length || paragraphs.some((paragraph) => !paragraph)) {
    return { sections: [], errors: ['a paragraph has missing, duplicated, or unknown evidence_ids'] };
  }
  const errors: string[] = [];
  if (!phrase) {
    errors.push('phrase requires valid text and existing evidence_ids');
  } else if (
    phraseWords < PERSONAL_FORECAST_PHRASE_WORD_LIMITS.minimum
    || phraseWords > PERSONAL_FORECAST_PHRASE_WORD_LIMITS.maximum
  ) {
    errors.push(
      `phrase has ${phraseWords} words; expected ${PERSONAL_FORECAST_PHRASE_WORD_LIMITS.minimum}-${PERSONAL_FORECAST_PHRASE_WORD_LIMITS.maximum}`,
    );
  }
  if (raw.visual_cue !== undefined && raw.visual_cue !== null && !visualCue) {
    errors.push('visual_cue requires an allowed key and existing evidence_ids');
  }
  if (rawParagraphs.length > PERSONAL_FORECAST_MAX_PARAGRAPHS[period]) {
    errors.push(
      `forecast has ${rawParagraphs.length} paragraphs; maximum for ${period} is ${PERSONAL_FORECAST_MAX_PARAGRAPHS[period]}`,
    );
  }
  const readingBlocks = paragraphs.filter((paragraph): paragraph is FreeGeneratedBlock => !!paragraph);
  let adviceSection: FreeGeneratedSection | null = null;
  let adviceBlock: FreeGeneratedBlock | null = null;
  if (raw.advice !== null && raw.advice !== undefined) {
    const advice = generatedBlock(raw.advice, 'action', availableEvidenceIds);
    if (!advice) {
      errors.push('advice has missing, duplicated, or unknown evidence_ids');
    } else if (wordCount(advice.text) > 16) {
      errors.push(`advice has ${wordCount(advice.text)} words; maximum is 16`);
    } else {
      adviceBlock = advice;
      adviceSection = {
        title: null,
        evidenceIds: advice.evidenceIds,
        visualCue: null,
        blocks: [advice],
      };
    }
  }
  if (!adviceBlock) {
    errors.push(`${period} forecast requires one concrete action`);
  }
  const visibleCopy = [phrase?.text, ...readingBlocks.map((block) => block.text), adviceBlock?.text]
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
  if (visibleCopy.some(hasAppVoiceViolation)) {
    errors.push('visible forecast copy contains a banned filler phrase');
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
  if (errors.length) return { sections: [], errors };
  const overviewEvidenceIds = [...new Set(readingBlocks.flatMap((block) => block.evidenceIds))];
  return {
    errors: [],
    sections: [{
      title: phrase?.text || null,
      evidenceIds: overviewEvidenceIds,
      visualCue: visualCue?.key || null,
      blocks: readingBlocks,
    }, ...(adviceSection ? [adviceSection] : [])],
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
        && ['paragraphs', 'advice']
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
    : `semantic:direct-${input.sectionIndex}-${stableHash(`${title || ''}:${input.section.evidenceIds.join(':')}`).toString(36)}`;
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
    semanticFingerprint: `direct:${stableHash(`${input.section.blocks.flatMap((block) => block.evidenceIds).join(':')}:${input.sectionIndex}`).toString(36)}`,
    importance: Math.max(1, 100 - input.sectionIndex),
    visualTag: input.section.visualCue || 'personal-profile',
    visualCue: input.overview ? input.section.visualCue : null,
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
  onMetrics?: (metrics: { model: string; inputTokens: number; outputTokens: number; latencyMs: number; validationPassed: boolean }) => void;
}): Promise<GenerationResult> {
  const availableEvidenceIds = new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]);
  const evidenceViews: Record<string, ForecastEvidenceView> = {
    [PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]: {
      id: PERSONAL_FORECAST_PROFILE_EVIDENCE_ID,
      factor: input.language === 'ru' ? 'Личный натальный профиль' : 'Personal natal profile',
      orb: null,
      status: 'active',
      period: input.window.periodKey,
      meaning: input.language === 'ru'
        ? 'Текст собран из сохранённого натального профиля и контекста периода.'
        : 'The reading uses the saved natal profile and the selected period context.',
    },
  };

  let errors: string[] = [];
  let writerRequestFailures = 0;
  let retryAfterIncomplete = false;
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
    );
    if (!validation.errors.length) {
      const [rawOverview, rawAdvice] = validation.sections;
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
      const sections = rawAdvice
        ? [materializeDirectSection({
            section: rawAdvice,
            evidenceViews,
            language: input.language,
            overview: false,
            sectionIndex: 1,
          })]
        : [];
      return {
        overview,
        sections,
        generationAttempts: attempt as 1 | 2,
        validationStatus: 'valid',
      };
    }
    input.onMetrics?.({ model: input.model, ...usage, latencyMs: Date.now() - startedAt, validationPassed: false });
    errors = validation.errors;
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
 * not calculate transits, aspects, houses, or any other period-specific data.
 */
export function buildPersonalForecastNatalContext(chart: NatalChartData): Record<string, unknown> {
  const coreKeys = ['sun', 'moon', 'mercury', 'venus', 'mars'] as const;
  if (isNatalChartDataV2(chart)) {
    const v2 = chart as unknown as NatalChartDataV2;
    const core = Object.fromEntries(coreKeys.map((key) => {
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
      core,
      ascendant: v2.chartQuality.ascendantReliable && v2.angles.ascendant
        ? { sign: v2.angles.ascendant.sign }
        : null,
    };
  }
  const legacyCore = Object.fromEntries(coreKeys.map((key) => [
    key,
    compactLegacyPosition(chart[key]),
  ]));
  return {
    source: 'saved_natal_chart',
    birth_time_quality: chart.birthTimeQuality || chart.chartQuality?.birthTimeQuality || 'unknown',
    core: legacyCore,
    ascendant: chart.rising ? { sign: chart.rising.sign } : null,
  };
}

export async function generatePersonalForecastPackage(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
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
          factor: language === 'ru' ? 'Личный натальный профиль' : 'Personal natal profile',
          orb: null,
          status: 'active' as const,
          period: input.window.periodKey,
          meaning: language === 'ru'
            ? 'Текст собран из сохранённой натальной карты и личного профиля.'
            : 'The reading uses the saved natal chart and personal profile.',
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
