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
    opening: 'Михаил, сегодня всё будет пытаться выглядеть срочным. Не покупайся.',
    forecast: 'Один вопрос действительно потребует внимания, остальные просто будут шуметь рядом. Люди могут торопить, но их скорость не обязана становиться твоей. Самая глупая ошибка сегодня — начать переделывать то, что уже нормально работает. Оставь рабочее рабочим и закончи одну вещь до конца. День станет проще, как только перестанешь добавлять ему лишние этажи.',
    advice: [
      'Выбери одно дело и доведи его до конца.',
      'Не объясняй очевидное третий раз.',
      'Новое начинай только после закрытого старого.',
    ],
  };
}

describe('simple AI personal horoscope generation', () => {
  beforeEach(() => {
    mockedLuna.mockReset();
  });

  it('uses only profile, period, current date and compact anti-repeat memory', () => {
    const prompt = buildAiPersonalHoroscopePrompt({
      language: 'ru',
      period: 'day',
      window,
      profile,
      recentMemory: [{
        period: 'week',
        periodKey: '2026-W33',
        themeKeywords: ['разговор', 'границы'],
        adviceKeywords: ['ответ', 'пауза'],
      }],
    });

    expect(prompt).toContain('"name": "Михаил"');
    expect(prompt).toContain('"birthDate": "1989-03-06"');
    expect(prompt).toContain('"birthTime": "23:15"');
    expect(prompt).toContain('"birthPlace": "Сергиев Посад"');
    expect(prompt).toContain('"currentDate":');
    expect(prompt).toContain('"themeKeywords"');
    expect(prompt).toContain('"adviceKeywords"');
    expect(prompt).not.toContain('editorial_brief');
    expect(prompt).not.toContain('openingMode');
    expect(prompt).not.toContain('arcMode');
    expect(prompt).not.toContain('previous_attempt');
    expect(prompt).not.toContain('conversationMemory');
    expect(prompt).not.toContain('chartData');
    expect(prompt).not.toContain('transits');
  });

  it('requires exactly the three visible JSON fields and no hidden memory', () => {
    expect(AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA.required).toEqual([
      'opening',
      'forecast',
      'advice',
    ]);
    expect(AI_PERSONAL_HOROSCOPE_RESPONSE_SCHEMA.properties).not.toHaveProperty('memory');
  });

  it('builds a direct package without PersonalForecastPackage sections or evidence', async () => {
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
    expect(horoscope).not.toHaveProperty('overview');
    expect(horoscope).not.toHaveProperty('sections');
    expect(horoscope).not.toHaveProperty('evidence');
    expect(horoscope.continuity.themeKeywords.length).toBeGreaterThan(0);
    expect(mockedLuna.mock.calls[0][0].schema).not.toHaveProperty('properties.memory');
  });

  it('retries with short error codes and never sends the rejected draft back', async () => {
    const bad = {
      ...validPayload(),
      opening: 'Михаил, выдохни и отпусти ситуацию.',
    };
    mockedLuna
      .mockResolvedValueOnce({
        content: JSON.stringify(bad),
        inputTokens: 400,
        outputTokens: 200,
      })
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
    const secondPrompt = mockedLuna.mock.calls[1][0].input as string;
    expect(secondPrompt).toContain('empty_cliche');
    expect(secondPrompt).not.toContain('выдохни и отпусти ситуацию');
  });

  it('keeps only basic bans and does not reject by word count or forced transitions', () => {
    const compact = {
      opening: 'Михаил, без цирка.',
      forecast: 'Сегодня один разговор окажется проще, чем его пытаются подать. Скажи главное и не растягивай.',
      advice: ['Ответь коротко.', 'Не спорь по кругу.', 'Закончи разговор вовремя.'],
    };
    expect(validateAiPersonalHoroscopePayload(compact, { language: 'ru' }).value).not.toBeNull();

    const voiceSource = fs.readFileSync(
      path.join(ROOT, 'lib/aiPersonalHoroscopeVoice.ts'),
      'utf8',
    );
    expect(voiceSource).not.toContain('buildAiPersonalHoroscopeEditorialBrief');
    expect(voiceSource).not.toContain('TIME_SHIFT_PATTERNS');
    expect(voiceSource).not.toContain('TOPIC_SIGNAL_GROUPS');
    expect(voiceSource).not.toContain('MANAGER_WORD_PATTERN');
    expect(voiceSource).not.toContain('minWords');
    expect(voiceSource).not.toContain('minSentences');
  });

  it('keeps the requested direct voice and basic safety bans', () => {
    const prompt = getAiPersonalHoroscopeSystemPrompt('ru', 'day');
    expect(prompt).toContain('Никто не назначает тебе тему');
    expect(prompt).toContain('говорит правду в лицо');
    expect(prompt).toContain('Михаил, день нормальный');
    expect(prompt).toContain('Не натягивай шаблоны');

    const astrology = validateAiPersonalHoroscopePayload({
      ...validPayload(),
      forecast: 'Меркурий сегодня всё решит за тебя.',
    }, { language: 'ru' });
    expect(astrology.errors).toContain('visible_astrology');

    const insult = validateAiPersonalHoroscopePayload({
      ...validPayload(),
      opening: 'Михаил, не будь идиотом.',
    }, { language: 'ru' });
    expect(insult.errors).toContain('insult');
  });
});
