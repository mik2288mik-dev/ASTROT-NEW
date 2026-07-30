import { createHash } from 'crypto';
import type {
  InterpretationSection,
  NatalChartData,
  NatalInterpretationReport,
  UserProfile,
} from '../types';
import { llmJson } from './anthropic';
import {
  APP_VOICE_VERSION,
  getAppSystemVoice,
  hasAppVoiceViolation,
} from './appVoice';
import {
  buildBlindSpotPrompt,
  buildNatalSectionPrompt,
} from './contentPromptBuilders';
import { getWordRangeInstruction } from './contentMatrix';
import {
  HUMAN_FREE_SECTION_KEYS,
  HUMAN_PAID_SECTION_META,
  buildLockedPaidSections,
  type HumanPaidSectionKey,
} from './natalHumanShared';
import { buildPersonalForecastChartFingerprint } from './personalForecastContract';

type Locale = 'ru' | 'en';

type ChartSummary = {
  user: {
    name: string;
    birthDate: string;
    birthTime: string | null;
    birthPlace: string;
    gender: 'male' | 'female' | 'unspecified';
  };
  core: Record<string, unknown>;
  planets: Array<Record<string, unknown>>;
  housesAvailable: boolean;
  importantHouses: Array<Record<string, unknown>>;
  majorAspects: Array<Record<string, unknown>>;
  calculationVersion: string | null;
};

const PLANET_KEYS = [
  'sun',
  'moon',
  'rising',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
] as const;

const PAID_SECTION_FOCUS: Record<HumanPaidSectionKey, string> = {
  work_business: 'MC и 10-й дом, Солнце, Марс, Сатурн и 6-й дом.',
  love_relationships: 'Венера, Луна, Марс, 5-й и 7-й дом.',
  money_stability: '2-й и 8-й дом, Венера, Юпитер и Сатурн.',
  family_home: 'Луна, 4-й дом, IC и Сатурн.',
  communication_conflicts: 'Меркурий, Марс, 3-й дом и аспекты Марса.',
  energy_recovery: 'Луна, Марс, 6-й дом и Сатурн. Без медицинских обещаний.',
  friendship_social: 'Асцендент, 11-й дом, Меркурий и Венера.',
  goals_actions: 'Марс, Солнце, сильные планеты, 1-й и 3-й дом.',
  shadow_patterns: 'Плутон, Сатурн, Луна и напряжённые аспекты. Описывай защитные реакции, а не диагнозы.',
  potential_purpose: 'Солнце, MC, сильнейшая планета карты и Северный Узел. Описывай подходящие задачи и роли, а не предназначение.',
};

function reliableHouses(chart: NatalChartData): boolean {
  const quality = (chart as any).chartQuality;
  const birthTimeQuality = (chart as any).birthTimeQuality
    || quality?.birthTimeQuality
    || 'exact';
  return birthTimeQuality === 'exact'
    && quality?.housesReliable !== false
    && Array.isArray(chart.houses)
    && chart.houses.length >= 12;
}

function buildChartSummary(
  profile: UserProfile,
  chart: NatalChartData,
): ChartSummary {
  const housesAvailable = reliableHouses(chart);
  const position = (key: typeof PLANET_KEYS[number]) => {
    if (key === 'rising' && !housesAvailable) return null;
    const value = chart[key];
    if (!value) return null;
    return {
      key,
      sign: value.sign,
      degree: Number.isFinite(value.degree) ? Number(value.degree).toFixed(1) : null,
      house: housesAvailable ? value.house ?? null : null,
      retrograde: value.retrograde === true,
    };
  };
  const planets = PLANET_KEYS.map(position).filter(
    (item): item is NonNullable<ReturnType<typeof position>> => !!item,
  );
  return {
    user: {
      name: profile.name || (profile.language === 'en' ? 'friend' : 'друг'),
      birthDate: profile.birthDate || '',
      birthTime: profile.birthTime || null,
      birthPlace: profile.birthPlace || '',
      gender: profile.gender === 'male' || profile.gender === 'female'
        ? profile.gender
        : 'unspecified',
    },
    core: {
      sun: position('sun'),
      moon: position('moon'),
      rising: position('rising'),
    },
    planets,
    housesAvailable,
    importantHouses: housesAvailable
      ? (chart.houses || []).map((house) => ({
          house: house.house,
          sign: house.sign,
          degree: Number.isFinite(house.degree) ? Number(house.degree).toFixed(1) : null,
        }))
      : [],
    majorAspects: (chart.aspects || [])
      .slice()
      .sort((a, b) => Math.abs(a.orb || 99) - Math.abs(b.orb || 99))
      .slice(0, 10)
      .map((aspect) => ({
        from: aspect.from,
        to: aspect.to,
        type: aspect.type,
        orb: aspect.orb,
      })),
    calculationVersion: chart.calculationVersion || null,
  };
}

