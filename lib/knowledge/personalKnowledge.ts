import type { NatalAspectData, NatalChartData } from '../../types';
import type { NatalAngleKey, NatalBodyKey } from '../natalChartV2Types';
import type {
  KnowledgeAspectType,
  KnowledgeLanguage,
  KnowledgeTopic,
  PersonalKnowledgeReliability,
  PersonalKnowledgeResult,
} from './types';

const BODY_KEYS: readonly NatalBodyKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto', 'chiron', 'northNode', 'southNode',
];

const BODY_LABELS: Record<NatalBodyKey, Record<KnowledgeLanguage, string>> = {
  sun: { ru: 'Солнце', en: 'Sun' },
  moon: { ru: 'Луна', en: 'Moon' },
  mercury: { ru: 'Меркурий', en: 'Mercury' },
  venus: { ru: 'Венера', en: 'Venus' },
  mars: { ru: 'Марс', en: 'Mars' },
  jupiter: { ru: 'Юпитер', en: 'Jupiter' },
  saturn: { ru: 'Сатурн', en: 'Saturn' },
  uranus: { ru: 'Уран', en: 'Uranus' },
  neptune: { ru: 'Нептун', en: 'Neptune' },
  pluto: { ru: 'Плутон', en: 'Pluto' },
  chiron: { ru: 'Хирон', en: 'Chiron' },
  northNode: { ru: 'Северный узел', en: 'North Node' },
  southNode: { ru: 'Южный узел', en: 'South Node' },
};

const BODY_RU_INSTRUMENTAL: Record<NatalBodyKey, string> = {
  sun: 'Солнцем', moon: 'Луной', mercury: 'Меркурием', venus: 'Венерой', mars: 'Марсом',
  jupiter: 'Юпитером', saturn: 'Сатурном', uranus: 'Ураном', neptune: 'Нептуном',
  pluto: 'Плутоном', chiron: 'Хироном', northNode: 'Северным узлом', southNode: 'Южным узлом',
};

const ANGLE_LABELS: Record<NatalAngleKey, Record<KnowledgeLanguage, string>> = {
  ascendant: { ru: 'Асцендент', en: 'Ascendant' },
  descendant: { ru: 'Десцендент', en: 'Descendant' },
  mc: { ru: 'MC', en: 'MC' },
  ic: { ru: 'IC', en: 'IC' },
};

const SIGN_RU: Record<string, string> = {
  aries: 'Овен', taurus: 'Телец', gemini: 'Близнецы', cancer: 'Рак',
  leo: 'Лев', virgo: 'Дева', libra: 'Весы', scorpio: 'Скорпион',
  sagittarius: 'Стрелец', capricorn: 'Козерог', aquarius: 'Водолей', pisces: 'Рыбы',
};

const SIGN_RU_PREPOSITIONAL: Record<string, string> = {
  aries: 'в Овне', taurus: 'в Тельце', gemini: 'в Близнецах', cancer: 'в Раке',
  leo: 'во Льве', virgo: 'в Деве', libra: 'в Весах', scorpio: 'в Скорпионе',
  sagittarius: 'в Стрельце', capricorn: 'в Козероге', aquarius: 'в Водолее', pisces: 'в Рыбах',
};

const SIGN_RU_GENITIVE: Record<string, string> = {
  aries: 'Овна', taurus: 'Тельца', gemini: 'Близнецов', cancer: 'Рака',
  leo: 'Льва', virgo: 'Девы', libra: 'Весов', scorpio: 'Скорпиона',
  sagittarius: 'Стрельца', capricorn: 'Козерога', aquarius: 'Водолея', pisces: 'Рыб',
};

const ASPECT_LABELS: Record<string, Record<KnowledgeLanguage, string>> = {
  conjunction: { ru: 'соединение', en: 'conjunction' },
  sextile: { ru: 'секстиль', en: 'sextile' },
  square: { ru: 'квадрат', en: 'square' },
  trine: { ru: 'трин', en: 'trine' },
  opposition: { ru: 'оппозиция', en: 'opposition' },
};

const ASPECT_QUESTION_LABELS: Record<KnowledgeAspectType, Record<KnowledgeLanguage, string>> = {
  conjunction: { ru: 'соединения', en: 'conjunctions' },
  sextile: { ru: 'секстили', en: 'sextiles' },
  square: { ru: 'квадраты', en: 'squares' },
  trine: { ru: 'трины', en: 'trines' },
  opposition: { ru: 'оппозиции', en: 'oppositions' },
};

type RawPosition = {
  planet?: string;
  sign?: string;
  degree?: number;
  longitude?: number;
  house?: string | number | null;
  retrograde?: boolean | null;
  speedLongitude?: number;
  key?: NatalBodyKey;
  reliability?: string;
  stable?: { sign?: boolean; retrograde?: boolean; house?: boolean };
};

