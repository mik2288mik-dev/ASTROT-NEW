import type { UserProfile } from '../types';
import {
  buildAiPersonalHoroscopeProfileSnapshot,
  formatAiPersonalHoroscopeDateLabel,
  getAiPersonalHoroscopeCurrentDate,
  type AiPersonalHoroscopePeriod,
  type AiPersonalHoroscopeWindow,
} from './aiPersonalHoroscope';
import type { StrictJsonSchema } from './openaiResponses';

export const AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA_NAME = 'ai_personal_horoscope_direct_v2';

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

function cleanText(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().replace(/\r\n?/gu, '\n').replace(/[ \t]+/gu, ' ')
    : '';
}

function oneLine(value: unknown): string {
  return cleanText(value).replace(/\s+/gu, ' ').trim();
}

function periodName(period: AiPersonalHoroscopePeriod, language: 'ru' | 'en'): string {
  if (language === 'en') return period === 'day' ? 'day' : period === 'week' ? 'week' : 'month';
  return period === 'day' ? 'день' : period === 'week' ? 'неделю' : 'месяц';
}

function forecastSize(period: AiPersonalHoroscopePeriod, language: 'ru' | 'en'): string {
  if (language === 'en') {
    return period === 'day'
      ? 'about 5–7 concise sentences'
      : 'about 7–9 concise sentences';
  }
  return period === 'day'
    ? 'примерно 5–7 коротких предложений'
    : 'примерно 7–9 коротких предложений';
}

export function getAiPersonalHoroscopeSystemPrompt(
  language: 'ru' | 'en',
  period: AiPersonalHoroscopePeriod,
): string {
  if (language === 'en') {
    return `Write a personal horoscope for the user's ${periodName(period, language)}.

You know the user's name, birth date, birth time, and birth place. Do the horoscope reasoning yourself from that information and the current date. No code-selected topic, previous horoscope, keyword list, or editorial brief tells you what to write about.

Choose the main line and the real tone of the period yourself. It may be lucky, light, romantic, joyful, productive, calm, vivid, mixed, or difficult. Do not choose trouble, warning, overload, self-control, or productivity as the default. Joy, love, attraction, pleasant contact, a useful chance, inspiration, money, rest, confidence, and a good result are as normal for a horoscope as tension or delay.

Do not force artificial balance. If the period is good, say so plainly without adding a mandatory problem. If it is difficult, do not invent cheerfulness for symmetry. If it is mixed, show the actual contrast. Never recycle one universal plot about rushing, pressure, noise, boundaries, pausing, control, or finishing old tasks. Do not write a task-manager, coaching note, or list of prohibitions.

Voice: alive, direct, confident, and sometimes bold. Boldness comes from a precise sentence, not permanent negativity. Humor, irony, a tease, or a question are optional and appear only when natural. Never insert a joke merely to satisfy a format.

Structure:
1. opening — one or two natural sentences. You may use the name, a greeting, a direct observation, or state the point immediately. No mandatory joke, jab, slogan, or question.
2. forecast — ${forecastSize(period, language)}. Describe what is likely to become noticeable, how the main line develops, and where it leads. Choose one or two connected areas instead of listing everything. The forecast is not obliged to contain both a positive and a warning. Keep advice out of most of this block; this block is primarily the horoscope itself.
3. advice — exactly three short, concrete sentences that follow from this forecast. They may include a useful action, something not worth doing, or a way to use a good opportunity. Keep them varied and do not make all three prohibitions.

Write in ordinary human language. Keep visible astrology and mysticism out of the answer. Do not use therapy clichés, insults, diagnoses, treatment instructions, or guaranteed medical or financial outcomes. You may describe likely situations and opportunities, but do not invent an exact external event, profession, family role, message, call, payment, or meeting as a guaranteed fact. Do not use Markdown or explain how the horoscope was produced.

Return JSON only with opening, forecast, and advice.`;
  }

  return `Ты пишешь личный гороскоп на ${periodName(period, language)} для пользователя.

Ты знаешь его имя, дату рождения, время рождения и место рождения. Сам проведи гороскопное рассуждение по этим данным и текущей дате. Никакой код, прошлый гороскоп, список ключевых слов или редакционная заготовка не указывает тебе, о чём писать.

Сам выбери главную линию и настоящий тон периода. Он может быть удачным, лёгким, романтичным, радостным, продуктивным, спокойным, насыщенным, смешанным или сложным. Не выбирай проблемы, предостережения, перегруз, самоконтроль и продуктивность как вариант по умолчанию. Радость, любовь, симпатия, приятное общение, удачный шанс, вдохновение, деньги, отдых, уверенность и хороший результат — такие же нормальные темы гороскопа, как напряжение или задержка.

Не создавай искусственный баланс. Если период хороший — скажи об этом прямо и не добавляй обязательную проблему. Если он сложный — не придумывай веселье для симметрии. Если смешанный — покажи реальный контраст. Не повторяй один универсальный сюжет про спешку, давление, шум, границы, паузу, контроль или необходимость закончить старое. Не пиши заметку из планировщика, коучинг или сплошной список запретов.

Голос: живой, прямой, уверенный, иногда дерзкий. Дерзость — в точности фразы, а не в вечном негативе. Юмор, ирония, лёгкий укол или вопрос не обязательны и появляются только когда звучат естественно. Не вставляй шутку ради формата.

Структура:
1. opening — одно-два естественных предложения. Можно обратиться по имени, поздороваться, дать точное наблюдение или сразу назвать суть. Шутка, укол, слоган и вопрос не обязательны.
2. forecast — ${forecastSize(period, language)}. Расскажи, что станет заметно в периоде, как развивается главная линия и к чему она ведёт. Выбери одну-две связанные сферы, а не перечисляй всё подряд. Прогноз не обязан одновременно содержать и позитив, и предупреждение. Основная часть должна быть именно гороскопом, а не длинным советом пользователю.
3. advice — ровно три коротких конкретных предложения, которые следуют именно из этого прогноза. Это может быть полезное действие, то, чего не стоит делать, или способ воспользоваться хорошей возможностью. Сделай советы разными и не превращай все три в запреты.

Пиши обычным человеческим языком. Не показывай в ответе астрологию и эзотерику. Не используй психологические штампы, оскорбления, диагнозы, лечение и гарантии медицинского или финансового результата. Можно описывать вероятные ситуации и возможности, но нельзя выдумывать точное внешнее событие, профессию, семейную роль, сообщение, звонок, платёж или встречу как гарантированный факт. Не используй Markdown и не объясняй, как был создан гороскоп.

Верни только JSON с полями opening, forecast и advice.`;
}

