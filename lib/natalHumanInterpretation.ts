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
import { APP_VOICE_BLOCK_RU } from './appVoice';
import { getCurrentTransits } from './transits-calculator';
import { detectTransitAspects, formatTransitAspectsRu } from './transitAspects';
import { computeDayScoreFromTransits } from './todayPulse';
import { getDailyCanvasModelResolved } from './appSettings';
import { getWordRangeInstruction } from './contentMatrix';
import { buildBlindSpotPrompt, buildNatalSectionPrompt } from './contentPromptBuilders';
import {
  buildLockedDailySections,
  buildLockedPaidSections,
  DAILY_CANVAS_FREE_SECTION_KEYS,
  DAILY_CANVAS_SECTION_KEYS,
  DAILY_SECTION_TO_CANVAS_KEY,
  HUMAN_DAILY_SECTION_META,
  HUMAN_FREE_SECTION_KEYS,
  HUMAN_PAID_SECTION_META,
  type DailyCanvas,
  type DailyCanvasFreeSectionKey,
  type DailyCanvasSectionKey,
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
    gender: 'male' | 'female' | 'unspecified';
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
      gender: profile.gender === 'male' || profile.gender === 'female' ? profile.gender : 'unspecified',
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

// Хеш текста голоса: любое изменение APP_VOICE_BLOCK_RU (смена голоса приложения)
// меняет input-hash → кешированные разборы протухают и перегенерятся новым голосом,
// без ручного бампа promptVersion при каждой правке голоса.
const VOICE_HASH = createHash('sha256').update(APP_VOICE_BLOCK_RU).digest('hex').slice(0, 16);

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
      voiceHash: VOICE_HASH,
    }))
    .digest('hex');
}

// SYSTEM = единый голос приложения; ниже только задачные (не-тональные) правила разбора карты.
const HUMAN_SYSTEM_PROMPT = `${APP_VOICE_BLOCK_RU}

## ЗАДАЧА — разбор натальной карты

Переводи расчёты по дате, времени и месту рождения в обычный человеческий язык: читатель не знает астрологии и не должен её знать, чтобы тебя понять. Если упоминаешь планету, знак или дом — сразу объясняй, что это значит в поведении, без градусов и терминов.

Каждый важный вывод отвечает на четыре вопроса: как это видно в обычной жизни; в каких ситуациях проявляется; что человеку с этим делать; почему это может быть полезно.

Не обещай конкретные события, доход, любовь или здоровье. Не давай медицинских и психиатрических диагнозов.

РОД: в данных есть user.gender. «male» — мужской род («ты сделал», «ты готов»), «female» — женский («ты сделала», «ты готова»), «unspecified» — нейтрально, без родовых окончаний в адрес читателя; никогда не угадывай пол по имени.

Ответ — только валидный JSON по заданной схеме, без markdown вне JSON.`;

function buildBasePrompt(summary: ChartSummary): string {
  return `Создай короткий, но сильный бесплатный портрет личности по натальной карте. Объём небольшой — каждое слово должно работать. Лучше меньше текста, но точнее и живее.

Данные пользователя и карты:
${JSON.stringify(summary, null, 2)}

Верни JSON NatalInterpretationReport. Поля:
- "userName": имя пользователя;
- "shortCard": { "title": "Если коротко", "text": "1–2 предложения — суть характера человеческим языком", "keywords": ["4–5 коротких слов-черт, без названий знаков и планет"], "advice": "одна тёплая практичная мысль (1 фраза)" };
- "freeSections": массив ровно из 4 элементов в этом порядке и с этими ключами/заголовками (каждый ~70–100 слов, всего ~300–380 слов):
  1. { "key": "base_portrait", "title": "Кто ты по сути", ... } — цельный портрет: характер, как принимаешь решения, как входишь в контакт. Синтез Солнца/Луны/Асцендента, а не перечисление планет.
  2. { "key": "strengths", "title": "Сильные стороны", ... } — на что реально опираться, с 1 примером из жизни.
  3. { "key": "growth_zones", "title": "Где бывает трудно", ... } — слабые места и зоны роста, мягко и честно, без диагнозов и запугивания.
  4. { "key": "main_advice", "title": "Как с этим жить", ... } — 1 практичный совет: как пользоваться сильными сторонами и обходить слабые.
  у каждой секции: "subtitle" (короткий, 2–4 слова), "access": "free", "content" (строка), "bullets" (2–3 очень коротких вывода).
- "paidSections": [] и "premiumSections": [] — пустые массивы.

Требования к тексту:
- пиши так, будто ты лучший астролог-человек: точно, тепло, с конкретными примерами (работа, деньги, отношения, разговоры, решения). Никакой воды и общих фраз, которые подойдут кому угодно;
- коротко и по делу — это важнее, чем «побольше написать»;
- НИКАКОЙ эзотерики, мистики и космизма — пиши как про реального человека (подробнее в системных правилах);
- опирайся на Солнце, Луну и Асцендент (Асцендент — только если время рождения надёжно). Если время неизвестно/неточно, мягко упомяни это один раз;
- не повторяй мысли между секциями, не дублируй абзацы.`;
}

/**
 * Per-section astrological focus for paid natal sections.
 * Each entry tells the model WHICH placements to actually read for this topic,
 * so the 10 sections stop sharing one generic template and each delivers on the
 * exact title the user sees. Keep angles aligned to HUMAN_PAID_SECTION_META titles.
 */
const PAID_SECTION_FOCUS: Record<HumanPaidSectionKey, string> = {
  work_business:
    'MC и 10-й дом, Солнце, Марс, Сатурн, 6-й дом. Какой формат дела и нагрузки подходит, как ты добиваешься результата, где растёшь устойчивее и что тормозит рост.',
  love_relationships:
    'Венера, Луна, Марс, 5-й и 7-й дом. Как ты выбираешь и сближаешься, к кому тянет, что важно рядом, как ты ссоришься и миришься, какие сценарии повторяются.',
  money_stability:
    '2-й и 8-й дом, Венера, Юпитер, Сатурн. Отношение к деньгам и тратам, аппетит к риску, где теряешь ясность и какие денежные привычки держат тебя на плаву.',
  goals_actions:
    'Марс, Солнце, выделенные/сильные планеты, 1-й и 3-й дом. Недооценённые способности и сильные стороны в действии — что у тебя получается само, но ты это не считаешь талантом, и как на это опираться.',
  friendship_social:
    'Асцендент, 11-й дом, Меркурий, Венера. Какое первое впечатление ты производишь, как тебя считывают, с кем сходишься легко и где контакт быстро тяжелеет.',
  family_home:
    'Луна, 4-й дом, IC, Сатурн. Что для тебя значит дом и корни, твоя личная территория, как ты ведёшь себя с близкими и как снижать домашнее напряжение.',
  shadow_patterns:
    'Плутон, Сатурн, Луна, напряжённые аспекты. Автоматические реакции под стрессом, что ты в себе не замечаешь, как эти паттерны мешают решениям, отношениям и работе.',
  potential_purpose:
    'Солнце, MC, сильнейшая планета карты, Северный Узел. Где ты ярче всего, какие роли и задачи тебя раскрывают, за что тебя ценят и куда тянет расти.',
  communication_conflicts:
    'Меркурий, Марс, 3-й дом, аспекты Марса. Что реально тебя цепляет и злит, где ты давишь, а где молчишь, и как говорить так, чтобы тебя услышали без эскалации.',
  energy_recovery:
    'Луна, Марс, 6-й дом, Сатурн. Что быстрее тебя утомляет, твой природный ритм, что помогает восстановиться и где легко довести себя до перегруза. Без медицинских обещаний.',
};

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

type DailyPromptBuilder = (
  summary: ChartSummary,
  meta: { title: string; subtitle: string },
  sectionKey: HumanDailySectionKey,
  dateKey: string,
  transitData: unknown
) => string;

