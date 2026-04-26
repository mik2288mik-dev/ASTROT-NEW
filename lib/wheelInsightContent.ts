import { getZodiacSign } from '../constants';
import type {
  Language,
  NatalAspectData,
  NatalChartData,
  NatalHouseData,
  PlanetInsightTag,
  WheelInsight,
} from '../types';
import { buildPlanetInsight } from './planetInsightContent';
import {
  getLocalizedElement,
  getPlanetDisplayName,
  getPlanetPositionFromChart,
  getZodiacElementStyle,
  NATAL_PLANET_ORDER,
  normalizePlanetKey,
  type NatalPlanetKey,
} from './natalWheel';
import { getElementForSign, ZODIAC_SIGNS, type ZodiacSign } from './zodiac-utils';

export type WheelInsightEntityType = 'planet' | 'zodiac' | 'aspect' | 'house';

export const WHEEL_INSIGHT_CACHE_VERSION = 'v2.air';

export type WheelAspectEntity = {
  entityType: 'aspect';
  entityId: string;
  aspectType: NatalAspectData['type'];
  from: NatalPlanetKey;
  to: NatalPlanetKey;
};

export type WheelPlanetEntity = {
  entityType: 'planet';
  entityId: NatalPlanetKey;
};

export type WheelZodiacEntity = {
  entityType: 'zodiac';
  entityId: ZodiacSign;
};

export type WheelHouseEntity = {
  entityType: 'house';
  entityId: string;
  houseNumber: number;
};

export type WheelInsightRequest =
  | WheelAspectEntity
  | WheelPlanetEntity
  | WheelZodiacEntity
  | WheelHouseEntity;

type WheelInsightContentOverride = Partial<
  Pick<WheelInsight, 'title' | 'subtitle' | 'body'>
>;

const ASPECT_KIND_LABELS: Record<
  NatalAspectData['type'],
  { ru: string; en: string; tone: string; color: string }
> = {
  conjunction: { ru: 'Соединение', en: 'Conjunction', tone: 'Усиление', color: '#7B5EA7' },
  opposition: { ru: 'Оппозиция', en: 'Opposition', tone: 'Вызов', color: '#E05B54' },
  square: { ru: 'Квадрат', en: 'Square', tone: 'Вызов', color: '#E05B54' },
  trine: { ru: 'Трин', en: 'Trine', tone: 'Гармония', color: '#52A96B' },
  sextile: { ru: 'Секстиль', en: 'Sextile', tone: 'Гармония', color: '#4D8EF4' },
};

const HOUSE_THEME_COPY: Record<number, { ru: string; en: string }> = {
  1: {
    ru: 'Это поле личности, первого впечатления и того, как ты входишь в новый опыт.',
    en: 'This house speaks about identity, first impressions, and the way you enter new experiences.',
  },
  2: {
    ru: 'Здесь звучат ценность, устойчивость, деньги, ресурсы и чувство опоры.',
    en: 'This house covers value, steadiness, money, resources, and the feeling of support.',
  },
  3: {
    ru: 'Это пространство общения, мышления, обучения и твоего повседневного ритма контакта с миром.',
    en: 'This house describes communication, thinking, learning, and your everyday contact with the world.',
  },
  4: {
    ru: 'Здесь живут дом, семья, корни, внутреннее чувство безопасности и то, что делает тебя по-настоящему собой.',
    en: 'This house is about home, family, roots, inner safety, and what makes you feel truly yourself.',
  },
  5: {
    ru: 'Это поле творчества, романтики, удовольствия и того, как ты выражаешь живой огонь внутри.',
    en: 'This house holds creativity, romance, pleasure, and how you express your inner spark.',
  },
  6: {
    ru: 'Здесь важны ритм, здоровье, работа, служение и то, как ты собираешь жизнь в устойчивую систему.',
    en: 'This house focuses on rhythm, health, work, service, and how you shape life into a stable system.',
  },
  7: {
    ru: 'Это дом союза, партнёрства и того, как ты встречаешь другого человека рядом.',
    en: 'This is the house of partnership and how you meet another person beside you.',
  },
  8: {
    ru: 'Здесь находятся глубина, доверие, близость, обмен и всё, что требует внутренней честности.',
    en: 'This house covers depth, trust, intimacy, exchange, and everything that asks for inner honesty.',
  },
  9: {
    ru: 'Это пространство смысла, взглядов, путешествий и внутреннего расширения горизонта.',
    en: 'This house speaks about meaning, beliefs, travel, and the inner widening of your horizon.',
  },
  10: {
    ru: 'Здесь видны карьера, призвание, социальная роль и то, как твой путь проявляется во внешнем мире.',
    en: 'This house reveals career, calling, public role, and how your path appears in the outer world.',
  },
  11: {
    ru: 'Это поле друзей, сообщества, будущего и того, ради чего тебе хочется объединяться с другими.',
    en: 'This house is about friends, community, the future, and what makes you want to join others.',
  },
  12: {
    ru: 'Здесь звучат тишина, внутренний мир, завершения, интуиция и тонкие скрытые процессы.',
    en: 'This house speaks through silence, inner life, endings, intuition, and subtle hidden processes.',
  },
};

