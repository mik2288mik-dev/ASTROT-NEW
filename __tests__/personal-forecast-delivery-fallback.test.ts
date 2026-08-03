import type { PersonalForecastCalculatedEvidence } from '../lib/personalForecastEvidence';

const mockCalculatePersonalForecastEvidence = jest.fn();

jest.mock('../lib/personalForecastEvidence', () => {
  const actual = jest.requireActual('../lib/personalForecastEvidence');
  return {
    ...actual,
    calculatePersonalForecastEvidence: (...args: unknown[]) => (
      mockCalculatePersonalForecastEvidence(...args)
    ),
  };
});

import {
  getPersonalForecastPeriodKey,
  isPersonalForecastPackage,
  resolvePersonalForecastWindow,
} from '../lib/personalForecastContract';
import { generatePersonalForecastPackage } from '../lib/personalForecastGeneration';
import { chartFixture } from './personal-forecast-fixture';

const profile = {
  id: 'delivery-fixture',
  name: 'Fixture',
  birthDate: '1990-01-01',
  birthTime: '12:00',
  birthPlace: '',
  birthTimezone: 'Europe/Moscow',
  language: 'ru' as const,
};

function evidence(
  id: string,
  natalPoint: 'mercury' | 'venus',
  strength: number,
): PersonalForecastCalculatedEvidence {
  return {
    id,
    kind: 'transit_to_natal',
    transitPlanet: natalPoint === 'mercury' ? 'mars' : 'venus',
    natalPoint,
    aspect: 'square',
    house: natalPoint === 'mercury' ? 3 : 2,
    orb: 0.2,
    status: 'exact',
    exactAt: '2026-08-03T12:00:00.000Z',
    startsAt: '2026-08-03T06:00:00.000Z',
    endsAt: '2026-08-03T18:00:00.000Z',
    strength,
    polarity: 'challenging',
    calculationSource: 'personal-forecast-v4:swisseph',
  };
}

function calculated(items: PersonalForecastCalculatedEvidence[], badSecond = false) {
  return {
    evidence: items,
    continuationEvidence: [],
    evidenceViews: Object.fromEntries(items.map((item, index) => [item.id, {
      id: item.id,
      factor: index === 0 ? 'Марс — квадрат к Меркурию' : 'Венера — квадрат к Венере',
      orb: item.orb,
      status: item.status,
      period: '3 августа',
      meaning: badSecond && index === 1
        ? 'Вселенная подсказывает готовый ответ.'
        : 'Точность формулировок и условий сейчас особенно важна.',
    }])),
  };
}

describe('personal forecast delivery fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['day', 'week', 'month'] as const)(
    'assembles a contract-valid model-independent %s package',
    async (period) => {
      mockCalculatePersonalForecastEvidence.mockResolvedValueOnce(
        calculated([evidence(`evidence:${period}`, 'mercury', 96)]),
      );
      const periodKey = getPersonalForecastPeriodKey(
        period,
        new Date('2026-08-03T09:00:00.000Z'),
        'Europe/Moscow',
      );
      const forecast = await generatePersonalForecastPackage({
        profile: profile as never,
        chartData: chartFixture,
        model: 'fixture-model',
        period,
        window: resolvePersonalForecastWindow(period, periodKey, 'Europe/Moscow'),
      });

      expect(isPersonalForecastPackage(forecast)).toBe(true);
      expect(forecast.meta.validationStatus).toBe('deterministic_fallback');
      expect(forecast.sections).toHaveLength(1);
    },
  );

  it('rebuilds an invalid full package from the strongest confirmed fact', async () => {
    mockCalculatePersonalForecastEvidence.mockResolvedValueOnce(calculated([
      evidence('evidence:strongest', 'mercury', 100),
      evidence('evidence:second', 'venus', 99),
    ], true));
    const periodKey = '2026-08-03';
    const forecast = await generatePersonalForecastPackage({
      profile: profile as never,
      chartData: chartFixture,
      model: 'fixture-model',
      period: 'day',
      window: resolvePersonalForecastWindow('day', periodKey, 'Europe/Moscow'),
    });

    expect(isPersonalForecastPackage(forecast)).toBe(true);
    expect(forecast.meta.validationStatus).toBe('deterministic_fallback');
    expect(forecast.meta.diagnosticCode).toContain('PACKAGE_EVIDENCE_INVALID');
    expect(forecast.sections).toHaveLength(1);
    expect(forecast.evidence).toHaveProperty('evidence:strongest');
    expect(forecast.evidence).not.toHaveProperty('evidence:second');
  });

  it('keeps houses and angles out when birth time is unknown', async () => {
    const unknownTimeChart = {
      ...chartFixture,
      rising: null,
      houses: [],
      birthTimeQuality: 'unknown' as const,
      chartQuality: {
        birthTimeQuality: 'unknown' as const,
        ascendantReliable: false,
        housesReliable: false,
        houseBasedPersonalization: false,
        notes: ['Birth time unknown'],
      },
    };
    mockCalculatePersonalForecastEvidence.mockResolvedValueOnce(
      calculated([evidence('evidence:unknown-time', 'mercury', 96)]),
    );
    const forecast = await generatePersonalForecastPackage({
      profile: { ...profile, birthTime: '' } as never,
      chartData: unknownTimeChart as never,
      model: 'fixture-model',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-03', 'Europe/Moscow'),
    });

    expect(isPersonalForecastPackage(forecast)).toBe(true);
    expect(forecast.sections.every((section) => section.visualTag !== 'communication_learning')).toBe(true);
  });
});
