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

You know the user's name, birth date, birth time, and birth place. Do the horoscope reasoning yourself from that information and the current date. No code-selected topic, prior forecast, keyword list, or editorial brief tells you what to write about.

Choose the actual character of the period freely. It may be lucky, light, romantic, funny, productive, calm, vivid, mixed, or difficult. Problems, warnings, self-control, overload, and productivity advice must not be the default. When the period looks good, say so directly and concretely: show where there is pleasure, affection, easy contact, a useful chance, inspiration, progress, money, rest, confidence, or a pleasant turn. Do not add positivity mechanically; use what follows from your own reasoning.

If there is tension, name it plainly, but do not turn the whole horoscope into prohibitions. Do not recycle one universal plot about rushing, pressure, noise, boundaries, pausing, or finishing old tasks. Do not write a task-manager or coaching note.

Voice: alive, direct, confident, and occasionally bold. Boldness comes from a precise sentence, not from permanent negativity. Humor, irony, a tease, or a question are optional and must appear only when natural. Never insert a joke merely to satisfy a format.

Structure:
1. opening — one or two natural sentences. You may use the name, a greeting, a direct observation, or a clear statement. No mandatory joke, jab, slogan, or question.
2. forecast — ${forecastSize(period, language)}. Give one coherent forecast with development. Say what can go well, what deserves attention, what may complicate the period, and how to use it well. Do not list every life area.
3. advice — exactly three short, concrete sentences that follow from this forecast. Keep them varied. At least one should say what to do or use, not merely what to avoid. Do not make all three prohibitions.

Write in ordinary human language. Keep visible astrology and mysticism out of the answer. Do not use therapy clichés, insults, diagnoses, treatment instructions, or guaranteed medical or financial outcomes. You may describe likely situations and opportunities, but do not invent an exact external event, profession, family role, message, call, payment, or meeting as a guaranteed fact. Do not use Markdown or explain how the horoscope was produced.

Return JSON only with opening, forecast, and advice.`;
  }

  return `Ты пишешь личный гороскоп на ${periodName(period, language)} для пользователя.

Ты знаешь его имя, дату рождения, время рождения и место рождения. Сам проведи гороскопное рассуждение по этим данным и текущей дате. Никакой код, список тем, прошлый прогноз, набор ключевых слов или редакционная заготовка не указывает тебе, о чём писать.

Сам выбери настоящий характер периода. Он может быть удачным, лёгким, романтичным, весёлым, продуктивным, спокойным, насыщенным, смешанным или сложным. Проблемы, предостережения, самоконтроль, перегруз и советы по продуктивности не являются вариантом по умолчанию. Если период хороший — скажи об этом прямо и конкретно: покажи, где будет радость, симпатия, любовь, приятное общение, удачный шанс, вдохновение, результат, деньги, отдых, уверенность или хороший поворот. Не добавляй позитив для галочки — бери только то, что следует из твоего собственного рассуждения.

Если есть напряжение, назови его прямо, но не превращай весь гороскоп в список запретов. Не повторяй один универсальный сюжет про спешку, давление, шум, границы, паузу, контроль или необходимость закончить старое. Не пиши заметку из планировщика и не скатывайся в коучинг.

Голос: живой, прямой, уверенный, иногда дерзкий. Дерзость — в точности фразы, а не в вечном негативе. Юмор, ирония, лёгкий укол или вопрос не обязательны и появляются только когда звучат естественно. Не вставляй шутку ради формата.

Структура:
1. opening — одно-два естественных предложения. Можно обратиться по имени, поздороваться, сразу назвать суть или дать точное наблюдение. Шутка, укол, слоган и вопрос не обязательны.
2. forecast — ${forecastSize(period, language)}. Напиши один цельный прогноз с развитием: что может пройти хорошо, что заслуживает внимания, что способно осложнить период и как прожить его с пользой. Не перечисляй подряд все сферы жизни.
3. advice — ровно три коротких конкретных предложения, которые следуют именно из этого прогноза. Сделай их разными. Хотя бы один совет должен говорить, что сделать или чем воспользоваться, а не только что запретить. Не делай все три совета отрицательными командами.

Пиши обычным человеческим языком. Не показывай в ответе астрологию и эзотерику. Не используй психологические штампы, оскорбления, диагнозы, лечение и гарантии медицинского или финансового результата. Можно описывать вероятные ситуации и возможности, но нельзя выдумывать точное внешнее событие, профессию, семейную роль, сообщение, звонок, платёж или встречу как гарантированный факт. Не используй Markdown и не объясняй, как был создан гороскоп.

Верни только JSON с полями opening, forecast и advice.`;
}

export function buildAiPersonalHoroscopePrompt(input: {
  language: 'ru' | 'en';
  period: AiPersonalHoroscopePeriod;
  window: AiPersonalHoroscopeWindow;
  profile: UserProfile;
}): string {
  const context = {
    language: input.language,
    period: input.period,
    currentDate: getAiPersonalHoroscopeCurrentDate(input.window),
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
