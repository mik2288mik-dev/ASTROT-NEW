import { createHash } from 'crypto';
import type {
  InterpretationSection,
  InterpretationSectionKey,
  NatalAspectData,
  NatalChartData,
  NatalInterpretationReport,
  PlanetPosition,
  UserProfile,
} from '../types';
import { llmJson } from './anthropic';
import { getCurrentTransits } from './transits-calculator';
import {
  buildLockedDailySections,
  buildLockedPaidSections,
  HUMAN_DAILY_SECTION_META,
  HUMAN_FREE_SECTION_KEYS,
  HUMAN_PAID_SECTION_META,
  type HumanDailySectionKey,
  type HumanPaidSectionKey,
} from './natalHumanShared';

const SIGN_RU: Record<string, string> = {
  Aries: 'Овен',
  Taurus: 'Телец',
  Gemini: 'Близнецы',
  Cancer: 'Рак',
  Leo: 'Лев',
  Virgo: 'Дева',
  Libra: 'Весы',
  Scorpio: 'Скорпион',
  Sagittarius: 'Стрелец',
  Capricorn: 'Козерог',
  Aquarius: 'Водолей',
  Pisces: 'Рыбы',
  Овен: 'Овен',
  Телец: 'Телец',
  Близнецы: 'Близнецы',
  Рак: 'Рак',
  Лев: 'Лев',
  Дева: 'Дева',
  Весы: 'Весы',
  Скорпион: 'Скорпион',
  Стрелец: 'Стрелец',
  Козерог: 'Козерог',
  Водолей: 'Водолей',
  Рыбы: 'Рыбы',
};

const PLANET_RU: Record<string, string> = {
  sun: 'Солнце',
  moon: 'Луна',
  rising: 'Асцендент',
  ascendant: 'Асцендент',
  asc: 'Асцендент',
  mercury: 'Меркурий',
  venus: 'Венера',
  mars: 'Марс',
  jupiter: 'Юпитер',
  saturn: 'Сатурн',
  uranus: 'Уран',
  neptune: 'Нептун',
  pluto: 'Плутон',
  chiron: 'Хирон',
};

const ASPECT_RU: Record<NatalAspectData['type'], string> = {
  conjunction: 'соединение',
  sextile: 'секстиль',
  square: 'квадрат',
  trine: 'трин',
  opposition: 'оппозиция',
};

const ELEMENT_RU: Record<string, string> = {
  Овен: 'Огонь',
  Лев: 'Огонь',
  Стрелец: 'Огонь',
  Телец: 'Земля',
  Дева: 'Земля',
  Козерог: 'Земля',
  Близнецы: 'Воздух',
  Весы: 'Воздух',
  Водолей: 'Воздух',
  Рак: 'Вода',
  Скорпион: 'Вода',
  Рыбы: 'Вода',
};

type ChartSummary = {
  user: {
    name: string;
    birthDate: string;
    birthTime: string | null;
    birthPlace: string;
  };
  core: {
    sun: SerializedPosition;
    moon: SerializedPosition;
    ascendant: SerializedPosition;
    mc: SerializedPosition | null;
  };
  planets: SerializedPosition[];
  housesAvailable: boolean;
  importantHouses: Array<{ house: number; sign: string; degree: number | null }>;
  majorAspects: string[];
  calculationVersion: string | null;
};

type SerializedPosition = {
  key: string;
  name: string;
  sign: string;
  house: number | null;
  degree: number | null;
  retrograde?: boolean;
};

function ruSign(value?: string | null): string {
  const text = String(value || '').trim();
  return SIGN_RU[text] || text || 'неизвестный знак';
}

function finiteDegree(value?: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function birthTimeQualityFor(chart: NatalChartData) {
  return (chart as any).birthTimeQuality || (chart as any).chartQuality?.birthTimeQuality || 'exact';
}

function hasReliableAscendant(chart: NatalChartData) {
  const quality = (chart as any).chartQuality;
  return birthTimeQualityFor(chart) === 'exact' && quality?.ascendantReliable !== false;
}

function hasReliableHouses(chart: NatalChartData) {
  const quality = (chart as any).chartQuality;
  return birthTimeQualityFor(chart) === 'exact' &&
    quality?.housesReliable !== false &&
    Array.isArray(chart.houses) &&
    chart.houses.length >= 12;
}

function getPosition(chart: NatalChartData, key: string): PlanetPosition | null {
  if ((key === 'rising' || key === 'ascendant' || key === 'asc') && !hasReliableAscendant(chart)) return null;
  if (key === 'rising' || key === 'ascendant' || key === 'asc') return chart.rising || null;
  return (chart as any)[key] || null;
}

function serializePosition(chart: NatalChartData, key: string): SerializedPosition {
  const p = getPosition(chart, key);
  const canUseHouse = hasReliableHouses(chart);
  return {
    key,
    name: PLANET_RU[key] || key,
    sign: ruSign(p?.sign),
    house: canUseHouse && p?.house != null ? Number(p.house) : null,
    degree: finiteDegree(p?.degree),
    retrograde: !!p?.retrograde,
  };
}

function serializeMc(chart: NatalChartData): SerializedPosition | null {
  if (!hasReliableHouses(chart)) return null;
  const tenth = (chart.houses || []).find((house) => Number(house.house) === 10);
  if (!tenth) return null;
  return {
    key: 'mc',
    name: 'MC',
    sign: ruSign(tenth.sign),
    house: 10,
    degree: finiteDegree(tenth.degree),
  };
}

function formatAspect(aspect: NatalAspectData): string {
  const from = PLANET_RU[String(aspect.from || '').toLowerCase()] || String(aspect.from || '');
  const to = PLANET_RU[String(aspect.to || '').toLowerCase()] || String(aspect.to || '');
  const type = ASPECT_RU[aspect.type] || aspect.type;
  const orb = typeof aspect.orb === 'number' ? `, орб ${Math.round(aspect.orb * 10) / 10}` : '';
  return `${from} и ${to}: ${type}${orb}`;
}

function buildChartSummary(profile: UserProfile, chart: NatalChartData): ChartSummary {
  const planetKeys = [
    'sun',
    'moon',
    ...(hasReliableAscendant(chart) ? ['rising'] : []),
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
    'chiron',
  ];
  const planets = planetKeys
    .map((key) => serializePosition(chart, key))
    .filter((p) => p.sign && p.sign !== 'неизвестный знак');
  const aspects = Array.isArray(chart.aspects)
    ? [...chart.aspects].sort((a, b) => Math.abs(a.orb || 99) - Math.abs(b.orb || 99)).slice(0, 8)
    : [];

  return {
    user: {
      name: profile.name || 'друг',
      birthDate: profile.birthDate || '',
      birthTime: profile.birthTime || null,
      birthPlace: profile.birthPlace || '',
    },
    core: {
      sun: serializePosition(chart, 'sun'),
      moon: serializePosition(chart, 'moon'),
      ascendant: serializePosition(chart, 'rising'),
      mc: serializeMc(chart),
    },
    planets,
    housesAvailable: hasReliableHouses(chart),
    importantHouses: hasReliableHouses(chart) ? (chart.houses || []).slice(0, 12).map((house) => ({
      house: Number(house.house),
      sign: ruSign(house.sign),
      degree: finiteDegree(house.degree),
    })) : [],
    majorAspects: aspects.map(formatAspect),
    calculationVersion: chart.calculationVersion || null,
  };
}

export function buildHumanInputHash(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  sectionKey?: string;
  dateKey?: string;
  promptVersion: string;
}): string {
  const summary = buildChartSummary(input.profile, input.chartData);
  return createHash('sha256')
    .update(JSON.stringify({
      birthData: summary.user,
      core: summary.core,
      planets: summary.planets,
      housesAvailable: summary.housesAvailable,
      importantHouses: summary.importantHouses,
      aspects: summary.majorAspects,
      calculationVersion: summary.calculationVersion,
      sectionKey: input.sectionKey || 'base',
      dateKey: input.dateKey || null,
      promptVersion: input.promptVersion,
    }))
    .digest('hex');
}

