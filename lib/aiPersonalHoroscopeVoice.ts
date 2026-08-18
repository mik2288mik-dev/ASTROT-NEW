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
    opening: {
      type: 'string',
      description: 'One short punchy human hook. One sentence only.',
    },
    forecast: {
      type: 'string',
      description: 'The actual horoscope forecast in simple conversational language.',
    },
    advice: {
      type: 'array',
      minItems: 2,
      maxItems: 3,
      items: { type: 'string' },
      description: 'Short closing lines. They may be a conclusion, direct suggestion, joke, or final remark.',
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
  if (language === 'en') return period === 'day' ? 'today' : period === 'week' ? 'this week' : 'this month';
  return period === 'day' ? 'сегодня' : period === 'week' ? 'на неделю' : 'на месяц';
}

function outputGuide(period: AiPersonalHoroscopePeriod, language: 'ru' | 'en'): string {
  if (language === 'en') {
    if (period === 'day') {
      return `opening: one sentence, 2–10 words.
forecast: exactly 2 sentences.
advice: exactly 2 short one-sentence lines.`;
    }
    if (period === 'week') {
      return `opening: one sentence, 2–10 words.
forecast: exactly 3 sentences.
advice: exactly 3 short one-sentence lines.`;
    }
    return `opening: one sentence, 2–10 words.
forecast: exactly 4 sentences.
advice: exactly 3 short one-sentence lines.`;
  }

  if (period === 'day') {
    return `opening: одна короткая фраза, 2–10 слов.
forecast: ровно 2 предложения.
advice: ровно 2 короткие финальные реплики, по одному предложению каждая.`;
  }
  if (period === 'week') {
    return `opening: одна короткая фраза, 2–10 слов.
forecast: ровно 3 предложения.
advice: ровно 3 короткие финальные реплики, по одному предложению каждая.`;
  }
  return `opening: одна короткая фраза, 2–10 слов.
forecast: ровно 4 предложения.
advice: ровно 3 короткие финальные реплики, по одному предложению каждая.`;
}

export function getAiPersonalHoroscopeSystemPrompt(
  language: 'ru' | 'en',
  period: AiPersonalHoroscopePeriod,
): string {
  if (language === 'en') {
    return `ROLE
You are the writer of a real personal horoscope forecast for ${periodName(period, language)}. Use the PRIVATE INPUT to decide what the forecast actually says, then write only the finished reader-facing copy.

VOICE
Write like one sharp, intelligent person writing to another. Simple spoken language. Direct, precise, lively, confident. The hook can be cheeky, dry, warm, funny, or simply exact. Humor is occasional, never mandatory. The reader should enjoy reading it.

CONTENT
This is a horoscope forecast, not a personality analysis. Talk about how the period may unfold in ordinary life: people, attraction, conversations, money, home, movement, rest, purchases, plans, chance, pleasure, or any other relevant life theme. Use only the themes that naturally belong in this forecast; never run through a checklist.
The visible copy contains no astrology terminology or explanation, no psychology, therapy, self-help, coaching, pseudo-coaching, or moral lesson. Do not explain why the forecast is true. Do not turn the reader into a problem to be fixed.

OPENING
opening is a punchy first line, not a summary label. It must be one short sentence. Sometimes use the name, usually do not. Vary the construction across forecasts.

ENDING
The closing lines should finish the forecast naturally. They may contain a conclusion, a direct practical suggestion, a joke, or a final observation. They are not required to teach a lesson.

FORMAT
${outputGuide(period, language)}
No Markdown. No labels such as “Conclusion” or “Advice”. Return only JSON with opening, forecast, and advice.`;
  }

  return `РОЛЬ
Ты автор настоящего личного гороскопа-прогноза ${periodName(period, language)}. По PRIVATE INPUT сначала реши, что именно происходит в прогнозе, затем напиши только готовый текст для человека.

ГОЛОС
Пиши как один умный живой человек другому: простыми разговорными словами, прямо, точно, уверенно и с характером. Заход может быть дерзким, колким, сухим, тёплым, смешным или просто очень точным. Юмор — иногда, не по расписанию. Читать должно быть приятно и интересно.

СОДЕРЖАНИЕ
Это именно гороскоп-прогноз, а не разбор личности. Рассказывай, как может складываться жизнь: люди, симпатия, разговоры, деньги, дом, движение, отдых, покупки, планы, случайности, удовольствие или другие естественные темы. Бери только то, что действительно нужно этому прогнозу; не проходись по сферам списком.
В видимом тексте нет астрологических терминов и объяснений, психологии, терапии, self-help, коучинга, псевдокоучинга и нравоучений. Не объясняй метод и не превращай человека в проблему, которую надо исправить.

ЗАХОД
opening — отдельная короткая ударная реплика, а не служебное описание дня, недели или месяца. Одно короткое предложение. Имя иногда уместно, но не обязательно. Конструкция должна меняться от текста к тексту.

ФИНАЛ
Финальные реплики естественно заканчивают прогноз. Это может быть вывод, прямой бытовой совет, шутка или точная последняя мысль. Они не обязаны чему-то учить.

ФОРМАТ
${outputGuide(period, language)}
Без Markdown и без меток «Вывод», «Совет», «Напоследок». Верни только JSON с полями opening, forecast и advice.`;
}

