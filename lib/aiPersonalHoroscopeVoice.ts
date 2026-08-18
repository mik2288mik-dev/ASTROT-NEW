import type { UserProfile } from '../types';
import {
  buildAiPersonalHoroscopeProfileSnapshot,
  formatAiPersonalHoroscopeDateLabel,
  getAiPersonalHoroscopeCurrentDate,
  type AiPersonalHoroscopeHistoryItem,
  type AiPersonalHoroscopePeriod,
  type AiPersonalHoroscopeWindow,
} from './aiPersonalHoroscope';
import { buildAiPersonalHoroscopeFewShotBlock } from './aiPersonalHoroscopeFewShot';
import type { StrictJsonSchema } from './openaiResponses';

export const AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA_NAME = 'ai_personal_horoscope_direct_v4';

export const AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA: StrictJsonSchema = {
  type: 'object',
  properties: {
    opening: { type: 'string' },
    forecast: { type: 'string' },
    advice: {
      type: 'array',
      minItems: 2,
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

export type ParsedHoroscope = {
  opening: string;
  forecast: string;
  advice: string[];
};

type Language = 'ru' | 'en';

type OutputLimits = {
  openingMaxWords: number;
  openingMaxChars: number;
  forecastMinWords: number;
  forecastMaxWords: number;
  adviceMinItems: number;
  adviceMaxItems: number;
  adviceMaxWords: number;
};

const LIMITS: Record<AiPersonalHoroscopePeriod, OutputLimits> = {
  day: {
    openingMaxWords: 10,
    openingMaxChars: 90,
    forecastMinWords: 20,
    forecastMaxWords: 55,
    adviceMinItems: 2,
    adviceMaxItems: 2,
    adviceMaxWords: 14,
  },
  week: {
    openingMaxWords: 10,
    openingMaxChars: 90,
    forecastMinWords: 45,
    forecastMaxWords: 90,
    adviceMinItems: 2,
    adviceMaxItems: 3,
    adviceMaxWords: 16,
  },
  month: {
    openingMaxWords: 10,
    openingMaxChars: 90,
    forecastMinWords: 75,
    forecastMaxWords: 130,
    adviceMinItems: 3,
    adviceMaxItems: 3,
    adviceMaxWords: 18,
  },
};

const RU_STYLE_LEAKS: readonly RegExp[] = [
  /(?:^|[^а-яё])период(?:а|е|ом|ы)?(?![а-яё])/iu,
  /располага(?:ет|ют|ла|ло|ли)/iu,
  /полезно\s+(?:сделать|решить|выбрать|проверить|сосредоточиться|обратить)/iu,
  /(?:осознанност|проработ|ресурс|заземл|внутренн(?:яя|ий)\s+(?:опора|ясность)|прислуша\w*\s+к\s+себе|позволь\w*\s+себе)/iu,
  /(?:астролог|натальн|транзит|аспект|асцендент|ретроград|зодиак|зв[её]зд)/iu,
];

const EN_STYLE_LEAKS: readonly RegExp[] = [
  /\b(?:period|astrolog|natal|transit|aspect|zodiac|retrograde)\w*\b/iu,
  /\b(?:inner clarity|inner support|allow yourself|listen to yourself|work through|your resource)\b/iu,
];

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function periodName(period: AiPersonalHoroscopePeriod, language: Language): string {
  if (language === 'en') return period === 'day' ? 'today' : period === 'week' ? 'the week' : 'the month';
  return period === 'day' ? 'сегодня' : period === 'week' ? 'неделю' : 'месяц';
}

function outputContract(period: AiPersonalHoroscopePeriod, language: Language): string {
  if (language === 'en') {
    if (period === 'day') {
      return `opening: one sharp hook, 3–10 words.\nforecast: 20–55 words, about two concise sentences.\nadvice: exactly 2 short closing lines.`;
    }
    if (period === 'week') {
      return `opening: one sharp hook, 3–10 words.\nforecast: 45–90 words, broader than Today.\nadvice: 2–3 short closing lines.`;
    }
    return `opening: one sharp hook, 3–10 words.\nforecast: 75–130 words, broad enough to feel like a whole month.\nadvice: exactly 3 short closing lines.`;
  }

  if (period === 'day') {
    return `opening: одна короткая ударная фраза, 3–10 слов.\nforecast: 20–55 слов, примерно 2 коротких предложения.\nadvice: ровно 2 короткие финальные строки.`;
  }
  if (period === 'week') {
    return `opening: одна короткая ударная фраза, 3–10 слов.\nforecast: 45–90 слов, заметно шире Today.\nadvice: 2–3 короткие финальные строки.`;
  }
  return `opening: одна короткая ударная фраза, 3–10 слов.\nforecast: 75–130 слов, ощутимо шире недели и про месяц целиком.\nadvice: ровно 3 короткие финальные строки.`;
}

export function getAiPersonalHoroscopeSystemPrompt(
  language: Language,
  period: AiPersonalHoroscopePeriod,
): string {
  if (language === 'en') {
    return `IDENTITY\nYou are the author of a personal horoscope in a modern consumer app.\n\nTASK\nWrite the user's horoscope for ${periodName(period, language)} in plain everyday language. The result must feel like a real forecast, not self-help copy. Keep any astrology or internal reasoning invisible.\n\nVOICE TARGET\nHuman, direct, specific, confident. A little cheeky when it fits. Dry humor is welcome when it lands naturally. Warmth and pleasure are allowed; a good forecast may simply be good. Vary rhythm, openings, topics, and sentence construction so consecutive readings do not feel templated.\n\nCONTENT TARGET\nTalk about life, not a task list: people, attraction, friends, money, purchases, home, leisure, food, places, travel, curiosity, luck, ordinary pleasure, changes, or other natural life themes. Use only themes that belong in this reading; never cycle through a checklist. Write predictions as plausible tendencies or possibilities, not guaranteed events.\n\nBOUNDARIES\nVisible copy contains no astrology terminology, therapy language, coaching language, mysticism, diagnoses, or financial promises. It does not lecture the reader or turn the forecast into a lesson. Do not restate the calendar label; the UI already shows it.\n\nOUTPUT CONTRACT\n${outputContract(period, language)}\nEach closing line adds a new thought. No labels such as “Conclusion” or “Advice”. No Markdown. Return only JSON with opening, forecast, and advice.\n\nThe reference examples in the user input are the strongest guide for voice, density, rhythm, and level of specificity.`;
  }

  return `IDENTITY\nТы автор личного гороскопа в современном приложении.\n\nTASK\nНапиши гороскоп пользователя на ${periodName(period, language)} простыми живыми словами. На выходе должен быть именно прогноз, а не мотивационный текст или разбор характера. Астрологию и внутренние рассуждения наружу не показывай.\n\nVOICE TARGET\nЖивой человек. Прямо, точно, уверенно. Где уместно — дерзко, колко или с сухой шуткой, но без хамства. Хороший прогноз может быть просто хорошим: с радостью, симпатией, удачей, удовольствием. Меняй ритм, заходы, темы и конструкцию фраз, чтобы соседние тексты не выглядели серией по шаблону.\n\nCONTENT TARGET\nПиши про жизнь, а не про список задач: люди, симпатия, друзья, деньги, покупки, дом, отдых, еда, места, поездки, интерес, удача, приятные случайности, перемены и другие нормальные жизненные темы. Бери только то, что естественно звучит в конкретном прогнозе; не проходись по сферам по списку. Прогноз формулируй как вероятные тенденции и возможности, без гарантированных событий.\n\nBOUNDARIES\nВ видимом тексте нет астрологических терминов, психологии, психотерапии, коучинга, эзотерики, диагнозов и финансовых обещаний. Текст не воспитывает пользователя и не превращается в жизненный урок. Не пересказывай название периода и даты — они уже показаны интерфейсом.\n\nOUTPUT CONTRACT\n${outputContract(period, language)}\nКаждая финальная строка добавляет новую мысль. Без меток «Вывод», «Совет», «Напоследок». Без Markdown. Верни только JSON с opening, forecast и advice.\n\nЭталонные INPUT → OUTPUT примеры во входе — главный ориентир по голосу, плотности, ритму и уровню конкретики.`;
}

function compactHistory(previous: AiPersonalHoroscopeHistoryItem[]) {
  const bounded = previous.slice(0, 10);
  return {
    recentOpenings: bounded.map((item) => item.opening.trim()).filter(Boolean),
    recentClosings: bounded
      .flatMap((item) => item.advice)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12),
  };
}

export function buildAiPersonalHoroscopePrompt(input: {
  language: Language;
  period: AiPersonalHoroscopePeriod;
  window: AiPersonalHoroscopeWindow;
  profile: UserProfile;
  currentDate?: string;
  previousForecasts?: AiPersonalHoroscopeHistoryItem[];
}): string {
  const history = compactHistory(input.previousForecasts || []);
  const context = {
    language: input.language,
    period: input.period,
    currentDate: input.currentDate || getAiPersonalHoroscopeCurrentDate(input.window),
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    periodLabel: formatAiPersonalHoroscopeDateLabel(input.window, input.language),
    user: buildAiPersonalHoroscopeProfileSnapshot(input.profile),
    recentOpenings: history.recentOpenings,
    recentClosings: history.recentClosings,
  };

  const task = input.language === 'en'
    ? 'Write a NEW reading from CURRENT INPUT. Match the reference quality and voice, but do not copy their wording, situations, or jokes. recentOpenings and recentClosings are only anti-repeat memory.'
    : 'Напиши НОВЫЙ прогноз по CURRENT INPUT. Держи уровень и голос эталонов, но не копируй их формулировки, ситуации и шутки. recentOpenings и recentClosings нужны только для защиты от повторов.';

  return `${buildAiPersonalHoroscopeFewShotBlock(input.language, input.period)}\n\n${task}\n\nCURRENT INPUT\n${JSON.stringify(context, null, 2)}`;
}

function containsStyleLeak(value: string, language: Language): boolean {
  const patterns = language === 'ru' ? RU_STYLE_LEAKS : EN_STYLE_LEAKS;
  return patterns.some((pattern) => pattern.test(value));
}

export function readAiPersonalHoroscopePayload(
  raw: GeneratedHoroscopePayload,
  period: AiPersonalHoroscopePeriod = 'day',
  language: Language = 'ru',
): ParsedHoroscope | null {
  if (
    typeof raw.opening !== 'string'
    || typeof raw.forecast !== 'string'
    || !Array.isArray(raw.advice)
    || raw.advice.some((item) => typeof item !== 'string')
  ) return null;

  const opening = raw.opening.trim();
  const forecast = raw.forecast.trim();
  const advice = (raw.advice as string[]).map((item) => item.trim());
  if (!opening || !forecast || advice.some((item) => !item)) return null;

  const limits = LIMITS[period];
  const openingWords = wordCount(opening);
  const forecastWords = wordCount(forecast);
  if (
    openingWords < 2
    || openingWords > limits.openingMaxWords
    || opening.length > limits.openingMaxChars
    || forecastWords < limits.forecastMinWords
    || forecastWords > limits.forecastMaxWords
    || advice.length < limits.adviceMinItems
    || advice.length > limits.adviceMaxItems
    || advice.some((item) => wordCount(item) > limits.adviceMaxWords)
  ) return null;

  const visible = [opening, forecast, ...advice];
  if (visible.some((item) => containsStyleLeak(item, language))) return null;

  return { opening, forecast, advice };
}
