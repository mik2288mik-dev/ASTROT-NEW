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

const validBrief: PersonalForecastAstrologerBrief = {
  tone: 'favorable',
  coreForecast: 'Прямой разговор помогает закрепить полезную договорённость без лишней суеты',
  secondaryForecast: 'Знакомая рабочая задача открывает возможность выбрать более удобный порядок',
  distinctiveDetail: 'Неожиданно короткий ответ оказывается убедительнее длинных объяснений',
  opportunity: 'Появляется возможность спокойно заявить о готовом решении',
  friction: null,
  likelyResult: 'Ясная позиция укрепляет договорённость и оставляет пространство для продолжения',
  briefSignature: 'server-signature',
};

const validGeneratedDay = {
  title: 'Точный поворот',
  punchline: 'Хватит раздувать сомнения: нужный ответ уже выдерживает прямой разговор.',
  forecast: [
    'Сегодня знакомая задача покажет деталь, которую раньше было удобно не замечать.',
    'Она не создаст катастрофу, но потребует ясного ответа без длинных оправданий.',
    'Твоя спокойная позиция поможет отделить полезную просьбу от чужой суеты.',
    'Если сохранишь точность, разговор не расползётся по мелочам и оставит тебе место для собственного решения.',
    'Небольшая пауза перед ответом сделает твои слова заметно убедительнее и снимет лишнее напряжение.',
  ].join(' '),
  closing: 'Сначала проверь детали, затем отвечай без лишних объяснений.',
};

