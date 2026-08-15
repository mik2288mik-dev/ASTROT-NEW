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
  buildAiPersonalHoroscopeEditorialBrief,
  buildAiPersonalHoroscopePrompt,
  generateAiPersonalHoroscopePackage,
  getAiPersonalHoroscopeSystemPrompt,
} from '../lib/aiPersonalHoroscopeGeneration';
import { validateAiPersonalHoroscopePayload } from '../lib/aiPersonalHoroscopeVoice';
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
    opening: 'Михаил, сегодня чужая уверенность будет звучать убедительнее фактов. Не спеши соглашаться.',
    forecast: 'С утра один разговор может начаться вполне спокойно, а потом незаметно превратиться в спор о формулировках. Тебя потянет ответить быстрее и жёстче, чем нужно, просто чтобы прекратить эту возню. Чуть позже станет ясно, что собеседник защищает не мысль, а своё право не менять позицию. После этого продолжать доказательства уже бессмысленно. К вечеру выиграет тот вариант, где ты коротко обозначишь своё решение и перестанешь ждать чужого одобрения.',
    advice: [
      'Спроси один раз, что человек действительно хочет сказать.',
      'Не объясняй свою позицию третий раз.',
      'Заканчивай разговор, когда ответы уже начали повторяться.',
    ],
    memory: {
      primary_domain: 'conversation',
      main_idea_key: 'не путать уверенный тон с правотой',
      situation_key: 'разговор уходит в спор о формулировках',
      turn_key: 'становится видно, что позицию защищают ради самой позиции',
      irony_key: 'спор ради права не менять мнение',
      advice_keys: [
        'уточнить реальный смысл',
        'не повторять позицию',
        'закончить повторяющийся разговор',
      ],
    },
  };
}

function rejectedPlannerPayload() {
  return {
    opening: 'Михаил, сегодня день точной настройки, а не показательного героизма.',
    forecast: 'С утра главная задача — выбрать одно важное дело и не распыляться. Потом люди принесут новые вводные и попросят видимый результат. В середине дня проверь цифры и назначь каждому обещанию конкретный срок. После этого наведи порядок в бытовых задачах. К вечеру закрой один старый пункт и не становись диспетчером чужого хаоса.',
    advice: [
      'До 10 августа пересмотри все текущие обещания.',
      'Дважды проверь сумму и получателя.',
      'Закрой один бытовой хвост.',
    ],
    memory: {
      primary_domain: 'conversation',
      main_idea_key: 'порядок в задачах',
      situation_key: 'люди приносят новые вводные',
      turn_key: 'закрытие старых пунктов',
      irony_key: 'диспетчер чужого хаоса',
      advice_keys: ['назначить сроки', 'проверить перевод', 'закрыть хвост'],
    },
  };
}

describe('AI-only personal horoscope generation', () => {
  beforeEach(() => {
    mockedLuna.mockReset();
  });

  it('sends Luna only profile, period, editorial brief, history and dialogue context', () => {
    const prompt = buildAiPersonalHoroscopePrompt({
      language: 'ru',
      period: 'day',
      window,
      profile,
      asOfDate: '2026-08-14',
      recentForecasts: [],
      conversationMemory: [{
        question: 'Как не сорваться на лишний спор?',
        answer: 'Не отвечай сразу, если разговор уже ходит по кругу.',
        answeredAt: '2026-08-13T10:00:00.000Z',
      }],
    });

    expect(prompt).toContain('personal_profile');
    expect(prompt).toContain('birthDate');
    expect(prompt).toContain('editorial_brief');
    expect(prompt).toContain('"primary_domain": "conversation"');
    expect(prompt).toContain('"as_of_date": "2026-08-14"');
    expect(prompt).toContain('recent_forecasts');
    expect(prompt).toContain('recent_dialogue');
    expect(prompt).not.toContain('chartData');
    expect(prompt).not.toContain('chartId');
    expect(prompt).not.toContain('aspects');
    expect(prompt).not.toContain('houses');
    expect(prompt).not.toContain('transits');
  });

  it('assigns Today, Week and Month different editorial domains on the same date', () => {
    const asOfDate = '2026-08-14';
    const day = buildAiPersonalHoroscopeEditorialBrief({
      language: 'ru',
      period: 'day',
      window,
      profile,
      asOfDate,
    });
    const week = buildAiPersonalHoroscopeEditorialBrief({
      language: 'ru',
      period: 'week',
      window: resolvePersonalForecastWindow('week', '2026-W33', 'Europe/Moscow'),
      profile,
      asOfDate,
    });
    const month = buildAiPersonalHoroscopeEditorialBrief({
      language: 'ru',
      period: 'month',
      window: resolvePersonalForecastWindow('month', '2026-08', 'Europe/Moscow'),
      profile,
      asOfDate,
    });

    expect(new Set([
      day.primaryDomain,
      week.primaryDomain,
      month.primaryDomain,
    ]).size).toBe(3);
  });

  it('builds a valid Today package with a short opening, one forecast arc and three advices', async () => {
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
    expect(forecast.overview.semanticFingerprint).toContain('"domain":"conversation"');
  });

  it('rejects the planner-like text shown in the screenshots and repairs it once', async () => {
    mockedLuna
      .mockResolvedValueOnce({
        content: JSON.stringify(rejectedPlannerPayload()),
        inputTokens: 450,
        outputTokens: 210,
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
    expect(mockedLuna.mock.calls[1][0].input).toContain('generic planner phrase');
  });

  it('rejects explicit calendar deadlines inside a current horoscope', () => {
    const candidate = validPayload();
    candidate.advice[0] = 'До 10 августа реши, отвечать этому человеку или нет.';
    const result = validateAiPersonalHoroscopePayload(candidate, {
      language: 'ru',
      period: 'day',
      window,
      profile,
      asOfDate: '2026-08-14',
      requiredPrimaryDomain: 'conversation',
    });

    expect(result.value).toBeNull();
    expect(result.errors).toContain('explicit calendar date inside horoscope');
  });

  it('defines the requested voice and explicitly rejects coaching and manager filler', () => {
    const prompt = getAiPersonalHoroscopeSystemPrompt('ru', 'day');
    expect(prompt).toContain('дерзкий приятель');
    expect(prompt).toContain('лёгким нахальством');
    expect(prompt).toContain('Это гороскоп, а не коучинг');
    expect(prompt).toContain('Главная задача — выбрать одно важное дело');
    expect(prompt).toContain('Не оскорбляй');
    expect(prompt).toContain('Никакой астрологии');
    expect(prompt).toContain('дважды проверь сумму и получателя');
  });
});
