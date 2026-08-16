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
    opening: 'Привет. Сегодня день решил проверить, умеешь ли ты пользоваться удачей без лишнего спектакля.',
    forecast: 'Один разговор даст больше, чем ты от него ждёшь. Дела пойдут нормально, если не усложнять простое. В личной теме появится живой интерес. День получится удачным, но сам за тебя ничего не сделает.',
    advice: [
      'Ответь тому, с кем действительно хочется продолжить разговор.',
      'Используй удачный момент сразу.',
    ],
  };
}

describe('exact user personal horoscope prompt', () => {
  beforeEach(() => {
    mockedLuna.mockReset();
  });

  it('passes birth data, current period and the previous 15 full forecasts', () => {
    const prompt = buildAiPersonalHoroscopePrompt({
      language: 'ru',
      period: 'day',
      window,
      profile,
      previousForecasts,
    });

    expect(prompt).toContain('"name": "Михаил"');
    expect(prompt).toContain('"birthDate": "1989-03-06"');
    expect(prompt).toContain('"birthTime": "23:15"');
    expect(prompt).toContain('"birthPlace": "Сергиев Посад"');
    expect(prompt).toContain('"previousForecasts"');
    expect(prompt).toContain('"forecast": "Прогноз 15"');
    expect(prompt).not.toContain('editorial_brief');
    expect(prompt).not.toContain('themeKeywords');
    expect(prompt).not.toContain('repairHints');
    expect(prompt).not.toContain('chartData');
    expect(prompt).not.toContain('transits');
  });

  it('uses only opening, forecast and 2-3 advice in strict JSON', () => {
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

  it('uses the exact requested voice instructions without examples or hidden editorial rules', () => {
    const prompt = getAiPersonalHoroscopeSystemPrompt('ru', 'day');
    expect(prompt).toContain('Ты АСТРОЛОГ');
    expect(prompt).toContain('предыдущие 15 прогнозов');
    expect(prompt).toContain('Без «выдохни», «отпусти», «позволь себе», «не торопись», «не распыляйся»');
    expect(prompt).toContain('opening — 1–2 предложения');
    expect(prompt).toContain('forecast — 3–6 предложений');
    expect(prompt).toContain('advice — 2–3');
    expect(prompt).toContain('родителей');
    expect(prompt).not.toContain('ПРИМЕРЫ РИТМА');
    expect(prompt).not.toContain('главная линия');
    expect(prompt).not.toContain('реальный контраст');

    const voiceSource = fs.readFileSync(
      path.join(ROOT, 'lib/aiPersonalHoroscopeVoice.ts'),
      'utf8',
    );
    expect(voiceSource).not.toContain('RU_EMPTY_CLICHES');
    expect(voiceSource).not.toContain('ASTROLOGY_OR_ESOTERICISM');
    expect(voiceSource).not.toContain('TIME_SHIFT_PATTERNS');
    expect(voiceSource).not.toContain('MANAGER_WORD_PATTERN');
  });

  it('accepts either two or three advice items without an editorial filter', () => {
    expect(readAiPersonalHoroscopePayload(validPayload())).toEqual(validPayload());
    const withThree = {
      ...validPayload(),
      advice: [...validPayload().advice, 'Оставь время на приятное продолжение.'],
    };
    expect(readAiPersonalHoroscopePayload(withThree)).toEqual(withThree);
  });

  it('returns the first complete structured Luna answer unchanged', async () => {
    mockedLuna.mockResolvedValueOnce({
      content: JSON.stringify(validPayload()),
      inputTokens: 500,
      outputTokens: 220,
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
    expect(mockedLuna.mock.calls[0][0].input).toContain('"previousForecasts"');
  });

  it('retries only a technically incomplete provider response', async () => {
    mockedLuna
      .mockRejectedValueOnce(new Error('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens'))
      .mockResolvedValueOnce({
        content: JSON.stringify(validPayload()),
        inputTokens: 430,
        outputTokens: 200,
      });

    const horoscope = await generateAiPersonalHoroscopePackage({
      profile,
      period: 'day',
      window,
      previousForecasts,
    });

    expect(horoscope.meta.generationAttempts).toBe(2);
    expect(mockedLuna).toHaveBeenCalledTimes(2);
    expect(mockedLuna.mock.calls[0][0].input).toBe(mockedLuna.mock.calls[1][0].input);
  });
});