const HOUSE_THEME_SHORT: Record<number, { ru: string; en: string }> = {
  1: { ru: 'Личность', en: 'Identity' },
  2: { ru: 'Ресурсы', en: 'Resources' },
  3: { ru: 'Общение', en: 'Communication' },
  4: { ru: 'Дом', en: 'Home' },
  5: { ru: 'Творчество', en: 'Creativity' },
  6: { ru: 'Ритм', en: 'Rhythm' },
  7: { ru: 'Союз', en: 'Partnership' },
  8: { ru: 'Глубина', en: 'Depth' },
  9: { ru: 'Смысл', en: 'Meaning' },
  10: { ru: 'Путь', en: 'Career' },
  11: { ru: 'Сообщество', en: 'Community' },
  12: { ru: 'Внутренний мир', en: 'Inner world' },
};

const ELEMENT_TAG_TONES: Record<string, PlanetInsightTag['tone']> = {
  Fire: 'fire',
  Earth: 'earth',
  Air: 'air',
  Water: 'water',
};

const compact = (value?: string | null) => String(value || '').replace(/\s+/g, ' ').trim();

const formatDegree = (degree: number | null | undefined) =>
  degree == null || !Number.isFinite(degree) ? '—' : `${Math.round(degree)}°`;

function normalizeLanguage(language: Language) {
  return language === 'en' ? 'en' : 'ru';
}

