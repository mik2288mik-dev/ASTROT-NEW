import type { PersonalForecastCalculatedEvidence } from '../lib/personalForecastEvidence';

const mockCalculatePersonalForecastEvidence = jest.fn();
const mockStructuredResponse = jest.fn();

jest.mock('../lib/personalForecastEvidence', () => {
  const actual = jest.requireActual('../lib/personalForecastEvidence');
  return {
    ...actual,
    calculatePersonalForecastEvidence: (...args: unknown[]) => (
      mockCalculatePersonalForecastEvidence(...args)
    ),
  };
});

jest.mock('../lib/openaiResponses', () => ({
  createLunaStructuredResponse: (...args: unknown[]) => mockStructuredResponse(...args),
}));

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

function evidence(id: string, natalPoint: 'mercury' | 'venus'): PersonalForecastCalculatedEvidence {
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
    strength: 96,
    polarity: 'challenging',
    calculationSource: 'personal-forecast-v4:swisseph',
  };
}

function calculated(items: PersonalForecastCalculatedEvidence[]) {
  return {
    evidence: items,
    continuationEvidence: [],
    evidenceViews: Object.fromEntries(items.map((item) => [item.id, {
      id: item.id,
      factor: 'Calculated factor',
      orb: item.orb,
      status: item.status,
      period: 'Selected period',
      meaning: 'Calculated period fact.',
    }])),
  };
}

function words(count: number) {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(' ');
}

function modelResponse(evidenceId: string) {
  return {
    content: JSON.stringify({
      paragraphs: [{ text: words(132), evidence_ids: [evidenceId] }],
      advice: {
        text: 'Check one detail before finalizing the answer.',
        evidence_ids: [evidenceId],
      },
    }),
    inputTokens: 100,
    outputTokens: 40,
  };
}

describe('personal forecast Responses delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['day', 'week', 'month'] as const)(
    'assembles a contract-valid grounded %s package from one structured response',
    async (period) => {
      const evidenceId = `evidence:${period}`;
      mockCalculatePersonalForecastEvidence.mockResolvedValueOnce(
        calculated([evidence(evidenceId, 'mercury')]),
      );
      mockStructuredResponse.mockResolvedValueOnce(modelResponse(evidenceId));
      const periodKey = getPersonalForecastPeriodKey(
        period,
        new Date('2026-08-03T09:00:00.000Z'),
        'Europe/Moscow',
      );
      const forecast = await generatePersonalForecastPackage({
        profile: profile as never,
        chartData: chartFixture,
        model: 'gpt-5.6-luna',
        period,
        window: resolvePersonalForecastWindow(period, periodKey, 'Europe/Moscow'),
      });

      expect(isPersonalForecastPackage(forecast)).toBe(true);
      expect(forecast.meta.validationStatus).toBe('valid');
      expect(mockStructuredResponse).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects two ungrounded responses instead of inventing a deterministic reading', async () => {
    mockCalculatePersonalForecastEvidence.mockResolvedValueOnce(
      calculated([evidence('evidence:real', 'mercury')]),
    );
    mockStructuredResponse.mockResolvedValue(modelResponse('evidence:missing'));

    await expect(generatePersonalForecastPackage({
      profile: profile as never,
      chartData: chartFixture,
      model: 'gpt-5.6-luna',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-03', 'Europe/Moscow'),
    })).rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID');
    expect(mockStructuredResponse).toHaveBeenCalledTimes(2);
  });

  it('keeps unreliable houses and angles out of the Responses input', async () => {
    const unknownTimeChart = {
      ...chartFixture,
      rising: null,
      houses: [],
      birthTimeQuality: 'unknown' as const,
      chartQuality: {
        birthTimeQuality: 'unknown',
        ascendantReliable: false,
        housesReliable: false,
        houseBasedPersonalization: false,
        notes: ['Birth time unknown'],
      },
    };
    const evidenceId = 'evidence:unknown-time';
    mockCalculatePersonalForecastEvidence.mockResolvedValueOnce(
      calculated([evidence(evidenceId, 'mercury')]),
    );
    mockStructuredResponse.mockResolvedValueOnce(modelResponse(evidenceId));

    await generatePersonalForecastPackage({
      profile: { ...profile, birthTime: '' } as never,
      chartData: unknownTimeChart as never,
      model: 'gpt-5.6-luna',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-03', 'Europe/Moscow'),
    });

    const params = mockStructuredResponse.mock.calls[0][0] as { input: string };
    expect(params.input).toContain('"birth_time_quality": "unknown"');
    expect(params.input).toContain('"angles": []');
    expect(params.input).not.toContain('"houses"');
  });
});
