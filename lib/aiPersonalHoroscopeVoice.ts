import type { UserProfile } from '../types';
import {
  buildAiPersonalHoroscopeProfileSnapshot,
  type AiPersonalHoroscopeRecentReading,
} from './aiPersonalHoroscope';
import type { AiPersonalHoroscopeDialogueMemory } from './aiPersonalHoroscopeMemory';
import type { StrictJsonSchema } from './openaiResponses';
import {
  stableHash,
  type PersonalForecastPeriod,
  type PersonalForecastWindow,
} from './personalForecastContract';

export const AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA_NAME = 'ai_personal_horoscope_v2';

export const AI_PERSONAL_HOROSCOPE_DOMAINS = [
  'conversation',
  'relationships',
  'boundaries',
  'decision',
  'self_expression',
  'pace',
  'money',
  'home',
  'novelty',
  'completion',
  'social_attention',
  'creativity',
] as const;

export type AiPersonalHoroscopeDomain = typeof AI_PERSONAL_HOROSCOPE_DOMAINS[number];

const DOMAIN_LABELS: Record<
  'ru' | 'en',
  Record<AiPersonalHoroscopeDomain, string>
> = {
  ru: {
    conversation: 'разговор, недосказанность или неверная реакция',
    relationships: 'близость, симпатия или дистанция между людьми',
    boundaries: 'чужая просьба, давление или право отказать',
    decision: 'выбор, сомнение или смена решения',
    self_expression: 'самопрезентация, смелость сказать прямо или показать себя',
    pace: 'темп, усталость от лишней гонки или своевременная остановка',
    money: 'цена, ценность, трата или отношение к деньгам',
    home: 'дом, личное пространство, комфорт или бытовое раздражение',
    novelty: 'новая идея, любопытство или желание резко сменить привычный ход',
    completion: 'незакрытая история, возвращение к старому или нормальный финал',
    social_attention: 'внимание окружающих, чужая оценка или место в компании',
    creativity: 'творческий импульс, вкус, игра или желание сделать по-своему',
  },
  en: {
    conversation: 'a conversation, a misunderstanding, or the wrong reaction',
    relationships: 'closeness, attraction, or distance between people',
    boundaries: 'a request, pressure, or the right to refuse',
    decision: 'a choice, hesitation, or a change of mind',
    self_expression: 'self-expression, directness, or showing yourself',
    pace: 'pace, pointless rushing, or stopping at the right moment',
    money: 'price, value, spending, or your attitude to money',
    home: 'home, personal space, comfort, or a small domestic irritation',
    novelty: 'a new idea, curiosity, or the urge to change course',
    completion: 'an unfinished story, a return to the old, or a clean ending',
    social_attention: 'attention, other people’s judgment, or your place in a group',
    creativity: 'creative impulse, taste, play, or doing something your own way',
  },
};

const OPENING_MODES = [
  'dry_observation',
  'light_challenge',
  'sharp_contrast',
  'quiet_warning',
  'related_irony',
] as const;

const ARC_MODES = [
  'false_alarm_to_clarity',
  'habit_to_new_reaction',
  'temptation_to_consequence',
  'tension_to_simple_move',
  'misread_signal_to_turn',
] as const;

export const AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    opening: { type: 'string' },
    forecast: { type: 'string' },
    advice: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: { type: 'string' },
    },
    memory: {
      type: 'object',
      properties: {
        primary_domain: {
          type: 'string',
          enum: [...AI_PERSONAL_HOROSCOPE_DOMAINS],
        },
        main_idea_key: { type: 'string' },
        situation_key: { type: 'string' },
        turn_key: { type: 'string' },
        irony_key: { type: 'string' },
        advice_keys: {
          type: 'array',
          minItems: 3,
          maxItems: 3,
          items: { type: 'string' },
        },
      },
      required: [
        'primary_domain',
        'main_idea_key',
        'situation_key',
        'turn_key',
        'irony_key',
        'advice_keys',
      ],
      additionalProperties: false,
    },
  },
  required: ['opening', 'forecast', 'advice', 'memory'],
  additionalProperties: false,
};

export type GeneratedHoroscopeMemoryPayload = {
  primary_domain?: unknown;
  main_idea_key?: unknown;
  situation_key?: unknown;
  turn_key?: unknown;
  irony_key?: unknown;
  advice_keys?: unknown;
};

export type GeneratedHoroscopePayload = {
  opening?: unknown;
  forecast?: unknown;
  advice?: unknown;
  memory?: GeneratedHoroscopeMemoryPayload | null;
};

export type ValidatedHoroscope = {
  opening: string;
  forecast: string;
  advice: string[];
  memory: {
    primaryDomain: AiPersonalHoroscopeDomain;
    mainIdeaKey: string;
    situationKey: string;
    turnKey: string;
    ironyKey: string;
    adviceKeys: string[];
  };
};

export type AiPersonalHoroscopeEditorialBrief = {
  asOfDate: string;
  remainingStart: string;
  remainingEnd: string;
  primaryDomain: AiPersonalHoroscopeDomain;
  primaryDomainLabel: string;
  openingMode: typeof OPENING_MODES[number];
  arcMode: typeof ARC_MODES[number];
};

