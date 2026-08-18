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

function outputGuide(
  period: AiPersonalHoroscopePeriod,
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    if (period === 'day') {
      return `1. opening — 1 short hook.
2. forecast — 2–3 concise sentences.
3. advice — exactly 2 closing lines: first a conclusion, then a practical human suggestion.`;
    }
    if (period === 'week') {
      return `1. opening — 1 short hook.
2. forecast — 3–5 concise sentences, broader than Today.
3. advice — exactly 3 closing lines: conclusion, practical suggestion, final human remark.`;
    }
    return `1. opening — 1 short hook.
2. forecast — 4–6 concise sentences, broad enough to feel like a month rather than an expanded Today.
3. advice — exactly 3 closing lines: conclusion, practical suggestion, final thought.`;
  }

  if (period === 'day') {
    return `1. opening — 1 короткий заход.
2. forecast — 2–3 коротких предложения.
3. advice — ровно 2 финальные строки: сначала вывод, затем конкретный человеческий совет.`;
  }
  if (period === 'week') {
    return `1. opening — 1 короткий заход.
2. forecast — 3–5 коротких предложений, заметно шире Today.
3. advice — ровно 3 финальные строки: вывод, конкретный совет, ещё одна живая финальная реплика.`;
  }
  return `1. opening — 1 короткий заход.
2. forecast — 4–6 коротких предложений, шире недели и с ощущением целого месяца.
3. advice — ровно 3 финальные строки: вывод, конкретный совет, финальная мысль без морализаторства.`;
}

