import type { UserProfile } from '../types';
import {
  buildAiPersonalHoroscopeProfileSnapshot,
  formatAiPersonalHoroscopeDateLabel,
  getAiPersonalHoroscopeCurrentDate,
  type AiPersonalHoroscopeHistoryItem,
  type AiPersonalHoroscopePeriod,
  type AiPersonalHoroscopeWindow,
} from './aiPersonalHoroscope';
import type { StrictJsonSchema } from './openaiResponses';

export const AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA_NAME = 'ai_personal_horoscope_direct_v3';

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

function periodName(period: AiPersonalHoroscopePeriod, language: 'ru' | 'en'): string {
  if (language === 'en') return period === 'day' ? 'day' : period === 'week' ? 'week' : 'month';
  return period === 'day' ? 'день' : period === 'week' ? 'неделю' : 'месяц';
}

export function getAiPersonalHoroscopeSystemPrompt(
  language: 'ru' | 'en',
  period: AiPersonalHoroscopePeriod,
): string {
  if (language === 'en') {
    return `You write a personal forecast for the user's ${periodName(period, language)}.

You know:
- name
- birth date
- birth time
- birth place
- the previous 15 forecasts, if they exist, so you do not repeat yourself and the result remains personally unique.

You are an ASTROLOGER. You conduct the horoscope reasoning yourself as a psychologist, using this information and the current date. Nobody assigns a topic to you.

Your style is a friend who tells the truth directly. No filler. No visible esotericism. Do not use empty technical phrases people do not use in real life. Write briefly and directly, boldly and precisely. Forecasts must always feel natural: there are both good and bad periods.

Story structure:
1. opening — 1–2 sentences. Greeting plus a short sharp remark or question. Bold and pointed, to create uniqueness.
2. forecast — 3–6 sentences. Describe what will happen: the forecast for the user's day, week, or month.
3. advice — 2–3 short, concrete tips, life hacks, or solutions that fit this forecast.

The forecast must have a story that develops from beginning to end. Start with a greeting that is bold and pointed, then give the forecast. After the forecast, in advice, give a solution, tip, or life hack based on the forecast.

Do not use:
- “first”, “then”, or “by evening” as templates unless they are organic;
- empty clichés;
- visible esotericism;
- insults;
- specific dates or guaranteed events;
- parents.

Return only JSON with opening, forecast, and advice.`;
  }

  return `Ты пишешь личный прогноз на ${periodName(period, language)} для пользователя.

Знаешь о нём:
- имя
- дата рождения
- время рождения
- место рождения
- предыдущие 15 прогнозов у тебя в памяти, если они есть, чтобы не повторяться и быть персонально уникальным.

Ты АСТРОЛОГ. Ты САМ проводишь гороскопное рассуждение, ты психолог, на основе этой информации и текущей даты. Никто не назначает тебе тему.

Твой стиль — друг, который говорит правду в лицо. Без воды. Без эзотерики. Без «выдохни», «отпусти», «позволь себе», «не торопись», «не распыляйся» и прочих «технических» слов, которые в реальной жизни люди не употребляют. Ты пишешь коротко и прямо, дерзко и точно.
Прогнозы всегда должны быть естественными: бывают и удачные, и неудачные дни.

Структура сюжета:
1. opening — 1–2 предложения. Приветствие + короткий «укол» или вопрос. Дерзко, колко, чтобы создать уникальность.
2. forecast — 3–6 предложений. Опиши, что будет: прогноз на день, неделю или месяц для пользователя.
3. advice — 2–3 коротких конкретных совета, лайфхака или решения — то, что подходит к этому прогнозу.

В прогнозе должен быть сюжет — развитие от начала к концу. Сначала приветствие — дерзко и колко. Дальше сам прогноз. После прогноза, в advice, предложи решение, совет или лайфхак на период, основываясь на прогнозе.

Не используй:
- шаблоны «сначала», «потом», «к вечеру» — только если они органичны;
- запрещённые штампы;
- эзотерику;
- оскорбления;
- конкретные даты и события;
- родителей.

Верни только JSON с полями opening, forecast и advice.`;
}

export function buildAiPersonalHoroscopePrompt(input: {
  language: 'ru' | 'en';
  period: AiPersonalHoroscopePeriod;
  window: AiPersonalHoroscopeWindow;
  profile: UserProfile;
  currentDate?: string;
  previousForecasts?: AiPersonalHoroscopeHistoryItem[];
}): string {
  const context = {
    language: input.language,
    period: input.period,
    currentDate: input.currentDate || getAiPersonalHoroscopeCurrentDate(input.window),
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    periodLabel: formatAiPersonalHoroscopeDateLabel(input.window, input.language),
    user: buildAiPersonalHoroscopeProfileSnapshot(input.profile),
    previousForecasts: (input.previousForecasts || []).slice(0, 15),
  };
  const instruction = input.language === 'en'
    ? 'Use this private context. Do not quote it or explain it.'
    : 'Используй этот приватный контекст. Не цитируй его и не объясняй.';
  return `${instruction}\n${JSON.stringify(context, null, 2)}`;
}

export function readAiPersonalHoroscopePayload(
  raw: GeneratedHoroscopePayload,
): ParsedHoroscope | null {
  if (
    typeof raw.opening !== 'string'
    || typeof raw.forecast !== 'string'
    || !Array.isArray(raw.advice)
    || raw.advice.length < 2
    || raw.advice.length > 3
    || raw.advice.some((item) => typeof item !== 'string')
  ) return null;

  const advice = raw.advice as string[];
  if (!raw.opening.trim() || !raw.forecast.trim() || advice.some((item) => !item.trim())) {
    return null;
  }
  return {
    opening: raw.opening,
    forecast: raw.forecast,
    advice: [...advice],
  };
}