export type AiPersonalHoroscopeSemanticMemory = {
  version: 2;
  kind: 'reading' | 'advice';
  domain: AiPersonalHoroscopeDomain;
  idea?: string;
  situation?: string;
  turn?: string;
  irony?: string;
  advice?: string;
  adviceKeys?: string[];
};

const RU_FORBIDDEN_CLICHES: readonly RegExp[] = [
  /(?:^|[^\p{L}])выдохн\p{L}*(?!\p{L})/iu,
  /(?:^|[^\p{L}])отпусти\p{L}*(?:\s+ситуаци\p{L}*|\s+контрол\p{L}*)?(?!\p{L})/iu,
  /(?:^|[^\p{L}])прими(?:\s+это|\s+себя|\s+ситуаци\p{L}*)?(?!\p{L})/iu,
  /позволь\p{L}*\s+себе/iu,
  /просто\s+будь(?!\p{L})/iu,
  /будь\s+в\s+поток\p{L}*/iu,
  /закрой\p{L}*\s+двер\p{L}*/iu,
  /вс[её]\s+будет\s+хорошо/iu,
  /доверь\p{L}*\s+процесс\p{L}*/iu,
  /услыш\p{L}*\s+себя/iu,
  /прислуша\p{L}*\s+к\s+себе/iu,
  /будь\s+в\s+моменте/iu,
  /дай\s+себе\s+время/iu,
  /возьми\s+пауз\p{L}*/iu,
  /внутренн\p{L}*\s+(?:опор\p{L}*|ясност\p{L}*|ресурс\p{L}*)/iu,
  /точк\p{L}*\s+опор\p{L}*/iu,
  /день\s+просит/iu,
  /ритм\s+дня/iu,
  /пространств\p{L}*\s+для\s+себя/iu,
];

const RU_BAD_OUTPUT_PATTERNS: readonly RegExp[] = [
  /главн\p{L}*\s+задач\p{L}*/iu,
  /точн\p{L}*\s+настройк\p{L}*/iu,
  /показательн\p{L}*\s+героизм\p{L}*/iu,
  /лишн\p{L}*\s+героизм\p{L}*/iu,
  /лишн\p{L}*\s+движени\p{L}*/iu,
  /чуж\p{L}*\s+сует\p{L}*/iu,
  /навест\p{L}*\s+порядок/iu,
  /нов\p{L}*\s+вводн\p{L}*/iu,
  /видим\p{L}*\s+результат\p{L}*/iu,
  /текущ\p{L}*\s+обещани\p{L}*/iu,
  /конкретн\p{L}*\s+срок\p{L}*/iu,
  /закрыт\p{L}*\s+пункт\p{L}*/iu,
  /незаверш[её]нн\p{L}*\s+договор[её]нност\p{L}*/iu,
  /бытов\p{L}*\s+хвост\p{L}*/iu,
  /диспетчер\p{L}*\s+чуж\p{L}*\s+хаос\p{L}*/iu,
  /один\s+вопрос,\s*один\s+ответ/iu,
  /проверь\p{L}*\s+цифр\p{L}*/iu,
];

const EN_FORBIDDEN_CLICHES: readonly RegExp[] = [
  /\b(?:breathe|let\s+go|allow\s+yourself|just\s+be|trust\s+the\s+process|go\s+with\s+the\s+flow|everything\s+will\s+be\s+fine|listen\s+to\s+yourself|be\s+present)\b/iu,
];

const ASTROLOGY_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:астролог\p{L}*|гороскоп\p{L}*|натальн\p{L}*|транзит\p{L}*|аспект\p{L}*|асцендент\p{L}*|ретроград\p{L}*|планет\p{L}*|зв[её]зд\p{L}*|зодиак\p{L}*|меркур\p{L}*|венер\p{L}*|марс\p{L}*|юпитер\p{L}*|сатурн\p{L}*|лун\p{L}*|солнц\p{L}*)(?!\p{L})/iu,
  /(?:^|[^\p{L}])(?:вселенн\p{L}*|вибрац\p{L}*|карм\p{L}*|энерги\p{L}*\s+планет\p{L}*|космическ\p{L}*)(?!\p{L})/iu,
  /\b(?:astrolog\w*|horoscope\w*|natal|transit\w*|aspect\w*|ascendant|retrograde|planet\w*|stars?|zodiac|mercury|venus|mars|jupiter|saturn|moon|sun|universe|vibration\w*|karma|cosmic)\b/iu,
];

const INSULT_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:дурак\p{L}*|туп\p{L}*|лох\p{L}*|дебил\p{L}*|идиот\p{L}*|кретин\p{L}*)(?!\p{L})/iu,
  /\b(?:idiot|stupid|dumb|loser|moron)\b/iu,
];

