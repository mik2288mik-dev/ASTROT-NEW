import { formatInTimeZone } from 'date-fns-tz';
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
import {
  calculatePersonalForecastEvidence,
  type EvidenceCalculationResult,
} from './personalForecastEvidence';
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
  day: 1_200,
  week: 1_200,
  month: 3_000,
};

export function getPersonalForecastWriterMaxOutputTokens(
  period: PersonalForecastPeriod,
  retryAfterIncomplete = false,
): number {
  if (period === 'month' && retryAfterIncomplete) return 4_000;
  return PERSONAL_FORECAST_WRITER_MAX_OUTPUT_TOKENS[period];
}

/** Keep the month request focused enough for a strict structured response. */
export const PERSONAL_FORECAST_MAX_PROMPT_EVIDENCE: Record<PersonalForecastPeriod, number> = {
  day: 48,
  week: 64,
  month: 24,
};

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

export function getPersonalForecastSystemPrompt(
  language: ForecastWriterLanguage,
  period: PersonalForecastPeriod = 'day',
): string {
  const ruPeriodRule: Record<PersonalForecastPeriod, string> = {
    day: 'Опиши актуальное состояние одного дня: один главный внутренний или жизненный акцент, одну-две конкретные возможности либо предостережения и полезное действие на сегодня. Не делай выводов о более долгом будущем.',
    week: 'Опиши один тренд, который проходит через всю неделю: главную задачу, только подтверждённые evidence сферы жизни и способ не распыляться. Не превращай это в последовательность событий.',
    month: 'Опиши один глобальный тренд месяца: ключевой вызов или решение, возможное личное изменение и точку опоры. Не превращай текст в план из нескольких этапов.',
  };
  const enPeriodRule: Record<PersonalForecastPeriod, string> = {
    day: 'Describe the current state of one day: one main inner or practical focus, one or two concrete opportunities or cautions, and one concrete action for today. Do not draw conclusions about the longer future.',
    week: 'Describe one trend that runs through the whole week: its main task, only evidence-relevant life areas, and one way to avoid spreading yourself thin. Do not turn it into a sequence of events.',
    month: 'Describe one global monthly trend: the key challenge or decision, a possible personal change, and a point of support. Do not turn it into a multi-stage plan.',
  };
  const wordLimit = PERSONAL_FORECAST_WORD_LIMITS[period];
  const wordMinimum = PERSONAL_FORECAST_WORD_MINIMUMS[period];
  const ruAdviceRule: Record<PersonalForecastPeriod, string> = {
    day: 'Совет обязателен: верни одно конкретное действие, которое можно сделать сегодня и которое прямо следует из разбора.',
    week: 'Совет обязателен: верни одно конкретное правило или действие, которое поможет прожить эту неделю.',
    month: 'Совет обязателен: верни одно конкретное действие, которое поможет направить этот месяц.',
  };
  const enAdviceRule: Record<PersonalForecastPeriod, string> = {
    day: 'Advice is required: return one concrete action for today that follows directly from the reading.',
    week: 'Advice is required: return one concrete rule or action that helps through this week.',
    month: 'Advice is required: return one concrete action that helps direct this month.',
  };
  const phraseRule = 'Return one headline of 3 to 8 words. It must feel like a sharp, personal observation, not a slogan, motivational poster, or a report title. The headline names the story; it does not explain it.';
  const ruPhraseRule = 'Верни один заголовок из 3–8 слов. Это острая личная мысль, а не лозунг, мотивирующая открытка или название отчёта. Заголовок называет сюжет, но не пересказывает его.';
  const editorialDirection: Record<PersonalForecastPeriod, string> = {
    day: 'For today, write a small, recognisable personal scene: a choice, conversation, impulse, or pause that carries the main evidence. Do not audit every life area. Keep one or two concise paragraphs. The advice must be one small action you can finish today, not a checklist or a restatement of the paragraph.',
    week: 'For the week, write one unfolding personal story about a repeating way of acting: a boundary, role, or strategy. Keep no more than two concise paragraphs and do not turn it into an executive summary. The advice must be a reusable rule for the week, not a one-off errand or a list.',
    month: 'For the month, write a personal story about direction, appetite, and capacity rather than daily logistics. Keep no more than two concise paragraphs; make it read like a clear note from someone who knows the reader, not a monthly report. The advice must be one meaningful commitment for the month, not a repeated daily-detail check.',
  };
  const ruEditorialDirection: Record<PersonalForecastPeriod, string> = {
    day: 'Для прогноза на сегодня напиши маленькую узнаваемую сцену: выбор, разговор, импульс или паузу, в которой виден главный смысл расчёта. Не проводи ревизию всех сфер жизни. Оставь один-два коротких абзаца. Совет — одно небольшое действие, которое реально завершить сегодня; не чек-лист и не повтор абзаца.',
    week: 'Для недели напиши один разворачивающийся личный сюжет о повторяющемся способе действовать: границе, роли или стратегии. Не больше двух коротких абзацев и не превращай текст в служебную сводку. Совет — применимое правило на неделю, а не разовое поручение или список.',
    month: 'Для месяца напиши личный сюжет о направлении, аппетите и запасе сил, а не о ежедневной логистике. Не больше двух коротких абзацев: это должна быть ясная записка человеку, которого ты знаешь, а не месячный отчёт. Совет — одно значимое обязательство на месяц, а не повторная проверка мелких дел.',
  };

  if (language === 'ru') {
    return `${getAppSystemVoice('ru')}

ЗАДАЧА ДЛЯ ЛИЧНОГО ПРОГНОЗА
- Прочитай весь массив evidence как единую картину периода. Сам выбери главный вывод; не перечисляй факторы подряд и не повторяй одну мысль разными словами.
- Пиши только о том, что подтверждено переданными evidence и фактическим natal context. Ничего не рассчитывай и не придумывай заново.
- Обращайся к читателю только на «ты». Формы «вы», «вам», «ваш» и множественные повелительные формы запрещены.
- Пиши о периоде только простым человеческим языком. Названия планет, знаков, домов, аспектов, транзитов и другие астрологические термины в абзацах и совете запрещены и будут отклонены проверкой. Точные факты интерфейс покажет отдельно по evidence_ids.
- Выбирай тон по всей совокупности evidence. Спокойные, благоприятные и сложные проявления описывай только в той пропорции, в которой они подтверждены расчётом; ни один тип аспекта не становится главной темой автоматически.
- Весь видимый прогноз — фраза, абзацы и совет — должен занимать от ${wordMinimum} до ${wordLimit} слов.
- ${ruPhraseRule}
- Напиши короткий цельный текст с естественными абзацами только там, где меняется мысль. Не генерируй подзаголовки, Markdown, списки, обязательные сферы или обязательное предупреждение. Единственный заголовок верни в поле phrase.
- Никогда не дели прогноз на временные отрезки. Запрещены указания на утро, день, вечер, начало, середину или конец периода, дни недели, выходные, первую или вторую часть периода и любые относительные сроки.
- ${ruPeriodRule[period]}
- ${ruEditorialDirection[period]}
- Каждый абзац обязан вернуть собственные существующие evidence_ids. Не ставь один и тот же список автоматически во все абзацы.
- ${ruAdviceRule[period]} Не вводи советом новый запрет, риск или тему.
- Совет, если он есть, должен быть одним предложением не более 16 слов и вернуть только существующие evidence_ids.
- Выбери один visual_cue из допустимого списка. Это не дополнительный текст для читателя, а тема единственной визуальной паузы внутри прогноза. Выбирай только тему, которую подтверждают её evidence_ids.
- Ответ — только валидный JSON без Markdown.

Верни строго:
{"phrase":{"text":"короткий личный заголовок","evidence_ids":["существующий evidence id"]},"paragraphs":[{"text":"короткий цельный разбор","evidence_ids":["существующий evidence id"]}],"advice":{"text":"короткое конкретное действие","evidence_ids":["существующий evidence id"]},"visual_cue":{"key":"communication|decisions|work_money|home_family|friends|love|mood|opportunities","evidence_ids":["существующий evidence id"]}}`;
  }

  return `${getAppSystemVoice('en')}

PERSONAL FORECAST TASK
- Read the entire evidence array as one picture of the period. Choose the main conclusion yourself; do not list factors mechanically or repeat the same point in different words.
- Use only the supplied evidence and factual natal context. Never recalculate or invent astrology, events, biography, or diagnoses.
- Address the reader consistently in the direct singular voice used by the app.
- Write only in ordinary human language. Planet, sign, house, aspect, transit, and other astrology terms are forbidden in paragraphs and advice and will be rejected by validation. The interface reveals exact facts separately through evidence_ids.
- Let the complete evidence set determine the tone. Present calm, favourable, and difficult manifestations only in the proportion supported by the calculation; no aspect type is automatically the main story.
- The complete visible forecast — phrase, paragraphs, and advice — has from ${wordMinimum} to ${wordLimit} words.
- ${phraseRule}
- Write one short coherent text and split it into natural paragraphs only when the thought changes. Do not generate subheadings, Markdown, lists, mandatory life areas, or a mandatory warning. Return the only headline in phrase.
- Never divide the forecast into time segments. Do not mention morning, afternoon, evening, the beginning, middle, or end of the period, weekdays, weekends, the first or second part of a period, or any relative deadline.
- ${enPeriodRule[period]}
- ${editorialDirection[period]}
- Every paragraph must return its own existing evidence_ids. Do not automatically attach the same list to every paragraph.
- ${enAdviceRule[period]} Never introduce a new restriction, risk, or topic through advice.
- Advice is one sentence of no more than 16 words and cites only existing evidence_ids.
- Select one visual_cue from the allowed list. It is not extra reader copy: it is the theme for the reading's single visual pause. Its evidence_ids must support the selected theme.
- Return valid JSON only, with no Markdown.

Return exactly:
{"phrase":{"text":"short personal headline","evidence_ids":["existing evidence id"]},"paragraphs":[{"text":"short coherent reading","evidence_ids":["existing evidence id"]}],"advice":{"text":"short concrete action","evidence_ids":["existing evidence id"]},"visual_cue":{"key":"communication|decisions|work_money|home_family|friends|love|mood|opportunities","evidence_ids":["existing evidence id"]}}`;
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

type EvidenceCalculatedHookResult = {
  calculationSnapshotId?: number | null;
} | void;

type FactualEvidencePayload = {
  id: string;
  kind: EvidenceCalculationResult['evidence'][number]['kind'];
  transit_planet: string | null;
  natal_point: string | null;
  aspect: string | null;
  house: number | null;
  orb: number | null;
  status: EvidenceCalculationResult['evidence'][number]['status'];
  starts_at_local: string | null;
  exact_at_local: string | null;
  ends_at_local: string | null;
  motion: EvidenceCalculationResult['evidence'][number]['motion'] | null;
  ingress: EvidenceCalculationResult['evidence'][number]['ingress'] | null;
};

function evidenceFactTime(item: EvidenceCalculationResult['evidence'][number]): number {
  const raw = item.exactAt || item.startsAt || item.endsAt;
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function evidenceStatusPriority(
  status: EvidenceCalculationResult['evidence'][number]['status'],
): number {
  return {
    exact: 5,
    active: 4,
    applying: 3,
    separating: 2,
    unknown: 1,
  }[status];
}

function evidenceDiversityKey(item: EvidenceCalculationResult['evidence'][number]): string {
  return [
    item.kind,
    item.transitPlanet || '',
    item.natalPoint || '',
    item.aspect || '',
    item.house ?? '',
  ].join(':');
}

/**
 * The month can contain dozens of overlapping observations. Preserve the
 * strongest data while forcing the prompt to retain different evidence kinds
 * and not repeat one transit-to-natal pattern for the whole response.
 */
export function selectPersonalForecastPromptEvidence(
  calculatedEvidence: EvidenceCalculationResult['evidence'],
  period: PersonalForecastPeriod,
): EvidenceCalculationResult['evidence'] {
  const limit = PERSONAL_FORECAST_MAX_PROMPT_EVIDENCE[period];
  if (calculatedEvidence.length <= limit) return calculatedEvidence;

  const ranked = [...calculatedEvidence].sort((a, b) => (
    b.strength - a.strength
    || evidenceStatusPriority(b.status) - evidenceStatusPriority(a.status)
    || (a.orb ?? Number.MAX_SAFE_INTEGER) - (b.orb ?? Number.MAX_SAFE_INTEGER)
    || evidenceFactTime(a) - evidenceFactTime(b)
    || a.id.localeCompare(b.id)
  ));
  const selected: EvidenceCalculationResult['evidence'] = [];
  const selectedIds = new Set<string>();
  const selectedKinds = new Set<string>();
  const add = (item: EvidenceCalculationResult['evidence'][number]) => {
    if (selected.length >= limit || selectedIds.has(item.id)) return;
    selected.push(item);
    selectedIds.add(item.id);
  };

  for (const item of ranked) {
    if (selectedKinds.has(item.kind)) continue;
    add(item);
    selectedKinds.add(item.kind);
  }

  const selectedPatterns = new Set(selected.map(evidenceDiversityKey));
  for (const item of ranked) {
    const pattern = evidenceDiversityKey(item);
    if (selectedPatterns.has(pattern)) continue;
    add(item);
    selectedPatterns.add(pattern);
  }

  for (const item of ranked) add(item);
  return selected;
}

function localForecastTimestamp(value: string | null, timezone: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd HH:mm');
}

function factualEvidencePayload(
  calculatedEvidence: EvidenceCalculationResult['evidence'],
  window: PersonalForecastWindow,
  period: PersonalForecastPeriod,
): FactualEvidencePayload[] {
  return [...selectPersonalForecastPromptEvidence(calculatedEvidence, period)]
    .sort((a, b) => (
      evidenceFactTime(a) - evidenceFactTime(b)
      || (a.orb ?? Number.MAX_SAFE_INTEGER) - (b.orb ?? Number.MAX_SAFE_INTEGER)
      || a.id.localeCompare(b.id)
    ))
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      transit_planet: item.transitPlanet || null,
      natal_point: item.natalPoint || null,
      aspect: item.aspect || null,
      house: item.house ?? null,
      orb: item.orb ?? null,
      status: item.status,
      starts_at_local: localForecastTimestamp(item.startsAt || null, window.timezone),
      exact_at_local: localForecastTimestamp(item.exactAt || null, window.timezone),
      ends_at_local: localForecastTimestamp(item.endsAt || null, window.timezone),
      motion: item.motion || null,
      ingress: item.ingress || null,
    }));
}

