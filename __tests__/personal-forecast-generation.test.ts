import {
  PERSONAL_FORECAST_RESPONSE_SCHEMA,
  PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS,
  buildPersonalForecastFeedPrompt,
  callAstrologerBriefWithValidationRetry,
  findAstrologerBriefRepeatViolations,
  getPersonalForecastSystemPrompt,
  getPersonalForecastWriterMaxOutputTokens,
  validateAstrologerBrief,
  validateFreeGeneratedForecastFeed,
} from '../lib/personalForecastGeneration';
import {
  resolvePersonalForecastWindow,
  type PersonalForecastAstrologerBrief,
} from '../lib/personalForecastContract';
import { PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU } from '../lib/personalForecastExamples';
import { getAppSystemVoice } from '../lib/appVoice';

const validBrief: PersonalForecastAstrologerBrief = {
  tone: 'favorable',
  situation: 'продавец наконец называет точную цену',
  turn: 'короткий разговор быстро меняет решение',
  outcome: 'цену можно сравнить без долгих догадок',
  observableDetail: 'одна точная сумма заменяет долгие объяснения',
  briefSignature: 'server-signature',
};

const validGeneratedDay = {
  title: 'Ну наконец ответили',
  forecast: [
    'Сегодня может прийти ответ, который давно задерживал одну покупку.',
    'В сообщении назовут точную цену и срок без новых вопросов.',
    'В итоге можно будет решить, брать вещь или спокойно искать дальше.',
  ].join(' '),
  closing: 'Сравни цену и сразу дай ответ.',
};

