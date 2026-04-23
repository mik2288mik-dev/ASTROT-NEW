import type {
  AstroEvidenceItem,
  NatalAnchorReading,
  NatalChartData,
  NatalDictionaryTerm,
  NatalFullReading,
  NatalHumanSection,
  NatalLivingReading,
  NatalReadingPoint,
  PlanetPosition,
} from '../types';
import type { CurrentTransits, PlanetTransit } from './transits-calculator';
import { getMoscowTodayKey } from './date-utils';
import { ZODIAC_SIGNS, type ZodiacSign } from './zodiac-utils';

export const NATAL_ANCHOR_PROMPT_VERSION = 'natal_anchor.planet_human_v4';
export const NATAL_FULL_PROMPT_VERSION = 'natal_full.planet_human_v4';
export const NATAL_LIVING_PROMPT_VERSION = 'natal_daily.editorial_v3';

export const NATAL_ANCHOR_CACHE_KEY = 'base';
export const NATAL_FULL_CACHE_KEY = 'personality';

export const NATAL_CONTENT_ACTIVE_PROMPT_VERSIONS = [
  NATAL_ANCHOR_PROMPT_VERSION,
  NATAL_FULL_PROMPT_VERSION,
  NATAL_LIVING_PROMPT_VERSION,
] as const;