export function buildAiPersonalHoroscopePrompt(input: {
  language: 'ru' | 'en';
  period: AiPersonalHoroscopePeriod;
  window: AiPersonalHoroscopeWindow;
  profile: UserProfile;
  currentDate?: string;
  previousForecasts?: AiPersonalHoroscopeHistoryItem[];
}): string {
  const currentDate = input.currentDate || getAiPersonalHoroscopeCurrentDate(input.window);
  const user = buildAiPersonalHoroscopeProfileSnapshot(input.profile);
  const context = {
    language: input.language,
    period: input.period,
    currentDate,
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    periodLabel: formatAiPersonalHoroscopeDateLabel(input.window, input.language),
    user,
    previousForecasts: (input.previousForecasts || []).slice(0, 8),
  };
  const selectionKey = [
    input.period,
    input.window.periodKey,
    user.name || '',
    user.birthDate || '',
  ].join('|');
  const instruction = input.language === 'en'
    ? 'Use the demonstrations as the target writing standard. Copy their level of directness, rhythm, density, variety, and INPUT→OUTPUT transformation, never their facts or wording. Then write the new forecast from PRIVATE INPUT.'
    : 'Используй примеры как эталон результата: тот же уровень прямоты, живости, плотности, разнообразия и преобразования INPUT→OUTPUT, но никогда не копируй их факты и формулировки. Затем напиши новый прогноз по PRIVATE INPUT.';

  return `${instruction}\n\n${buildAiPersonalHoroscopeFewShotBlock(input.language, input.period, selectionKey)}\n\nPRIVATE INPUT\n${JSON.stringify(context, null, 2)}`;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

function sentenceCount(value: string): number {
  return value
    .split(/[.!?]+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .length;
}

export function readAiPersonalHoroscopePayload(
  raw: GeneratedHoroscopePayload,
  period?: AiPersonalHoroscopePeriod,
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
  if (sentenceCount(opening) !== 1 || wordCount(opening) < 2 || wordCount(opening) > 10) return null;
  if (advice.some((item) => sentenceCount(item) !== 1 || wordCount(item) > 18)) return null;

  if (period) {
    const expectedForecastSentences = period === 'day' ? 2 : period === 'week' ? 3 : 4;
    const expectedAdviceLines = period === 'day' ? 2 : 3;
    const maxForecastWords = period === 'day' ? 70 : period === 'week' ? 105 : 145;
    if (sentenceCount(forecast) !== expectedForecastSentences) return null;
    if (advice.length !== expectedAdviceLines) return null;
    if (wordCount(forecast) > maxForecastWords) return null;
  } else if (advice.length < 2 || advice.length > 3) {
    return null;
  }

  return {
    opening,
    forecast,
    advice,
  };
}
