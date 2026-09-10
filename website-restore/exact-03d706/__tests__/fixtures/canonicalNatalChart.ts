import { buildBirthTimeInterval, type BirthTimeInput } from '../../lib/birthTime';
import type { NatalAngleKey, NatalAngleV2, NatalBodyKey, NatalChartDataV2, NatalPositionV2 } from '../../lib/natalChartV2Types';

export function canonicalNatalChart(options: {
  birthDate?: string;
  birthPlace?: string;
  time?: BirthTimeInput;
  coordinates?: { lat: number; lon: number; timezone: string };
  calculationVersion?: string;
} = {}): NatalChartDataV2 {
  const date = options.birthDate || '1990-01-01';
  const place = options.birthPlace || 'Москва';
  const time: BirthTimeInput = options.time || { mode: 'exact', localTime: '08:15', uncertaintyMinutes: null, rangeStart: null, rangeEnd: null };
  const coordinates = options.coordinates || { lat: 55.75, lon: 37.62, timezone: 'Europe/Moscow' };
  const knownTime = time.mode !== 'unknown';
  const exact = time.mode === 'exact';
  const quality = exact ? 'exact' : knownTime ? 'approximate' : 'unknown';
  const reliability = exact ? 'exact' : 'stable_in_range';
  const version = options.calculationVersion || 'swisseph-canonical-v2';
  const keys: NatalBodyKey[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'northNode', 'southNode'];
  const positions = Object.fromEntries(keys.map((key, i) => [key, {
    key, planet: key, object: key, kind: key.endsWith('Node') ? 'lunar_node' : 'planet',
    longitude: i * 20 + 5, degree: (i * 20 + 5) % 30,
    sign: ['Aries', 'Aries', 'Taurus', 'Gemini', 'Gemini', 'Cancer', 'Leo', 'Leo', 'Virgo', 'Libra', 'Libra', 'Scorpio', 'Sagittarius'][i],
    house: knownTime ? Math.floor((i * 20 + 5) / 30) + 1 : null,
    speedLongitude: 0.1, retrograde: false, source: key === 'southNode' ? 'derived' : 'swisseph',
    reliability, stable: { sign: true, retrograde: true, house: knownTime },
  }])) as Record<NatalBodyKey, NatalPositionV2>;
  const angle = (key: NatalAngleKey, longitude: number, sign: string): NatalAngleV2 => ({
    key, planet: key, object: key, longitude, degree: longitude % 30, sign,
    source: 'swisseph', reliability, stableSign: true,
  });
  const angles = {
    ascendant: knownTime ? angle('ascendant', 0, 'Aries') : null,
    mc: knownTime ? angle('mc', 270, 'Capricorn') : null,
    descendant: knownTime ? angle('descendant', 180, 'Libra') : null,
    ic: knownTime ? angle('ic', 90, 'Cancer') : null,
  };
  const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  return {
    schemaVersion: 'natal-chart-data-v2', calculationVersion: version,
    birth: {
      localDate: date, localTime: time.localTime, place,
      latitude: coordinates.lat, longitude: coordinates.lon, timezone: coordinates.timezone,
      time, interval: buildBirthTimeInterval(date, coordinates.timezone, time),
    },
    positions, angles, ...positions, rising: angles.ascendant, mc: angles.mc,
    houses: knownTime ? Array.from({ length: 12 }, (_, i) => ({ house: i + 1, longitude: i * 30, degree: 0, sign: signs[i], reliability, stableSign: true })) : [],
    aspects: [{ id: 'sun-venus-trine', from: 'Sun', to: 'Venus', fromKey: 'sun', toKey: 'venus', type: 'trine', exactAngle: 120, angle: 120, angularDistance: 119, orb: 1, orbRange: { min: 1, max: 1 }, phase: 'applying', reliable: true, sampleCoverage: 1 }],
    chartQuality: {
      birthTimeMode: time.mode, birthTimeQuality: quality, exactTime: exact,
      anglesAvailable: knownTime, housesAvailable: knownTime,
      ascendantReliable: knownTime, housesReliable: knownTime, houseBasedPersonalization: knownTime,
      stableHousePlacements: knownTime ? keys : [],
      variableBodies: [], variableAngles: [], variableHouses: [], variableAspectIds: [], notes: [],
    },
    calculationMetadata: {
      ephemerisEngine: 'Swiss Ephemeris', ephemerisMode: 'swisseph', ephemerisLibraryVersion: '1.0.4',
      zodiac: 'tropical', coordinateCenter: 'geocentric', houseSystem: knownTime ? 'placidus' : null,
      houseFallbackUsed: false, housesComputedFrom: exact ? 'exact_time' : knownTime ? 'time_range' : 'not_computed',
      aspectRulesVersion: 'test-v1', calculationVersion: version, calculatedAt: '2026-09-04T12:00:00.000Z', sampleCount: 1,
    },
    birthTimeQuality: quality,
    latitude: coordinates.lat, longitude: coordinates.lon, timezone: coordinates.timezone,
  };
}