export const NATAL_BANNED_PHRASES = [
  'это читается через',
  'может проявляться',
  'здесь описывается',
  'полезно проверить',
  'тема связана с',
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

const ANCHOR_SECTION_IDS = ['character', 'emotions', 'first-impression', 'thoughts', 'love', 'action'] as const;
const FULL_SECTION_IDS = [
  'character',
  'emotions',
  'first-impression',
  'thoughts-speech',
  'love',
  'action',
  'money-stability',
  'intimacy',
  'when-hard',
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

function getEvidenceById(evidence: AstroEvidenceItem[], id: string) {
  return evidence.find((item) => item.id === id);
}

function getAspectEvidenceForPlanet(evidence: AstroEvidenceItem[], planetKey: string, limit = 2) {
  const needle = `:${normalizePlanetKey(planetKey)}`;
  return evidence.filter((item) => item.type === 'aspect' && item.id.includes(needle)).slice(0, limit);
}

function getHardAspectEvidence(evidence: AstroEvidenceItem[], limit = 2) {
  return evidence
    .filter((item) => item.type === 'aspect' && (item.aspectType === 'square' || item.aspectType === 'opposition' || item.aspectType === 'conjunction'))
    .slice(0, limit);
}

function placementSubtitle(key: string, position: PlanetPosition | null | undefined, lang: 'ru' | 'en') {
  const sign = signLabel(position?.sign, lang, lang === 'ru');
  const house = houseNumber(position);
  const parts = [planetLabel(key, lang), lang === 'ru' ? `в ${sign}` : `in ${sign}`];
  if (house) {
    parts.push(lang === 'ru' ? `${house} дом` : `house ${house}`);
  }
  return parts.filter(Boolean).join(' · ');
}

function normalizePointBody(value: string) {
  return cleanLine(value, '').replace(/\.$/, '');
}

function buildLegacyAnchorPointsFromSections(sections: NatalHumanSection[], ids: readonly string[]) {
  return ids
    .map((id) => sections.find((section) => section.id === id))
    .filter(Boolean)
    .map((section) => ({
      title: section!.title,
      body: normalizePointBody(section!.body.split('\n\n')[0] || section!.body),
      evidenceIds: section!.evidenceIds,
    }));
}

function deriveAnchorLegacyFields(reading: NatalAnchorReading) {
  const character = reading.sections.find((section) => section.id === 'character');
  const firstImpression = reading.sections.find((section) => section.id === 'first-impression');
  const love = reading.sections.find((section) => section.id === 'love');
  const emotions = reading.sections.find((section) => section.id === 'emotions');
  const action = reading.sections.find((section) => section.id === 'action');

  return {
    summary: reading.lead,
    portrait: reading.sections.map((section) => section.body).join('\n\n'),
    reading: reading.sections.map((section) => section.body).join('\n\n'),
    threeAnchors: buildLegacyAnchorPointsFromSections(reading.sections, ['character', 'emotions', 'first-impression']),
    perceivedByOthers: firstImpression?.body || '',
    strengths: [character, emotions, love]
      .filter(Boolean)
      .map((section) => ({
        title: section!.title,
        body: section!.examples[0] || normalizePointBody(section!.body.split('\n\n')[0] || section!.body),
        evidenceIds: section!.evidenceIds,
      })),
    watchouts: [firstImpression, action, love]
      .filter(Boolean)
      .map((section) => ({
        title: section!.title,
        body: section!.examples[1] || section!.examples[0] || normalizePointBody(section!.body.split('\n\n')[0] || section!.body),
        evidenceIds: section!.evidenceIds,
      })),
  };
}

function deriveFullLegacyFields(reading: NatalFullReading) {
  const find = (id: string) => reading.sections.find((section) => section.id === id);
  return {
    summary: reading.lead,
    mainConfiguration: find('character')?.body || '',
    reactions: find('emotions')?.body || '',
    choices: [find('thoughts-speech')?.body, find('action')?.body].filter(Boolean).join('\n\n'),
    closeness: [find('love')?.body, find('intimacy')?.body].filter(Boolean).join('\n\n'),
    strengths: [find('money-stability')?.body, find('character')?.examples.join('\n'), find('action')?.examples.join('\n')]
      .filter(Boolean)
      .join('\n\n'),
    tensionPattern: find('when-hard')?.body || '',
    integration: reading.synthesis,
  };
}

function sectionExamplesForPlanet(
  sectionId: string,
  lang: 'ru' | 'en',
  placement: PlanetPosition | null | undefined,
  variant: 'anchor' | 'full'
) {
  const house = houseNumber(placement);
  const theme = houseTheme(house, lang);
  if (lang === 'en') {
    const examples: Record<string, string[]> = {
      character: [
        `You get more reliable when the choice touches ${theme}, not just external pressure.`,
        `In a new situation you first look for what is real before giving full energy.`,
        `When the reason is weak, motivation drops faster than others may expect.`,
      ],
      emotions: [
        `Mood changes are often tied to ${theme}, not only to what is said out loud.`,
        `You calm down faster when there is privacy, rhythm, and emotional clarity.`,
        `If something feels off, the body usually notices before the mind explains it.`,
      ],
      'first-impression': [
        `People may read the outer shell before they notice how much is happening inside.`,
        `You rarely open at full volume from the first minute.`,
        `First meetings often depend on whether there is trust in the room.`,
      ],
      thoughts: [
        `You do better in conversation when the logic is clear and the tone is honest.`,
        `If the topic feels empty, words become shorter or more selective.`,
        `You often hear the structure of a conversation, not only its content.`,
      ],
      'thoughts-speech': [
        `You speak best when the idea is clear and the context is not rushed.`,
        `In argument, tone matters as much as logic.`,
        `When you are unconvinced, your speech usually slows down before you openly disagree.`,
      ],
      love: [
        `Closeness grows through pace and quality, not through loud promises.`,
        `You notice whether care feels real very quickly.`,
        `If there is pressure without trust, the heart closes earlier than the face shows.`,
      ],
      action: [
        `Action becomes strongest when the next step is concrete.`,
        `You rarely spend energy well on empty hurry.`,
        `If timing feels wrong, resistance can be physical before it becomes verbal.`,
      ],
    };
    return (examples[sectionId] || examples.character).slice(0, variant === 'anchor' ? 2 : 3);
  }

  const examples: Record<string, string[]> = {
    character: [
      `Когда выбор касается темы ${theme}, ты действуешь точнее, чем в ситуации чистого внешнего давления.`,
      'В новой ситуации тебе важно понять, что здесь по-настоящему происходит, а уже потом вкладываться полностью.',
      'Если смысл решения неясен, энергия уходит быстрее, чем это видно со стороны.',
    ],
    emotions: [
      `Настроение часто цепляется не только за слова, но и за то, что происходит в теме ${theme}.`,
      'Становится легче, когда есть тишина, предсказуемый ритм и ощущение, что чувства не надо оправдывать.',
      'Если что-то не так, тело обычно замечает это раньше, чем появляется чёткое объяснение.',
    ],
    'first-impression': [
      'Люди сначала считывают внешнюю манеру держаться и только потом замечают глубину внутренней реакции.',
      'Ты редко раскрываешься в полную силу с первых минут общения.',
      'Первый контакт очень зависит от того, есть ли в пространстве доверие и уважение к границам.',
    ],
    thoughts: [
      'В разговоре тебе проще быть точным, когда логика ясна и тон честный.',
      'Если тема кажется пустой, речь становится короче, а мысли уходят внутрь.',
      'Ты часто слышишь не только слова, но и устройство разговора: кто уходит от сути, кто говорит прямо.',
    ],
    'thoughts-speech': [
      'Ты лучше формулируешь, когда есть ясная мысль и нет давления на скорость ответа.',
      'В споре для тебя важен не только аргумент, но и тон, с которым он подаётся.',
      'Если внутреннего согласия нет, речь обычно замедляется раньше, чем ты прямо скажешь “нет”.',
    ],
    love: [
      'Близость растёт через качество контакта и темп, а не через громкие обещания.',
      'Ты довольно быстро чувствуешь, настоящее ли внимание перед тобой.',
      'Если на тебя давят до появления доверия, сердце закрывается раньше, чем это видно по лицу.',
    ],
    action: [
      'Действовать легче, когда следующий шаг конкретен и имеет смысл.',
      'Суета сама по себе редко даёт тебе хороший результат.',
      'Если момент выбран неудачно, сопротивление сначала ощущается телом, а уже потом становится словами.',
    ],
  };

  return (examples[sectionId] || examples.character).slice(0, variant === 'anchor' ? 2 : 3);
}

function createHumanSection({
  id,
  title,
  subtitle,
  body,
  examples,
  astroSource,
  evidenceIds,
}: NatalHumanSection): NatalHumanSection {
  return {
    id,
    title,
    subtitle,
    body: cleanParagraphs(body, ''),
    examples: examples.map((item) => cleanLine(item, '')).filter(Boolean),
    astroSource: cleanLine(astroSource, subtitle),
    evidenceIds: evidenceIds.filter(Boolean),
  };
}

function planetSection(
  lang: 'ru' | 'en',
  chartData: NatalChartData | null | undefined,
  evidence: AstroEvidenceItem[],
  planetKey: string,
  id: string,
  title: string,
  variant: 'anchor' | 'full'
): NatalHumanSection {
  const position = getPlanet(chartData as NatalChartData, planetKey);
  const placementEvidence = getEvidenceById(evidence, `placement:${normalizePlanetKey(planetKey)}`);
  const aspects = getAspectEvidenceForPlanet(evidence, planetKey, variant === 'anchor' ? 1 : 2);
  const evidenceIds = [placementEvidence?.id, ...aspects.map((item) => item.id)].filter(Boolean) as string[];
  const subtitle = placementSubtitle(planetKey, position, lang);
  const sourceLine = [placementEvidence?.label || subtitle, ...aspects.map((item) => item.label)].filter(Boolean).join(' · ');
  const theme = houseTheme(houseNumber(position), lang);
  const sign = signLabel(position?.sign, lang, lang === 'ru');
  const label = planetLabel(planetKey, lang);
  const aspectLine = aspects[0]?.detail;

  const body = lang === 'ru'
    ? [
        `${label} в ${sign}${houseNumber(position) ? ` в ${houseNumber(position)} доме` : ''} задаёт эту часть карты через тему ${theme}. Здесь человек не играет роль, а показывает свой реальный способ реагировать на жизнь.`,
        aspectLine
          ? `${aspectLine} Поэтому этот сюжет не остаётся внутри теории: он заметен в конкретных сценах общения, выбора и внутреннего темпа.`
          : `В обычной жизни это заметно не по красивым словам, а по повседневым решениям: где ты включаешься быстро, где держишь паузу и что действительно считаешь важным.`,
      ].join('\n\n')
    : [
        `${label} in ${sign}${houseNumber(position) ? ` in house ${houseNumber(position)}` : ''} shapes this part of the chart through ${theme}. This is not theory; it is the real way the person responds to life.`,
        aspectLine
          ? `${aspectLine} That is why this theme shows up in concrete scenes of contact, decision, and timing.`
          : `In real life it is visible through everyday choices: where you engage quickly, where you pause, and what actually feels worth the effort.`,
      ].join('\n\n');

  return createHumanSection({
    id,
    title,
    subtitle,
    body,
    examples: sectionExamplesForPlanet(id, lang, position, variant),
    astroSource: sourceLine || subtitle,
    evidenceIds,
  });
}

function buildMoneySection(
  lang: 'ru' | 'en',
  chartData: NatalChartData | null | undefined,
  evidence: AstroEvidenceItem[]
): NatalHumanSection {
  const secondHouse = chartData?.houses?.find((house) => house.house === 2);
  const venus = getPlanet(chartData as NatalChartData, 'venus');
  const saturn = getPlanet(chartData as NatalChartData, 'saturn');
  const evidenceIds = ['placement:venus', 'placement:saturn', 'placement:jupiter'].filter((id) => getEvidenceById(evidence, id));
  const subtitle = lang === 'ru'
    ? [
        secondHouse?.sign ? `2 дом в ${signLabel(secondHouse.sign, lang, true)}` : null,
        venus?.sign ? `Венера в ${signLabel(venus.sign, lang, true)}` : null,
        saturn?.sign ? `Сатурн в ${signLabel(saturn.sign, lang, true)}` : null,
      ].filter(Boolean).join(' · ')
    : [
        secondHouse?.sign ? `2nd house in ${signLabel(secondHouse.sign, lang)}` : null,
        venus?.sign ? `Venus in ${signLabel(venus.sign, lang)}` : null,
        saturn?.sign ? `Saturn in ${signLabel(saturn.sign, lang)}` : null,
      ].filter(Boolean).join(' · ');

  const body = lang === 'ru'
    ? [
        `${secondHouse?.sign ? `Тема денег идёт через знак ${signLabel(secondHouse.sign, lang, true)} во 2 доме` : 'Тема денег и устойчивости в карте читается через 2 дом, Венеру, Сатурн и Юпитер'}. Здесь важны не только доходы сами по себе, а отношение к опоре: на что ты готов опереться, что считаешь надёжным, а что вызывает лишнюю тревогу.`,
        `${venus?.sign ? `Венера в ${signLabel(venus.sign, lang)}` : 'Венера'} показывает вкус к качеству и комфортный формат обмена, ${saturn?.sign ? `а Сатурн в ${signLabel(saturn.sign, lang)}` : 'а Сатурн'} — где включается осторожность и контроль. В жизни это видно по тому, тратишь ли ты из спокойствия или сначала пытаешься снять внутреннее напряжение покупкой, согласием или лишней экономией.`,
      ].join('\n\n')
    : [
        `${secondHouse?.sign ? `Money is read through the 2nd house in ${signLabel(secondHouse.sign, lang)}` : 'Money and stability are read through the 2nd house, Venus, Saturn, and Jupiter'}. It is not only about income, but about what feels reliable enough to lean on.`,
        `${venus?.sign ? `Venus in ${signLabel(venus.sign, lang)}` : 'Venus'} shows taste and comfort, while ${saturn?.sign ? `Saturn in ${signLabel(saturn.sign, lang)}` : 'Saturn'} shows where caution and control enter. In life this is visible in whether you spend from calm or from a wish to silence anxiety quickly.`,
      ].join('\n\n');

  return createHumanSection({
    id: 'money-stability',
    title: lang === 'ru' ? 'Деньги и устойчивость' : 'Money and stability',
    subtitle: subtitle || (lang === 'ru' ? '2 дом · Венера · Сатурн' : '2nd house · Venus · Saturn'),
    body,
    examples: lang === 'ru'
      ? [
          'Денежные решения лучше получаются, когда сначала понятен мотив, а не только внешний результат.',
          'Если опора расшатана, может тянуть то к жёсткому контролю, то к импульсивной компенсации.',
          'Устойчивость растёт там, где есть ясные правила и ощущение, что цена решения тебе по силам.',
        ]
      : [
          'Money choices work better when the motive is clear, not only the outcome.',
          'When support feels unstable, control and impulse can alternate quickly.',
          'Stability grows where rules are clear and the cost feels real but manageable.',
        ],
    astroSource: subtitle || (lang === 'ru' ? '2 дом · Венера · Сатурн' : '2nd house · Venus · Saturn'),
    evidenceIds,
  });
}

function buildIntimacySection(
  lang: 'ru' | 'en',
  chartData: NatalChartData | null | undefined,
  evidence: AstroEvidenceItem[]
): NatalHumanSection {
  const venus = getPlanet(chartData as NatalChartData, 'venus');
  const moon = getPlanet(chartData as NatalChartData, 'moon');
  const house7 = chartData?.houses?.find((house) => house.house === 7);
  const house8 = chartData?.houses?.find((house) => house.house === 8);
  const evidenceIds = ['placement:venus', 'placement:moon'].filter((id) => getEvidenceById(evidence, id));
  const subtitle = [
    venus?.sign ? placementSubtitle('venus', venus, lang) : null,
    moon?.sign ? placementSubtitle('moon', moon, lang) : null,
  ].filter(Boolean).join(' · ');

  const body = lang === 'ru'
    ? [
        `Близость в карте складывается не из одного признака, а из того, как вместе работают ${venus?.sign ? `Венера в ${signLabel(venus.sign, lang)}` : 'Венера'} и ${moon?.sign ? `Луна в ${signLabel(moon.sign, lang)}` : 'Луна'}. Одна часть показывает, как хочется любить и нравиться, другая — когда становится по-настоящему безопасно.`,
        `${house7?.sign ? `7 дом в ${signLabel(house7.sign, lang, true)}` : 'Тема партнёрства'} и ${house8?.sign ? `8 дом в ${signLabel(house8.sign, lang, true)}` : 'тема доверия'} подсказывают, как быстро ты допускаешь другого человека ближе. На практике это видно в том, нужен ли тебе прямой разговор, время, телесное спокойствие или возможность сначала присмотреться.`,
      ].join('\n\n')
    : [
        `Closeness is not read from one factor alone, but from how ${venus?.sign ? `Venus in ${signLabel(venus.sign, lang)}` : 'Venus'} and ${moon?.sign ? `Moon in ${signLabel(moon.sign, lang)}` : 'Moon'} work together. One part shows how affection moves, the other shows when it actually feels safe.`,
        `${house7?.sign ? `The 7th house in ${signLabel(house7.sign, lang)}` : 'Partnership themes'} and ${house8?.sign ? `the 8th house in ${signLabel(house8.sign, lang)}` : 'trust themes'} show how quickly you let someone closer. In real life this appears through the need for direct conversation, time, physical calm, or the chance to observe first.`,
      ].join('\n\n');

  return createHumanSection({
    id: 'intimacy',
    title: lang === 'ru' ? 'Близость' : 'Intimacy',
    subtitle: subtitle || (lang === 'ru' ? 'Венера · Луна · 7/8 дом' : 'Venus · Moon · 7th/8th house'),
    body,
    examples: lang === 'ru'
      ? [
          'Тебе проще открываться там, где слова и поведение совпадают.',
          'Если доверие не появилось, красивый жест сам по себе не убеждает.',
          'Важный разговор часто нужен раньше, чем ситуация становится критичной.',
        ]
      : [
          'It is easier to open where words and behavior match.',
          'Without trust, a beautiful gesture alone is not enough.',
          'An important conversation is often needed earlier than the crisis point.',
        ],
    astroSource: subtitle || (lang === 'ru' ? 'Венера · Луна · 7/8 дом' : 'Venus · Moon · 7th/8th house'),
    evidenceIds,
  });
}

function buildWhenHardSection(
  lang: 'ru' | 'en',
  chartData: NatalChartData | null | undefined,
  evidence: AstroEvidenceItem[]
): NatalHumanSection {
  const hardAspects = getHardAspectEvidence(evidence, 2);
  const subtitle = hardAspects.map((item) => item.label).join(' · ');
  const body = lang === 'ru'
    ? [
        `${hardAspects[0]?.detail || 'Когда в карте сталкиваются личные планеты, сложнее удерживать один устойчивый ритм.'} В трудный момент человек может одновременно хотеть защищаться, объяснять себя и быстро завершить ситуацию, даже если внутри ещё нет ясности.`,
        `Это не приговор и не “плохая карта”. Скорее место, где особенно важно замечать собственный порог: в какой точке ты перестаёшь слышать себя и начинаешь действовать только из усталости, раздражения или спешки.`,
      ].join('\n\n')
    : [
        `${hardAspects[0]?.detail || 'When personal planets collide in the chart, it becomes harder to keep one stable rhythm.'} Under pressure, a person may want to protect, explain, and end the situation quickly before clarity has actually arrived.`,
        `This is not a flaw or a bad chart. It is the place where it matters most to notice the threshold where self-contact is lost and action starts coming only from fatigue, irritation, or haste.`,
      ].join('\n\n');

  return createHumanSection({
    id: 'when-hard',
    title: lang === 'ru' ? 'Когда становится сложно' : 'When it gets hard',
    subtitle: subtitle || (lang === 'ru' ? 'Личные аспекты карты' : 'Personal chart aspects'),
    body,
    examples: lang === 'ru'
      ? [
          'Сложность часто начинается не с большой драмы, а с мелкой неясности, которую пришлось долго держать внутри.',
          'Когда нарастает перегруз, желание быстро решить всё может стать сильнее, чем готовность честно назвать, что происходит.',
          'Точнее всего помогает не ускорение, а короткая пауза до ответа.',
        ]
      : [
          'Difficulty often starts not with drama, but with a small ambiguity carried too long alone.',
          'When overload grows, ending the situation fast can feel easier than naming the truth.',
          'What helps most is usually not speed, but a short pause before the response.',
        ],
    astroSource: subtitle || (lang === 'ru' ? 'Личные аспекты карты' : 'Personal chart aspects'),
    evidenceIds: hardAspects.map((item) => item.id),
  });
}

function buildAnchorSections(lang: 'ru' | 'en', chartData?: NatalChartData | null, evidence: AstroEvidenceItem[] = []) {
  return [
    planetSection(lang, chartData, evidence, 'sun', 'character', lang === 'ru' ? 'Характер' : 'Character', 'anchor'),
    planetSection(lang, chartData, evidence, 'moon', 'emotions', lang === 'ru' ? 'Эмоции' : 'Emotions', 'anchor'),
    planetSection(lang, chartData, evidence, 'rising', 'first-impression', lang === 'ru' ? 'Первое впечатление' : 'First impression', 'anchor'),
    planetSection(lang, chartData, evidence, 'mercury', 'thoughts', lang === 'ru' ? 'Мысли' : 'Thoughts', 'anchor'),
    planetSection(lang, chartData, evidence, 'venus', 'love', lang === 'ru' ? 'Любовь' : 'Love', 'anchor'),
    planetSection(lang, chartData, evidence, 'mars', 'action', lang === 'ru' ? 'Действие' : 'Action', 'anchor'),
  ];
}

function buildFullSections(lang: 'ru' | 'en', chartData?: NatalChartData | null, evidence: AstroEvidenceItem[] = []) {
  return [
    planetSection(lang, chartData, evidence, 'sun', 'character', lang === 'ru' ? 'Характер' : 'Character', 'full'),
    planetSection(lang, chartData, evidence, 'moon', 'emotions', lang === 'ru' ? 'Эмоции' : 'Emotions', 'full'),
    planetSection(lang, chartData, evidence, 'rising', 'first-impression', lang === 'ru' ? 'Первое впечатление' : 'First impression', 'full'),
    planetSection(lang, chartData, evidence, 'mercury', 'thoughts-speech', lang === 'ru' ? 'Мысли и речь' : 'Thoughts and speech', 'full'),
    planetSection(lang, chartData, evidence, 'venus', 'love', lang === 'ru' ? 'Любовь' : 'Love', 'full'),
    planetSection(lang, chartData, evidence, 'mars', 'action', lang === 'ru' ? 'Действие' : 'Action', 'full'),
    buildMoneySection(lang, chartData, evidence),
    buildIntimacySection(lang, chartData, evidence),
    buildWhenHardSection(lang, chartData, evidence),
  ];
}

function defaultDictionaryTerms(lang: 'ru' | 'en'): NatalDictionaryTerm[] {
  if (lang === 'en') {
    return [
      { term: 'Sun', meaning: 'character, will, and what makes you feel alive' },
      { term: 'Moon', meaning: 'emotional reactions, habits, and what creates safety' },
      { term: 'Rising', meaning: 'first impression and how you enter a situation' },
      { term: 'Sign', meaning: 'the style through which a planet expresses itself' },
      { term: 'House', meaning: 'the area of life where the planet becomes visible' },
      { term: 'Aspect', meaning: 'a link between planets: where they support each other or argue' },
    ];
  }

  return [
    { term: 'Солнце', meaning: 'характер, воля и то, через что человек чувствует себя живым' },
    { term: 'Луна', meaning: 'эмоции, привычные реакции и то, что даёт чувство безопасности' },
    { term: 'Асцендент', meaning: 'первое впечатление и способ входить в новые ситуации' },
    { term: 'Знак', meaning: 'стиль, через который проявляется планета или часть карты' },
    { term: 'Дом', meaning: 'сфера жизни, где эта часть карты становится особенно заметной' },
    { term: 'Аспект', meaning: 'связь между двумя планетами: где они поддерживают друг друга или спорят' },
  ];
}

function buildAnchorLead(lang: 'ru' | 'en', chartData?: NatalChartData | null) {
  const sun = chartData?.sun;
  const moon = chartData?.moon;
  const rising = chartData?.rising;
  if (lang === 'en') {
    return sun && moon && rising
      ? `Sun in ${signLabel(sun.sign, lang)}, Moon in ${signLabel(moon.sign, lang)}, and Rising in ${signLabel(rising.sign, lang)} set the tone of the chart. This reading follows how those parts of you sound in real life.`
      : 'This reading starts from the key personal planets and turns them into clear human language.';
  }

  return sun && moon && rising
    ? `Солнце в ${signLabel(sun.sign, lang)}, Луна в ${signLabel(moon.sign, lang)} и Асцендент в ${signLabel(rising.sign, lang)} задают общий тон карты. Дальше она читается не как набор терминов, а как живой рисунок характера, чувств и привычек.`
    : 'Эта карта начинается с личных планет и переводит их в понятный человеческий язык.';
}

function buildFullLead(lang: 'ru' | 'en', chartData?: NatalChartData | null) {
  const sun = chartData?.sun;
  const moon = chartData?.moon;
  const rising = chartData?.rising;
  if (lang === 'en') {
    return sun && moon && rising
      ? `${planetLabel('sun', lang)} in ${signLabel(sun.sign, lang)}, ${planetLabel('moon', lang)} in ${signLabel(moon.sign, lang)}, and Rising in ${signLabel(rising.sign, lang)} are only the beginning. This version goes deeper into speech, closeness, action, stability, and the places that become difficult under pressure.`
      : 'This full chart goes deeper into how the person thinks, loves, acts, and handles pressure.';
  }

  return sun && moon && rising
    ? `Солнце в ${signLabel(sun.sign, lang)}, Луна в ${signLabel(moon.sign, lang)} и Асцендент в ${signLabel(rising.sign, lang)} — только вход в карту. Дальше важны речь, любовь, действие, устойчивость и то, что особенно чувствуется под давлением.`
    : 'Полная карта идёт глубже: в речь, любовь, действие, устойчивость и сложные места поведения.';
}

function anchorFallbackRu(chartData?: NatalChartData | null): NatalAnchorReading {
  const astroEvidence = buildNatalAstroEvidence(chartData, 'ru');
  const sections = buildAnchorSections('ru', chartData, astroEvidence);
  const base: NatalAnchorReading = {
    headline: 'Как ты устроен',
    lead: buildAnchorLead('ru', chartData),
    sections,
    dictionaryTerms: defaultDictionaryTerms('ru'),
    astroEvidence,
  };
  return { ...base, ...deriveAnchorLegacyFields(base) };
}

function anchorFallbackEn(chartData?: NatalChartData | null): NatalAnchorReading {
  const astroEvidence = buildNatalAstroEvidence(chartData, 'en');
  const sections = buildAnchorSections('en', chartData, astroEvidence);
  const base: NatalAnchorReading = {
    headline: 'How your chart reads you',
    lead: buildAnchorLead('en', chartData),
    sections,
    dictionaryTerms: defaultDictionaryTerms('en'),
    astroEvidence,
  };
  return { ...base, ...deriveAnchorLegacyFields(base) };
}

export function buildNatalAnchorFallback(lang: 'ru' | 'en', chartData?: NatalChartData | null): NatalAnchorReading {
  return lang === 'ru' ? anchorFallbackRu(chartData) : anchorFallbackEn(chartData);
}

export function buildNatalFullFallback(lang: 'ru' | 'en', chartData?: NatalChartData | null): NatalFullReading {
  const astroEvidence = buildNatalAstroEvidence(chartData, lang);
  const sections = buildFullSections(lang, chartData, astroEvidence);
  const synthesis = lang === 'ru'
    ? `Если собрать карту целиком, становится видно главное: характер, чувства, речь, любовь и действие работают не по отдельности, а одной системой. Поэтому самые точные решения здесь обычно рождаются не из спешки, а из момента, когда внутренняя правда и внешний шаг совпадают.`
    : `Taken together, the chart shows one main thing: character, feelings, speech, love, and action do not work separately. The best decisions usually appear when inner truth and outer movement finally line up.`;
  const base: NatalFullReading = {
    headline: lang === 'ru' ? 'Как карта складывается в тебя' : 'How the chart comes together',
    lead: buildFullLead(lang, chartData),
    sections,
    synthesis,
    astroEvidence,
  };
  return { ...base, ...deriveFullLegacyFields(base) };
}

function cleanExamples(value: unknown, fallback: string[], count: number) {
  const items = Array.isArray(value)
    ? value.map((item) => cleanLine(item, '')).filter(Boolean).slice(0, count)
    : [];
  return items.length === count ? items : fallback;
}

function cleanHumanSections(
  value: unknown,
  fallback: NatalHumanSection[],
  expectedIds: readonly string[]
) {
  const rawSections = Array.isArray(value) ? value : [];
  const fallbackMap = new Map(fallback.map((section) => [section.id, section]));
  const normalized = expectedIds.map((expectedId) => {
    const raw = rawSections.find((item) => {
      if (!item || typeof item !== 'object') return false;
      return cleanLine((item as NatalHumanSection).id, expectedId) === expectedId;
    }) as Partial<NatalHumanSection> | undefined;
    const safeFallback = fallbackMap.get(expectedId)!;
    const evidenceIds = Array.isArray(raw?.evidenceIds)
      ? raw!.evidenceIds.map(String).filter(Boolean).slice(0, 4)
      : [];
    if (!evidenceIds.length) return safeFallback;

    return createHumanSection({
      id: expectedId,
      title: cleanLine(raw?.title, safeFallback.title),
      subtitle: cleanLine(raw?.subtitle, safeFallback.subtitle),
      body: cleanParagraphs(raw?.body, safeFallback.body),
      examples: cleanExamples(raw?.examples, safeFallback.examples, safeFallback.examples.length),
      astroSource: cleanLine(raw?.astroSource, safeFallback.astroSource),
      evidenceIds,
    });
  });

  const duplicateKey = new Set<string>();
  for (const section of normalized) {
    const key = `${section.title.toLowerCase()}::${section.body.toLowerCase()}`;
    if (duplicateKey.has(key)) {
      return fallback;
    }
    duplicateKey.add(key);
  }

  return normalized;
}

export function validateNatalHumanSections(
  sections: NatalHumanSection[] | undefined,
  expectedIds: readonly string[]
) {
  if (!Array.isArray(sections) || sections.length !== expectedIds.length) return false;
  const ids = sections.map((section) => section.id);
  if (ids.some((id, index) => id !== expectedIds[index])) return false;
  const seenBodies = new Set<string>();
  for (const section of sections) {
    if (!section.body || !section.subtitle || !section.astroSource) return false;
    if (!Array.isArray(section.examples) || !section.examples.length) return false;
    if (!Array.isArray(section.evidenceIds) || !section.evidenceIds.length) return false;
    const bodyKey = section.body.toLowerCase().trim();
    if (seenBodies.has(bodyKey)) return false;
    seenBodies.add(bodyKey);
  }
  return true;
}

export function coerceNatalAnchorReading(
  content: unknown,
  lang: 'ru' | 'en',
  chartData?: NatalChartData | null
): NatalAnchorReading {
  const fallback = buildNatalAnchorFallback(lang, chartData);

  if (typeof content === 'string') {
    return fallback;
  }

  const raw = (content && typeof content === 'object' ? content : {}) as Partial<NatalAnchorReading> & {
    patterns?: string[];
    portrait?: string;
    perceivedByOthers?: string;
  };

  const sections = Array.isArray(raw.sections) && raw.sections.length
    ? cleanHumanSections(raw.sections, fallback.sections, ANCHOR_SECTION_IDS)
    : fallback.sections;

  const reading: NatalAnchorReading = {
    headline: cleanLine(raw.headline, fallback.headline),
    lead: cleanParagraphs(raw.lead || raw.summary, fallback.lead),
    sections,
    dictionaryTerms: cleanDictionary(raw.dictionaryTerms, fallback.dictionaryTerms),
    astroEvidence: Array.isArray(raw.astroEvidence) && raw.astroEvidence.length
      ? raw.astroEvidence.slice(0, 12)
      : fallback.astroEvidence,
  };

  return { ...reading, ...deriveAnchorLegacyFields(reading) };
}

export function coerceNatalFullReading(
  content: unknown,
  lang: 'ru' | 'en',
  chartData?: NatalChartData | null
): NatalFullReading {
  const fallback = buildNatalFullFallback(lang, chartData);
  const raw = (content && typeof content === 'object' ? content : {}) as Partial<NatalFullReading>;
  const sections = Array.isArray(raw.sections) && raw.sections.length
    ? cleanHumanSections(raw.sections, fallback.sections, FULL_SECTION_IDS)
    : fallback.sections;

  const reading: NatalFullReading = {
    headline: cleanLine(raw.headline, fallback.headline),
    lead: cleanParagraphs(raw.lead || raw.summary, fallback.lead),
    sections,
    synthesis: cleanParagraphs(raw.synthesis || raw.integration, fallback.synthesis),
    astroEvidence: Array.isArray(raw.astroEvidence) && raw.astroEvidence.length
      ? raw.astroEvidence.slice(0, 12)
      : fallback.astroEvidence,
  };

  return { ...reading, ...deriveFullLegacyFields(reading) };
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
  return [reading.lead, ...reading.sections.map((section) => section.body)].filter(Boolean).join('\n\n').trim();
}
