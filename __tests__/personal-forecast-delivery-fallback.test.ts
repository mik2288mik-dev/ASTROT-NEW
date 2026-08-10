import type { PersonalForecastCalculatedEvidence } from '../lib/personalForecastEvidence';

const mockCalculatePersonalForecastEvidence = jest.fn();
const mockChatCreate = jest.fn();

jest.mock('../lib/personalForecastEvidence', () => {
  const actual = jest.requireActual('../lib/personalForecastEvidence');
  return {
    ...actual,
    calculatePersonalForecastEvidence: (...args: unknown[]) => (
      mockCalculatePersonalForecastEvidence(...args)
    ),
  };
});

jest.mock('../lib/contentAiClient', () => ({
  isDeepSeekModel: (model: string) => model.startsWith('deepseek-'),
  getContentAiClient: () => ({
    chat: { completions: { create: (...args: unknown[]) => mockChatCreate(...args) } },
  }),
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

function evidence(
  id: string,
  natalPoint: 'mercury' | 'venus',
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
      factor: 'Марс — квадрат к Меркурию',
      orb: item.orb,
      status: item.status,
      period: '3 августа',
      meaning: 'Расчётный факт периода.',
    }])),
  };
}

function modelResponse(evidenceId: string) {
  return {
    choices: [{ message: { content: JSON.stringify({
      headline: 'Проверь формулировку',
      paragraphs: [{
        text: 'Сегодня точность ответа важнее скорости: одна ясная формулировка снимет лишние вопросы.',
        evidence_ids: [evidenceId],
      }],
      advice: null,
    }) } }],
    usage: { prompt_tokens: 100, completion_tokens: 40 },
  };
}

describe('personal forecast model delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['day', 'week', 'month'] as const)(
    'assembles a contract-valid grounded %s package from one model response',
    async (period) => {
      const evidenceId = `evidence:${period}`;
      mockCalculatePersonalForecastEvidence.mockResolvedValueOnce(
        calculated([evidence(evidenceId, 'mercury')]),
      );
      mockChatCreate.mockResolvedValueOnce(modelResponse(evidenceId));
      const periodKey = getPersonalForecastPeriodKey(
        period,
        new Date('2026-08-03T09:00:00.000Z'),
        'Europe/Moscow',
      );
      const forecast = await generatePersonalForecastPackage({
        profile: profile as never,
        chartData: chartFixture,
        model: 'deepseek-v4-flash',
        period,
        window: resolvePersonalForecastWindow(period, periodKey, 'Europe/Moscow'),
      });

      expect(isPersonalForecastPackage(forecast)).toBe(true);
      expect(forecast.meta.validationStatus).toBe('valid');
      expect(mockChatCreate).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects two ungrounded responses instead of inventing a deterministic reading', async () => {
    mockCalculatePersonalForecastEvidence.mockResolvedValueOnce(
      calculated([evidence('evidence:real', 'mercury')]),
    );
    mockChatCreate.mockResolvedValue(modelResponse('evidence:missing'));

    await expect(generatePersonalForecastPackage({
      profile: profile as never,
      chartData: chartFixture,
      model: 'deepseek-v4-flash',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-03', 'Europe/Moscow'),
    })).rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID');
    expect(mockChatCreate).toHaveBeenCalledTimes(2);
  });

  it('keeps unreliable houses and angles out of the model input', async () => {
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
    const evidenceId = 'evidence:unknown-time';
    mockCalculatePersonalForecastEvidence.mockResolvedValueOnce(
      calculated([evidence(evidenceId, 'mercury')]),
    );
    mockChatCreate.mockResolvedValueOnce(modelResponse(evidenceId));

    await generatePersonalForecastPackage({
      profile: { ...profile, birthTime: '' } as never,
      chartData: unknownTimeChart as never,
      model: 'deepseek-v4-flash',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-03', 'Europe/Moscow'),
    });

    const params = mockChatCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
    };
    const userPrompt = params.messages.find((message) => message.role === 'user')?.content || '';
    expect(userPrompt).toContain('"birth_time_quality": "unknown"');
    expect(userPrompt).toContain('"angles": []');
    expect(userPrompt).not.toContain('"houses"');
  });
});
