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
  validateAiPersonalHoroscopePayload,
} from '../lib/aiPersonalHoroscopeVoice';
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
const window = resolveAiPersonalHoroscopeWindow('day', '2026-08-14', 'Europe/Moscow');

function validPayload() {
  return {
    opening: 'Михаил, сегодня день явно на твоей стороне. Пользуйся, пока он не передумал.',
    forecast: 'Общение будет складываться легче обычного, и один разговор способен приятно сдвинуть дело с места. Хорошо пойдут занятия, где нужен вкус, реакция и немного смелости. В личной теме станет проще говорить прямо и получать нормальный ответ. День даст заметный результат там, где ты уже начал действовать. Оставь место для спонтанной идеи: сегодня она может оказаться полезнее длинного плана.',
    advice: [
      'Напиши человеку, с которым давно хотел поговорить.',
      'Используй первую удачную идею без долгой раскачки.',
      'Оставь вечер свободным для приятного продолжения дня.',
    ],
  };
}

describe('balanced direct AI personal horoscope generation', () => {
  beforeEach(() => {
    mockedLuna.mockReset();
  });

  it('uses only the birth profile and selected date window, with no prior-text anchors', () => {
    const prompt = buildAiPersonalHoroscopePrompt({
      language: 'ru',
      period: 'day',
      window,
      profile,
    });

    expect(prompt).toContain('"name": "Михаил"');
    expect(prompt).toContain('"birthDate": "1989-03-06"');
    expect(prompt).toContain('"birthTime": "23:15"');
    expect(prompt).toContain('"birthPlace": "Сергиев Посад"');
    expect(prompt).toContain('"currentDate":');
    expect(prompt).not.toContain('recentMemory');
    expect(prompt).not.toContain('themeKeywords');
    expect(prompt).not.toContain('adviceKeywords');
    expect(prompt).not.toContain('editorial_brief');
    expect(prompt).not.toContain('openingMode');
    expect(prompt).not.toContain('arcMode');
    expect(prompt).not.toContain('previous_attempt');
    expect(prompt).not.toContain('conversationMemory');
    expect(prompt).not.toContain('chartData');
    expect(prompt).not.toContain('transits');
  });

  it('requires exactly the three visible JSON fields', () => {
    expect(AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA.required).toEqual([
      'opening',
      'forecast',
      'advice',
    ]);
    expect(AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA.properties).not.toHaveProperty('memory');
    expect(AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA.additionalProperties).toBe(false);
  });

  it('builds a direct package without keyword memory or legacy forecast transport', async () => {
    mockedLuna.mockResolvedValueOnce({
      content: JSON.stringify(validPayload()),
      inputTokens: 500,
      outputTokens: 260,
    });

    const horoscope = await generateAiPersonalHoroscopePackage({
      profile,
      period: 'day',
      window,
    });

    expect(horoscope.reading).toEqual(validPayload());
    expect(horoscope.currentDate).toBe('2026-08-14');
    expect(horoscope).not.toHaveProperty('continuity');
    expect(horoscope).not.toHaveProperty('overview');
    expect(horoscope).not.toHaveProperty('sections');
    expect(horoscope).not.toHaveProperty('evidence');
    expect(mockedLuna).toHaveBeenCalledTimes(1);
  });

  it('does not discard a complete first draft for tone, topic, wording or length', async () => {
    const completeButVeryShort = {
      opening: 'Михаил, день сегодня добрый.',
      forecast: 'Люди идут навстречу. Пользуйся этим.',
      advice: ['Позвони первым.', 'Прими приглашение.', 'Сделай себе приятное.'],
    };
    mockedLuna.mockResolvedValueOnce({
      content: JSON.stringify(completeButVeryShort),
      inputTokens: 300,
      outputTokens: 90,
    });

    const horoscope = await generateAiPersonalHoroscopePackage({
      profile,
      period: 'day',
      window,
    });

    expect(horoscope.reading).toEqual(completeButVeryShort);
    expect(horoscope.meta.generationAttempts).toBe(1);
    expect(mockedLuna).toHaveBeenCalledTimes(1);
    expect(validateAiPersonalHoroscopePayload(completeButVeryShort).value).not.toBeNull();
  });

  it('retries only a technical incomplete response, not an editorial rejection', async () => {
    mockedLuna
      .mockRejectedValueOnce(new Error('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens'))
      .mockResolvedValueOnce({
        content: JSON.stringify(validPayload()),
        inputTokens: 430,
        outputTokens: 220,
      });

    const horoscope = await generateAiPersonalHoroscopePackage({
      profile,
      period: 'day',
      window,
    });

    expect(horoscope.meta.generationAttempts).toBe(2);
    expect(mockedLuna).toHaveBeenCalledTimes(2);
    expect(mockedLuna.mock.calls[0][0].input).toBe(mockedLuna.mock.calls[1][0].input);
  });

  it('removes the old negative examples and explicitly allows positive, romantic and joyful periods', () => {
    const prompt = getAiPersonalHoroscopeSystemPrompt('ru', 'day');
    expect(prompt).toContain('Никакой код, список тем, прошлый прогноз');
    expect(prompt).toContain('Он может быть удачным, лёгким, романтичным, весёлым');
    expect(prompt).toContain('Если период хороший — скажи об этом прямо');
    expect(prompt).toContain('Шутка, укол, слоган и вопрос не обязательны');
    expect(prompt).toContain('Не делай все три совета отрицательными командами');
    expect(prompt).not.toContain('ПРИМЕРЫ РИТМА');
    expect(prompt).not.toContain('день нормальный');
    expect(prompt).not.toContain('всё будет делать вид, что оно срочное');
    expect(prompt).not.toContain('доказывать очевидное');

    const voiceSource = fs.readFileSync(
      path.join(ROOT, 'lib/aiPersonalHoroscopeVoice.ts'),
      'utf8',
    );
    expect(voiceSource).not.toContain('RU_EMPTY_CLICHES');
    expect(voiceSource).not.toContain('ASTROLOGY_OR_ESOTERICISM');
    expect(voiceSource).not.toContain('TIME_SHIFT_PATTERNS');
    expect(voiceSource).not.toContain('TOPIC_SIGNAL_GROUPS');
    expect(voiceSource).not.toContain('MANAGER_WORD_PATTERN');
    expect(voiceSource).not.toContain('minWords');
    expect(voiceSource).not.toContain('minSentences');
  });
});
