import type {
  NatalAspectType,
  NatalBodyKey,
  NatalChartDataV2,
  NatalPositionV2,
} from '../natalChartV2Types';

export type ChartElement = 'fire' | 'earth' | 'air' | 'water';
export type ChartModality = 'cardinal' | 'fixed' | 'mutable';
export type FactReliability = 'high' | 'low';

type CountMap<T extends string> = Record<T, number>;

const ELEMENTS: Record<string, ChartElement> = {
  aries: 'fire', leo: 'fire', sagittarius: 'fire',
  taurus: 'earth', virgo: 'earth', capricorn: 'earth',
  gemini: 'air', libra: 'air', aquarius: 'air',
  cancer: 'water', scorpio: 'water', pisces: 'water',
};

const MODALITIES: Record<string, ChartModality> = {
  aries: 'cardinal', cancer: 'cardinal', libra: 'cardinal', capricorn: 'cardinal',
  taurus: 'fixed', leo: 'fixed', scorpio: 'fixed', aquarius: 'fixed',
  gemini: 'mutable', virgo: 'mutable', sagittarius: 'mutable', pisces: 'mutable',
};

const PLANET_WEIGHT: Record<NatalBodyKey, number> = {
  sun: 1.35, moon: 1.3, mercury: 1, venus: 1, mars: 1.1, jupiter: 0.8,
  saturn: 0.9, uranus: 0.55, neptune: 0.55, pluto: 0.6, chiron: 0.45,
  northNode: 0.35, southNode: 0.35,
};

const ASPECT_WEIGHT: Record<NatalAspectType, number> = {
  conjunction: 1.25, opposition: 1.15, square: 1.1, trine: 0.9, sextile: 0.7,
};

const BALANCE_PLANETS: NatalBodyKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto',
];

const STELLIUM_PLANETS: NatalBodyKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto',
];

export type WeightedBalance<T extends string> = {
  counts: CountMap<T>;
  shares: CountMap<T>;
  dominant: T[];
  totalWeight: number;
};

export type ChartStellium = {
  sign: string;
  planets: NatalBodyKey[];
  weight: number;
};

export type PlanetPriority = {
  planet: NatalBodyKey;
  sign: string;
  house?: number;
  score: number;
  aspectScore: number;
  reliability: FactReliability;
};

export type AspectPriority = {
  id: string;
  type: NatalAspectType;
  from: string;
  to: string;
  orb: number;
  score: number;
  priority: 'key' | 'secondary';
};

export type NatalChartFacts = {
  schemaVersion: 'natal-chart-facts-v1';
  calculationVersion: string;
  birthTimeQuality: NatalChartDataV2['birthTimeQuality'];
  reliability: {
    angles: FactReliability | 'excluded';
    houses: FactReliability | 'excluded';
    houseRulers: FactReliability | 'excluded';
  };
  balance: {
    elements: WeightedBalance<ChartElement>;
    modalities: WeightedBalance<ChartModality>;
  };
  stelliums: ChartStellium[];
  dominantSigns: Array<{ sign: string; score: number }>;
  dominantPlanets: PlanetPriority[];
  aspects: AspectPriority[];
};

function emptyCounts<T extends string>(keys: readonly T[]): CountMap<T> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as CountMap<T>;
}

function normalizeSign(sign: string): string {
  return sign.trim().toLowerCase();
}

function weightedBalance<T extends string>(
  chart: NatalChartDataV2,
  mapping: Record<string, T>,
  keys: readonly T[],
): WeightedBalance<T> {
  const counts = emptyCounts(keys);
  for (const key of BALANCE_PLANETS) {
    const value = mapping[normalizeSign(chart.positions[key].sign)];
    if (value) counts[value] += PLANET_WEIGHT[key];
  }
  const totalWeight = keys.reduce((sum, key) => sum + counts[key], 0);
  const shares = emptyCounts(keys);
  for (const key of keys) shares[key] = totalWeight ? Number((counts[key] / totalWeight).toFixed(4)) : 0;
  const high = Math.max(...keys.map((key) => counts[key]));
  const dominant = totalWeight ? keys.filter((key) => counts[key] === high) : [];
  return { counts, shares, dominant, totalWeight };
}

function isAngleKey(value: string): boolean {
  return value === 'ascendant' || value === 'mc' || value === 'descendant' || value === 'ic';
}

