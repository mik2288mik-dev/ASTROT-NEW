import {
  buildPersonalForecastIngressAndStationEvidence,
  type PersonalForecastCalculatedEvidence,
} from '../lib/astrologerQuestionEvidence';
import { compilePersonalForecastSemanticFacts } from '../lib/astrologerQuestionSemantics';
import { detectTransitAspects } from '../lib/transitAspects';
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
      strength: 85,
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

    const fastAspect: PersonalForecastCalculatedEvidence = {
      ...evidence[0],
      id: 'fixture:fast-daily-aspect',
      house: null,
    };
    const slowAspect: PersonalForecastCalculatedEvidence = {
      ...evidence[0],
      id: 'fixture:slow-outer-aspect',
      transitPlanet: 'pluto',
      natalPoint: 'sun',
      aspect: 'conjunction',
      house: null,
      orb: 0,
    };
    const houseOnly: PersonalForecastCalculatedEvidence = {
      ...evidence[0],
      id: 'fixture:house-only',
      kind: 'transit_house',
      transitPlanet: 'mars',
      natalPoint: null,
      aspect: null,
      house: 10,
      orb: null,
      status: 'active',
      strength: 100,
    };
    const rankedByPeriod = (['day', 'week', 'month'] as const).map((period) => (
      compilePersonalForecastSemanticFacts({
        evidence: [slowAspect, houseOnly, fastAspect],
        period,
        chartData: chart('exact'),
      })
    ));
    expect(rankedByPeriod[0]).toHaveLength(1);
    expect(rankedByPeriod[0][0].transitPlanet).toBe('mars');
    expect(rankedByPeriod[1]).toHaveLength(1);
    expect(rankedByPeriod[1][0].transitPlanet).toBe('mars');
    expect(rankedByPeriod[2].map((fact) => fact.transitPlanet)).toEqual(
      expect.arrayContaining(['mars', 'pluto']),
    );
    const targetLedTopics = compilePersonalForecastSemanticFacts({
      evidence: [
        {
          ...fastAspect,
          id: 'fixture:mercury-target-in-second-house',
          house: 2,
        },
        {
          ...fastAspect,
          id: 'fixture:venus-target-in-second-house',
          transitPlanet: 'venus',
          natalPoint: 'venus',
          house: 2,
        },
      ],
      period: 'day',
      chartData: chart('exact'),
    });
    expect(targetLedTopics).toHaveLength(2);
    expect(targetLedTopics.map((fact) => fact.domain)).toEqual(expect.arrayContaining([
      'communication_decisions',
      'values_agreements',
    ]));
    expect(targetLedTopics.every((fact) => fact.lifeContext === 'personal_resources')).toBe(true);

    const confirmedTopic = compilePersonalForecastSemanticFacts({
      evidence: [
        {
          ...fastAspect,
          id: 'fixture:mercury-sextile-saturn',
          transitPlanet: 'mercury',
          natalPoint: 'saturn',
          aspect: 'sextile',
          orb: 2,
          status: 'applying',
        },
        {
          ...fastAspect,
          id: 'fixture:venus-sextile-saturn',
          transitPlanet: 'venus',
          natalPoint: 'saturn',
          aspect: 'sextile',
          orb: 2,
          status: 'applying',
        },
      ],
      period: 'day',
      chartData: chart('exact'),
    });
    expect(confirmedTopic).toHaveLength(1);
    expect(confirmedTopic[0].evidenceIds).toEqual(expect.arrayContaining([
      'fixture:mercury-sextile-saturn',
      'fixture:venus-sextile-saturn',
    ]));

    const applyingBeforeSeparating = compilePersonalForecastSemanticFacts({
      evidence: [
        {
          ...fastAspect,
          id: 'fixture:applying-mercury-square-mars',
          transitPlanet: 'mercury',
          natalPoint: 'mars',
          orb: 1,
          status: 'applying',
        },
        {
          ...fastAspect,
          id: 'fixture:separating-venus-square-mars',
          transitPlanet: 'venus',
          natalPoint: 'mars',
          orb: 1,
          status: 'separating',
        },
      ],
      period: 'day',
      chartData: chart('exact'),
    });
    expect(applyingBeforeSeparating[0]).toMatchObject({
      transitPlanet: 'mercury',
      timing: { phase: 'applying' },
    });

    const dailyFastActivator: PersonalForecastCalculatedEvidence = {
      ...fastAspect,
      id: 'fixture:daily-fast-activator',
      aspect: 'sextile',
      orb: 1.5,
      status: 'applying',
    };
    const activatedSlowBackground = compilePersonalForecastSemanticFacts({
      evidence: [dailyFastActivator, {
        ...dailyFastActivator,
        id: 'fixture:slow-background-activated',
        transitPlanet: 'saturn',
        natalPoint: 'mercury',
        aspect: 'conjunction',
        orb: 0,
        status: 'exact',
      }],
      period: 'day',
      chartData: chart('exact'),
    });
    expect(activatedSlowBackground).toHaveLength(1);
    expect(activatedSlowBackground[0]).toMatchObject({ transitPlanet: 'mars' });
    expect(activatedSlowBackground[0].evidenceIds).toContain(
      'fixture:slow-background-activated',
    );

    const weakAspectWithHouseOnly = compilePersonalForecastSemanticFacts({
      evidence: [
        {
          ...fastAspect,
          id: 'fixture:weak-moon-mercury',
          transitPlanet: 'moon',
          natalPoint: 'mercury',
          aspect: 'sextile',
          house: 3,
          orb: 3.9,
          status: 'separating',
        },
        {
          ...houseOnly,
          id: 'fixture:communication-house-only',
          house: 3,
        },
        {
          ...fastAspect,
          id: 'fixture:weak-venus-mercury',
          transitPlanet: 'venus',
          natalPoint: 'mercury',
          aspect: 'sextile',
          house: 3,
          orb: 3.8,
          status: 'separating',
        },
      ],
      period: 'day',
      chartData: chart('exact'),
    });
    expect(weakAspectWithHouseOnly[0]).toMatchObject({
      sourceKind: 'period_aggregate',
      mechanism: { dynamic: 'low_signal' },
    });

    const calm = compilePersonalForecastSemanticFacts({
      evidence: [{
        ...fastAspect,
        id: 'fixture:weak-moon-sextile-jupiter',
        transitPlanet: 'moon',
        natalPoint: 'jupiter',
        aspect: 'sextile',
        orb: 3.9,
        status: 'separating',
      }],
      period: 'day',
      chartData: chart('exact'),
    });
    expect(calm).toHaveLength(1);
    expect(calm[0]).toMatchObject({
      sourceKind: 'period_aggregate',
      domain: 'cycle_attention',
      mechanism: { dynamic: 'low_signal' },
    });

    const exactChart = chart('exact');
    const mcAspects = detectTransitAspects(exactChart, {
      date: '2026-08-02T12:00:00.000Z',
      sun: transit('sun', 15),
      moon: transit('moon', 20),
      mars: transit('mars', 0),
      source: 'swisseph',
    }, { limit: 120 });
    expect(mcAspects).toEqual(expect.arrayContaining([
      expect.objectContaining({ transitPlanet: 'mars', natalPlanet: 'mc', type: 'square' }),
    ]));
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

    const untimedMcAspects = detectTransitAspects(chartData, {
      date: '2026-08-02T12:00:00.000Z',
      sun: transit('sun', 15),
      moon: transit('moon', 20),
      mars: transit('mars', 0),
      source: 'swisseph',
    }, { limit: 120 });
    expect(untimedMcAspects.some((aspect) => aspect.natalPlanet === 'mc')).toBe(false);

    const rejectedTimedData = compilePersonalForecastSemanticFacts({
      evidence: [{
        id: 'fixture:unknown-time-mc',
        kind: 'transit_to_natal',
        transitPlanet: 'mars',
        natalPoint: 'mc',
        aspect: 'square',
        house: 10,
        orb: 0.1,
        status: 'exact',
        strength: 99,
        polarity: 'challenging',
        calculationSource: 'personal-forecast-v4:swisseph',
      }],
      period: 'day',
      chartData,
    });
    expect(rejectedTimedData[0]).toMatchObject({
      sourceKind: 'period_aggregate',
      mechanism: { dynamic: 'low_signal' },
      house: null,
    });
  });
});
