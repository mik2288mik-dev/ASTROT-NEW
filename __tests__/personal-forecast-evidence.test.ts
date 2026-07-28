import {
  assignPersonalForecastPrimaryEvidence,
  buildPersonalForecastAspectEvidence,
  buildPersonalForecastContinuationSampleDates,
  buildPersonalForecastHouseEvidence,
  buildPersonalForecastIngressAndStationEvidence,
  buildPersonalForecastSampleDates,
  selectPersonalForecastDynamicTopics,
  validatePersonalForecastEvidenceTopicKeys,
} from '../lib/personalForecastEvidence';
import * as transitAspects from '../lib/transitAspects';
import type {
  CurrentTransits,
  PlanetTransit,
} from '../lib/transits-calculator';
import {
  DYNAMIC_FORECAST_TOPIC_KEYS,
  resolvePersonalForecastWindow,
  type CalculatedAstroEvidence,
  type DynamicForecastTopicKey,
  type ForecastTopicKey,
} from '../lib/personalForecastContract';
import type { NatalChartData } from '../types';

function evidence(
  id: string,
  strength: number,
  topicKeys: ForecastTopicKey[],
): CalculatedAstroEvidence {
  return {
    id,
    kind: 'transit_to_natal',
    transitPlanet: 'saturn',
    natalPoint: 'sun',
    aspect: 'trine',
    orb: 1,
    status: 'applying',
    startsAt: '2026-07-01T00:00:00.000Z',
    endsAt: '2026-07-31T23:59:59.000Z',
    strength,
    polarity: 'supporting',
    topicKeys,
    calculationSource: 'test:swisseph',
  };
}

function transit(
  planet: string,
  longitude: number,
  options: Partial<PlanetTransit> = {},
): PlanetTransit {
  const signIndex = Math.floor(((longitude % 360) + 360) % 360 / 30);
  const signs = [
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
  ];
  return {
    planet,
    sign: signs[signIndex],
    degree: longitude % 30,
    longitude,
    retrograde: false,
    speedLongitude: 1,
    ...options,
  };
}

function snapshot(
  at: string,
  overrides: Partial<CurrentTransits> = {},
): { at: Date; transits: CurrentTransits } {
  return {
    at: new Date(at),
    transits: {
      date: at,
      sun: transit('sun', 15),
      moon: transit('moon', 75),
      source: 'swisseph',
      ...overrides,
    },
  };
}

function chartWithHouses(
  houseBasedPersonalization = true,
): NatalChartData {
  const position = (planet: string, longitude: number, house = 1) => ({
    planet,
    sign: 'Aries',
    degree: longitude,
    longitude,
    house,
    description: planet,
  });
  return {
    sun: position('sun', 0),
    moon: position('moon', 5),
    rising: position('rising', 0),
    mercury: position('mercury', 10),
    venus: position('venus', 15),
    mars: position('mars', 20),
    jupiter: position('jupiter', 25),
    saturn: position('saturn', 30),
    houses: Array.from({ length: 12 }, (_, index) => ({
      house: index + 1,
      sign: 'Aries',
      degree: 0,
      longitude: index * 30,
    })),
    birthTimeQuality: 'exact',
    chartQuality: {
      birthTimeQuality: 'exact',
      ascendantReliable: houseBasedPersonalization,
      housesReliable: houseBasedPersonalization,
      houseBasedPersonalization,
      notes: [],
    },
    element: 'Fire',
    rulingPlanet: 'mars',
    summary: 'test',
  };
}