const PSYCHOLOGISING_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:тебе\s+страшно|ты\s+грустн\p{L}*|ты\s+тревожн\p{L}*|ты\s+подавлен\p{L}*|ты\s+сломлен\p{L}*)(?!\p{L})/iu,
  /\b(?:you\s+are\s+(?:sad|anxious|depressed|broken)|you\s+are\s+afraid)\b/iu,
];

const GUARANTEED_EVENT_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:тебе|тебя)\s+(?:точно|обязательно|непременно)\s+(?:позвон\p{L}*|напиш\p{L}*|встрет\p{L}*|вернут\p{L}*|подар\p{L}*|предлож\p{L}*|жд[её]т\p{L}*)(?!\p{L})/iu,
  /(?:^|[^\p{L}])кто-то\s+(?:точно|обязательно)?\s*(?:позвонит|напишет|прид[её]т|верн[её]т|скажет\s+спасибо)(?!\p{L})/iu,
  /\b(?:someone\s+will\s+(?:definitely\s+)?(?:call|write|arrive|return|thank)|you\s+will\s+definitely)\b/iu,
];

const OBVIOUS_ADVICE_PATTERNS: readonly RegExp[] = [
  /дважды\s+проверь\p{L}*\s+(?:сумм\p{L}*|получател\p{L}*)/iu,
  /запиш\p{L}*\s+(?:сумм\p{L}*|вс[её]\s+незаверш[её]нн\p{L}*)/iu,
  /назнач\p{L}*\s+кажд\p{L}*\s+конкретн\p{L}*\s+срок/iu,
  /выбер\p{L}*\s+один\s+главн\p{L}*\s+(?:результат|дел\p{L}*)/iu,
  /занес\p{L}*\s+его\s+перв\p{L}*\s+пункт\p{L}*/iu,
  /не\s+соглашай\p{L}*\s+на\s+задач\p{L}*\s+без/iu,
  /убирай\p{L}*\s+одн\p{L}*\s+(?:вещ\p{L}*|задач\p{L}*)/iu,
  /закрой\p{L}*\s+один\s+бытов\p{L}*\s+хвост/iu,
];

