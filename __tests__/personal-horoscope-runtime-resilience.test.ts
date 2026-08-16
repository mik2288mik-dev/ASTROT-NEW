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
    opening: 'Михаил, день сегодня щедрый на хорошие повороты. Не пропусти их из скромности.',
    forecast: 'Общение будет складываться легко, и один разговор способен дать приятный результат без долгой подготовки. Хорошо пойдут дела, где нужен вкус, смелость и быстрая реакция. В личной теме станет теплее: искренность сегодня работает лучше сложных намёков. День поддерживает новые идеи и нормальные маленькие радости. Используй удачный момент, но не превращай его в очередной проект века.',
    advice: [
      'Скажи прямо, чего тебе хочется от этого дня.',
      'Поддержи разговор, который приносит удовольствие.',
      'Потрать часть времени на то, что давно радует.',
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
    expect(horoscope).not.toHaveProperty('continuity');
  });

  it('accepts the first complete positive forecast exactly as Luna returned it', async () => {
    mockedLuna.mockResolvedValueOnce({
      content: JSON.stringify(payload()),
      inputTokens: 480,
      outputTokens: 360,
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

  it('loads only the selected period and never prewarms Week or Month in the background', () => {
    const dashboardSource = fs.readFileSync(
      path.join(ROOT, 'views/Dashboard.tsx'),
      'utf8',
    );
    expect(dashboardSource).toContain('loadPeriod(activePeriod);');
    expect(dashboardSource).not.toContain('prewarmUserContent');
    expect(dashboardSource).not.toContain('contentPrewarmService');
    expect(dashboardSource).not.toContain("mode: 'generate-missing'");
  });
});