export function buildHumanInputHash(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  sectionKey?: string;
  dateKey?: string;
  promptVersion: string;
  locale?: Locale;
}): string {
  return createHash('sha256').update(JSON.stringify({
    userId: input.profile.id || null,
    language: input.profile.language === 'en' ? 'en' : 'ru',
    chartFingerprint: buildPersonalForecastChartFingerprint(input.chartData),
    chartCalculationVersion: input.chartData.calculationVersion || null,
    sectionKey: input.sectionKey || 'base',
    dateKey: input.dateKey || null,
    promptVersion: input.promptVersion,
    voiceVersion: APP_VOICE_VERSION,
  })).digest('hex');
}

function baseFallbackSections(
  profile: UserProfile,
  chart: NatalChartData,
): InterpretationSection[] {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const sun = String(chart.sun?.sign || '');
  const moon = String(chart.moon?.sign || '');
  const rising = reliableHouses(chart) ? String(chart.rising?.sign || '') : '';
  const basis = [sun, moon, rising].filter(Boolean).join(', ');
  const ru = [
    {
      key: 'base_portrait',
      title: 'Как ты действуешь',
      subtitle: 'Первое, что заметно',
      content: `Тебе проще принять решение, когда цель понятна и ясно, что зависит именно от тебя. Неопределённость утомляет сильнее, чем сложная, но конкретная задача. В разговоре ты быстрее доверяешь прямому ответу, чем намёкам. Этот вывод основан на положениях ${basis || 'главных точек карты'} и связях между ними.`,
    },
    {
      key: 'strengths',
      title: 'Сильные стороны',
      subtitle: 'Что у тебя получается лучше',
      content: 'Ты умеешь замечать важные детали и собирать их в понятное решение. Это особенно заметно в работе, сложном разговоре или ситуации, где другим не хватает последовательности. Когда роль и критерий результата ясны, ты держишь темп дольше, чем от тебя ожидают.',
    },
    {
      key: 'growth_zones',
      title: 'Где начинаются проблемы',
      subtitle: 'Что чаще всего мешает',
      content: 'Долго работать без понятной обратной связи тебе тяжело. Сомнения начинают забирать больше сил, чем сама задача, а ответы становятся резче. Отделяй факт от догадки и проверяй договорённость прямо, пока раздражение не накопилось.',
    },
    {
      key: 'main_advice',
      title: 'Что помогает',
      subtitle: 'Практический вывод',
      content: 'Перед важным решением определи, какой результат тебе нужен, и проверь, какие данные уже есть. Так меньше времени уходит на догадки. Если время рождения указано примерно, выводы о домах и Асценденте нужно читать с учётом этой погрешности.',
    },
  ];
  const en = [
    {
      key: 'base_portrait',
      title: 'How you act',
      subtitle: 'The first thing that stands out',
      content: `Decisions come more easily when the goal is clear and you know what depends on you. Uncertainty is more tiring than a difficult but specific task. In conversation, a direct answer earns your trust faster than hints. This conclusion is based on ${basis || 'the main chart placements'} and the connections between them.`,
    },
    {
      key: 'strengths',
      title: 'Strengths',
      subtitle: 'What you do well',
      content: 'You notice important details and turn them into a workable decision. This is most visible at work, in a difficult conversation, or when other people lose consistency. When the role and result are clear, you can keep going longer than people expect.',
    },
    {
      key: 'growth_zones',
      title: 'Where problems start',
      subtitle: 'What usually gets in the way',
      content: 'Working for too long without clear feedback is difficult for you. Doubt starts taking more energy than the task, and your answers become sharper. Separate facts from assumptions and check agreements directly before irritation builds up.',
    },
    {
      key: 'main_advice',
      title: 'What helps',
      subtitle: 'The practical conclusion',
      content: 'Before an important decision, define the result and check which facts are already available. This cuts down the time spent guessing. If the birth time is approximate, read house and Ascendant conclusions with that limitation in mind.',
    },
  ];
  return (language === 'en' ? en : ru).map((section) => ({
    ...section,
    key: section.key as InterpretationSection['key'],
    access: 'free',
    isLocked: false,
    teaser: '',
    bullets: [],
    ctaLabel: '',
  }));
}