export function buildPersonalForecastFeedPrompt(input: {
  language: ForecastWriterLanguage;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  calculatedEvidence: EvidenceCalculationResult['evidence'];
  natalContext?: Record<string, unknown>;
  /** @deprecated accepted for source compatibility; never included in the prompt. */
  canonicalNatalReport?: unknown;
  repairErrors?: string[];
}): string {
  const evidence = factualEvidencePayload(
    input.calculatedEvidence,
    input.window,
    input.period,
  );
  const repair = input.repairErrors?.length
    ? `\nPREVIOUS RESPONSE ERRORS (fix these only):\n${input.repairErrors.join('\n')}`
    : '';
  return `Language: ${input.language}.
Period: ${input.period}. Window: ${input.window.periodStart} — ${input.window.periodEnd}. Timezone: ${input.window.timezone}.
Use the JSON contract and rules from the system instruction. Every statement must be grounded in the supplied evidence_ids. Treat natal context only as factual background and do not infer missing time-dependent data.

Factual natal context:
${JSON.stringify(input.natalContext ?? {}, null, 2)}

Calculated evidence:
${JSON.stringify(evidence, null, 2)}${repair}`;
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
    ? 'В полном разборе этого периода раскрыты конкретные проявления рассчитанных факторов.'
    : 'The full reading of this period explains the concrete manifestations of its calculated factors.';
  const factualAnchorPrefix = input.language === 'ru'
    ? 'Расчётные факты этой секции: '
    : 'Calculated facts cited by this section: ';
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
    visualTag: 'calculated',
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
  calculatedEvidence: EvidenceCalculationResult['evidence'];
  evidenceViews: Record<string, ForecastEvidenceView>;
  natalContext: Record<string, unknown>;
  onMetrics?: (metrics: { model: string; inputTokens: number; outputTokens: number; latencyMs: number; validationPassed: boolean }) => void;
}): Promise<GenerationResult> {
  const promptEvidence = selectPersonalForecastPromptEvidence(
    input.calculatedEvidence,
    input.period,
  );
  const availableEvidenceIds = new Set(promptEvidence.map((item) => item.id));
  if (!availableEvidenceIds.size) throw new Error('PERSONAL_FORECAST_EVIDENCE_EMPTY');

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
          calculatedEvidence: promptEvidence,
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
        evidenceViews: input.evidenceViews,
        language: input.language,
        overview: true,
        sectionIndex: 0,
      });
      input.onMetrics?.({ model: input.model, ...usage, latencyMs: Date.now() - startedAt, validationPassed: true });
      const sections = rawAdvice
        ? [materializeDirectSection({
            section: rawAdvice,
            evidenceViews: input.evidenceViews,
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

function normalizeNatalPointKey(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim().replace(/[\s_-]/gu, '').toLowerCase();
  const aliases: Record<string, string> = {
    asc: 'ascendant',
    rising: 'ascendant',
    midheaven: 'mc',
    northnode: 'northNode',
    southnode: 'southNode',
  };
  return normalized ? aliases[normalized] || normalized : null;
}

export function buildPersonalForecastNatalContext(
  chart: NatalChartData,
  evidence: EvidenceCalculationResult['evidence'],
): Record<string, unknown> {
  const touchedPointKeys = new Set(
    evidence
      .map((item) => normalizeNatalPointKey(item.natalPoint))
      .filter((key): key is string => !!key),
  );
  if (isNatalChartDataV2(chart)) {
    const v2 = chart as unknown as NatalChartDataV2;
    const housesReliable = v2.chartQuality.housesReliable;
    const ascendantReliable = v2.chartQuality.ascendantReliable;
    const positions = Object.values(v2.positions)
      .filter((position) => touchedPointKeys.has(normalizeNatalPointKey(position.key) || ''))
      .map((position) => ({
      key: position.key,
      object: position.object,
      kind: position.kind,
      sign: position.sign,
      degree: position.degree,
      longitude: position.longitude,
      retrograde: position.retrograde,
      speed_longitude: position.speedLongitude,
      house: housesReliable && position.stable.house ? position.house : null,
      reliability: position.reliability,
    }));
    const angles = [
      ascendantReliable ? v2.angles.ascendant : null,
      v2.angles.mc?.reliability !== 'variable_in_range' ? v2.angles.mc : null,
    ].filter((angle): angle is NonNullable<typeof angle> => !!angle)
      .filter((angle) => touchedPointKeys.has(normalizeNatalPointKey(angle.key) || ''))
      .map((angle) => ({
        key: angle.key,
        sign: angle.sign,
        degree: angle.degree,
        longitude: angle.longitude,
        reliability: angle.reliability,
      }));
    return {
      schema_version: v2.schemaVersion,
      birth_time_quality: v2.birthTimeQuality,
      positions,
      angles,
    };
  }

  const quality = chart.chartQuality;
  const birthTimeQuality = chart.birthTimeQuality || quality?.birthTimeQuality || 'unknown';
  const housesReliable = birthTimeQuality === 'exact' && quality?.housesReliable !== false;
  const ascendantReliable = birthTimeQuality === 'exact' && quality?.ascendantReliable !== false;
  const rawPositions = [
    ['sun', chart.sun], ['moon', chart.moon], ['mercury', chart.mercury],
    ['venus', chart.venus], ['mars', chart.mars], ['jupiter', chart.jupiter],
    ['saturn', chart.saturn], ['uranus', chart.uranus], ['neptune', chart.neptune],
    ['pluto', chart.pluto], ['chiron', chart.chiron],
  ] as const;
  return {
    schema_version: 'legacy',
    birth_time_quality: birthTimeQuality,
    positions: rawPositions.flatMap(([key, position]) => (
      position && touchedPointKeys.has(normalizeNatalPointKey(key) || '') ? [{
      key,
      sign: position.sign,
      degree: position.degree ?? null,
      longitude: position.longitude ?? null,
      retrograde: position.retrograde ?? null,
      speed_longitude: position.speedLongitude ?? null,
      house: housesReliable ? position.house ?? null : null,
    }] : [])),
    angles: ascendantReliable
      && chart.rising
      && touchedPointKeys.has('ascendant') ? [{
      key: 'ascendant',
      sign: chart.rising.sign,
      degree: chart.rising.degree ?? null,
      longitude: chart.rising.longitude ?? null,
    }] : [],
  };
}

export async function generatePersonalForecastPackage(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  onMetrics?: (metrics: { model: string; inputTokens: number; outputTokens: number; latencyMs: number; validationPassed: boolean }) => void;
  onEvidenceCalculated?: (payload: {
    calculated: EvidenceCalculationResult;
    /** Semantic compiler is intentionally bypassed; snapshots receive no derived facts. */
    semanticFacts: [];
  }) => Promise<EvidenceCalculatedHookResult>;
}): Promise<PersonalForecastPackage> {
  const language: ForecastWriterLanguage = input.profile.language === 'en' ? 'en' : 'ru';
  const calculated = await calculatePersonalForecastEvidence({
    chartData: input.chartData,
    period: input.period,
    window: input.window,
    language,
  });
  if (input.onEvidenceCalculated) {
    await input.onEvidenceCalculated({ calculated, semanticFacts: [] });
  }
  const natalContext = buildPersonalForecastNatalContext(
    input.chartData,
    calculated.evidence,
  );
  const generated = await requestGeneratedFeed({
    language,
    model: input.model,
    period: input.period,
    window: input.window,
    calculatedEvidence: calculated.evidence,
    evidenceViews: calculated.evidenceViews,
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
        .map((id) => [id, calculated.evidenceViews[id]] as const)
        .filter((entry): entry is readonly [string, ForecastEvidenceView] => !!entry[1]),
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