function buildFocusedDailyPrompt(
  summary: ChartSummary,
  meta: { title: string; subtitle: string },
  sectionKey: HumanDailySectionKey,
  dateKey: string,
  transitData: unknown,
  focusName: string,
  focusRules: string
): string {
  return `Создай отдельный персональный ежедневный разбор LUMIA. Это не общий слой и не часть списка: это самостоятельная страница "${meta.title}".

Дата: ${dateKey}
Content key: ${sectionKey}
Фокус страницы: ${focusName}

Натальная карта пользователя:
${JSON.stringify(summary, null, 2)}

Транзиты дня:
${JSON.stringify(transitData || {}, null, 2)}

Правила именно этого раздела:
${focusRules}

Стиль: живой русский текст, без мистической воды, без обещаний событий, дохода, любви, здоровья или юридических/финансовых гарантий. Пиши так, чтобы пользователь сразу понял, как прожить эту сферу сегодня.

Структура content:
1. Главная тема сферы сегодня
2. Как это может проявиться в обычной ситуации
3. Что лучше сделать
4. Что может мешать
5. Чего не стоит делать
6. Один короткий вывод

Верни JSON InterpretationSection:
{
  "key": "${sectionKey}",
  "title": "${meta.title}",
  "subtitle": "${meta.subtitle}",
  "access": "premium",
  "isLocked": false,
  "teaser": "",
  "content": "цельный русский текст 700-1300 символов",
  "bullets": ["2-4 коротких практичных вывода"],
  "ctaLabel": ""
}`;
}

function buildDailyLovePrompt(
  summary: ChartSummary,
  meta: { title: string; subtitle: string },
  sectionKey: HumanDailySectionKey,
  dateKey: string,
  transitData: unknown
): string {
  return buildFocusedDailyPrompt(
    summary,
    meta,
    sectionKey,
    dateKey,
    transitData,
    'любовь, близость, чувства и разговоры',
    'Смотри только на тему отношений: близость, диалог, эмоции, ожидания, паузы, честность. Не пиши про работу, деньги и цели кроме случаев, где они напрямую влияют на отношения.'
  );
}

function buildDailyMoneyPrompt(
  summary: ChartSummary,
  meta: { title: string; subtitle: string },
  sectionKey: HumanDailySectionKey,
  dateKey: string,
  transitData: unknown
): string {
  return buildFocusedDailyPrompt(
    summary,
    meta,
    sectionKey,
    dateKey,
    transitData,
    'деньги, покупки, решения и финансовая собранность',
    'Смотри только на деньги: траты, покупки, договоренности, учет, импульсивность, спокойные решения. Не давай инвестиционных инструкций и гарантий дохода.'
  );
}

function buildDailyWorkPrompt(
  summary: ChartSummary,
  meta: { title: string; subtitle: string },
  sectionKey: HumanDailySectionKey,
  dateKey: string,
  transitData: unknown
): string {
  return buildFocusedDailyPrompt(
    summary,
    meta,
    sectionKey,
    dateKey,
    transitData,
    'работа, бизнес, задачи, договоренности и фокус',
    'Смотри только на рабочую сферу: задачи, переговоры, темп, ответственность, сроки, деловые решения. Не смешивай это с любовью и личной драмой.'
  );
}

function buildDailyGoalsPrompt(
  summary: ChartSummary,
  meta: { title: string; subtitle: string },
  sectionKey: HumanDailySectionKey,
  dateKey: string,
  transitData: unknown
): string {
  return buildFocusedDailyPrompt(
    summary,
    meta,
    sectionKey,
    dateKey,
    transitData,
    'дела, цели, приоритет и один реальный шаг',
    'Смотри только на цели и дела: что выбрать главным, где не распыляться, какой шаг реально завершить сегодня, как не перегрузить день.'
  );
}

