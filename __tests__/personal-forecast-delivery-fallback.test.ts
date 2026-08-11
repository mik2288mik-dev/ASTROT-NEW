const mockStructuredResponse = jest.fn();

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

function words(count: number) {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(' ');
}

function modelResponse(paragraphWords: number, evidenceId = 'profile:personal') {
  return {
    content: JSON.stringify({
      phrase: { text: 'Keep the door open.', evidence_ids: [evidenceId] },
      paragraphs: [{ text: words(paragraphWords), evidence_ids: [evidenceId] }],
      advice: {
        text: 'Make room for one honest answer.',
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
    'assembles a contract-valid profile-led %s package from one structured response',
    async (period) => {
      const paragraphWords = { day: 62, week: 82, month: 105 }[period];
      mockStructuredResponse.mockResolvedValueOnce(modelResponse(paragraphWords));
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

  it('rejects two responses with an unknown profile reference', async () => {
    mockStructuredResponse.mockResolvedValue(modelResponse(62, 'profile:missing'));

    await expect(generatePersonalForecastPackage({
      profile: profile as never,
      chartData: chartFixture,
      model: 'gpt-5.6-luna',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-03', 'Europe/Moscow'),
    })).rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID');
    expect(mockStructuredResponse).toHaveBeenCalledTimes(2);
  });

  it('sends Luna a compact natal profile, never period-by-period Swiss evidence', async () => {
    mockStructuredResponse.mockResolvedValueOnce(modelResponse(62));

    await generatePersonalForecastPackage({
      profile: { ...profile, name: 'Mira' } as never,
      chartData: chartFixture,
      model: 'gpt-5.6-luna',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-03', 'Europe/Moscow'),
    });

    const params = mockStructuredResponse.mock.calls[0][0] as { input: string };
    expect(params.input).toContain('"name": "Mira"');
    expect(params.input).toContain('"birth_date": "1990-01-01"');
    expect(params.input).toContain('"natal_profile"');
    expect(params.input).toContain('"sun"');
    expect(params.input).toContain('"advice_lenses"');
    expect(params.input).not.toContain('Calculated evidence');
    expect(params.input).not.toContain('transit_planet');
    expect(params.input).not.toContain('natal_point');
    expect(params.input).not.toContain('"houses"');
  });
});
