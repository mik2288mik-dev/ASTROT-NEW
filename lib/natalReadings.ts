import type {
  AstroEvidenceItem,
  NatalAnchorReading,
  NatalChartData,
  NatalDictionaryTerm,
  NatalFullReading,
  NatalLivingReading,
  NatalReadingPoint,
  PlanetPosition,
} from '../types';
import type { CurrentTransits, PlanetTransit } from './transits-calculator';
import { getMoscowTodayKey } from './date-utils';
import { ZODIAC_SIGNS, type ZodiacSign } from './zodiac-utils';

export const NATAL_ANCHOR_PROMPT_VERSION = 'natal_anchor.editorial_v3';
export const NATAL_FULL_PROMPT_VERSION = 'natal_full.editorial_v3';
export const NATAL_LIVING_PROMPT_VERSION = 'natal_daily.editorial_v3';

export const NATAL_ANCHOR_CACHE_KEY = 'base';
export const NATAL_FULL_CACHE_KEY = 'personality';

export const NATAL_CONTENT_ACTIVE_PROMPT_VERSIONS = [
  NATAL_ANCHOR_PROMPT_VERSION,
  NATAL_FULL_PROMPT_VERSION,
  NATAL_LIVING_PROMPT_VERSION,
] as const;

export const NATAL_BANNED_PHRASES = [
  'день просит',
  'внутренняя точность',
  'чужой шум',
  'выбрать из ясности',
  'пространство',
  'слой',
  'премиум',
  'судьба',
  'магия',
];

const SIGN_LABELS_RU: Record<string, string> = {
  Aries: 'Овне',
  Taurus: 'Тельце',
  Gemini: 'Близнецах',
  Cancer: 'Раке',
  Leo: 'Льве',
  Virgo: 'Деве',
  Libra: 'Весах',
  Scorpio: 'Скорпионе',
  Sagittarius: 'Стрельце',
  Capricorn: 'Козероге',
  Aquarius: 'Водолее',
  Pisces: 'Рыбах',
};

const SIGN_NOMINATIVE_RU: Record<string, string> = {
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
};

const PLANET_LABELS: Record<string, { ru: string; en: string }> = {
  sun: { ru: 'Солнце', en: 'Sun' },
  moon: { ru: 'Луна', en: 'Moon' },
  rising: { ru: 'Асцендент', en: 'Rising' },
  asc: { ru: 'Асцендент', en: 'Rising' },
  ascendant: { ru: 'Асцендент', en: 'Rising' },
  mercury: { ru: 'Меркурий', en: 'Mercury' },
  venus: { ru: 'Венера', en: 'Venus' },
  mars: { ru: 'Марс', en: 'Mars' },
  jupiter: { ru: 'Юпитер', en: 'Jupiter' },
  saturn: { ru: 'Сатурн', en: 'Saturn' },
  uranus: { ru: 'Уран', en: 'Uranus' },
  neptune: { ru: 'Нептун', en: 'Neptune' },
  pluto: { ru: 'Плутон', en: 'Pluto' },
  chiron: { ru: 'Хирон', en: 'Chiron' },
};

const ASPECT_LABELS: Record<string, { ru: string; en: string }> = {
  conjunction: { ru: 'соединение', en: 'conjunction' },
  sextile: { ru: 'секстиль', en: 'sextile' },
  square: { ru: 'квадрат', en: 'square' },
  trine: { ru: 'трин', en: 'trine' },
  opposition: { ru: 'оппозиция', en: 'opposition' },
};

const HOUSE_THEMES_RU: Record<number, string> = {
  1: 'самоподача и первое движение',
  2: 'ценности, деньги и чувство опоры',
  3: 'разговоры, обучение и ближайшая среда',
  4: 'дом, семья и эмоциональная база',
  5: 'самовыражение, романтика и творчество',
  6: 'режим, работа и забота о теле',
  7: 'партнёрство и честный диалог',
  8: 'доверие, границы и общие ресурсы',
  9: 'взгляды, обучение и расширение опыта',
  10: 'карьера, статус и видимая роль',
  11: 'друзья, команды и будущие планы',
  12: 'тишина, восстановление и скрытые процессы',
};

const HOUSE_THEMES_EN: Record<number, string> = {
  1: 'identity and first movement',
  2: 'values, money, and inner support',
  3: 'communication, learning, and close environment',
  4: 'home, family, and emotional foundation',
  5: 'self-expression, romance, and creativity',
  6: 'routine, work, and care for the body',
  7: 'partnership and direct dialogue',
  8: 'trust, boundaries, and shared resources',
  9: 'beliefs, learning, and wider experience',
  10: 'career, status, and public role',
  11: 'friends, teams, and future plans',
  12: 'quiet, recovery, and hidden processes',
};

