import type { UserProfile } from '../types';
import {
  buildAiPersonalHoroscopeProfileSnapshot,
  formatAiPersonalHoroscopeDateLabel,
  getAiPersonalHoroscopeCurrentDate,
  type AiPersonalHoroscopePeriod,
  type AiPersonalHoroscopeRecentMemory,
  type AiPersonalHoroscopeWindow,
} from './aiPersonalHoroscope';
import type { StrictJsonSchema } from './openaiResponses';

export const AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA_NAME = 'ai_personal_horoscope_simple_v1';

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
  },
  required: ['opening', 'forecast', 'advice'],
  additionalProperties: false,
};

export type GeneratedHoroscopePayload = {
  opening?: unknown;
  forecast?: unknown;
  advice?: unknown;
};

export type ValidatedHoroscope = {
  opening: string;
  forecast: string;
  advice: string[];
};

const RU_EMPTY_CLICHES: readonly RegExp[] = [
  /(?:^|[^\p{L}])выдохн\p{L}*(?!\p{L})/iu,
  /(?:^|[^\p{L}])отпусти\p{L}*(?:\s+ситуаци\p{L}*|\s+контрол\p{L}*)?(?!\p{L})/iu,
  /(?:^|[^\p{L}])прими(?:\s+это|\s+себя|\s+ситуаци\p{L}*)?(?!\p{L})/iu,
  /позволь\p{L}*\s+себе/iu,
  /просто\s+будь(?!\p{L})/iu,
  /будь\s+в\s+поток\p{L}*/iu,
  /закрой\p{L}*\s+двер\p{L}*/iu,
  /вс[её]\s+будет\s+хорошо/iu,
  /доверь\p{L}*\s+процесс\p{L}*/iu,
  /прислуша\p{L}*\s+к\s+себе/iu,
  /будь\s+в\s+моменте/iu,
  /дай\s+себе\s+время/iu,
  /внутренн\p{L}*\s+(?:опор\p{L}*|ясност\p{L}*|ресурс\p{L}*)/iu,
  /точк\p{L}*\s+опор\p{L}*/iu,
  /день\s+просит/iu,
  /ритм\s+дня/iu,
  /пространств\p{L}*\s+для\s+себя/iu,
];

const EN_EMPTY_CLICHES: readonly RegExp[] = [
  /\b(?:breathe|let\s+go|allow\s+yourself|just\s+be|trust\s+the\s+process|go\s+with\s+the\s+flow|everything\s+will\s+be\s+fine|listen\s+to\s+yourself|be\s+present)\b/iu,
];

const ASTROLOGY_OR_ESOTERICISM: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:астролог\p{L}*|натальн\p{L}*|транзит\p{L}*|аспект\p{L}*|асцендент\p{L}*|ретроград\p{L}*|планет\p{L}*|зв[её]зд\p{L}*|зодиак\p{L}*|меркур\p{L}*|венер\p{L}*|марс\p{L}*|юпитер\p{L}*|сатурн\p{L}*|вселенн\p{L}*|вибрац\p{L}*|карм\p{L}*|космическ\p{L}*)(?!\p{L})/iu,
  /\b(?:astrolog\w*|natal|transit\w*|aspect\w*|ascendant|retrograde|planet\w*|stars?|zodiac|mercury|venus|mars|jupiter|saturn|universe|vibration\w*|karma|cosmic)\b/iu,
];

const INSULTS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:дурак\p{L}*|туп\p{L}*|лох\p{L}*|дебил\p{L}*|идиот\p{L}*|кретин\p{L}*)(?!\p{L})/iu,
  /\b(?:idiot|stupid|dumb|loser|moron)\b/iu,
];