describe('personal forecast brief and writer contract', () => {
  it('keeps exactly the four canonical visible writer fields', () => {
    expect(PERSONAL_FORECAST_RESPONSE_SCHEMA).toEqual(expect.objectContaining({
      type: 'object',
      additionalProperties: false,
      required: ['title', 'punchline', 'forecast', 'closing'],
    }));
    expect(Object.keys(PERSONAL_FORECAST_RESPONSE_SCHEMA.properties)).toEqual([
      'title', 'punchline', 'forecast', 'closing',
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
      reader: { name: 'Тест', grammaticalGender: 'female' },
      astrologerBrief: validBrief,
    });
    const json = JSON.parse(prompt.slice(prompt.indexOf('{')));
    expect(json).toEqual({
      selected_period: expect.any(Object),
      reader: { name: 'Тест', language: 'ru', grammatical_gender: 'female' },
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
    for (const key of ['birth_date', 'birth_time', 'birth_place', 'birth_timezone', 'personal_profile', 'brief_signature']) {
      expect(prompt).not.toContain(key);
    }
  });

  it('keeps truth and privacy guards without rejecting ordinary work or inner-state themes', () => {
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
      'BRIEF_UNIVERSAL_PHRASE',
    ]));

    expect(validateAstrologerBrief({
      ...validBrief,
      coreForecast: 'Рабочая стратегия становится яснее после проверки спорных деталей',
      secondaryForecast: 'Личные границы помогают выбрать точную позицию в сложном разговоре',
      distinctiveDetail: 'Внутреннее состояние остается собранным среди противоречивых требований',
      opportunity: 'Офисная задача открывает место для более смелого решения',
      friction: 'Управленческий вопрос потребует ясной позиции без дипломатического шума',
      likelyResult: 'Профессиональный результат становится заметнее благодаря уверенной аргументации',
    })).toEqual([]);

    expect(validateAstrologerBrief({
      ...validBrief,
      coreForecast: 'Слишком коротко',
      distinctiveDetail: 'Начальник становится главным источником давления вокруг сложного решения',
      friction: 'К вечеру решение потребует ясного ответа без лишних объяснений',
      likelyResult: 'Тебе станет проще назвать точную цену полезного решения',
    })).toEqual(expect.arrayContaining([
      'BRIEF_FIELD_WORD_LIMIT',
      'BRIEF_INVENTED_BIOGRAPHY',
      'BRIEF_CHRONOLOGY',
      'BRIEF_DIRECT_ADDRESS',
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

  it('rejects malformed punchlines and retained visible safety violations', () => {
    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      punchline: 'Почему ты снова тянешь с очевидным решением?',
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'punchline must be one complete statement',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: validGeneratedDay.forecast.replace('Сегодня', 'Планета сегодня'),
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'visible forecast copy contains a forbidden astrology term',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: validGeneratedDay.forecast.replace(
        'Сегодня знакомая задача покажет',
        'Луна усиливает эмоции, а знакомая задача покажет',
      ),
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'visible forecast copy contains a forbidden astrology term',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      punchline: 'Не прячься в тени: место под солнцем само себя не займёт.',
    }, new Set(), 'day', { language: 'ru' }).errors).not.toContain(
      'visible forecast copy contains a forbidden astrology term',
    );
  });

  it('accepts a production-shaped four-part payload and materializes its UI roles', () => {
    const result = validateFreeGeneratedForecastFeed(
      validGeneratedDay,
      new Set(),
      'day',
      { language: 'ru' },
    );

    expect(result.errors).toEqual([]);
    expect(result.sections).toHaveLength(4);
    expect(result.sections[0].title).toBe(validGeneratedDay.title);
    expect(result.sections[0].blocks.map((block) => block.role)).toEqual([
      'lead',
      'detail',
    ]);
    expect(result.sections[0].blocks[0].text).toBe(validGeneratedDay.punchline);
    expect(result.sections.slice(1, -1).map((section) => section.blocks[0].role)).toEqual([
      'detail',
      'detail',
    ]);
    expect(result.sections.at(-1)?.blocks).toEqual([
      expect.objectContaining({ role: 'action', text: validGeneratedDay.closing }),
    ]);
  });

  it('keeps the full period corpus aligned with the writer input and four-part output', () => {
    const counts = Object.fromEntries(
      (['day', 'week', 'month'] as const).map((period) => [
        period,
        PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU
          .filter((example) => example.period === period).length,
      ]),
    );
    expect(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU).toHaveLength(56);
    expect(counts).toEqual({ day: 21, week: 15, month: 20 });
    expect(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.map((example) => example.id))
      .toContain('day-rezhim-zhertvy');
    expect(new Set(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.map((example) => example.id)).size)
      .toBe(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.length);
    for (const example of PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU) {
      expect(Object.keys(example.input)).toEqual([
        'reference_scope', 'reader', 'selected_period',
      ]);
      expect(example.input.reader).toEqual({ language: 'ru', grammatical_gender: 'male' });
      expect(Object.keys(example.output)).toEqual([
        'title', 'punchline', 'forecast', 'closing',
      ]);
      expect(JSON.stringify(example.input)).not.toMatch(/forecast_basis|primary_signal|hash_catalog|personal_profile/);
      expect(JSON.stringify(example.input)).not.toMatch(/name|current_date|period_start|period_end|timezone|astrologer_brief/);
      expect(example.output).not.toHaveProperty('headline');
    }
  });

  it('uses only the forecast-specific voice layer', () => {
    const writerPrompt = getPersonalForecastSystemPrompt('ru', 'day');
    const weekPrompt = getPersonalForecastSystemPrompt('ru', 'week');
    const monthPrompt = getPersonalForecastSystemPrompt('ru', 'month');
    expect(writerPrompt).not.toContain(getAppSystemVoice('ru'));
    expect(writerPrompt).not.toContain('ГОЛОС ЛИЧНОГО ПРОГНОЗА');
    expect(writerPrompt).toContain('astrologer_brief');
    expect(writerPrompt).toContain('title, punchline, forecast, closing');
    expect(writerPrompt).toContain('5–20 слов');
    expect(writerPrompt).toContain('65–115 слов');
    expect(writerPrompt).toContain('5–7 предложений');
    expect(weekPrompt).toContain('85–130 слов');
    expect(weekPrompt).toContain('5–7 предложений');
    expect(monthPrompt).toContain('100–150 слов');
    expect(monthPrompt).toContain('5–8 предложений');
    expect(writerPrompt).toContain('reader.grammatical_gender');
    expect(writerPrompt).not.toMatch(/takeaway|\bdo\b|\bdont\b/);
    expect(writerPrompt).not.toContain('forecast_basis');
  });
});
