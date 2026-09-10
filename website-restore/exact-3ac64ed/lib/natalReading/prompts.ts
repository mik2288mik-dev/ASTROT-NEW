/** Prompts for the long-scroll natal interpretation screen. */

import type { SerializedChartForPrompt } from './chartSerializer';
import type { CanonicalNatalReport } from '../natal/canonicalReport';

export type NatalReadingPromptSource = SerializedChartForPrompt | CanonicalNatalReport;

const NATAL_READING_TASK_RULES = `ТЕХНИЧЕСКИЕ ПРАВИЛА:
- Используй только переданные данные карты.
- Обращайся к читателю на «ты».
- Начинай с конкретного вывода. Не начинай с описания процесса анализа, определения термина или фразы «карта показывает».
- Описывай поведение, решения, разговоры и реакции обычными словами.
- Если используешь планету, знак, дом или аспект, сразу объясни, что именно это меняет в описываемой ситуации.
- Не придумывай травмы, детство, родителей, диагнозы, профессию, доход, события или факты биографии.
- Не используй психологическую, коучинговую, мистическую или мотивационную воду.
- Не используй слова и идеи «энергия», «суперсила», «предназначение», «внутренний путь», «повторяющийся сценарий» как пустые объяснения.
- Соблюдай заданный формат вывода строго.
- Не добавляй комментариев до и после, не используй Markdown-заголовки внутри JSON-полей.`;

function chartHeader(chart: NatalReadingPromptSource): string {
  return `ДАННЫЕ КАРТЫ:
${JSON.stringify(chart, null, 2)}`;
}

function promptContext(chart: NatalReadingPromptSource): string {
  if ('schemaVersion' in chart && chart.schemaVersion === 'canonical-natal-report-v1') {
    const facts = {
      CoreIdentity: chart.CoreIdentity,
      DominantPatterns: chart.DominantPatterns,
      MajorAspects: chart.MajorAspects,
      ...(chart.HousePlacements ? { HousePlacements: chart.HousePlacements } : {}),
    };
    const timeRule = chart.HousePlacements
      ? 'Use houses and angles only when they are present in this Base Report. Low-reliability placements are not exact.'
      : 'Birth time is unknown. Do not mention houses, Ascendant, MC, house rulers, cusps, or time-dependent angular placements.';
    return `CANONICAL BASE REPORT — use only these facts:\n${JSON.stringify(facts, null, 2)}\n\n${timeRule}`;
  }
  return chartHeader(chart);
}

/**
 * Portrait prompt — tagged output (parsed by parsePortraitTags).
 * Generates: 5 short labels + subtitles, portrait, overlooked trait,
 * two competing traits + synthesis.
 */
export function buildPortraitPrompt(chart: NatalReadingPromptSource): string {
  return `${NATAL_READING_TASK_RULES}

${promptContext(chart)}

ЗАДАЧА: создать короткий и точный портрет человека по этой натальной карте.

Выдели 5 разных черт. Каждая должна описывать конкретный способ действовать, общаться, принимать решения или реагировать. Не повторяй корневые слова. Каждая черта должна опираться на отдельный факт карты.

Плохо: «Проводник смыслов», «Хранитель глубины», «Духовный строитель».
Хорошо: «Действует первым», «Долго проверяет людей», «Говорит прямо», «Собирает факты», «Не любит зависеть».

Затем назови две черты, которые могут тянуть решения в разные стороны. Объясни, где это видно и как человек действует, когда учитывает обе, а не бросается из одной крайности в другую.

ФОРМАТ ВЫВОДА (строго так, без лишнего текста):

[АРХЕТИП_1] 2–4 обычных слова
[АРХЕТИП_2] 2–4 обычных слова
[АРХЕТИП_3] 2–4 обычных слова
[АРХЕТИП_4] 2–4 обычных слова
[АРХЕТИП_5] 2–4 обычных слова
[ПОДЗАГОЛОВОК_1] конкретное пояснение под первую черту, 7–10 слов
[ПОДЗАГОЛОВОК_2] конкретное пояснение под вторую
[ПОДЗАГОЛОВОК_3] конкретное пояснение под третью
[ПОДЗАГОЛОВОК_4] конкретное пояснение под четвёртую
[ПОДЗАГОЛОВОК_5] конкретное пояснение под пятую
[ПОРТРЕТ] 5–6 предложений о характере и поведении. Не список. Начни с конкретного наблюдения, а не со слов «Ты —» и не с «Карта показывает».
[ИНСАЙТ] 2 предложения о привычке или реакции, которую человек может не замечать.
[ЭНЕРГИЯ_А_TITLE] название первой черты, 2–4 слова, без слов «энергия», «сила», «путь»
[ЭНЕРГИЯ_А] 2 предложения о том, как эта черта влияет на решения и поведение
[ЭНЕРГИЯ_Б_TITLE] название второй черты, которая спорит с первой, 2–4 слова
[ЭНЕРГИЯ_Б] 2 предложения
[СИНТЕЗ] 2–3 предложения о том, как человек действует сильнее и точнее, когда учитывает обе черты. Без мотивационного финала.`;
}

/**
 * Aspects prompt — JSON output.
 * 5 key calculated factors of the chart with badges + a closing summary.
 */
