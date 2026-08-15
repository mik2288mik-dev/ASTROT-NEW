jest.mock('../lib/openaiResponses', () => ({
  createLunaStructuredResponse: jest.fn(),
}));

jest.mock('../services/personalForecastService', () => ({
  loadPersonalForecast: jest.fn(),
}));

import fs from 'fs';
import path from 'path';
import { createLunaStructuredResponse } from '../lib/openaiResponses';
import { generateAiPersonalHoroscopePackage } from '../lib/aiPersonalHoroscopeGeneration';
import { resolveAiPersonalHoroscopeWindow } from '../lib/aiPersonalHoroscope';
import { loadPersonalForecast } from '../services/personalForecastService';
import {
  prewarmUserContent,
  resetPrewarmSessionForTests,
} from '../services/contentPrewarmService';

const mockedLuna = createLunaStructuredResponse as jest.Mock;
const mockedLoadPersonalForecast = loadPersonalForecast as jest.Mock;
const ROOT = path.resolve(__dirname, '..');

const profile = {
  id: '42',
  name: 'Михаил',
  birthDate: '1989-03-06',
  birthTime: '23:15',
  birthPlace: 'Сергиев Посад',
  birthTimezone: 'Europe/Moscow',
  gender: 'male' as const,
  language: 'ru' as const,
  isPremium: true,
  isSetup: true,
  theme: 'light' as const,
};

const window = resolveAiPersonalHoroscopeWindow('day', '2026-08-15', 'Europe/Moscow');

function payload() {
  return {
    opening: 'Михаил, сегодня шум будет громче смысла. Не покупайся.',
    forecast: 'Один разговор попробует занять больше места, чем заслуживает. Человек напротив будет повторять одну мысль с таким видом, будто громкость добавляет ей веса. Тебя потянет ответить тем же тоном, но это только растянет сцену. Спроси о сути и оставь пафос без зрителей. После этого решение окажется обычным и довольно простым.',
    advice: [
      'Спроси, что человек хочет сказать по существу.',
      'Не повышай голос вслед за собеседником.',
      'Заканчивай разговор, если ответ снова идёт по кругу.',
    ],
  };
}

describe('personal horoscope runtime resilience', () => {
  beforeEach(() => {
    mockedLuna.mockReset();
    mockedLoadPersonalForecast.mockReset();
    resetPrewarmSessionForTests();
  });

  it('retries an incomplete provider response without reintroducing a heavy fallback layer', async () => {
    mockedLuna
      .mockRejectedValueOnce(new Error('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens'))
      .mockResolvedValueOnce({
        content: JSON.stringify(payload()),
        inputTokens: 520,
        outputTokens: 430,
      });

    const horoscope = await generateAiPersonalHoroscopePackage({
      profile,
      period: 'day',
      window,
    });

    expect(mockedLuna).toHaveBeenCalledTimes(2);
    expect(mockedLuna.mock.calls[0][0].maxOutputTokens).toBe(2_000);
    expect(horoscope.reading.opening).toContain('Михаил');
    expect(horoscope.meta.generationAttempts).toBe(2);
  });

  it('prewarms Today, Week and Month in order and needs no chartData', async () => {
    mockedLoadPersonalForecast.mockImplementation(async (input: {
      period: 'day' | 'week' | 'month';
      options?: { cacheOnly?: boolean };
    }) => {
      if (input.options?.cacheOnly) {
        const error = new Error('not cached') as Error & { status?: number };
        error.status = 404;
        throw error;
      }
      return { horoscope: { period: input.period } };
    });

    await prewarmUserContent({
      userId: '42',
      profile,
      isPremium: true,
      mode: 'generate-missing',
    });

    expect(mockedLoadPersonalForecast.mock.calls.map((call) => [
      call[0].period,
      call[0].options?.cacheOnly === true ? 'probe' : 'generate',
    ])).toEqual([
      ['day', 'probe'],
      ['day', 'generate'],
      ['week', 'probe'],
      ['week', 'generate'],
      ['month', 'probe'],
      ['month', 'generate'],
    ]);

    const prewarmSource = fs.readFileSync(
      path.join(ROOT, 'services/contentPrewarmService.ts'),
      'utf8',
    );
    expect(prewarmSource).not.toContain('NatalChartData');
    expect(prewarmSource).not.toContain('chartData:');
    expect(prewarmSource).not.toContain('chartId?:');
  });
});