const PERSONAL_PLANETS = ['sun', 'moon', 'rising', 'mercury', 'venus', 'mars'] as const;
const DAILY_TRANSIT_KEYS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const;
const DAILY_TARGET_KEYS = ['sun', 'moon', 'rising', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const;
const MAJOR_ASPECTS = [
  { type: 'conjunction', angle: 0 },
  { type: 'sextile', angle: 60 },
  { type: 'square', angle: 90 },
  { type: 'trine', angle: 120 },
  { type: 'opposition', angle: 180 },
] as const;

export function buildNatalLivingCacheKey(periodKey: string) {
  return periodKey;
}

export function getCurrentNatalPeriodKey() {
  return getMoscowTodayKey();
}

function cleanLine(value: unknown, fallback: string) {
  const normalized = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

function cleanParagraphs(value: unknown, fallback: string) {
  const normalized = String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return normalized || fallback;
}

function splitParagraphs(value: unknown) {
  return String(value || '')
    .split(/\n\s*\n/)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function cleanPoints(value: unknown, fallbacks: NatalReadingPoint[], min = 1) {
  const items = Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item === 'string') {
            return { title: '', body: cleanLine(item, '') };
          }
          const raw = (item && typeof item === 'object' ? item : {}) as Partial<NatalReadingPoint>;
          return {
            title: cleanLine(raw.title, ''),
            body: cleanLine(raw.body, ''),
            evidenceIds: Array.isArray(raw.evidenceIds) ? raw.evidenceIds.map(String).filter(Boolean).slice(0, 4) : undefined,
          };
        })
        .filter((item) => item.title || item.body)
        .slice(0, fallbacks.length)
    : [];

  return items.length >= min ? items : fallbacks;
}

function cleanDictionary(value: unknown, fallbacks: NatalDictionaryTerm[]) {
  const items = Array.isArray(value)
    ? value
        .map((item) => {
          const raw = (item && typeof item === 'object' ? item : {}) as Partial<NatalDictionaryTerm>;
          return {
            term: cleanLine(raw.term, ''),
            meaning: cleanLine(raw.meaning, ''),
          };
        })
        .filter((item) => item.term && item.meaning)
        .slice(0, 8)
    : [];

  return items.length >= 5 ? items : fallbacks;
}

function normalizePlanetKey(value: string) {
  return String(value || '').toLowerCase().replace(/\s+/g, '').replace('ascendant', 'rising').replace('asc', 'rising');
}

function planetLabel(key: string, lang: 'ru' | 'en') {
  const normalized = normalizePlanetKey(key);
  return PLANET_LABELS[normalized]?.[lang] || key;
}

function normalizeSign(sign?: string | null): ZodiacSign | null {
  const raw = String(sign || '').trim();
  return (ZODIAC_SIGNS.find((item) => item.toLowerCase() === raw.toLowerCase()) || null) as ZodiacSign | null;
}

function signLabel(sign?: string | null, lang: 'ru' | 'en' = 'ru', nominative = false) {
  const normalized = normalizeSign(sign);
  if (!normalized) return sign || (lang === 'ru' ? 'неизвестном знаке' : 'unknown sign');
  if (lang === 'en') return normalized;
  return nominative ? SIGN_NOMINATIVE_RU[normalized] : SIGN_LABELS_RU[normalized];
}