const HUMAN_SYSTEM_PROMPT = `Ты пишешь для Lumia понятный разбор натальной карты на русском языке.

Главное правило: переводи расчёты по дате, времени и месту рождения в обычный человеческий язык. Не делай мистический текст, не пиши как Instagram-психолог и не перечисляй планеты ради перечисления.

Каждый важный вывод должен отвечать на четыре вопроса:
1. Как это видно в обычной жизни.
2. В каких ситуациях это проявляется.
3. Что человеку с этим делать.
4. Почему это может быть полезно.

Пиши короткими абзацами. Давай примеры: работа, отношения, деньги, дом, разговоры, решения, конфликт, усталость от хаоса. Не обещай события, доход, любовь, здоровье или единственно правильные решения.

Не используй мистические клише, фатальные формулировки, диагнозы и поэтичные абстракции. Техническую астрологию можно учитывать в логике, но первый слой текста должен быть понятен без знания астрологии. Если нужен технический слой, называй его "Почему так по карте".

Ответ должен быть только валидным JSON по заданной схеме. Без markdown вне JSON.`;

function buildBasePrompt(summary: ChartSummary): string {
  return `Создай бесплатный разбор "Общая натальная карта" для пользователя.

Данные пользователя и карты:
${JSON.stringify(summary, null, 2)}

Это не обычный гороскоп по знаку. Это персональный разбор по дате, времени и месту рождения. Бесплатная версия должна быть ценной сама по себе, но без подробного разбора каждой сферы.

Верни JSON NatalInterpretationReport:
{
  "userName": string,
  "birthData": { "birthDate": string, "birthTime": string | null, "birthPlace": string },
  "calculatedAt": string,
  "shortCard": { "title": string, "keywords": string[], "text": string, "advice": string },
  "freeSections": [
    { "key": "base_portrait", "title": "Главное о тебе", "subtitle": string, "access": "free", "content": string, "bullets": string[] },
    { "key": "main_formula", "title": "Как ты ведёшь себя с людьми", "access": "free", "content": string, "bullets": string[] },
    { "key": "how_others_see_you", "title": "Отношения", "access": "free", "content": string, "bullets": string[] },
    { "key": "emotional_world", "title": "Как ты общаешься", "access": "free", "content": string, "bullets": string[] },
    { "key": "strengths", "title": "Работа и деньги", "access": "free", "content": string, "bullets": string[] },
    { "key": "growth_zones", "title": "Что может мешать", "access": "free", "content": string, "bullets": string[] },
    { "key": "main_advice", "title": "Что делать", "access": "free", "content": string, "bullets": string[] },
    { "key": "summary", "title": "Короткий итог", "access": "free", "content": string, "bullets": string[] }
  ],
  "paidSections": [],
  "premiumSections": []
}

Требования:
- Каждый раздел: понятный вывод, пример из жизни, короткая рекомендация.
- Пиши на русском, просто и конкретно.
- Не показывай градусы и технические строки.
- Не пиши "Солнце · Рыбы · 16°" и похожую сухую кашу.
- Не обещай здоровье, доход, любовь, события или единственно правильные решения.
- В paidSections и premiumSections можно вернуть пустые массивы.`;
}

function buildPaidPrompt(summary: ChartSummary, meta: { title: string; subtitle: string }, sectionKey: HumanPaidSectionKey): string {
  return `Создай платный раздел натальной карты.

Раздел: ${meta.title}
Ключ раздела: ${sectionKey}
Фокус: ${meta.subtitle}

Данные пользователя и карты:
${JSON.stringify(summary, null, 2)}

Задача: создать подробный жизненный разбор раздела "${meta.title}". Это не справка и не набор эзотерических терминов, а применение карты к реальной жизни пользователя. Человек должен получить конкретные примеры и понятные действия.

Структура content:
1. Главный вывод
2. Как это видно в жизни
3. Пример реальной ситуации
4. Что может мешать
5. Что делать
6. Короткий вывод

Верни JSON InterpretationSection:
{
  "key": "${sectionKey}",
  "title": "${meta.title}",
  "subtitle": "${meta.subtitle}",
  "access": "paid",
  "isLocked": false,
  "teaser": "",
  "content": "цельный понятный текст 900-1700 символов",
  "bullets": ["3-5 коротких практичных выводов"],
  "ctaLabel": ""
}

Не обещай гарантированные события, доход, любовь или здоровье. Не используй медицинские рекомендации. Не давай прямых указаний вроде "обязательно увольняйтесь" или "покупайте". Формулируй как ориентиры и наблюдения.`;
}

function buildDailyPrompt(
  summary: ChartSummary,
  meta: { title: string; subtitle: string },
  sectionKey: HumanDailySectionKey,
  dateKey: string,
  transitData: unknown
): string {
  return `Создай персональный ежедневный разбор по натальной карте и текущим транзитам.

Дата разбора: ${dateKey}
Сфера разбора: ${meta.title}
Ключ раздела: ${sectionKey}

Натальная карта:
${JSON.stringify(summary, null, 2)}

Транзиты дня:
${JSON.stringify(transitData || {}, null, 2)}

Это не общий гороскоп по знаку. Это персональная интерпретация: натальная карта + расчеты дня + жизненная сфера. Наружу не пиши тяжелые технические объяснения, только человеческий вывод.

Структура content:
1. Тема дня
2. Что сегодня может проявиться
3. Что лучше делать
4. Что может мешать
5. Чего не делать
6. Лучшее действие
7. Короткий совет

Верни JSON InterpretationSection:
{
  "key": "${sectionKey}",
  "title": "${meta.title}",
  "subtitle": "${meta.subtitle}",
  "access": "premium",
  "isLocked": false,
  "teaser": "",
  "content": "цельный текст 600-1200 символов",
  "bullets": ["2-4 коротких вывода"],
  "ctaLabel": ""
}

Пиши через конкретные ситуации: разговор, задача, покупка, договорённость, пауза, конфликт. Не обещай событий и не используй медицинские, юридические или финансовые гарантии.`;
}