describe('personal forecast brief and writer contract', () => {
  it('keeps exactly the three canonical visible writer fields', () => {
    expect(PERSONAL_FORECAST_RESPONSE_SCHEMA).toEqual(expect.objectContaining({
      type: 'object',
      additionalProperties: false,
      required: ['title', 'forecast', 'closing'],
    }));
    expect(Object.keys(PERSONAL_FORECAST_RESPONSE_SCHEMA.properties)).toEqual([
      'title', 'forecast', 'closing',
    ]);
  });

  it('uses period-specific writer budgets and doubles only for provider retry', () => {
    expect(PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS).toBe(6);
    expect(getPersonalForecastWriterMaxOutputTokens('day')).toBe(1200);
    expect(getPersonalForecastWriterMaxOutputTokens('week')).toBe(1600);
    expect(getPersonalForecastWriterMaxOutputTokens('month')).toBe(2000);
    expect(getPersonalForecastWriterMaxOutputTokens('day', true)).toBe(2400);
    expect(getPersonalForecastWriterMaxOutputTokens('week', true)).toBe(3200);
    expect(getPersonalForecastWriterMaxOutputTokens('month', true)).toBe(4000);
  });

  it('makes rejected prose simpler on every writer retry', () => {
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'ru',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-22', 'Europe/Moscow'),
      reader: { name: 'Тест', grammaticalGender: 'female' },
      astrologerBrief: validBrief,
      repairErrors: ['REPORT_WRITTEN_EVENT'],
      repairAttempt: 5,
    });

    expect(prompt).toContain('ПОПЫТКА ПЕРЕПИСАТЬ №5');
    expect(prompt).toContain('короткое голосовое другу');
    expect(prompt).toContain('8–16 слов');
    expect(prompt).toContain('REPORT_WRITTEN_EVENT');
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
        situation: validBrief.situation,
        turn: validBrief.turn,
        outcome: validBrief.outcome,
        observable_detail: validBrief.observableDetail,
      },
      anti_repeat_context: { recent_forecasts: [] },
    });
    for (const key of [
      'birth_date', 'birth_time', 'birth_place', 'birth_timezone',
      'personal_profile', 'brief_signature',
    ]) {
      expect(prompt).not.toContain(key);
    }
  });

  it('rejects invented facts, commands, and coaching abstractions in the hidden brief', () => {
    expect(validateAstrologerBrief(validBrief)).toEqual([]);
    expect(validateAstrologerBrief({
      ...validBrief,
      situation: 'Выбери одну главную задачу сегодня',
      turn: 'Выбери одну главную задачу сегодня',
      observableDetail: 'Планета усиливает контроль и личные границы',
      outcome: 'Сегодня всё сложится наилучшим образом',
    })).toEqual(expect.arrayContaining([
      'BRIEF_IMPERATIVE',
      'BRIEF_REPEATED_FIELD',
      'BRIEF_ASTROLOGY',
      'BRIEF_UNIVERSAL_PHRASE',
    ]));

    expect(validateAstrologerBrief({
      ...validBrief,
      situation: 'Рабочая стратегия определяет порядок дальнейших действий',
      turn: 'Личные границы меняют внутреннее состояние',
      outcome: 'Новый ресурс укрепляет личный результат',
      observableDetail: 'Осознанность возвращает человеку внутреннюю опору',
    })).toEqual(expect.arrayContaining([
      'BRIEF_COACHING_OR_ABSTRACT_VOICE',
    ]));

    expect(validateAstrologerBrief({
      ...validBrief,
      situation: 'Рабочий процесс получает новый формат участия',
      turn: 'Обсуждение переходит в общую папку материалов',
      outcome: 'Результат заметно продолжится после короткой проверки',
      observableDetail: 'Старое дело получает модный апгрейд',
    })).toEqual(expect.arrayContaining([
      'BRIEF_REPORT_OR_MACHINE_LANGUAGE',
    ]));

    expect(validateAstrologerBrief({
      ...validBrief,
      situation: 'При подготовке к поездке меняется маршрут',
    })).not.toContain('BRIEF_REPORT_OR_MACHINE_LANGUAGE');

    expect(validateAstrologerBrief({
      ...validBrief,
      situation: 'Несколько её работ выберут для общего показа',
    })).toContain('BRIEF_INVENTED_BIOGRAPHY');

    expect(validateAstrologerBrief({
      ...validBrief,
      situation: 'Запланированное дело перенесут на другой день',
    })).toContain('BRIEF_VAGUE_EVENT');

    expect(validateAstrologerBrief({
      ...validBrief,
      situation: 'Начальник становится главным источником давления вокруг решения',
      turn: 'К вечеру решение потребует ясного ответа',
      outcome: 'Тебе станет проще назвать точную цену',
      observableDetail: 'Слишком коротко',
    })).toEqual(expect.arrayContaining([
      'BRIEF_FIELD_WORD_LIMIT',
      'BRIEF_INVENTED_BIOGRAPHY',
      'BRIEF_CHRONOLOGY',
      'BRIEF_DIRECT_ADDRESS',
    ]));
  });

  it('retries editorial brief validation with codes only and never passes the rejected draft', async () => {
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
    expect(failed).toHaveBeenCalledTimes(4);
  });

  it('does not reject different plots merely because their conditional outcome is the same', () => {
    const current = {
      ...validBrief,
      situation: 'Кто-то может позвать погулять после короткого разговора',
      turn: 'Общий интерес может оказаться важнее места встречи',
      outcome: 'Если время подойдёт, люди смогут договориться',
    };
    const previous = {
      situation: 'Продавец может предложить доставку вместе с покупкой',
      turn: 'Разница в цене способна изменить выбор вещи',
      outcome: current.outcome,
      title: 'Сколько за доставку?', forecast: 'Previous synthetic text', closing: 'Previous synthetic closing',
    };
    expect(findAstrologerBriefRepeatViolations(current, [previous])).toEqual([]);
    expect(findAstrologerBriefRepeatViolations(current, [{
      ...previous, situation: current.situation, turn: current.turn,
    }])).toEqual(['BRIEF_REPEATED_SIGNATURE']);
  });

  it('rejects visible astrology, coaching, and instructions inside the forecast body', () => {
    const legacyFourPartPayload = {
      ...validGeneratedDay,
      punchline: 'Лишняя четвёртая часть.',
    } as unknown as Parameters<typeof validateFreeGeneratedForecastFeed>[0];
    expect(validateFreeGeneratedForecastFeed(
      legacyFourPartPayload,
      new Set(),
      'day',
      { language: 'ru' },
    ).errors).toContain(
      'payload contains unexpected fields: punchline',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      title: 'Нашлась недостающая деталь',
    }, new Set(), 'day', { language: 'ru' }).editorialWarnings).toContain(
      'title is a generic report label',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      title: 'Старое вынесут первым',
    }, new Set(), 'day', { language: 'ru' }).editorialWarnings).toContain(
      'title uses a strained image instead of an ordinary spoken line',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      title: 'Ну и ладно, далеко',
    }, new Set(), 'day', { language: 'ru' }).editorialWarnings).toContain(
      'title uses a strained image instead of an ordinary spoken line',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      title: 'Ну и хорошо',
    }, new Set(), 'day', { language: 'ru' }).editorialWarnings).toContain(
      'title is a generic report label',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: [
        'Сегодня может решиться вопрос о цене или дороге.',
        'Потом собеседник назовёт точную сумму и новый адрес.',
        'После разговора вы решите, какой ответ дать.',
      ].join(' '),
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'forecast opens with multiple alternatives instead of one clear plot',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: validGeneratedDay.forecast.replace('Сегодня', 'Планета сегодня'),
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'visible forecast copy contains a forbidden astrology term',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: [
        'Сегодня встречу могут перенести на другой день.',
        'Тебе предложат созвониться и сразу назовут новое время.',
        'После разговора вы решите, нужна ли встреча вообще.',
      ].join(' '),
    }, new Set(), 'day', { language: 'ru' }).errors).not.toContain(
      'visible forecast copy contains an unsupported event guarantee',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: [
        'Сегодня встречу могут перенести на другой день.',
        'Тебе точно предложат созвониться и сразу назовут новое время.',
        'После разговора вы решите, нужна ли встреча вообще.',
      ].join(' '),
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'visible forecast copy contains an unsupported event guarantee',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: validGeneratedDay.forecast.replace(
        'Сегодня может прийти ответ',
        'Сегодня прислушайся к себе: может прийти ответ',
      ),
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'visible forecast copy contains a banned forecast voice phrase',
    );

    const instructionErrors = validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: validGeneratedDay.forecast.replace(
        'Сегодня может прийти ответ, который давно задерживал одну покупку',
        'Сегодня проверь сообщения: нужный ответ может наконец прийти',
      ),
    }, new Set(), 'day', { language: 'ru' }).errors;
    expect(instructionErrors.some((error) => /instruction|advice|command/iu.test(error))).toBe(true);

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: [
        'Сегодня твоей идеей могут заинтересоваться новые люди.',
        'Несколько твоих работ выберут для общего показа.',
        'После этого появятся новые заказы, и ждать ответа больше не придётся.',
      ].join(' '),
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'visible forecast copy contains an invented biography claim',
    );
  });

  it('rejects a forecast without a real outcome and report-like prose', () => {
    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: [
        'Сегодня может прийти ответ, который давно задерживал одну покупку.',
        'В сообщении назовут точную цену и срок без новых вопросов.',
        'Последняя фраза просто повторяет знакомую мысль без нового ответа.',
      ].join(' '),
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'forecast does not explain what the situation leads to; rewrite the final sentence with a plain result',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: validGeneratedDay.forecast.replace(
        'В сообщении назовут точную цену',
        'В едином рабочем документе назовут точную цену',
      ),
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'forecast contains a hard-banned report phrase',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: validGeneratedDay.forecast.replace(
        'В сообщении назовут точную цену и срок без новых вопросов.',
        'В рамках этого дела рабочий процесс даст точную цену и срок без новых вопросов.',
      ),
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'forecast contains too much report-like language',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: [
        'Сегодня старое дело может снова поднять давний вопрос о прошлом плане.',
        'Этот вопрос вернёт дело к одному пункту, а другой пункт останется частью прежнего плана.',
        'В итоге дело сдвинется, но остальная часть плана всё ещё останется без ответа.',
      ].join(' '),
    }, new Set(), 'day', { language: 'ru' }).editorialWarnings).toContain(
      'forecast relies on vague placeholder nouns',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      closing: 'Запишите ответ перед отправкой.',
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'visible forecast copy contains polite Вы or a plural imperative; address the reader as ты',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      title: 'Ну что, договорились?',
      forecast: [
        'Сегодня может прийти ответ, который давно задерживал одну покупку.',
        'В сообщении назовут точную цену и срок без новых вопросов.',
        'После разговора вы решите, брать вещь или спокойно искать дальше.',
      ].join(' '),
      closing: 'Сверь календарь с новым днём.',
    }, new Set(), 'day', { language: 'ru' }).errors).not.toContain(
      'visible forecast copy contains polite Вы or a plural imperative; address the reader as ты',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      title: 'Ну что, договорились?',
      forecast: [
        'Сегодня может прийти ответ, который давно задерживал одну покупку.',
        'В сообщении назовут точную цену и срок без новых вопросов.',
        'После разговора вы решите, брать вещь или спокойно искать дальше.',
      ].join(' '),
      closing: 'Сверь календарь с новым днём.',
    }, new Set(), 'day', { language: 'ru' }).errors).toEqual([]);

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: [
        'Сегодня встречу могут перенести на другой день.',
        'После звонка вы выберете время, удобное для вас обоих.',
        'Новая дата останется в календаре, и ждать больше не придётся.',
      ].join(' '),
    }, new Set(), 'day', { language: 'ru' }).errors).not.toContain(
      'visible forecast copy contains polite Вы or a plural imperative; address the reader as ты',
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: [
        'Сегодня может прийти ответ, который давно задерживал одну покупку.',
        'В сообщении назовут точную цену и срок без новых вопросов.',
        'После разговора Вы договоритесь о цене, и искать дальше не придётся.',
      ].join(' '),
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'visible forecast copy contains polite Вы or a plural imperative; address the reader as ты',
    );
  });

  it('accepts the brief outcome in ordinary Russian without demanding a stock result verb', () => {
    const generated = {
      title: 'Ну вот, ближе',
      forecast: 'На этой неделе в разговоре могут предложить встретиться и поболтать без особого повода. Человеку может оказаться удобно место рядом с метро. В разговоре про адрес станет понятнее, подходит ли тебе поездка. Если адрес удобен вам обоим, встреча состоится без долгой дороги.',
      closing: 'Дорога получится короткой.',
    };
    const options = { language: 'ru' as const, acceptedOutcome: 'Встреча состоится без долгой дороги' };
    expect(validateFreeGeneratedForecastFeed(generated, new Set(), 'week', options).errors).toEqual([]);
    expect(validateFreeGeneratedForecastFeed({
      ...generated,
      forecast: generated.forecast.replace('Если адрес удобен вам обоим, встреча состоится без долгой дороги.', 'Последняя фраза просто повторяет знакомую мысль без нового ответа.'),
    }, new Set(), 'week', options).errors).toContain(
      'forecast does not explain what the situation leads to; rewrite the final sentence with a plain result',
    );
  });

  it.each([
    'На запись в выбранную вечернюю группу ответят не сразу',
    'Цена выбранной вещи окажется выше ожидаемой',
    'Запланированную встречу перенесут на другой день',
    'Место освободят после отказа другого слушателя',
  ])('rejects invented established backstory in the brief: %s', (situation) => {
    expect(validateAstrologerBrief({ ...validBrief, situation })).toContain('BRIEF_ESTABLISHED_BACKSTORY');
  });

  it('rejects promised outcomes and invented background even after an opening may', () => {
    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: 'Сегодня встречу могут перенести на другой день. После разговора тебе сразу назовут новую дату и запишут её в календарь. Встреча пройдёт без новых переносов, и ждать больше не придётся.',
    }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'visible forecast copy contains an unsupported event guarantee',
    );
    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: 'Сегодня выбранная вещь может оказаться дороже, чем ты ожидаешь. В разговоре продавец покажет другую модель и назовёт меньшую цену. В итоге ты получишь ту же вещь без заметной переплаты.',
    }, new Set(), 'day', { language: 'ru' }).errors).toEqual(expect.arrayContaining([
      'visible forecast copy assumes an established backstory absent from birth details',
      'forecast promises a factual outcome after an uncertain opening; keep the outcome possible or conditional',
    ]));
    expect(validateAstrologerBrief({ ...validBrief, outcome: 'Встреча всё же состоится без дальнейших переносов' })).toContain('BRIEF_GUARANTEED_OUTCOME');
    expect(validateAstrologerBrief({ ...validBrief, outcome: 'Занятия начнутся сразу после короткого разговора' })).toContain('BRIEF_OUTCOME_MUST_BE_POSSIBLE_OR_CONDITIONAL');
    expect(validateAstrologerBrief({ ...validBrief, situation: 'В разговоре может прозвучать прямой вопрос о цене' })).not.toContain('BRIEF_VAGUE_EVENT');
    expect(validateAstrologerBrief({ ...validBrief, observableDetail: 'Человек назовёт конкретную сумму и следующий шаг' })).toContain('BRIEF_REPORT_OR_MACHINE_LANGUAGE');
    const watery = validateFreeGeneratedForecastFeed({
      title: 'Вот это поворот',
      forecast: 'Сегодня тебе могут предложить встретиться и обсудить цену покупки. После разговора, вероятно, придётся ещё немного подождать ответа. После этой паузы, скорее всего, получится сравнить две цены без долгой переписки.',
      closing: 'Сначала спроси, сколько стоит каждая вещь.',
    }, new Set(), 'day', { language: 'ru' });
    expect(watery.errors).toEqual([]);
    expect(watery.editorialWarnings).toEqual(expect.arrayContaining([
      'title is a generic report label',
      'forecast repeats uncertainty in too many sentences; use one or two markers and a clear condition',
    ]));
  });

  it('accepts an ordinary conditional outcome without demanding a guaranteed event', () => {
    const result = validateFreeGeneratedForecastFeed({
      title: 'А время назовёшь?',
      forecast: 'Сегодня тебе могут предложить встретиться, но пока без точного времени. В разговоре о месте станет понятнее, удобна ли тебе эта поездка. Если место и время подходят обоим, вы сможете договориться.',
      closing: 'Узнай место и время встречи.',
    }, new Set(), 'day', { language: 'ru' });
    expect(result.errors).toEqual([]);
  });

  it('does not mistake a sentence-like title for a fixed reading category', () => {
    const result = validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      title: 'Деньги — не главное',
    }, new Set(), 'day', { language: 'ru' });
    expect(result.errors).not.toContain('visible forecast copy contains a visible category label');
    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: `Деньги: ${validGeneratedDay.forecast}`,
    }, new Set(), 'day', { language: 'ru' }).errors).toContain('visible forecast copy contains a visible category label');
  });

  it('rejects repeated sentences without banning a story from using its ordinary nouns', () => {
    const body = 'Сегодня тебе могут предложить встретиться рядом с метро без долгой дороги. В разговоре появится понятный адрес, и дорога к метро станет заметно короче. После этого в разговоре появится понятный адрес, и дорога к метро станет заметно короче.';
    expect(validateFreeGeneratedForecastFeed({ ...validGeneratedDay, forecast: body }, new Set(), 'day', { language: 'ru' }).errors).toContain(
      'forecast repeats the same sentence meaning instead of developing the plot',
    );
    for (const example of PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU) {
      const text = Object.values(example.output).join(' ');
      expect(text).not.toMatch(/ты\s+(?:сам|сама|выбрал\p{L}*|рассчитывал\p{L}*|перестал\p{L}*|записал\p{L}*)/iu);
    }
  });

  it.each([
    [
      'Сегодня запланированная встреча может не состояться в назначенное время.',
      'REPORT_FORMAL_EVENT',
    ],
    [
      'В календаре появится новая дата вместо прежней.',
      'REPORT_FORMAL_EVENT',
    ],
    [
      'На экране маршрута может обнаружиться другой пункт пересадки.',
      'REPORT_IMPERSONAL_DISCOVERY',
    ],
    [
      'Расходы этой недели будут закрыты.',
      'REPORT_FORMAL_EVENT',
    ],
  ])('flags editorial wording without treating it as invalid content: %s', (badPhrase, code) => {
    const result = validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: [
        'Сегодня встречу могут перенести, и это пока только один из вариантов.',
        badPhrase,
        'В итоге планы поменяются, и ждать старого времени больше не придётся.',
      ].join(' '),
    }, new Set(), 'day', { language: 'ru' });

    expect([...result.errors, ...result.editorialWarnings].join('\n')).toContain(code);
  });

  it('rejects a sentence that is too long to sound like ordinary speech', () => {
    const result = validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      forecast: [
        'Сегодня может прийти ответ, который ты ждал так долго, что уже успел забыть, зачем вообще задавал этот простой вопрос ещё тогда в прошлый раз.',
        'В сообщении назовут точную цену и срок без новых вопросов.',
        'В итоге можно будет решить, брать вещь или спокойно искать дальше.',
      ].join(' '),
    }, new Set(), 'day', { language: 'ru' });

    expect(result.errors).toContain('forecast sentence has 24 words; maximum is 16');
  });

  it('accepts a production-shaped three-part payload and materializes one story plus one closing', () => {
    const result = validateFreeGeneratedForecastFeed(
      validGeneratedDay,
      new Set(),
      'day',
      { language: 'ru' },
    );

    expect(result.errors).toEqual([]);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].title).toBe(validGeneratedDay.title);
    expect(result.sections[0].blocks).toEqual([
      expect.objectContaining({ role: 'detail', text: validGeneratedDay.forecast }),
    ]);
    expect(result.sections[1].blocks).toEqual([
      expect.objectContaining({ role: 'action', text: validGeneratedDay.closing }),
    ]);
    expect(result.sections.flatMap((section) => section.blocks)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ role: 'lead' })]),
    );

    expect(validateFreeGeneratedForecastFeed({
      ...validGeneratedDay,
      closing: 'Лучше сразу сравнить цену и ответить.',
    }, new Set(), 'day', { language: 'ru' }).errors).toEqual([]);
  });

  it('keeps a compact period corpus aligned with the three-part contract and production validator', () => {
    const counts = Object.fromEntries(
      (['day', 'week', 'month'] as const).map((period) => [
        period,
        PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU
          .filter((example) => example.period === period).length,
      ]),
    );
    expect(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU).toHaveLength(9);
    expect(counts).toEqual({ day: 3, week: 3, month: 3 });
    expect(new Set(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.map((example) => example.id)).size)
      .toBe(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.length);
    for (const example of PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU) {
      expect(Object.keys(example.input)).toEqual([
        'reference_scope', 'reader', 'selected_period',
      ]);
      expect(example.input.reader).toEqual({ language: 'ru', grammatical_gender: 'male' });
      expect(Object.keys(example.output)).toEqual([
        'title', 'forecast', 'closing',
      ]);
      expect(JSON.stringify(example.input)).not.toMatch(/forecast_basis|primary_signal|hash_catalog|personal_profile/);
      expect(JSON.stringify(example.input)).not.toMatch(/name|current_date|period_start|period_end|timezone|astrologer_brief/);
      expect(example.output).not.toHaveProperty('headline');
      expect(example.output).not.toHaveProperty('punchline');
      expect(validateFreeGeneratedForecastFeed(
        example.output,
        new Set(),
        example.period,
        { language: 'ru' },
      ).errors).toEqual([]);
    }
  });

  it('uses only the forecast-specific voice layer and the requested period lengths', () => {
    const writerPrompt = getPersonalForecastSystemPrompt('ru', 'day');
    const weekPrompt = getPersonalForecastSystemPrompt('ru', 'week');
    const monthPrompt = getPersonalForecastSystemPrompt('ru', 'month');
    expect(writerPrompt).not.toContain(getAppSystemVoice('ru'));
    expect(writerPrompt).not.toContain('ГОЛОС ЛИЧНОГО ПРОГНОЗА');
    expect(writerPrompt).toContain('astrologer_brief');
    expect(writerPrompt).toContain('title, forecast, closing');
    expect(writerPrompt).toContain('30–65 слов');
    expect(writerPrompt).toContain('3–4 предложений');
    expect(writerPrompt).toContain('не больше 16 слов');
    expect(writerPrompt).toContain('встречу могут перенести');
    expect(weekPrompt).toContain('42–85 слов');
    expect(weekPrompt).toContain('4–5 предложений');
    expect(monthPrompt).toContain('55–105 слов');
    expect(monthPrompt).toContain('5–6 предложений');
    expect(writerPrompt).toContain('3–12 слов');
    expect(writerPrompt).toContain('reader.grammatical_gender');
    expect(writerPrompt).not.toContain('punchline');
    expect(writerPrompt).not.toMatch(/takeaway|\bdo\b|\bdont\b/);
    expect(writerPrompt).not.toContain('forecast_basis');
  });
});