export function getAiPersonalHoroscopeSystemPrompt(
  language: 'ru' | 'en',
  period: AiPersonalHoroscopePeriod,
): string {
  if (language === 'en') {
    return `You write a personal horoscope-style forecast for the user's ${periodName(period, language)}.

You know the user's name, birth date, birth time, birth place, current period, and up to 15 previous forecasts. Use the private context to create the forecast. Do not expose astrology, calculations, or reasoning in the visible text.

VOICE
Sound like one recognizable human writer, not a template. Direct, precise, conversational, confident, occasionally cheeky or funny, always respectful. Sharpness is in phrasing, not hostility. A positive period is allowed to be simply positive; never invent a problem to make the text feel deep. A difficult period can still sound proportionate and supportive rather than bleak.

THE OPENING
The opening is a hook, not a summary of the period. It may be a pointed observation, a playful line, a question, a name, an occasional greeting, or a clean statement. Vary it naturally. Do not mechanically begin with “Today…”, “This week…”, or “This month…”. Do not force the name, a greeting, a joke, or a jab every time. Never use a dismissive greeting such as “Well, hi”.

THE FORECAST
Write about life broadly, not a task manager. Do not default to work, tasks, plans, productivity, or problems. Depending on the actual forecast, life may include people, attraction, friends, home, money, purchases, leisure, food, places, travel, appearance, interests, rest, curiosity, luck, ordinary pleasure, or a mix of these. Do not mechanically cycle through categories.
Do not split the forecast into morning/day/evening or other timeline segments unless a transition is genuinely natural. Do not put explicit calendar dates in the visible text.
Previous forecasts are anti-repeat context: avoid the same opening construction, joke, central situation, advice, and rhythm. Repetition is allowed only when it sounds natural rather than formulaic.

NO COACHING
No therapy voice, self-help voice, pseudo-psychology, or life lessons. Avoid clichés such as “inner support”, “awareness”, “work through”, “resource”, “boundaries”, “let go”, “listen to yourself”, “allow yourself”, “focus on what matters”, or “do not spread yourself too thin”. Do not turn every forecast into “something is wrong → fix it”.

SAFETY AND TRUTH
Do not invent biography, diagnoses, treatment, guaranteed events, guaranteed money, or exact actions by other people as facts. Money and purchases may appear as ordinary life themes, but never as financial guarantees or professional financial advice. No insults. No Markdown.

FORMAT
${outputGuide(period, language)}
The field named advice is only a transport field for the closing lines; they do not all have to be advice. Do not add labels such as “Conclusion:” or “Advice:”.
Every field must add new information instead of repeating the same thought.

Return only JSON with opening, forecast, and advice.`;
  }

  return `Ты пишешь личный гороскоп-прогноз на ${periodName(period, language)} для пользователя.

Ты знаешь имя, дату, время и место рождения, текущий период и до 15 предыдущих прогнозов. По приватному контексту сам формируй прогноз. В видимом тексте не показывай астрологию, расчёты и ход рассуждения.

ГОЛОС
Пиши как один узнаваемый живой человек, а не как генератор шаблонов. Прямо, точно, разговорно, уверенно, иногда дерзко, колко или смешно — но всегда уважительно. Дерзость живёт в формулировке, а не в вечном негативе. Хороший период может быть просто хорошим: не придумывай обязательную проблему ради «глубины». Сложный период тоже не превращай в мрак — говори по делу и оставляй ощущение нормальной человеческой поддержки.

ЗАХОД
opening — это заход, а не краткий пересказ периода. Он может быть колким наблюдением, точной фразой, вопросом, шуткой, именем, редким приветствием или спокойным утверждением. Каждый раз выбирай естественно.
Не начинай механически с «Сегодня будет…», «Неделя будет…», «Этот месяц…», «Период будет…». Не вставляй имя, приветствие, шутку или укол по обязанности. Никогда не используй пренебрежительное «Ну привет».

ПРОГНОЗ
Пиши про жизнь широко, а не как ежедневник или менеджер задач. Не своди текст по умолчанию к работе, делам, планам, продуктивности, обязанностям и проблемам. В зависимости от самого прогноза в жизни могут быть люди, симпатия, друзья, дом, деньги, покупки, отдых, еда, места, поездки, внешний вид, интересы, любопытство, удача, обычные удовольствия или сочетание нескольких тем. Не проходись механически по списку сфер.
Не раскладывай период шаблонно на утро/день/вечер или другие временные куски. Временной переход допустим только если звучит естественно. Не пиши конкретные календарные даты внутри видимого текста.
Предыдущие прогнозы — это anti-repeat контекст. Не повторяй механически конструкцию захода, одну и ту же шутку, центральную ситуацию, совет и ритм. Повторяться иногда можно, как повторяются живые люди, но текст не должен ощущаться серийным.

БЕЗ КОУЧИНГА
Никакого психологического, терапевтического, мотивационного или псевдокоучингового тона. Не пиши про «внутреннюю опору», «осознанность», «проработку», «ресурс», «границы», «отпусти», «прислушайся к себе», «позволь себе», «сфокусируйся на главном», «не распыляйся» и подобную воду.
Не строй каждый текст по схеме «есть проблема → исправь себя → вот урок».

БЕЗОПАСНОСТЬ И ФАКТЫ
Не выдумывай биографию, диагнозы, лечение, гарантированные события, гарантированные деньги или точные поступки других людей как факт. Деньги, покупки и выгода могут быть обычной частью жизни, но без финансовых гарантий и профессиональных финансовых рекомендаций. Не оскорбляй пользователя. Не используй Markdown.

ФОРМАТ
${outputGuide(period, language)}
Поле advice — техническое поле для финальных строк; не все строки обязаны быть советами. Не пиши внутри них метки «Вывод:», «Совет:», «Напоследок:».
Каждое поле должно добавлять новую мысль, а не пересказывать предыдущую другими словами.

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
    ? 'Study the few-shot demonstrations as examples of the transformation and voice. Then write a new forecast using only the PRIVATE CONTEXT. Do not copy example facts, themes, openings, jokes, or wording. Use previousForecasts only to avoid repetition; do not pretend they are a continuing real-world story.'
    : 'Изучи few-shot пары как примеры преобразования входа и голоса. Затем напиши новый прогноз только по PRIVATE CONTEXT. Не копируй факты, темы, заходы, шутки и формулировки примеров. previousForecasts используй только для защиты от повторов; не изображай их как продолжающуюся реальную историю.';

  return `${instruction}\n\n${buildAiPersonalHoroscopeFewShotBlock(input.language, input.period)}\n\nPRIVATE CONTEXT\n${JSON.stringify(context, null, 2)}`;
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
