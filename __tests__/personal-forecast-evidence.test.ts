import {
  buildPersonalForecastSampleDates,
  selectPersonalForecastDynamicTopics,
} from '../lib/personalForecastEvidence';
import {
  resolvePersonalForecastWindow,
  type CalculatedAstroEvidence,
  type DynamicForecastTopicKey,
  type ForecastTopicKey,
} from '../lib/personalForecastContract';

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

  it('selects only two topics when a third one does not clear the strength threshold', () => {
    const selected = selectPersonalForecastDynamicTopics([
      evidence('business', 80, ['business']),
      evidence('study', 70, ['study']),
      evidence('weak-home', 20, ['home_family']),
    ]);
    expect(selected).toEqual(['business', 'study']);
  });

  it('selects a third calculated topic only when it remains close to the second', () => {
    const selected = selectPersonalForecastDynamicTopics([
      evidence('business', 80, ['business']),
      evidence('study', 70, ['study']),
      evidence('home', 65, ['home_family']),
      evidence('weak', 20, ['creativity']),
    ]);
    expect(selected).toHaveLength(3);
    expect(selected).toEqual(expect.arrayContaining<DynamicForecastTopicKey>([
      'business',
      'study',
      'home_family',
    ]));
  });
});
