import { createHash } from 'crypto';
import type {
  InterpretationSection,
  NatalChartData,
  NatalInterpretationReport,
  UserProfile,
} from '../types';
import { llmJson } from './anthropic';
import { APP_VOICE_VERSION, getAppSystemVoice } from './appVoice';
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
  shadow_patterns: 'Плутон, Сатурн, Луна и напряжённые аспекты.',
  potential_purpose: 'Солнце, MC, сильнейшая планета карты и Северный Узел.',
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
      title: 'Кто ты по сути',
      subtitle: 'Главная внутренняя связка',
      content: `Карта показывает сочетание самостоятельности и чувствительности к обстановке. Ты быстрее принимаешь решение, когда понимаешь конкретную цель и видишь, что зависит именно от тебя. В контакте важны ясные правила: неопределённость утомляет сильнее, чем сложная, но понятная задача. Основание вывода — положения ${basis || 'главных точек карты'} и связи между ними.`,
    },
    {
      key: 'strengths',
      title: 'Сильные стороны',
      subtitle: 'На что можно опереться',
      content: 'Твоя сильная сторона — замечать существенное и собирать разрозненные детали в решение. Это особенно полезно в работе, сложном разговоре или ситуации, где другим не хватает последовательности. Когда роль и критерий результата ясны, ты способен держать темп дольше, чем кажется со стороны.',
    },
    {
      key: 'growth_zones',
      title: 'Где бывает трудно',
      subtitle: 'Что требует внимания',
      content: 'Сложность начинается, когда приходится долго действовать без понятной обратной связи. Тогда сомнения могут отнимать больше сил, чем сама задача, а реакция становится резче. Полезно отделять факт от предположения и проверять договорённость напрямую, пока напряжение не накопилось.',
    },
    {
      key: 'main_advice',
      title: 'Как с этим жить',
      subtitle: 'Практический ориентир',
      content: 'Перед важным решением назови критерий результата и проверь, какие данные уже есть. Это помогает использовать точность карты как сильную сторону и не тратить силы на догадки. Если время рождения указано неточно, выводы о домах и Асценденте нужно считать ограниченными.',
    },
  ];
  const en = [
    {
      key: 'base_portrait',
      title: 'Who you are at the core',
      subtitle: 'Your central pattern',
      content: `The chart combines independence with close attention to context. Decisions come more easily when the goal is concrete and your responsibility is clear. Uncertainty is often more tiring than a difficult but well-defined task. This conclusion is based on ${basis || 'the main chart placements'} and their connections.`,
    },
    {
      key: 'strengths',
      title: 'Strengths',
      subtitle: 'What supports you',
      content: 'A clear strength is the ability to notice what matters and turn separate details into a decision. This is useful in work, difficult conversations, and situations where others lose consistency. With a clear role and result, you can sustain effort longer than people expect.',
    },
    {
      key: 'growth_zones',
      title: 'Where it gets difficult',
      subtitle: 'What needs attention',
      content: 'Difficulty grows when you have to act for too long without clear feedback. Doubt can then consume more energy than the task itself, and reactions become sharper. Separating facts from assumptions and checking agreements early prevents unnecessary pressure.',
    },
    {
      key: 'main_advice',
      title: 'How to use this',
      subtitle: 'A practical reference',
      content: 'Before an important decision, define the result and list the information you actually have. This uses the chart’s precision as a strength and reduces guesswork. If the birth time is uncertain, house and Ascendant conclusions must remain limited.',
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
        ? 'Check facts before spending energy on assumptions.'
        : 'Проверяй факты до того, как тратить силы на предположения.',
    },
  };
}

