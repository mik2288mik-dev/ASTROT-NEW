/** Prompts for the long-scroll natal interpretation screen. */

import type { SerializedChartForPrompt } from './chartSerializer';

const NATAL_READING_TASK_RULES = `ТЕХНИЧЕСКИЕ ПРАВИЛА:
- Используй только переданные данные карты.
- Обращайся к читателю на «ты».
- Если используешь планету, знак, дом или аспект, сразу объясни его значение в описываемой ситуации.
- Соблюдай заданный формат вывода (теги или JSON) строго.
- Не добавляй комментариев до и после, не используй Markdown-заголовки внутри JSON-полей.`;

function chartHeader(chart: SerializedChartForPrompt): string {
  return `ДАННЫЕ КАРТЫ:
${JSON.stringify(chart, null, 2)}`;
}

/**
 * Portrait prompt — tagged output (parsed by parsePortraitTags).
 * Generates: 5 archetypes + subtitles, portrait, insight, two competing
 * energies + synthesis.
 */
export function buildPortraitPrompt(chart: SerializedChartForPrompt): string {
  return `${NATAL_READING_TASK_RULES}

${chartHeader(chart)}

ЗАДАЧА: создать ядро интерпретации этой натальной карты.

Придумай 5 принципиально разных архетипических образов для этой карты — каждый раскрывает другую грань личности. Не повторяй корневые слова. Каждый образ должен опираться на отдельный факт карты.

Плохо: «Духовный строитель», «Духовный созидатель», «Духовный творец».
Хорошо: «Человек действия», «Тихий стратег», «Прямой собеседник», «Собиратель смысла», «Наблюдатель с темпом».

Главное противоречие карты — две конкурирующие силы (например, мечтатель vs реалист, тихий vs прямой, дом vs движение). Назови их и покажи, в какую суперсилу они складываются.

ФОРМАТ ВЫВОДА (строго так, без лишнего текста):

[АРХЕТИП_1] 2–4 слова
[АРХЕТИП_2] 2–4 слова
[АРХЕТИП_3] 2–4 слова
[АРХЕТИП_4] 2–4 слова
[АРХЕТИП_5] 2–4 слова
[ПОДЗАГОЛОВОК_1] фраза-образ под первый архетип, 7–10 слов
[ПОДЗАГОЛОВОК_2] фраза-образ под второй
[ПОДЗАГОЛОВОК_3] фраза-образ под третий
[ПОДЗАГОЛОВОК_4] фраза-образ под четвёртый
[ПОДЗАГОЛОВОК_5] фраза-образ под пятый
[ПОРТРЕТ] 5–6 предложений о характере и поведении человека. Не список. Обращайся на «ты». Начни не со «Ты —», а с конкретного наблюдения.
[ИНСАЙТ] 2 предложения о черте, которую человек может не замечать в себе.
[ЭНЕРГИЯ_А_TITLE] первое имя силы карты (2–4 слова, без слова «энергия»)
[ЭНЕРГИЯ_А] 2 предложения, что эта сила делает в жизни
[ЭНЕРГИЯ_Б_TITLE] второе имя силы карты, конкурирующее с первой
[ЭНЕРГИЯ_Б] 2 предложения
[СИНТЕЗ] 2–3 предложения о суперсиле, которая возникает когда эти две силы перестают спорить и начинают работать вместе. Это не выход — это вершина карты.`;
}

/**
 * Aspects prompt — JSON output.
 * 5 key dynamic patterns of the chart with badges + a closing summary.
 */
export function buildAspectsPrompt(chart: SerializedChartForPrompt): string {
  return `${NATAL_READING_TASK_RULES}

${chartHeader(chart)}

ЗАДАЧА: выдели 5 ключевых астрологических акцентов этой карты — то, что реально определяет жизнь, а не общий список. Это могут быть: сильные положения планет, скопления, важные аспекты, мощные дома, специфические сочетания.

Для каждого акцента подбери:
- pl: короткая подпись «Планета · Дом» или «Планеты · Аспект» (на русском, кратко).
- badge: один из {"Трин", "Квадратура", "Соединение", "Сильная позиция", "Скопление", "Оппозиция", "Секстиль"}.
- color: hex цвета бейджа из соответствия:
    Трин → "#6aab96"
    Секстиль → "#7da5c8"
    Квадратура → "#e0985a"
    Оппозиция → "#c97c7c"
    Соединение → "#9a9a9a"
    Сильная позиция → "#c9a55a"
    Скопление → "#9b87c4"
- text: 2–3 предложения. Объясни, что этот акцент создаёт в реальной жизни человека (поведение, работа, отношения, чувства).

В конце добавь поле "resume" — 3–4 предложения с общим итогом по карте. Не повторяй сказанное буквально.

ФОРМАТ ВЫВОДА — строго JSON, без комментариев:
{
  "aspects": [
    {"pl": "...", "badge": "...", "color": "#......", "text": "..."},
    {"pl": "...", "badge": "...", "color": "#......", "text": "..."},
    {"pl": "...", "badge": "...", "color": "#......", "text": "..."},
    {"pl": "...", "badge": "...", "color": "#......", "text": "..."},
    {"pl": "...", "badge": "...", "color": "#......", "text": "..."}
  ],
  "resume": "..."
}`;
}

/**
 * Week forecast prompt — JSON output.
 * Frames the upcoming 7 days through this person's chart, not generic horoscope.
 */
