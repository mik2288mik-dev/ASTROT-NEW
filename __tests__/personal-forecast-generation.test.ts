import {
  PERSONAL_FORECAST_RESPONSE_SCHEMA,
  buildPersonalForecastFeedPrompt,
  callAstrologerBriefWithValidationRetry,
  getPersonalForecastSystemPrompt,
  getPersonalForecastWriterMaxOutputTokens,
  validateAstrologerBrief,
  validateFreeGeneratedForecastFeed,
} from '../lib/personalForecastGeneration';
import { resolvePersonalForecastWindow, type PersonalForecastAstrologerBrief } from '../lib/personalForecastContract';
import { PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU } from '../lib/personalForecastExamples';
import { getAppSystemVoice } from '../lib/appVoice';
import crypto from 'crypto';

const validBrief: PersonalForecastAstrologerBrief = {
  tone: 'favorable',
  coreForecast: 'Творческая задумка получает заметный отклик и естественное продолжение',
  secondaryForecast: 'Повседневный маршрут становится удобнее благодаря удачному изменению',
  distinctiveDetail: 'Первоначальная проба оказывается убедительнее тщательно подготовленного варианта',
  opportunity: 'Появляется возможность показать результат более широкому кругу людей',
  friction: null,
  likelyResult: 'Замысел закрепляется как перспективное направление для дальнейшего развития',
  briefSignature: 'server-signature',
};

