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

function getPosition(chart: NatalChartData, key: string): PlanetPosition | null {
  if (key === 'rising' || key === 'ascendant' || key === 'asc') return chart.rising || null;
  return (chart as any)[key] || null;
}

function serializePosition(chart: NatalChartData, key: string): SerializedPosition {
  const p = getPosition(chart, key);
  return {
    key,
    name: PLANET_RU[key] || key,
    sign: ruSign(p?.sign),
    house: p?.house != null ? Number(p.house) : null,
    degree: finiteDegree(p?.degree),
    retrograde: !!p?.retrograde,
  };
}

function serializeMc(chart: NatalChartData): SerializedPosition | null {
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
    'rising',
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
    housesAvailable: Array.isArray(chart.houses) && chart.houses.length >= 12,
    importantHouses: (chart.houses || []).slice(0, 12).map((house) => ({
      house: Number(house.house),
      sign: ruSign(house.sign),
      degree: finiteDegree(house.degree),
    })),
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

const HUMAN_SYSTEM_PROMPT = `Ты профессиональный русскоязычный астрологический интерпретатор для приложения Lumia. Твоя задача - писать глубокие, понятные и человеческие интерпретации натальной карты и ежедневных транзитов. Не пиши сухие справочные фразы. Не перечисляй планеты ради перечисления. Объясняй человеку, как карта проявляется в характере, отношениях, работе, деньгах, целях и ежедневных решениях.

Стиль: живой, точный, теплый, психологичный, без эзотерического тумана. Пиши так, чтобы пользователь почувствовал: "это про меня". Не запугивай, не обещай гарантированных событий, не давай медицинских, юридических или финансовых гарантий. Избегай фатализма. Любую сложность формулируй как зону роста.

Всегда объясняй: что это значит, как проявляется в жизни, где сила человека, что может мешать, что делать practically.

Не используй фразы вида "Солнце в Рыбах означает...". Вместо этого пиши естественно: "Внутри вы человек, которому важно...".

Ответ должен быть только валидным JSON по заданной схеме. Без markdown вне JSON.`;

function buildBasePrompt(summary: ChartSummary): string {
  return `Создай бесплатный базовый разбор натальной карты для пользователя.

Данные пользователя и карты:
${JSON.stringify(summary, null, 2)}

Нужно создать полноценный красивый портрет личности, не демо-огрызок.

Верни JSON NatalInterpretationReport:
{
  "userName": string,
  "birthData": { "birthDate": string, "birthTime": string | null, "birthPlace": string },
  "calculatedAt": string,
  "shortCard": { "title": string, "keywords": string[], "text": string, "advice": string },
  "freeSections": [
    { "key": "base_portrait", "title": "Главный портрет", "subtitle": string, "access": "free", "content": string, "bullets": string[] },
    { "key": "main_formula", "title": "Главная формула карты", "access": "free", "content": string },
    { "key": "sun_code", "title": "Солнце - внутренняя природа", "access": "free", "content": string },
    { "key": "moon_code", "title": "Луна - эмоциональный мир", "access": "free", "content": string },
    { "key": "ascendant_code", "title": "Асцендент - как вас видят другие", "access": "free", "content": string },
    { "key": "strengths", "title": "Сильные стороны", "access": "free", "content": string, "bullets": string[] },
    { "key": "growth_zones", "title": "Зоны роста", "access": "free", "content": string, "bullets": string[] },
    { "key": "how_others_see_you", "title": "Как вас видят другие", "access": "free", "content": string },
    { "key": "emotional_world", "title": "Эмоциональный мир", "access": "free", "content": string },
    { "key": "self_relationship", "title": "Отношения с собой", "access": "free", "content": string },
    { "key": "main_advice", "title": "Главный совет карты", "access": "free", "content": string },
    { "key": "summary", "title": "Короткое резюме", "access": "free", "content": string }
  ],
  "paidSections": [],
  "premiumSections": []
}

Требования:
- Главный портрет минимум 500 символов.
- Пиши на русском, глубоко, но понятно.
- Не показывай градусы и технические строки.
- Не пиши "Солнце · Рыбы · 16°" и похожую сухую кашу.
- В paidSections и premiumSections можно вернуть пустые массивы.`;
}

function buildPaidPrompt(summary: ChartSummary, meta: { title: string; subtitle: string }, sectionKey: HumanPaidSectionKey): string {
  return `Создай платный раздел натальной карты.

Раздел: ${meta.title}
Ключ раздела: ${sectionKey}
Фокус: ${meta.subtitle}

Данные пользователя и карты:
${JSON.stringify(summary, null, 2)}

Задача: создать глубокий жизненный разбор раздела "${meta.title}". Это не справка, а применение карты к реальной жизни пользователя.

Структура внутри content:
1. Главный инсайт
2. Как это проявляется в жизни
3. Где сила пользователя
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
  "content": "цельный текст 800-1600 символов",
  "bullets": ["3-5 коротких практичных вывода"],
  "ctaLabel": ""
}

Не обещай гарантированные события, доход, любовь или здоровье. Не используй медицинские рекомендации.`;
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

Это не общий гороскоп по знаку. Это персональная интерпретация: натальная карта + транзиты + жизненная сфера.

Структура внутри content:
1. Главная энергия дня
2. Что сегодня включается по карте
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

Пиши словами "может подсветить", "лучше обратить внимание", "день может дать ощущение". Не обещай событий.`;
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
        `При первом контакте вас могут видеть ${ascTrait(asc)}. Люди не всегда сразу понимают, сколько всего происходит внутри, поэтому иногда могут считывать только внешний слой: вашу манеру держаться, скорость реакции, закрытость или открытость. Асцендент важен не как маска, а как дверь: через него вы входите в новые ситуации и показываете миру, как с вами можно взаимодействовать.`,
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
  const summary = buildChartSummary(profile, chart);
  const sun = summary.core.sun.sign;
  const moon = summary.core.moon.sign;
  const asc = summary.core.ascendant.sign;
  const keywords = [
    ELEMENT_RU[sun] || 'Смысл',
    ELEMENT_RU[moon] || 'Чувства',
    `${asc} как первое впечатление`,
  ];
  const freeSections = fallbackFreeSections(summary);
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
  const sun = summary.core.sun.sign;
  const moon = summary.core.moon.sign;
  const asc = summary.core.ascendant.sign;
  const base =
    `В этом разделе ваша карта говорит не о теории, а о том, как вы реально действуете в жизни. ${sun} показывает, где включается ваша воля и личный смысл. ${moon} показывает, что вам нужно эмоционально, чтобы не выгорать и не закрываться. ${asc} показывает, как вы входите в ситуации и какое первое впечатление создаете.\n\n`;

  const map: Record<HumanPaidSectionKey, string> = {
    today_by_chart:
      'Сегодня лучше не требовать от себя резкого рывка. День полезнее проживать через ясный фокус: выбрать одну важную тему, убрать лишний шум и не отвечать на все раздражители сразу. Ваша сила сегодня в спокойной собранности, а не в попытке доказать, что вы справитесь со всем одновременно.',
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
    personal_growth_scenario:
      'Ваш сценарий роста - постепенно перестать доказывать и начать строить. Не через резкую смену личности, а через честный выбор: где я живу по себе, где терплю, где прячусь, где могу сделать один зрелый шаг. Карта становится сильнее, когда вы соединяете внутреннюю глубину, ясное слово и регулярное действие.',
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