function resolveHouseNumber(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function findHouse(chartData: NatalChartData, houseNumber: number): NatalHouseData | null {
  return Array.isArray(chartData.houses)
    ? chartData.houses.find((house) => house.house === houseNumber) || null
    : null;
}

function listPlanetsInSign(chartData: NatalChartData, sign: ZodiacSign): NatalPlanetKey[] {
  return NATAL_PLANET_ORDER.filter((planetKey) => {
    const position = getPlanetPositionFromChart(chartData, planetKey);
    return position?.sign === sign;
  });
}

function listPlanetsInHouse(chartData: NatalChartData, houseNumber: number): NatalPlanetKey[] {
  return NATAL_PLANET_ORDER.filter((planetKey) => {
    const position = getPlanetPositionFromChart(chartData, planetKey);
    return resolveHouseNumber(position?.house) === houseNumber;
  });
}

function aspectSortKey(planetKey: NatalPlanetKey) {
  return NATAL_PLANET_ORDER.indexOf(planetKey);
}

function localizeHouseShort(houseNumber: number, language: Language) {
  const lang = normalizeLanguage(language);
  return HOUSE_THEME_SHORT[houseNumber]?.[lang] || (lang === 'en' ? 'Theme' : 'Тема');
}

function localizeAspectLabel(type: NatalAspectData['type'], language: Language) {
  const lang = normalizeLanguage(language);
  return ASPECT_KIND_LABELS[type][lang];
}

function localizeAspectTone(type: NatalAspectData['type'], language: Language) {
  if (language === 'en') {
    if (type === 'conjunction') return 'Intensity';
    if (type === 'trine' || type === 'sextile') return 'Harmony';
    return 'Challenge';
  }
  return ASPECT_KIND_LABELS[type].tone;
}

export function buildAspectEntityId(
  from: NatalPlanetKey,
  to: NatalPlanetKey,
  type: NatalAspectData['type']
) {
  const ordered = [from, to].sort((a, b) => aspectSortKey(a) - aspectSortKey(b));
  return `${ordered[0]}__${ordered[1]}__${type}`;
}

function parseAspectEntityId(entityId: string) {
  const [firstRaw, secondRaw, typeRaw] = String(entityId || '').split('__');
  const first = normalizePlanetKey(firstRaw);
  const second = normalizePlanetKey(secondRaw);
  const type = String(typeRaw || '') as NatalAspectData['type'];
  if (!first || !second || first === second) return null;
  if (!['conjunction', 'opposition', 'square', 'trine', 'sextile'].includes(type)) return null;
  return {
    from: [first, second].sort((a, b) => aspectSortKey(a) - aspectSortKey(b))[0],
    to: [first, second].sort((a, b) => aspectSortKey(a) - aspectSortKey(b))[1],
    type,
  };
}

export function buildWheelInsightCacheKey(
  entityType: WheelInsightEntityType,
  entityId: string,
  language: Language,
  calculationVersion?: string | null
) {
  const safeVersion = compact(calculationVersion) || 'default';
  return `wheel:${WHEEL_INSIGHT_CACHE_VERSION}:${entityType}:${entityId}:lang:${normalizeLanguage(language)}:calc:${safeVersion}`;
}

export function resolveWheelInsightRequest(
  chartData: NatalChartData,
  entityTypeRaw: string | null | undefined,
  entityIdRaw: string | null | undefined,
  language: Language
) {
  const entityType = compact(entityTypeRaw) as WheelInsightEntityType;
  const entityId = compact(entityIdRaw);
  if (!entityId) {
    throw new Error(language === 'en' ? 'Entity id is required' : 'Нужен entity id');
  }

  let request: WheelInsightRequest;

  if (entityType === 'planet') {
    const planetId = normalizePlanetKey(entityId);
    if (!planetId || !getPlanetPositionFromChart(chartData, planetId)) {
      throw new Error(language === 'en' ? 'Invalid planet id' : 'Некорректная планета');
    }
    request = { entityType: 'planet', entityId: planetId };
  } else if (entityType === 'zodiac') {
    const normalizedSign = ZODIAC_SIGNS.find((sign) => sign.toLowerCase() === entityId.toLowerCase()) || null;
    if (!normalizedSign) {
      throw new Error(language === 'en' ? 'Invalid zodiac sign' : 'Некорректный знак');
    }
    request = { entityType: 'zodiac', entityId: normalizedSign };
  } else if (entityType === 'house') {
    const houseNumber = Number.parseInt(entityId, 10);
    if (!Number.isFinite(houseNumber) || houseNumber < 1 || houseNumber > 12) {
      throw new Error(language === 'en' ? 'Invalid house number' : 'Некорректный дом');
    }
    request = { entityType: 'house', entityId: String(houseNumber), houseNumber };
  } else if (entityType === 'aspect') {
    const parsed = parseAspectEntityId(entityId);
    if (!parsed) {
      throw new Error(language === 'en' ? 'Invalid aspect id' : 'Некорректный аспект');
    }
    request = {
      entityType: 'aspect',
      entityId: buildAspectEntityId(parsed.from, parsed.to, parsed.type),
      from: parsed.from,
      to: parsed.to,
      aspectType: parsed.type,
    };
  } else {
    throw new Error(language === 'en' ? 'Unsupported entity type' : 'Неподдерживаемый тип');
  }

  return {
    request,
    cacheKey: buildWheelInsightCacheKey(request.entityType, request.entityId, language, chartData.calculationVersion),
  };
}

function buildPlanetWheelInsight(
  chartData: NatalChartData,
  request: WheelPlanetEntity,
  language: Language,
  content?: WheelInsightContentOverride
): WheelInsight {
  const insight = buildPlanetInsight(chartData, request.entityId, language, {
    title: content?.title,
    body: content?.body,
  });
  const signLabel = getZodiacSign(language, insight.sign);
  const houseLabel =
    insight.house != null
      ? language === 'en'
        ? `House ${insight.house}`
        : `${insight.house} дом`
      : language === 'en'
        ? 'House hidden'
        : 'Дом скрыт';

  return {
    entityType: 'planet',
    entityId: request.entityId,
    title: compact(content?.title) || insight.title,
    subtitle: compact(content?.subtitle) || `${signLabel} ${formatDegree(insight.degree)} · ${houseLabel}`,
    body: compact(content?.body) || insight.body,
    tags: insight.tags.filter((tag) => tag.id !== 'modality').slice(0, 2),
  };
}

function buildZodiacTags(sign: ZodiacSign, language: Language, planetsInSign: NatalPlanetKey[]): PlanetInsightTag[] {
  const element = getElementForSign(sign);
  const planetLabel =
    planetsInSign.length > 0
      ? planetsInSign
          .map((planetKey) => getPlanetDisplayName(planetKey, language))
          .slice(0, 2)
          .join(', ')
      : language === 'en'
        ? 'Background tone'
        : 'Фоновый стиль';

  const tags: PlanetInsightTag[] = [
    {
      id: 'element',
      label: language === 'en'
        ? `${getLocalizedElement(language, element)} element`
        : `Стихия: ${getLocalizedElement(language, element)}`,
      tone: ELEMENT_TAG_TONES[element],
    },
    {
      id: planetsInSign.length > 0 ? 'planets' : 'role',
      label: planetLabel,
      tone: 'neutral',
    },
  ];

  return tags;
}

function buildZodiacFallbackBody(chartData: NatalChartData, sign: ZodiacSign, language: Language) {
  const signLabel = getZodiacSign(language, sign);
  const planetsInSign = listPlanetsInSign(chartData, sign)
    .map((planetKey) => getPlanetDisplayName(planetKey, language))
    .slice(0, 3);

  if (language === 'en') {
    if (planetsInSign.length) {
      return `${signLabel} is not just a symbol here: it comes through ${planetsInSign.join(', ')}. This shows where your chart uses this sign as a living style of reaction, desire, and choice.`;
    }
    return `${signLabel} works as a quieter backdrop in this wheel. It still colors the way a theme opens, but it does not need to dominate the chart to matter.`;
  }

  if (planetsInSign.length) {
    return `${signLabel} здесь не просто значок на круге: он проявляется через ${planetsInSign.join(', ')}. Так карта показывает, где этот знак становится живым стилем реакции, желания и выбора.`;
  }
  return `${signLabel} в этом колесе работает тише, как фон для темы. Он не обязан быть главным акцентом, чтобы окрашивать то, как эта часть карты раскрывается.`;
}

function buildZodiacWheelInsight(
  chartData: NatalChartData,
  request: WheelZodiacEntity,
  language: Language,
  content?: WheelInsightContentOverride
): WheelInsight {
  const signLabel = getZodiacSign(language, request.entityId);
  const planetsInSign = listPlanetsInSign(chartData, request.entityId);

  return {
    entityType: 'zodiac',
    entityId: request.entityId,
    title: compact(content?.title) || signLabel,
    subtitle: compact(content?.subtitle) || (language === 'en' ? 'How this sign sounds in your chart' : 'Как этот знак звучит в твоей карте'),
    body: compact(content?.body) || buildZodiacFallbackBody(chartData, request.entityId, language),
    tags: buildZodiacTags(request.entityId, language, planetsInSign),
  };
}

function buildHouseTags(
  chartData: NatalChartData,
  houseNumber: number,
  language: Language
): PlanetInsightTag[] {
  const house = findHouse(chartData, houseNumber);
  const sign = house?.sign as ZodiacSign | undefined;
  const planets = listPlanetsInHouse(chartData, houseNumber);

  return [
    {
      id: 'theme',
      label: localizeHouseShort(houseNumber, language),
      tone: 'neutral',
    },
    {
      id: 'cusp',
      label:
        sign
          ? (language === 'en' ? `Cusp · ${getZodiacSign(language, sign)}` : `Куспид · ${getZodiacSign(language, sign)}`)
          : (language === 'en' ? 'Cusp · Hidden' : 'Куспид · Скрыт'),
      tone: sign ? getZodiacElementStyle(sign).tagTone : 'neutral',
    },
    {
      id: 'occupants',
      label:
        language === 'en'
          ? `${planets.length} planet${planets.length === 1 ? '' : 's'} inside`
          : `${planets.length} планет внутри`,
      tone: 'neutral',
    },
  ];
}

function buildHouseFallbackBody(chartData: NatalChartData, houseNumber: number, language: Language) {
  const base = HOUSE_THEME_COPY[houseNumber]?.[normalizeLanguage(language)] || '';
  const house = findHouse(chartData, houseNumber);
  const signLabel = house?.sign ? getZodiacSign(language, house.sign) : language === 'en' ? 'Hidden sign' : 'Скрытый знак';
  const planets = listPlanetsInHouse(chartData, houseNumber)
    .map((planetKey) => getPlanetDisplayName(planetKey, language))
    .slice(0, 3);

  if (language === 'en') {
    const emphasis = planets.length
      ? ` In your chart this house is colored by ${planets.join(', ')}.`
      : ` Its cusp opens through ${signLabel}.`;
    return `${base}${emphasis}`;
  }

  const emphasis = planets.length
    ? ` В твоей карте эту тему дополнительно окрашивают ${planets.join(', ')}.`
    : ` Куспид этого дома открывается через знак ${signLabel}.`;
  return `${base}${emphasis}`;
}

function buildHouseWheelInsight(
  chartData: NatalChartData,
  request: WheelHouseEntity,
  language: Language,
  content?: WheelInsightContentOverride
): WheelInsight {
  const house = findHouse(chartData, request.houseNumber);
  const signLabel = house?.sign ? getZodiacSign(language, house.sign) : language === 'en' ? 'Hidden sign' : 'Скрытый знак';
  const houseLabel =
    language === 'en' ? `House ${request.houseNumber}` : `${request.houseNumber} дом`;

  return {
    entityType: 'house',
    entityId: request.entityId,
    title: compact(content?.title) || houseLabel,
    subtitle: compact(content?.subtitle) || `${localizeHouseShort(request.houseNumber, language)} · ${signLabel}`,
    body: compact(content?.body) || buildHouseFallbackBody(chartData, request.houseNumber, language),
    tags: buildHouseTags(chartData, request.houseNumber, language),
  };
}

function findAspectOrb(chartData: NatalChartData, request: WheelAspectEntity) {
  if (!Array.isArray(chartData.aspects)) return null;
  const candidates = chartData.aspects.filter((aspect) => aspect.type === request.aspectType);
  for (const aspect of candidates) {
    const from = normalizePlanetKey(aspect.from);
    const to = normalizePlanetKey(aspect.to);
    if (!from || !to) continue;
    const canonical = buildAspectEntityId(from, to, aspect.type);
    if (canonical === request.entityId) return aspect.orb;
  }
  return null;
}

function buildAspectLegend(language: Language): WheelInsight['legend'] {
  return [
    {
      id: 'harmony',
      label: language === 'en' ? 'Trine / sextile — harmony' : 'Трин / секстиль — гармония',
      color: '#52A96B',
    },
    {
      id: 'challenge',
      label: language === 'en' ? 'Square / opposition — challenge' : 'Квадрат / оппозиция — вызов',
      color: '#E05B54',
    },
    {
      id: 'intensity',
      label: language === 'en' ? 'Conjunction — intensity' : 'Соединение — усиление',
      color: '#7B5EA7',
    },
  ];
}

function buildAspectTags(
  chartData: NatalChartData,
  request: WheelAspectEntity,
  language: Language
): PlanetInsightTag[] {
  const orb = findAspectOrb(chartData, request);
  return [
    {
      id: 'aspect-type',
      label: localizeAspectLabel(request.aspectType, language),
      tone: 'neutral',
    },
    {
      id: 'aspect-tone',
      label: localizeAspectTone(request.aspectType, language),
      tone: 'neutral',
    },
    {
      id: 'orb',
      label:
        orb == null
          ? language === 'en'
            ? 'Orb hidden'
            : 'Орб скрыт'
          : language === 'en'
            ? `Orb ${Math.round(orb * 10) / 10}°`
            : `Орб ${Math.round(orb * 10) / 10}°`,
      tone: 'neutral',
    },
  ];
}

function buildAspectFallbackBody(chartData: NatalChartData, request: WheelAspectEntity, language: Language) {
  const fromLabel = getPlanetDisplayName(request.from, language);
  const toLabel = getPlanetDisplayName(request.to, language);
  const aspectLabel = localizeAspectLabel(request.aspectType, language).toLowerCase();

  if (language === 'en') {
    if (request.aspectType === 'conjunction') {
      return `${fromLabel} and ${toLabel} are fused through a conjunction, so these two parts of you tend to speak in one voice. This aspect intensifies the theme and makes it feel immediate, visible, and hard to ignore.`;
    }
    if (request.aspectType === 'trine' || request.aspectType === 'sextile') {
      return `${fromLabel} and ${toLabel} are connected through a ${aspectLabel}, so this part of your chart tends to flow more naturally. It shows where your inner strengths can support each other without too much force.`;
    }
    return `${fromLabel} and ${toLabel} meet through a ${aspectLabel}, so these two needs may pull in different directions before they learn how to work together. This tension can become a strong source of growth once you notice its pattern.`;
  }

  if (request.aspectType === 'conjunction') {
    return `${fromLabel} и ${toLabel} соединены, поэтому эти две части тебя часто звучат как один мощный голос. Такой аспект усиливает тему и делает её особенно заметной в жизни.`;
  }
  if (request.aspectType === 'trine' || request.aspectType === 'sextile') {
    return `${fromLabel} и ${toLabel} связаны через ${aspectLabel}, поэтому эта часть карты течёт мягче и естественнее. Здесь твои внутренние силы легче поддерживают друг друга без лишнего напряжения.`;
  }
  return `${fromLabel} и ${toLabel} встречаются через ${aspectLabel}, поэтому эти две потребности могут сначала тянуть в разные стороны. Когда ты замечаешь этот паттерн, он становится не слабостью, а точкой роста.`;
}

function buildAspectWheelInsight(
  chartData: NatalChartData,
  request: WheelAspectEntity,
  language: Language,
  content?: WheelInsightContentOverride
): WheelInsight {
  const fromLabel = getPlanetDisplayName(request.from, language);
  const toLabel = getPlanetDisplayName(request.to, language);
  const aspectLabel = localizeAspectLabel(request.aspectType, language);

  return {
    entityType: 'aspect',
    entityId: request.entityId,
    title: compact(content?.title) || `${fromLabel} ↔ ${toLabel}`,
    subtitle: compact(content?.subtitle) || `${aspectLabel} · ${localizeAspectTone(request.aspectType, language)}`,
    body: compact(content?.body) || buildAspectFallbackBody(chartData, request, language),
    tags: buildAspectTags(chartData, request, language),
    legend: buildAspectLegend(language),
  };
}

export function buildWheelInsight(
  chartData: NatalChartData,
  request: WheelInsightRequest,
  language: Language,
  content?: WheelInsightContentOverride
): WheelInsight {
  switch (request.entityType) {
    case 'planet':
      return buildPlanetWheelInsight(chartData, request, language, content);
    case 'zodiac':
      return buildZodiacWheelInsight(chartData, request, language, content);
    case 'house':
      return buildHouseWheelInsight(chartData, request, language, content);
    case 'aspect':
      return buildAspectWheelInsight(chartData, request, language, content);
    default:
      throw new Error('Unsupported wheel entity');
  }
}
