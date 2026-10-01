import * as Astronomy from 'astronomy-engine';
import { buildBigThree, buildChartMoments, buildSkyEventMoments, relativeDayPhraseRu } from '../lib/natalMoments';
import { buildNatalProfile, dignityOf } from '../lib/natalProfile';
import {
  buildCalculationProof,
  formatSignDegree,
  formatUtcOffset,
  verifyCalculationProof,
} from '../lib/natalCalculationProof';
import type { NatalChartDataV2 } from '../lib/natalChartV2Types';

// Swiss Ephemeris output for 22.12.2010 16:26 Dmitrov (Europe/Moscow, UTC+3).
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const body = (key: string, longitude: number, house: number, speed: number) => ({
  object: key, planet: key, key, kind: 'planet', longitude, sign: SIGNS[Math.floor(longitude / 30)],
  degree: longitude % 30, retrograde: speed < 0, speedLongitude: speed, house, source: 'swisseph',
  reliability: 'exact', stable: { sign: true, retrograde: true, house: true },
});
const angle = (key: string, longitude: number) => ({
  key, object: key, planet: key, longitude, sign: SIGNS[Math.floor(longitude / 30)], degree: longitude % 30,
  source: 'swisseph', reliability: 'exact', stableSign: true,
});
const positions = {
  sun: body('sun', 270.5856, 6, 1.018),
  moon: body('moon', 106.2408, 1, 12.9),
  mercury: body('mercury', 264.6833, 6, -1.252),
  venus: body('venus', 224.9361, 5, 0.859),
  mars: body('mars', 281.1003, 7, 0.767),
  jupiter: body('jupiter', 355.3975, 10, 0.109),
  saturn: body('saturn', 196.1714, 5, 0.059),
  uranus: body('uranus', 356.7911, 10, 0.014),
  neptune: body('neptune', 326.4910, 9, 0.024),
  pluto: body('pluto', 274.9912, 6, 0.036),
  chiron: body('chiron', 327.2, 10, 0.05),
  northNode: { ...body('northNode', 272.7, 6, -0.05), kind: 'lunar_node', retrograde: false },
  southNode: { ...body('southNode', 92.7, 12, -0.05), kind: 'lunar_node', retrograde: false },
};
const houseCusps = [99.1125, 112.49, 127.59, 147.8387, 180.03, 232.36, 279.1125, 292.49, 307.59, 327.8387, 0.03, 52.36];

const chart = {
  schemaVersion: 'natal-chart-data-v2',
  birth: {
    localDate: '2010-12-22', localTime: '16:26', place: 'Дмитров', latitude: 56.34485, longitude: 37.52041,
    timezone: 'Europe/Moscow',
    time: { mode: 'exact', localTime: '16:26' },
    interval: { mode: 'exact', localDate: '2010-12-22', timezone: 'Europe/Moscow', localTime: '16:26', uncertaintyMinutes: null,
      rangeStart: null, rangeEnd: null, startUtc: '2010-12-22T13:26:00.000Z', endUtc: '2010-12-22T13:26:00.000Z',
      referenceUtc: '2010-12-22T13:26:00.000Z', sampleUtc: ['2010-12-22T13:26:00.000Z'] },
  },
  positions,
  ...positions,
  angles: {
    ascendant: angle('ascendant', 99.1125), mc: angle('mc', 327.8387),
    descendant: angle('descendant', 279.1125), ic: angle('ic', 147.8387),
  },
  houses: houseCusps.map((longitude, index) => ({ house: index + 1, longitude, sign: SIGNS[Math.floor(longitude / 30)], degree: longitude % 30, reliability: 'exact', stableSign: true })),
  aspects: [
    { id: 'a1', type: 'square', exactAngle: 90, angle: 90.07, angularDistance: 89.93, orb: 0.07, orbRange: { min: 0.07, max: 0.07 }, from: 'Moon', to: 'Saturn', fromKey: 'moon', toKey: 'saturn', phase: 'exact', reliable: true, sampleCoverage: 1 },
  ],
  chartQuality: { birthTimeMode: 'exact', birthTimeQuality: 'exact', exactTime: true, anglesAvailable: true, housesAvailable: true,
    ascendantReliable: true, housesReliable: true, houseBasedPersonalization: true, stableHousePlacements: [], variableBodies: [],
    variableAngles: [], variableHouses: [], variableAspectIds: [], notes: [] },
  calculationMetadata: { ephemerisEngine: 'Swiss Ephemeris', ephemerisMode: 'swisseph', ephemerisLibraryVersion: '1.0.4', zodiac: 'tropical',
    coordinateCenter: 'geocentric', houseSystem: 'placidus', houseFallbackUsed: false, housesComputedFrom: 'exact_time',
    aspectRulesVersion: 'natal-major-aspects-v2', calculationVersion: 'swisseph-canonical-v2', calculatedAt: '2026-08-22T13:26:36.739Z', sampleCount: 1 },
  calculationVersion: 'swisseph-canonical-v2',
  rising: angle('ascendant', 99.1125),
  mc: angle('mc', 327.8387),
  latitude: 56.34485,
  longitude: 37.52041,
  timezone: 'Europe/Moscow',
  birthTimeQuality: 'exact',
} as unknown as NatalChartDataV2;

