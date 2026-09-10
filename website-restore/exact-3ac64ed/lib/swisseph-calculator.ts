/**
 * Canonical Swiss Ephemeris calculator.
 * It returns astronomical data only. It never inserts a missing birth time.
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import tzLookup from 'tz-lookup';
import { lookupCityCoordinates } from './cityGazetteer';
import {
  CANONICAL_NATAL_CALCULATION_VERSION,
  normalizeCoordinateForStorage,
} from './natalChartCanonical';
import {
  buildBirthTimeInterval,
  normalizeBirthTimeInput,
  type BirthTimeInput,
} from './birthTime';
import type {
  LongitudeRange,
  NatalAngleKey,
  NatalAngleV2,
  NatalAspectPhase,
  NatalAspectType,
  NatalAspectV2,
  NatalBodyKey,
  NatalChartDataV2,
  NatalHouseV2,
  NatalPositionV2,
  NatalReliability,
} from './natalChartV2Types';

const ZODIAC_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

const ASPECT_RULES_VERSION = 'natal-major-aspects-v2';
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1';

const log = {
  info: (message: string, data?: unknown) =>
    console.log(`[SwissephCalculator] ${message}`, data || ''),
  warn: (message: string, data?: unknown) =>
    console.warn(`[SwissephCalculator] ${message}`, data || ''),
};

type Coordinates = {
  lat: number;
  lon: number;
  timezone: string;
};

type NatalCalculationOptions = {
  coordinates?: Coordinates;
  birthTime?: BirthTimeInput;
  birthTimeMode?: unknown;
  birthTimeUncertaintyMinutes?: unknown;
  birthTimeRangeStart?: unknown;
  birthTimeRangeEnd?: unknown;
};

export interface PlanetPosition {
  planet: string;
  sign: string;
  degree: number;
  longitude: number;
  house?: number;
  retrograde: boolean;
  speedLongitude: number;
  description?: string;
}

export interface PlanetaryTransitsAtResult {
  source: 'swisseph';
  date: string;
  julianDay: number;
  sun: PlanetPosition;
  moon: PlanetPosition;
  mercury: PlanetPosition;
  venus: PlanetPosition;
  mars: PlanetPosition;
  jupiter: PlanetPosition;
  saturn: PlanetPosition;
  uranus: PlanetPosition;
  neptune: PlanetPosition;
  pluto: PlanetPosition;
}

export type NatalChartResult = NatalChartDataV2;

type RawBody = {
  key: NatalBodyKey;
  object: string;
  kind: 'planet' | 'lunar_node';
  longitude: number;
  sign: string;
  degree: number;
  retrograde: boolean;
  speedLongitude: number;
  house: number | null;
  source: 'swisseph' | 'derived';
};

type RawAngle = {
  key: NatalAngleKey;
  object: string;
  longitude: number;
  sign: string;
  degree: number;
  source: 'swisseph' | 'derived';
};

type RawHouse = {
  house: number;
  longitude: number;
  sign: string;
  degree: number;
};

type RawAspect = {
  id: string;
  type: NatalAspectType;
  exactAngle: number;
  angularDistance: number;
  orb: number;
  from: string;
  to: string;
  fromKey: NatalBodyKey | NatalAngleKey;
  toKey: NatalBodyKey | NatalAngleKey;
  phase: NatalAspectPhase;
};

type Sky = {
  bodies: Record<NatalBodyKey, RawBody>;
  angles: Record<NatalAngleKey, RawAngle> | null;
  houses: RawHouse[];
  houseSystem: 'placidus' | 'whole_sign' | null;
  houseFallbackUsed: boolean;
};

type Sample = Sky & {
  utc: string;
  julianDay: number;
  aspects: RawAspect[];
};

type BodyDefinition = {
  key: Exclude<NatalBodyKey, 'southNode'>;
  object: string;
  kind: 'planet' | 'lunar_node';
  id: (swe: any) => number;
};

const NATAL_BODY_DEFINITIONS: BodyDefinition[] = [
  { key: 'sun', object: 'Sun', kind: 'planet', id: () => 0 },
  { key: 'moon', object: 'Moon', kind: 'planet', id: () => 1 },
  { key: 'mercury', object: 'Mercury', kind: 'planet', id: () => 2 },
  { key: 'venus', object: 'Venus', kind: 'planet', id: () => 3 },
  { key: 'mars', object: 'Mars', kind: 'planet', id: () => 4 },
  { key: 'jupiter', object: 'Jupiter', kind: 'planet', id: () => 5 },
  { key: 'saturn', object: 'Saturn', kind: 'planet', id: () => 6 },
  { key: 'uranus', object: 'Uranus', kind: 'planet', id: () => 7 },
  { key: 'neptune', object: 'Neptune', kind: 'planet', id: () => 8 },
  { key: 'pluto', object: 'Pluto', kind: 'planet', id: () => 9 },
  { key: 'chiron', object: 'Chiron', kind: 'planet', id: (swe) => swe.SE_CHIRON ?? 15 },
  {
    key: 'northNode',
    object: 'True North Node',
    kind: 'lunar_node',
    id: (swe) => swe.SE_TRUE_NODE ?? 11,
  },
];

const TRANSIT_BODY_KEYS = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
] as const;

const BODY_DEFINITION_BY_KEY = new Map(
  NATAL_BODY_DEFINITIONS.map((definition) => [definition.key, definition]),
);

const ASPECT_DEFINITIONS: Array<{
  type: NatalAspectType;
  angle: number;
  orb: number;
}> = [
  { type: 'conjunction', angle: 0, orb: 8 },
  { type: 'sextile', angle: 60, orb: 4 },
  { type: 'square', angle: 90, orb: 6 },
  { type: 'trine', angle: 120, orb: 6 },
  { type: 'opposition', angle: 180, orb: 8 },
];

let swissEphemeris: any = null;

function codedError(message: string, code: string, cause?: unknown): Error {
  const error = new Error(message) as Error & { code?: string; cause?: unknown };
  error.code = code;
  if (cause !== undefined) error.cause = cause;
  return error;
}

function normalizeLongitude(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function round(value: number, digits = 8): number {
  return Number(value.toFixed(digits));
}

export function getZodiacSign(longitude: number): string {
  const index = Math.floor(normalizeLongitude(longitude) / 30) % 12;
  return ZODIAC_SIGNS[index];
}

export function getDegreeInSign(longitude: number): number {
  return round(normalizeLongitude(longitude) % 30);
}

function angularDistance(first: number, second: number): number {
  const difference = Math.abs(
    normalizeLongitude(first) - normalizeLongitude(second),
  );
  return difference > 180 ? 360 - difference : difference;
}

function findEphemerisPath(): string {
  const candidates = [
    process.env.EPHE_PATH,
    path.join(process.cwd(), 'ephe'),
    '/app/ephe',
    path.join(__dirname, '..', 'ephe'),
    '/workspace/ephe',
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const validDirectory =
        fs.existsSync(candidate) && fs.statSync(candidate).isDirectory();
      const hasFiles =
        validDirectory &&
        fs.readdirSync(candidate).some((fileName) => fileName.endsWith('.se1'));
      if (hasFiles) return candidate;
    } catch {
      // Continue with the next configured path.
    }
  }

  throw codedError(
    `Swiss Ephemeris files not found. Checked: ${candidates.join(', ')}`,
    'EPHEMERIS_FILES_MISSING',
  );
}

function initializeSwissEphemeris(): any {
  if (swissEphemeris) return swissEphemeris;

  let module: any;
  try {
    module = require('swisseph-v2');
  } catch (cause) {
    throw codedError(
      'Swiss Ephemeris module is unavailable.',
      'EPHEMERIS_UNAVAILABLE',
      cause,
    );
  }

  const requiredMethods = [
    'swe_calc_ut',
    'swe_julday',
    'swe_houses',
    'swe_set_ephe_path',
  ];
  const missingMethods = requiredMethods.filter(
    (method) => typeof module?.[method] !== 'function',
  );
  if (missingMethods.length > 0) {
    throw codedError(
      `Swiss Ephemeris is missing methods: ${missingMethods.join(', ')}`,
      'EPHEMERIS_UNAVAILABLE',
    );
  }

  const ephemerisPath = findEphemerisPath();
  module.swe_set_ephe_path(ephemerisPath);
  swissEphemeris = module;
  log.info('Swiss Ephemeris initialized', { ephemerisPath });
  return module;
}

function swissCalculationFlag(swe: any): number {
  return (swe.SEFLG_SWIEPH ?? 2) | (swe.SEFLG_SPEED ?? 256);
}

function libraryVersion(): string {
  try {
    return String(require('swisseph-v2/package.json')?.version || 'unknown');
  } catch {
    return 'unknown';
  }
}

export function getSwissEphemerisHealth(): {
  ok: boolean;
  code?: string;
  message?: string;
} {
  try {
    const swe = initializeSwissEphemeris();
    const julianDay = swe.swe_julday(2026, 1, 1, 12, 1);
    const requiredKeys: Array<Exclude<NatalBodyKey, 'southNode'>> = [
      'sun',
      'chiron',
      'northNode',
    ];

    for (const key of requiredKeys) {
      const definition = BODY_DEFINITION_BY_KEY.get(key);
      if (!definition) {
        throw codedError(`Missing body definition: ${key}`, 'EPHEMERIS_INCOMPLETE');
      }
      const result = swe.swe_calc_ut(
        julianDay,
        definition.id(swe),
        swissCalculationFlag(swe),
      );
      if (!Number.isFinite(Number(result?.longitude))) {
        throw codedError(
          `Swiss Ephemeris did not return ${definition.object}.`,
          'EPHEMERIS_INCOMPLETE',
        );
      }
    }

    return { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      code: error?.code || 'EPHEMERIS_UNAVAILABLE',
      message: error?.message || String(error),
    };
  }
}

export function isValidIanaTimezone(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.trim() }).format();
    return true;
  } catch {
    return false;
  }
}

function resolveTimezone(latitude: number, longitude: number): string {
  try {
    const timezone = tzLookup(latitude, longitude);
    if (!isValidIanaTimezone(timezone)) throw new Error(timezone);
    return timezone;
  } catch (cause) {
    throw codedError(
      'Could not determine birth timezone.',
      'TIMEZONE_LOOKUP_FAILED',
      cause,
    );
  }
}

async function geocodeWithOpenMeteo(place: string): Promise<Coordinates | null> {
  try {
    const response = await axios.get(
      'https://geocoding-api.open-meteo.com/v1/search',
      {
        params: { name: place, count: 1, language: 'ru', format: 'json' },
        headers: {
          Accept: 'application/json',
          'User-Agent': BROWSER_USER_AGENT,
        },
        timeout: 15_000,
      },
    );
    const result = response.data?.results?.[0];
    const latitude = Number(result?.latitude);
    const longitude = Number(result?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      lat: latitude,
      lon: longitude,
      timezone: resolveTimezone(latitude, longitude),
    };
  } catch {
    return null;
  }
}

async function geocodeWithNominatim(place: string): Promise<Coordinates> {
  try {
    const response = await axios.get(
      'https://nominatim.openstreetmap.org/search',
      {
        params: { q: place, format: 'json', limit: 1 },
        headers: {
          'User-Agent': 'YourHoroscope/2.0',
          Accept: 'application/json',
        },
        timeout: 20_000,
      },
    );
    const result = response.data?.[0];
    const latitude = Number(result?.lat);
    const longitude = Number(result?.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('not found');
    }
    return {
      lat: latitude,
      lon: longitude,
      timezone: resolveTimezone(latitude, longitude),
    };
  } catch (cause) {
    throw codedError(
      `Birth place "${place}" was not found.`,
      'GEOCODING_FAILED',
      cause,
    );
  }
}

export async function getCoordinates(placeName: string): Promise<Coordinates> {
  const place = String(placeName || '').trim();
  if (!place) throw codedError('Birth place is required.', 'GEOCODING_FAILED');

  const offlineResult = lookupCityCoordinates(place);
  if (offlineResult) {
    return {
      lat: offlineResult.lat,
      lon: offlineResult.lon,
      timezone: resolveTimezone(offlineResult.lat, offlineResult.lon),
    };
  }

  const openMeteoResult = await geocodeWithOpenMeteo(place);
  return openMeteoResult || geocodeWithNominatim(place);
}

export async function resolveBirthCoordinates(
  placeName: string,
  provided?: {
    lat?: number | null;
    lon?: number | null;
    timezone?: string | null;
  } | null,
): Promise<Coordinates> {
  const latitude = Number(provided?.lat);
  const longitude = Number(provided?.lon);
  const validCoordinates =
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180 &&
    !(latitude === 0 && longitude === 0);

  if (!validCoordinates) return getCoordinates(placeName);

  const suppliedTimezone = String(provided?.timezone || '').trim();
  if (suppliedTimezone && !isValidIanaTimezone(suppliedTimezone)) {
    throw codedError(
      `Invalid timezone: ${suppliedTimezone}`,
      'INVALID_TIMEZONE',
    );
  }

  return {
    lat: latitude,
    lon: longitude,
    timezone: suppliedTimezone || resolveTimezone(latitude, longitude),
  };
}

function julianDayForDate(swe: any, date: Date): number {
  const utcHours =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3_600 +
    date.getUTCMilliseconds() / 3_600_000;
  const julianDay = Number(
    swe.swe_julday(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      utcHours,
      1,
    ),
  );
  if (!Number.isFinite(julianDay)) {
    throw codedError('Invalid Julian day.', 'EPHEMERIS_INCOMPLETE');
  }
  return julianDay;
}

function calculateBody(
  swe: any,
  julianDay: number,
  definition: BodyDefinition,
): RawBody {
  let result: any;
  try {
    result = swe.swe_calc_ut(
      julianDay,
      definition.id(swe),
      swissCalculationFlag(swe),
    );
  } catch (cause) {
    throw codedError(
      `Failed to calculate ${definition.object}.`,
      'EPHEMERIS_INCOMPLETE',
      cause,
    );
  }

  const longitude = Number(result?.longitude);
  const speedLongitude = Number(
    result?.speedLongitude ?? result?.speedLong ?? result?.longitudeSpeed,
  );
  if (!Number.isFinite(longitude) || !Number.isFinite(speedLongitude)) {
    throw codedError(
      `Incomplete ${definition.object} result.`,
      'EPHEMERIS_INCOMPLETE',
    );
  }

  const normalizedLongitude = normalizeLongitude(longitude);
  return {
    key: definition.key,
    object: definition.object,
    kind: definition.kind,
    longitude: round(normalizedLongitude),
    sign: getZodiacSign(normalizedLongitude),
    degree: getDegreeInSign(normalizedLongitude),
    retrograde: speedLongitude < 0,
    speedLongitude: round(speedLongitude),
    house: null,
    source: 'swisseph',
  };
}

function calculateNatalBodies(
  swe: any,
  julianDay: number,
): Record<NatalBodyKey, RawBody> {
  const bodies = {} as Record<NatalBodyKey, RawBody>;
  for (const definition of NATAL_BODY_DEFINITIONS) {
    bodies[definition.key] = calculateBody(swe, julianDay, definition);
  }

  const northNode = bodies.northNode;
  const southNodeLongitude = normalizeLongitude(northNode.longitude + 180);
  bodies.southNode = {
    ...northNode,
    key: 'southNode',
    object: 'South Node',
    longitude: round(southNodeLongitude),
    sign: getZodiacSign(southNodeLongitude),
    degree: getDegreeInSign(southNodeLongitude),
    source: 'derived',
  };
  return bodies;
}

function calculateTransitBody(
  swe: any,
  julianDay: number,
  key: (typeof TRANSIT_BODY_KEYS)[number],
): RawBody {
  const definition = BODY_DEFINITION_BY_KEY.get(key);
  if (!definition) {
    throw codedError(`Missing body definition: ${key}`, 'EPHEMERIS_INCOMPLETE');
  }
  return calculateBody(swe, julianDay, definition);
}

function calculateHouseResult(
  swe: any,
  julianDay: number,
  latitude: number,
  longitude: number,
  system: 'P' | 'W',
): any | null {
  try {
    const result = swe.swe_houses(julianDay, latitude, longitude, system);
    return Number.isFinite(Number(result?.ascendant)) ? result : null;
  } catch {
    return null;
  }
}

function calculateAnglesAndHouses(
  swe: any,
  julianDay: number,
  latitude: number,
  longitude: number,
): Omit<Sky, 'bodies'> {
  let result = calculateHouseResult(
    swe,
    julianDay,
    latitude,
    longitude,
    'P',
  );
  let houseSystem: 'placidus' | 'whole_sign' = 'placidus';
  let houseFallbackUsed = false;

  if (!result) {
    result = calculateHouseResult(
      swe,
      julianDay,
      latitude,
      longitude,
      'W',
    );
    houseSystem = 'whole_sign';
    houseFallbackUsed = true;
  }
  if (!result) {
    throw codedError(
      'Could not calculate houses for this location.',
      'HOUSES_UNAVAILABLE',
    );
  }

  const ascendantLongitude = normalizeLongitude(Number(result.ascendant));
  const rawMc = Number(result.mc ?? result.midheaven ?? result.ascmc?.[1]);
  if (!Number.isFinite(rawMc)) {
    throw codedError(
      'Swiss Ephemeris did not return MC.',
      'HOUSES_INCOMPLETE',
    );
  }
  const mcLongitude = normalizeLongitude(rawMc);

  const createAngle = (
    key: NatalAngleKey,
    object: string,
    angleLongitude: number,
    source: 'swisseph' | 'derived',
  ): RawAngle => ({
    key,
    object,
    longitude: round(angleLongitude),
    sign: getZodiacSign(angleLongitude),
    degree: getDegreeInSign(angleLongitude),
    source,
  });

  const angles: Record<NatalAngleKey, RawAngle> = {
    ascendant: createAngle(
      'ascendant',
      'Ascendant',
      ascendantLongitude,
      'swisseph',
    ),
    mc: createAngle('mc', 'MC', mcLongitude, 'swisseph'),
    descendant: createAngle(
      'descendant',
      'Descendant',
      normalizeLongitude(ascendantLongitude + 180),
      'derived',
    ),
    ic: createAngle(
      'ic',
      'IC',
      normalizeLongitude(mcLongitude + 180),
      'derived',
    ),
  };

  const rawHouses = Array.isArray(result.house)
    ? result.house.slice(0, 12)
    : [];
  if (rawHouses.length !== 12) {
    throw codedError(
      'Swiss Ephemeris did not return 12 houses.',
      'HOUSES_INCOMPLETE',
    );
  }

  const houses: RawHouse[] = rawHouses.map(
    (value: number, index: number) => {
      const houseLongitude = normalizeLongitude(Number(value));
      return {
        house: index + 1,
        longitude: round(houseLongitude),
        sign: getZodiacSign(houseLongitude),
        degree: getDegreeInSign(houseLongitude),
      };
    },
  );

  return {
    angles,
    houses,
    houseSystem,
    houseFallbackUsed,
  };
}

function houseForLongitude(
  longitude: number,
  houses: RawHouse[],
): number | null {
  if (houses.length !== 12) return null;
  const normalizedLongitude = normalizeLongitude(longitude);

  for (let index = 0; index < 12; index += 1) {
    const start = normalizeLongitude(houses[index].longitude);
    const end = normalizeLongitude(houses[(index + 1) % 12].longitude);
    const wraps = start > end;
    const inside =
      (!wraps && normalizedLongitude >= start && normalizedLongitude < end) ||
      (wraps && (normalizedLongitude >= start || normalizedLongitude < end));
    if (inside) return index + 1;
  }
  return null;
}

function calculateSky(
  swe: any,
  date: Date,
  coordinates: Coordinates,
  includeHouses: boolean,
): Sky {
  const julianDay = julianDayForDate(swe, date);
  const bodies = calculateNatalBodies(swe, julianDay);

  if (!includeHouses) {
    return {
      bodies,
      angles: null,
      houses: [],
      houseSystem: null,
      houseFallbackUsed: false,
    };
  }

  const houseData = calculateAnglesAndHouses(
    swe,
    julianDay,
    coordinates.lat,
    coordinates.lon,
  );
  for (const key of Object.keys(bodies) as NatalBodyKey[]) {
    bodies[key].house = houseForLongitude(
      bodies[key].longitude,
      houseData.houses,
    );
  }
  return { bodies, ...houseData };
}

type AspectObject = {
  key: NatalBodyKey | NatalAngleKey;
  object: string;
  longitude: number;
};

function aspectObjects(sky: Sky): AspectObject[] {
  const objects: AspectObject[] = Object.values(sky.bodies).map((body) => ({
    key: body.key,
    object: body.object,
    longitude: body.longitude,
  }));

  if (sky.angles) {
    objects.push(
      ...Object.values(sky.angles).map((angle): AspectObject => ({
        key: angle.key,
        object: angle.object,
        longitude: angle.longitude,
      })),
    );
  }
  return objects;
}

function aspectPhase(currentOrb: number, laterOrb: number): NatalAspectPhase {
  if (currentOrb <= 0.01) return 'exact';
  if (laterOrb < currentOrb) return 'applying';
  if (laterOrb > currentOrb) return 'separating';
  return 'exact';
}

function calculateAspects(currentSky: Sky, laterSky: Sky): RawAspect[] {
  const currentObjects = aspectObjects(currentSky);
  const laterObjects = new Map(
    aspectObjects(laterSky).map((item) => [item.key, item]),
  );
  const aspects: RawAspect[] = [];

  for (let firstIndex = 0; firstIndex < currentObjects.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < currentObjects.length;
      secondIndex += 1
    ) {
      const first = currentObjects[firstIndex];
      const second = currentObjects[secondIndex];
      const distance = angularDistance(first.longitude, second.longitude);
      const definition = ASPECT_DEFINITIONS.find(
        (candidate) =>
          Math.abs(distance - candidate.angle) <= candidate.orb,
      );
      if (!definition) continue;

      const laterFirst = laterObjects.get(first.key);
      const laterSecond = laterObjects.get(second.key);
      const laterDistance =
        laterFirst && laterSecond
          ? angularDistance(laterFirst.longitude, laterSecond.longitude)
          : distance;
      const orb = Math.abs(distance - definition.angle);
      const laterOrb = Math.abs(laterDistance - definition.angle);
      const sortedKeys = [String(first.key), String(second.key)].sort();

      aspects.push({
        id: `aspect:${sortedKeys[0]}:${definition.type}:${sortedKeys[1]}`,
        type: definition.type,
        exactAngle: definition.angle,
        angularDistance: round(distance),
        orb: round(orb),
        from: first.object,
        to: second.object,
        fromKey: first.key,
        toKey: second.key,
        phase: aspectPhase(orb, laterOrb),
      });
    }
  }

  return aspects;
}

function calculateSample(
  swe: any,
  utc: string,
  coordinates: Coordinates,
  includeHouses: boolean,
): Sample {
  const date = new Date(utc);
  const sky = calculateSky(swe, date, coordinates, includeHouses);
  const laterSky = calculateSky(
    swe,
    new Date(date.getTime() + 10 * 60_000),
    coordinates,
    includeHouses,
  );
  return {
    ...sky,
    utc: date.toISOString(),
    julianDay: julianDayForDate(swe, date),
    aspects: calculateAspects(sky, laterSky),
  };
}

function circularMean(values: number[]): number {
  const x =
    values.reduce(
      (sum, value) => sum + Math.cos((value * Math.PI) / 180),
      0,
    ) / values.length;
  const y =
    values.reduce(
      (sum, value) => sum + Math.sin((value * Math.PI) / 180),
      0,
    ) / values.length;
  return normalizeLongitude((Math.atan2(y, x) * 180) / Math.PI);
}

function longitudeRange(values: number[]): LongitudeRange {
  const sorted = values.map(normalizeLongitude).sort((a, b) => a - b);
  if (sorted.length === 1) {
    return {
      startLongitude: round(sorted[0]),
      endLongitude: round(sorted[0]),
      spanDegrees: 0,
      signs: [getZodiacSign(sorted[0])],
    };
  }

  let largestGap = -1;
  let largestGapIndex = 0;
  for (let index = 0; index < sorted.length; index += 1) {
    const next =
      index === sorted.length - 1 ? sorted[0] + 360 : sorted[index + 1];
    const gap = next - sorted[index];
    if (gap > largestGap) {
      largestGap = gap;
      largestGapIndex = index;
    }
  }

  const start = sorted[(largestGapIndex + 1) % sorted.length];
  const span = 360 - largestGap;
  return {
    startLongitude: round(start),
    endLongitude: round(normalizeLongitude(start + span)),
    spanDegrees: round(span),
    signs: [...new Set(sorted.map(getZodiacSign))],
  };
}

function reliability(
  exactTime: boolean,
  stable: boolean,
): NatalReliability {
  if (exactTime) return 'exact';
  return stable ? 'stable_in_range' : 'variable_in_range';
}

function aggregatePosition(
  key: NatalBodyKey,
  samples: Sample[],
): NatalPositionV2 {
  const rows = samples.map((sample) => sample.bodies[key]);
  const exactTime = samples.length === 1;
  const signStable = new Set(rows.map((row) => row.sign)).size === 1;
  const retrogradeStable =
    new Set(rows.map((row) => row.retrograde)).size === 1;
  const houses = rows.map((row) => row.house);
  const houseStable =
    houses.every((house) => house !== null) && new Set(houses).size === 1;
  const longitude = circularMean(rows.map((row) => row.longitude));

  return {
    object: rows[0].object,
    planet: rows[0].object,
    key,
    kind: rows[0].kind,
    longitude: round(longitude),
    sign: getZodiacSign(longitude),
    degree: getDegreeInSign(longitude),
    retrograde: retrogradeStable ? rows[0].retrograde : null,
    speedLongitude: round(
      rows.reduce((sum, row) => sum + row.speedLongitude, 0) / rows.length,
    ),
    house: houseStable ? rows[0].house : null,
    source: rows[0].source,
    reliability: reliability(
      exactTime,
      signStable && retrogradeStable,
    ),
    stable: {
      sign: signStable,
      retrograde: retrogradeStable,
      house: houseStable,
    },
    range: exactTime
      ? undefined
      : longitudeRange(rows.map((row) => row.longitude)),
  };
}

function aggregateAngle(
  key: NatalAngleKey,
  samples: Sample[],
): NatalAngleV2 | null {
  const rows = samples
    .map((sample) => sample.angles?.[key])
    .filter((value): value is RawAngle => Boolean(value));
  if (rows.length !== samples.length || rows.length === 0) return null;

  const exactTime = samples.length === 1;
  const stableSign = new Set(rows.map((row) => row.sign)).size === 1;
  const longitude = circularMean(rows.map((row) => row.longitude));
  return {
    key,
    object: rows[0].object,
    planet: rows[0].object,
    longitude: round(longitude),
    sign: getZodiacSign(longitude),
    degree: getDegreeInSign(longitude),
    source: rows[0].source,
    reliability: reliability(exactTime, stableSign),
    stableSign,
    range: exactTime
      ? undefined
      : longitudeRange(rows.map((row) => row.longitude)),
  };
}

function aggregateHouses(samples: Sample[]): NatalHouseV2[] {
  if (samples.some((sample) => sample.houses.length !== 12)) return [];

  return Array.from({ length: 12 }, (_, index) => {
    const rows = samples.map((sample) => sample.houses[index]);
    const exactTime = samples.length === 1;
    const stableSign = new Set(rows.map((row) => row.sign)).size === 1;
    const longitude = circularMean(rows.map((row) => row.longitude));
    return {
      house: index + 1,
      longitude: round(longitude),
      sign: getZodiacSign(longitude),
      degree: getDegreeInSign(longitude),
      reliability: reliability(exactTime, stableSign),
      stableSign,
      range: exactTime
        ? undefined
        : longitudeRange(rows.map((row) => row.longitude)),
    };
  });
}

function aggregateAspects(samples: Sample[]): NatalAspectV2[] {
  const aspectIds = new Set(
    samples.flatMap((sample) => sample.aspects.map((aspect) => aspect.id)),
  );
  const result: NatalAspectV2[] = [];

  for (const id of aspectIds) {
    const rows = samples
      .map((sample) => sample.aspects.find((aspect) => aspect.id === id))
      .filter((value): value is RawAspect => Boolean(value));
    if (rows.length === 0) continue;

    const first = rows[0];
    const phases = [...new Set(rows.map((row) => row.phase))];
    const reliableAspect = rows.length === samples.length;
    result.push({
      id,
      type: first.type,
      exactAngle: first.exactAngle,
      angle: first.exactAngle,
      angularDistance: round(
        rows.reduce((sum, row) => sum + row.angularDistance, 0) /
          rows.length,
      ),
      orb: round(
        rows.reduce((sum, row) => sum + row.orb, 0) / rows.length,
      ),
      orbRange: {
        min: round(Math.min(...rows.map((row) => row.orb))),
        max: round(Math.max(...rows.map((row) => row.orb))),
      },
      from: first.from,
      to: first.to,
      fromKey: first.fromKey,
      toKey: first.toKey,
      phase: phases.length === 1 ? phases[0] : 'mixed',
      reliable: reliableAspect,
      sampleCoverage: round(rows.length / samples.length, 6),
    });
  }

  return result.sort(
    (first, second) =>
      first.orbRange.min - second.orbRange.min ||
      first.id.localeCompare(second.id),
  );
}

export function calculatePlanetaryTransitsAt(
  date: Date,
): PlanetaryTransitsAtResult {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw codedError('Invalid transit date.', 'INVALID_TRANSIT_DATE');
  }

  const swe = initializeSwissEphemeris();
  const julianDay = julianDayForDate(swe, date);
  const transitBodies = Object.fromEntries(
    TRANSIT_BODY_KEYS.map((key) => [
      key,
      calculateTransitBody(swe, julianDay, key),
    ]),
  ) as Record<(typeof TRANSIT_BODY_KEYS)[number], RawBody>;

  const position = (
    key: (typeof TRANSIT_BODY_KEYS)[number],
  ): PlanetPosition => {
    const body = transitBodies[key];
    return {
      planet: body.object,
      sign: body.sign,
      degree: body.degree,
      longitude: body.longitude,
      retrograde: body.retrograde,
      speedLongitude: body.speedLongitude,
    };
  };

  return {
    source: 'swisseph',
    date: date.toISOString(),
    julianDay,
    sun: position('sun'),
    moon: position('moon'),
    mercury: position('mercury'),
    venus: position('venus'),
    mars: position('mars'),
    jupiter: position('jupiter'),
    saturn: position('saturn'),
    uranus: position('uranus'),
    neptune: position('neptune'),
    pluto: position('pluto'),
  };
}

export async function calculateNatalChart(
  name: string,
  birthDate: string,
  birthTime: string,
  birthPlace: string,
  options?: NatalCalculationOptions,
): Promise<NatalChartResult> {
  if (!name?.trim()) throw new Error('Name is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    throw new Error('Birth date must be YYYY-MM-DD.');
  }
  if (!birthPlace?.trim()) throw new Error('Birth place is required.');

  const coordinates =
    options?.coordinates || (await getCoordinates(birthPlace));
  const timeInput =
    options?.birthTime ||
    normalizeBirthTimeInput({
      mode: options?.birthTimeMode,
      localTime: birthTime,
      uncertaintyMinutes: options?.birthTimeUncertaintyMinutes,
      rangeStart: options?.birthTimeRangeStart,
      rangeEnd: options?.birthTimeRangeEnd,
      legacyBirthTime: birthTime,
    });
  const interval = buildBirthTimeInterval(
    birthDate,
    coordinates.timezone,
    timeInput,
  );
  const swe = initializeSwissEphemeris();
  const includeHouses = timeInput.mode !== 'unknown';
  const samples = interval.sampleUtc.map((utc) =>
    calculateSample(swe, utc, coordinates, includeHouses),
  );

  const positions = {} as Record<NatalBodyKey, NatalPositionV2>;
  for (const key of Object.keys(samples[0].bodies) as NatalBodyKey[]) {
    positions[key] = aggregatePosition(key, samples);
  }

  const angles: Record<NatalAngleKey, NatalAngleV2 | null> = {
    ascendant: includeHouses
      ? aggregateAngle('ascendant', samples)
      : null,
    mc: includeHouses ? aggregateAngle('mc', samples) : null,
    descendant: includeHouses
      ? aggregateAngle('descendant', samples)
      : null,
    ic: includeHouses ? aggregateAngle('ic', samples) : null,
  };
  const houses = includeHouses ? aggregateHouses(samples) : [];
  const aspects = aggregateAspects(samples);
  const exactTime = timeInput.mode === 'exact';

  const variableBodies = (Object.keys(positions) as NatalBodyKey[]).filter(
    (key) => positions[key].reliability === 'variable_in_range',
  );
  const variableAngles = (Object.keys(angles) as NatalAngleKey[]).filter(
    (key) => angles[key]?.reliability === 'variable_in_range',
  );
  const variableHouses = houses
    .filter((house) => house.reliability === 'variable_in_range')
    .map((house) => house.house);
  const variableAspectIds = aspects
    .filter((aspect) => !aspect.reliable)
    .map((aspect) => aspect.id);
  const houseSystems = [
    ...new Set(
      samples
        .map((sample) => sample.houseSystem)
        .filter(
          (value): value is 'placidus' | 'whole_sign' => value !== null,
        ),
    ),
  ];
  const houseSystem = houseSystems.length === 1 ? houseSystems[0] : null;
  const birthTimeQuality =
    timeInput.mode === 'exact'
      ? 'exact'
      : timeInput.mode === 'unknown'
        ? 'unknown'
        : 'approximate';
  const stableHousePlacements = (
    Object.keys(positions) as NatalBodyKey[]
  ).filter((key) => positions[key].stable.house);
  const housesReliable =
    houses.length === 12 && variableHouses.length === 0;
  const ascendantReliable =
    Boolean(angles.ascendant) &&
    angles.ascendant?.reliability !== 'variable_in_range';

  const chart: NatalChartDataV2 = {
    schemaVersion: 'natal-chart-data-v2',
    birth: {
      localDate: birthDate,
      localTime: timeInput.localTime,
      place: birthPlace.trim(),
      latitude: normalizeCoordinateForStorage(coordinates.lat),
      longitude: normalizeCoordinateForStorage(coordinates.lon),
      timezone: coordinates.timezone,
      time: timeInput,
      interval,
    },
    positions,
    angles,
    houses,
    aspects,
    chartQuality: {
      birthTimeMode: timeInput.mode,
      birthTimeQuality,
      exactTime,
      anglesAvailable: Boolean(angles.ascendant && angles.mc),
      housesAvailable: houses.length === 12,
      ascendantReliable,
      housesReliable,
      houseBasedPersonalization: housesReliable,
      stableHousePlacements,
      variableBodies,
      variableAngles,
      variableHouses,
      variableAspectIds,
      notes:
        timeInput.mode === 'unknown'
          ? [
              'Birth time is unknown. Angles and houses were not calculated.',
            ]
          : variableBodies.length ||
              variableAngles.length ||
              variableHouses.length ||
              variableAspectIds.length
            ? [
                'Only facts stable across the entered birth-time interval are reliable.',
              ]
            : [],
    },
    calculationMetadata: {
      ephemerisEngine: 'Swiss Ephemeris',
      ephemerisMode: 'swisseph',
      ephemerisLibraryVersion: libraryVersion(),
      zodiac: 'tropical',
      coordinateCenter: 'geocentric',
      houseSystem,
      houseFallbackUsed: samples.some(
        (sample) => sample.houseFallbackUsed,
      ),
      housesComputedFrom:
        timeInput.mode === 'exact'
          ? 'exact_time'
          : timeInput.mode === 'unknown'
            ? 'not_computed'
            : 'time_range',
      aspectRulesVersion: ASPECT_RULES_VERSION,
      calculationVersion: CANONICAL_NATAL_CALCULATION_VERSION,
      calculatedAt: new Date().toISOString(),
      sampleCount: samples.length,
    },
    calculationVersion: CANONICAL_NATAL_CALCULATION_VERSION,
    sun: positions.sun,
    moon: positions.moon,
    mercury: positions.mercury,
    venus: positions.venus,
    mars: positions.mars,
    jupiter: positions.jupiter,
    saturn: positions.saturn,
    uranus: positions.uranus,
    neptune: positions.neptune,
    pluto: positions.pluto,
    chiron: positions.chiron,
    northNode: positions.northNode,
    southNode: positions.southNode,
    rising: angles.ascendant,
    mc: angles.mc,
    latitude: normalizeCoordinateForStorage(coordinates.lat),
    longitude: normalizeCoordinateForStorage(coordinates.lon),
    timezone: coordinates.timezone,
    birthTimeQuality,
  };

  log.info('Natal chart calculated', {
    timeMode: timeInput.mode,
    samples: samples.length,
    aspects: aspects.length,
    houses: houses.length,
  });
  return chart;
}
