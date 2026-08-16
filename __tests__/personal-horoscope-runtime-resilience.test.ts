jest.mock('../lib/openaiResponses', () => ({
  createLunaStructuredResponse: jest.fn(),
}));

import fs from 'fs';
import path from 'path';
import { createLunaStructuredResponse } from '../lib/openaiResponses';
import { generateAiPersonalHoroscopePackage } from '../lib/aiPersonalHoroscopeGeneration';
import { resolveAiPersonalHoroscopeWindow } from '../lib/aiPersonalHoroscope';

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

const window = resolveAiPersonalHoroscopeWindow('day', '2026-08-15', 'Europe/Moscow');

function payload() {
  return {
    opening: 'Привет. Сегодня день проверит, умеешь ли ты пользоваться удачей без лишнего спектакля.',
    forecast: 'Один разговор даст больше, чем ты от него ждёшь. Дела пойдут нормально, если не усложнять простое. В личной теме появится живой интерес. День получится удачным, но сам за тебя ничего не сделает.',
    advice: [
      'Ответь тому, с кем действительно хочется продолжить разговор.',
      'Используй удачный момент сразу.',
    ],
  };
}

describe('personal horoscope runtime resilience', () => {
  beforeEach(() => {
    mockedLuna.mockReset();
  });

  it('retries an incomplete provider response without adding an editorial fallback layer', async () => {
    mockedLuna
      .mockRejectedValueOnce(new Error('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens'))
      .mockResolvedValueOnce({
        content: JSON.stringify(payload()),
        inputTokens: 520,
        outputTokens: 250,
      });

    const horoscope = await generateAiPersonalHoroscopePackage({
      profile,
      period: 'day',
      window,
    });

    expect(mockedLuna).toHaveBeenCalledTimes(2);
    expect(mockedLuna.mock.calls[0][0].maxOutputTokens).toBe(2_000);
    expect(horoscope.meta.generationAttempts).toBe(2);
    expect(horoscope).not.toHaveProperty('continuity');
  });

  it('accepts the first complete answer exactly as Luna returned it', async () => {
    mockedLuna.mockResolvedValueOnce({
      content: JSON.stringify(payload()),
      inputTokens: 480,
      outputTokens: 220,
    });

    const horoscope = await generateAiPersonalHoroscopePackage({
      profile,
      period: 'day',
      window,
    });

    expect(mockedLuna).toHaveBeenCalledTimes(1);
    expect(horoscope.reading).toEqual(payload());
    expect(horoscope.meta.generationAttempts).toBe(1);
  });

  it('starts the remaining periods invisibly after the foreground forecast is ready', () => {
    const serviceSource = fs.readFileSync(
      path.join(ROOT, 'services/personalForecastService.ts'),
      'utf8',
    );
    expect(serviceSource).toContain('scheduleStartupPrewarm');
    expect(serviceSource).toContain("? ['day', 'week', 'month']");
    expect(serviceSource).toContain('background: true');
    expect(serviceSource).toContain('if (!input.options?.background) scheduleStartupPrewarm(input.profile);');
  });
});
