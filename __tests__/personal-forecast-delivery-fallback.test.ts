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
  birthPlace: 'Moscow',
  birthTimezone: 'Europe/Moscow',
  language: 'ru' as const,
};

function words(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(' ');
}

function fragment(index: number, count: number, prefix = `фрагмент${index}слово`) {
  return {
    text: words(count, prefix),
    main_idea_key: `мысль ${index}`,
    life_plot_key: `сюжет ${index}`,
    advice_key: index % 2 ? `совет ${index}` : '',
    comparison_key: index === 4 ? 'сравнение четыре' : '',
    evidence_ids: ['profile:personal'],
  };
}

function modelResponse(period: 'day' | 'week' | 'month', options: {
  prefix?: string;
  evidenceId?: string;
} = {}) {
  const count = period === 'day' ? 5 : 1;
  const paragraphWords = period === 'day' ? 22 : period === 'week' ? 82 : 105;
  const evidenceId = options.evidenceId || 'profile:personal';
  return {
    content: JSON.stringify({
      headline: { text: 'Точный личный прогноз дня', evidence_ids: [evidenceId] },
      fragments: Array.from({ length: count }, (_, index) => ({
        ...fragment(index + 1, paragraphWords, `${options.prefix || `фрагмент${index + 1}`}слово`),
        evidence_ids: [evidenceId],
      })),
    }),
    inputTokens: 100,
    outputTokens: 140,
  };
}

describe('personal forecast Responses delivery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assembles Today as overview plus four naturally ordered untitled sections', async () => {
    mockStructuredResponse.mockResolvedValueOnce(modelResponse('day'));
    const forecast = await generatePersonalForecastPackage({
      profile: profile as never,
      chartData: chartFixture,
      model: 'gpt-5.6-luna',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-03', 'Europe/Moscow'),
    });

    expect(isPersonalForecastPackage(forecast)).toBe(true);
    expect(forecast.overview.text).toContain('фрагмент1слово1');
    expect(forecast.sections).toHaveLength(4);
    expect(forecast.sections.map((section) => section.text.split(/\s/u)[0])).toEqual([
      'фрагмент2слово1',
      'фрагмент3слово1',
      'фрагмент4слово1',
      'фрагмент5слово1',
    ]);
    expect(forecast.sections.every((section) => section.title === undefined)).toBe(true);
    expect(mockStructuredResponse).toHaveBeenCalledTimes(1);
  });

  it.each(['week', 'month'] as const)(
    'assembles %s as one cohesive overview with no sections',
    async (period) => {
      mockStructuredResponse.mockResolvedValueOnce(modelResponse(period));
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
      expect(forecast.sections).toEqual([]);
      expect(forecast.meta.validationStatus).toBe('valid');
    },
  );

  it('rejects two responses with an unknown profile reference', async () => {
    mockStructuredResponse.mockResolvedValue(modelResponse('day', { evidenceId: 'profile:missing' }));

    await expect(generatePersonalForecastPackage({
      profile: profile as never,
      chartData: chartFixture,
      model: 'gpt-5.6-luna',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-03', 'Europe/Moscow'),
    })).rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID');
    expect(mockStructuredResponse).toHaveBeenCalledTimes(2);
  });

  it('rejects near-identical regeneration after exactly two writer attempts', async () => {
    mockStructuredResponse.mockResolvedValue(modelResponse('day', { prefix: 'повтор' }));

    await expect(generatePersonalForecastPackage({
      profile: profile as never,
      chartData: chartFixture,
      model: 'gpt-5.6-luna',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-03', 'Europe/Moscow'),
      recentForecasts: [{
        periodKey: '2026-08-02',
        fragments: Array.from({ length: 5 }, (_, index) => ({
          text: words(22, `повторслово`),
          semanticFingerprint: null,
        })),
      }],
    })).rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID');
    expect(mockStructuredResponse).toHaveBeenCalledTimes(2);
  });

  it('sends Luna natal context and recent text without generic story direction', async () => {
    mockStructuredResponse.mockResolvedValueOnce(modelResponse('day'));

    await generatePersonalForecastPackage({
      profile: { ...profile, name: 'Мира' } as never,
      chartData: chartFixture,
      model: 'gpt-5.6-luna',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-03', 'Europe/Moscow'),
      recentForecasts: [{
        periodKey: '2026-08-02',
        fragments: [{ text: 'Недавняя формулировка для защиты от повтора.', semanticFingerprint: null }],
      }],
    });

    const params = mockStructuredResponse.mock.calls[0][0] as { input: string };
    expect(params.input).toContain('"name": "Мира"');
    expect(params.input).toContain('"birth_date": "1990-01-01"');
    expect(params.input).toContain('"birth_time": "12:00"');
    expect(params.input).toContain('"birth_place": "Moscow"');
    expect(params.input).toContain('"saved_natal_context"');
    expect(params.input).toContain('Недавняя формулировка');
    expect(params.input).not.toContain('story_direction');
    expect(params.input).not.toContain('Calculated evidence');
    expect(params.input).not.toContain('transit_planet');
  });
});
