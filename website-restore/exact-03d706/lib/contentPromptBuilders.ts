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

// SYSTEM = единый голос приложения (lib/appVoice.ts). TASK ниже задаёт только
// задачу функции и формат ответа. Он не создаёт отдельный тон или персонажа.
function buildPrompt(
  type: GeneratedContentType,
  schema: string,
  task: string,
  input: PromptInput = {},
  extra = '',
): AppContentPrompt {
  const policy = getContentPolicy(type);
  const lang: AppPromptLanguage = input.language === 'en' ? 'en' : 'ru';
  const language = lang === 'en' ? 'English' : 'Russian';
  return {
    promptVersion: policy.promptVersion,
    responseFormat: 'json_object',
    system: getAppSystemVoice(lang),
    user: `${task}

Правила типа контента:
- Язык ответа: ${language}.
- Объём: не больше ${policy.words.max} слов на весь ответ. Если ответ уже закончен — остановись раньше.
- Назначение: ${policy.purpose}.
- Ограничения содержания: ${policy.style}
- Сразу отвечай по существу. Не добавляй вводные фразы о карте, «темах», «глубине» или процессе анализа.
- Добавь хотя бы одну конкретную ситуацию, действие, разговор или решение, если это подтверждается контекстом.
${extra}

Верни только валидный JSON по схеме, без markdown и текста вокруг.
Схема JSON:
${schema}

Контекст:
${contextBlock(input.context)}`,
  };
}

export function buildPushDailyPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt(
    'push_daily',
    '{ "text": "..." }',
    'Напиши короткий push дня. Сразу назови один конкретный вывод или риск, понятный без открытия приложения.',
    input,
    '- Без списков, заголовков, лирики и астрологических терминов. Не пиши «важно», если после него нет конкретного действия или ситуации.',
  );
}

export function buildDayCardPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt(
    'day_card',
    '{ "headline": "...", "text": "...", "advice": "..." }',
    'Напиши короткий прогноз дня, который целиком помещается на одном экране.',
    input,
    '- headline — прямой вывод. text — одна узнаваемая ситуация. advice — одно конкретное действие или запрет. Без списков.',
  );
}

export function buildSignDailyHoroscopePrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt(
    'sign_daily_horoscope',
    '{ "headline": "...", "text": "...", "advice": "..." }',
    'Напиши общий дневной гороскоп по знаку. Не выдавай его за личный прогноз по натальной карте.',
    input,
    '- В context.moon передана реальная фаза Луны этого дня. Используй её только как один расчётный фактор. Не пиши «энергия Луны» и не объясняй астрономию без необходимости. headline — конкретная суть дня; text — одна обычная ситуация; advice — одно выполнимое действие. Не перечисляй подряд любовь, работу, деньги и здоровье. Пиши гендерно-нейтрально.',
  );
}

export function buildSignWeeklyHoroscopePrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt(
    'sign_weekly_horoscope',
    '{ "headline": "...", "summary": "...", "reading": "...", "focus": "...", "chance": "...", "risk": "...", "context": "...", "advice": ["...", "...", "..."] }',
    'Напиши общий недельный гороскоп по знаку. Не выдавай его за личный прогноз по натальной карте.',
    input,
    '- Выбери один главный сюжет недели. headline — короткий вывод; summary — 1–2 предложения; reading — законченный разбор без пересказа summary; focus — на что смотреть при решении; chance — какое условие помогает; risk — где человек сам усложнит ситуацию; context прямо говорит, что прогноз общий для знака; advice — до трёх разных конкретных действий. Не перечисляй все сферы жизни, не выдумывай события и не обещай результат. Пиши гендерно-нейтрально.',
  );
}

export function buildSignMonthlyHoroscopePrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt(
    'sign_monthly_horoscope',
    '{ "headline": "...", "summary": "...", "reading": "...", "focus": "...", "chance": "...", "risk": "...", "context": "...", "advice": ["...", "...", "..."] }',
    'Напиши общий гороскоп по знаку на месяц. Не выдавай его за личный прогноз по натальной карте.',
    input,
    '- Выбери один главный сюжет месяца. headline — короткий вывод; summary — 1–2 предложения; reading — законченный разбор без пересказа summary; focus — на что смотреть при решении; chance — какое условие помогает; risk — где человек сам усложнит ситуацию; context прямо говорит, что прогноз общий для знака; advice — до трёх разных конкретных действий. Не перечисляй все сферы жизни, не дели месяц по неделям, не выдумывай события и не обещай результат. Пиши гендерно-нейтрально.',
  );
}