const CALENDAR_DATE_PATTERN = /(?:^|[^\d])\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?=$|[^\p{L}])/iu;
const PERIOD_TITLE_REPEAT_PATTERN = /(?:недел\p{L}*\s+с\s+\d|(?:январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\p{L}*)/iu;
const MARKDOWN_PATTERN = /(?:^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s)|```/u;
const MANAGER_WORD_PATTERN = /(?:^|[^\p{L}])(?:вводн\p{L}*|приоритет\p{L}*|дедлайн\p{L}*|срок\p{L}*|владелец\p{L}*|результат\p{L}*|задач\p{L}*|обязательств\p{L}*|договор[её]нност\p{L}*|пункт\p{L}*|согласова\p{L}*|проект\p{L}*)(?=$|[^\p{L}])/giu;
const IMPERATIVE_START_PATTERN = /^(?:не\s+|сразу\s+|просто\s+)?(?:выбер|сделай|закрой|проверь|отвечай|оставь|запиши|назначь|убери|скажи|реши|перестань|соглашайся|начни|откажись|зафиксируй)\p{L}*/iu;
const TIME_SHIFT_PATTERNS: readonly RegExp[] = [
  /(?:^|[^\p{L}])сначала(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])потом(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])с\s+утра(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])дн[её]м(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])к\s+вечеру(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])вечером(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])чуть\s+позже(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])в\s+какой-то\s+момент(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])ближе\s+к(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])в\s+середине(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])к\s+концу(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])после\s+этого(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])в\s+ближайшие\s+дни(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])поначалу(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])затем(?=$|[^\p{L}])/iu,
];

const TOPIC_SIGNAL_GROUPS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:деньг\p{L}*|покуп\p{L}*|оплат\p{L}*|перевод\p{L}*|сумм\p{L}*|цен\p{L}*|трат\p{L}*)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(?:дел\p{L}*|задач\p{L}*|план\p{L}*|документ\p{L}*|обязательств\p{L}*|проект\p{L}*|срок\p{L}*)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(?:люд\p{L}*|разговор\p{L}*|общени\p{L}*|вопрос\p{L}*|ответ\p{L}*|собеседник\p{L}*)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(?:быт\p{L}*|дом\p{L}*|вещ\p{L}*|комнат\p{L}*|пространств\p{L}*)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(?:отношени\p{L}*|близост\p{L}*|симпати\p{L}*|чувств\p{L}*|дистанци\p{L}*)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(?:отдых\p{L}*|устал\p{L}*|сон\p{L}*|темп\p{L}*|передышк\p{L}*)(?=$|[^\p{L}])/iu,
  /(?:^|[^\p{L}])(?:иде\p{L}*|творч\p{L}*|придум\p{L}*|интерес\p{L}*|любопыт\p{L}*)(?=$|[^\p{L}])/iu,
];

function text(value: unknown, maxLength = 2_400): string {
  return typeof value === 'string'
    ? value.trim().replace(/\r\n?/gu, '\n').replace(/[ \t]+/gu, ' ').slice(0, maxLength)
    : '';
}

function oneLine(value: unknown, maxLength = 180): string {
  return text(value, maxLength).replace(/\s+/gu, ' ').trim();
}

function words(value: string): string[] {
  return value.trim().split(/\s+/u).filter(Boolean);
}

function sentences(value: string): string[] {
  return (value.match(/[^.!?]+(?:[.!?]+|$)/gu) || [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function sentenceCount(value: string): number {
  return sentences(value).length;
}

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/gu, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, ' ');
}

function tokenSet(value: string): Set<string> {
  return new Set(normalize(value).split(' ').filter((token) => token.length > 2));
}

function lexicalContainment(left: string, right: string): number {
  const a = tokenSet(left);
  const b = tokenSet(right);
  const denominator = Math.min(a.size, b.size);
  if (!denominator) return 0;
  let matches = 0;
  for (const token of a) if (b.has(token)) matches += 1;
  return matches / denominator;
}

function firstTokens(value: string, count = 6): string {
  return normalize(value).split(' ').slice(0, count).join(' ');
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function regexMatchCount(value: string, pattern: RegExp): number {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return [...value.matchAll(new RegExp(pattern.source, flags))].length;
}

function isoDateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((part) => part.type === type)?.value || ''
  );
  return `${read('year')}-${read('month')}-${read('day')}`;
}

export function getAiPersonalHoroscopeAsOfDate(
  window: PersonalForecastWindow,
  now = new Date(),
): string {
  const localDate = isoDateInTimezone(now, window.timezone);
  if (localDate < window.periodStart) return window.periodStart;
  if (localDate > window.periodEnd) return window.periodEnd;
  return localDate;
}

function periodOffset(period: PersonalForecastPeriod): number {
  if (period === 'day') return 0;
  if (period === 'week') return 4;
  return 8;
}

export function buildAiPersonalHoroscopeEditorialBrief(input: {
  language: 'ru' | 'en';
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  profile: UserProfile;
  asOfDate?: string;
}): AiPersonalHoroscopeEditorialBrief {
  const asOfDate = input.asOfDate || getAiPersonalHoroscopeAsOfDate(input.window);
  const baseSeed = Math.abs(stableHash([
    String(input.profile.id || 'guest'),
    String(input.profile.birthDate || ''),
    asOfDate,
  ].join('|')));
  const offset = periodOffset(input.period);
  const primaryDomain = AI_PERSONAL_HOROSCOPE_DOMAINS[
    (baseSeed + offset) % AI_PERSONAL_HOROSCOPE_DOMAINS.length
  ];
  return {
    asOfDate,
    remainingStart: asOfDate > input.window.periodStart ? asOfDate : input.window.periodStart,
    remainingEnd: input.window.periodEnd,
    primaryDomain,
    primaryDomainLabel: DOMAIN_LABELS[input.language][primaryDomain],
    openingMode: OPENING_MODES[(baseSeed + offset) % OPENING_MODES.length],
    arcMode: ARC_MODES[(baseSeed + offset * 2) % ARC_MODES.length],
  };
}

function inferRecentPeriod(reading: AiPersonalHoroscopeRecentReading): PersonalForecastPeriod {
  if (reading.period === 'day' || reading.period === 'week' || reading.period === 'month') {
    return reading.period;
  }
  if (/^\d{4}-W\d{2}$/u.test(reading.periodKey)) return 'week';
  if (/^\d{4}-\d{2}$/u.test(reading.periodKey)) return 'month';
  return 'day';
}

function recentFragments(
  readings: readonly AiPersonalHoroscopeRecentReading[] | undefined,
): AiPersonalHoroscopeRecentReading[] {
  return (readings || []).slice(0, 8).map((reading) => ({
    period: inferRecentPeriod(reading),
    periodKey: String(reading.periodKey || '').slice(0, 32),
    fragments: reading.fragments.slice(0, 8).flatMap((fragment) => {
      const fragmentText = text(fragment.text, 700);
      if (!fragmentText) return [];
      return [{
        kind: fragment.kind,
        text: fragmentText,
        semanticFingerprint: fragment.semanticFingerprint
          ? String(fragment.semanticFingerprint).slice(0, 900)
          : null,
      }];
    }),
  })).filter((reading) => reading.periodKey && reading.fragments.length);
}

export function buildAiPersonalHoroscopeSemanticFingerprint(
  memory: AiPersonalHoroscopeSemanticMemory,
): string {
  return JSON.stringify({
    version: 2,
    kind: memory.kind,
    domain: memory.domain,
    idea: oneLine(memory.idea, 120) || undefined,
    situation: oneLine(memory.situation, 120) || undefined,
    turn: oneLine(memory.turn, 120) || undefined,
    irony: oneLine(memory.irony, 120) || undefined,
    advice: oneLine(memory.advice, 100) || undefined,
    adviceKeys: Array.isArray(memory.adviceKeys)
      ? memory.adviceKeys.map((item) => oneLine(item, 100)).filter(Boolean).slice(0, 3)
      : undefined,
  });
}

export function readAiPersonalHoroscopeSemanticFingerprint(
  value: unknown,
): AiPersonalHoroscopeSemanticMemory | null {
  if (typeof value !== 'string' || !value.trim().startsWith('{')) return null;
  try {
    const parsed = JSON.parse(value) as Partial<AiPersonalHoroscopeSemanticMemory>;
    if (
      parsed.version !== 2
      || (parsed.kind !== 'reading' && parsed.kind !== 'advice')
      || !AI_PERSONAL_HOROSCOPE_DOMAINS.includes(parsed.domain as AiPersonalHoroscopeDomain)
    ) return null;
    return parsed as AiPersonalHoroscopeSemanticMemory;
  } catch {
    return null;
  }
}

function periodInstructions(period: PersonalForecastPeriod, language: 'ru' | 'en'): string {
  if (language === 'en') {
    if (period === 'day') {
      return 'Show one living situation today: the first signal, the likely mistake, the turn, and the clean response.';
    }
    if (period === 'week') {
      return 'Show one through-line for the remaining week in two movements: the nearest days and the turn closer to the end.';
    }
    return 'Show one through-line for the remaining month in three movements: what becomes visible now, what changes later, and what matters by the end.';
  }
  if (period === 'day') {
    return 'Покажи один живой сюжет сегодняшнего дня: первый сигнал, место возможной ошибки, поворот и нормальный выход.';
  }
  if (period === 'week') {
    return 'Покажи одну сквозную тему оставшейся недели в двух движениях: ближайшие дни и сдвиг ближе к концу.';
  }
  return 'Покажи одну сквозную тему оставшейся части месяца в трёх движениях: что заметно сейчас, что меняется позже и к чему прийти к концу.';
}

export function getAiPersonalHoroscopeSystemPrompt(
  language: 'ru' | 'en',
  period: PersonalForecastPeriod,
): string {
  if (language === 'en') {
    return `You write one private AI horoscope for a ${period} period. You reason from the supplied birth profile, current date, period, recent readings, and dialogue context. You receive no Swiss Ephemeris output, natal chart, transits, aspects, houses, or calculated astrology data.

THE JOB
This is a horoscope, not productivity coaching, a planner, a finance checklist, or generic self-help. Show a living dynamic: what starts to happen, where the user may misread it, where it turns, and what response works.
Use exactly the primary domain from editorial_brief. Do not sweep through tasks, people, money, and home one after another. One primary domain; at most one small secondary detail.
${periodInstructions(period, language)}

VOICE
Sound like a sharp friend with fast reactions. Confident, concise, direct, occasionally dry or cheeky. Boldness is precision, never abuse.
A joke is optional. Never force the same catchphrases. Short sentences. No therapy filler, corporate prose, mystical vocabulary, or generic motivation.

QUALITY BAR — rhythm only, never copy wording or topics:
- “The day is fine. You are about to make it complicated. Don’t.”
- “Everything will pretend to be urgent. It is not. Half of it is just loud.”
- “Someone may insist on proving the obvious. Do not help them make it longer.”

STRUCTURE
- opening: 1-2 short sentences. Do not repeat the date or period title.
- forecast: one connected arc, mostly description rather than commands. ${period === 'day' ? '4-6 sentences and 55-95 words' : period === 'week' ? '5-7 sentences and 75-125 words' : '6-8 sentences and 95-150 words'}.
- advice: exactly 3 concise, useful actions. They must follow from the forecast without paraphrasing it. One action, one stop-rule, and one response or choice rule.
- memory: accurate hidden semantic keys. primary_domain must equal editorial_brief.primary_domain.

HARD BANS
No visible astrology, invented biography, diagnoses, guaranteed high-stakes events, technical explanations, Markdown, explicit calendar deadlines, or obvious safety checklists.
Never write manager-speak such as priorities, inputs, owners, visible results, concrete deadlines, closed items, or unfinished commitments.
Never produce the pattern “tasks → people → money → household”. It is filler, not a horoscope.
Use only the remaining period from as_of_date. Never give a deadline or future wording for time that has already passed.

Return JSON only, matching the schema exactly.`;
  }

  return `Ты пишешь один личный AI-гороскоп пользователю на ${period === 'day' ? 'день' : period === 'week' ? 'неделю' : 'месяц'}. Всё гороскопное рассуждение делаешь сам по профилю рождения, текущей дате, периоду, прошлым текстам и контексту вопросов. Ты не получаешь Swiss Ephemeris, натальную карту, транзиты, аспекты, дома или готовые расчёты. В видимом тексте никакой астрологии.

ЧТО НУЖНО СДЕЛАТЬ
Это гороскоп, а не коучинг, ежедневник, финансовая памятка или инструкция по продуктивности. Покажи живую динамику периода: что начинает происходить, где пользователь может неверно отреагировать, в какой момент всё меняется и какой ход сработает.
Используй ровно одну главную тему из editorial_brief.primary_domain. Не проходись по кругу через дела, людей, деньги и быт. Одна главная тема; максимум одна небольшая второстепенная деталь.
${periodInstructions(period, language)}

ГОЛОС
Ты дерзкий приятель с хорошей реакцией. Быстро замечаешь суть, не церемонишься, иногда поддеваешь, но не хамишь.
Пиши уверенно, резко и с лёгким нахальством. Дерзость — в точной формулировке, а не в грубости.
Ирония не обязательна. Не вставляй механически «не ведись», «без героизма», «не устраивай сериал» и другие заготовки. Сегодня может быть шутка, завтра — сухая фраза.
Короткие предложения. Минимум объяснений. Никакой психологической каши, корпоративного языка и мотивационной воды.

ЭТАЛОН РИТМА — ТОЛЬКО ГОЛОС, СЛОВА И ТЕМЫ НЕ КОПИРОВАТЬ
- «Михаил, день нормальный. Это ты сейчас попробуешь сделать его сложнее. Не надо.»
- «Сегодня всё будет делать вид, что оно срочное. Не верь. Половина просто шумит.»
- «Кто-то захочет долго доказывать очевидное. Не помогай ему делать это ещё дольше.»
- «К вечеру голова начнёт буксовать. После этого момента решения лучше не изобретать.»
- «Этот месяц несколько раз предложит старую схему в новой упаковке. Не покупайся только потому, что бантик другой.»

ПЛОХО — ТАК БОЛЬШЕ НЕ ПИСАТЬ
- «Главная задача — выбрать одно важное дело и не распыляться».
- «Люди могут приносить новые вводные».
- «С деньгами лучше держать умеренный темп».
- «Назначь каждому обещанию конкретный срок».
Это безликий текст планировщика. Он не описывает период и одинаково подходит любому человеку в любой день.

СТРУКТУРА
- opening: 1-2 коротких предложения. Не повторяй дату, название месяца или диапазон недели.
- forecast: один связный сюжет, в основном описание, а не команды. ${period === 'day' ? '4-6 предложений и 55-95 слов' : period === 'week' ? '5-7 предложений и 75-125 слов' : '6-8 предложений и 95-150 слов'}.
- В forecast обязательно должны быть развитие и поворот: сначала одно ощущение или ситуация, затем изменение. Не перечисляй сферы жизни.
- advice: ровно 3 коротких нормальных совета. Они следуют из прогноза, но не пересказывают его. Один конкретный ход, один запрет или стоп-сигнал, одно правило ответа или выбора.
- memory: честные скрытые ключи фактически использованной темы, ситуации, поворота, иронии и советов. primary_domain обязан совпасть с editorial_brief.primary_domain.

ЖЁСТКИЕ ЗАПРЕТЫ
- Никакой астрологии, эзотерики, звёзд, планет, Вселенной, энергий, вибраций и судьбы в видимом тексте.
- Не используй «выдохни», «отпусти», «прими», «позволь себе», «просто будь», «будь в потоке», «всё будет хорошо», «доверься процессу».
- Не оскорбляй пользователя и не ставь ему диагнозы.
- Не придумывай профессию, семью, болезнь или гарантированные важные события. Одна вероятная бытовая или человеческая ситуация допустима — это и есть прогноз.
- Не пиши языком менеджера: «вводные», «приоритеты», «владелец», «видимый результат», «конкретный срок», «закрытые пункты», «незавершённые договорённости».
- Не делай очевидные памятки вроде «дважды проверь сумму и получателя».
- Не пиши даты и дедлайны внутри текста. Интерфейс уже показывает период.
- Используй только оставшуюся часть периода от as_of_date. Не говори в будущем о времени, которое уже прошло.
- Не пиши Markdown, рубрики, CTA и технические объяснения.

Верни только JSON, строго по схеме.`;
}

export function buildAiPersonalHoroscopePrompt(input: {
  language: 'ru' | 'en';
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  profile: UserProfile;
  asOfDate?: string;
  recentForecasts?: AiPersonalHoroscopeRecentReading[];
  conversationMemory?: AiPersonalHoroscopeDialogueMemory[];
  rejectedDraft?: GeneratedHoroscopePayload | null;
  repairErrors?: string[];
}): string {
  const editorialBrief = buildAiPersonalHoroscopeEditorialBrief(input);
  const context = {
    language: input.language,
    selected_period: {
      kind: input.period,
      key: input.window.periodKey,
      start: input.window.periodStart,
      end: input.window.periodEnd,
      timezone: input.window.timezone,
      as_of_date: editorialBrief.asOfDate,
      remaining_start: editorialBrief.remainingStart,
      remaining_end: editorialBrief.remainingEnd,
    },
    editorial_brief: {
      primary_domain: editorialBrief.primaryDomain,
      primary_domain_meaning: editorialBrief.primaryDomainLabel,
      opening_mode: editorialBrief.openingMode,
      arc_mode: editorialBrief.arcMode,
      period_job: periodInstructions(input.period, input.language),
    },
    personal_profile: buildAiPersonalHoroscopeProfileSnapshot(input.profile),
    continuity_context: {
      recent_forecasts: recentFragments(input.recentForecasts),
      recent_dialogue: (input.conversationMemory || []).slice(0, 6).map((item) => ({
        question: oneLine(item.question, 280),
        answer: oneLine(item.answer, 520),
        answered_at: item.answeredAt,
      })),
    },
    previous_attempt: input.rejectedDraft || null,
    repair_errors: input.repairErrors || [],
  };
  return `Use this private context. Do not quote it or explain it. Recent text is negative anti-repeat context, never a template. Missing facts must stay missing.\n${JSON.stringify(context, null, 2)}`;
}

export function validateAiPersonalHoroscopePayload(
  raw: GeneratedHoroscopePayload,
  input: {
    language: 'ru' | 'en';
    period: PersonalForecastPeriod;
    window?: PersonalForecastWindow;
    profile?: UserProfile;
    asOfDate?: string;
    requiredPrimaryDomain?: AiPersonalHoroscopeDomain;
    recentForecasts?: AiPersonalHoroscopeRecentReading[];
  },
): { value: ValidatedHoroscope | null; errors: string[] } {
  const errors: string[] = [];
  const opening = text(raw.opening, 360);
  const forecast = text(raw.forecast, 1_800);
  const rawAdvice = Array.isArray(raw.advice) ? raw.advice : [];
  const advice = rawAdvice.map((item) => oneLine(item, 220)).filter(Boolean);
  const memory = raw.memory && typeof raw.memory === 'object' && !Array.isArray(raw.memory)
    ? raw.memory
    : null;
  const primaryDomain = oneLine(memory?.primary_domain, 40) as AiPersonalHoroscopeDomain;
  const mainIdeaKey = oneLine(memory?.main_idea_key, 120);
  const situationKey = oneLine(memory?.situation_key, 120);
  const turnKey = oneLine(memory?.turn_key, 120);
  const ironyKey = oneLine(memory?.irony_key, 120);
  const adviceKeys = Array.isArray(memory?.advice_keys)
    ? memory.advice_keys.map((item) => oneLine(item, 100)).filter(Boolean)
    : [];

  const brief = input.window && input.profile
    ? buildAiPersonalHoroscopeEditorialBrief({
        language: input.language,
        period: input.period,
        window: input.window,
        profile: input.profile,
        asOfDate: input.asOfDate,
      })
    : null;
  const requiredPrimaryDomain = input.requiredPrimaryDomain || brief?.primaryDomain || null;

  if (!opening) errors.push('opening is empty');
  if (!forecast) errors.push('forecast is empty');

  const openingWords = words(opening).length;
  const openingSentences = sentenceCount(opening);
  const openingLimit = input.period === 'day' ? { min: 5, max: 24 } : { min: 7, max: 30 };
  if (openingSentences < 1 || openingSentences > 2) {
    errors.push(`opening requires 1-2 sentences; received ${openingSentences}`);
  }
  if (openingWords < openingLimit.min || openingWords > openingLimit.max) {
    errors.push(`opening requires ${openingLimit.min}-${openingLimit.max} words; received ${openingWords}`);
  }
  if (PERIOD_TITLE_REPEAT_PATTERN.test(opening)) errors.push('opening repeats visible period title');

  const forecastLimits = input.period === 'day'
    ? { minSentences: 4, maxSentences: 6, minWords: 55, maxWords: 95 }
    : input.period === 'week'
      ? { minSentences: 5, maxSentences: 7, minWords: 75, maxWords: 125 }
      : { minSentences: 6, maxSentences: 8, minWords: 95, maxWords: 150 };
  const forecastSentences = sentenceCount(forecast);
  const forecastWords = words(forecast).length;
  if (
    forecastSentences < forecastLimits.minSentences
    || forecastSentences > forecastLimits.maxSentences
  ) {
    errors.push(
      `forecast requires ${forecastLimits.minSentences}-${forecastLimits.maxSentences} sentences; received ${forecastSentences}`,
    );
  }
  if (forecastWords < forecastLimits.minWords || forecastWords > forecastLimits.maxWords) {
    errors.push(
      `forecast requires ${forecastLimits.minWords}-${forecastLimits.maxWords} words; received ${forecastWords}`,
    );
  }

  if (advice.length !== 3) errors.push(`advice requires exactly 3 items; received ${advice.length}`);
  advice.forEach((item, index) => {
    const count = words(item).length;
    if (count < 3 || count > 14) errors.push(`advice ${index + 1} requires 3-14 words`);
    if (sentenceCount(item) !== 1) errors.push(`advice ${index + 1} must be one sentence`);
    if (matchesAny(item, OBVIOUS_ADVICE_PATTERNS)) errors.push(`advice ${index + 1} is an obvious checklist`);
    if (lexicalContainment(item, forecast) >= 0.84) errors.push(`advice ${index + 1} only paraphrases forecast`);
  });
  if (new Set(advice.map(normalize)).size !== advice.length) errors.push('advice items repeat');
  if (new Set(adviceKeys.map(normalize)).size !== adviceKeys.length) errors.push('memory advice keys repeat');
  if (!mainIdeaKey || !situationKey || !turnKey) errors.push('memory idea, situation or turn key is empty');
  if (adviceKeys.length !== advice.length) errors.push('memory advice keys do not match advice');
  if (!AI_PERSONAL_HOROSCOPE_DOMAINS.includes(primaryDomain)) errors.push('memory primary domain is invalid');
  if (requiredPrimaryDomain && primaryDomain !== requiredPrimaryDomain) {
    errors.push(`memory primary domain must be ${requiredPrimaryDomain}`);
  }

  const visible = [opening, forecast, ...advice].join('\n');
  const clichéPatterns = input.language === 'ru'
    ? [...RU_FORBIDDEN_CLICHES, ...EN_FORBIDDEN_CLICHES]
    : [...EN_FORBIDDEN_CLICHES, ...RU_FORBIDDEN_CLICHES];
  if (matchesAny(visible, clichéPatterns)) errors.push('forbidden cliché');
  if (input.language === 'ru' && matchesAny(visible, RU_BAD_OUTPUT_PATTERNS)) {
    errors.push('generic planner phrase from rejected output');
  }
  if (matchesAny(visible, ASTROLOGY_PATTERNS)) errors.push('visible astrology or esotericism');
  if (matchesAny(visible, INSULT_PATTERNS)) errors.push('insulting wording');
  if (matchesAny(visible, PSYCHOLOGISING_PATTERNS)) errors.push('invented psychological state');
  if (matchesAny(visible, GUARANTEED_EVENT_PATTERNS)) errors.push('guaranteed external event');
  if (MARKDOWN_PATTERN.test(visible)) errors.push('markdown or visible list formatting');
  if (CALENDAR_DATE_PATTERN.test(visible)) errors.push('explicit calendar date inside horoscope');
  if (forecast.includes('?')) errors.push('reader question outside opening');

  if (input.language === 'ru') {
    const managerWordCount = regexMatchCount(visible, MANAGER_WORD_PATTERN);
    if (managerWordCount >= 3) errors.push('managerial productivity copy');
    const topicGroupCount = TOPIC_SIGNAL_GROUPS.filter((pattern) => pattern.test(visible)).length;
    if (topicGroupCount > 2) errors.push('forecast sweeps through too many life areas');
    const imperativeCount = sentences(forecast)
      .filter((sentence) => IMPERATIVE_START_PATTERN.test(sentence)).length;
    if (imperativeCount > 2) errors.push('forecast contains too many commands');
    const timeShiftCount = TIME_SHIFT_PATTERNS
      .filter((pattern) => pattern.test(forecast)).length;
    if (timeShiftCount < 2) errors.push('forecast has no visible development and turn');
  }

  const recent = recentFragments(input.recentForecasts);
  const recentFragmentsFlat = recent.flatMap((reading) => reading.fragments);
  const recentOpenings = recentFragmentsFlat.filter((fragment) => fragment.kind === 'opening');
  const recentForecastText = recentFragmentsFlat.filter((fragment) => fragment.kind === 'forecast');
  const recentAdvice = recentFragmentsFlat.filter((fragment) => fragment.kind === 'advice');
  if (recentOpenings.some((fragment) => (
    firstTokens(fragment.text) === firstTokens(opening)
    || lexicalContainment(fragment.text, opening) >= 0.68
  ))) errors.push('opening repeats recent forecast');
  if (recentForecastText.some((fragment) => lexicalContainment(fragment.text, forecast) >= 0.55)) {
    errors.push('forecast repeats recent forecast');
  }
  if (advice.some((item) => recentAdvice.some((fragment) => (
    normalize(fragment.text) === normalize(item)
    || lexicalContainment(fragment.text, item) >= 0.62
  )))) errors.push('advice repeats recent forecast');

  const recentSemantic = recent.flatMap((reading) => (
    reading.fragments.flatMap((fragment) => {
      const memory = readAiPersonalHoroscopeSemanticFingerprint(fragment.semanticFingerprint);
      return memory ? [{ period: reading.period, memory }] : [];
    })
  ));
  if (recentSemantic.some(({ memory }) => (
    memory.kind === 'reading'
    && (
      (memory.idea && lexicalContainment(memory.idea, mainIdeaKey) >= 0.72)
      || (memory.situation && lexicalContainment(memory.situation, situationKey) >= 0.72)
      || (memory.turn && lexicalContainment(memory.turn, turnKey) >= 0.72)
    )
  ))) errors.push('semantic idea repeats recent horoscope');
  if (adviceKeys.some((key) => recentSemantic.some(({ memory }) => (
    (
      memory.kind === 'advice'
      && memory.advice
      && lexicalContainment(memory.advice, key) >= 0.68
    )
    || (
      memory.kind === 'reading'
      && Array.isArray(memory.adviceKeys)
      && memory.adviceKeys.some((recentKey) => lexicalContainment(recentKey, key) >= 0.68)
    )
  )))) errors.push('semantic advice repeats recent horoscope');

  return {
    value: errors.length ? null : {
      opening,
      forecast,
      advice,
      memory: {
        primaryDomain,
        mainIdeaKey,
        situationKey,
        turnKey,
        ironyKey,
        adviceKeys,
      },
    },
    errors,
  };
}