const DANGEROUS_OR_GUARANTEED_PREDICTIONS: readonly RegExp[] = [
  /(?:^|[^\p{L}])(?:ты|тебя|тебе)\s+(?:точно|обязательно|непременно)\s+(?:заболе\p{L}*|вылеч\p{L}*|разбогате\p{L}*|потеря\p{L}*|увол\p{L}*|встрет\p{L}*|позвон\p{L}*|напиш\p{L}*|получ\p{L}*|жд[её]т\p{L}*)(?!\p{L})/iu,
  /(?:^|[^\p{L}])кто-то\s+(?:точно|обязательно|непременно)\s+(?:позвонит|напишет|прид[её]т|верн[её]т|заплатит|предложит)(?!\p{L})/iu,
  /(?:^|[^\p{L}])(?:диагноз|лечение|лекарств\p{L}*|смерт\p{L}*|авари\p{L}*|катастроф\p{L}*)(?!\p{L})/iu,
  /\b(?:you\s+will\s+definitely|someone\s+will\s+definitely|diagnosis|treatment|death|accident|guaranteed\s+profit)\b/iu,
];

const CALENDAR_DATE_PATTERN = /(?:^|[^\d])\d{1,2}\s+(?:января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?=$|[^\p{L}])/iu;
const MARKDOWN_PATTERN = /(?:^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s)|```/u;

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === 'string'
    ? value.trim().replace(/\r\n?/gu, '\n').replace(/[ \t]+/gu, ' ').slice(0, maxLength)
    : '';
}

function oneLine(value: unknown, maxLength: number): string {
  return cleanText(value, maxLength).replace(/\s+/gu, ' ').trim();
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

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function periodName(period: AiPersonalHoroscopePeriod, language: 'ru' | 'en'): string {
  if (language === 'en') return period === 'day' ? 'day' : period === 'week' ? 'week' : 'month';
  return period === 'day' ? 'день' : period === 'week' ? 'неделю' : 'месяц';
}

export function getAiPersonalHoroscopeSystemPrompt(
  language: 'ru' | 'en',
  period: AiPersonalHoroscopePeriod,
): string {
  if (language === 'en') {
    return `Write a personal forecast for the user's ${periodName(period, language)}.

You know the user's name, birth date, birth time, and birth place. You do the horoscope reasoning yourself from that information and the current date. Nobody assigns a topic to you.

Your voice is a friend who tells the truth directly. No filler. No visible astrology or mysticism. No therapy clichés. Write briefly and clearly, with an occasional sharp joke or precise tease when it fits.

Structure:
1. opening — a greeting plus a short jab, observation, slogan, or question.
2. forecast — describe what the period brings, what may be annoying, what to do, and what to avoid.
3. advice — exactly three short, concrete pieces of advice.

The forecast needs a natural story and development, but never force “first”, “then”, or “by evening”. Use time transitions only when they belong naturally.

Voice rhythm examples only; never copy their wording or topic:
- “The day is fine. You are about to make it complicated. Don’t.”
- “Everything will pretend to be urgent. It is not. Half of it is just loud.”
- “Someone may insist on proving the obvious. Do not help them make it longer.”

Do not use empty clichés, visible astrology, insults, diagnoses, guaranteed events, explicit dates, Markdown, or technical explanations. Do not invent a profession, family situation, illness, message, call, payment, or meeting as a guaranteed fact.

Return JSON only with opening, forecast, and advice.`;
  }

  return `Ты пишешь личный прогноз на ${periodName(period, language)} для пользователя.

Знаешь о нём:
- имя
- дата рождения
- время рождения
- место рождения

Ты САМ проводишь гороскопное рассуждение на основе этой информации и текущей даты. Никто не назначает тебе тему.

Твой стиль — друг, который говорит правду в лицо. Без воды. Без эзотерики. Без «выдохни», «отпусти», «позволь себе». Пиши коротко и прямо. Иногда используй точную дерзкую шутку или лёгкий укол, если он действительно подходит к прогнозу. Не превращай каждый текст в стендап.

Структура:
1. opening — приветствие плюс короткий укол, наблюдение, слоган или вопрос.
2. forecast — опиши, что будет происходить в периоде, что может напрягать, что делать и чего избегать.
3. advice — ровно 3 коротких конкретных совета.

В прогнозе должен быть естественный сюжет и развитие. Не натягивай шаблоны «сначала», «потом», «к вечеру». Используй переходы времени только когда они звучат органично.