export function buildHumanBaseFallback(
  profile: UserProfile,
  chart: NatalChartData,
): NatalInterpretationReport {
  const language = profile.language === 'en' ? 'en' : 'ru';
  return {
    userName: profile.name || (language === 'en' ? 'friend' : 'друг'),
    birthData: {
      birthDate: profile.birthDate || '',
      birthTime: profile.birthTime || null,
      birthPlace: profile.birthPlace || '',
    },
    calculatedAt: new Date().toISOString(),
    freeSections: baseFallbackSections(profile, chart),
    paidSections: buildLockedPaidSections(),
    premiumSections: [],
    shortCard: {
      title: language === 'en' ? 'In short' : 'Если коротко',
      keywords: language === 'en'
        ? ['precise', 'observant', 'consistent', 'direct']
        : ['точность', 'наблюдательность', 'последовательность', 'прямота'],
      text: language === 'en'
        ? 'You work best when the goal, responsibility, and result are clear.'
        : 'Ты сильнее всего там, где понятны цель, ответственность и результат.',
      advice: language === 'en'
        ? 'Check facts before spending time on assumptions.'
        : 'Проверяй факты до того, как тратить время на догадки.',
    },
  };
}

const PAID_FALLBACK_TEXT: Record<HumanPaidSectionKey, string> = {
  work_business: 'В работе тебе нужен понятный результат и достаточная самостоятельность. Лучше всего подходят задачи, где можно отвечать за целый участок, видеть критерий качества и влиять на способ выполнения. Размытая ответственность мешает: решение требуют от тебя, а полномочий не дают. Перед новой ролью уточни три вещи — за что отвечаешь, как измеряется результат и кто принимает финальное решение.',
  love_relationships: 'В отношениях для тебя важны последовательность и прямые договорённости. Симпатия не заменяет надёжности: доверие быстрее появляется к человеку, у которого слова совпадают с действиями. Проблемы начинаются, когда ожидания приходится угадывать или важный разговор постоянно откладывается. Смотри не на один красивый жест, а на то, как человек ведёт себя из раза в раз, и обсуждай проблему до того, как она превратится в претензию.',
  money_stability: 'С деньгами проще, когда цена решения понятна заранее. Тебе подходят конкретные правила: лимит, срок, назначение покупки и понятная польза. Слабое место — траты под давлением или ради быстрого облегчения. Перед крупной покупкой сравни варианты и отдельно ответь, какую задачу она решает. Это не обещание дохода, а способ убрать лишний риск.',
  family_home: 'Дома тебе нужны предсказуемость и право на личное пространство. Бытовые конфликты растут, когда обязанности и границы никто не проговорил. Правила должны быть понятными и одинаковыми для всех. Лучше заранее договориться о времени, территории и ответственности, чем ждать, что близкие догадаются сами.',
  communication_conflicts: 'Твоя сильная сторона в разговоре — точность, но под давлением она легко превращается в резкость. Особенно раздражает, когда собеседник уходит от вопроса или меняет договорённость задним числом. Рабочая схема простая: назови факт, его последствия и следующий шаг. Так прямота не превращается в борьбу за последнее слово.',
  energy_recovery: 'Нагрузка переносится легче, когда у задач есть границы и не приходится постоянно переключаться. Утомляет не только объём, но и мелкие незакрытые обязательства, которые всё время напоминают о себе. Медицинских выводов здесь нет. Практический вывод — ограничивать количество параллельных задач и заканчивать день с понятным списком того, что осталось.',
  friendship_social: 'В окружении тебе важнее качество контакта, чем количество знакомых. Ты быстро замечаешь, когда слова расходятся с поведением, поэтому поверхностное общение утомляет. Лучше всего складываются отношения с людьми, с которыми можно говорить прямо и соблюдать договорённости. Риск — слишком долго поддерживать контакт только по привычке. Смотри на взаимность по действиям, а не по количеству сообщений.',
  goals_actions: 'Ты способен долго работать над задачей, если понимаешь, зачем она нужна. Проблемы начинаются, когда одновременно выбрано слишком много равных направлений. Усилие распыляется, а результат трудно заметить. Выбери один проверяемый шаг, срок и понятное условие завершения. Так намерение превращается в результат.',
  shadow_patterns: 'Под давлением ты можешь сначала сдерживать реакцию, а потом резко закрыть разговор или усилить контроль. Иногда такая защита оправдана, но она мешает, когда реальной угрозы уже нет. Слабое место — считать молчание достаточным объяснением для другого человека. Границу и последствия лучше назвать заранее, пока разговор ещё можно вести нормально.',
  potential_purpose: 'Лучший результат получается в задачах, где внимание к деталям соединяется с ответственностью за итог. Тебе подходит роль, в которой качество решения действительно влияет на людей или процесс. Следующий шаг обычно связан с масштабом: сначала уверенно вести свой участок, затем связывать несколько участков и объяснять другим, почему выбран именно такой порядок.',
};