function cleanText(value: unknown): string {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanLine(value: unknown): string {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeBullets(value: unknown, fallback: string[] = []): string[] {
  const items = Array.isArray(value) ? value : fallback;
  return items.map(cleanLine).filter(Boolean).slice(0, 7);
}

function hasRussian(text: string): boolean {
  return /[А-Яа-яЁё]/.test(text);
}

function hasDuplicateParagraphs(text: string): boolean {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 80);
  return new Set(paragraphs).size !== paragraphs.length;
}

function hasBadText(text: string): boolean {
  const compact = text.toLowerCase();
  const englishSigns = /\b(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b/i;
  return (
    !hasRussian(text) ||
    /undefined|null/i.test(text) ||
    /искусственн(ый|ого) интеллект|as an ai/i.test(compact) ||
    englishSigns.test(text) ||
    /[{}[\]]/.test(text) ||
    /\d+\s*°/.test(text) ||
    /(Солнце|Луна|Марс|Венера|Меркурий)\s*·/.test(text) ||
    hasDuplicateParagraphs(text)
  );
}

function sectionText(section: InterpretationSection): string {
  return [section.title, section.subtitle, section.teaser, section.content, ...(section.bullets || [])]
    .map((v) => String(v || ''))
    .join('\n');
}

function normalizeSection(
  raw: Partial<InterpretationSection> | null | undefined,
  fallback: InterpretationSection,
  options?: { access?: InterpretationSection['access']; locked?: boolean }
): InterpretationSection {
  const section = raw && typeof raw === 'object' ? raw : {};
  return {
    key: (section.key || fallback.key) as InterpretationSectionKey,
    title: cleanLine(section.title) || fallback.title,
    subtitle: cleanLine(section.subtitle) || fallback.subtitle,
    access: options?.access || section.access || fallback.access,
    isLocked: options?.locked ?? section.isLocked ?? fallback.isLocked,
    teaser: cleanLine(section.teaser) || fallback.teaser,
    content: cleanText(section.content) || fallback.content,
    bullets: normalizeBullets(section.bullets, fallback.bullets),
    ctaLabel: cleanLine(section.ctaLabel) || fallback.ctaLabel,
  };
}

function validateSection(section: InterpretationSection, minLength: number): boolean {
  const content = cleanText(section.content);
  if (content.length < minLength) return false;
  if (hasBadText(sectionText(section))) return false;
  return true;
}

function validateReport(report: NatalInterpretationReport): boolean {
  if (!report || typeof report !== 'object') return false;
  if (!Array.isArray(report.freeSections) || report.freeSections.length < HUMAN_FREE_SECTION_KEYS.length) return false;
  const byKey = new Map(report.freeSections.map((section) => [section.key, section]));
  for (const key of HUMAN_FREE_SECTION_KEYS) {
    if (!byKey.has(key)) return false;
  }
  const portrait = byKey.get('base_portrait');
  if (!portrait || portrait.content.length < 500) return false;
  const allText = [
    report.userName,
    report.shortCard?.title,
    report.shortCard?.text,
    report.shortCard?.advice,
    ...(report.shortCard?.keywords || []),
    ...report.freeSections.map(sectionText),
  ].join('\n');
  return !hasBadText(allText);
}

function firstName(profile: UserProfile): string {
  return cleanLine(profile.name) || 'Друг';
}

function signTrait(sign: string): string {
  const map: Record<string, string> = {
    Овен: 'быстро включает волю и не любит долго стоять на месте',
    Телец: 'ищет опору, качество и понятный результат',
    Близнецы: 'быстро считывает смыслы, связи и настроение разговора',
    Рак: 'много чувствует и осторожно подпускает людей ближе',
    Лев: 'раскрывается там, где можно быть живым, заметным и щедрым',
    Дева: 'видит детали, порядок и слабые места системы раньше других',
    Весы: 'ищет баланс, красоту, справедливость и честный диалог',
    Скорпион: 'не боится глубины и видит скрытые мотивы',
    Стрелец: 'ищет смысл, движение, честность и широкий горизонт',
    Козерог: 'строит опору через ответственность, выдержку и результат',
    Водолей: 'мыслит независимо и не любит жить по чужой инструкции',
    Рыбы: 'тонко чувствует людей, настроение и невидимый смысл происходящего',
  };
  return map[sign] || 'ищет свой способ быть собой';
}

function moonTrait(sign: string): string {
  const map: Record<string, string> = {
    Овен: 'эмоции включаются быстро, поэтому важно не отвечать раньше, чем вы успели понять себя',
    Телец: 'эмоциям нужна надежность, телесный комфорт и время, чтобы отпустить напряжение',
    Близнецы: 'чувства легче проживаются через разговор, письмо и честное называние вещей',
    Рак: 'внутри много памяти, привязанности и потребности в безопасном пространстве',
    Лев: 'сердцу важно тепло, внимание и ощущение, что чувства не обесценивают',
    Дева: 'эмоции часто проходят через анализ, заботу и желание все привести в порядок',
    Весы: 'внутри нужен мир в отношениях, но не ценой замалчивания себя',
    Скорпион: 'чувства глубокие, сильные и не всегда сразу видны снаружи',
    Стрелец: 'эмоциональный ресурс возвращается через движение, смысл и ощущение свободы',
    Козерог: 'чувства могут прятаться за собранностью, делом и ответственностью',
    Водолей: 'внутри важно сохранить пространство и не потерять себя в чужих ожиданиях',
    Рыбы: 'эмоциональная система очень восприимчива и требует бережных границ',
  };
  return map[sign] || 'эмоциональный мир требует внимания и бережного обращения';
}

function ascTrait(sign: string): string {
  const map: Record<string, string> = {
    Овен: 'прямым, быстрым и самостоятельным',
    Телец: 'спокойным, надежным и устойчивым',
    Близнецы: 'легким, наблюдательным и контактным',
    Рак: 'осторожным, мягким и немного закрытым',
    Лев: 'теплым, заметным и уверенным',
    Дева: 'собранным, внимательным и точным',
    Весы: 'приятным, дипломатичным и чувствующим атмосферу',
    Скорпион: 'сильным, глубоким и не до конца раскрытым',
    Стрелец: 'открытым, живым и ищущим смысл',
    Козерог: 'серьезным, взрослым и надежным',
    Водолей: 'независимым, необычным и свободным',
    Рыбы: 'мягким, тонким и трудно считываемым сразу',
  };
  return map[sign] || 'человеком со своим ритмом';
}

function fallbackFreeSections(summary: ChartSummary): InterpretationSection[] {
  {
    const name = summary.user.name;
    const sun = summary.core.sun.sign;
    const moon = summary.core.moon.sign;
    const asc = summary.core.ascendant.sign;
    const hasTime = summary.housesAvailable && summary.core.ascendant.sign !== 'не указано';

    return [
      {
        key: 'base_portrait',
        title: 'Главное о тебе',
        subtitle: 'Короткий вывод по карте',
        access: 'free',
        content:
          `${name}, в твоей карте заметна связка ${sun}, ${moon} и ${asc}. Это не ярлык и не приговор, а способ описать поведение: как ты начинаешь контакт, как принимаешь решения и где чаще напрягаешься.\n\n` +
          `В обычной жизни это может выглядеть так: ты сначала смотришь на поступки человека, а уже потом решаешь, насколько ему доверять. Если ситуация мутная, ты можешь тянуть с ответом, пока не станет понятно, кто за что отвечает.\n\n` +
          `Что делать: не пытайся быть удобным для всех. Лучше быстрее называть факты, ожидания и границы.`,
        bullets: [
          `Солнце: ${sun}`,
          `Луна: ${moon}`,
          hasTime ? `Асцендент: ${asc}` : 'Без точного времени часть вывода будет общей',
        ],
      },
      {
        key: 'main_formula',
        title: 'Как ты ведёшь себя с людьми',
        subtitle: 'Новые люди, доверие, разговор',
        access: 'free',
        content:
          `Ты не всегда сразу показываешь отношение к человеку. Сначала смотришь, как он ведёт себя, держит ли слово и можно ли с ним говорить прямо.\n\n` +
          `Например, в рабочем разговоре человек может обещать быстро решить вопрос, но потом пропадать. Ты заметишь не обещание, а повторяющееся поведение.\n\n` +
          `Что делать: если контакт важен, давай понятные сигналы. Не молчи слишком долго, иначе тебя могут принять за закрытого человека.`,
        bullets: ['Новые знакомства', 'Рабочие разговоры', 'Проверка доверия'],
      },
      {
        key: 'how_others_see_you',
        title: 'Отношения',
        subtitle: 'Близость, доверие, границы',
        access: 'free',
        content:
          `В отношениях тебе важны поступки, а не красивые обещания. Если человек важен, ты можешь долго терпеть, но после нескольких нарушений доверие резко падает.\n\n` +
          `Например, партнёр обещает измениться, но снова делает то же самое. Сначала ты оправдываешь это, потом начинаешь отдаляться.\n\n` +
          `Что делать: смотри на повторяющееся поведение и говори о границах до того, как накопится злость.`,
        bullets: ['Поступки важнее слов', 'Границы', 'Договорённости'],
      },
      {
        key: 'emotional_world',
        title: 'Как ты общаешься',
        subtitle: 'Слова, паузы, конфликт',
        access: 'free',
        content:
          `В разговоре тебе легче, когда люди говорят прямо. Давление, намёки и попытка заставить тебя угадывать быстро делают контакт тяжёлым.\n\n` +
          `Например, человек говорит "делай как хочешь", но потом обижается на твой выбор. Это сбивает, потому что правила не были названы.\n\n` +
          `Что делать: просить конкретику и самому говорить так же: факт, влияние, просьба.`,
        bullets: ['Прямой разговор', 'Меньше намёков', 'Факт и просьба'],
      },
      {
        key: 'strengths',
        title: 'Работа и деньги',
        subtitle: 'Где проще быть полезным',
        access: 'free',
        content:
          `Тебе подходят задачи, где есть понятная ответственность, качество и результат. Сложнее там, где много суеты, но никто не может сказать, что именно должно получиться.\n\n` +
          `Например, ты можешь хорошо проверить договор, найти слабое место в плане или заметить риск в проекте до того, как он станет проблемой.\n\n` +
          `Что делать: выбирай задачи, где ценят точность и ясные договорённости. В деньгах не соглашайся на условия, которые не можешь объяснить простыми словами.`,
        bullets: ['Проверка условий', 'Качество', 'Ответственность'],
      },
      {
        key: 'growth_zones',
        title: 'Что может мешать',
        subtitle: 'Хаос, давление, незакрытые дела',
        access: 'free',
        content:
          `Тебя может сбивать не сама нагрузка, а неопределённость: непонятные сроки, чужие ожидания, слишком много незакрытых дел и разговоры без решения.\n\n` +
          `Например, день может быть нормальным, но одна мутная договорённость начинает забирать внимание. Ты возвращаешься к ней мыслями и теряешь скорость в остальных делах.\n\n` +
          `Что делать: выпиши, что именно неясно. Потом реши: закрыть сегодня, перенести, отменить или задать короткий вопрос человеку.`,
        bullets: ['Неопределённость', 'Давление', 'Слишком много незакрытого'],
      },
      {
        key: 'main_advice',
        title: 'Что делать',
        subtitle: 'Короткая практичная рекомендация',
        access: 'free',
        content:
          `Главная рекомендация простая: раньше переводить ощущения в факты. Не ждать, пока раздражение накопится, а назвать, что произошло, почему это важно и какое решение тебе подходит.\n\n` +
          `Это помогает в отношениях, работе и деньгах: меньше догадок, меньше молчания, больше понятных правил.`,
        bullets: ['Говорить раньше', 'Фиксировать договорённости', 'Смотреть на повторяющиеся поступки'],
      },
      {
        key: 'summary',
        title: 'Короткий итог',
        subtitle: 'Что забрать из разбора',
        access: 'free',
        content:
          `Если коротко: тебе важно строить жизнь через понятные правила, честные разговоры и задачи, где результат можно увидеть. Когда вокруг слишком много неопределённости, ты быстрее устаёшь и начинаешь закрывать контакт.\n\n` +
          `Главное действие: раньше переводить непонятное в вопросы и договорённости.`,
        bullets: ['Понятные правила', 'Честный разговор', 'Один следующий шаг'],
      },
    ];
  }
  const name = summary.user.name;
  const sun = summary.core.sun.sign;
  const moon = summary.core.moon.sign;
  const asc = summary.core.ascendant.sign;
  const sunHouse = summary.core.sun.house ? ` Важная тема Солнца связана с ${summary.core.sun.house} домом, поэтому эта внутренняя природа просит не только чувствовать себя, но и выражать это в конкретной жизненной сфере.` : '';
  const moonHouse = summary.core.moon.house ? ` Дом Луны показывает, где особенно нужна эмоциональная безопасность: это не слабость, а место, где вы восстанавливаете связь с собой.` : '';

  const sections: InterpretationSection[] = [
    {
      key: 'base_portrait',
      title: 'Главный портрет',
      subtitle: 'Что карта говорит о вас человеческим языком',
      access: 'free',
      content:
        `${name}, ваша карта показывает человека, в котором соединяются энергия ${sun}, эмоциональная глубина ${moon} и внешний образ ${asc}. Внутри вы не просто набор привычек или реакций. Вы человек, который ${signTrait(sun)}, но при этом эмоционально устроен тоньше: ${moonTrait(moon)}.\n\n` +
        `Со стороны вас могут считывать как ${ascTrait(asc)} человека. Это первое впечатление не всегда раскрывает всю глубину, потому что главные процессы у вас часто происходят внутри, прежде чем становятся словами или решениями. Вам важно не жить только по ожиданиям других, а постепенно выстраивать жизнь, где есть смысл, уважение к своим границам и ощущение внутренней опоры.\n\n` +
        `Сила этой карты в том, что вы способны замечать нюансы, собирать опыт в выводы и становиться устойчивее не через жесткость, а через честность с собой. Когда вы не пытаетесь играть чужую роль, ваша карта раскрывается намного теплее и сильнее.`,
    },
    {
      key: 'main_formula',
      title: 'Главная формула карты',
      subtitle: 'Три опоры, на которых держится портрет',
      access: 'free',
      content:
        `Главная формула вашей карты: ${sun} как внутренняя природа, ${moon} как эмоциональный мир и ${asc} как способ входить в жизнь. Это сочетание говорит о человеке, которому важно соединить личный смысл, эмоциональную честность и понятное движение вперед. Когда эти части спорят, вы можете то закрываться, то ускоряться, то слишком долго анализировать. Когда они работают вместе, появляется спокойная сила: вы лучше понимаете, чего хотите, кому доверяете и куда действительно готовы вкладываться.`,
      bullets: [`Солнце: ${signTrait(sun)}`, `Луна: ${moonTrait(moon)}`, `Асцендент: вас часто видят ${ascTrait(asc)}`],
    },
    {
      key: 'sun_code',
      title: 'Солнце - внутренняя природа',
      subtitle: `${sun} как центр ваших решений`,
      access: 'free',
      content:
        `Внутри вы человек, который ${signTrait(sun)}. Вам важно чувствовать, что ваши решения не случайны и не продиктованы только давлением извне. Солнце показывает, где включается ваша воля, достоинство и ощущение "я могу".${sunHouse} Ваша сила раскрывается, когда вы не предаете собственный темп и выбираете не просто удобный путь, а тот, в котором есть личный смысл.`,
    },
    {
      key: 'moon_code',
      title: 'Луна - эмоциональный мир',
      subtitle: `${moon} как способ чувствовать и восстанавливаться`,
      access: 'free',
      content:
        `Ваш эмоциональный мир устроен так: ${moonTrait(moon)}. Вы можете выглядеть спокойнее, чем чувствуете, или наоборот быстро реагировать там, где внутри уже накопилось напряжение. Луна показывает не слабость, а то, как вы восстанавливаете связь с собой.${moonHouse} Чем честнее вы признаете свое состояние, тем меньше приходится проживать его через молчание, усталость или резкие решения.`,
    },
    {
      key: 'ascendant_code',
      title: 'Асцендент - как вас видят другие',
      subtitle: `${asc} как первое впечатление`,
      access: 'free',
      content:
        `При первом контакте вас могут видеть ${ascTrait(asc)}. Люди не всегда сразу понимают, сколько всего происходит внутри, поэтому иногда могут считывать только внешнюю сторону: вашу манеру держаться, скорость реакции, закрытость или открытость. Асцендент важен не как маска, а как дверь: через него вы входите в новые ситуации и показываете миру, как с вами можно взаимодействовать.`,
    },
    {
      key: 'strengths',
      title: 'Сильные стороны',
      subtitle: 'Что в вас уже работает',
      access: 'free',
      content: 'Сильные стороны карты не про идеальность. Это качества, на которые можно опираться, когда жизнь становится сложнее или требует выбора.',
      bullets: [
        'Наблюдательность - вы замечаете больше, чем показываете сразу.',
        'Внутренняя честность - вам трудно долго жить там, где нет смысла.',
        'Глубина реакции - вы не проходите мимо того, что действительно важно.',
        'Способность учиться на опыте - сложные периоды могут делать вас собраннее.',
        'Верность своему человеку или делу - если вы выбрали, то вкладываетесь серьезно.',
      ],
    },
    {
      key: 'growth_zones',
      title: 'Зоны роста',
      subtitle: 'Мягко, но честно',
      access: 'free',
      content: 'Зоны роста в вашей карте не означают, что с вами что-то не так. Это места, где важно не действовать автоматически.',
      bullets: [
        'Не копить молчание там, где нужен разговор.',
        'Не идеализировать людей раньше, чем вы увидели их поступки.',
        'Не путать терпение с согласием.',
        'Не брать на себя чужие эмоции как свою обязанность.',
        'Не откладывать собственные желания до момента, когда сил уже почти нет.',
      ],
    },
    {
      key: 'how_others_see_you',
      title: 'Как вас видят другие',
      subtitle: 'Первое впечатление и социальный образ',
      access: 'free',
      content:
        `Со стороны вы можете казаться ${ascTrait(asc)}. Кому-то рядом с вами спокойно, кому-то может быть непросто сразу понять вашу глубину. Важно помнить: вы не обязаны открываться всем одинаково. Но там, где есть доверие и уважение к границам, ваша настоящая теплота и сила становятся заметнее.`,
    },
    {
      key: 'emotional_world',
      title: 'Эмоциональный мир',
      subtitle: 'Что важно для внутренней устойчивости',
      access: 'free',
      content:
        `Ваши чувства не любят грубого обращения. ${moonTrait(moon)}. Вам важно иметь пространство, где можно не играть роль, не объяснять все сразу и не держать лицо любой ценой. Чем лучше вы слышите свое состояние, тем меньше оно управляет вами исподтишка.`,
    },
    {
      key: 'self_relationship',
      title: 'Отношения с собой',
      subtitle: 'Как не терять себя в ожиданиях',
      access: 'free',
      content:
        'Главная задача в отношениях с собой - не требовать от себя постоянной удобности. Ваша карта сильнее раскрывается, когда вы перестаете сравнивать свой темп с чужим и начинаете уважать собственные реакции. Не каждое внутреннее сомнение надо подавлять. Иногда оно просто просит больше ясности, времени и честного выбора.',
    },
    {
      key: 'main_advice',
      title: 'Главный совет карты',
      subtitle: 'Одна мысль, которую стоит забрать',
      access: 'free',
      content:
        'Ваша карта просит не прятать глубину за привычной ролью. Сила не в том, чтобы все выдерживать молча, а в том, чтобы переводить внутреннее понимание в слова, решения и действия.',
    },
    {
      key: 'summary',
      title: 'Короткое резюме',
      subtitle: 'Главный вектор',
      access: 'free',
      content:
        `Главный вектор вашей карты - построить жизнь, где ${sun} дает смысл, ${moon} сохраняет связь с чувствами, а ${asc} помогает спокойно проявляться в мире. Чем меньше вы предаете себя ради чужого сценария, тем яснее становится ваш путь.`,
    },
  ];
  return sections;
}

export function buildHumanBaseFallback(profile: UserProfile, chart: NatalChartData): NatalInterpretationReport {
  {
    const summary = buildChartSummary(profile, chart);
    const sun = summary.core.sun.sign;
    const moon = summary.core.moon.sign;
    const asc = summary.core.ascendant.sign;
    const visibleFreeKeys = new Set<string>(HUMAN_FREE_SECTION_KEYS);
    const freeSections = fallbackFreeSections(summary).filter((section) => visibleFreeKeys.has(section.key));
    return {
      userName: firstName(profile),
      birthData: {
        birthDate: profile.birthDate || '',
        birthTime: profile.birthTime || null,
        birthPlace: profile.birthPlace || '',
      },
      calculatedAt: new Date().toISOString(),
      freeSections,
      paidSections: buildLockedPaidSections(),
      premiumSections: buildLockedDailySections(),
      shortCard: {
        title: 'Главный вывод по карте',
        keywords: [sun, moon, `${asc} как первое впечатление`].slice(0, 5),
        text: `${sun}, ${moon} и ${asc} дают первый разбор поведения: как ты входишь в контакт, что помогает принимать решения и где чаще появляется напряжение.`,
        advice: 'Смотри на повторяющиеся поступки, говори раньше и не бери на себя чужую ответственность без договорённости.',
      },
    };
  }
  const summary = buildChartSummary(profile, chart);
  const sun = summary.core.sun.sign;
  const moon = summary.core.moon.sign;
  const asc = summary.core.ascendant.sign;
  const keywords = [
    ELEMENT_RU[sun] || 'Смысл',
    ELEMENT_RU[moon] || 'Чувства',
    `${asc} как первое впечатление`,
  ];
  const visibleFreeKeys = new Set<string>(HUMAN_FREE_SECTION_KEYS);
  const freeSections = fallbackFreeSections(summary).filter((section) => visibleFreeKeys.has(section.key));
  return {
    userName: firstName(profile),
    birthData: {
      birthDate: profile.birthDate || '',
      birthTime: profile.birthTime || null,
      birthPlace: profile.birthPlace || '',
    },
    calculatedAt: new Date().toISOString(),
    freeSections,
    paidSections: buildLockedPaidSections(),
    premiumSections: buildLockedDailySections(),
    shortCard: {
      title: 'Главная энергия карты',
      keywords: keywords.slice(0, 5),
      text: `${sun}, ${moon} и ${asc} создают карту человека, которому важно соединить смысл, чувство и личную опору.`,
      advice: 'Не пытайтесь быть удобной версией себя. Сначала честность, потом действие.',
    },
  };
}

function fallbackPaidBody(summary: ChartSummary, key: HumanPaidSectionKey): { content: string; bullets: string[] } {
  {
    const sun = summary.core.sun.sign;
    const moon = summary.core.moon.sign;
    const asc = summary.core.ascendant.sign;
    const specific: Record<HumanPaidSectionKey, string> = {
      work_business:
        'В работе тебе подходят понятные роли, измеримый результат и право влиять на итог. Тяжелее там, где задач много, а ответственность размазана. Что делать: фиксировать владельца задачи, срок и критерий готовности.',
      love_relationships:
        'В отношениях важны поступки, а не красивые обещания. Риск появляется, когда ты долго терпишь нарушение границ, а потом резко отдаляешься. Что делать: говорить раньше и смотреть на повторяющееся поведение.',
      money_stability:
        'В деньгах лучше работают понятные правила: сколько стоит, зачем нужно, что изменится после покупки. Риск - тратить на эмоциях или соглашаться на мутные условия. Что делать: сравнивать варианты и сроки.',
      goals_actions:
        'В целях тебе помогает один понятный шаг, а не попытка закрыть всё сразу. Риск - держать слишком много направлений одновременно. Что делать: выбрать ближайшее действие и срок проверки.',
      friendship_social:
        'В окружении важны люди, с которыми можно говорить прямо. Тяжелее поверхностный контакт, давление и ожидание, что ты всё выдержишь. Что делать: оставлять рядом тех, кто держит договорённости.',
      family_home:
        'Дома и в семье тебе нужны правила, уважение и возможность не быть в постоянной обороне. Хаос дома может влиять на работу сильнее, чем кажется. Что делать: договариваться о быте и личной территории заранее.',
      shadow_patterns:
        'Повторяющийся сценарий может быть таким: сначала молчишь, потом копится раздражение, потом контакт резко закрывается. Что делать: называть проблему, пока она ещё небольшая.',
      potential_purpose:
        'Лучше всего подходят задачи, где нужны внимание к деталям, ответственность и ясный результат. Что делать: выбирать роли, где качество важнее суеты.',
      communication_conflicts:
        'В конфликте лучше работает короткая формула: факт, влияние, просьба. Риск - долго молчать или отвечать резко, когда терпение закончилось. Что делать: говорить раньше и конкретнее.',
      energy_recovery:
        'Нагрузка переносится легче, когда понятны приоритеты и есть паузы. Тяжелее хаос, давление и незакрытые мелочи. Что делать: сокращать список и завершать одно дело за раз.',
    };

    return {
      content:
        `Этот раздел опирается на карту рождения: Солнце ${sun}, Луна ${moon}, Асцендент ${asc}. Ниже не техническая справка, а перевод расчёта в обычные ситуации.\n\n` +
        specific[key],
      bullets: [
        'Сначала факты, потом вывод.',
        'Смотри на повторяющееся поведение.',
        'Один конкретный шаг полезнее длинного анализа.',
      ],
    };
  }
  const sun = summary.core.sun.sign;
  const moon = summary.core.moon.sign;
  const asc = summary.core.ascendant.sign;
  const base =
    `В этом разделе ваша карта говорит не о теории, а о том, как вы реально действуете в жизни. ${sun} показывает, где включается ваша воля и личный смысл. ${moon} показывает, что вам нужно эмоционально, чтобы не выгорать и не закрываться. ${asc} показывает, как вы входите в ситуации и какое первое впечатление создаете.\n\n`;

  const map: Record<HumanPaidSectionKey, string> = {
    work_business:
      'В работе вам важно видеть смысл и конкретный результат. Деньги легче приходят там, где вы не просто выполняете задачи, а собираете доверие: показываете качество, объясняете ценность и доводите продукт до понятного вида. Мешать может привычка ждать идеального состояния или брать на себя слишком много. Лучший ход - выбрать один участок реализации и сделать его яснее, полезнее, сильнее.',
    love_relationships:
      'В любви вам важна не игра, а настоящая близость. Вы можете долго присматриваться, потому что внутри быстро считываете детали: интонации, поступки, устойчивость человека. Сложность появляется, когда вы молчите слишком долго и ждете, что близкий сам догадается. Отношения укрепляются через честный разговор, надежные действия и право быть живым человеком, а не идеальной ролью.',
    money_stability:
      'Деньги для вас связаны не только с усилием, но и с ощущением внутренней опоры. Когда вы понимаете, за что вам платят и какую пользу создаете, доход становится спокойнее. Тормозить может распыление, сомнение в ценности своего труда или попытка держать все в голове. Ваш путь к стабильности - считать, упаковывать, объяснять ценность и не обесценивать маленькие регулярные шаги.',
    goals_actions:
      'Вашим целям нужен ритм, а не эмоциональный рывок. Когда есть смысл, вы можете идти долго, но хаос быстро забирает силы. Мешает не отсутствие потенциала, а попытка держать слишком много направлений одновременно. Рабочая стратегия - одна цель, один ближайший шаг, понятный срок и честная проверка: это мое желание или чужое ожидание?',
    friendship_social:
      'В окружении вам важны люди, рядом с которыми не надо постоянно играть роль. Поверхностное общение может быстро утомлять, особенно если в нем много шума и мало честности. Ваша сила - выбирать качество контакта вместо количества. Рост начинается там, где вы перестаете держать рядом людей только из привычки или чувства вины.',
    family_home:
      'Тема дома для вас не только бытовая. Дом - это место, где нервная система понимает: можно выдохнуть. Если дома хаос, напряжение или невысказанные эмоции, это быстро отражается на делах, отношениях и энергии. Ваша опора растет через простые вещи: порядок, тишину, честные границы и пространство, где не надо быть удобным.',
    shadow_patterns:
      'Ваша защитная реакция может выглядеть как закрытость, контроль или уход в наблюдение. Иногда это правда защищает, но иногда мешает получить поддержку. Не каждый человек, который подходит ближе, хочет нарушить ваши границы. Зона роста - отличать реальную угрозу от старой привычки заранее сжиматься.',
    potential_purpose:
      'Ваш потенциал раскрывается, когда вы соединяете чувствительность и действие. Не уходите полностью в мечту, но и не превращайтесь в холодную функцию. Карта ведет вас к жизни, где внутреннее понимание становится конкретными решениями: что создавать, с кем быть, за что отвечать и от чего вовремя уходить.',
    communication_conflicts:
      'В разговоре вам важно не копить напряжение до точки, где слова становятся слишком резкими или слишком поздними. Вы можете многое понимать до того, как это произнесено вслух, но другим людям нужны слова. Ваша сила - говорить точно, без давления и без самопредательства. Лучший конфликт для вас - тот, где есть честность, пауза и конкретная договоренность.',
    energy_recovery:
      'Ваш ресурс зависит от темпа, людей и эмоционального фона. Перегружает не только количество задач, но и необходимость долго быть не собой. Восстановление приходит через ясные границы, тишину, телесный ритм и завершение незакрытых мелочей. Важно не лечить себя дисциплиной, а выстраивать режим, который правда поддерживает.',
  };

  return {
    content: base + map[key],
    bullets: [
      'Сначала ясность, потом действие.',
      'Не обесценивайте свой темп.',
      'Сила карты раскрывается через честные решения.',
      'Один конкретный шаг важнее внутренней гонки.',
    ],
  };
}

export function buildHumanPaidFallback(profile: UserProfile, chart: NatalChartData, key: HumanPaidSectionKey): InterpretationSection {
  const summary = buildChartSummary(profile, chart);
  const meta = HUMAN_PAID_SECTION_META[key];
  const body = fallbackPaidBody(summary, key);
  return {
    key,
    title: meta.title,
    subtitle: meta.subtitle,
    access: 'paid',
    isLocked: false,
    teaser: meta.teaser,
    content: body.content,
    bullets: body.bullets,
    ctaLabel: '',
  };
}

export function buildHumanDailyFallback(
  profile: UserProfile,
  chart: NatalChartData,
  key: HumanDailySectionKey,
  dateKey: string
): InterpretationSection {
  {
    const summary = buildChartSummary(profile, chart);
    const meta = HUMAN_DAILY_SECTION_META[key];
    const sun = summary.core.sun.sign;
    const moon = summary.core.moon.sign;
    const specific: Record<HumanDailySectionKey, string> = {
      daily_overview: 'Сегодня лучше выбрать одно главное дело и не распыляться на чужие срочные запросы.',
      daily_work_business: 'В работе полезно довести до ясности один участок: срок, договорённость, деньги или результат.',
      daily_love: 'В близком разговоре лучше говорить конкретно: что произошло, что задело и чего ты хочешь дальше.',
      daily_money: 'В деньгах сегодня лучше проверять условия и не покупать только из-за эмоций.',
      daily_goals: 'Для целей подходит один короткий шаг, который можно реально завершить сегодня.',
      daily_communication: 'В переговорах лучше меньше намёков и больше прямых формулировок.',
      daily_friendship: 'В контактах выбирай людей, с которыми не нужно угадывать правила общения.',
      daily_family: 'Дома полезно закрыть один бытовой вопрос или договориться о правилах.',
      daily_energy: 'По нагрузке лучше не брать всё сразу. Оставь место для паузы и одного завершённого дела.',
      daily_risks: 'Риск дня - ответить слишком быстро или взять на себя лишнее.',
      daily_best_action: 'Лучшее действие дня - выбрать одну понятную задачу и довести её до результата.',
      daily_advice: 'Не копи раздражение. Назови факт и следующий шаг.',
    };

    return {
      key,
      title: meta.title,
      subtitle: meta.subtitle,
      access: 'premium',
      isLocked: false,
      teaser: meta.teaser,
      content:
        `Это не общий гороскоп по знаку. Разбор учитывает карту рождения и дату ${dateKey}: Солнце ${sun}, Луна ${moon} и текущий дневной фон.\n\n` +
        `${specific[key]}\n\nПример: если человек обещал ответить и снова тянет, лучше не додумывать весь день, а коротко спросить: "Когда сможешь дать точный ответ?"`,
      bullets: ['Один главный шаг', 'Меньше догадок', 'Больше конкретики'],
      ctaLabel: '',
    };
  }
  const summary = buildChartSummary(profile, chart);
  const meta = HUMAN_DAILY_SECTION_META[key];
  const sun = summary.core.sun.sign;
  const moon = summary.core.moon.sign;
  const specific: Record<HumanDailySectionKey, string> = {
    daily_overview: 'Сегодня день лучше проживать не через спешку, а через собранность и честность с собой. Выберите один главный фокус и не распыляйте внимание на все сразу.',
    daily_work_business: 'В работе сегодня полезно довести до нормального вида один денежный или смысловой участок. Не начинайте пять направлений, если одно уже просит ясности.',
    daily_love: 'В близости сегодня лучше меньше додумывать и больше уточнять. Мягкий разговор даст больше, чем попытка проверить человека молчанием.',
    daily_money: 'В деньгах сегодня полезны порядок, учет и трезвость. Не тратьте импульсивно на состояние "надо срочно себя успокоить".',
    daily_goals: 'Для целей сегодня работает маленький, но завершенный шаг. Лучше сделать одно конкретное действие, чем весь день держать в голове большой план.',
    daily_communication: 'В переговорах помогает пауза. Сначала поймите, что хотите сказать, и только потом усиливайте голос.',
    daily_friendship: 'В окружении выбирайте людей, после которых вы становитесь собраннее, а не пустее. Сегодня не обязательно отвечать всем сразу.',
    daily_family: 'В доме сегодня важны простые опоры: порядок, тишина, честный тон и отсутствие лишних драм. Маленькое улучшение пространства может вернуть силы.',
    daily_energy: 'Энергия сегодня просит бережного ритма. Не загоняйте себя только потому, что внутри есть тревога или желание быстро все исправить.',
    daily_risks: 'Главный риск дня - разогнаться на эмоциях и взять на себя больше, чем нужно. Проверьте, где вы действуете из ясности, а где из внутреннего напряжения.',
    daily_best_action: 'Лучшее действие дня - выбрать одну тему, которую вы давно откладывали, и сделать по ней спокойный, видимый шаг.',
    daily_advice: 'Совет дня: не ломайте стену. Найдите дверь, паузу или более точное слово.',
  };

  return {
    key,
    title: meta.title,
    subtitle: `${meta.subtitle} · ${dateKey}`,
    access: 'premium',
    isLocked: false,
    teaser: meta.teaser,
    content:
      `На фоне вашей карты с ${sun} и эмоциональным ритмом ${moon} этот день может подсветить тему личной собранности. ${specific[key]} Это не прогноз события, а ориентир: где лучше быть внимательнее к себе, не идти на автомате и не превращать день в гонку.`,
    bullets: ['Один фокус важнее десяти реакций.', 'Не принимайте решения из перегруза.', 'Сначала верните себе спокойствие, потом действуйте.'],
    ctaLabel: '',
  };
}

function normalizeReport(raw: Partial<NatalInterpretationReport> | null | undefined, fallback: NatalInterpretationReport): NatalInterpretationReport {
  const report = raw && typeof raw === 'object' ? raw : {};
  const fallbackByKey = new Map(fallback.freeSections.map((section) => [section.key, section]));
  const rawByKey = new Map(
    (Array.isArray(report.freeSections) ? report.freeSections : []).map((section) => [section.key, section])
  );
  const freeSections = HUMAN_FREE_SECTION_KEYS.map((key) =>
    normalizeSection(rawByKey.get(key), fallbackByKey.get(key)!, { access: 'free', locked: false })
  );

  return {
    userName: cleanLine(report.userName) || fallback.userName,
    birthData: {
      birthDate: cleanLine(report.birthData?.birthDate) || fallback.birthData.birthDate,
      birthTime: report.birthData?.birthTime == null ? fallback.birthData.birthTime : cleanLine(report.birthData.birthTime),
      birthPlace: cleanLine(report.birthData?.birthPlace) || fallback.birthData.birthPlace,
    },
    calculatedAt: cleanLine(report.calculatedAt) || fallback.calculatedAt,
    freeSections,
    paidSections: buildLockedPaidSections(),
    premiumSections: buildLockedDailySections(),
    shortCard: {
      title: cleanLine(report.shortCard?.title) || fallback.shortCard.title,
      keywords: normalizeBullets(report.shortCard?.keywords, fallback.shortCard.keywords).slice(0, 5),
      text: cleanText(report.shortCard?.text) || fallback.shortCard.text,
      advice: cleanText(report.shortCard?.advice) || fallback.shortCard.advice,
    },
  };
}

async function generateWithRetry<T>(fn: () => Promise<T>, isValid: (value: T) => boolean, fallback: T): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const value = await fn();
      if (isValid(value)) return value;
    } catch (error) {
      if (attempt === 1) {
        console.error('[NatalHumanInterpretation] generation failed', error);
      }
    }
  }
  return fallback;
}