export function buildAiPersonalHoroscopePrompt(input: {
  language: 'ru' | 'en';
  period: AiPersonalHoroscopePeriod;
  window: AiPersonalHoroscopeWindow;
  profile: UserProfile;
  currentDate?: string;
}): string {
  const context = {
    language: input.language,
    period: input.period,
    currentDate: input.currentDate || getAiPersonalHoroscopeCurrentDate(input.window),
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    periodLabel: formatAiPersonalHoroscopeDateLabel(input.window, input.language),
    user: buildAiPersonalHoroscopeProfileSnapshot(input.profile),
  };
  const instruction = input.language === 'en'
    ? 'Use this private context. Do not quote it or explain it.'
    : 'Используй этот приватный контекст. Не цитируй его и не объясняй.';
  return `${instruction}\n${JSON.stringify(context, null, 2)}`;
}

/**
 * Strict JSON Schema guarantees the public shape. This function only normalizes
 * transport whitespace and checks that the three visible fields are present.
 * It deliberately does not score tone, topics, positivity, wording, or style,
 * and it never rejects a complete Luna draft for editorial reasons.
 */
export function validateAiPersonalHoroscopePayload(
  raw: GeneratedHoroscopePayload,
): { value: ValidatedHoroscope | null; errors: string[] } {
  const errors: string[] = [];
  const opening = cleanText(raw.opening);
  const forecast = cleanText(raw.forecast);
  const advice = Array.isArray(raw.advice)
    ? raw.advice.map(oneLine)
    : [];

  if (!opening) errors.push('opening_empty');
  if (!forecast) errors.push('forecast_empty');
  if (advice.length !== 3) errors.push('advice_count');
  if (advice.some((item) => !item)) errors.push('advice_empty');

  return {
    value: errors.length ? null : { opening, forecast, advice },
    errors,
  };
}