export function buildHumanPaidFallback(
  _profile: UserProfile,
  _chart: NatalChartData,
  key: HumanPaidSectionKey,
): InterpretationSection {
  const meta = HUMAN_PAID_SECTION_META[key];
  return {
    key,
    title: meta.title,
    subtitle: meta.subtitle,
    access: 'paid',
    isLocked: false,
    teaser: meta.teaser,
    content: PAID_FALLBACK_TEXT[key],
    bullets: [],
    ctaLabel: '',
  };
}

function cleanGeneratedText(value: unknown, fallback: string): string {
  const text = String(value || '').trim();
  if (!text || hasAppVoiceViolation(text)) return fallback;
  return text;
}

function normalizeSection(
  raw: Partial<InterpretationSection> | null | undefined,
  fallback: InterpretationSection,
): InterpretationSection {
  return {
    ...fallback,
    title: cleanGeneratedText(raw?.title, fallback.title),
    subtitle: cleanGeneratedText(raw?.subtitle, fallback.subtitle || ''),
    content: cleanGeneratedText(raw?.content, fallback.content),
    bullets: Array.isArray(raw?.bullets)
      ? raw.bullets
          .map(String)
          .map((item) => item.trim())
          .filter((item) => Boolean(item) && !hasAppVoiceViolation(item))
          .slice(0, 4)
      : fallback.bullets || [],
  };
}

function normalizeBaseReport(
  raw: Partial<NatalInterpretationReport>,
  fallback: NatalInterpretationReport,
): NatalInterpretationReport {
  const rawSections = new Map(
    (raw.freeSections || []).map((section) => [section.key, section]),
  );
  const fallbackSections = new Map(
    fallback.freeSections.map((section) => [section.key, section]),
  );
  return {
    ...fallback,
    userName: String(raw.userName || fallback.userName).trim(),
    freeSections: HUMAN_FREE_SECTION_KEYS.map((key) => normalizeSection(
      rawSections.get(key),
      fallbackSections.get(key)!,
    )),
    shortCard: {
      title: cleanGeneratedText(raw.shortCard?.title, fallback.shortCard.title),
      text: cleanGeneratedText(raw.shortCard?.text, fallback.shortCard.text),
      advice: cleanGeneratedText(raw.shortCard?.advice, fallback.shortCard.advice),
      keywords: Array.isArray(raw.shortCard?.keywords)
        ? raw.shortCard.keywords
            .map(String)
            .map((item) => item.trim())
            .filter((item) => Boolean(item) && !hasAppVoiceViolation(item))
            .slice(0, 5)
        : fallback.shortCard.keywords,
    },
    paidSections: buildLockedPaidSections(),
    premiumSections: [],
  };
}