function houseNumber(position?: PlanetPosition | null): number | null {
  const raw = position?.house;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const parsed = Number.parseInt(String(raw || ''), 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

function houseTheme(house: number | null | undefined, lang: 'ru' | 'en') {
  if (!house) return lang === 'ru' ? 'личные реакции' : 'personal reactions';
  return (lang === 'ru' ? HOUSE_THEMES_RU : HOUSE_THEMES_EN)[house] || (lang === 'ru' ? `${house} дом` : `house ${house}`);
}

function positionLongitude(position?: PlanetPosition | null): number | null {
  if (!position) return null;
  if (typeof position.longitude === 'number' && Number.isFinite(position.longitude)) {
    return normalizeDegree(position.longitude);
  }
  const sign = normalizeSign(position.sign);
  const degree = typeof position.degree === 'number' && Number.isFinite(position.degree) ? position.degree : null;
  if (!sign || degree == null) return null;
  return normalizeDegree(ZODIAC_SIGNS.indexOf(sign) * 30 + degree);
}

function transitLongitude(transit?: PlanetTransit | null): number | null {
  if (!transit) return null;
  const sign = normalizeSign(transit.sign);
  const degree = typeof transit.degree === 'number' && Number.isFinite(transit.degree) ? transit.degree : null;
  if (!sign || degree == null) return null;
  return normalizeDegree(ZODIAC_SIGNS.indexOf(sign) * 30 + degree);
}

function normalizeDegree(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function angularDistance(a: number, b: number) {
  const diff = Math.abs(normalizeDegree(a) - normalizeDegree(b));
  return diff > 180 ? 360 - diff : diff;
}

function closestMajorAspect(distance: number) {
  let best: { type: string; angle: number; orb: number } | null = null;
  for (const aspect of MAJOR_ASPECTS) {
    const orb = Math.abs(distance - aspect.angle);
    if (!best || orb < best.orb) best = { ...aspect, orb };
  }
  return best;
}

function formatOrb(orb?: number | null, lang: 'ru' | 'en' = 'ru') {
  if (orb == null || !Number.isFinite(orb)) return '';
  return `${orb.toFixed(1)}°${lang === 'ru' ? ' орб' : ' orb'}`;
}

function formatPlacement(key: string, position: PlanetPosition | null | undefined, lang: 'ru' | 'en') {
  const sign = signLabel(position?.sign, lang);
  const house = houseNumber(position);
  const degree = typeof position?.degree === 'number' ? `${Math.round(position.degree)}°` : '';
  const houseText = house ? (lang === 'ru' ? `${house} дом` : `house ${house}`) : '';
  return [planetLabel(key, lang), lang === 'ru' ? `в ${sign}` : `in ${sign}`, degree, houseText]
    .filter(Boolean)
    .join(' · ');
}

function getPlanet(chartData: NatalChartData, key: string): PlanetPosition | null | undefined {
  return (chartData as any)[key] as PlanetPosition | null | undefined;
}

function buildPlacementMeaning(key: string, position: PlanetPosition | null | undefined, lang: 'ru' | 'en') {
  const sign = signLabel(position?.sign, lang);
  const house = houseNumber(position);
  const theme = houseTheme(house, lang);
  const label = planetLabel(key, lang);

  if (lang === 'en') {
    return `${label} in ${sign}${house ? ` in house ${house}` : ''} links this part of the chart with ${theme}.`;
  }

  return `${label} в ${sign}${house ? ` в ${house} доме` : ''} связывает эту часть карты с темой: ${theme}.`;
}

function buildAspectMeaning(type: string, from: string, to: string, lang: 'ru' | 'en') {
  const fromLabel = planetLabel(from, lang);
  const toLabel = planetLabel(to, lang);
  const aspect = ASPECT_LABELS[type]?.[lang] || type;
  if (lang === 'en') {
    return `${fromLabel} and ${toLabel} are connected through a ${aspect}: this shows how two inner functions support or challenge each other.`;
  }
  return `${fromLabel} и ${toLabel} связаны через ${aspect}: это показывает, где две внутренние функции помогают друг другу или спорят.`;
}

function uniqueEvidence(items: AstroEvidenceItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.id || `${item.type}:${item.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildNatalAstroEvidence(chartData: NatalChartData | null | undefined, lang: 'ru' | 'en' = 'ru'): AstroEvidenceItem[] {
  if (!chartData) return [];

  const evidence: AstroEvidenceItem[] = [];
  const sun = chartData.sun;
  const moon = chartData.moon;
  const rising = chartData.rising;

  if (sun && moon && rising) {
    evidence.push({
      id: 'signature:big-three',
      type: 'signature',
      label: lang === 'ru' ? 'Солнце, Луна и Асцендент' : 'Sun, Moon, and Rising',
      detail:
        lang === 'ru'
          ? `Солнце в ${signLabel(sun.sign, lang)}, Луна в ${signLabel(moon.sign, lang)}, Асцендент в ${signLabel(rising.sign, lang)}.`
          : `Sun in ${signLabel(sun.sign, lang)}, Moon in ${signLabel(moon.sign, lang)}, Rising in ${signLabel(rising.sign, lang)}.`,
      humanMeaning:
        lang === 'ru'
          ? 'Это связка характера, эмоциональной реакции и первого впечатления.'
          : 'This is the link between character, emotional response, and first impression.',
      priority: 120,
    });
  }

  PERSONAL_PLANETS.forEach((key, index) => {
    const position = getPlanet(chartData, key);
    if (!position?.sign) return;
    const house = houseNumber(position);
    evidence.push({
      id: `placement:${key}`,
      type: 'placement',
      label: formatPlacement(key, position, lang),
      detail: buildPlacementMeaning(key, position, lang),
      humanMeaning: house
        ? (lang === 'ru'
            ? `В жизни это чаще заметно через ${houseTheme(house, lang)}.`
            : `In life, this is often visible through ${houseTheme(house, lang)}.`)
        : undefined,
      priority: 110 - index * 4,
      planet: key,
      sign: position.sign,
      house,
    });
  });

  const aspects = Array.isArray(chartData.aspects) ? chartData.aspects : [];
  aspects
    .filter((aspect) => Number.isFinite(aspect.orb) && aspect.orb <= 6)
    .sort((a, b) => a.orb - b.orb)
    .slice(0, 5)
    .forEach((aspect, index) => {
      evidence.push({
        id: `aspect:${normalizePlanetKey(aspect.from)}:${aspect.type}:${normalizePlanetKey(aspect.to)}`,
        type: 'aspect',
        label:
          lang === 'ru'
            ? `${planetLabel(aspect.from, lang)} ${ASPECT_LABELS[aspect.type]?.[lang] || aspect.type} ${planetLabel(aspect.to, lang)}`
            : `${planetLabel(aspect.from, lang)} ${ASPECT_LABELS[aspect.type]?.[lang] || aspect.type} ${planetLabel(aspect.to, lang)}`,
        detail: `${buildAspectMeaning(aspect.type, aspect.from, aspect.to, lang)} ${formatOrb(aspect.orb, lang)}`.trim(),
        priority: 86 - index * 4,
        aspectType: aspect.type,
        orb: aspect.orb,
      });
    });

  return uniqueEvidence(evidence).sort((a, b) => (b.priority || 0) - (a.priority || 0));
}

export function buildDailyAstroEvidence(
  chartData: NatalChartData | null | undefined,
  transits: CurrentTransits | null | undefined,
  lang: 'ru' | 'en' = 'ru'
): AstroEvidenceItem[] {
  if (!chartData || !transits) return buildNatalAstroEvidence(chartData, lang).slice(0, 4);

  const evidence: AstroEvidenceItem[] = [];
  const natalLongitudes = new Map<string, { position: PlanetPosition; longitude: number }>();

  DAILY_TARGET_KEYS.forEach((key) => {
    const position = getPlanet(chartData, key);
    const longitude = positionLongitude(position);
    if (position && longitude != null) natalLongitudes.set(key, { position, longitude });
  });

  DAILY_TRANSIT_KEYS.forEach((transitKey) => {
    const transit = (transits as any)[transitKey] as PlanetTransit | undefined;
    const transitLon = transitLongitude(transit);
    if (!transit || transitLon == null) return;

    natalLongitudes.forEach(({ position, longitude }, natalKey) => {
      const distance = angularDistance(transitLon, longitude);
      const aspect = closestMajorAspect(distance);
      if (!aspect) return;

      const maxOrb = transitKey === 'moon' ? 4 : transitKey === 'sun' || transitKey === 'mercury' ? 3 : 2.5;
      if (aspect.orb > maxOrb) return;

      const natalHouse = houseNumber(position);
      evidence.push({
        id: `transit:${transitKey}:${aspect.type}:${natalKey}`,
        type: 'transit',
        label:
          lang === 'ru'
            ? `${planetLabel(transitKey, lang)} сейчас: ${ASPECT_LABELS[aspect.type]?.[lang] || aspect.type} к ${planetLabel(natalKey, lang)}`
            : `Transiting ${planetLabel(transitKey, lang)} ${ASPECT_LABELS[aspect.type]?.[lang] || aspect.type} natal ${planetLabel(natalKey, lang)}`,
        detail:
          lang === 'ru'
            ? `${planetLabel(transitKey, lang)} в ${signLabel(transit.sign, lang)} формирует ${ASPECT_LABELS[aspect.type]?.[lang] || aspect.type} к ${formatPlacement(natalKey, position, lang)} (${formatOrb(aspect.orb, lang)}).`
            : `${planetLabel(transitKey, lang)} in ${signLabel(transit.sign, lang)} forms a ${ASPECT_LABELS[aspect.type]?.[lang] || aspect.type} to ${formatPlacement(natalKey, position, lang)} (${formatOrb(aspect.orb, lang)}).`,
        humanMeaning:
          lang === 'ru'
            ? `На практике это чаще касается темы: ${houseTheme(natalHouse, lang)}.`
            : `In practice, this most often touches ${houseTheme(natalHouse, lang)}.`,
        priority: 120 - aspect.orb * 10 - (transitKey === 'moon' ? 8 : 0),
        planet: natalKey,
        sign: position.sign,
        house: natalHouse,
        aspectType: aspect.type,
        orb: aspect.orb,
      });
    });
  });

  if (evidence.length < 2) {
    const sun = transits.sun;
    const moon = transits.moon;
    if (sun) {
      evidence.push({
        id: 'transit:sun:sign',
        type: 'transit',
        label: lang === 'ru' ? `Солнце сейчас в ${signLabel(sun.sign, lang)}` : `Sun currently in ${sun.sign}`,
        detail:
          lang === 'ru'
            ? `Солнце сейчас идёт по ${signLabel(sun.sign, lang)}: дневной фокус окрашен темами этого знака.`
            : `The Sun is currently in ${sun.sign}: the day's focus is colored by this sign.`,
        priority: 70,
      });
    }
    if (moon) {
      evidence.push({
        id: 'transit:moon:sign',
        type: 'transit',
        label: lang === 'ru' ? `Луна сейчас в ${signLabel(moon.sign, lang)}` : `Moon currently in ${moon.sign}`,
        detail:
          lang === 'ru'
            ? `Луна сейчас в ${signLabel(moon.sign, lang)}: это меняет эмоциональный темп дня.`
            : `The Moon is currently in ${moon.sign}: this changes the emotional tempo of the day.`,
        priority: 68,
      });
    }
  }

  return uniqueEvidence([...evidence, ...buildNatalAstroEvidence(chartData, lang).slice(0, 3)])
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    .slice(0, 5);
}

