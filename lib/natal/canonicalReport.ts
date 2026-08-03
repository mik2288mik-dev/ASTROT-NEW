import type {
  NatalAngleV2,
  NatalBodyKey,
  NatalChartDataV2,
  NatalPositionV2,
} from '../natalChartV2Types';
import {
  compileNatalChartFacts,
  type AspectPriority,
  type ChartStellium,
  type NatalChartFacts,
  type PlanetPriority,
  type WeightedBalance,
} from './chartFacts';

export type CanonicalPlacement = Pick<NatalPositionV2, 'key' | 'sign' | 'degree' | 'longitude' | 'retrograde'>;
export type CanonicalAngle = Pick<NatalAngleV2, 'key' | 'sign' | 'degree' | 'longitude'>;

export interface CoreIdentityBlock {
  sun: CanonicalPlacement;
  moon: CanonicalPlacement;
  dominantPlanets: PlanetPriority[];
  ascendant?: CanonicalAngle;
}

export interface DominantPatternsBlock {
  stelliums: ChartStellium[];
  elements: WeightedBalance<'fire' | 'earth' | 'air' | 'water'>;
  modalities: WeightedBalance<'cardinal' | 'fixed' | 'mutable'>;
  dominantSigns: NatalChartFacts['dominantSigns'];
  dominantPlanets: PlanetPriority[];
}

export interface MajorAspectsBlock {
  aspects: AspectPriority[];
}

export interface HousePlacement {
  planet: NatalBodyKey;
  sign: string;
  house: number;
  reliability: 'high' | 'low';
}

export interface HousePlacementsBlock {
  reliability: 'high' | 'low';
  placements: HousePlacement[];
}

export interface CanonicalNatalReport {
  schemaVersion: 'canonical-natal-report-v1';
  calculationVersion: string;
  birthTimeQuality: NatalChartDataV2['birthTimeQuality'];
  CoreIdentity: CoreIdentityBlock;
  DominantPatterns: DominantPatternsBlock;
  MajorAspects: MajorAspectsBlock;
  HousePlacements?: HousePlacementsBlock;
}

export function isNatalChartDataV2(value: unknown): value is NatalChartDataV2 {
  return !!value
    && typeof value === 'object'
    && (value as { schemaVersion?: unknown }).schemaVersion === 'natal-chart-data-v2';
}

function placement(position: NatalPositionV2): CanonicalPlacement {
  return {
    key: position.key,
    sign: position.sign,
    degree: position.degree,
    longitude: position.longitude,
    retrograde: position.retrograde,
  };
}

function angle(value: NatalAngleV2): CanonicalAngle {
  return {
    key: value.key,
    sign: value.sign,
    degree: value.degree,
    longitude: value.longitude,
  };
}

/** Returns undefined for unknown birth time, so house data is absent from serialized reports. */
export function safelyExtractHousePlacements(chart: NatalChartDataV2): HousePlacementsBlock | undefined {
  if (chart.birthTimeQuality === 'unknown') return undefined;

  const reliability: HousePlacement['reliability'] = chart.birthTimeQuality === 'approximate' ? 'low' : 'high';
  const placements = (Object.keys(chart.positions) as NatalBodyKey[])
    .map((planet) => ({ planet, position: chart.positions[planet] }))
    .filter(({ position }) => position.house != null)
    .map(({ planet, position }) => ({
      planet,
      sign: position.sign,
      house: position.house as number,
      reliability,
    }));

  return { reliability, placements };
}

/** Builds a deterministic technical report without copy generation or model calls. */
export function buildCanonicalNatalReport(
  chart: NatalChartDataV2,
  facts: NatalChartFacts = compileNatalChartFacts(chart),
): CanonicalNatalReport {
  const housePlacements = safelyExtractHousePlacements(chart);
  const ascendant = chart.birthTimeQuality === 'unknown' ? undefined : chart.angles.ascendant;

  return {
    schemaVersion: 'canonical-natal-report-v1',
    calculationVersion: chart.calculationVersion,
    birthTimeQuality: chart.birthTimeQuality,
    CoreIdentity: {
      sun: placement(chart.sun),
      moon: placement(chart.moon),
      dominantPlanets: facts.dominantPlanets.slice(0, 3),
      ...(ascendant ? { ascendant: angle(ascendant) } : {}),
    },
    DominantPatterns: {
      stelliums: facts.stelliums,
      elements: facts.balance.elements,
      modalities: facts.balance.modalities,
      dominantSigns: facts.dominantSigns,
      dominantPlanets: facts.dominantPlanets,
    },
    MajorAspects: {
      aspects: facts.aspects.filter((aspect) => aspect.priority === 'key'),
    },
    ...(housePlacements ? { HousePlacements: housePlacements } : {}),
  };
}