describe('personal forecast deterministic evidence preparation', () => {
  it.each([
    ['day', '2026-07-26', 9],
    ['week', '2026-W30', 8],
    ['month', '2026-02', 29],
  ] as const)('samples the full %s interval instead of one instant', (period, key, minimumSamples) => {
    const window = resolvePersonalForecastWindow(period, key, 'Europe/Moscow');
    const samples = buildPersonalForecastSampleDates(period, window);
    expect(samples.length).toBeGreaterThanOrEqual(minimumSamples);
    expect(samples[0].toISOString()).toBe(window.startsAt.toISOString());
    expect(samples[samples.length - 1].toISOString()).toBe(window.endsAt.toISOString());
  });

  it('samples the full year while filtering daily noise later in calculation', () => {
    const window = resolvePersonalForecastWindow('year', '2026', 'Europe/Moscow');
    const samples = buildPersonalForecastSampleDates('year', window);
    expect(samples.length).toBeGreaterThan(70);
    expect(samples[0].toISOString()).toBe(window.startsAt.toISOString());
    expect(samples[samples.length - 1].toISOString()).toBe(window.endsAt.toISOString());
  });

  it('uses a bounded lookahead only for cross-period continuation evidence', () => {
    const dayWindow = resolvePersonalForecastWindow(
      'day',
      '2026-07-26',
      'Europe/Moscow',
    );
    const continuation = buildPersonalForecastContinuationSampleDates(
      'day',
      dayWindow,
    );
    expect(continuation[0].getTime()).toBeGreaterThan(
      dayWindow.endsAt.getTime(),
    );
    expect(continuation[continuation.length - 1].getTime()).toBe(
      dayWindow.endsAt.getTime() + 7 * 24 * 60 * 60 * 1000,
    );
    const yearWindow = resolvePersonalForecastWindow(
      'year',
      '2026',
      'Europe/Moscow',
    );
    expect(
      buildPersonalForecastContinuationSampleDates('year', yearWindow),
    ).toEqual([]);
  });

  it('rejects legacy or unknown topic keys in calculated evidence', () => {
    const invalid = evidence(
      'legacy-topic',
      80,
      ['mood_energy' as ForecastTopicKey],
    );
    expect(validatePersonalForecastEvidenceTopicKeys([invalid]))
      .toEqual(['mood_energy']);
    expect(validatePersonalForecastEvidenceTopicKeys([
      evidence('mood', 80, ['mood']),
      evidence('decision', 80, ['important_decision']),
    ])).toEqual([]);
  });

  it('selects exactly two dynamics when a third does not clear the evidence threshold', () => {
    const selected = selectPersonalForecastDynamicTopics([
      evidence('business', 80, ['business']),
      evidence('study', 70, ['study']),
      evidence('weak-creativity', 20, ['creativity']),
    ]);
    expect(selected).toEqual(['business', 'study']);
  });

  it('expands to three or four dynamics only when calculated strength remains close', () => {
    const three = selectPersonalForecastDynamicTopics([
      evidence('business', 80, ['business']),
      evidence('study', 72, ['study']),
      evidence('creativity', 65, ['creativity']),
      evidence('weak-relocation', 20, ['relocation']),
    ]);
    expect(three).toEqual(['business', 'study', 'creativity']);

    const four = selectPersonalForecastDynamicTopics([
      evidence('business', 80, ['business']),
      evidence('study', 75, ['study']),
      evidence('creativity', 70, ['creativity']),
      evidence('relocation', 66, ['relocation']),
      evidence('documents', 30, ['documents_agreements']),
    ]);
    expect(four).toEqual([
      'business',
      'study',
      'creativity',
      'relocation',
    ]);
    expect(four).toHaveLength(4);
    expect(four.every((key) => DYNAMIC_FORECAST_TOPIC_KEYS.includes(key))).toBe(true);
  });

  it('uses the previous period only as a deterministic novelty tie-breaker', () => {
    const selected = selectPersonalForecastDynamicTopics(
      [
        evidence('business', 70, ['business']),
        evidence('study', 70, ['study']),
        evidence('creativity', 15, ['creativity']),
      ],
      ['business'] satisfies DynamicForecastTopicKey[],
    );
    expect(selected.slice(0, 2)).toEqual(['study', 'business']);
  });

  it('splits a recurring transit aspect into contiguous episodes with unique ids', () => {
    const aspect = {
      transitPlanet: 'saturn',
      natalPlanet: 'sun',
      type: 'trine' as const,
      orb: 1,
      tone: 'support' as const,
    };
    const detect = jest.spyOn(transitAspects, 'detectTransitAspects');
    detect
      .mockReturnValueOnce([{ ...aspect, orb: 2 }])
      .mockReturnValueOnce([{ ...aspect, orb: 1 }])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ ...aspect, orb: 2.5 }])
      .mockReturnValueOnce([{ ...aspect, orb: 1.5 }]);
    const snapshots = [
      snapshot('2026-07-01T00:00:00.000Z'),
      snapshot('2026-07-02T00:00:00.000Z'),
      snapshot('2026-07-03T00:00:00.000Z'),
      snapshot('2026-07-04T00:00:00.000Z'),
      snapshot('2026-07-05T00:00:00.000Z'),
    ];

    const result = buildPersonalForecastAspectEvidence(
      chartWithHouses(),
      'month',
      '2026-07',
      snapshots,
    );

    expect(result).toHaveLength(2);
    expect(new Set(result.map((item) => item.id)).size).toBe(2);
    expect(result[0]).toMatchObject({
      startsAt: snapshots[0].at.toISOString(),
      endsAt: snapshots[1].at.toISOString(),
    });
    expect(result[1]).toMatchObject({
      startsAt: snapshots[3].at.toISOString(),
      endsAt: snapshots[4].at.toISOString(),
    });
    detect.mockRestore();
  });

  it('builds transit-house evidence from contiguous house episodes, including a return episode', () => {
    const snapshots = [
      snapshot('2026-07-01T00:00:00.000Z', { mars: transit('mars', 15) }),
      snapshot('2026-07-02T00:00:00.000Z', { mars: transit('mars', 20) }),
      snapshot('2026-07-03T00:00:00.000Z', { mars: transit('mars', 45) }),
      snapshot('2026-07-04T00:00:00.000Z', { mars: transit('mars', 15) }),
    ];

    const marsEpisodes = buildPersonalForecastHouseEvidence(
      chartWithHouses(),
      'month',
      '2026-07',
      snapshots,
    ).filter((item) => item.transitPlanet === 'mars');

    expect(marsEpisodes.map((item) => item.house)).toEqual([1, 2, 1]);
    expect(new Set(marsEpisodes.map((item) => item.id)).size).toBe(3);
    expect(marsEpisodes[0]).toMatchObject({
      startsAt: snapshots[0].at.toISOString(),
      endsAt: snapshots[1].at.toISOString(),
    });
    expect(marsEpisodes[2]).toMatchObject({
      startsAt: snapshots[3].at.toISOString(),
      endsAt: snapshots[3].at.toISOString(),
    });
  });

  it('does not use natal or transit houses when house personalization is unreliable', () => {
    const unreliableChart = chartWithHouses(false);
    const detect = jest.spyOn(transitAspects, 'detectTransitAspects')
      .mockReturnValue([{
        transitPlanet: 'saturn',
        natalPlanet: 'sun',
        type: 'trine',
        orb: 1,
        tone: 'support',
      }]);
    const snapshots = [
      snapshot('2026-07-01T00:00:00.000Z', { saturn: transit('saturn', 15) }),
      snapshot('2026-07-02T00:00:00.000Z', { saturn: transit('saturn', 16) }),
    ];

    const aspects = buildPersonalForecastAspectEvidence(
      unreliableChart,
      'month',
      '2026-07',
      snapshots,
    );
    expect(aspects[0].house).toBeNull();
    expect(aspects[0].topicKeys).not.toContain('physical_activity');
    expect(buildPersonalForecastHouseEvidence(
      unreliableChart,
      'month',
      '2026-07',
      snapshots,
    )).toEqual([]);
    detect.mockRestore();
  });

  it('fails closed for legacy charts without explicit birth-time quality', () => {
    const exactChart = chartWithHouses();
    const legacyChart: NatalChartData = {
      ...exactChart,
      birthTimeQuality: undefined,
      chartQuality: undefined,
    };
    const snapshots = [
      snapshot('2026-07-01T00:00:00.000Z', {
        sun: transit('sun', 0),
        mars: transit('mars', 15),
      }),
    ];

    expect(buildPersonalForecastHouseEvidence(
      legacyChart,
      'month',
      '2026-07',
      snapshots,
    )).toEqual([]);
    expect(
      transitAspects.detectTransitAspects(
        legacyChart,
        snapshots[0].transits,
        { limit: 120 },
      ).some((item) => item.natalPlanet === 'rising'),
    ).toBe(false);
    expect(
      transitAspects.detectTransitAspects(
        exactChart,
        snapshots[0].transits,
        { limit: 120 },
      ).some((item) => item.natalPlanet === 'rising'),
    ).toBe(true);
  });

  it('filters short-lived ingress and station noise for long periods and keeps sampled events non-exact', () => {
    const first = snapshot('2026-01-01T00:00:00.000Z', {
      sun: transit('sun', 29),
      moon: transit('moon', 29),
      mercury: transit('mercury', 29),
      venus: transit('venus', 29),
      mars: transit('mars', 29),
      jupiter: transit('jupiter', 29),
    });
    const second = snapshot('2026-01-06T00:00:00.000Z', {
      sun: transit('sun', 31),
      moon: transit('moon', 31),
      mercury: transit('mercury', 31),
      venus: transit('venus', 31),
      mars: transit('mars', 31, { retrograde: true }),
      jupiter: transit('jupiter', 31),
    });

    const yearly = buildPersonalForecastIngressAndStationEvidence(
      chartWithHouses(),
      'year',
      '2026',
      [first, second],
    );
    expect(yearly.some((item) => (
      ['moon', 'sun', 'mercury', 'venus'].includes(item.transitPlanet || '')
    ))).toBe(false);
    const sampledStation = yearly.find((item) => (
      item.kind === 'station' && item.transitPlanet === 'mars'
    ));
    expect(sampledStation).toMatchObject({
      status: 'active',
      exactAt: null,
      startsAt: first.at.toISOString(),
      endsAt: second.at.toISOString(),
    });

    const monthly = buildPersonalForecastIngressAndStationEvidence(
      chartWithHouses(),
      'month',
      '2026-01',
      [first, second],
    );
    expect(monthly.some((item) => item.transitPlanet === 'moon')).toBe(false);
  });

  it('assigns primary evidence one-to-one, deterministically, without fallback reuse', () => {
    const shared = evidence('shared', 100, ['overview', 'love', 'mood']);
    const loveOnly = evidence('love-only', 80, ['love']);
    const moodOnly = evidence('mood-only', 70, ['mood']);
    const topics: ForecastTopicKey[] = ['overview', 'love', 'mood'];
    const assigned = assignPersonalForecastPrimaryEvidence(
      topics,
      [moodOnly, shared, loveOnly],
    );
    const reordered = assignPersonalForecastPrimaryEvidence(
      topics,
      [loveOnly, moodOnly, shared],
    );

    expect(Object.fromEntries(
      [...assigned].map(([topic, item]) => [topic, item.id]),
    )).toEqual({
      overview: 'shared',
      love: 'love-only',
      mood: 'mood-only',
    });
    expect([...assigned.values()].map((item) => item.id)).toEqual(
      [...reordered.values()].map((item) => item.id),
    );

    const insufficient = assignPersonalForecastPrimaryEvidence(
      ['overview', 'love'],
      [evidence('only-one', 100, ['overview', 'love'])],
    );
    expect(insufficient.size).toBe(1);
    expect(new Set([...insufficient.values()].map((item) => item.id)).size).toBe(1);
  });
});