type RawAspect = Partial<NatalAspectData> & {
  id?: string;
  fromKey?: string;
  toKey?: string;
  reliable?: boolean;
};

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('en-US').replace(/[\s_-]+/g, '');
}

function finite(value: unknown): number | null {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function signLabel(sign: unknown, language: KnowledgeLanguage): string {
  const value = String(sign ?? '').trim();
  if (!value) return '';
  return language === 'ru' ? SIGN_RU[value.toLocaleLowerCase('en-US')] || value : value;
}

function bodyKey(value: unknown): NatalBodyKey | null {
  const normalized = normalize(value);
  const aliases: Record<string, NatalBodyKey> = {
    sun: 'sun', солнце: 'sun', moon: 'moon', луна: 'moon', mercury: 'mercury', меркурий: 'mercury',
    venus: 'venus', венера: 'venus', mars: 'mars', марс: 'mars', jupiter: 'jupiter', юпитер: 'jupiter',
    saturn: 'saturn', сатурн: 'saturn', uranus: 'uranus', уран: 'uranus', neptune: 'neptune', нептун: 'neptune',
    pluto: 'pluto', плутон: 'pluto', chiron: 'chiron', хирон: 'chiron', northnode: 'northNode',
    северныйузел: 'northNode', southnode: 'southNode', южныйузел: 'southNode',
  };
  return aliases[normalized] || null;
}

function angleKey(value: unknown): NatalAngleKey | null {
  const aliases: Record<string, NatalAngleKey> = {
    ascendant: 'ascendant', asc: 'ascendant', rising: 'ascendant', асцендент: 'ascendant',
    descendant: 'descendant', desc: 'descendant', dsc: 'descendant', десцендент: 'descendant',
    mc: 'mc', midheaven: 'mc', мс: 'mc', ic: 'ic', надир: 'ic',
  };
  return aliases[normalize(value)] || null;
}

function positionFor(chart: NatalChartData, key: NatalBodyKey): RawPosition | null {
  const fromV2 = chart.positions?.[key];
  if (fromV2) return fromV2;
  const legacy = chart[key as keyof NatalChartData];
  return legacy && typeof legacy === 'object' ? legacy as RawPosition : null;
}

function reliableSign(position: RawPosition | null): string {
  if (!position?.sign || position.reliability === 'variable_in_range' || position.stable?.sign === false) return '';
  return String(position.sign);
}

function reliableHouse(
  position: RawPosition | null,
  reliability: PersonalKnowledgeReliability,
  stableHousePlacements: ReadonlySet<string>,
): number | null {
  if (!position || !reliability.housesIncluded) return null;
  if (
    reliability.quality !== 'exact'
    && position.stable?.house !== true
    && !stableHousePlacements.has(String(position.key || ''))
  ) return null;
  const house = finite(position.house);
  return house && house >= 1 && house <= 12 ? house : null;
}

function reliableRetrograde(
  position: RawPosition | null,
  reliability: PersonalKnowledgeReliability,
): boolean {
  if (!position || position.retrograde !== true) return false;
  return reliability.quality === 'exact'
    || position.stable?.retrograde === true
    || (!position.reliability && reliability.quality !== 'approximate');
}

function aspects(chart: NatalChartData): RawAspect[] {
  const variableIds = new Set(
    Array.isArray((chart.chartQuality as { variableAspectIds?: unknown[] } | undefined)?.variableAspectIds)
      ? ((chart.chartQuality as { variableAspectIds?: unknown[] }).variableAspectIds || []).map(String)
      : [],
  );
  return (chart.aspects || [])
    .map((aspect) => aspect as RawAspect)
    .filter((aspect) => aspect.reliable !== false && !variableIds.has(String(aspect.id || '')))
    .sort((left, right) => (finite(left.orb) ?? 99) - (finite(right.orb) ?? 99));
}

function aspectEndpointKey(aspect: RawAspect, side: 'from' | 'to'): NatalBodyKey | null {
  return bodyKey(side === 'from' ? aspect.fromKey || aspect.from : aspect.toKey || aspect.to);
}

function aspectUsesUnreliableAngle(aspect: RawAspect, reliability: PersonalKnowledgeReliability): boolean {
  if (reliability.quality === 'exact') return false;
  const from = angleKey(aspect.fromKey || aspect.from);
  const to = angleKey(aspect.toKey || aspect.to);
  return Boolean((from || to) && !reliability.anglesIncluded);
}

function aspectFact(aspect: RawAspect, language: KnowledgeLanguage): string | null {
  const from = aspectEndpointKey(aspect, 'from');
  const to = aspectEndpointKey(aspect, 'to');
  const type = ASPECT_LABELS[String(aspect.type || '')]?.[language];
  if (!from || !to || !type) return null;
  const fromLabel = BODY_LABELS[from][language];
  const toLabel = BODY_LABELS[to][language];
  return language === 'ru'
    ? `${fromLabel} — ${type} — ${toLabel}`
    : `${fromLabel} — ${type} — ${toLabel}`;
}

function planetAspectFact(
  aspect: RawAspect,
  planet: NatalBodyKey,
  language: KnowledgeLanguage,
): string | null {
  const from = aspectEndpointKey(aspect, 'from');
  const to = aspectEndpointKey(aspect, 'to');
  const other = from === planet ? to : to === planet ? from : null;
  const type = ASPECT_LABELS[String(aspect.type || '')]?.[language];
  if (!other || !type) return null;
  const title = `${type.charAt(0).toLocaleUpperCase(language === 'ru' ? 'ru-RU' : 'en-US')}${type.slice(1)}`;
  return language === 'ru'
    ? `${title} с ${BODY_RU_INSTRUMENTAL[other]}`
    : `${title} with ${BODY_LABELS[other].en}`;
}

function planetQuestion(
  key: NatalBodyKey,
  sign: string,
  language: KnowledgeLanguage,
  relationships: boolean,
): string {
  const label = BODY_LABELS[key][language];
  if (language === 'en') {
    if (relationships) return `What does my ${label} mean in relationships?`;
    return sign ? `What does my ${label} in ${sign} mean?` : `What does my ${label} mean?`;
  }
  const possessive = key === 'sun' ? 'моё' : key === 'moon' || key === 'venus' ? 'моя' : 'мой';
  if (relationships) return `Что значит ${possessive} ${label} в отношениях?`;
  const where = SIGN_RU_PREPOSITIONAL[sign.toLocaleLowerCase('en-US')];
  return where
    ? `Что значит ${possessive} ${label} ${where}?`
    : `Что значит ${possessive} ${label}?`;
}

function timeSensitiveUnavailable(): PersonalKnowledgeResult {
  return { status: 'requires_exact_birth_time', facts: [] };
}

/** Formats a few already-calculated chart facts. It performs no ephemeris or AI work. */
export function resolvePersonalKnowledge(
  topic: KnowledgeTopic,
  chart: NatalChartData | null | undefined,
  reliability: PersonalKnowledgeReliability | null | undefined,
  language: KnowledgeLanguage = 'ru',
): PersonalKnowledgeResult | null {
  const kind = topic.personalizationKind;
  if (!kind || !chart || !reliability) return null;
  const stableHousePlacements = new Set(
    Array.isArray((chart.chartQuality as { stableHousePlacements?: unknown[] } | undefined)?.stableHousePlacements)
      ? ((chart.chartQuality as { stableHousePlacements?: unknown[] }).stableHousePlacements || []).map(String)
      : [],
  );

  if (kind.type === 'planet') {
    const position = positionFor(chart, kind.key);
    const rawSign = reliableSign(position);
    if (!position || !rawSign) return null;
    const label = BODY_LABELS[kind.key][language];
    const facts: string[] = [`${label} — ${signLabel(rawSign, language)}`];
    const house = reliableHouse(position, reliability, stableHousePlacements);
    if (house) facts.push(language === 'ru' ? `${house} дом` : `House ${house}`);
    const linkedAspect = aspects(chart).find((aspect) => (
      !aspectUsesUnreliableAngle(aspect, reliability)
      && (aspectEndpointKey(aspect, 'from') === kind.key || aspectEndpointKey(aspect, 'to') === kind.key)
    ));
    const linkedFact = linkedAspect ? planetAspectFact(linkedAspect, kind.key, language) : null;
    if (linkedFact) facts.push(linkedFact);
    return {
      status: 'ready',
      facts: facts.slice(0, 3),
      suggestedQuestion: planetQuestion(
        kind.key,
        rawSign,
        language,
        kind.questionKind === 'relationships',
      ),
    };
  }

  if (kind.type === 'angle') {
    if (!reliability.anglesIncluded) return timeSensitiveUnavailable();
    const raw = (chart.angles?.[kind.key]
      || (kind.key === 'ascendant' ? chart.rising : kind.key === 'mc' ? chart.mc : null)) as {
        sign?: string;
        reliability?: string;
        stableSign?: boolean;
      } | null;
    if (!raw || raw.reliability === 'variable_in_range' || (reliability.quality !== 'exact' && raw.stableSign !== true)) {
      return timeSensitiveUnavailable();
    }
    const sign = signLabel(raw.sign, language);
    if (!sign) return timeSensitiveUnavailable();
    const label = ANGLE_LABELS[kind.key][language];
    return {
      status: 'ready',
      facts: [`${label} — ${sign}`],
      suggestedQuestion: language === 'ru'
        ? `Что значит мой ${label}?`
        : `What does my ${label} mean?`,
    };
  }

  if (kind.type === 'house') {
    if (!reliability.housesIncluded) return timeSensitiveUnavailable();
    const placements = BODY_KEYS.flatMap((key) => {
      const position = positionFor(chart, key);
      return reliableHouse(position, reliability, stableHousePlacements) === kind.house ? [BODY_LABELS[key][language]] : [];
    });
    const rawCusp = (chart.houses || []).find((candidate) => candidate.house === kind.house) as {
      sign?: string;
      reliability?: string;
      stableSign?: boolean;
    } | undefined;
    const cusp = rawCusp
      && rawCusp.reliability !== 'variable_in_range'
      && (reliability.quality === 'exact' || rawCusp.stableSign === true)
        ? rawCusp
        : null;
    if (!placements.length && !cusp) return timeSensitiveUnavailable();
    const facts = placements.length
      ? placements.slice(0, 3).map((label, index) => (
          index === 0
            ? (language === 'ru' ? `В ${kind.house} доме: ${label}` : `In house ${kind.house}: ${label}`)
            : label
        ))
      : [language === 'ru'
          ? `${kind.house} дом начинается в знаке ${signLabel(cusp?.sign, language)}`
          : `House ${kind.house} begins in ${signLabel(cusp?.sign, language)}`];
    return {
      status: 'ready',
      facts,
      suggestedQuestion: language === 'ru'
        ? `Что значит мой ${kind.house} дом?`
        : `What does my house ${kind.house} mean?`,
    };
  }

  if (kind.type === 'sign') {
    const placements = BODY_KEYS.flatMap((key) => {
      const position = positionFor(chart, key);
      return normalize(reliableSign(position)) === normalize(kind.sign) ? [BODY_LABELS[key][language]] : [];
    });
    if (!placements.length) return null;
    const sign = signLabel(kind.sign, language);
    const genitive = SIGN_RU_GENITIVE[kind.sign.toLocaleLowerCase('en-US')] || sign;
    return {
      status: 'ready',
      facts: placements.slice(0, 3).map((label, index) => (
        index === 0
          ? (language === 'ru' ? `В знаке ${genitive}: ${label}` : `In ${sign}: ${label}`)
          : label
      )),
      suggestedQuestion: language === 'ru'
        ? `Что значит знак ${genitive} в моей карте?`
        : `What does ${sign} mean in my chart?`,
    };
  }

  if (kind.type === 'aspects') {
    const facts = aspects(chart)
      .filter((aspect) => !aspectUsesUnreliableAngle(aspect, reliability))
      .filter((aspect) => !kind.aspectType || aspect.type === kind.aspectType)
      .map((aspect) => aspectFact(aspect, language))
      .filter((fact): fact is string => Boolean(fact))
      .slice(0, 3);
    if (!facts.length) return null;
    return {
      status: 'ready',
      facts,
      suggestedQuestion: kind.aspectType
        ? (language === 'ru'
            ? `Что значат ${ASPECT_QUESTION_LABELS[kind.aspectType].ru} в моей натальной карте?`
            : `What do ${ASPECT_QUESTION_LABELS[kind.aspectType].en} mean in my natal chart?`)
        : (language === 'ru'
            ? 'Что значат мои главные аспекты?'
            : 'What do the main aspects in my chart mean?'),
    };
  }

  if (kind.type === 'retrogrades') {
    const facts = BODY_KEYS.flatMap((key) => (
      reliableRetrograde(positionFor(chart, key), reliability)
        ? [language === 'ru'
            ? `${BODY_LABELS[key].ru} — ${key === 'sun' ? 'ретроградное' : key === 'moon' || key === 'venus' ? 'ретроградная' : 'ретроградный'}`
            : `${BODY_LABELS[key].en} — retrograde`]
        : []
    )).slice(0, 3);
    if (!facts.length) return null;
    return {
      status: 'ready',
      facts,
      suggestedQuestion: language === 'ru'
        ? 'Что значит ретроградность в моей натальной карте?'
        : 'What does retrograde motion mean in my natal chart?',
    };
  }

  const nodeFacts = (['northNode', 'southNode'] as const).flatMap((key) => {
    const sign = reliableSign(positionFor(chart, key));
    return sign ? [`${BODY_LABELS[key][language]} — ${signLabel(sign, language)}`] : [];
  });
  if (!nodeFacts.length) return null;
  return {
    status: 'ready',
    facts: nodeFacts,
    suggestedQuestion: language === 'ru'
      ? 'Что значат мои лунные узлы?'
      : 'What do my lunar nodes mean?',
  };
}