export function containsNatalBannedPhrase(content: unknown) {
  const haystack = JSON.stringify(content || '').toLowerCase();
  return NATAL_BANNED_PHRASES.some((phrase) => haystack.includes(phrase.toLowerCase()));
}

function evidenceText(evidence: AstroEvidenceItem[], fallback: string) {
  return evidence[0]?.detail || evidence[0]?.label || fallback;
}

function anchorFallbackRu(chartData?: NatalChartData | null): NatalAnchorReading {
  const evidence = buildNatalAstroEvidence(chartData, 'ru');
  const sun = chartData?.sun;
  const moon = chartData?.moon;
  const rising = chartData?.rising;
  const mercury = chartData?.mercury;
  const venus = chartData?.venus;
  const mars = chartData?.mars;
  const aspect = evidence.find((item) => item.type === 'aspect');
  const signature = sun && moon && rising
    ? `Солнце в ${signLabel(sun.sign, 'ru')}, Луна в ${signLabel(moon.sign, 'ru')} и Асцендент в ${signLabel(rising.sign, 'ru')}`
    : 'главные точки карты';

  const portrait = [
    `${signature} дают карте понятный каркас: характер реагирует через ${sun ? signLabel(sun.sign, 'ru') : 'знак Солнца'}, эмоции быстрее включаются через ${moon ? signLabel(moon.sign, 'ru') : 'Луну'}, а первое впечатление окрашено Асцендентом. Это не набор ярлыков, а три разные функции: как ты действуешь, что переживаешь внутри и как входишь в контакт.`,
    mercury
      ? `Меркурий в ${signLabel(mercury.sign, 'ru')}${houseNumber(mercury) ? ` в ${houseNumber(mercury)} доме` : ''} показывает, как ты собираешь мысли и объясняешь себя. В обычной ситуации это может быть заметно в том, как ты выбираешь слова: не просто отвечаешь, а стараешься уловить устройство разговора.`
      : `По личным планетам карта показывает, что решения лучше понимать через конкретные реакции: что быстро цепляет внимание, где появляется напряжение и где становится проще говорить прямо.`,
    venus || mars
      ? `Венера${venus ? ` в ${signLabel(venus.sign, 'ru')}` : ''} и Марс${mars ? ` в ${signLabel(mars.sign, 'ru')}` : ''} описывают, как ты сближаешься и как действуешь. Здесь важны не красивые обещания, а реальный темп: когда можно идти навстречу, а когда телу и психике нужно больше времени.`
      : `В отношениях и делах лучше работает не давление на себя, а наблюдение за собственным темпом: где включается интерес, где появляется сопротивление и где нужно больше ясности.`,
    aspect
      ? `${aspect.detail} В жизни это может проявляться как повторяющийся внутренний диалог: одна часть хочет быстрее решить вопрос, другая проверяет, безопасно ли вообще туда входить.`
      : `Если карта кажется противоречивой, это нормально: разные части личности могут включаться в разное время. Важно смотреть не на один знак, а на то, как они работают вместе.`,
  ].join('\n\n');

  return {
    headline: 'Твой портрет по карте',
    summary: `${signature}. Это первый ясный разбор характера, эмоционального ритма и того, как тебя обычно считывают люди.`,
    portrait,
    reading: portrait,
    threeAnchors: [
      {
        title: 'Солнце',
        body: sun
          ? `Солнце в ${signLabel(sun.sign, 'ru')}${houseNumber(sun) ? ` в ${houseNumber(sun)} доме` : ''}: характер раскрывается через ${houseTheme(houseNumber(sun), 'ru')}.`
          : 'Солнце показывает характер, волю и то, через что человек чувствует себя живым.',
        evidenceIds: ['placement:sun'],
      },
      {
        title: 'Луна',
        body: moon
          ? `Луна в ${signLabel(moon.sign, 'ru')}${houseNumber(moon) ? ` в ${houseNumber(moon)} доме` : ''}: эмоции и привычные реакции связаны с темой ${houseTheme(houseNumber(moon), 'ru')}.`
          : 'Луна показывает эмоциональный темп: что быстро задевает, что успокаивает и как возвращается чувство безопасности.',
        evidenceIds: ['placement:moon'],
      },
      {
        title: 'Асцендент',
        body: rising
          ? `Асцендент в ${signLabel(rising.sign, 'ru')}: первое впечатление может быть сильнее и собраннее, чем то, что происходит внутри.`
          : 'Асцендент показывает первое впечатление и способ входить в новые ситуации.',
        evidenceIds: ['placement:rising'],
      },
    ],
    perceivedByOthers: rising
      ? `Люди часто сначала видят твой Асцендент в ${signLabel(rising.sign, 'ru')}: манеру держаться, смотреть, отвечать, выдерживать паузу. Из-за этого тебя могут считывать более собранным или закрытым человеком, чем ты ощущаешь себя внутри.`
      : 'Первое впечатление может отличаться от внутреннего состояния: снаружи человек видит манеру держаться, а не всю глубину реакции.',
    strengths: [
      {
        title: 'Ты замечаешь нюансы раньше слов',
        body: moon
          ? `Луна в ${signLabel(moon.sign, 'ru')} делает реакцию тонкой: ты часто понимаешь настроение разговора до того, как его проговорили.`
          : 'Эмоциональная часть карты помогает быстро замечать, где разговор живой, а где человек говорит не всё.',
        evidenceIds: ['placement:moon'],
      },
      {
        title: 'Ты можешь выдерживать сложные состояния',
        body: rising
          ? `Асцендент в ${signLabel(rising.sign, 'ru')} добавляет собранность: в напряжённый момент ты не всегда показываешь, насколько многое происходит внутри.`
          : 'В напряжённые моменты карта показывает способность собираться и не отдавать реакцию первому импульсу.',
        evidenceIds: ['placement:rising'],
      },
      {
        title: 'Ты лучше действуешь, когда понимаешь смысл',
        body: sun
          ? `Солнце в ${signLabel(sun.sign, 'ru')} связывает энергию с внутренним согласием: пустая активность быстрее забирает силы, чем дело, где понятно зачем.`
          : 'Энергия сильнее держится там, где есть понятная причина продолжать.',
        evidenceIds: ['placement:sun'],
      },
    ],
    watchouts: [
      {
        title: 'Не бери на себя всё, что почувствовал',
        body: moon
          ? `Луна в ${signLabel(moon.sign, 'ru')} может быстро откликаться на состояние других. Полезно отделять свою реакцию от чужого напряжения.`
          : 'Сильная чувствительность не означает, что каждую чужую эмоцию нужно разбирать как свою.',
        evidenceIds: ['placement:moon'],
      },
      {
        title: 'Не соглашайся раньше, чем понял своё отношение',
        body: venus
          ? `Венера в ${signLabel(venus.sign, 'ru')} может искать мягкий контакт, но согласие из вежливости потом создаёт внутреннюю тяжесть.`
          : 'Если ответ нужен быстро, стоит хотя бы коротко проверить, правда ли ты хочешь соглашаться.',
        evidenceIds: ['placement:venus'],
      },
      {
        title: 'Не путай паузу с отказом от действия',
        body: mars
          ? `Марс в ${signLabel(mars.sign, 'ru')} показывает, что действие набирает силу, когда темп не навязан извне.`
          : 'Иногда пауза нужна не для избегания, а чтобы действие стало точнее.',
        evidenceIds: ['placement:mars'],
      },
    ],
    dictionaryTerms: [
      { term: 'Солнце', meaning: 'характер, воля и то, через что человек чувствует себя живым' },
      { term: 'Луна', meaning: 'эмоциональная реакция, привычки и то, что даёт чувство безопасности' },
      { term: 'Асцендент', meaning: 'первое впечатление и способ входить в новые ситуации' },
      { term: 'Дом', meaning: 'сфера жизни, где проявляется планета: отношения, работа, дом, деньги, тело' },
      { term: 'Аспект', meaning: 'связь между двумя планетами: где функции помогают друг другу или создают напряжение' },
      { term: 'Транзит', meaning: 'текущее положение планет и его связь с твоей натальной картой' },
    ],
    astroEvidence: evidence,
  };
}