// Детерминированный выбор варианта fallback по дате: в течение суток текст
// стабилен (тот же кеш-ключ → тот же результат), но день ко дню меняется, чтобы
// при затяжном сбое AI юзер не видел один и тот же дежурный текст неделю подряд.
function pickVariant<T>(variants: T[], dateKey: string, salt = ''): T {
  if (variants.length <= 1) return variants[0];
  // FNV-1a + финальное лавинное домешивание: у соседних дат (различаются лишь
  // последней цифрой) индексы получаются разными, без длинных серий одного текста.
  const seed = `${dateKey}|${salt}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x2c1b3c6d) >>> 0;
  hash = (hash ^ (hash >>> 12)) >>> 0;
  return variants[hash % variants.length];
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

// Явная эзотерика/космизм, которой не должно быть в «человеческом» разборе.
// Намеренно НЕ включаем «энергия/энергетика» — это слово легитимно в дневных разборах
// (нагрузка/восстановление) и в обычной речи.
export const NATAL_BANNED_PHRASES = [
  'карм', 'чакр', 'астрал', 'эзотери', 'вселенн', 'мироздан', 'вибрац',
  'предназначен', 'предначертан', 'высшие силы', 'тонкие матери', 'духовный путь',
];
const ESOTERIC_PATTERN = new RegExp(`(${NATAL_BANNED_PHRASES.join('|')})`, 'i');

function hasBadText(text: string): boolean {
  const compact = text.toLowerCase();
  const englishSigns = /\b(aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\b/i;
  return (
    !hasRussian(text) ||
    /undefined|null/i.test(text) ||
    /искусственн(ый|ого) интеллект|as an ai/i.test(compact) ||
    englishSigns.test(text) ||
    ESOTERIC_PATTERN.test(compact) ||
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
  if (!portrait || portrait.content.length < 350) return false;
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
    Скорпион: 'не боится сложных тем и видит скрытые мотивы',
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
    const hasTime = summary.housesAvailable && summary.core.ascendant.sign !== 'не указано';

    return [
      {
        key: 'base_portrait',
        title: 'Кто ты по сути',
        subtitle: 'Характер и решения',
        access: 'free',
        content:
          `${name}, если коротко — ты сначала наблюдаешь, а потом действуешь. Сначала смотришь на поступки человека, и только потом решаешь, насколько ему доверять.\n\n` +
          `В обычной жизни это видно так: в мутной ситуации ты можешь тянуть с ответом, пока не станет понятно, кто за что отвечает. Это не нерешительность — так ты бережёшь силы и не влезаешь туда, где правила не названы.\n\n` +
          `Что с этим делать: не старайся быть удобным для всех. Тебе легче, когда ты раньше называешь факты, ожидания и границы — тогда и решения даются проще.`,
        bullets: [
          'Сначала смотришь на поступки',
          'Бережёшь силы в хаосе',
          hasTime ? 'Решения — через ясность' : 'Без точного времени часть вывода общая',
        ],
      },
      {
        key: 'strengths',
        title: 'Сильные стороны',
        subtitle: 'На что опереться',
        access: 'free',
        content:
          `Твоя сила — внимание к деталям и умение довести до ясности то, что у других расплывается. Тебе подходят задачи с понятной ответственностью и видимым результатом.\n\n` +
          `Например, ты можешь заметить слабое место в плане или риск в проекте раньше, чем он станет проблемой. Люди часто приходят к тебе, когда нужно «разложить по полочкам».\n\n` +
          `Что с этим делать: выбирай дела, где ценят точность и держат договорённости — там ты быстро становишься незаменимым.`,
        bullets: ['Внимание к деталям', 'Доводишь до ясности', 'Замечаешь риски заранее'],
      },
      {
        key: 'growth_zones',
        title: 'Где бывает трудно',
        subtitle: 'Слабые места, мягко',
        access: 'free',
        content:
          `Сбивает тебя не сама нагрузка, а неопределённость: непонятные сроки, чужие ожидания и слишком много незакрытых дел сразу.\n\n` +
          `Бывает так: день нормальный, но одна мутная договорённость начинает забирать внимание — ты мысленно возвращаешься к ней и теряешь скорость в остальном.\n\n` +
          `Что с этим делать: выпиши, что именно неясно, и реши по каждому пункту — закрыть сегодня, перенести, отменить или просто задать короткий вопрос человеку.`,
        bullets: ['Неопределённость утомляет', 'Распыляешься на незакрытом', 'Помогает простой список'],
      },
      {
        key: 'emotional_world',
        title: 'Что у тебя внутри',
        subtitle: 'Эмоции и опора',
        access: 'free',
        content:
          `Внутри ты заметно мягче, чем кажешься снаружи. Тебе важно чувствовать, что вокруг безопасно: когда обстановка ровная и понятная, ты быстро приходишь в себя.\n\n` +
          `Выбивает из колеи не столько большая проблема, сколько недосказанность — когда непонятно, что человек на самом деле чувствует или чего хочет.\n\n` +
          `Что помогает восстановиться: тишина, привычные ритуалы, близкий человек рядом и право какое-то время не быть «в форме».`,
        bullets: ['Нужна предсказуемость', 'Недосказанность ранит', 'Восстановление — в тишине'],
      },
      {
        key: 'how_others_see_you',
        title: 'Каким тебя видят',
        subtitle: 'Первое впечатление',
        access: 'free',
        content:
          (hasTime
            ? `Снаружи тебя часто считывают собраннее и увереннее, чем ты ощущаешь себя внутри. Первое впечатление — это «обложка», и она не всегда совпадает с содержанием.\n\n`
            : `Точное время рождения не указано, поэтому про первое впечатление скажем осторожно — эта часть может быть неточной. Но общая логика обычно такая.\n\n`) +
          `Люди нередко решают, какой ты, по первым минутам — по тому, как ты входишь в разговор и держишься. Иногда из-за этого тебе приписывают то, чего нет.\n\n` +
          `Что с этим делать: если хочешь, чтобы тебя поняли правильно, не полагайся только на впечатление — проговаривай словами то, что тебе важно.`,
        bullets: ['Снаружи собраннее', 'Обложка ≠ содержание', 'Говори о важном словами'],
      },
      {
        key: 'main_advice',
        title: 'Как с этим жить',
        subtitle: 'Короткий совет',
        access: 'free',
        content:
          `Главное — раньше переводить ощущения в слова. Не ждать, пока раздражение накопится, а спокойно назвать: что произошло, почему это важно и какое решение тебе подходит.\n\n` +
          `Опирайся на свои сильные стороны (ясность, внимание к деталям) и не загоняй себя в хаос и роль удобного человека. Меньше догадок, больше понятных правил — и тебе самому станет легче.`,
        bullets: ['Говорить раньше', 'Опираться на ясность', 'Не быть удобным для всех'],
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
        `${name}, ваша карта показывает человека, в котором соединяются энергия ${sun}, эмоциональная чувствительность ${moon} и внешний образ ${asc}. Внутри вы не просто набор привычек или реакций. Вы человек, который ${signTrait(sun)}, но при этом эмоционально устроен тоньше: ${moonTrait(moon)}.\n\n` +
        `Со стороны вас могут считывать как ${ascTrait(asc)} человека. Это первое впечатление не всегда раскрывает всю внутреннюю жизнь, потому что главные процессы у вас часто происходят внутри, прежде чем становятся словами или решениями. Вам важно не жить только по ожиданиям других, а постепенно выстраивать жизнь, где есть смысл, уважение к своим границам и ощущение внутренней опоры.\n\n` +
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
        `Со стороны вы можете казаться ${ascTrait(asc)}. Кому-то рядом с вами спокойно, кому-то может быть непросто сразу понять вашу внутреннюю жизнь. Важно помнить: вы не обязаны открываться всем одинаково. Но там, где есть доверие и уважение к границам, ваша настоящая теплота и сила становятся заметнее.`,
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
        'Ваша карта просит не прятать чувствительность за привычной ролью. Сила не в том, чтобы все выдерживать молча, а в том, чтобы переводить внутреннее понимание в слова, решения и действия.',
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

function fallbackPaidBody(_summary: ChartSummary, key: HumanPaidSectionKey): { content: string; bullets: string[] } {
  // Каждая тема — свой самостоятельный текст (на «ты», по-человечески). Без общего
  // вступления и одинаковых буллетов: раньше во всех темах был один и тот же текст.
  const map: Record<HumanPaidSectionKey, string> = {
    work_business:
      'В работе тебе важно видеть смысл и конкретный результат. Легче там, где есть понятная роль, измеримый итог и право влиять на решение. Тяжелее, когда задач много, а ответственность размазана, или когда ждёшь идеального момента, чтобы начать. Сила приходит, когда ты собираешь доверие: показываешь качество, объясняешь ценность и доводишь дело до понятного вида. Ближайший ход — выбери один участок и сделай его яснее и сильнее, не пытаясь закрыть всё сразу.',
    love_relationships:
      'В отношениях тебе важна не игра, а настоящая близость и поступки, а не красивые обещания. Ты можешь долго присматриваться, потому что быстро считываешь интонации, поведение и устойчивость человека. Сложность появляется, когда ты долго терпишь нарушение границ и молчишь, а потом резко отдаляешься. Связь крепнет через честный разговор раньше, надёжные действия и право быть живым человеком, а не идеальной ролью. Смотри на повторяющееся поведение, а не на отдельные слова.',
    money_stability:
      'Деньги для тебя связаны не только с усилием, но и с ощущением опоры. Доход становится спокойнее, когда ты понимаешь, за что тебе платят и какую пользу создаёшь. Тормозят импульсивные траты, сомнение в ценности своего труда и привычка держать всё в голове. Лучше работают понятные правила: сколько стоит, зачем нужно и что изменится после покупки. Путь к стабильности — считать, сравнивать варианты и не обесценивать маленькие регулярные шаги.',
    goals_actions:
      'Твоим целям нужен ритм, а не эмоциональный рывок. Когда есть смысл, ты можешь идти долго, но хаос и десять направлений сразу быстро забирают силы. Мешает не нехватка потенциала, а попытка держать всё одновременно. Рабочая стратегия простая: одна цель, один ближайший шаг, понятный срок и честная проверка — это моё желание или чужое ожидание? Начни с ближайшего действия и не оценивай весь путь по первому дню.',
    friendship_social:
      'В окружении тебе важны люди, рядом с которыми не надо постоянно играть роль и можно говорить прямо. Поверхностное общение быстро утомляет, особенно когда в нём много шума и мало честности. Твоя сила — выбирать качество контакта вместо количества. Рост начинается там, где ты перестаёшь держать рядом людей только из привычки или чувства вины, и оставляешь тех, кто держит договорённости.',
    family_home:
      'Тема дома для тебя не только бытовая. Дом — это место, где нервная система понимает: можно выдохнуть. Если дома хаос, напряжение или невысказанные эмоции, это отражается на делах, отношениях и энергии сильнее, чем кажется. Тебе нужны правила, уважение и возможность не быть в постоянной обороне. Опора растёт через простые вещи: порядок, тишину, честные границы и пространство, где не надо быть удобным. Договаривайся о быте и личной территории заранее.',
    shadow_patterns:
      'Твоя защитная реакция может выглядеть так: сначала молчишь, потом копится раздражение, потом контакт резко закрывается. Иногда закрытость и контроль правда защищают, но иногда мешают получить поддержку. Не каждый, кто подходит ближе, хочет нарушить твои границы. Зона роста — отличать реальную угрозу от старой привычки заранее сжиматься, и называть проблему, пока она ещё небольшая.',
    potential_purpose:
      'Твоя сила раскрывается, когда ты соединяешь чувствительность и действие: не уходишь полностью в мечту, но и не превращаешься в холодную функцию. Лучше всего подходят задачи, где нужны внимание к деталям, ответственность и ясный результат, где качество важнее суеты. Тебя ведёт к жизни, где внутреннее понимание становится конкретными решениями: что создавать, с кем быть, за что отвечать и от чего вовремя уходить.',
    communication_conflicts:
      'В разговоре тебе важно не копить напряжение до точки, где слова становятся слишком резкими или слишком поздними. Ты часто понимаешь многое ещё до того, как это произнесено вслух, но другим людям нужны слова. В конфликте лучше работает короткая формула: факт, влияние, просьба. Твоя сила — говорить точно, без давления и без самопредательства. Лучший спор для тебя — тот, где есть честность, пауза и конкретная договорённость.',
    energy_recovery:
      'Твой ресурс зависит от темпа, людей и эмоционального фона. Перегружает не только количество задач, но и необходимость долго быть не собой. Тяжелее, когда вокруг хаос, давление и незакрытые мелочи. Восстановление приходит через ясные приоритеты, паузы, тишину, телесный ритм и завершение одного дела за раз. Важно не лечить себя дисциплиной, а выстраивать режим, который правда поддерживает.',
  };

  return { content: map[key] || '', bullets: [] };
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

// Fallback-тексты дневных сфер в голосе приложения (docs/VOICE.md): тёплый прямой
// друг, живая конкретика, без штампов и обтекаемых пустышек. На каждую сферу — по
// 2–3 варианта; выбор детерминирован по дате (pickVariant), чтобы при затяжном сбое
// AI юзер не читал один и тот же текст каждый день. Это ПОДСТРАХОВКА, не замена
// персональной генерации — она остаётся основным путём.
const DAILY_FALLBACK_VARIANTS: Record<HumanDailySectionKey, string[]> = {
  daily_overview: [
    'Сегодня всё будет тянуть тебя в разные стороны — то задачи, то сообщения, то чьи-то срочные «надо прямо сейчас». Правда в том, что к вечеру ты выдохнешь не оттого, что всё успел, а оттого, что довёл до конца одно главное.\n\nВыбери его с утра и держись. Остальное подождёт, честно. Один закрытый вопрос сегодня даёт больше покоя, чем десять начатых и брошенных на середине.',
    'День из тех, когда легко провести кучу времени в движении и к вечеру не понять, а что, собственно, сделал. Дел много, но не все они твои и не все на сегодня.\n\nНачни с простого: что одно, если ты закроешь это к вечеру, сделает день не зря? Вот за него и держись. К остальному вернёшься, когда будут силы — и это нормально, а не провал.',
    'Сегодня спешка — плохой советчик. Не потому что «звёзды против», а потому что на бегу проще наделать мелких ошибок, которые потом придётся разгребать дольше, чем если бы ты сразу сделал спокойно.\n\nВыбери одно дело, дай ему нормальное внимание и доведи до конца. Между делами — короткая пауза без телефона. Такой ритм сегодня сбережёт тебе и время, и нервы.',
  ],
  daily_work_business: [
    'В работе сегодня важнее довести до конца один участок, чем красиво начать пять. Ощущение занятости легко перепутать с движением: вкладок открыто десять, а реально закрыто ноль.\n\nВыбери, что именно ты сегодня доведёшь до результата. Если дело стоит из-за «непонятно, кто за что отвечает» — закрой именно этот вопрос коротким сообщением или звонком, а не хватайся за новую задачу поверх застрявшей.',
    'Сегодня хорошо идёт не старт нового, а завершение того, что уже висит. Знаешь это чувство — три проекта в работе, и ни один не сдвинулся? Вот сегодня как раз день выбрать один и додавить.\n\nНе гонись за объёмом. Один доведённый до понятного вида кусок принесёт больше спокойствия и больше пользы, чем длинный список того, что «в процессе».',
  ],
  daily_love: [
    'В близких отношениях сегодня больше даёт прямота, а не намёки. Если внутри копится «мог бы и сам догадаться» — именно из этого вырастает большинство мелких обид на ровном месте.\n\nСкажи простыми словами: что произошло, что задело и чего ты хочешь дальше. Это не конфликт, это ясность. Если человек тянет с ответом — не наказывай молчанием, спокойно спроси: «когда сможешь сказать точно?» Один честный вопрос экономит вечер, который иначе уйдёт на додумывание.',
    'Сегодня меньше проверок, больше слов. Мы часто ждём, что близкий человек сам всё поймёт по интонации и настроению — а он не телепат, и это ок.\n\nЕсли что-то задело — скажи прямо и по-доброму, пока маленькое не превратилось в стену. И если тянет устроить проверку молчанием — не надо, честно, от неё легче не станет никому. Тёплый прямой разговор сегодня стоит десяти намёков.',
  ],
  daily_money: [
    'В деньгах сегодня выигрывает трезвость: проверь условия, сроки и реально ли тебе это нужно, прежде чем платить. Большая часть импульсивных трат — это попытка быстро заглушить эмоцию, а не закрыть настоящую потребность.\n\nТянет купить «чтобы стало полегче» — отложи до вечера и сравни хотя бы пару вариантов. Если к вечеру вещь всё ещё нужна — бери спокойно. Если отпустило — ты только что сэкономил и деньги, и лишнее сожаление.',
    'Сегодня та самая пауза перед оплатой стоит дороже самой покупки. Не потому что «день неудачный для трат», а потому что на эмоции легко купить то, что завтра будешь оправдывать сам перед собой.\n\nКрупное — отложи на пару дней, ничего не убежит. Мелкое — просто спроси себя честно: это мне правда нужно или просто хочется чем-то заесть день? Оба ответа нормальные, важно их себе не врать.',
  ],
  daily_goals: [
    'Для целей сегодня работает не масштаб, а завершённость. Большой план, который весь день крутится в голове, только выматывает и создаёт ощущение, будто ты ничего не успеваешь — хотя на деле просто не выбрал, с чего начать.\n\nНе «разобраться со всем проектом», а сделать первый конкретный кусок и поставить галочку. Один видимый завершённый шаг возвращает чувство, что делами управляешь ты, а не они тобой.',
    'Сегодня дроби большое на маленькое. Цель, на которую смотришь целиком, парализует — слишком много, непонятно за что хвататься, руки опускаются.\n\nВыбери самый первый крошечный шаг — такой, который можно сделать прямо сейчас за десять минут. Сделал — отметил — выдохнул. День, собранный из маленьких закрытых шагов, к вечеру ощущается куда честнее, чем день больших планов, оставшихся в голове.',
  ],
  daily_communication: [
    'В разговорах сегодня помогает пауза: сначала пойми, что именно хочешь сказать, и только потом повышай голос. Меньше намёков и проверок — больше прямых спокойных формулировок.\n\nЧасто дело даже не в теме, а в тоне и недосказанности. Вместо «ну ты сам понимаешь» скажи прямо, что тебе нужно и к какому сроку. Прямая просьба звучит мягче долгого намёка и почти всегда быстрее приводит к ответу.',
    'Сегодня короткая пауза перед ответом решает больше, чем удачная формулировка. Особенно если внутри уже кипит — на горячую голову легко сказать то, что потом придётся долго сглаживать.\n\nВдохни, дай себе секунду, скажи по делу. Если разговор буксует — не дави, а спроси: «что нам сейчас сделать, чтобы стало лучше?» Этот вопрос разворачивает спор из «кто прав» в «что дальше».',
  ],
  daily_friendship: [
    'В контактах сегодня выбирай людей, после которых становишься бодрее, а не пустее. Внимание — тоже ресурс, и тратить его стоит туда, где оно возвращается теплом, а не усталостью.\n\nНе обязательно отвечать всем и сразу. Если переписка по кругу вытягивает силы — поставь её на паузу без чувства вины и вернись, когда будешь в форме. Один тёплый честный разговор сегодня важнее десяти дежурных «как дела».',
    'Сегодня качество общения важнее количества. Знаешь эти диалоги ни о чём, после которых почему-то устал? Вот их сегодня можно смело сократить.\n\nНапиши тому, с кем правда хочется поговорить, а не тому, кому «надо ответить из вежливости». И если чувствуешь, что на людей сейчас нет сил — это не грубость, это честность. Побудь в своём темпе, никто не обидится.',
  ],
  daily_family: [
    'Дома сегодня выручают простые опоры: порядок, спокойный тон и поменьше лишних драм. Часто силы возвращает не большой душевный разговор, а закрытый бытовой вопрос и понятная договорённость, до которой дошли без надрыва.\n\nРеши один отложенный домашний момент или мягко проговори, кто что делает на ближайшие дни. Маленькое наведение порядка в пространстве нередко наводит порядок и внутри — это правда работает.',
    'Сегодня дом — это про «выдохнуть», а не про «выяснить отношения». Если что-то бытовое давно раздражает — реши это по-простому, без превращения в большой разговор с претензиями.\n\nИногда самое тёплое, что можно сделать для близких и для себя, — это убрать один источник ежедневного мелкого напряжения. Договоритесь спокойно, по-человечески. Вечер от этого станет заметно легче.',
  ],
  daily_energy: [
    'По силам сегодня лучше не хватать всё разом — оставь место для паузы и одного спокойно доведённого дела. Тревога часто гонит делать быстрее, чем реально надо, и именно эта спешка выматывает, а не сам объём.\n\nМежду делами дай себе короткую честную паузу без телефона. Ритм «сделал — выдохнул — пошёл дальше» сегодня сбережёт тебе больше сил, чем попытка пробежать весь день на одном рывке.',
    'Сегодня твой ресурс любит бережный темп. Не потому что «надо себя жалеть», а потому что на измотанном себе далеко не уедешь — сорвёшься на ерунде и потом будешь жалеть.\n\nНе бери на себя лишнее просто потому, что попросили. Одно дело за раз, короткие передышки, вечером — реально отдохнуть, а не долистать день в телефоне. Это не лень, это то, из-за чего завтра будет с чем работать.',
  ],
  daily_risks: [
    'Главный риск дня — ответить сгоряча или взять на себя лишнее на эмоциях. Прежде чем согласиться или резко ответить, дай себе одну паузу на вдох.\n\nЧасто именно эта секунда отделяет решение, за которое завтра скажешь себе спасибо, от того, которое придётся исправлять. Проверь по-честному: ты сейчас действуешь из ясности — или просто хочешь поскорее закрыть неприятный момент?',
    'Сегодня будь внимательнее там, где хочется решить всё быстро и прямо сейчас. Спешка на эмоции — это про «сказал, не подумав» и «согласился, а зря».\n\nНичего страшного не случится, если ты возьмёшь паузу перед важным словом или подписью. Наоборот — пауза тут твой друг. Дай себе выдохнуть и только потом отвечай.',
  ],
  daily_best_action: [
    'Лучшее, что можно сделать сегодня, — выбрать одну давно отложенную тему и сделать по ней спокойный видимый шаг. Не обязательно закрывать её целиком, важно просто сдвинуть с мёртвой точки то, что давно висит фоном и тихо съедает внимание.\n\nОдин звонок, одно письмо, один абзац того, что откладывал. После этого день ощущается иначе — как будто внутри стало просторнее.',
    'Сегодня самое ценное действие — разобраться с тем, что ты давно откладываешь и что подтачивает тебя фоном. Знаешь это «надо бы, но не сейчас», которое тянется уже неделю?\n\nВот сегодня — сейчас. Не весь вопрос сразу, а первый честный шаг. Сделаешь — и заметишь, как отпустит то напряжение, о котором ты и думать забыл, что оно есть.',
  ],
  daily_advice: [
    'Не копи раздражение — называй, что не так, и предлагай следующий шаг, пока эмоция не превратилась в стену. Сила сегодня не в том, чтобы продавить, а в том, чтобы найти дверь: паузу, точное слово или прямой вопрос.\n\nВместо спора, кто прав, спроси: «что нам сейчас сделать, чтобы стало лучше?» Один такой вопрос разворачивает разговор из борьбы в решение.',
    'Сегодня простое правило: говори раньше, пока мелочь ещё мелочь. Мы часто терпим-терпим, а потом выдаём всё разом и не по адресу — и получается больно всем.\n\nЗаметил, что что-то задевает, — скажи спокойно и вовремя. Это не про «раздувать конфликт», это про то, чтобы до конфликта и не доводить. Прямо и тепло почти всегда работает лучше, чем долго и молча.',
  ],
};

const DAILY_FALLBACK_BULLETS: Partial<Record<HumanDailySectionKey, string[][]>> = {
  daily_love: [
    ['Говори о фактах, не о догадках', 'Меньше проверок молчанием', 'Назови, чего хочешь дальше'],
    ['Скажи прямо и по-доброму', 'Не жди, что сам догадается', 'Спроси, а не додумывай'],
  ],
  daily_money: [
    ['Проверь условия до оплаты', 'Не трать, чтобы заглушить', 'Сравни хотя бы два варианта'],
    ['Крупное — отложи на пару дней', 'Спроси: нужно или хочется', 'Пауза дороже покупки'],
  ],
  daily_work_business: [
    ['Доведи один участок до конца', 'Уточни, кто за что отвечает', 'Не открывай пять дел сразу'],
    ['Закрой то, что висит', 'Один результат важнее пяти стартов', 'Начни с застрявшего'],
  ],
  daily_goals: [
    ['Сделай первый маленький шаг', 'Дроби большое на куски', 'Не держи весь план в голове'],
    ['Одно дело — до галочки', 'Начни с десятиминутного', 'Отметил — выдохнул — дальше'],
  ],
};

const DAILY_FALLBACK_BULLETS_DEFAULT: string[][] = [
  ['Выбери одно главное', 'Меньше догадок, больше слов', 'Пауза перед решением'],
  ['Начни с малого', 'Доведи до конца одно', 'Дай себе выдохнуть'],
];

function knownFallbackSign(sign: string): string | null {
  const value = cleanLine(sign);
  return value && value !== 'неизвестный знак' ? value : null;
}

function dailyFallbackSeed(profile: UserProfile, chart: NatalChartData): string {
  const core = ['sun', 'moon', 'rising', 'mercury', 'venus', 'mars'].map((key) => {
    const p = serializePosition(chart, key);
    return `${key}:${p.sign}:${p.house ?? ''}:${p.degree ?? ''}:${p.retrograde ? 'r' : ''}`;
  });

  return createHash('sha256')
    .update(JSON.stringify({
      user: {
        id: cleanLine(profile.id),
        name: firstName(profile),
        birthDate: cleanLine(profile.birthDate),
        birthTime: cleanLine(profile.birthTime),
        birthPlace: cleanLine(profile.birthPlace),
      },
      core,
      calculationVersion: chart.calculationVersion || null,
    }))
    .digest('hex')
    .slice(0, 16);
}

function dailyFallbackPersonalLead(profile: UserProfile, chart: NatalChartData): string {
  const name = firstName(profile);
  const sun = knownFallbackSign(serializePosition(chart, 'sun').sign);
  const moon = knownFallbackSign(serializePosition(chart, 'moon').sign);
  const asc = knownFallbackSign(serializePosition(chart, 'rising').sign);
  const facts: string[] = [];

  if (sun) facts.push(`Солнце в ${sun} — ${signTrait(sun)}`);
  if (moon) facts.push(`Луна в ${moon} — ${moonTrait(moon)}`);
  if (facts.length < 2 && asc) facts.push(`Асцендент в ${asc} делает первый шаг ${ascTrait(asc)}`);

  if (!facts.length) {
    return `${name}, это запасной дневной разбор по твоим данным, а не общий текст для всех.`;
  }

  return `${name}, это разбор от твоей карты, а не общий прогноз по знаку. ${facts.slice(0, 2).join('. ')}.`;
}

const DAILY_SUN_DO: Record<string, string> = {
  Овен: 'начать без разгона',
  Телец: 'закрепить главное',
  Близнецы: 'сказать проще',
  Рак: 'выбрать бережный тон',
  Лев: 'показать результат',
  Дева: 'разложить по шагам',
  Весы: 'договориться честно',
  Скорпион: 'назвать скрытое',
  Стрелец: 'оставить простор',
  Козерог: 'закрыть обязательство',
  Водолей: 'сделать по-своему',
  Рыбы: 'поймать тонкость',
};

const DAILY_MOON_DONT: Record<string, string> = {
  Овен: 'не отвечать рывком',
  Телец: 'не упираться молча',
  Близнецы: 'не спорить на бегу',
  Рак: 'не закрываться обидой',
  Лев: 'не доказывать силой',
  Дева: 'не чинить всё сразу',
  Весы: 'не соглашаться из вежливости',
  Скорпион: 'не проверять тишиной',
  Стрелец: 'не обещать на подъёме',
  Козерог: 'не держать лицо любой ценой',
  Водолей: 'не отстраняться резко',
  Рыбы: 'не растворяться в чужом',
};

function dailyDoCue(chart: NatalChartData): string {
  const sun = knownFallbackSign(serializePosition(chart, 'sun').sign);
  return sun && DAILY_SUN_DO[sun] ? `${sun}: ${DAILY_SUN_DO[sun]}` : 'Выбрать свой темп';
}

function dailyDontCue(chart: NatalChartData): string {
  const moon = knownFallbackSign(serializePosition(chart, 'moon').sign);
  return moon && DAILY_MOON_DONT[moon] ? `${moon}: ${DAILY_MOON_DONT[moon]}` : 'Не идти против себя';
}

function withPersonalFirstItem(items: string[], personalItem: string): string[] {
  const unique = new Set<string>();
  return [personalItem, ...items]
    .map(cleanLine)
    .filter((item) => {
      if (!item || unique.has(item)) return false;
      unique.add(item);
      return true;
    })
    .slice(0, 3);
}

export function buildHumanDailyFallback(
  profile: UserProfile,
  chart: NatalChartData,
  key: HumanDailySectionKey,
  dateKey: string
): InterpretationSection {
  const meta = HUMAN_DAILY_SECTION_META[key];
  const seed = dailyFallbackSeed(profile, chart);
  const baseContent = pickVariant(DAILY_FALLBACK_VARIANTS[key], dateKey, `${key}|${seed}`);
  const content = key === 'daily_overview'
    ? `${dailyFallbackPersonalLead(profile, chart)}\n\n${baseContent}`
    : baseContent;
  const bulletVariants = DAILY_FALLBACK_BULLETS[key] || DAILY_FALLBACK_BULLETS_DEFAULT;
  const bullets = pickVariant(bulletVariants, dateKey, `${key}.bullets|${seed}`);

  return {
    key,
    title: meta.title,
    subtitle: meta.subtitle,
    access: 'premium',
    isLocked: false,
    teaser: meta.teaser,
    content,
    bullets,
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
        // Дешёвая модель (fast-тир, gpt-5.4-mini): экономим бюджет. Качество держим за счёт
        // жёсткого промпта и короткого формата.
        user: prompt,
        model: { accessTier: 'free', contentSurface: 'natal', contentVariant: 'brief' },
        maxTokens: 1500,
        temperature: 0.6,
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
  const focus = PAID_SECTION_FOCUS[key];
  const prompt = key === 'shadow_patterns'
    ? buildBlindSpotPrompt({ context: summary, focus })
    : buildNatalSectionPrompt({
        title: meta.title,
        context: summary,
        focus: `${focus} ${getWordRangeInstruction('natal_section')}`,
      });

  return generateWithRetry<InterpretationSection>(
    async () => {
      const raw = await llmJson<{ title?: string; text?: string; soft_warning?: string; practical_hint?: string; headline?: string; example?: string; soft_step?: string }>({
        system: prompt.system,
        user: prompt.user,
        model: { accessTier: 'premium', contentSurface: 'natal', contentVariant: 'living' },
        maxTokens: 900,
        temperature: 0.6,
      });
      const section: InterpretationSection = {
        ...fallback,
        title: raw.title || raw.headline || meta.title,
        content: raw.text || fallback.content,
        bullets: [raw.soft_warning, raw.example, raw.practical_hint, raw.soft_step].filter((item): item is string => Boolean(item)),
        access: 'paid',
        isLocked: false,
      };
      return normalizeSection(section, fallback, { access: 'paid', locked: false });
    },
    (section) => validateSection(section, 360),
    fallback
  );
}

async function generateDailySectionWithPrompt(
  profile: UserProfile,
  chart: NatalChartData,
  key: HumanDailySectionKey,
  dateKey: string,
  buildPrompt: DailyPromptBuilder
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
  const prompt = buildPrompt(summary, meta, key, dateKey, transitData);

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

export async function generateDailyLoveSection(
  profile: UserProfile,
  chart: NatalChartData,
  dateKey: string
): Promise<InterpretationSection> {
  return generateDailySectionWithPrompt(profile, chart, 'daily_love', dateKey, buildDailyLovePrompt);
}

export async function generateDailyMoneySection(
  profile: UserProfile,
  chart: NatalChartData,
  dateKey: string
): Promise<InterpretationSection> {
  return generateDailySectionWithPrompt(profile, chart, 'daily_money', dateKey, buildDailyMoneyPrompt);
}

export async function generateDailyWorkSection(
  profile: UserProfile,
  chart: NatalChartData,
  dateKey: string
): Promise<InterpretationSection> {
  return generateDailySectionWithPrompt(profile, chart, 'daily_work_business', dateKey, buildDailyWorkPrompt);
}

export async function generateDailyGoalsSection(
  profile: UserProfile,
  chart: NatalChartData,
  dateKey: string
): Promise<InterpretationSection> {
  return generateDailySectionWithPrompt(profile, chart, 'daily_goals', dateKey, buildDailyGoalsPrompt);
}

export async function generateHumanDailySection(
  profile: UserProfile,
  chart: NatalChartData,
  key: HumanDailySectionKey,
  dateKey: string
): Promise<InterpretationSection> {
  switch (key) {
    case 'daily_love':
      return generateDailyLoveSection(profile, chart, dateKey);
    case 'daily_money':
      return generateDailyMoneySection(profile, chart, dateKey);
    case 'daily_work_business':
      return generateDailyWorkSection(profile, chart, dateKey);
    case 'daily_goals':
      return generateDailyGoalsSection(profile, chart, dateKey);
    default:
      return generateDailySectionWithPrompt(profile, chart, key, dateKey, buildDailyPrompt);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// ЕДИНОЕ ДНЕВНОЕ ПОЛОТНО (canvas)
// Весь личный разбор дня одним запросом: модель видит день целиком (блоки связны),
// получает УЖЕ ПОСЧИТАННЫЕ транзит→натал аспекты + оценку дня из того же движка, что
// и «оценка дня». Эндпоинт режет полотно на секции под текущий контракт фронта.
// ──────────────────────────────────────────────────────────────────────────

type TransitsSnapshot = Awaited<ReturnType<typeof getCurrentTransits>>;

const LAYER_RU: Record<string, string> = {
  energy: 'энергия',
  focus: 'фокус',
  emotions: 'эмоции',
  money: 'деньги',
  relationships: 'отношения',
};

const CANVAS_SECTION_TO_DAILY_KEY: Record<DailyCanvasSectionKey, HumanDailySectionKey> = {
  overview: 'daily_overview',
  love: 'daily_love',
  money: 'daily_money',
  work: 'daily_work_business',
  goals: 'daily_goals',
  family: 'daily_family',
  friendship: 'daily_friendship',
  energy: 'daily_energy',
  communication: 'daily_communication',
};

const SCORE_LAYER_TO_FREE_SECTION: Partial<Record<string, DailyCanvasFreeSectionKey>> = {
  relationships: 'love',
  money: 'money',
  focus: 'work',
  energy: 'energy',
  emotions: 'communication',
};

function chooseFreeSectionKey(
  profile: UserProfile,
  chart: NatalChartData,
  dateKey: string,
  dominantLayer?: string | null,
): DailyCanvasFreeSectionKey {
  const mapped = dominantLayer ? SCORE_LAYER_TO_FREE_SECTION[dominantLayer] : null;
  if (mapped) return mapped;
  return pickVariant(
    [...DAILY_CANVAS_FREE_SECTION_KEYS],
    dateKey,
    `free-section|${dailyFallbackSeed(profile, chart)}`,
  );
}

function compactTransits(transits: TransitsSnapshot) {
  const one = (t?: { sign?: string; degree?: number } | null) =>
    t ? `${ruSign(t.sign)} ${Math.round(Number(t.degree) || 0)}°` : null;
  return {
    Солнце: one(transits.sun),
    Луна: one(transits.moon),
    Меркурий: one(transits.mercury),
    Венера: one(transits.venus),
    Марс: one(transits.mars),
    Юпитер: one(transits.jupiter),
    Сатурн: one(transits.saturn),
    фазаЛуны: transits.moonPhase || null,
  };
}

function buildDailyCanvasPrompt(
  summary: ChartSummary,
  dateKey: string,
  transitPositions: unknown,
  aspectLines: string[],
  score: { value: number; dominant: string; weakest: string } | null,
  freeSectionKey: DailyCanvasFreeSectionKey,
): string {
  const aspectsBlock = aspectLines.length
    ? aspectLines.map((line) => `- ${line}`).join('\n')
    : '- Точных аспектов транзитов к натальным планетам сегодня в пределах орбов нет — опирайся на позиции транзитов и натальную карту.';
  const scoreBlock = score
    ? `ОЦЕНКА ДНЯ: ${score.value}/100. Сильнее всего сегодня — ${score.dominant}; слабее — ${score.weakest}.`
    : 'ОЦЕНКА ДНЯ: недоступна — не называй конкретное число, dayScoreExplain оставь пустым.';

  return `Собери ЕДИНЫЙ персональный разбор дня по натальной карте и реальным транзитам. Это один связный день целиком, а не набор независимых кусков: блоки не должны противоречить друг другу (общий тон, карточка, summary и секции согласованы между собой).

Дата: ${dateKey}

НАТАЛЬНАЯ КАРТА (расчёт Swiss Ephemeris):
${JSON.stringify(summary, null, 2)}

ПОЗИЦИИ ТРАНЗИТОВ НА СЕГОДНЯ (Swiss Ephemeris):
${JSON.stringify(transitPositions || {}, null, 2)}

ПОСЧИТАННЫЕ ВЗАИМОДЕЙСТВИЯ ДНЯ (транзит→натал; УЖЕ вычислено — опирайся именно на это, не пересчитывай и не выдумывай другие):
${aspectsBlock}

${scoreBlock}

Опирайся СТРОГО на переданные данные: натальную карту, посчитанные аспекты и позиции транзитов. НЕ придумывай положения планет, аспекты и фазы Луны. Точность — из расчёта, живость — из тебя. Пиши через конкретные сегодняшние ситуации (разговор, задача, покупка, договорённость, пауза). Не обещай событий, дохода, здоровья; без медицинских, юридических и финансовых гарантий.

Сервер уже выбрал вторую бесплатную тему: "${freeSectionKey}". Верни её же в meta.free_section_key.

Верни JSON строго такой структуры (без markdown вне JSON):
{
  "card": {
    "title": "короткий заголовок дня без штампов",
    "teaser": "2–3 предложения: что сегодня важно, без повтора overview",
    "positive_points": ["3 пункта по 2–6 слов: что сегодня в плюс"],
    "caution_points": ["3 пункта по 2–6 слов: где аккуратнее"]
  },
  "sections": [
    { "key": "overview", "title": "Главное на сегодня", "text": "90–130 слов: общий ход дня" },
    { "key": "love", "title": "Любовь и близость", "text": "70–110 слов" },
    { "key": "money", "title": "Деньги и покупки", "text": "70–110 слов" },
    { "key": "work", "title": "Работа и дела", "text": "70–110 слов" },
    { "key": "goals", "title": "Цели и решения", "text": "70–110 слов" },
    { "key": "family", "title": "Дом и семья", "text": "70–110 слов" },
    { "key": "friendship", "title": "Друзья и окружение", "text": "70–110 слов" },
    { "key": "energy", "title": "Нагрузка и восстановление", "text": "70–110 слов; без медицинских обещаний" },
    { "key": "communication", "title": "Общение и важные разговоры", "text": "70–110 слов" }
  ],
  "summary": {
    "main_risk": "один конкретный риск дня",
    "best_action": "одно конкретное действие дня",
    "day_score": ${score ? score.value : 'null'},
    "day_score_explain": "1–2 фразы: живая расшифровка оценки дня; если оценки нет — пустая строка"
  },
  "meta": {
    "free_section_key": "${freeSectionKey}"
  }
}

Пиши секции строго в указанном порядке. Не повторяй одну и ту же мысль между блоками. Общий русский результат по sections должен быть примерно 500–900 слов.`;
}

function canvasAllText(canvas: DailyCanvas): string {
  return [
    canvas.card.title,
    canvas.card.teaser,
    ...canvas.card.positive_points,
    ...canvas.card.caution_points,
    ...canvas.sections.map((section) => `${section.title}\n${section.text}`),
    canvas.summary.main_risk,
    canvas.summary.best_action,
    canvas.summary.day_score_explain,
  ]
    .map((v) => String(v || ''))
    .join('\n');
}

function normalizeCanvas(raw: Partial<DailyCanvas> | null | undefined, fallback: DailyCanvas): DailyCanvas {
  const r = raw && typeof raw === 'object' ? raw : {};
  const rawCard = r.card && typeof r.card === 'object' ? r.card as Partial<DailyCanvas['card']> : {};
  const rawSummary = r.summary && typeof r.summary === 'object' ? r.summary as Partial<DailyCanvas['summary']> : {};
  const rawSections = Array.isArray(r.sections) ? r.sections as Array<Partial<DailyCanvas['sections'][number]>> : [];
  const sectionByKey = new Map(rawSections.map((section) => [section.key, section]));
  const fallbackSectionByKey = new Map(fallback.sections.map((section) => [section.key, section]));
  const sections = DAILY_CANVAS_SECTION_KEYS.map((key) => {
    const rawSection = sectionByKey.get(key) || {};
    const fallbackSection = fallbackSectionByKey.get(key)!;
    return {
      key,
      title: cleanLine(rawSection.title) || fallbackSection.title,
      text: cleanText(rawSection.text) || fallbackSection.text,
    };
  });
  const rawFreeKey = r.meta?.free_section_key;
  const freeSectionKey = DAILY_CANVAS_FREE_SECTION_KEYS.includes(rawFreeKey as DailyCanvasFreeSectionKey)
    ? rawFreeKey as DailyCanvasFreeSectionKey
    : fallback.meta.free_section_key;
  return {
    card: {
      title: cleanLine(rawCard.title) || fallback.card.title,
      teaser: cleanText(rawCard.teaser) || fallback.card.teaser,
      positive_points: normalizeBullets(rawCard.positive_points, fallback.card.positive_points).slice(0, 3),
      caution_points: normalizeBullets(rawCard.caution_points, fallback.card.caution_points).slice(0, 3),
    },
    sections,
    summary: {
      main_risk: cleanText(rawSummary.main_risk) || fallback.summary.main_risk,
      best_action: cleanText(rawSummary.best_action) || fallback.summary.best_action,
      day_score: fallback.summary.day_score ?? null,
      day_score_explain: cleanText(rawSummary.day_score_explain) || fallback.summary.day_score_explain,
    },
    meta: {
      free_section_key: freeSectionKey,
    },
  };
}

function validateCanvas(canvas: DailyCanvas): boolean {
  if (!cleanLine(canvas.card.title) || cleanText(canvas.card.teaser).length < 40) return false;
  if (normalizeBullets(canvas.card.positive_points).length < 3) return false;
  if (normalizeBullets(canvas.card.caution_points).length < 3) return false;
  if (!DAILY_CANVAS_FREE_SECTION_KEYS.includes(canvas.meta.free_section_key)) return false;
  const byKey = new Map(canvas.sections.map((section) => [section.key, section]));
  for (const key of DAILY_CANVAS_SECTION_KEYS) {
    const section = byKey.get(key);
    if (!section || cleanText(section.text).length < (key === 'overview' ? 120 : 80)) return false;
  }
  if (!cleanText(canvas.summary.main_risk) || !cleanText(canvas.summary.best_action)) return false;
  if (hasBadText(canvasAllText(canvas))) return false;
  return true;
}

export function buildDailyCanvasFallback(
  profile: UserProfile,
  chart: NatalChartData,
  dateKey: string,
  score?: number | null,
  freeSectionKey?: DailyCanvasFreeSectionKey,
): DailyCanvas {
  const selectedFreeSection = freeSectionKey || chooseFreeSectionKey(profile, chart, dateKey);
  const rawSections = DAILY_CANVAS_SECTION_KEYS.map((key) => {
    const sectionKey = CANVAS_SECTION_TO_DAILY_KEY[key];
    const fallbackSection = buildHumanDailyFallback(profile, chart, sectionKey, dateKey);
    return {
      key,
      title: HUMAN_DAILY_SECTION_META[sectionKey].title,
      text: fallbackSection.content,
    };
  });
  const doVariants: string[][] = [
    ['Довести одно до конца', 'Сказать прямо и вовремя', 'Дать себе паузу'],
    ['Закрыть то, что висит', 'Начать с малого', 'Ответить по делу, без воды'],
    ['Выбрать главное с утра', 'Спросить, а не додумывать', 'Выдохнуть между делами'],
  ];
  const dontVariants: string[][] = [
    ['Не хвататься за всё сразу', 'Не решать сгоряча', 'Не копить недосказанность'],
    ['Не бежать наперегонки с собой', 'Не молчать из обиды', 'Не покупать на эмоции'],
    ['Не брать чужое «срочно»', 'Не проверять молчанием', 'Не подписывать на горячую голову'],
  ];
  const seed = dailyFallbackSeed(profile, chart);
  const doItems = pickVariant(doVariants, dateKey, `do|${seed}`);
  const dontItems = pickVariant(dontVariants, dateKey, `dont|${seed}`);
  // Расшифровка оценки — тоже в голосе и с вариантами по числу и по дате.
  const explainFor = (s: number): string[] => {
    if (s >= 70) return [
      `${s} — крепкий день. Дела и разговоры идут, можно спокойно браться за важное. С деньгами только не гони.`,
      `${s} — хороший фон. Сегодня многое даётся легче обычного; используй это на то, что давно откладывал.`,
    ];
    if (s >= 45) return [
      `${s} — ровный рабочий день. Ничего героического, но всё по силам, если не распыляться на десять дел разом.`,
      `${s} — обычный день без сюрпризов. Держись одного главного, и к вечеру будешь доволен.`,
    ];
    return [
      `${s} — день просит бережности, а не подвигов. Сбавь темп, сделай одно важное и не грузи себя лишним.`,
      `${s} — фон низковат, и это нормально. Не требуй от себя многого сегодня; сделай минимум важного и дай себе отдохнуть.`,
    ];
  };
  const positivePoints = withPersonalFirstItem(doItems, dailyDoCue(chart)).slice(0, 3);
  const cautionPoints = withPersonalFirstItem(dontItems, dailyDontCue(chart)).slice(0, 3);
  const overview = rawSections.find((section) => section.key === 'overview')!;
  return {
    card: {
      title: 'Главное на сегодня',
      teaser: `${profile.name ? `${profile.name}, ` : ''}день лучше держать в руках: выбери главное, не раздавай внимание всем подряд и оставь место для спокойного решения.`,
      positive_points: positivePoints,
      caution_points: cautionPoints,
    },
    sections: rawSections,
    summary: {
      main_risk: cautionPoints[0] || 'Расфокус и лишняя спешка',
      best_action: positivePoints[0] || 'Довести одно до конца',
      day_score: score ?? null,
      day_score_explain: score != null ? pickVariant(explainFor(score), dateKey, `score|${seed}`) : '',
    },
    meta: {
      free_section_key: selectedFreeSection,
    },
  };
}

/**
 * Генерит ВСЁ дневное полотно одним запросом: транзиты → посчитанные аспекты + оценка
 * дня (из todayPulse) → промпт → JSON. При сбое/невалидности — человеко-написанный
 * fallback-полотно. Число оценки берётся из расчёта, а не из модели.
 */
export async function generateDailyCanvas(
  profile: UserProfile,
  chart: NatalChartData,
  dateKey: string,
): Promise<DailyCanvas> {
  let transits: TransitsSnapshot | null = null;
  try {
    transits = await getCurrentTransits(new Date(`${dateKey}T09:00:00.000Z`));
  } catch {
    transits = null;
  }

  let aspectLines: string[] = [];
  let scoreForPrompt: { value: number; dominant: string; weakest: string } | null = null;
  let scoreNum: number | null = null;
  let dominantLayer: string | null = null;
  if (transits) {
    aspectLines = formatTransitAspectsRu(detectTransitAspects(chart, transits, { limit: 10 }));
    try {
      const s = computeDayScoreFromTransits(chart, transits, 12, dateKey);
      scoreNum = s.score;
      dominantLayer = s.dominant;
      scoreForPrompt = {
        value: s.score,
        dominant: LAYER_RU[s.dominant] || s.dominant,
        weakest: LAYER_RU[s.weakest] || s.weakest,
      };
    } catch {
      scoreForPrompt = null;
    }
  }

  const freeSectionKey = chooseFreeSectionKey(profile, chart, dateKey, dominantLayer);
  const fallback = buildDailyCanvasFallback(profile, chart, dateKey, scoreNum, freeSectionKey);
  const summary = buildChartSummary(profile, chart);
  const compact = transits ? compactTransits(transits) : null;
  const prompt = buildDailyCanvasPrompt(summary, dateKey, compact, aspectLines, scoreForPrompt, freeSectionKey);

  const canvas = await generateWithRetry<DailyCanvas>(
    async () => {
      const raw = await llmJson<Partial<DailyCanvas>>({
        system: HUMAN_SYSTEM_PROMPT,
        user: prompt,
        model: { accessTier: 'premium', contentSurface: 'natal', contentVariant: 'living' },
        // Полотно — длинный связный текст: отдельный слот модели (app_settings → env → дефолт).
        // Настраивается в админке (слот daily_canvas) или через OPENAI_DAILY_CANVAS_MODEL.
        modelOverride: await getDailyCanvasModelResolved(),
        maxTokens: 3200,
        temperature: 0.6,
      });
      return normalizeCanvas(raw, fallback);
    },
    validateCanvas,
    fallback,
  );

  // Число оценки и free-section — из расчёта/серверного выбора, не из модели.
  canvas.summary.day_score = scoreNum;
  canvas.meta.free_section_key = freeSectionKey;
  return canvas;
}

/**
 * Режет новое полотно на секцию под существующий посекционный контракт фронта.
 * Backend отдаёт только overview и выбранную free-section для free-пользователя.
 */
export function sliceCanvasToSection(
  canvas: DailyCanvas,
  sectionKey: HumanDailySectionKey,
): InterpretationSection | null {
  const canvasKey = DAILY_SECTION_TO_CANVAS_KEY[sectionKey];
  if (!canvasKey) return null;
  const meta = HUMAN_DAILY_SECTION_META[sectionKey];
  const section = canvas.sections.find((item) => item.key === canvasKey);
  if (!section) return null;
  const isOverview = canvasKey === 'overview';
  const isFreeExtra = canvas.meta.free_section_key === canvasKey;
  return {
    key: sectionKey,
    title: section.title || meta.title,
    subtitle: meta.subtitle,
    access: isOverview || isFreeExtra ? 'free' : 'premium',
    isLocked: false,
    teaser: meta.teaser,
    content: cleanText(section.text),
    bullets: [],
    ctaLabel: '',
    // Карточка/summary живут на обзоре дня. Остальные секции получают только свой текст.
    ...(isOverview
      ? {
          dayDo: (canvas.card.positive_points || []).slice(0, 3),
          dayDont: (canvas.card.caution_points || []).slice(0, 3),
          dayScore: canvas.summary.day_score ?? null,
          dayScoreExplain: cleanText(canvas.summary.day_score_explain),
          bullets: [
            cleanText(canvas.summary.best_action),
            cleanText(canvas.summary.main_risk),
          ].filter(Boolean),
        }
      : {}),
  };
}
