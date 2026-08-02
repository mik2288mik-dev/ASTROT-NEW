import {
  buildPersonalForecastIngressAndStationEvidence,
  type PersonalForecastCalculatedEvidence,
} from '../lib/personalForecastEvidence';
import { compilePersonalForecastSemanticFacts } from '../lib/personalForecastSemantics';
import type { CurrentTransits, PlanetTransit } from '../lib/transits-calculator';
import type { NatalChartData } from '../types';

function chart(birthTimeQuality: 'exact' | 'unknown'): NatalChartData {
  const position = (planet: string, longitude: number, house: number) => ({
    planet,
    sign: 'Aries',
    degree: longitude % 30,
    longitude,
    house,
    description: planet,
  });
  const exact = birthTimeQuality === 'exact';
  return {
    sun: position('sun', 0, 1),
    moon: position('moon', 5, 2),
    rising: position('rising', 0, 1),
    mercury: position('mercury', 10, 3),
    venus: position('venus', 15, 4),
    mars: position('mars', 20, 5),
    jupiter: position('jupiter', 25, 6),
    saturn: position('saturn', 30, 7),
    houses: Array.from({ length: 12 }, (_, index) => ({
      house: index + 1,
      sign: 'Aries',
      degree: 0,
      longitude: index * 30,
    })),
    birthTimeQuality,
    chartQuality: {
      birthTimeQuality,
      ascendantReliable: exact,
      housesReliable: exact,
      houseBasedPersonalization: exact,
      notes: [],
    },
    element: 'Fire',
    rulingPlanet: 'mars',
    summary: 'test fixture',
  };
}

function transit(
  planet: string,
  longitude: number,
  options: Partial<PlanetTransit> = {},
): PlanetTransit {
  return {
    planet,
    sign: 'Aries',
    degree: longitude,
    longitude,
    retrograde: false,
    speedLongitude: 1,
    ...options,
  };
}

function snapshot(
  at: string,
  mercury: PlanetTransit,
): { at: Date; transits: CurrentTransits } {
  return {
    at: new Date(at),
    transits: {
      date: at,
      sun: transit('sun', 15),
      moon: transit('moon', 20),
      mercury,
      source: 'swisseph',
    },
  };
}

describe('personal forecast semantic compiler golden fixtures', () => {
  it('keeps an exact Mars square Mercury inside communication and its reliable third-house context', () => {
    const evidence: PersonalForecastCalculatedEvidence[] = [
      {
        id: 'fixture:mars-square-mercury:first',
        kind: 'transit_to_natal',
        transitPlanet: 'mars',
        natalPoint: 'mercury',
        aspect: 'square',
        house: 3,
        orb: 0.2,
        status: 'exact',
        exactAt: '2026-08-02T12:00:00.000Z',
        startsAt: '2026-08-02T06:00:00.000Z',
        endsAt: '2026-08-02T18:00:00.000Z',
        strength: 94,
        polarity: 'challenging',
        calculationSource: 'personal-forecast-v4:swisseph',
      },
      {
        id: 'fixture:mars-square-mercury:duplicate-sample',
        kind: 'transit_to_natal',
        transitPlanet: 'mars',
        natalPoint: 'mercury',
        aspect: 'square',
        house: 3,
        orb: 0.8,
        status: 'separating',
        startsAt: '2026-08-02T15:00:00.000Z',
        endsAt: '2026-08-02T21:00:00.000Z',
        strength: 76,
        polarity: 'challenging',
        calculationSource: 'personal-forecast-v4:swisseph',
      },
    ];

    const rejectedLookalike = {
      ...evidence[0],
      id: 'fixture:not-actually-swiss',
      calculationSource: 'not-swisseph',
    };
    const facts = compilePersonalForecastSemanticFacts({
      evidence: [...evidence, rejectedLookalike],
      period: 'day',
      chartData: chart('exact'),
      language: 'ru',
    });
    const reordered = compilePersonalForecastSemanticFacts({
      evidence: [...evidence].reverse(),
      period: 'day',
      chartData: chart('exact'),
    });

    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      evidenceIds: [
        'fixture:mars-square-mercury:duplicate-sample',
        'fixture:mars-square-mercury:first',
      ],
      sourceKind: 'transit_to_natal',
      transitPlanet: 'mars',
      natalPoint: 'mercury',
      aspect: 'square',
      house: 3,
      domain: 'communication_decisions',
      lifeContext: 'communication_learning',
      mechanism: {
        transit: 'action_pressure',
        dynamic: 'friction',
        stationDirection: null,
      },
      timing: { scope: 'temporary', period: 'day' },
      confidence: 'high',
      strength: 94,
    });
    expect(facts[0].allowedClaimAtoms).toEqual(expect.arrayContaining([
      'communication_and_decisions_are_temporarily_active',
      'action_and_boundaries_are_temporarily_active',
      'temporary_friction_requires_precision',
      'reliable_house_defines_context',
    ]));
    expect(facts[0].allowedManifestationAtoms[0]).toBe(
      'urge_to_act_becomes_more_noticeable',
    );
    expect(facts[0].allowedRiskAtoms).toContain('impulsive_reply_or_missed_detail');
    expect(facts[0].allowedActionAtoms).toContain('verify_wording_numbers_and_sequence');
    expect(facts[0].forbiddenClaimClasses).toEqual(expect.arrayContaining([
      'specific_relationship_event',
      'specific_financial_event',
      'specific_relocation_event',
    ]));
    expect(facts[0].semanticFingerprint).toBe(reordered[0].semanticFingerprint);
    expect(facts[0].evidenceFingerprint).toBe(reordered[0].evidenceFingerprint);
  });

  it('records a Mercury direct station but rejects its house when birth time is unknown', () => {
    const chartData = chart('unknown');
    const first = snapshot(
      '2026-08-02T00:00:00.000Z',
      transit('mercury', 12, { retrograde: true, speedLongitude: -0.12 }),
    );
    const second = snapshot(
      '2026-08-02T03:00:00.000Z',
      transit('mercury', 12.1, { retrograde: false, speedLongitude: 0.09 }),
    );
    const station = buildPersonalForecastIngressAndStationEvidence(
      chartData,
      'day',
      '2026-08-02',
      [first, second],
    ).find((item) => item.kind === 'station' && item.transitPlanet === 'mercury');

    expect(station).toMatchObject({
      house: null,
      motion: {
        directionBefore: 'retrograde',
        directionAfter: 'direct',
        directionChanged: true,
        stationDirection: 'direct',
        speedLongitudeBefore: -0.12,
        speedLongitudeAfter: 0.09,
      },
    });

    const facts = compilePersonalForecastSemanticFacts({
      evidence: station ? [station, { ...station, id: `${station.id}:duplicate` }] : [],
      period: 'day',
      chartData,
    });

    expect(facts).toHaveLength(1);
    expect(facts[0]).toMatchObject({
      domain: 'communication_decisions',
      lifeContext: null,
      house: null,
      mechanism: {
        transit: 'information_exchange',
        dynamic: 'station_turn_direct',
        stationDirection: 'direct',
      },
      timing: { scope: 'temporary', period: 'day' },
    });
    expect(facts[0].allowedClaimAtoms).toContain('process_is_turning_direct');
    expect(facts[0].allowedManifestationAtoms).toContain('stalled_step_can_begin_to_move');
    expect(facts[0].allowedClaimAtoms).not.toContain('reliable_house_defines_context');
    expect(facts[0].forbiddenClaimClasses).toContain('unsupported_house_or_angle');
  });
});
