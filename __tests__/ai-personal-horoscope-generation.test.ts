jest.mock('../lib/openaiResponses', () => ({
  createLunaStructuredResponse: jest.fn(),
}));

import fs from 'fs';
import path from 'path';
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
const window = resolveAiPersonalHoroscopeWindow('day', '2026-08-14', 'Europe/Moscow');

const previousForecasts: AiPersonalHoroscopeHistoryItem[] = Array.from(
  { length: 15 },
  (_, index) => ({
    period: 'day' as const,
    periodKey: `2026-07-${String(index + 1).padStart(2, '0')}`,
    currentDate: `2026-07-${String(index + 1).padStart(2, '0')}`,
    opening: `Вступление ${index + 1}`,
    forecast: `Прогноз ${index + 1}`,
    advice: [`Совет ${index + 1}.1`, `Совет ${index + 1}.2`],
  }),
);

function validPayload() {
  return {
    opening: 'Михаил, харизму не прячь.',
    forecast: 'Внимания вокруг тебя сегодня больше, и оно скорее приятное: люди охотнее поддерживают разговор, а симпатия считывается без долгих расшифровок. Хорошо заходят встречи, лёгкий флирт и всё, где можно быть собой без серьёзного лица.',
    advice: [
      'Тебя сегодня замечают.',
      'Улыбнуться в ответ — вполне рабочая стратегия.',
    ],
  };
}

describe('gold-example personal horoscope prompt', () => {
  beforeEach(() => {
    mockedLuna.mockReset();
  });

  it('puts production-shaped INPUT -> OUTPUT demonstrations before private input', () => {
    const prompt = buildAiPersonalHoroscopePrompt({
      language: 'ru',
      period: 'day',
      window,
      profile,
      previousForecasts,
    });

    expect(prompt).toContain('ЭТАЛОННЫЕ ПРИМЕРЫ');
    expect(prompt).toContain('EXAMPLE 1');
    expect(prompt).toContain('INPUT');
    expect(prompt).toContain('OUTPUT');
    expect((prompt.match(/EXAMPLE \d+/gu) || []).length).toBe(4);
    expect(prompt.indexOf('ЭТАЛОННЫЕ ПРИМЕРЫ')).toBeLessThan(prompt.indexOf('PRIVATE INPUT'));
    expect(prompt).toContain('"name": "Михаил"');
    expect(prompt).toContain('"birthDate": "1989-03-06"');
    expect(prompt).toContain('"birthTime": "23:15"');
    expect(prompt).toContain('"birthPlace": "Сергиев Посад"');
    expect(prompt).toContain('"previousForecasts"');
    expect(prompt).toContain('"forecast": "Прогноз 8"');
    expect(prompt).not.toContain('"forecast": "Прогноз 9"');
    expect(prompt).not.toContain('editorial_brief');
    expect(prompt).not.toContain('themeKeywords');
    expect(prompt).not.toContain('repairHints');
    expect(prompt).not.toContain('chartData');
    expect(prompt).not.toContain('transits');
  });

  it('keeps a 21-example Russian gold corpus while sending only four examples per request', () => {
    const source = fs.readFileSync(
      path.join(ROOT, 'lib/aiPersonalHoroscopeFewShot.ts'),
      'utf8',
    );
    expect((source.match(/language: 'ru', period: '(?:day|week|month)'/gu) || []).length).toBe(21);

    const weekWindow = resolveAiPersonalHoroscopeWindow('week', '2026-W33', 'Europe/Moscow');
    const monthWindow = resolveAiPersonalHoroscopeWindow('month', '2026-08', 'Europe/Moscow');
    const weekPrompt = buildAiPersonalHoroscopePrompt({
      language: 'ru', period: 'week', window: weekWindow, profile, previousForecasts,
    });
    const monthPrompt = buildAiPersonalHoroscopePrompt({
      language: 'ru', period: 'month', window: monthWindow, profile, previousForecasts,
    });

    expect((weekPrompt.match(/EXAMPLE \d+/gu) || []).length).toBe(4);
    expect((monthPrompt.match(/EXAMPLE \d+/gu) || []).length).toBe(4);
  });

  it('keeps only opening, forecast and 2-3 closing lines in strict JSON', () => {
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

  it('defines the direct human voice and exact period-specific size', () => {
    const dayPrompt = getAiPersonalHoroscopeSystemPrompt('ru', 'day');
    const weekPrompt = getAiPersonalHoroscopeSystemPrompt('ru', 'week');
    const monthPrompt = getAiPersonalHoroscopeSystemPrompt('ru', 'month');

    expect(dayPrompt).toContain('настоящего личного гороскопа-прогноза');
    expect(dayPrompt).toContain('простыми разговорными словами, прямо, точно, уверенно и с характером');
    expect(dayPrompt).toContain('opening — отдельная короткая ударная реплика');
    expect(dayPrompt).toContain('нет астрологических терминов и объяснений, психологии, терапии, self-help, коучинга, псевдокоучинга');
    expect(dayPrompt).toContain('forecast: ровно 2 предложения');
    expect(dayPrompt).toContain('advice: ровно 2 короткие финальные реплики');
    expect(weekPrompt).toContain('forecast: ровно 3 предложения');
    expect(weekPrompt).toContain('advice: ровно 3 короткие финальные реплики');
    expect(monthPrompt).toContain('forecast: ровно 4 предложения');
    expect(monthPrompt).toContain('advice: ровно 3 короткие финальные реплики');
    expect(dayPrompt).not.toContain('FEW-SHOT ПРИМЕРЫ');
  });

  it('accepts the target Today shape and rejects a long two-sentence opening', () => {
    expect(readAiPersonalHoroscopePayload(validPayload(), 'day')).toEqual(validPayload());
    expect(readAiPersonalHoroscopePayload({
      ...validPayload(),
      opening: 'Сегодня всё будет складываться очень хорошо. Это точно стоит использовать.',
    }, 'day')).toBeNull();
  });

  it('returns a concise complete Luna answer unchanged', async () => {
    mockedLuna.mockResolvedValueOnce({
      content: JSON.stringify(validPayload()),
      inputTokens: 500,
      outputTokens: 120,
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
    expect(mockedLuna.mock.calls[0][0].input).toContain('ЭТАЛОННЫЕ ПРИМЕРЫ');
    expect(mockedLuna.mock.calls[0][0].input).toContain('"previousForecasts"');
    expect(mockedLuna.mock.calls[0][0].maxOutputTokens).toBe(1_200);
  });

  it('retries a structurally verbose draft and accepts the corrected one', async () => {
    mockedLuna
      .mockResolvedValueOnce({
        content: JSON.stringify({
          ...validPayload(),
          opening: 'Сегодня всё будет складываться очень хорошо. Это точно стоит использовать.',
        }),
        inputTokens: 430,
        outputTokens: 170,
      })
      .mockResolvedValueOnce({
        content: JSON.stringify(validPayload()),
        inputTokens: 430,
        outputTokens: 120,
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
