import { getContentPolicy, type LumiaContentType } from './contentMatrix';

export type LumiaPromptLanguage = 'ru' | 'en';
export type LumiaPrompt = {
  system: string;
  user: string;
  promptVersion: string;
  responseFormat: 'json_object';
};

type PromptInput = {
  language?: LumiaPromptLanguage;
  context?: unknown;
};

const FORBIDDEN = 'Не используй фразы «энергии вселенной», «космос направляет», «судьба говорит», мистический туман, фатализм, запугивание и гарантии. Не давай медицинских, юридических или финансовых обещаний.';
const VOICE = 'Пиши на «ты», мягко, конкретно и человеческим языком. Первое предложение должно цеплять. Один блок — одна мысль. Лучше меньше, но точнее.';

function contextBlock(context: unknown): string {
  if (context == null || context === '') return 'Контекст не передан.';
  return typeof context === 'string' ? context : JSON.stringify(context, null, 2);
}

function buildPrompt(type: LumiaContentType, schema: string, task: string, input: PromptInput = {}, extra = ''): LumiaPrompt {
  const policy = getContentPolicy(type);
  const language = input.language === 'en' ? 'English' : 'Russian';
  return {
    promptVersion: policy.promptVersion,
    responseFormat: 'json_object',
    system: `Ты — редактор Lumia. ${VOICE} ${FORBIDDEN} Верни только валидный JSON без markdown и текста вокруг JSON.`,
    user: `${task}\n\nПравила типа контента:\n- Язык ответа: ${language}.\n- Общий объём всех текстовых полей: ${policy.words.min}-${policy.words.max} слов.\n- Назначение: ${policy.purpose}.\n- Стиль: ${policy.style}\n- Добавь хотя бы один конкретный жизненный пример или наблюдаемую ситуацию.\n${extra}\n\nСхема JSON:\n${schema}\n\nКонтекст:\n${contextBlock(input.context)}`,
  };
}

export function buildPushDailyPrompt(input: PromptInput = {}): LumiaPrompt {
  return buildPrompt('push_daily', '{ "text": "..." }', 'Создай короткий push дня: одна полезная мысль, которая понятна без открытия приложения.', input, '- Без списков, заголовков, лирики и астрологических терминов.');
}

export function buildDayCardPrompt(input: PromptInput = {}): LumiaPrompt {
  return buildPrompt('day_card', '{ "headline": "...", "text": "...", "advice": "..." }', 'Создай карточку дня, которая целиком помещается на одном экране.', input, '- Без списков. Один фокус и один выполнимый совет.');
}

export function buildSignDailyHoroscopePrompt(input: PromptInput = {}): LumiaPrompt {
  return buildPrompt('sign_daily_horoscope', '{ "headline": "...", "text": "...", "advice": "..." }', 'Создай общий дневной гороскоп по знаку, не выдавая его за личный прогноз по карте.', input, '- Один фокус дня. Не перечисляй подряд любовь, работу, деньги и здоровье. Без списков. Пиши гендерно-нейтрально: один и тот же гороскоп читают и мужчины, и женщины, поэтому избегай слов, выдающих пол адресата (прошедшее время глаголов и прилагательные про «тебя»). Нейтральный тон — без перекоса в сплошной позитив или тревогу.');
}

export function buildSignWeeklyHoroscopePrompt(input: PromptInput = {}): LumiaPrompt {
  return buildPrompt('sign_weekly_horoscope', '{ "headline": "...", "text": "...", "advice": ["...", "..."] }', 'Создай общий недельный гороскоп по знаку.', input, '- Один главный сюжет недели и ровно два коротких практичных совета. Не делай обзор всех сфер жизни. Пиши гендерно-нейтрально: гороскоп читают и мужчины, и женщины, поэтому избегай форм, выдающих пол адресата (прошедшее время глаголов и прилагательные про «тебя»). Нейтральный тон — без перекоса в сплошной позитив или тревогу.');
}

export function buildPersonalDailyPrompt(input: PromptInput = {}): LumiaPrompt {
  return buildPrompt('personal_daily', '{ "headline": "...", "main": "...", "relationships": "...", "action": "...", "risk": "...", "why": "..." }', 'Создай личный день по карте и текущему контексту.', input, '- Поле why — максимум 15 слов. Не больше двух астрологических терминов; каждый термин сразу объясни простыми словами. Без списков.');
}

export function buildBlindSpotPrompt(input: PromptInput & { focus?: string } = {}): LumiaPrompt {
  const focusLine = input.focus ? ` Опирайся именно на: ${input.focus}` : '';
  return buildPrompt('blind_spot', '{ "headline": "Что ты можешь не замечать", "text": "...", "example": "...", "soft_step": "..." }', `Мягко и точно покажи одну слепую зону поведения.${focusLine}`, input, '- Без обвинений и диагнозов. Не перечисляй несколько проблем; разбери одну узнаваемую реакцию.');
}

export function buildNatalSectionPrompt(input: PromptInput & { title?: string; focus?: string } = {}): LumiaPrompt {
  const focusLine = input.focus
    ? ` Читай в карте именно это (а не всё подряд): ${input.focus} Текст обязан оправдать название и быть про эту тему, а не про характер вообще; переводи планеты и дома в живые узнаваемые наблюдения, не называя их ярлыками.`
    : '';
  return buildPrompt('natal_section', '{ "title": "...", "text": "...", "soft_warning": "...", "practical_hint": "..." }', `Создай раздел натальной карты${input.title ? ` «${input.title}»` : ''}, опираясь на карту, но человеческим языком.${focusLine}`, input, '- Не больше двух астрологических терминов. Без длинных списков. Если точность ограничена неизвестным временем рождения, честно укажи это в soft_warning.');
}

export function buildSignCompatibilityPrompt(input: PromptInput = {}): LumiaPrompt {
  return buildPrompt('sign_compatibility', '{ "attraction": "...", "difficulty": "...", "communication": "..." }', 'Создай бесплатную совместимость двух знаков.', input, '- Три коротких практичных блока: что тянет, где сложно, как общаться. Без списков, счёта совместимости и фатализма.');
}

export function buildSynastryPrompt(input: PromptInput = {}): LumiaPrompt {
  return buildPrompt('deep_report', '{ "summary": "...", "generalTheme": "...", "attraction": "...", "difficulties": "...", "recommendations": ["...", "...", "..."], "potential": "..." }', 'Создай подробный разбор «Что между вами» по двум картам.', input, '- В контексте есть synastryAspects — реальные углы между планетами двух карт (соединение/трин/секстиль = легче и притягивает, квадрат/оппозиция = напряжение). Делай выводы про притяжение, трения и советы ИМЕННО из этих аспектов (например: Венера одного в трине к Марсу другого — лёгкое притяжение; Луна в квадрате к Сатурну — холодок в близости). Если аспектов мало (партнёр без времени рождения) — опирайся на то, что есть, и не выдумывай. Не называй аспекты вслух как термины — переводи в живые наблюдения. Не используй термин «синастрия» в пользовательском тексте. Список только в recommendations — ровно три практичных шага.');
}

/** Parse model JSON without allowing malformed output to break a content surface. */
export function parseLumiaJson<T>(value: unknown, fallback: T): T {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : fallback;
  } catch {
    return fallback;
  }
}
