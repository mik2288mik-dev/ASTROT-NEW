jest.mock('../lib/openaiResponses', () => ({
  createLunaStructuredResponse: jest.fn(),
}));

import { createLunaStructuredResponse } from '../lib/openaiResponses';
import {
  AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA,
  buildAiPersonalHoroscopePrompt,
  getAiPersonalHoroscopeSystemPrompt,
  readAiPersonalHoroscopePayload,
} from '../lib/aiPersonalHoroscopeVoice';
import { generateAiPersonalHoroscopePackage } from '../lib/aiPersonalHoroscopeGeneration';
import {
  resolveAiPersonalHoroscopeWindow,
  type AiPersonalHoroscopeHistoryItem,
} from '../lib/aiPersonalHoroscope';

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
const window = resolveAiPersonalHoroscopeWindow('day', '2026-08-14', 'Europe/Moscow');

const previousForecasts: AiPersonalHoroscopeHistoryItem[] = Array.from(
  { length: 15 },
  (_, index) => ({
    period: 'day' as const,
    periodKey: `2026-07-${String(index + 1).padStart(2, '0')}`,
    currentDate: `2026-07-${String(index + 1).padStart(2, '0')}`,
    opening: `Старый заход ${index + 1}`,
    forecast: `Старый полный прогноз ${index + 1}, который не должен попадать в новый prompt.`,
    advice: [`Старое завершение ${index + 1}`],
  }),
);

function validPayload() {
  return {
    opening: 'Михаил, без подвигов. Просто хороший день.',
    forecast: 'Многое идёт спокойнее обычного, и именно это приятно. Хорошо заходят вкусная еда, короткая поездка, любимое место или встреча с человеком, рядом с которым не надо изображать занятость века.',
    advice: [
      'Никакой драмы — и отлично.',
      'Возьми от дня что-нибудь приятное для себя.',
    ],
  };
}

describe('personal horoscope prompt architecture', () => {
  beforeEach(() => {
    mockedLuna.mockReset();
  });

  it('uses real-shaped INPUT -> OUTPUT demonstrations before the current input', () => {
    const prompt = buildAiPersonalHoroscopePrompt({
      language: 'ru',
      period: 'day',
      window,
      profile,
      previousForecasts,
    });

    expect(prompt).toContain('ЭТАЛОННЫЕ ПРИМЕРЫ');
    expect((prompt.match(/EXAMPLE \d+/gu) || []).length).toBe(5);
    expect(prompt).toContain('INPUT');
    expect(prompt).toContain('OUTPUT');
    expect(prompt).toContain('CURRENT INPUT');
    expect(prompt.indexOf('EXAMPLE 1')).toBeLessThan(prompt.indexOf('CURRENT INPUT'));
    expect(prompt).toContain('Скромность сегодня можно оставить дома.');
    expect(prompt).toContain('"recentOpenings"');
    expect(prompt).toContain('Старый заход 1');
    expect(prompt).toContain('"recentClosings"');
    expect(prompt).not.toContain('Старый полный прогноз 1');
  });

  it('keeps the system instructions positive, explicit and period-specific', () => {
    const day = getAiPersonalHoroscopeSystemPrompt('ru', 'day');
    const week = getAiPersonalHoroscopeSystemPrompt('ru', 'week');
    const month = getAiPersonalHoroscopeSystemPrompt('ru', 'month');

    expect(day).toContain('IDENTITY');
    expect(day).toContain('TASK');
    expect(day).toContain('VOICE TARGET');
    expect(day).toContain('CONTENT TARGET');
    expect(day).toContain('OUTPUT CONTRACT');
    expect(day).toContain('3–10 слов');
    expect(day).toContain('20–55 слов');
    expect(week).toContain('45–90 слов');
    expect(month).toContain('75–130 слов');
    expect(day).toContain('именно прогноз');
    expect(day).toContain('Живой человек. Прямо, точно, уверенно.');
    expect(day).toContain('Эталонные INPUT → OUTPUT примеры');
  });

  it('keeps strict JSON transport with opening, forecast and closing lines', () => {
    const adviceSchema = AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA.properties.advice as {
      minItems?: number;
      maxItems?: number;
    };
    expect(AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA.required).toEqual([
      'opening',
      'forecast',
      'advice',
    ]);
    expect(adviceSchema.minItems).toBe(2);
    expect(adviceSchema.maxItems).toBe(3);
    expect(AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA.additionalProperties).toBe(false);
  });

  it('accepts an approved-style day and rejects verbose/coaching leakage', () => {
    expect(readAiPersonalHoroscopePayload(validPayload(), 'day', 'ru')).toEqual(validPayload());

    expect(readAiPersonalHoroscopePayload({
      ...validPayload(),
      opening: 'Сегодня наступает удивительно важный и очень насыщенный период твоей прекрасной жизни.',
    }, 'day', 'ru')).toBeNull();

    expect(readAiPersonalHoroscopePayload({
      ...validPayload(),
      forecast: 'День располагает к спокойствию, поэтому полезно выбрать одно занятие и прислушаться к себе. Это поможет найти внутреннюю опору и ресурс.',
    }, 'day', 'ru')).toBeNull();
  });

  it('sends low-verbosity structured output and returns the first style-valid answer', async () => {
    mockedLuna.mockResolvedValueOnce({
      content: JSON.stringify(validPayload()),
      inputTokens: 500,
      outputTokens: 180,
    });

    const horoscope = await generateAiPersonalHoroscopePackage({
      profile,
      period: 'day',
      window,
      previousForecasts,
    });

    expect(horoscope.reading).toEqual(validPayload());
    expect(horoscope.meta.generationAttempts).toBe(1);
    expect(mockedLuna).toHaveBeenCalledTimes(1);
    expect(mockedLuna.mock.calls[0][0].verbosity).toBe('low');
    expect(mockedLuna.mock.calls[0][0].input).toContain('ЭТАЛОННЫЕ ПРИМЕРЫ');
  });

  it('retries when the first structured answer misses the style contract', async () => {
    mockedLuna
      .mockResolvedValueOnce({
        content: JSON.stringify({
          ...validPayload(),
          opening: 'Сегодня начинается очень интересный и достаточно необычный период, который многое способен изменить.',
        }),
        inputTokens: 430,
        outputTokens: 190,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(validPayload()),
        inputTokens: 420,
        outputTokens: 175,
      });

    const horoscope = await generateAiPersonalHoroscopePackage({
      profile,
      period: 'day',
      window,
      previousForecasts,
    });

    expect(horoscope.meta.generationAttempts).toBe(2);
    expect(mockedLuna).toHaveBeenCalledTimes(2);
  });
});
