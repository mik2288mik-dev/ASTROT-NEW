import { getContentPolicy, type GeneratedContentType } from './contentMatrix';
import { getAppSystemVoice } from './appVoice';

export type AppPromptLanguage = 'ru' | 'en';
export type AppContentPrompt = {
  system: string;
  user: string;
  promptVersion: string;
  responseFormat: 'json_object';
};

type PromptInput = {
  language?: AppPromptLanguage;
  context?: unknown;
};

function contextBlock(context: unknown): string {
  if (context == null || context === '') return 'Контекст не передан.';
  return typeof context === 'string' ? context : JSON.stringify(context, null, 2);
}

// SYSTEM = единый голос приложения (lib/appVoice.ts). TASK ниже добавляет только
// конкретную задачу фичи и формат ответа, НЕ переопределяя голос.
function buildPrompt(type: GeneratedContentType, schema: string, task: string, input: PromptInput = {}, extra = ''): AppContentPrompt {
  const policy = getContentPolicy(type);
  const lang: AppPromptLanguage = input.language === 'en' ? 'en' : 'ru';
  const language = lang === 'en' ? 'English' : 'Russian';
  return {
    promptVersion: policy.promptVersion,
    responseFormat: 'json_object',
    system: getAppSystemVoice(lang),
    user: `${task}\n\nПравила типа контента:\n- Язык ответа: ${language}.\n- Объём: не больше ${policy.words.max} слов на весь ответ (это потолок). Если мысль короче — оставь короче.\n- Назначение: ${policy.purpose}.\n- Ограничения содержания: ${policy.style}\n- Добавь хотя бы один конкретный жизненный пример или наблюдаемую ситуацию.\n${extra}\n\nВерни только валидный JSON по схеме, без markdown и текста вокруг.\nСхема JSON:\n${schema}\n\nКонтекст:\n${contextBlock(input.context)}`,
  };
}

export function buildPushDailyPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt('push_daily', '{ "text": "..." }', 'Создай короткий push дня: одна полезная мысль, которая понятна без открытия приложения.', input, '- Без списков, заголовков, лирики и астрологических терминов.');
}

export function buildDayCardPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt('day_card', '{ "headline": "...", "text": "...", "advice": "..." }', 'Создай карточку дня, которая целиком помещается на одном экране.', input, '- Без списков. Один фокус и один выполнимый совет.');
}

export function buildSignDailyHoroscopePrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt('sign_daily_horoscope', '{ "headline": "...", "text": "...", "advice": "..." }', 'Создай общий дневной гороскоп по знаку, не выдавая его за личный прогноз по карте.', input, '- В контексте есть moon — реальная фаза Луны ИМЕННО этого дня (phase/illumination/meaning). Оттолкнись от неё, чтобы текст был про конкретный день, а не про знак вообще: фаза задаёт контекст дня (новолуние — старт, полнолуние — кульминация и видимость, убывающая — завершение). НЕ называй фазу термином и НЕ пиши «энергия Луны» — переведи её в наблюдаемую ситуацию и один практичный фокус. Один фокус дня. Не перечисляй подряд любовь, работу, деньги и здоровье. Без списков. Пиши гендерно-нейтрально: один и тот же гороскоп читают и мужчины, и женщины, поэтому избегай слов, выдающих пол адресата (прошедшее время глаголов и прилагательные про «тебя»).');
}

export function buildSignWeeklyHoroscopePrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt(
    'sign_weekly_horoscope',
    '{ "headline": "...", "summary": "...", "reading": "...", "focus": "...", "chance": "...", "risk": "...", "context": "...", "advice": ["...", "...", "..."] }',
    'Создай общий недельный гороскоп по знаку, не выдавая его за личный прогноз по натальной карте.',
    input,
    '- Выбери одну узнаваемую тему недели и покажи, как она может проявиться в обычной жизни. headline — короткая суть; summary — 1–2 предложения; reading — законченный разбор без пересказа summary; focus — что замечать в решениях; chance — на что можно опереться; risk — где человек может сам себе усложнить; context — честное пояснение, что это общий прогноз знака; advice — до трёх коротких неповторяющихся ориентиров. Не перечисляй все сферы жизни, не выдумывай события и не обещай результат. Если мысль закончена, остановись. Пиши гендерно-нейтрально.'
  );
}

export function buildSignMonthlyHoroscopePrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt(
    'sign_monthly_horoscope',
    '{ "headline": "...", "summary": "...", "reading": "...", "focus": "...", "chance": "...", "risk": "...", "context": "...", "advice": ["...", "...", "..."] }',
    'Создай общий гороскоп по знаку на месяц, не выдавая его за личный прогноз по натальной карте.',
    input,
    '- Выбери одну узнаваемую тему месяца и покажи, как она может проявиться в обычной жизни. headline — короткая суть; summary — 1–2 предложения; reading — законченный разбор без пересказа summary; focus — что замечать в решениях; chance — на что можно опереться; risk — где человек может сам себе усложнить; context — честное пояснение, что это общий прогноз знака; advice — до трёх коротких неповторяющихся ориентиров. Не перечисляй все сферы жизни, не дели месяц по неделям, не выдумывай события и не обещай результат. Если мысль закончена, остановись. Пиши гендерно-нейтрально.'
  );
}

export function buildSignYearlyHoroscopePrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt(
    'sign_yearly',
    '{ "headline": "...", "summary": "...", "focus": "...", "chance": "...", "risk": "...", "reading": "...", "context": "...", "advice": ["...", "...", "..."] }',
    'Создай короткий общий гороскоп по знаку на календарный год, не выдавая его за персональный натальный прогноз.',
    input,
    '- Выбери одну главную тему года. Не разбивай текст по месяцам. Не обещай брак, развод, увольнение, новую работу, доход, болезнь, переезд, встречу, точные даты, гарантированную удачу или гарантированную проблему. summary — 1–2 коротких предложения; focus, chance и risk отвечают каждый на свой вопрос; reading — короткий законченный разбор; context прямо говорит, что это общий разбор знака; advice — не больше трёх коротких неповторяющихся ориентиров. Если мысль закончена, остановись. Пиши гендерно-нейтрально.'
  );
}

export function buildBlindSpotPrompt(input: PromptInput & { focus?: string } = {}): AppContentPrompt {
  const focusLine = input.focus ? ` Опирайся именно на: ${input.focus}` : '';
  return buildPrompt('blind_spot', '{ "headline": "Что ты можешь не замечать", "text": "...", "example": "...", "soft_step": "..." }', `Покажи одну слепую зону поведения.${focusLine}`, input, '- Без диагнозов. Не перечисляй несколько проблем; разбери одну узнаваемую реакцию.');
}

export function buildNatalSectionPrompt(input: PromptInput & { title?: string; focus?: string } = {}): AppContentPrompt {
  const focusLine = input.focus
    ? ` Читай в карте именно это (а не всё подряд): ${input.focus} Текст обязан оправдать название и быть про эту тему, а не про характер вообще; переводи планеты и дома в живые узнаваемые наблюдения, не называя их ярлыками.`
    : '';
  return buildPrompt('natal_section', '{ "title": "...", "text": "...", "soft_warning": "...", "practical_hint": "..." }', `Создай раздел натальной карты${input.title ? ` «${input.title}»` : ''}, опираясь на карту, но человеческим языком.${focusLine}`, input, '- Первое предложение — сильный прямой вывод по теме. Затем покажи одну узнаваемую ситуацию из обычной жизни и коротко объясни, почему карта даёт такой вывод. Дерзость — в точности, не в грубости. Не больше двух астрологических терминов. Без длинных списков, коучинговой воды и повторов. Если точность ограничена неизвестным временем рождения, честно укажи это в soft_warning.');
}

export function buildSignCompatibilityPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt('sign_compatibility', '{ "attraction": "...", "difficulty": "...", "communication": "..." }', 'Создай бесплатную совместимость двух знаков.', input, '- Три коротких практичных блока: что тянет, где сложно, как общаться. Без списков, счёта совместимости и фатализма.');
}

export function buildSynastryPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt(
    'deep_report',
    '{ "summary": "...", "generalTheme": "...", "attraction": "...", "difficulties": "...", "recommendations": ["...", "...", "..."], "potential": "..." }',
    'Создай подробный разбор «Что между вами» по двум картам. Обращайся к человеку на «ты» по имени (profile.name), партнёра называй по имени (partnerName).',
    input,
    '- В context.relationship передан выбранный человеком тип связи: любовь, дружба, работа или семья. Разбирай именно его и не протаскивай романтическое притяжение в дружбу, работу или семейный контекст. Начни summary с прямого полезного вывода, затем покажи, как он проявляется в обычных ситуациях. В контексте есть synastryAspects — реальные углы между планетами двух карт (соединение/трин/секстиль = легче и притягивает, квадрат/оппозиция = напряжение). Делай выводы про сильные места, трения и рекомендации ИМЕННО из этих аспектов. Если аспектов мало (партнёр без времени рождения) — честно сузь вывод и не выдумывай. Не называй аспекты вслух как термины — переводи их в наблюдаемые проявления. Не используй термин «синастрия» в пользовательском тексте. Никаких обещаний брака, разрыва, измены или карьерного результата. Список только в recommendations — ровно три практичных шага.',
  );
}

/** Parse model JSON without allowing malformed output to break a content surface. */
export function parseModelJson<T>(value: unknown, fallback: T): T {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}
