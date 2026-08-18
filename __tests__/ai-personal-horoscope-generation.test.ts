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
    opening: 'Михаил, хорошие новости: сегодня мир не требует от тебя подвига.',
    forecast: 'День подходит для спокойного удовольствия от привычных вещей. Поесть вкусно, куда-нибудь выбраться, увидеться с приятным человеком, купить мелочь, которая давно нравилась, — всё это сегодня заходит особенно хорошо.',
    advice: [
      'Никакой драмы. Просто хороший человеческий день.',
      'Потрать его хотя бы частично на себя, а не только на полезное.',
    ],
  };
}

describe('human voice few-shot personal horoscope prompt', () => {
  beforeEach(() => {
    mockedLuna.mockReset();
  });

  it('passes real-shaped INPUT -> OUTPUT demonstrations before private context', () => {
    const prompt = buildAiPersonalHoroscopePrompt({
      language: 'ru',
      period: 'day',
      window,
      profile,
      previousForecasts,
    });

    expect(prompt).toContain('FEW-SHOT ПРИМЕРЫ');
    expect(prompt).toContain('EXAMPLE 1');
    expect(prompt).toContain('INPUT');
    expect(prompt).toContain('OUTPUT');
    expect(prompt).not.toContain('cue:');
    expect((prompt.match(/EXAMPLE \d+/gu) || []).length).toBe(5);
    expect(prompt.indexOf('FEW-SHOT ПРИМЕРЫ')).toBeLessThan(prompt.indexOf('PRIVATE CONTEXT'));
    expect(prompt).toContain('"name": "Артём"');
    expect(prompt).toContain('Артём, сегодня тебе идёт быть заметным');
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

  it('uses five different Russian examples for each period', () => {
    const weekWindow = resolveAiPersonalHoroscopeWindow('week', '2026-W33', 'Europe/Moscow');
    const monthWindow = resolveAiPersonalHoroscopeWindow('month', '2026-08', 'Europe/Moscow');
    const weekPrompt = buildAiPersonalHoroscopePrompt({
      language: 'ru',
      period: 'week',
      window: weekWindow,
      profile,
      previousForecasts,
    });
    const monthPrompt = buildAiPersonalHoroscopePrompt({
      language: 'ru',
      period: 'month',
      window: monthWindow,
      profile,
      previousForecasts,
    });

    expect((weekPrompt.match(/EXAMPLE \d+/gu) || []).length).toBe(5);
    expect((monthPrompt.match(/EXAMPLE \d+/gu) || []).length).toBe(5);
    expect(weekPrompt).toContain('Похоже, у тебя намечается неделя с хорошим вкусом');
    expect(weekPrompt).toContain('Неожиданный поворот: привычное вдруг начинает нравиться снова');
    expect(monthPrompt).toContain('фотографий в телефоне станет больше');
    expect(monthPrompt).toContain('Хорошая компания, вкусная еда и немного денег на глупости');
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

  it('defines the human voice, non-template opening and period-specific size', () => {
    const dayPrompt = getAiPersonalHoroscopeSystemPrompt('ru', 'day');
    const weekPrompt = getAiPersonalHoroscopeSystemPrompt('ru', 'week');
    const monthPrompt = getAiPersonalHoroscopeSystemPrompt('ru', 'month');

    expect(dayPrompt).toContain('один узнаваемый живой человек');
    expect(dayPrompt).toContain('Дерзость живёт в формулировке, а не в вечном негативе');
    expect(dayPrompt).toContain('Хороший период может быть просто хорошим');
    expect(dayPrompt).toContain('opening — это заход, а не краткий пересказ периода');
    expect(dayPrompt).toContain('Никогда не используй пренебрежительное «Ну привет»');
    expect(dayPrompt).toContain('Не своди текст по умолчанию к работе, делам, планам');
    expect(dayPrompt).toContain('Никакого психологического, терапевтического, мотивационного или псевдокоучингового тона');
    expect(dayPrompt).toContain('forecast — 2–3 коротких предложения');
    expect(dayPrompt).toContain('advice — ровно 2 финальные строки');
    expect(weekPrompt).toContain('forecast — 3–5 коротких предложений');
    expect(weekPrompt).toContain('advice — ровно 3 финальные строки');
    expect(monthPrompt).toContain('forecast — 4–6 коротких предложений');
    expect(monthPrompt).toContain('advice — ровно 3 финальные строки');
    expect(dayPrompt).not.toContain('ты психолог');
    expect(dayPrompt).not.toContain('FEW-SHOT ПРИМЕРЫ');

    const voiceSource = fs.readFileSync(
      path.join(ROOT, 'lib/aiPersonalHoroscopeVoice.ts'),
      'utf8',
    );
    expect(voiceSource).not.toContain('RU_EMPTY_CLICHES');
    expect(voiceSource).not.toContain('ASTROLOGY_OR_ESOTERICISM');
    expect(voiceSource).not.toContain('TIME_SHIFT_PATTERNS');
    expect(voiceSource).not.toContain('MANAGER_WORD_PATTERN');
  });

  it('accepts either two or three closing lines without an editorial filter', () => {
    expect(readAiPersonalHoroscopePayload(validPayload())).toEqual(validPayload());
    const withThree = {
      ...validPayload(),
      advice: [...validPayload().advice, 'Иногда второй заход оказывается лучше первого.'],
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
    expect(mockedLuna.mock.calls[0][0].input).toContain('FEW-SHOT ПРИМЕРЫ');
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
