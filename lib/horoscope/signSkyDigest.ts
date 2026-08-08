import {
  calculatePlanetaryTransitsAt,
  type PlanetaryTransitsAtResult,
} from '../swisseph-calculator';
import {
  ZODIAC_KEYS,
  normalizeZodiacKey,
  type ZodiacKey,
} from '../zodiacKeys';
import type { SignHoroscopePeriod } from '../../types';

export const SIGN_SKY_DIGEST_VERSION = 'sign-sky-digest-v2.1' as const;
export const SIGN_SKY_TIME_ZONE = 'Europe/Moscow' as const;

export const SIGN_TRANSIT_PLANETS = [
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

export type SignTransitPlanet = (typeof SIGN_TRANSIT_PLANETS)[number];
export type SignAspectType = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition';
export type SignAspectPhase = 'applying' | 'exact' | 'separating';

export interface SignPlanetPositionFact {
  evidenceId: string;
  planet: SignTransitPlanet;
  sign: ZodiacKey;
  longitude: number;
  degree: number;
  speedLongitude: number;
  retrograde: boolean;
  cadence: 'luminary' | 'personal' | 'slow';
}

export interface SignTransitAspectFact {
  evidenceId: string;
  from: SignTransitPlanet;
  to: SignTransitPlanet;
  type: SignAspectType;
  exactAngle: number;
  angularDistance: number;
  orb: number;
  phase: SignAspectPhase;
}

export interface SignSkySample {
  timestamp: string;
  moscowLocalDate: string;
  positions: SignPlanetPositionFact[];
  aspects: SignTransitAspectFact[];
}

export interface SignSkyEvent {
  evidenceId: string;
  kind: 'ingress' | 'station';
  planet: SignTransitPlanet;
  observedAt: string;
  previousObservedAt?: string;
  fromSign?: ZodiacKey;
  toSign?: ZodiacKey;
  motion?: 'direct' | 'retrograde';
  speedLongitude: number;
}

export interface SignRulerFact {
  evidenceId: string;
  planet: SignTransitPlanet;
  tradition: 'both' | 'modern' | 'traditional';
}

export interface SignSolarHouseFact {
  evidenceId: string;
  planet: SignTransitPlanet;
  transitSign: ZodiacKey;
  wholeSignHouse: number;
  from: string;
  to: string;
}

export interface SignSkyDigest {
  sign: ZodiacKey;
  rulers: SignRulerFact[];
  solarHousePlacements: SignSolarHouseFact[];
}

export interface SignSkyBatchDigest {
  schemaVersion: typeof SIGN_SKY_DIGEST_VERSION;
  source: 'Swiss Ephemeris';
  timeZone: typeof SIGN_SKY_TIME_ZONE;
  period: SignHoroscopePeriod;
  periodKey: string;
  sampledAt: string[];
  samples: SignSkySample[];
  events: SignSkyEvent[];
  signs: SignSkyDigest[];
}

export type SignTransitCalculator = (date: Date) => PlanetaryTransitsAtResult;

const PLANET_CADENCE: Record<SignTransitPlanet, SignPlanetPositionFact['cadence']> = {
  sun: 'luminary',
  moon: 'luminary',
  mercury: 'personal',
  venus: 'personal',
  mars: 'personal',
  jupiter: 'slow',
  saturn: 'slow',
  uranus: 'slow',
  neptune: 'slow',
  pluto: 'slow',
};

const ASPECTS: ReadonlyArray<{ type: SignAspectType; angle: number; orb: number }> = [
  { type: 'conjunction', angle: 0, orb: 8 },
  { type: 'sextile', angle: 60, orb: 5 },
  { type: 'square', angle: 90, orb: 7 },
  { type: 'trine', angle: 120, orb: 7 },
  { type: 'opposition', angle: 180, orb: 8 },
];

const RULERS: Record<ZodiacKey, Array<{ planet: SignTransitPlanet; tradition: SignRulerFact['tradition'] }>> = {
  Aries: [{ planet: 'mars', tradition: 'both' }],
  Taurus: [{ planet: 'venus', tradition: 'both' }],
  Gemini: [{ planet: 'mercury', tradition: 'both' }],
  Cancer: [{ planet: 'moon', tradition: 'both' }],
  Leo: [{ planet: 'sun', tradition: 'both' }],
  Virgo: [{ planet: 'mercury', tradition: 'both' }],
  Libra: [{ planet: 'venus', tradition: 'both' }],
  Scorpio: [
    { planet: 'pluto', tradition: 'modern' },
    { planet: 'mars', tradition: 'traditional' },
  ],
  Sagittarius: [{ planet: 'jupiter', tradition: 'both' }],
  Capricorn: [{ planet: 'saturn', tradition: 'both' }],
  Aquarius: [
    { planet: 'uranus', tradition: 'modern' },
    { planet: 'saturn', tradition: 'traditional' },
  ],
  Pisces: [
    { planet: 'neptune', tradition: 'modern' },
    { planet: 'jupiter', tradition: 'traditional' },
  ],
};

function round(value: number, precision = 6): number {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
}

function normalizeLongitude(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function evidenceId(...parts: Array<string | number>): string {
  return parts
    .map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join(':');
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseDayKey(periodKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(periodKey);
  if (!match) throw new Error(`Invalid Moscow day key: ${periodKey}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year
    || probe.getUTCMonth() !== month - 1
    || probe.getUTCDate() !== day
  ) {
    throw new Error(`Invalid Moscow day key: ${periodKey}`);
  }
  return { year, month, day };
}

function addLocalDays(parts: { year: number; month: number; day: number }, amount: number) {
  const value = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function isoWeekMonday(periodKey: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-W(\d{2})$/.exec(periodKey);
  if (!match) throw new Error(`Invalid Moscow ISO week key: ${periodKey}`);
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) throw new Error(`Invalid Moscow ISO week key: ${periodKey}`);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Offset = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(year, 0, 4 - jan4Offset + (week - 1) * 7));
  return {
    year: monday.getUTCFullYear(),
    month: monday.getUTCMonth() + 1,
    day: monday.getUTCDate(),
  };
}

/** Moscow has a stable UTC+3 offset; these are local civil sampling points. */
function moscowLocalDateTimeToUtc(
  parts: { year: number; month: number; day: number },
  hour: number,
  minute = 0,
): Date {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hour - 3, minute, 0, 0));
}

export function buildMoscowSignSampleDates(
  period: SignHoroscopePeriod,
  periodKey: string,
): Date[] {
  if (period === 'day') {
    const day = parseDayKey(periodKey);
    return [0, 6, 12, 18, 23].map((hour) =>
      moscowLocalDateTimeToUtc(day, hour, hour === 23 ? 59 : 0));
  }

  if (period === 'week') {
    const monday = isoWeekMonday(periodKey);
    return Array.from({ length: 7 }, (_, offset) =>
      moscowLocalDateTimeToUtc(addLocalDays(monday, offset), 12));
  }

  const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!match) throw new Error(`Invalid Moscow month key: ${periodKey}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Invalid Moscow month key: ${periodKey}`);
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, offset) =>
    moscowLocalDateTimeToUtc({ year, month, day: offset + 1 }, 12));
}

export function getSignRulers(sign: ZodiacKey): SignRulerFact[] {
  return RULERS[sign].map(({ planet, tradition }) => ({
    evidenceId: evidenceId('sign', sign, 'ruler', tradition, planet),
    planet,
    tradition,
  }));
}

export function getWholeSignSolarHouse(
  selectedSign: ZodiacKey,
  transitSign: ZodiacKey,
): number {
  const selectedIndex = ZODIAC_KEYS.indexOf(selectedSign);
  const transitIndex = ZODIAC_KEYS.indexOf(transitSign);
  return ((transitIndex - selectedIndex + 12) % 12) + 1;
}

function angularDistance(first: number, second: number): number {
  const delta = Math.abs(normalizeLongitude(first) - normalizeLongitude(second));
  return Math.min(delta, 360 - delta);
}

function aspectPhase(
  firstLongitude: number,
  firstSpeed: number,
  secondLongitude: number,
  secondSpeed: number,
  exactAngle: number,
  orb: number,
): SignAspectPhase {
  if (orb <= 0.02) return 'exact';
  const nextFirst = firstLongitude + firstSpeed / 24;
  const nextSecond = secondLongitude + secondSpeed / 24;
  const nextOrb = Math.abs(angularDistance(nextFirst, nextSecond) - exactAngle);
  return nextOrb < orb ? 'applying' : 'separating';
}

function buildPositionFacts(
  transit: PlanetaryTransitsAtResult,
  periodKey: string,
  timestamp: string,
): SignPlanetPositionFact[] {
  return SIGN_TRANSIT_PLANETS.map((planet) => {
    const raw = transit[planet];
    const sign = normalizeZodiacKey(raw.sign);
    if (!sign) throw new Error(`Swiss Ephemeris returned an invalid ${planet} sign: ${raw.sign}`);
    return {
      evidenceId: evidenceId('sky', periodKey, timestamp, planet, 'position'),
      planet,
      sign,
      longitude: round(raw.longitude),
      degree: round(raw.degree),
      speedLongitude: round(raw.speedLongitude),
      retrograde: raw.retrograde,
      cadence: PLANET_CADENCE[planet],
    };
  });
}

function buildAspectFacts(
  positions: SignPlanetPositionFact[],
  periodKey: string,
  timestamp: string,
): SignTransitAspectFact[] {
  const facts: SignTransitAspectFact[] = [];
  for (let firstIndex = 0; firstIndex < positions.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < positions.length; secondIndex += 1) {
      const first = positions[firstIndex];
      const second = positions[secondIndex];
      const distance = angularDistance(first.longitude, second.longitude);
      const match = ASPECTS
        .map((aspect) => ({ ...aspect, distanceFromExact: Math.abs(distance - aspect.angle) }))
        .filter((aspect) => aspect.distanceFromExact <= aspect.orb)
        .sort((a, b) => a.distanceFromExact - b.distanceFromExact)[0];
      if (!match) continue;
      const orb = round(match.distanceFromExact);
      facts.push({
        evidenceId: evidenceId(
          'sky',
          periodKey,
          timestamp,
          'aspect',
          first.planet,
          match.type,
          second.planet,
        ),
        from: first.planet,
        to: second.planet,
        type: match.type,
        exactAngle: match.angle,
        angularDistance: round(distance),
        orb,
        phase: aspectPhase(
          first.longitude,
          first.speedLongitude,
          second.longitude,
          second.speedLongitude,
          match.angle,
          orb,
        ),
      });
    }
  }
  return facts.sort((a, b) => a.orb - b.orb || a.evidenceId.localeCompare(b.evidenceId));
}

function buildEvents(samples: SignSkySample[], periodKey: string): SignSkyEvent[] {
  const events: SignSkyEvent[] = [];
  const seen = new Set<string>();

  for (let sampleIndex = 1; sampleIndex < samples.length; sampleIndex += 1) {
    const previous = samples[sampleIndex - 1];
    const current = samples[sampleIndex];
    for (const planet of SIGN_TRANSIT_PLANETS) {
      const before = previous.positions.find((item) => item.planet === planet)!;
      const after = current.positions.find((item) => item.planet === planet)!;
      if (before.sign !== after.sign) {
        const id = evidenceId('sky', periodKey, 'event', 'ingress', planet, current.timestamp);
        events.push({
          evidenceId: id,
          kind: 'ingress',
          planet,
          previousObservedAt: previous.timestamp,
          observedAt: current.timestamp,
          fromSign: before.sign,
          toSign: after.sign,
          speedLongitude: after.speedLongitude,
        });
        seen.add(id);
      }
      if (before.retrograde !== after.retrograde) {
        const id = evidenceId('sky', periodKey, 'event', 'station', planet, current.timestamp);
        events.push({
          evidenceId: id,
          kind: 'station',
          planet,
          previousObservedAt: previous.timestamp,
          observedAt: current.timestamp,
          motion: after.retrograde ? 'retrograde' : 'direct',
          speedLongitude: after.speedLongitude,
        });
        seen.add(id);
      }
    }
  }

  return events.sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.evidenceId.localeCompare(b.evidenceId));
}

function buildSolarHousePlacements(
  selectedSign: ZodiacKey,
  samples: SignSkySample[],
  periodKey: string,
): SignSolarHouseFact[] {
  const facts: SignSolarHouseFact[] = [];
  for (const planet of SIGN_TRANSIT_PLANETS) {
    let runStart = 0;
    for (let index = 1; index <= samples.length; index += 1) {
      const previous = samples[index - 1].positions.find((item) => item.planet === planet)!;
      const current = index < samples.length
        ? samples[index].positions.find((item) => item.planet === planet)!
        : null;
      if (current?.sign === previous.sign) continue;
      const firstSample = samples[runStart];
      const lastSample = samples[index - 1];
      const house = getWholeSignSolarHouse(selectedSign, previous.sign);
      facts.push({
        evidenceId: evidenceId(
          'sign',
          selectedSign,
          periodKey,
          'solar-house',
          planet,
          previous.sign,
          house,
          runStart,
        ),
        planet,
        transitSign: previous.sign,
        wholeSignHouse: house,
        from: firstSample.timestamp,
        to: lastSample.timestamp,
      });
      runStart = index;
    }
  }
  return facts;
}

function moscowDateForTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: SIGN_SKY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function buildSignSkyBatchDigest(
  period: SignHoroscopePeriod,
  periodKey: string,
  calculator: SignTransitCalculator = calculatePlanetaryTransitsAt,
): SignSkyBatchDigest {
  const dates = buildMoscowSignSampleDates(period, periodKey);
  const samples = dates.map((date): SignSkySample => {
    const timestamp = date.toISOString();
    const transit = calculator(date);
    const positions = buildPositionFacts(transit, periodKey, timestamp);
    return {
      timestamp,
      moscowLocalDate: moscowDateForTimestamp(timestamp),
      positions,
      aspects: buildAspectFacts(positions, periodKey, timestamp),
    };
  });

  return {
    schemaVersion: SIGN_SKY_DIGEST_VERSION,
    source: 'Swiss Ephemeris',
    timeZone: SIGN_SKY_TIME_ZONE,
    period,
    periodKey,
    sampledAt: samples.map((sample) => sample.timestamp),
    samples,
    events: buildEvents(samples, periodKey),
    signs: ZODIAC_KEYS.map((sign) => ({
      sign,
      rulers: getSignRulers(sign),
      solarHousePlacements: buildSolarHousePlacements(sign, samples, periodKey),
    })),
  };
}

export function collectAllowedEvidenceIds(
  digest: SignSkyBatchDigest,
  sign: ZodiacKey,
): Set<string> {
  const ids = new Set<string>();
  for (const sample of digest.samples) {
    for (const position of sample.positions) ids.add(position.evidenceId);
    for (const aspect of sample.aspects) ids.add(aspect.evidenceId);
  }
  for (const event of digest.events) ids.add(event.evidenceId);
  const signDigest = digest.signs.find((item) => item.sign === sign);
  for (const ruler of signDigest?.rulers || []) ids.add(ruler.evidenceId);
  for (const placement of signDigest?.solarHousePlacements || []) ids.add(placement.evidenceId);
  return ids;
}