export function buildWeekPrompt(
  chart: SerializedChartForPrompt,
  weekDates: { from: string; to: string }
): string {
  return `${NATAL_READING_TASK_RULES}

${chartHeader(chart)}

КОНТЕКСТ ВРЕМЕНИ: Текущая неделя с ${weekDates.from} по ${weekDates.to}.

ЗАДАЧА: написать прогноз на эту неделю КОНКРЕТНО для этой натальной карты. Не общий прогноз по знаку, а вывод из переданной карты.

ФОРМАТ ВЫВОДА — строго JSON:
{
  "title": "название недели, 2–5 слов",
  "body": "3–4 предложения. Что человек может заметить в себе и вокруг на этой неделе. Можно дать одну рекомендацию в конце."
}`;
}

/**
 * Today prompt — JSON output. Premium content.
 */
export function buildTodayPrompt(
  chart: SerializedChartForPrompt,
  dateLabel: string
): string {
  return `${NATAL_READING_TASK_RULES}

${chartHeader(chart)}

КОНТЕКСТ ВРЕМЕНИ: Сегодня ${dateLabel}.

ЗАДАЧА: написать прогноз на сегодня для этой натальной карты.

ФОРМАТ ВЫВОДА — строго JSON:
{
  "title": "название дня, 2–5 слов",
  "main": "2–3 предложения. Главный вывод дня для этого человека. Что он может почувствовать или с чем столкнуться.",
  "love": "2–3 предложения. Как расчёт дня связан с близостью, отношениями и общением с теми, кто рядом.",
  "work": "2–3 предложения. Что этот день даёт в работе, делах, решениях. Конкретно и без шаблона.",
  "energy": "2–3 предложения. Тело, силы, ритм. Что важно сегодня: распределение нагрузки и восстановление."
}`;
}

/**
 * Deep dive prompt — JSON output. Premium content for one of 5 topics.
 */
export type DeepDiveTopic = {
  key: 'love' | 'career' | 'health' | 'karma' | 'strengths';
  title: string;
  brief: string;
};

export const DEEP_DIVE_TOPICS: Record<DeepDiveTopic['key'], DeepDiveTopic> = {
  love: {
    key: 'love',
    title: 'Любовь и отношения',
    brief: 'Венера, 7-й дом, Луна — как ты любишь, к кому тянешься, что повторяется, чего на самом деле ищешь.',
  },
  career: {
    key: 'career',
    title: 'Карьера и деньги',
    brief: 'Солнце в 10-м, MC, Марс, Сатурн в 8-м — призвание, как зарабатываешь, что строишь, где затыки.',
  },
  health: {
    key: 'health',
    title: 'Здоровье и восстановление',
    brief: 'Луна в 6-м, Плутон, тело, ритм, восстановление, привычки, к чему чувствительно тело.',
  },
  karma: {
    key: 'karma',
    title: 'Жизненное направление',
    brief: 'Северный Узел, 8-й дом — куда тянет в жизни, какие темы повторяются, что уже умеешь и куда расти.',
  },
  strengths: {
    key: 'strengths',
    title: 'Сильные стороны и зоны роста',
    brief: 'Сильные стороны карты: за что тебя ценят, что отнимает силы, как это проявляется в жизни.',
  },
};

export function buildDeepDivePrompt(
  chart: SerializedChartForPrompt,
  topic: DeepDiveTopic
): string {
  return `${NATAL_READING_TASK_RULES}

${chartHeader(chart)}

ТЕМА: ${topic.title}.
ФОКУС: ${topic.brief}

ЗАДАЧА: написать длинный текст по этой теме на основе карты. Раскрыть одну грань жизни этого человека.

Пиши на «ты». Делай 3–5 абзацев, каждый — отдельная мысль. В конце — 3–5 коротких пунктов «что важно помнить» (highlights).

ФОРМАТ ВЫВОДА — строго JSON:
{
  "title": "${topic.title}",
  "body": "3–5 абзацев, разделённых двойным переносом строки \\n\\n. Длина общего тела: 1200–1700 знаков.",
  "highlights": ["короткий пункт 1", "короткий пункт 2", "короткий пункт 3", "короткий пункт 4"]
}`;
}

/* ----------------------- PARSERS ----------------------- */

export function parsePortraitTags(raw: string): {
  archetypes: { title: string; subtitle: string }[];
  portrait: string;
  insight: string;
  energyA: { title: string; body: string };
  energyB: { title: string; body: string };
  synthesis: string;
} {
  const grab = (tag: string): string => {
    const re = new RegExp(`\\[${tag}\\]\\s*([\\s\\S]*?)(?=\\n\\[[A-ZА-Я_0-9]+\\]|$)`, 'i');
    const m = raw.match(re);
    return m ? m[1].trim() : '';
  };

  const archetypes: { title: string; subtitle: string }[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const title = grab(`АРХЕТИП_${i}`);
    const subtitle = grab(`ПОДЗАГОЛОВОК_${i}`);
    if (title) archetypes.push({ title, subtitle });
  }

  return {
    archetypes,
    portrait: grab('ПОРТРЕТ'),
    insight: grab('ИНСАЙТ'),
    energyA: { title: grab('ЭНЕРГИЯ_А_TITLE'), body: grab('ЭНЕРГИЯ_А') },
    energyB: { title: grab('ЭНЕРГИЯ_Б_TITLE'), body: grab('ЭНЕРГИЯ_Б') },
    synthesis: grab('СИНТЕЗ'),
  };
}