const PAID_FALLBACK_TEXT: Record<HumanPaidSectionKey, string> = {
  work_business: 'Карта показывает, что в работе тебе нужен понятный результат и достаточная самостоятельность. Сильнее всего ты проявляешься там, где можно отвечать за целый участок, видеть критерий качества и влиять на способ выполнения. Тормозит размытая ответственность: когда решение требуется от тебя, а полномочий нет. Перед новой ролью полезно уточнить три вещи — за что отвечаешь, как измеряется результат и кто принимает финальное решение.',
  love_relationships: 'В отношениях для тебя важны последовательность и прямые договорённости. Симпатия сама по себе не заменяет надёжности: ты быстрее доверяешь человеку, чьи слова совпадают с действиями. Напряжение появляется, когда ожидания приходится угадывать или важный разговор откладывается. Карта советует оценивать не отдельный жест, а повторяющееся поведение и говорить о проблеме до того, как она превратится в накопленную претензию.',
  money_stability: 'Финансовая устойчивость растёт, когда цена решения понятна заранее. Тебе легче обращаться с деньгами при конкретных правилах: лимит, срок, назначение покупки и критерий пользы. Слабое место — решение под давлением или из желания быстро снять напряжение. Перед крупной тратой полезно сравнить варианты и отдельно ответить, какую задачу покупка решает. Это не обещание дохода, а способ уменьшить необязательный риск.',
  family_home: 'Дом для тебя связан с ощущением предсказуемости и правом на личное пространство. Бытовое напряжение растёт не из-за мелочей самих по себе, а когда обязанности и границы остаются неоговорёнными. Карта показывает потребность в ясных правилах, которые одинаково действуют для всех. Лучше заранее договориться о времени, территории и ответственности, чем ждать, что близкие поймут это без слов.',
  communication_conflicts: 'В разговоре твоя сила — точность, но под давлением она может превращаться в резкость. Особенно сложно, когда собеседник уходит от предмета разговора или меняет договорённость задним числом. Рабочий формат — назвать факт, его последствия и конкретный следующий шаг. Это сохраняет прямоту, но не превращает спор в борьбу за последнее слово.',
  energy_recovery: 'Нагрузка переносится лучше, когда задачи имеют границы и не требуют постоянного переключения. Утомляет не только объём, но и незакрытые мелкие обязательства, которые всё время напоминают о себе. Карта не даёт медицинских выводов, но показывает чувствительность к хаотичному ритму. Реалистичный способ восстановления — заранее ограничивать количество параллельных задач и завершать день с понятным списком незакрытого.',
  friendship_social: 'В окружении тебе важнее качество контакта, чем количество знакомых. Ты хорошо замечаешь несоответствие между словами и поведением, поэтому поверхностная общительность быстро утомляет. Сильная сторона — выбирать людей, с которыми можно быть прямым и сохранять договорённости. Риск — слишком долго поддерживать контакт только из привычки. Оценивай взаимность по действиям, а не по частоте сообщений.',
  goals_actions: 'Карта показывает способность долго работать над целью, если понятен смысл. Проблема возникает не из-за нехватки способностей, а когда одновременно выбрано слишком много равных направлений. Тогда усилие распределяется, а результат трудно увидеть. Полезно определить один проверяемый шаг, срок и условие завершения. Это переводит сильные качества из намерения в наблюдаемый результат.',
  shadow_patterns: 'Под давлением ты можешь сначала удерживать реакцию, а затем резко закрывать контакт или усиливать контроль. Такая защита иногда оправдана, но становится проблемой, когда реальная угроза уже исчезла, а поведение осталось прежним. Слепая зона — считать молчание достаточным объяснением для другого человека. Точнее назвать границу и последствия заранее, пока разговор ещё можно вести спокойно.',
  potential_purpose: 'Сильнее всего ты раскрываешься в задачах, где внимание к деталям соединяется с ответственностью за итог. Тебе подходит не абстрактная заметность, а роль, в которой качество решения действительно влияет на людей или процесс. Рост идёт через усложнение масштаба: сначала уверенно вести свой участок, затем связывать несколько участков и объяснять другим, почему выбран именно такой порядок.',
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

function normalizeSection(
  raw: Partial<InterpretationSection> | null | undefined,
  fallback: InterpretationSection,
): InterpretationSection {
  return {
    ...fallback,
    title: String(raw?.title || fallback.title).trim(),
    subtitle: String(raw?.subtitle || fallback.subtitle || '').trim(),
    content: String(raw?.content || fallback.content).trim(),
    bullets: Array.isArray(raw?.bullets)
      ? raw!.bullets!.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 4)
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
      title: String(raw.shortCard?.title || fallback.shortCard.title).trim(),
      text: String(raw.shortCard?.text || fallback.shortCard.text).trim(),
      advice: String(raw.shortCard?.advice || fallback.shortCard.advice).trim(),
      keywords: Array.isArray(raw.shortCard?.keywords)
        ? raw.shortCard!.keywords.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 5)
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
Make every section feel worth opening: start content with one sharp, specific conclusion; show how it appears in ordinary decisions, work or relationships; finish with a brief reason grounded in the supplied chart. Use 2-3 short paragraphs, not one wall of text.
Be lively and direct, but never rude, fatalistic or theatrical. No coaching filler. Do not show technical labels such as "Basis:", aspect names, houses, or orb values in the visible copy.
Use only the supplied calculations. Do not invent biography or events.

${JSON.stringify(summary, null, 2)}`;
  }
  return `Создай короткий портрет по рассчитанной натальной карте.
Верни валидный JSON NatalInterpretationReport с ровно четырьмя freeSections в порядке:
base_portrait, strengths, growth_zones, main_advice.
У каждой секции нужны title, subtitle, content, bullets, access "free", isLocked false.
Также верни shortCard: title, text, 4–5 keywords, advice. paidSections и premiumSections пустые.
Каждая секция должна сразу давать сильный конкретный вывод, затем показывать, как он проявляется в обычных решениях, работе или отношениях, и коротко объяснять причину по переданной карте. Делай 2–3 коротких абзаца, а не стену текста.
Пиши живо, прямо и чуть дерзко за счёт точности, но без грубости, фатализма и театральности. Без коучинговой воды. Не выводи в пользовательский текст «Основание:», названия аспектов, домов и значения орбисов.
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