export async function generateHumanBaseReport(profile: UserProfile, chart: NatalChartData): Promise<NatalInterpretationReport> {
  const fallback = buildHumanBaseFallback(profile, chart);
  const summary = buildChartSummary(profile, chart);
  const prompt = buildBasePrompt(summary);

  return generateWithRetry<NatalInterpretationReport>(
    async () => {
      const raw = await llmJson<NatalInterpretationReport>({
        system: HUMAN_SYSTEM_PROMPT,
        user: prompt,
        model: { accessTier: 'free', contentSurface: 'natal', contentVariant: 'anchor' },
        maxTokens: 6500,
        temperature: 0.62,
      });
      return normalizeReport(raw, fallback);
    },
    validateReport,
    fallback
  );
}

export async function generateHumanPaidSection(
  profile: UserProfile,
  chart: NatalChartData,
  key: HumanPaidSectionKey
): Promise<InterpretationSection> {
  const fallback = buildHumanPaidFallback(profile, chart, key);
  const summary = buildChartSummary(profile, chart);
  const meta = HUMAN_PAID_SECTION_META[key];
  const prompt = buildPaidPrompt(summary, meta, key);

  return generateWithRetry<InterpretationSection>(
    async () => {
      const raw = await llmJson<InterpretationSection>({
        system: HUMAN_SYSTEM_PROMPT,
        user: prompt,
        model: { accessTier: 'premium', contentSurface: 'natal', contentVariant: 'full' },
        maxTokens: 2800,
        temperature: 0.6,
      });
      return normalizeSection(raw, fallback, { access: 'paid', locked: false });
    },
    (section) => validateSection(section, 800),
    fallback
  );
}

export async function generateHumanDailySection(
  profile: UserProfile,
  chart: NatalChartData,
  key: HumanDailySectionKey,
  dateKey: string
): Promise<InterpretationSection> {
  const fallback = buildHumanDailyFallback(profile, chart, key, dateKey);
  const summary = buildChartSummary(profile, chart);
  const meta = HUMAN_DAILY_SECTION_META[key];
  let transitData: unknown = null;
  try {
    transitData = await getCurrentTransits(new Date(`${dateKey}T09:00:00.000Z`));
  } catch {
    transitData = null;
  }
  const prompt = buildDailyPrompt(summary, meta, key, dateKey, transitData);

  return generateWithRetry<InterpretationSection>(
    async () => {
      const raw = await llmJson<InterpretationSection>({
        system: HUMAN_SYSTEM_PROMPT,
        user: prompt,
        model: { accessTier: 'premium', contentSurface: 'natal', contentVariant: 'living' },
        maxTokens: 2200,
        temperature: 0.62,
      });
      return normalizeSection(raw, fallback, { access: 'premium', locked: false });
    },
    (section) => validateSection(section, 600),
    fallback
  );
}
