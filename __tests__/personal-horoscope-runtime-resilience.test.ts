jest.mock('../lib/openaiResponses', () => ({
  createLunaStructuredResponse: jest.fn(),
}));

import fs from 'fs';
import path from 'path';
import { createLunaStructuredResponse } from '../lib/openaiResponses';
import { generatePersonalForecastPackage } from '../lib/personalForecastGeneration';
import { resolvePersonalForecastWindow } from '../lib/personalForecastContract';
import { chartFixture } from './personal-forecast-fixture';

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

const window = resolvePersonalForecastWindow('day', '2026-08-15', 'Europe/Moscow');

function words(count: number, prefix: string): string {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(' ');
}

function payload() {
  return {
    headline: {
      text: 'Точный личный прогноз дня',
      evidence_ids: ['profile:personal'],
    },
    fragments: Array.from({ length: 5 }, (_, index) => ({
      text: index === 0
        ? `${words(21, `фрагмент${index + 1}слово`)} разговор`
        : words(index === 4 ? 18 : 22, `фрагмент${index + 1}слово`),
      presentation_style: 'prose',
      main_idea_key: `мысль ${index + 1}`,
      life_plot_key: `сюжет ${index + 1}`,
      advice_key: index % 2 === 0 ? `совет ${index + 1}` : '',
      comparison_key: index === 3 ? 'сравнение четыре' : '',
      evidence_ids: ['profile:personal'],
    })),
    closing: {
      text: 'Сделай один точный шаг.',
      kind: 'action',
      advice_key: 'сделать один точный шаг',
      evidence_ids: ['profile:personal'],
    },
  };
}

function providerResponse() {
  return {
    content: JSON.stringify(payload()),
    inputTokens: 520,
    outputTokens: 250,
  };
}

describe('personal horoscope runtime resilience', () => {
  beforeEach(() => {
    mockedLuna.mockReset();
  });

  it('retries an incomplete provider response without adding an editorial fallback layer', async () => {
    mockedLuna
      .mockRejectedValueOnce(new Error('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens'))
      .mockResolvedValueOnce(providerResponse());

    const forecast = await generatePersonalForecastPackage({
      profile: profile as never,
      chartData: chartFixture,
      model: 'gpt-5.6-luna',
      period: 'day',
      window,
    });

    expect(mockedLuna).toHaveBeenCalledTimes(2);
    expect(mockedLuna.mock.calls[0][0].maxOutputTokens).toBe(1_200);
    expect(mockedLuna.mock.calls[1][0].maxOutputTokens).toBe(1_800);
    expect(mockedLuna.mock.calls[1][0].store).toBe(false);
    expect(forecast.meta.generationAttempts).toBe(2);
    expect(forecast).not.toHaveProperty('continuity');
  });

  it('materializes the first complete PersonalForecastPackage without retrying', async () => {
    const completePayload = payload();
    mockedLuna.mockResolvedValueOnce({
      ...providerResponse(),
      content: JSON.stringify(completePayload),
    });

    const forecast = await generatePersonalForecastPackage({
      profile: profile as never,
      chartData: chartFixture,
      model: 'gpt-5.6-luna',
      period: 'day',
      window,
    });

    expect(mockedLuna).toHaveBeenCalledTimes(1);
    expect(forecast.overview.title).toBe(completePayload.headline.text);
    expect(forecast.overview.text).toBe(completePayload.fragments[0].text);
    expect(forecast.sections).toHaveLength(4);
    expect(forecast.sections.at(-1)?.text).toContain(completePayload.closing.text);
    expect(forecast.meta.generationAttempts).toBe(1);
  });

  it('starts the remaining periods invisibly after the foreground forecast is ready', () => {
    const serviceSource = fs.readFileSync(
      path.join(ROOT, 'services/personalForecastService.ts'),
      'utf8',
    );
    expect(serviceSource).toContain('scheduleStartupPrewarm');
    expect(serviceSource).toContain("? ['day', 'week', 'month']");
    expect(serviceSource).toContain('background: true');
    expect(serviceSource).toContain('if (!input.options?.background) {');
    expect(serviceSource).toContain('chartData: input.chartData');
    expect(serviceSource).toContain('chartId: input.chartId');
    expect(serviceSource).toContain('buildPersonalForecastProfileFingerprint(input.profile)');
  });
});