function anchorFallbackEn(chartData?: NatalChartData | null): NatalAnchorReading {
  const evidence = buildNatalAstroEvidence(chartData, 'en');
  const sun = chartData?.sun;
  const moon = chartData?.moon;
  const rising = chartData?.rising;
  const signature = sun && moon && rising
    ? `Sun in ${signLabel(sun.sign, 'en')}, Moon in ${signLabel(moon.sign, 'en')}, Rising in ${signLabel(rising.sign, 'en')}`
    : 'the main points of the chart';
  const portrait = `${signature} gives the chart its first structure: character, emotional response, and first impression. The reading is not based on labels, but on how these functions work together in real situations.\n\n${evidenceText(evidence, 'The strongest placements show how you react, choose, and enter contact.')}`;

  return {
    headline: 'Your chart portrait',
    summary: `${signature}. A clear first reading of character, emotional rhythm, and how others tend to read you.`,
    portrait,
    reading: portrait,
    threeAnchors: [
      { title: 'Sun', body: buildPlacementMeaning('sun', sun, 'en'), evidenceIds: ['placement:sun'] },
      { title: 'Moon', body: buildPlacementMeaning('moon', moon, 'en'), evidenceIds: ['placement:moon'] },
      { title: 'Rising', body: buildPlacementMeaning('rising', rising, 'en'), evidenceIds: ['placement:rising'] },
    ],
    perceivedByOthers: rising
      ? `People often meet your Rising in ${signLabel(rising.sign, 'en')} first: your posture, rhythm, and way of entering contact. That first impression may be more contained than what happens inside.`
      : 'First impression does not always reveal the inner state.',
    strengths: [
      { title: 'You notice nuance early', body: 'Your chart shows sensitivity to tone, timing, and what remains unsaid.', evidenceIds: ['placement:moon'] },
      { title: 'You can stay with complexity', body: 'There is an ability to hold tension before reacting.', evidenceIds: ['placement:rising'] },
      { title: 'Meaning keeps you engaged', body: 'Energy is easier to sustain when the reason for acting is clear.', evidenceIds: ['placement:sun'] },
    ],
    watchouts: [
      { title: 'Do not take every signal as your responsibility', body: 'Sensitivity works best with boundaries.', evidenceIds: ['placement:moon'] },
      { title: 'Do not agree before you know your own position', body: 'A pause can protect the quality of the choice.', evidenceIds: ['placement:venus'] },
      { title: 'Do not confuse pause with avoidance', body: 'Sometimes action becomes stronger after the tempo becomes yours.', evidenceIds: ['placement:mars'] },
    ],
    dictionaryTerms: [
      { term: 'Sun', meaning: 'character, will, and what makes you feel alive' },
      { term: 'Moon', meaning: 'emotional response, habits, and what creates safety' },
      { term: 'Rising', meaning: 'first impression and how you enter new situations' },
      { term: 'House', meaning: 'a life area where a planet expresses itself' },
      { term: 'Aspect', meaning: 'a relationship between two planets' },
      { term: 'Transit', meaning: 'a current planet position touching your natal chart' },
    ],
    astroEvidence: evidence,
  };
}