function aspectScore(type: NatalAspectType, orb: number, from: string, to: string): number {
  const orbFactor = Math.max(0.2, 1 - Math.min(Math.abs(orb), 12) / 12);
  const luminaryFactor = from === 'sun' || from === 'moon' || to === 'sun' || to === 'moon' ? 1.25 : 1;
  return Number((ASPECT_WEIGHT[type] * orbFactor * luminaryFactor).toFixed(4));
}

/** Builds deterministic natal facts from Swiss Ephemeris V2 data; it never generates prose. */
export function compileNatalChartFacts(chart: NatalChartDataV2): NatalChartFacts {
  const birthTimeQuality = chart.birthTimeQuality;
  const includeHouses = birthTimeQuality !== 'unknown';
  const angleReliability: FactReliability | 'excluded' = birthTimeQuality === 'unknown'
    ? 'excluded'
    : birthTimeQuality === 'approximate' ? 'low' : 'high';

  const usableAspects = chart.aspects.filter((aspect) => (
    birthTimeQuality !== 'unknown' || (!isAngleKey(aspect.fromKey) && !isAngleKey(aspect.toKey))
  ));
  const aspects = usableAspects
    .map((aspect) => {
      const score = aspectScore(aspect.type, aspect.orb, aspect.fromKey, aspect.toKey);
      return {
        id: aspect.id,
        type: aspect.type,
        from: aspect.fromKey,
        to: aspect.toKey,
        orb: aspect.orb,
        score,
        priority: score >= 0.72 ? 'key' : 'secondary',
      } satisfies AspectPriority;
    })
    .sort((left, right) => right.score - left.score || left.orb - right.orb);

  const aspectScores = new Map<NatalBodyKey, number>();
  for (const aspect of aspects) {
    for (const endpoint of [aspect.from, aspect.to]) {
      if (endpoint in PLANET_WEIGHT) {
        const key = endpoint as NatalBodyKey;
        aspectScores.set(key, (aspectScores.get(key) || 0) + aspect.score);
      }
    }
  }

  const signScores = new Map<string, number>();
  const bySign = new Map<string, NatalPositionV2[]>();
  for (const key of STELLIUM_PLANETS) {
    const position = chart.positions[key];
    const sign = normalizeSign(position.sign);
    signScores.set(sign, (signScores.get(sign) || 0) + PLANET_WEIGHT[key]);
    const positions = bySign.get(sign) || [];
    positions.push(position);
    bySign.set(sign, positions);
  }

  const stelliums = [...bySign.entries()]
    .filter(([, positions]) => positions.length >= 3)
    .map(([sign, positions]) => ({
      sign,
      planets: positions.map((position) => position.key),
      weight: Number(positions.reduce((sum, position) => sum + PLANET_WEIGHT[position.key], 0).toFixed(4)),
    }))
    .sort((left, right) => right.weight - left.weight || right.planets.length - left.planets.length);

  const dominantPlanets = (Object.keys(PLANET_WEIGHT) as NatalBodyKey[])
    .map((planet) => {
      const position = chart.positions[planet];
      const aspectsForPlanet = aspectScores.get(planet) || 0;
      const stelliumBonus = stelliums.some((group) => group.planets.includes(planet)) ? 0.5 : 0;
      return {
        planet,
        sign: normalizeSign(position.sign),
        ...(includeHouses && position.house != null ? { house: position.house } : {}),
        score: Number((PLANET_WEIGHT[planet] + aspectsForPlanet + stelliumBonus).toFixed(4)),
        aspectScore: Number(aspectsForPlanet.toFixed(4)),
        reliability: includeHouses && birthTimeQuality === 'approximate' && position.house != null ? 'low' : 'high',
      } satisfies PlanetPriority;
    })
    .sort((left, right) => right.score - left.score || right.aspectScore - left.aspectScore);

  return {
    schemaVersion: 'natal-chart-facts-v1',
    calculationVersion: chart.calculationVersion,
    birthTimeQuality,
    reliability: {
      angles: angleReliability,
      houses: angleReliability,
      houseRulers: angleReliability,
    },
    balance: {
      elements: weightedBalance(chart, ELEMENTS, ['fire', 'earth', 'air', 'water']),
      modalities: weightedBalance(chart, MODALITIES, ['cardinal', 'fixed', 'mutable']),
    },
    stelliums,
    dominantSigns: [...signScores.entries()]
      .map(([sign, score]) => ({ sign, score: Number(score.toFixed(4)) }))
      .sort((left, right) => right.score - left.score || left.sign.localeCompare(right.sign)),
    dominantPlanets,
    aspects,
  };
}
