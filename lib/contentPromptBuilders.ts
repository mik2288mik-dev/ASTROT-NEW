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
    user: `${task}\n\nПравила типа контента:\n- Язык ответа: ${language}.\n- Объём: не больше ${policy.words.max} слов на весь ответ (это потолок). Если мысль короче — оставь короче, не добивай водой ради объёма.\n- Назначение: ${policy.purpose}.\n- Стиль: ${policy.style}\n- Добавь хотя бы один конкретный жизненный пример или наблюдаемую ситуацию.\n${extra}\n\nВерни только валидный JSON по схеме, без markdown и текста вокруг.\nСхема JSON:\n${schema}\n\nКонтекст:\n${contextBlock(input.context)}`,
  };
}

export function buildPushDailyPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt('push_daily', '{ "text": "..." }', 'Создай короткий push дня: одна полезная мысль, которая понятна без открытия приложения.', input, '- Без списков, заголовков, лирики и астрологических терминов.');
}

export function buildDayCardPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt('day_card', '{ "headline": "...", "text": "...", "advice": "..." }', 'Создай карточку дня, которая целиком помещается на одном экране.', input, '- Без списков. Один фокус и один выполнимый совет.');
}

export function buildSignDailyHoroscopePrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt('sign_daily_horoscope', '{ "headline": "...", "text": "...", "advice": "..." }', 'Создай общий дневной гороскоп по знаку, не выдавая его за личный прогноз по карте.', input, '- В контексте есть moon — реальная фаза Луны ИМЕННО этого дня (phase/illumination/meaning). Оттолкнись от неё, чтобы текст был про конкретный день, а не про знак вообще: фаза задаёт настроение дня (новолуние — старт, полнолуние — кульминация и видимость, убывающая — отпускать и закрывать). НЕ называй фазу термином и НЕ пиши «энергия Луны» — переведи её в живое наблюдение и один практичный фокус. Один фокус дня. Не перечисляй подряд любовь, работу, деньги и здоровье. Без списков. Пиши гендерно-нейтрально: один и тот же гороскоп читают и мужчины, и женщины, поэтому избегай слов, выдающих пол адресата (прошедшее время глаголов и прилагательные про «тебя»). Нейтральный тон — без перекоса в сплошной позитив или тревогу.');
}

export function buildSignWeeklyHoroscopePrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt('sign_weekly_horoscope', '{ "headline": "...", "text": "...", "advice": ["...", "..."] }', 'Создай общий недельный гороскоп по знаку.', input, '- Один главный сюжет недели и ровно два коротких практичных совета. Не делай обзор всех сфер жизни. Пиши гендерно-нейтрально: гороскоп читают и мужчины, и женщины, поэтому избегай форм, выдающих пол адресата (прошедшее время глаголов и прилагательные про «тебя»). Нейтральный тон — без перекоса в сплошной позитив или тревогу.');
}

export function buildSignMonthlyHoroscopePrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt('sign_monthly_horoscope', '{ "headline": "...", "text": "...", "advice": ["...", "..."] }', 'Создай общий гороскоп по знаку на месяц.', input, '- Один главный сюжет месяца и ровно два коротких практичных совета. Не делай обзор всех сфер жизни и не разбивай по неделям. Пиши гендерно-нейтрально: гороскоп читают и мужчины, и женщины, поэтому избегай форм, выдающих пол адресата (прошедшее время глаголов и прилагательные про «тебя»). Нейтральный тон — без перекоса в сплошной позитив или тревогу.');
}

export function buildSignYearlyHoroscopePrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt(
    'sign_yearly',
    '{ "headline": "...", "summary": "...", "focus": "...", "chance": "...", "risk": "...", "reading": "...", "context": "...", "advice": ["...", "...", "..."] }',
    'Создай короткий общий гороскоп по знаку на календарный год, не выдавая его за персональный натальный прогноз.',
    input,
    '- Выбери одну главную тему года. Не разбивай текст по месяцам. Не обещай брак, развод, увольнение, новую работу, доход, болезнь, переезд, встречу, точные даты, гарантированную удачу или гарантированную проблему. summary — 1–2 коротких предложения; focus, chance и risk отвечают каждый на свой вопрос; reading — короткий законченный разбор; context прямо говорит, что это общий разбор знака; advice — не больше трёх коротких неповторяющихся ориентиров. Пиши гендерно-нейтрально и оставайся на стороне пользователя.'
  );
}

export function buildPersonalDailyPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt('personal_daily', '{ "headline": "...", "main": "...", "relationships": "...", "action": "...", "risk": "...", "why": "..." }', 'Создай личный день по карте и текущему контексту.', input, '- Поле why — максимум 15 слов. Не больше двух астрологических терминов; каждый термин сразу объясни простыми словами. Без списков.');
}

export function buildBlindSpotPrompt(input: PromptInput & { focus?: string } = {}): AppContentPrompt {
  const focusLine = input.focus ? ` Опирайся именно на: ${input.focus}` : '';
  return buildPrompt('blind_spot', '{ "headline": "Что ты можешь не замечать", "text": "...", "example": "...", "soft_step": "..." }', `Мягко и точно покажи одну слепую зону поведения.${focusLine}`, input, '- Без обвинений и диагнозов. Не перечисляй несколько проблем; разбери одну узнаваемую реакцию.');
}

export function buildNatalSectionPrompt(input: PromptInput & { title?: string; focus?: string } = {}): AppContentPrompt {
  const focusLine = input.focus
    ? ` Читай в карте именно это (а не всё подряд): ${input.focus} Текст обязан оправдать название и быть про эту тему, а не про характер вообще; переводи планеты и дома в живые узнаваемые наблюдения, не называя их ярлыками.`
    : '';
  return buildPrompt('natal_section', '{ "title": "...", "text": "...", "soft_warning": "...", "practical_hint": "..." }', `Создай раздел натальной карты${input.title ? ` «${input.title}»` : ''}, опираясь на карту, но человеческим языком.${focusLine}`, input, '- Не больше двух астрологических терминов. Без длинных списков. Если точность ограничена неизвестным временем рождения, честно укажи это в soft_warning.');
}

export function buildSignCompatibilityPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt('sign_compatibility', '{ "attraction": "...", "difficulty": "...", "communication": "..." }', 'Создай бесплатную совместимость двух знаков.', input, '- Три коротких практичных блока: что тянет, где сложно, как общаться. Без списков, счёта совместимости и фатализма.');
}

export function buildSynastryPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt('deep_report', '{ "summary": "...", "generalTheme": "...", "attraction": "...", "difficulties": "...", "recommendations": ["...", "...", "..."], "potential": "..." }', 'Создай подробный разбор «Что между вами» по двум картам. Пиши как тёплый честный друг-астролог, который знает обоих: обращайся к человеку на «ты» по имени (profile.name), партнёра называй по имени (partnerName). Без лести и без приговоров — по-человечески и по делу.', input, '- В контексте есть synastryAspects — реальные углы между планетами двух карт (соединение/трин/секстиль = легче и притягивает, квадрат/оппозиция = напряжение). Делай выводы про притяжение, трения и советы ИМЕННО из этих аспектов (например: Венера одного в трине к Марсу другого — лёгкое притяжение; Луна в квадрате к Сатурну — холодок в близости). Если аспектов мало (партнёр без времени рождения) — опирайся на то, что есть, и не выдумывай. Не называй аспекты вслух как термины — переводи в живые наблюдения. Не используй термин «синастрия» в пользовательском тексте. Список только в recommendations — ровно три практичных шага.');
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