describe('natal moments', () => {
  it('builds the big three in plain words', () => {
    expect(buildBigThree(chart).map((tile) => `${tile.label}:${tile.signLabel}`)).toEqual([
      'Солнце:Козерог', 'Луна:Рак', 'Асцендент:Рак',
    ]);
  });

  it('finds the real chart moments', () => {
    const moments = buildChartMoments(chart);
    const headlines = moments.map((moment) => moment.headline);
    expect(headlines).toContain('Солнце было в Козероге всего 14 часов');
    expect(headlines).toContain('3 планеты в Козероге');
    expect(headlines).toContain('Больше всего в тебе Воды');
    expect(headlines).toContain('Луна и Сатурн — самая точная связь');
    expect(headlines).toContain('Меркурий шёл назад');
    expect(headlines).toContain('3 планеты в 6 доме');
  });

  it('finds the eclipse and the solstice around the birthday', () => {
    const moments = buildSkyEventMoments(chart, Astronomy);
    expect(moments.map((moment) => moment.headline)).toEqual([
      'На следующий день после полного лунного затмения',
      'На следующий день после зимнего солнцестояния — самого короткого дня в году',
    ]);
    expect(moments[0].body).toContain('21 декабря 2010');
  });

  it('phrases distances to sky events', () => {
    expect(relativeDayPhraseRu(3)).toBe('в тот же день, что и');
    expect(relativeDayPhraseRu(-30)).toBe('за день до');
    expect(relativeDayPhraseRu(50)).toBe('через два дня после');
    expect(relativeDayPhraseRu(200)).toBeNull();
  });
});

describe('natal profile', () => {
  it('follows the Ptolemaic dignities', () => {
    expect(dignityOf('moon', 'Cancer')).toBe('domicile');
    expect(dignityOf('mars', 'Capricorn')).toBe('exaltation');
    expect(dignityOf('saturn', 'Libra')).toBe('exaltation');
    expect(dignityOf('venus', 'Scorpio')).toBe('detriment');
    expect(dignityOf('mercury', 'Sagittarius')).toBe('detriment');
    expect(dignityOf('sun', 'Libra')).toBe('fall');
  });

  it('names the chart ruler, weekdays and strong positions', () => {
    const profile = buildNatalProfile(chart);
    expect(profile?.ruler?.planetLabel).toBe('Луна');
    expect(profile?.ruler?.body).toContain('в своём собственном знаке');
    expect(profile?.weekdays.map((item) => item.day)).toEqual(['Суббота', 'Понедельник']);
    expect(profile?.strongCount).toBe(4);
    expect(profile?.classicVsModern.headline).toBe('Козерог — без споров');
    expect(profile?.history.metal).toBe('свинец');
  });
});

describe('calculation proof', () => {
  it('shows inputs and exact positions', () => {
    const proof = buildCalculationProof(chart, 'Mik', 'ru');
    expect(proof.utcOffsetText).toBe('UTC+3');
    expect(proof.bodies.find((row) => row.key === 'moon')?.degreeText).toBe('16°14′');
    expect(proof.bodies.find((row) => row.key === 'mercury')?.retrograde).toBe(true);
    expect(formatSignDegree(270.5856)).toBe('0°35′');
    expect(formatUtcOffset('2012-06-01', '12:00', '2012-06-01T08:00:00.000Z')).toBe('UTC+4');
  });

  it('matches an independent astronomy-engine calculation', () => {
    const verification = verifyCalculationProof(chart, Astronomy, 'ru');
    expect(verification?.allMatch).toBe(true);
    expect(verification?.maxDifference).toBeLessThan(0.1);
    expect(verification?.checks.length).toBe(24);
    expect(verification?.unchecked).toEqual(['Хирон', 'Северный узел', 'Южный узел']);
  });
});