ПРИМЕРЫ РИТМА — НЕ КОПИРУЙ СЛОВА И ТЕМЫ:
- «Михаил, день нормальный. Это ты сейчас попробуешь сделать его сложнее. Не надо.»
- «Сегодня всё будет делать вид, что оно срочное. Не верь. Половина просто шумит.»
- «Кто-то захочет долго доказывать очевидное. Не помогай ему делать это ещё дольше.»

Не используй:
- пустые штампы и психологическую воду;
- астрологию, эзотерику, звёзды, планеты, Вселенную, энергии и вибрации в видимом тексте;
- оскорбления;
- диагнозы, лечение и опасные предсказания;
- гарантированные звонки, сообщения, деньги, встречи или поступки других людей;
- конкретные даты внутри текста;
- Markdown, технические пояснения и рассказ о том, как ты сделал прогноз.

Не придумывай пользователю профессию, семью, болезнь или конкретное событие как факт.

Верни только JSON с полями opening, forecast и advice.`;
}

export function buildAiPersonalHoroscopePrompt(input: {
  language: 'ru' | 'en';
  period: AiPersonalHoroscopePeriod;
  window: AiPersonalHoroscopeWindow;
  profile: UserProfile;
  recentMemory?: AiPersonalHoroscopeRecentMemory[];
  repairHints?: string[];
}): string {
  const recentMemory = (input.recentMemory || []).slice(0, 8).map((item) => ({
    period: item.period,
    periodKey: item.periodKey,
    themeKeywords: item.themeKeywords.slice(0, 8),
    adviceKeywords: item.adviceKeywords.slice(0, 8),
  }));
  const context = {
    language: input.language,
    period: input.period,
    currentDate: getAiPersonalHoroscopeCurrentDate(input.window),
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    periodLabel: formatAiPersonalHoroscopeDateLabel(input.window, input.language),
    user: buildAiPersonalHoroscopeProfileSnapshot(input.profile),
    recentMemory,
    repairHints: (input.repairHints || []).slice(0, 8),
  };
  return `Используй этот приватный контекст. Не цитируй его и не объясняй. recentMemory содержит только короткие ключевые слова прошлых тем и советов: не повторяй их механически, но не пытайся продолжать несуществующую историю.\n${JSON.stringify(context, null, 2)}`;
}

export function validateAiPersonalHoroscopePayload(
  raw: GeneratedHoroscopePayload,
  input: { language: 'ru' | 'en' },
): { value: ValidatedHoroscope | null; errors: string[] } {
  const errors: string[] = [];
  const opening = cleanText(raw.opening, 360);
  const forecast = cleanText(raw.forecast, 1_800);
  const advice = Array.isArray(raw.advice)
    ? raw.advice.map((item) => oneLine(item, 220)).filter(Boolean)
    : [];

  if (!opening) errors.push('opening_empty');
  if (!forecast) errors.push('forecast_empty');
  if (advice.length !== 3) errors.push('advice_count');
  if (advice.some((item) => !item.trim())) errors.push('advice_empty');
  if (new Set(advice.map(normalize)).size !== advice.length) errors.push('advice_duplicate');

  const visible = [opening, forecast, ...advice].join('\n');
  const clichéPatterns = input.language === 'ru'
    ? [...RU_EMPTY_CLICHES, ...EN_EMPTY_CLICHES]
    : [...EN_EMPTY_CLICHES, ...RU_EMPTY_CLICHES];
  if (matchesAny(visible, clichéPatterns)) errors.push('empty_cliche');
  if (matchesAny(visible, ASTROLOGY_OR_ESOTERICISM)) errors.push('visible_astrology');
  if (matchesAny(visible, INSULTS)) errors.push('insult');
  if (matchesAny(visible, DANGEROUS_OR_GUARANTEED_PREDICTIONS)) {
    errors.push('dangerous_or_guaranteed_prediction');
  }
  if (CALENDAR_DATE_PATTERN.test(visible)) errors.push('explicit_date');
  if (MARKDOWN_PATTERN.test(visible)) errors.push('markdown');

  return {
    value: errors.length ? null : { opening, forecast, advice },
    errors: [...new Set(errors)],
  };
}
