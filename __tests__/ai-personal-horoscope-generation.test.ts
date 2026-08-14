jest.mock('../lib/openaiResponses', () => ({
  createLunaStructuredResponse: jest.fn(),
}));

import { createLunaStructuredResponse } from '../lib/openaiResponses';
import {
  AI_PERSONAL_HOROSCOPE_CONTENT_MODE,
  isAiPersonalHoroscopePackage,
  readAiPersonalHoroscopeReading,
} from '../lib/aiPersonalHoroscope';
import {
  buildAiPersonalHoroscopePrompt,
  generateAiPersonalHoroscopePackage,
  getAiPersonalHoroscopeSystemPrompt,
} from '../lib/aiPersonalHoroscopeGeneration';
import { resolvePersonalForecastWindow } from '../lib/personalForecastContract';

const mockedLuna = createLunaStructuredResponse as jest.Mock;
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
const window = resolvePersonalForecastWindow('day', '2026-08-14', 'Europe/Moscow');

function validPayload() {
  return {
    opening: 'Михаил, сегодня всё будет изображать срочность. Не ведись.',
    forecast: 'С утра дела полезут без очереди. Выбери одно главное и закончи его. Люди добавят шума, но не каждый вопрос твой. Не переделывай то, что уже работает. К вечеру станет ясно, что половина суеты была декорацией. Сложные решения оставь на свежую голову.',
    advice: [
      'Не добавляй новые дела до обеда.',
      'Не объясняй очевидное дважды.',
      'Закрой один старый вопрос до конца.',
    ],
    memory: {
      main_idea_key: 'ложная срочность',
      situation_key: 'очередь из дел и чужих вопросов',
      irony_key: 'суета как декорация',
      advice_keys: ['не добавлять', 'не объяснять дважды', 'закрыть старое'],
    },
  };
}

describe('AI-only personal horoscope generation', () => {
  beforeEach(() => {
    mockedLuna.mockReset();
  });

  it('sends Luna only profile, period, history and dialogue context', () => {
    const prompt = buildAiPersonalHoroscopePrompt({
      language: 'ru',
      period: 'day',
      window,
      profile,
      recentForecasts: [],
      conversationMemory: [{
        question: 'Как не сорваться на лишний спор?',
        answer: 'Не отвечай сразу, если разговор уже ходит по кругу.',
        answeredAt: '2026-08-13T10:00:00.000Z',
      }],
    });

    expect(prompt).toContain('personal_profile');
    expect(prompt).toContain('birthDate');
    expect(prompt).toContain('recent_forecasts');
    expect(prompt).toContain('recent_dialogue');
    expect(prompt).not.toContain('chartData');
    expect(prompt).not.toContain('chartId');
    expect(prompt).not.toContain('aspects');
    expect(prompt).not.toContain('houses');
    expect(prompt).not.toContain('transits');
  });

  it('builds a valid Today package with opening forecast and advice', async () => {
    mockedLuna.mockResolvedValueOnce({
      content: JSON.stringify(validPayload()),
      inputTokens: 500,
      outputTokens: 240,
    });

    const forecast = await generateAiPersonalHoroscopePackage({
      profile,
      period: 'day',
      window,
    });

    expect(isAiPersonalHoroscopePackage(forecast)).toBe(true);
    expect((forecast.meta as any).contentMode).toBe(AI_PERSONAL_HOROSCOPE_CONTENT_MODE);
    expect(forecast.sections.map((section) => section.id)).toEqual([
      'semantic:forecast',
      'semantic:advice-1',
      'semantic:advice-2',
      'semantic:advice-3',
    ]);
    expect(readAiPersonalHoroscopeReading(forecast)).toEqual({
      opening: validPayload().opening,
      forecast: validPayload().forecast,
      advice: validPayload().advice,
    });
  });

  it('rejects empty coaching clichés and repairs the draft once', async () => {
    mockedLuna
      .mockResolvedValueOnce({
        content: JSON.stringify({
          ...validPayload(),
          opening: 'Михаил, выдохни и отпусти ситуацию.',
        }),
        inputTokens: 400,
        outputTokens: 180,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(validPayload()),
        inputTokens: 520,
        outputTokens: 230,
      });

    const forecast = await generateAiPersonalHoroscopePackage({
      profile,
      period: 'day',
      window,
    });

    expect(mockedLuna).toHaveBeenCalledTimes(2);
    expect(forecast.meta.generationAttempts).toBe(2);
    expect(mockedLuna.mock.calls[1][0].input).toContain('forbidden cliché');
  });

  it('defines the requested bold voice without allowing insults or mystical copy', () => {
    const prompt = getAiPersonalHoroscopeSystemPrompt('ru', 'day');
    expect(prompt).toContain('дерзкий приятель');
    expect(prompt).toContain('лёгким нахальством');
    expect(prompt).toContain('не ведись');
    expect(prompt).toContain('Не оскорбляй');
    expect(prompt).toContain('Никакой астрологии');
    expect(prompt).toContain('выдохни');
    expect(prompt).toContain('позволь себе');
  });
});