export function buildNatalAnchorFallback(lang: 'ru' | 'en', chartData?: NatalChartData | null): NatalAnchorReading {
  return lang === 'ru' ? anchorFallbackRu(chartData) : anchorFallbackEn(chartData);
}

export function buildNatalFullFallback(lang: 'ru' | 'en', chartData?: NatalChartData | null): NatalFullReading {
  const anchor = buildNatalAnchorFallback(lang, chartData);
  const evidence = anchor.astroEvidence;
  const primary = evidenceText(evidence, lang === 'ru' ? 'В карте видны основные личные планеты и их связи.' : 'The chart shows the main personal placements and their links.');
  const aspect = evidence.find((item) => item.type === 'aspect');

  if (lang === 'en') {
    return {
      headline: 'Full chart',
      summary: 'A deeper reading built from placements, houses, and the strongest aspects.',
      mainConfiguration: `${primary} This is the starting configuration for understanding how the chart works as a whole.`,
      reactions: 'Emotional reactions are read through the Moon, its sign, house, and links to other planets.',
      choices: 'Choice style is read through the Sun, Mercury, Venus, and Mars: how you decide, speak, move toward people, and act.',
      closeness: 'Closeness is not described abstractly here; it is read through Venus, the Moon, and relationship-related houses.',
      strengths: anchor.strengths.map((item) => `${item.title}: ${item.body}`).join('\n\n'),
      tensionPattern: aspect?.detail || 'The strongest repeating tension is read through the tightest natal aspects.',
      integration: 'The practical orientation is to notice which part of the chart is speaking before reacting.',
      astroEvidence: evidence,
    };
  }

  return {
    headline: 'Полная карта',
    summary: 'Разбор личности по положениям планет, домам и самым сильным связям карты.',
    mainConfiguration: `${primary} Это главная конфигурация, от которой дальше читаются реакции, выборы, близость и повторяющиеся напряжения.`,
    reactions: `Эмоциональная реакция читается через Луну: её знак, дом и связи с другими планетами. ${anchor.threeAnchors[1]?.body || ''}`.trim(),
    choices: 'Стиль выбора читается через Солнце, Меркурий, Венеру и Марс: как ты решаешь, говоришь, сближаешься и переходишь к действию.',
    closeness: 'Близость здесь описывается не абстрактно, а через Венеру, Луну и темы домов: где нужен контакт, где граница, где появляется осторожность.',
    strengths: anchor.strengths.map((item) => `${item.title}. ${item.body}`).join('\n\n'),
    tensionPattern: aspect?.detail || 'Повторяющееся напряжение читается через самые точные аспекты карты: там чаще всего сталкиваются разные внутренние функции.',
    integration: 'Практический ориентир простой: перед реакцией полезно понять, какая часть карты сейчас говорит — эмоция, привычная защита, желание близости или потребность действовать.',
    astroEvidence: evidence,
  };
}

