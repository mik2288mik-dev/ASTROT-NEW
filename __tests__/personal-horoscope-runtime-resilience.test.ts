jest.mock('../lib/openaiResponses', () => ({
  createLunaStructuredResponse: jest.fn(),
}));

jest.mock('../services/personalForecastService', () => ({
  loadPersonalForecast: jest.fn(),
}));

import { createLunaStructuredResponse } from '../lib/openaiResponses';
import { generateAiPersonalHoroscopePackage } from '../lib/aiPersonalHoroscopeGeneration';
import { resolvePersonalForecastWindow } from '../lib/personalForecastContract';
import { loadPersonalForecast } from '../services/personalForecastService';
import {
  prewarmUserContent,
  resetPrewarmSessionForTests,
} from '../services/contentPrewarmService';

const mockedLuna = createLunaStructuredResponse as jest.Mock;
const mockedLoadPersonalForecast = loadPersonalForecast as jest.Mock;

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

const window = resolvePersonalForecastWindow('day', '2026-08-15', 'Europe/Moscow');

function softEditorialMissPayload() {
  return {
    opening: 'Михаил, сегодня один уверенный тон попробует выдать себя за правду. Не покупайся.',
    forecast: 'Один разговор сегодня быстро станет громче своего смысла. Человек напротив будет уверенно повторять одну мысль, будто громкость добавляет ей веса. Тебя потянет ответить тем же тоном и наконец поставить точку. Настоящий поворот появится, когда ты перестанешь спорить с подачей и спросишь о сути. После такого вопроса лишняя уверенность заметно сдуется, а решение станет гораздо проще.',
    advice: [
      'Спроси, что человек хочет сказать без красивой подачи.',
      'Не повышай голос вслед за собеседником.',
      'Заканчивай разговор, если ответ снова пошёл по кругу.',
    ],
    memory: {
      primary_domain: 'conversation',
      main_idea_key: 'уверенный тон не равен правоте',
      situation_key: 'разговор становится громче своего смысла',
      turn_key: 'прямой вопрос возвращает разговор к сути',
      irony_key: 'громкость пытается заменить аргумент',
      advice_keys: [
        'спросить о сути',
        'не поднимать голос',
        'закончить повторяющийся разговор',
      ],
    },
  };
}

describe('personal horoscope runtime resilience', () => {
  beforeEach(() => {
    mockedLuna.mockReset();
    mockedLoadPersonalForecast.mockReset();
    resetPrewarmSessionForTests();
  });

  it('returns a safe draft when only a brittle editorial marker misses twice', async () => {
    mockedLuna
      .mockResolvedValueOnce({
        content: JSON.stringify(softEditorialMissPayload()),
        inputTokens: 500,
        outputTokens: 420,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(softEditorialMissPayload()),
        inputTokens: 520,
        outputTokens: 430,
      });

    const forecast = await generateAiPersonalHoroscopePackage({
      profile,
      period: 'day',
      window,
    });

    expect(mockedLuna).toHaveBeenCalledTimes(2);
    expect(mockedLuna.mock.calls[0][0].maxOutputTokens).toBe(2_000);
    expect(forecast.meta.validationStatus).toBe('deterministic_fallback');
    expect(forecast.overview.text).toContain('Михаил');
    expect(forecast.sections).toHaveLength(4);
  });

  it('prewarms Today, Week and Month in order instead of racing them', async () => {
    mockedLoadPersonalForecast.mockImplementation(async (input: {
      period: 'day' | 'week' | 'month';
      options?: { cacheOnly?: boolean };
    }) => {
      if (input.options?.cacheOnly) {
        const error = new Error('not cached') as Error & { status?: number };
        error.status = 404;
        throw error;
      }
      return { forecast: { period: input.period } };
    });

    await prewarmUserContent({
      userId: '42',
      profile,
      chartData: {} as never,
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
  });
});