function basePrompt(summary: ChartSummary, language: Locale): string {
  if (language === 'en') {
    return `Create a concise natal-chart portrait from the calculated context below.
Return valid NatalInterpretationReport JSON with exactly four freeSections in this order:
base_portrait, strengths, growth_zones, main_advice.
Each section needs title, subtitle, content, bullets, access "free", isLocked false.
Also return shortCard with title, text, 4-5 keywords, advice. paidSections and premiumSections are empty.
Start every section with a concrete conclusion. Then show one ordinary situation where it is noticeable. End with a short reason based on the supplied chart when useful. Use 2-3 short paragraphs, not one wall of text.
Use ordinary language. Be direct, but never rude or fatalistic. Do not use coaching, therapy, mystical wording, slogans, or abstract introductions. Do not show labels such as "Basis:", orb values, or a list of technical chart terms in the visible copy.
Use only the supplied calculations. Do not invent biography or events.

${JSON.stringify(summary, null, 2)}`;
  }
  return `Создай короткий портрет по рассчитанной натальной карте.
Верни валидный JSON NatalInterpretationReport с ровно четырьмя freeSections в порядке:
base_portrait, strengths, growth_zones, main_advice.
У каждой секции нужны title, subtitle, content, bullets, access "free", isLocked false.
Также верни shortCard: title, text, 4–5 keywords, advice. paidSections и premiumSections пустые.
Каждая секция начинается с конкретного вывода. Затем покажи одну обычную ситуацию, где он заметен. В конце коротко объясни причину по переданному расчёту, если это действительно нужно. Делай 2–3 коротких абзаца, а не стену текста.
Пиши обычными словами. Прямо, но без грубости и фатализма. Не используй коучинговый, психологический, мистический или рекламный язык. Не начинай с «мы нашли», «карта показывает», «тема проявляется» и других пустых вводных. Не выводи в пользовательский текст «Основание:», значения орбисов и длинный список терминов.
Используй только переданные расчёты. Не выдумывай биографию или события.

${JSON.stringify(summary, null, 2)}`;
}

export async function generateHumanBaseReport(
  profile: UserProfile,
  chart: NatalChartData,
): Promise<NatalInterpretationReport> {
  const fallback = buildHumanBaseFallback(profile, chart);
  const language: Locale = profile.language === 'en' ? 'en' : 'ru';
  const raw = await llmJson<Partial<NatalInterpretationReport>>({
    system: getAppSystemVoice(language),
    user: basePrompt(buildChartSummary(profile, chart), language),
    model: {
      accessTier: 'free',
      contentSurface: 'natal',
      contentVariant: 'brief',
    },
    maxTokens: 1600,
    temperature: 0.55,
  });
  return normalizeBaseReport(raw, fallback);
}

export async function generateHumanPaidSection(
  profile: UserProfile,
  chart: NatalChartData,
  key: HumanPaidSectionKey,
): Promise<InterpretationSection> {
  const fallback = buildHumanPaidFallback(profile, chart, key);
  const context = buildChartSummary(profile, chart);
  const focus = `${PAID_SECTION_FOCUS[key]} ${getWordRangeInstruction('natal_section')}`;
  const prompt = key === 'shadow_patterns'
    ? buildBlindSpotPrompt({
        language: profile.language === 'en' ? 'en' : 'ru',
        context,
        focus,
      })
    : buildNatalSectionPrompt({
        language: profile.language === 'en' ? 'en' : 'ru',
        title: HUMAN_PAID_SECTION_META[key].title,
        context,
        focus,
      });
  const raw = await llmJson<{
    title?: string;
    headline?: string;
    text?: string;
    soft_warning?: string;
    example?: string;
    practical_hint?: string;
    soft_step?: string;
  }>({
    system: prompt.system,
    user: prompt.user,
    model: {
      accessTier: 'premium',
      contentSurface: 'natal',
      contentVariant: 'living',
    },
    maxTokens: 900,
    temperature: 0.55,
  });
  return normalizeSection({
    ...fallback,
    title: raw.title || raw.headline || fallback.title,
    content: raw.text || fallback.content,
    bullets: [
      raw.soft_warning,
      raw.example,
      raw.practical_hint,
      raw.soft_step,
    ].filter((item): item is string => !!item),
  }, fallback);
}