export function buildNatalLivingFallback(
  lang: 'ru' | 'en',
  periodKey: string,
  chartData?: NatalChartData | null,
  dailyEvidence?: AstroEvidenceItem[]
): NatalLivingReading {
  const evidence = dailyEvidence?.length ? dailyEvidence : buildNatalAstroEvidence(chartData, lang).slice(0, 4);
  const firstTransit = evidence.find((item) => item.type === 'transit') || evidence[0];
  const baseDetail = firstTransit?.detail || evidenceText(evidence, lang === 'ru' ? 'Сегодня используем основные факты натальной карты.' : 'Today uses the main facts of the natal chart.');
  const house = firstTransit?.house || evidence.find((item) => item.house)?.house || null;
  const theme = houseTheme(house, lang);

  if (lang === 'en') {
    return {
      periodKey,
      headline: 'Today through your chart',
      summary: `The key reference is: ${firstTransit?.label || 'the natal chart configuration'}.`,
      whyToday: `${baseDetail} In life this can show up through ${theme}, not as a vague mood but as a concrete place where attention is needed.`,
      situations: [
        { title: 'In conversation', body: 'A quick answer may not be the best answer. Give yourself one pause before agreeing or explaining.', evidenceIds: firstTransit ? [firstTransit.id] : [] },
        { title: 'In work', body: `Focus on the task connected with ${theme}; do not scatter effort across five directions at once.`, evidenceIds: firstTransit ? [firstTransit.id] : [] },
        { title: 'Inside yourself', body: 'If irritation or fatigue appears, read it as a signal to check the real pressure point.', evidenceIds: firstTransit ? [firstTransit.id] : [] },
      ],
      relationships: 'In closeness, the useful move is to ask for clarity earlier, before silence turns into a private story.',
      workMoney: 'For work and money, this is about state and decision hygiene: avoid decisions made only to remove pressure quickly.',
      evening: 'In the evening, separate what actually happened from what your mind kept rehearsing.',
      questionOfDay: 'What exact situation is asking me to respond more deliberately today?',
      astroEvidence: evidence,
      daySituations: [],
    };
  }

  const situations: NatalReadingPoint[] = [
    {
      title: 'В разговоре',
      body: `Если появится ожидание быстрого ответа, смотри на факт карты: ${firstTransit?.label || 'главная связка натальной карты'}. Лучше назвать главное короче, чем объяснять себя до усталости.`,
      evidenceIds: firstTransit ? [firstTransit.id] : [],
    },
    {
      title: 'В делах',
      body: `Тема дня чаще всего проявится через ${theme}. Выбирай одно действие, которое реально двигает ситуацию, а не просто создаёт ощущение занятости.`,
      evidenceIds: firstTransit ? [firstTransit.id] : [],
    },
    {
      title: 'Внутри себя',
      body: 'Если появится раздражение или усталость, полезно проверить не настроение вообще, а конкретную точку давления: кто требует ответа, где нет ясных условий, что пришлось удерживать слишком долго.',
      evidenceIds: firstTransit ? [firstTransit.id] : [],
    },
  ];

  return {
    periodKey,
    headline: 'Сегодня по карте',
    summary: `Главный факт дня: ${firstTransit?.label || 'натальная конфигурация'}.`,
    whyToday: `${baseDetail} Поэтому день может проявиться не общей фразой про настроение, а конкретно через ${theme}: разговор, решение, договорённость или внутреннюю реакцию.`,
    situations,
    daySituations: situations,
    relationships: 'В отношениях лучше не додумывать мотив другого человека. Если тема важна, спроси прямо и спокойно, не превращая паузу в проверку близости.',
    workMoney: 'В работе и деньгах это не про рискованные обещания, а про состояние: где стоит собрать факты, где не распыляться и где не принимать решение только из напряжения.',
    evening: 'Вечером полезно отделить факты дня от того, что ты прокручивал внутри. Оставь один вывод, который поможет завтра действовать точнее.',
    questionOfDay: 'В какой конкретной ситуации сегодня мне важно ответить не автоматически, а по-настоящему из своей позиции?',
    astroEvidence: evidence,
  };
}