describe('personal forecast brief and writer contract', () => {
  it('keeps exactly the three approved visible writer fields', () => {
    expect(PERSONAL_FORECAST_RESPONSE_SCHEMA).toEqual(expect.objectContaining({
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'forecast', 'closing'],
    }));
    expect(Object.keys(PERSONAL_FORECAST_RESPONSE_SCHEMA.properties)).toEqual([
      'headline', 'forecast', 'closing',
    ]);
  });

  it('uses period-specific writer budgets and doubles only for provider retry', () => {
    expect(getPersonalForecastWriterMaxOutputTokens('day')).toBe(1200);
    expect(getPersonalForecastWriterMaxOutputTokens('week')).toBe(1600);
    expect(getPersonalForecastWriterMaxOutputTokens('month')).toBe(2000);
    expect(getPersonalForecastWriterMaxOutputTokens('day', true)).toBe(2400);
    expect(getPersonalForecastWriterMaxOutputTokens('week', true)).toBe(3200);
    expect(getPersonalForecastWriterMaxOutputTokens('month', true)).toBe(4000);
  });

  it('writer input contains only reader, period, brief, and anti-repeat data', () => {
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'ru',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-22', 'Europe/Moscow'),
      reader: { name: 'Тест' },
      astrologerBrief: validBrief,
    });
    const json = JSON.parse(prompt.slice(prompt.indexOf('{')));
    expect(json).toEqual({
      selected_period: expect.any(Object),
      reader: { name: 'Тест', language: 'ru' },
      astrologer_brief: {
        tone: validBrief.tone,
        core_forecast: validBrief.coreForecast,
        secondary_forecast: validBrief.secondaryForecast,
        distinctive_detail: validBrief.distinctiveDetail,
        opportunity: validBrief.opportunity,
        friction: validBrief.friction,
        likely_result: validBrief.likelyResult,
      },
      anti_repeat_context: { recent_forecasts: [] },
    });
    for (const key of ['birth_date', 'birth_time', 'birth_place', 'birth_timezone', 'gender', 'personal_profile', 'brief_signature']) {
      expect(prompt).not.toContain(key);
    }
  });

  it('validates brief length, distinctness, commands, astrology, management language, and generic filler', () => {
    expect(validateAstrologerBrief(validBrief)).toEqual([]);
    expect(validateAstrologerBrief({
      ...validBrief,
      coreForecast: 'Выбери одну главную задачу сегодня',
      secondaryForecast: 'Выбери одну главную задачу сегодня',
      distinctiveDetail: 'Планета усиливает контроль и личные границы',
      likelyResult: 'Сегодня всё сложится наилучшим образом',
    })).toEqual(expect.arrayContaining([
      'BRIEF_IMPERATIVE',
      'BRIEF_REPEATED_FIELD',
      'BRIEF_CORE_SECONDARY_OVERLAP',
      'BRIEF_ASTROLOGY',
      'BRIEF_MANAGERIAL_LANGUAGE',
      'BRIEF_UNIVERSAL_PHRASE',
    ]));
  });

  it('retries editorial brief validation once with codes only and never passes the rejected draft', async () => {
    const request = jest.fn()
      .mockRejectedValueOnce(new Error('BRIEF_VALIDATION_FAILED:BRIEF_IMPERATIVE|BRIEF_REPEATED_FIELD'))
      .mockResolvedValueOnce(validBrief);
    await expect(callAstrologerBriefWithValidationRetry(request)).resolves.toBe(validBrief);
    expect(request.mock.calls).toEqual([
      [],
      [['BRIEF_IMPERATIVE', 'BRIEF_REPEATED_FIELD']],
    ]);

    const failed = jest.fn().mockRejectedValue(new Error('BRIEF_VALIDATION_FAILED:BRIEF_IMPERATIVE'));
    await expect(callAstrologerBriefWithValidationRetry(failed)).rejects.toThrow('BRIEF_VALIDATION_FAILED');
    expect(failed).toHaveBeenCalledTimes(2);
  });

  it('rejects chronology and neutral headlines without requiring separate commands', () => {
    expect(validateAstrologerBrief({
      ...validBrief,
      likelyResult: 'К концу периода результат станет заметнее прежнего',
    })).toContain('BRIEF_CHRONOLOGY');
    const result = validateFreeGeneratedForecastFeed({
      headline: 'Твою идею заметят',
      forecast: 'Творческая задумка получит живой отклик и заинтересует людей за пределами привычного круга. Первый вариант окажется убедительнее долгой подготовки и найдёт естественное продолжение.',
      closing: 'Похоже, у идеи будет продолжение.',
    }, new Set(), 'day', { language: 'ru' });
    expect(result.errors).toContain('headline is a neutral reaction summary');
    expect(validateFreeGeneratedForecastFeed({
      headline: 'Дома станет лучше',
      forecast: 'Сегодня обычные бытовые дела сложатся проще, чем ожидалось. Полезное изменение окажется доступным, а результат будет радовать без лишней возни и больших обещаний.',
      closing: 'Удобство тоже умеет радовать.',
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'headline is a neutral reaction summary',
    );
  });

  it('accepts every approved example as a complete visible forecast', () => {
    for (const example of PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU) {
      expect(validateFreeGeneratedForecastFeed(
        example.output,
        new Set(),
        example.period,
        { language: 'ru' },
      ).errors).toEqual([]);
    }
  });

  it('keeps few-shot inputs aligned with production writer input and removes the static basis', () => {
    expect(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU).toHaveLength(10);
    for (const example of PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU) {
      expect(Object.keys(example.input)).toEqual([
        'reader', 'selected_period', 'astrologer_brief', 'anti_repeat_context',
      ]);
      expect(JSON.stringify(example.input)).not.toMatch(/forecast_basis|primary_signal|hash_catalog|personal_profile/);
    }
  });

  it('locks all ten approved outputs, not just their headlines', () => {
    const digest = crypto.createHash('sha256')
      .update(JSON.stringify(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.map((example) => example.output)))
      .digest('hex');
    expect(digest).toBe('8456976e23bdc9c4bcd8adf80b8415c2be5398955bf944a2756e2a9aef3d6cdc');
  });

  it('uses only the forecast-specific voice layer', () => {
    const writerPrompt = getPersonalForecastSystemPrompt('ru', 'day');
    expect(writerPrompt).not.toContain(getAppSystemVoice('ru'));
    expect(writerPrompt).not.toContain('ГОЛОС ЛИЧНОГО ПРОГНОЗА');
    expect(writerPrompt).toContain('astrologer_brief');
    expect(writerPrompt).toContain('headline, forecast, closing');
    expect(writerPrompt).not.toMatch(/takeaway|\bdo\b|\bdont\b/);
    expect(writerPrompt).not.toContain('forecast_basis');
  });
});
