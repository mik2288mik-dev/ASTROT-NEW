import type { BirthTimeInput, BirthTimeInterval, BirthTimeMode } from './birthTime';

export type NatalBodyKey =
  | 'sun'
  | 'moon'
  | 'mercury'
  | 'venus'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'chiron'
  | 'northNode'
  | 'southNode';

export type NatalAngleKey = 'ascendant' | 'mc' | 'descendant' | 'ic';
export type NatalReliability = 'exact' | 'stable_in_range' | 'variable_in_range';

export interface LongitudeRange {
  startLongitude: number;
  endLongitude: number;
  spanDegrees: number;
  signs: string[];
}

export interface NatalPositionV2 {
  object: string;
  key: NatalBodyKey;
  kind: 'planet' | 'lunar_node';
  longitude: number | null;
  sign: string | null;
  degree: number | null;
  retrograde: boolean | null;
  speedLongitude: number | null;
  house: number | null;
  source: 'swisseph' | 'derived';
  reliability: NatalReliability;
  stable: {
    sign: boolean;
    retrograde: boolean;
    house: boolean;
  };
  range?: LongitudeRange;
}

export interface NatalAngleV2 {
  key: NatalAngleKey;
  object: string;
  longitude: number | null;
  sign: string | null;
  degree: number | null;
  source: 'swisseph' | 'derived';
  reliability: NatalReliability;
  stableSign: boolean;
  range?: LongitudeRange;
}

export interface NatalHouseV2 {
  house: number;
  longitude: number | null;
  sign: string | null;
  degree: number | null;
  reliability: NatalReliability;
  stableSign: boolean;
  range?: LongitudeRange;
}

export type NatalAspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
export type NatalAspectPhase = 'applying' | 'separating' | 'exact' | 'mixed';

export interface NatalAspectV2 {
  id: string;
  type: NatalAspectType;
  exactAngle: number;
  angularDistance: number | null;
  orb: number | null;
  orbRange: {
    min: number;
    max: number;
  };
  from: string;
  to: string;
  fromKey: NatalBodyKey | NatalAngleKey;
  toKey: NatalBodyKey | NatalAngleKey;
  phase: NatalAspectPhase;
  reliable: boolean;
  sampleCoverage: number;
}

export interface NatalBirthContextV2 {
  localDate: string;
  localTime: string | null;
  place: string;
  latitude: number;
  longitude: number;
  timezone: string;
  time: BirthTimeInput;
  interval: BirthTimeInterval;
}

export interface NatalCalculationMetadataV2 {
  ephemerisEngine: 'Swiss Ephemeris';
  ephemerisMode: 'swisseph';
  ephemerisLibraryVersion: string;
  zodiac: 'tropical';
  coordinateCenter: 'geocentric';
  houseSystem: 'placidus' | 'whole_sign' | null;
  houseFallbackUsed: boolean;
  aspectRulesVersion: string;
  calculationVersion: string;
  calculatedAt: string;
  sampleCount: number;
}

export interface NatalChartQualityV2 {
  birthTimeMode: BirthTimeMode;
  exactTime: boolean;
  anglesAvailable: boolean;
  housesAvailable: boolean;
  stableHousePlacements: NatalBodyKey[];
  variableBodies: NatalBodyKey[];
  variableAngles: NatalAngleKey[];
  variableHouses: number[];
  variableAspectIds: string[];
  notes: string[];
}

export interface NatalChartDataV2 {
  schemaVersion: 'natal-chart-data-v2';
  birth: NatalBirthContextV2;
  positions: Record<NatalBodyKey, NatalPositionV2>;
  angles: Record<NatalAngleKey, NatalAngleV2 | null>;
  houses: NatalHouseV2[];
  aspects: NatalAspectV2[];
  chartQuality: NatalChartQualityV2;
  calculationMetadata: NatalCalculationMetadataV2;
  calculationVersion: string;

  // Compatibility accessors used by the current UI and forecast code.
  sun: NatalPositionV2;
  moon: NatalPositionV2;
  mercury: NatalPositionV2;
  venus: NatalPositionV2;
  mars: NatalPositionV2;
  jupiter: NatalPositionV2;
  saturn: NatalPositionV2;
  uranus: NatalPositionV2;
  neptune: NatalPositionV2;
  pluto: NatalPositionV2;
  chiron: NatalPositionV2;
  northNode: NatalPositionV2;
  southNode: NatalPositionV2;
  rising: NatalAngleV2 | null;
  mc: NatalAngleV2 | null;
  latitude: number;
  longitude: number;
  timezone: string;
  birthTimeQuality: 'exact' | 'approximate' | 'unknown';
}