export function coerceNatalAnchorReading(
  content: unknown,
  lang: 'ru' | 'en',
  chartData?: NatalChartData | null
): NatalAnchorReading {
  const fallback = buildNatalAnchorFallback(lang, chartData);

  if (typeof content === 'string') {
    const paragraphs = splitParagraphs(content);
    const portrait = paragraphs.join('\n\n') || fallback.portrait;
    return { ...fallback, portrait, reading: portrait };
  }

  const raw = (content && typeof content === 'object' ? content : {}) as Partial<NatalAnchorReading> & {
    patterns?: string[];
  };
  const portrait = cleanParagraphs(raw.portrait || raw.reading, fallback.portrait);
  return {
    headline: cleanLine(raw.headline, fallback.headline),
    summary: cleanLine(raw.summary, fallback.summary),
    portrait,
    reading: portrait,
    threeAnchors: cleanPoints(raw.threeAnchors, fallback.threeAnchors, 3).slice(0, 3),
    perceivedByOthers: cleanParagraphs(raw.perceivedByOthers, fallback.perceivedByOthers),
    strengths: cleanPoints(raw.strengths, fallback.strengths, 3).slice(0, 3),
    watchouts: cleanPoints(raw.watchouts || raw.patterns, fallback.watchouts, 3).slice(0, 3),
    dictionaryTerms: cleanDictionary(raw.dictionaryTerms, fallback.dictionaryTerms),
    astroEvidence: Array.isArray(raw.astroEvidence) && raw.astroEvidence.length
      ? raw.astroEvidence.slice(0, 10)
      : fallback.astroEvidence,
  };
}

export function coerceNatalFullReading(
  content: unknown,
  lang: 'ru' | 'en',
  chartData?: NatalChartData | null
): NatalFullReading {
  const fallback = buildNatalFullFallback(lang, chartData);
  const raw = (content && typeof content === 'object' ? content : {}) as Partial<NatalFullReading>;
  return {
    headline: cleanLine(raw.headline, fallback.headline),
    summary: cleanLine(raw.summary, fallback.summary),
    mainConfiguration: cleanParagraphs(raw.mainConfiguration, fallback.mainConfiguration),
    reactions: cleanParagraphs(raw.reactions, fallback.reactions),
    choices: cleanParagraphs(raw.choices, fallback.choices),
    closeness: cleanParagraphs(raw.closeness, fallback.closeness),
    strengths: cleanParagraphs(raw.strengths, fallback.strengths),
    tensionPattern: cleanParagraphs(raw.tensionPattern, fallback.tensionPattern),
    integration: cleanParagraphs(raw.integration, fallback.integration),
    astroEvidence: Array.isArray(raw.astroEvidence) && raw.astroEvidence.length
      ? raw.astroEvidence.slice(0, 10)
      : fallback.astroEvidence,
  };
}

export function coerceNatalLivingReading(
  content: unknown,
  lang: 'ru' | 'en',
  periodKey = getCurrentNatalPeriodKey(),
  chartData?: NatalChartData | null
): NatalLivingReading {
  const fallback = buildNatalLivingFallback(lang, periodKey, chartData);

  if (content && typeof content === 'object' && 'sections' in (content as Record<string, unknown>)) {
    return fallback;
  }

  const raw = (content && typeof content === 'object' ? content : {}) as Partial<NatalLivingReading> & {
    today?: string;
    activeTheme?: string;
    relationshipsToday?: string;
    workMoneyToday?: string;
    repeatingScenario?: string;
  };
  const situations = cleanPoints(raw.situations || raw.daySituations, fallback.situations, 3).slice(0, 3);
  return {
    periodKey: cleanLine(raw.periodKey, periodKey),
    headline: cleanLine(raw.headline, fallback.headline),
    summary: cleanLine(raw.summary, fallback.summary),
    whyToday: cleanParagraphs(raw.whyToday || raw.today || raw.activeTheme, fallback.whyToday),
    situations,
    daySituations: situations,
    relationships: cleanParagraphs(raw.relationships || raw.relationshipsToday, fallback.relationships),
    workMoney: cleanParagraphs(raw.workMoney || raw.workMoneyToday, fallback.workMoney),
    evening: cleanParagraphs(raw.evening, fallback.evening),
    questionOfDay: cleanLine(raw.questionOfDay, fallback.questionOfDay),
    astroEvidence: Array.isArray(raw.astroEvidence) && raw.astroEvidence.length
      ? raw.astroEvidence.slice(0, 10)
      : fallback.astroEvidence,
  };
}

export function mapNatalAnchorToLegacyIntro(reading: NatalAnchorReading) {
  return [reading.summary, reading.portrait || reading.reading].filter(Boolean).join('\n\n').trim();
}