export function buildBlindSpotPrompt(input: PromptInput & { focus?: string } = {}): AppContentPrompt {
  const focusLine = input.focus ? ` Используй только эти данные: ${input.focus}` : '';
  return buildPrompt(
    'blind_spot',
    '{ "headline": "Что ты можешь не замечать", "text": "...", "example": "...", "soft_step": "..." }',
    `Опиши одну привычную реакцию, которую человек может не замечать и которая иногда ему мешает.${focusLine}`,
    input,
    '- Без диагнозов и выдуманной биографии. headline — прямой вывод; text — объяснение; example — одна обычная ситуация; soft_step — одно конкретное действие без коучинговых формул.',
  );
}

export function buildNatalSectionPrompt(input: PromptInput & { title?: string; focus?: string } = {}): AppContentPrompt {
  const focusLine = input.focus
    ? ` Используй только эти данные по теме: ${input.focus} Не уходи в общий характер.`
    : '';
  return buildPrompt(
    'natal_section',
    '{ "title": "...", "text": "...", "soft_warning": "...", "practical_hint": "..." }',
    `Напиши раздел натальной карты${input.title ? ` «${input.title}»` : ''}.${focusLine}`,
    input,
    '- Первое предложение — прямой вывод по теме. Затем покажи одну узнаваемую ситуацию и коротко объясни, какие переданные данные карты дают этот вывод. Дерзость — в точности, не в грубости. Не больше двух астрологических терминов. Без длинных списков, психологической воды и повторов. Если время рождения ограничивает точность, напиши это простыми словами в soft_warning.',
  );
}

export function buildSignCompatibilityPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt(
    'sign_compatibility',
    '{ "attraction": "...", "difficulty": "...", "communication": "..." }',
    'Напиши бесплатную совместимость двух знаков.',
    input,
    '- Три коротких блока: что обычно сближает, где чаще возникает проблема, как договориться. Каждый блок открывает новую сторону пары и не повторяет предыдущий. Показывай узнаваемые бытовые сцены, разговоры и решения вместо общих характеристик знаков. Текст должен вызывать желание сравнить другие пары за счёт точности и узнаваемости, а не за счёт рекламного призыва. Без счёта совместимости, диагнозов и обещаний будущего.',
  );
}

export function buildSynastryPrompt(input: PromptInput = {}): AppContentPrompt {
  return buildPrompt(
    'deep_report',
    '{ "summary": "...", "sections": [{ "id": "id из context.calculated.sectionPlan", "text": "..." }], "closing": { "strength": "...", "risk": "...", "action": "..." } }',
    'Ты — только writer layer для уже рассчитанной совместимости двух людей. Имена бери из context.people.subject.name и context.people.partner.name. Сервер уже рассчитал score, dimensions и evidence: не пересчитывай, не исправляй и не оценивай их заново.',
    input,
    '- Пиши только по context.calculated: dimensions, strongestDimensions, challengingDimensions, evidence, directionalPatterns, limitations, overallScore и sectionPlan. Не вычисляй и не выдумывай положения планет, дома, аспекты, градусы, орбы, мысли, мотивы или события. Не возвращай compatibilityScore, overallScore, dimensions, verdict или другие числа расчёта — их владельцем остаётся deterministic engine. Верни каждый id из context.calculated.sectionPlan ровно один раз и в том же порядке; title не возвращай. Для каждого раздела используй только его evidenceIds и связанные directionalPatterns. Если evidenceIds пуст, прямо оставайся на общем уровне и не достраивай детали. summary — 2–4 предложения: сразу назови главный сценарий именно этой пары, затем покажи конкретное несовпадение или риск и закончи тем, что удерживает контакт. Каждый section.text — 1–3 коротких абзаца и новая мысль: что происходит, как это выглядит в узнаваемой бытовой сцене, где помогает или мешает и что конкретно помогает. Не повторяй summary и соседние разделы. Меняй длину и ритм предложений; не начинай два раздела одинаково. Мини-сцены выводи только из рассчитанной темы: темп ответа, способ обсуждать решение, пауза, инициатива, конкретный поступок, распределение ролей или реакция под давлением. Не приписывай чувства и намерения как факты. В closing дай три самостоятельные короткие строки: strength — главная сила, risk — повторяющийся сбой, action — одно понятное действие; не копируй summary дословно. Не делай натальный портрет каждого человека. Не показывай в основном тексте внутренние поля и астрологический жаргон. Love описывает симпатию и сближение; Relationship — жизнь существующей пары. В Friendship, Family и Work не добавляй романтическое или сексуальное притяжение. Пол используй только для естественной грамматики, без стереотипов. Пиши прямым живым русским языком. Избегай машинных связок «здесь», «ощущается», «считывается», «между вами присутствует», «проявляется», «может быть непросто», «заметно там, где», «в этой связи», «наблюдается», «возникает динамика», а также слов «возможно» и «скорее всего» без необходимости. Не используй мистику, фатализм, психологические диагнозы, коучинговые формулы, «вам суждено», «кармический союз», обещания брака, разрыва, измены или карьерного результата. Используй имена естественно и редко, без приветствия. Никаких рекламных призывов.',
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