export function buildAspectsPrompt(chart: NatalReadingPromptSource): string {
  return `${NATAL_READING_TASK_RULES}

${promptContext(chart)}

ЗАДАЧА: выбери 5 самых важных рассчитанных факторов этой карты. Не перечисляй всё подряд. Бери только сильные положения, скопления, точные аспекты, угловые точки или явно выделенные дома, которые действительно меняют общий вывод.

Для каждого фактора верни:
- pl: короткая подпись «Планета · Дом» или «Планеты · Аспект».
- badge: один из {"Трин", "Квадратура", "Соединение", "Сильная позиция", "Скопление", "Оппозиция", "Секстиль"}.
- color: hex цвета бейджа из соответствия:
    Трин → "#6aab96"
    Секстиль → "#7da5c8"
    Квадратура → "#e0985a"
    Оппозиция → "#c97c7c"
    Соединение → "#9a9a9a"
    Сильная позиция → "#c9a55a"
    Скопление → "#9b87c4"
- text: 2–3 предложения. Сначала конкретный вывод, затем обычная ситуация, где он заметен. Не выдумывай, что событие уже происходило.

Поле resume — 3–4 предложения с общим итогом. Не повторяй тексты факторов и не заканчивай советом в стиле коучинга.

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
  chart: NatalReadingPromptSource,
  weekDates: { from: string; to: string }
): string {
  return `${NATAL_READING_TASK_RULES}

${promptContext(chart)}

КОНТЕКСТ ВРЕМЕНИ: текущая неделя с ${weekDates.from} по ${weekDates.to}.

ЗАДАЧА: написать короткий личный прогноз на эту неделю по переданному расчёту. Не выдавай общую характеристику человека за прогноз.

ФОРМАТ ВЫВОДА — строго JSON:
{
  "title": "прямой заголовок недели, 2–5 слов",
  "body": "3–4 предложения. Сразу скажи, что на этой неделе даст результат, где вероятна проблема и какое одно действие имеет смысл. Не пиши общими словами и не обещай событие."
}`;
}

/** Today prompt — JSON output. Premium content. */
export function buildTodayPrompt(
  chart: NatalReadingPromptSource,
  dateLabel: string
): string {
  return `${NATAL_READING_TASK_RULES}

${promptContext(chart)}

КОНТЕКСТ ВРЕМЕНИ: сегодня ${dateLabel}.

ЗАДАЧА: написать короткий личный прогноз на сегодня по переданному расчёту. Не выдавай характеристику натальной карты за событие дня.

ФОРМАТ ВЫВОДА — строго JSON:
{
  "title": "прямой заголовок дня, 2–5 слов",
  "main": "2–3 предложения. Сразу назови главный вывод дня и одну ситуацию, где он будет заметен.",
  "love": "2–3 предложения. Что сегодня сработает или помешает в отношениях и обычном общении. Без чтения мыслей другого человека.",
  "work": "2–3 предложения. Что сегодня даст результат в работе, делах, деньгах или решении. Конкретно.",
  "energy": "2–3 предложения о нагрузке и самочувствии без медицинских выводов. Что лучше поставить раньше, что не стоит совмещать и где вероятна усталость."
}`;
}

/** Premium content for one of 5 topics. */
export type DeepDiveTopic = {
  key: 'love' | 'career' | 'health' | 'karma' | 'strengths';
  title: string;
  brief: string;
};

export const DEEP_DIVE_TOPICS: Record<DeepDiveTopic['key'], DeepDiveTopic> = {
  love: {
    key: 'love',
    title: 'Любовь и отношения',
    brief: 'Венера, 7-й дом, Луна и Марс: как человек сближается, чего ждёт, где закрывается и из-за чего начинаются споры.',
  },
  career: {
    key: 'career',
    title: 'Карьера и деньги',
    brief: 'Солнце, MC, Марс, Сатурн, 2-й, 6-й и 10-й дома: как человек работает, принимает финансовые решения, что даётся легче и что тормозит.',
  },
  health: {
    key: 'health',
    title: 'Нагрузка и восстановление',
    brief: 'Луна, Марс, 6-й дом и Сатурн: какой режим переносится легче, что быстрее утомляет и как распределять нагрузку. Без диагнозов и медицинских обещаний.',
  },
  karma: {
    key: 'karma',
    title: 'Решения и направление',
    brief: 'Солнце, MC, Северный Узел и сильные дома: какие задачи человек берёт охотнее, где долго сомневается и какой тип решений даёт лучший результат.',
  },
  strengths: {
    key: 'strengths',
    title: 'Сильные стороны и слабые места',
    brief: 'Сильные и напряжённые факторы карты: что человек делает хорошо, где переоценивает себя и в каких ситуациях теряет точность.',
  },
};

export function buildDeepDivePrompt(
  chart: NatalReadingPromptSource,
  topic: DeepDiveTopic
): string {
  return `${NATAL_READING_TASK_RULES}

${promptContext(chart)}

ТЕМА: ${topic.title}.
ФОКУС: ${topic.brief}

ЗАДАЧА: написать подробный раздел по этой теме на основе переданной карты.

Пиши на «ты». Сделай 3–5 абзацев, каждый с одной конкретной мыслью. Первый абзац сразу даёт главный вывод. В следующих покажи обычные ситуации, решения и реакции. В конце — 3–5 коротких пунктов с конкретными выводами или действиями. Не используй заголовок «что важно помнить» внутри body.

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
