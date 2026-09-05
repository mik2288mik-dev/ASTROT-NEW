import {
  PERSONAL_FORECAST_RESPONSE_SCHEMA, PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS,
  buildPersonalForecastFeedPrompt, callAstrologerBriefWithValidationRetry,
  findAstrologerBriefRepeatViolations, getPersonalForecastSystemPrompt,
  getPersonalForecastWriterMaxOutputTokens, validateAstrologerBrief,
  validateFreeGeneratedForecastFeed,
} from '../lib/personalForecastGeneration';
import { resolvePersonalForecastWindow, type PersonalForecastAstrologerBrief } from '../lib/personalForecastContract';
import { PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU } from '../lib/personalForecastExamples';

const validBrief: PersonalForecastAstrologerBrief = {
  tone: 'mixed',
  observations: [
    'Небольшие повседневные задачи могут даваться легче, когда результат виден сразу и не нужно долго ждать.',
    'В разговорах вероятна чувствительность к резким словам, но дружелюбная шутка помогает быстрее понять друг друга.',
    'Интерес к незнакомому может приносить удовольствие без обязательной большой покупки, поездки или другого события.',
    'Сложные решения могут требовать больше времени, чем обычно, даже при достаточном количестве нужной информации.',
  ],
  briefSignature: 'server-observations-signature',
};
const example = (period: 'day' | 'week' | 'month' = 'day') =>
  PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.find((item) => item.period === period)!.output;
const validate = (patch: Partial<ReturnType<typeof example>> = {}, period: 'day' | 'week' | 'month' = 'day') =>
  validateFreeGeneratedForecastFeed({ ...example(period), ...patch }, new Set(), period, { language: 'ru' });

describe('personal period horoscope brief and writer contract', () => {
  it('keeps the canonical three visible fields while changing the reading genre', () => {
    expect(PERSONAL_FORECAST_RESPONSE_SCHEMA.required).toEqual(['title', 'forecast', 'closing']);
    expect(PERSONAL_FORECAST_RESPONSE_SCHEMA.additionalProperties).toBe(false);
    expect(getPersonalForecastSystemPrompt('ru', 'day')).toContain('один связный абзац из 3–4 предложений');
    expect(getPersonalForecastSystemPrompt('ru', 'week')).toContain('число не цель');
    expect(getPersonalForecastSystemPrompt('en', 'month')).toContain('Merge overlapping observations');
  });

  it('budgets for the longer periods and keeps retries bounded', () => {
    expect(PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS).toBe(6);
    expect(['day', 'week', 'month'].map((period) => getPersonalForecastWriterMaxOutputTokens(period as 'day'))).toEqual([2400, 3000, 3600]);
    expect(getPersonalForecastWriterMaxOutputTokens('month', true)).toBe(7200);
  });

  it('sends only accepted observations, reader, period and fifteen own previous readings to writer', () => {
    const recentForecasts = Array.from({ length: 18 }, (_, index) => ({
      period: 'day' as const, periodKey: `2026-08-${String(index + 1).padStart(2, '0')}`,
      fragments: [{ kind: 'forecast' as const, text: `Synthetic previous reading ${index}`, semanticFingerprint: null }],
    }));
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'ru', period: 'day', window: resolvePersonalForecastWindow('day', '2026-09-05', 'Europe/Moscow'),
      reader: { name: 'Лина', grammaticalGender: 'female' }, astrologerBrief: validBrief, recentForecasts,
    });
    const data = JSON.parse(prompt.slice(prompt.indexOf('{')));
    expect(Object.keys(data)).toEqual(['selected_period', 'reader', 'astrologer_brief', 'anti_repeat_context']);
    expect(data.astrologer_brief).toEqual({ tone: validBrief.tone, observations: validBrief.observations });
    expect(data.anti_repeat_context.recent_forecasts).toHaveLength(15);
    expect(data.reader).toEqual({ name: 'Лина', language: 'ru', grammatical_gender: 'female' });
    expect(prompt).not.toMatch(/birth_date|birth_time|chart_data|longitude|Swiss|cross_user|briefSignature/u);
  });

  it('requires two to four distinct observations, not the previous situation-turn-outcome chain', () => {
    expect(validateAstrologerBrief(validBrief)).toEqual([]);
    expect(validateAstrologerBrief({ ...validBrief, observations: validBrief.observations.slice(0, 2) })).toEqual([]);
    expect(validateAstrologerBrief({ ...validBrief, observations: validBrief.observations.slice(0, 1) })).toContain('BRIEF_OBSERVATIONS_REQUIRED');
    expect(validateAstrologerBrief({ ...validBrief, observations: [validBrief.observations[0], ...validBrief.observations] })).toContain('BRIEF_OBSERVATIONS_REQUIRED');
    expect(validateAstrologerBrief({ ...validBrief, observations: Array(4).fill(validBrief.observations[0]) })).toContain('BRIEF_REPEATED_OBSERVATION');
    expect(validateAstrologerBrief({ ...validBrief, observations: ['Коротко.', ...validBrief.observations.slice(1)] })).toContain('BRIEF_OBSERVATION_WORD_LIMIT');
    expect(validateAstrologerBrief({ tone: 'mixed', situation: 'One event', turn: 'Then', outcome: 'Result' } as any)).toContain('BRIEF_OBSERVATIONS_REQUIRED');
  });

  it.each([
    ['Планета и транзиты заставляют человека действовать с особенной уверенностью весь выбранный период.', 'BRIEF_ASTROLOGY'],
    ['Осознанность и личные границы становятся внутренней опорой для человека при любом разговоре.', 'BRIEF_COACHING_OR_ABSTRACT_VOICE'],
    ['Запланированную встречу перенесут на другой день после короткого разговора о времени.', 'BRIEF_ESTABLISHED_BACKSTORY'],
    ['Утром может хотеться больше тишины. Вечером вероятнее интерес к долгому разговору.', 'BRIEF_CHRONOLOGY'],
  ])('rejects unsupported or off-contract brief content: %s', (text, code) => {
    expect(validateAstrologerBrief({ ...validBrief, observations: [text, ...validBrief.observations.slice(1)] })).toContain(code);
  });

  it.each(['утром', 'вечером', 'ночью'])('accepts an ordinary mention of %s without manufacturing a calendar stage', (time) => {
    expect(validateAstrologerBrief({ ...validBrief, observations: [
      `От спокойного разговора ${time} может быть больше удовольствия, чем от множества коротких сообщений.`,
      'Знакомое занятие способно быстрее заинтересовать, если получается попробовать его немного иначе без спешки.',
    ] })).toEqual([]);
    expect(validate({
      title: 'Можно и попроще',
      forecast: `Сегодня может быть легче говорить о желаниях и спокойно обсуждать чужие идеи. От разговора ${time} иногда больше удовольствия, чем от долгой переписки. Простое объяснение поможет лучше понять другого человека, а небольшая шутка сделает общение приятнее.`,
      closing: 'День может приятно удивить.',
    }).errors).toEqual([]);
  });

  it.each([
    ['Утром может хотеться тишины и простых занятий без множества разговоров.', 'Днём вероятнее интерес к новым людям и непривычным интересным занятиям.', 'Вечером обычная беседа способна принести больше удовольствия и желания продолжить знакомство.'],
    ['В начале недели может быть проще объяснять, чего хочется от общения.', 'В середине недели больше удовольствия могут приносить знакомые места и спокойные занятия.', 'В конце недели интерес к необычному способен сделать привычные разговоры живее.'],
  ])('rejects a sequence of time stages across observations and in the visible reading', (...observations) => {
    expect(validateAstrologerBrief({ ...validBrief, observations })).toContain('BRIEF_CHRONOLOGY');
    expect(validate({ forecast: observations.join(' ') }).errors).toContain('visible forecast copy contains a chronological time segment');
  });

  it('distinguishes an inline morning/evening sequence from a choice of time', () => {
    expect(validate({ forecast: 'Утром может хотеться тишины, а вечером вероятнее интерес к разговору. Простое объяснение поможет точнее понять другого человека. Небольшая шутка способна сделать общение приятнее.' }).errors)
      .toContain('visible forecast copy contains a chronological time segment');
    expect(validate({ forecast: example().forecast.replace('Сегодня', 'Сегодня утром или вечером') }).errors)
      .not.toContain('visible forecast copy contains a chronological time segment');
  });

  it('does not let a possible opening qualify an unrelated guaranteed gift later', () => {
    const forecast = 'Сегодня тебе может быть проще говорить о желаниях и спокойно обсуждать чужие идеи. Короткое объяснение поможет найти общий язык и сделает встречу приятнее. После этого ты получишь подарок от нового знакомого и приглашение на встречу.';
    expect(validate({ title: 'Говорить проще', forecast, closing: 'День может приятно удивить.' }).errors)
      .toEqual(['visible forecast copy contains an unsupported event guarantee']);
    expect(validateAstrologerBrief({ ...validBrief, observations: [forecast, validBrief.observations[2]] }))
      .toContain('BRIEF_GUARANTEED_OUTCOME');
  });

  it.each(['После этого тебе позвонят и предложат встретиться.', 'Затем ты получишь деньги за удачную идею.'])('rejects an asserted external result: %s', (assertion) => {
    expect(validate({ forecast: `${example().forecast} ${assertion}` }).errors)
      .toContain('visible forecast copy contains an unsupported event guarantee');
  });

  it('allows ordinary future reactions and explicitly possible external events', () => {
    const body = 'Сегодня тебе может быть проще говорить о желаниях и спокойно обсуждать чужие идеи. Короткое и простое объяснение поможет найти общий язык и сделает встречу приятнее.';
    expect(validate({ title: 'Говорить проще', forecast: `${body} Ты получишь удовольствие от разговора и захочешь продолжить знакомство.`, closing: 'День может приятно удивить.' }).errors).toEqual([]);
    expect(validate({ title: 'Говорить проще', forecast: `${body} Возможно, ты получишь приглашение на встречу с новым знакомым.`, closing: 'День может приятно удивить.' }).errors).toEqual([]);
  });

  it('retries invalid brief structure with codes only and stops on provider errors', async () => {
    const request = jest.fn().mockRejectedValueOnce(new Error('BRIEF_VALIDATION_FAILED:BRIEF_REPEATED_OBSERVATION')).mockResolvedValueOnce(validBrief);
    await expect(callAstrologerBriefWithValidationRetry(request)).resolves.toBe(validBrief);
    expect(request.mock.calls).toEqual([[], [['BRIEF_REPEATED_OBSERVATION']]]);
    const invalid = jest.fn().mockRejectedValue(new Error('BRIEF_VALIDATION_FAILED:BRIEF_OBSERVATIONS_REQUIRED'));
    await expect(callAstrologerBriefWithValidationRetry(invalid)).rejects.toThrow('BRIEF_VALIDATION_FAILED');
    expect(invalid).toHaveBeenCalledTimes(4);
    const provider = jest.fn().mockRejectedValue(new Error('quota'));
    await expect(callAstrologerBriefWithValidationRetry(provider)).rejects.toThrow('quota');
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('detects reuse of the same observation bundle, not merely one shared theme', () => {
    const previous = { situation: validBrief.observations[0], turn: validBrief.observations[1], outcome: validBrief.observations.slice(2).join(' '), title: 'old', forecast: 'old', closing: 'old' };
    expect(findAstrologerBriefRepeatViolations(validBrief, [previous])).toEqual(['BRIEF_REPEATED_SIGNATURE']);
    expect(findAstrologerBriefRepeatViolations(validBrief, [{ ...previous, situation: 'Different observation about something completely separate' }])).toEqual([]);
  });

  it.each(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU)('accepts the complete $period reference $id and materializes its reading order', (reference) => {
    const result = validateFreeGeneratedForecastFeed(reference.output, new Set(), reference.period, { language: 'ru' });
    expect(result.errors).toEqual([]);
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].title).toBe(reference.output.title);
    expect(result.sections.slice(1).every((section) => section.title === null)).toBe(true);
    expect(result.sections.slice(0, -1).every((section) => section.blocks[0].role === 'detail')).toBe(true);
    expect(result.sections.at(-1)?.blocks[0]).toEqual(expect.objectContaining({ role: 'action', text: reference.output.closing }));
    expect(result.sections.slice(0, -1).map((section) => section.blocks[0].text).join('\n\n')).toBe(reference.output.forecast);
  });

  it('rejects the old 35-word microstory without imposing a paragraph quota', () => {
    expect(validate({ title: 'Ну, поехали', forecast: 'Сегодня кто-то может предложить подвезти тебя до нужного места. Если дорога одна, разговор легко пойдёт дальше дежурного приветствия. Случайная помощь может обернуться новым знакомством.', closing: 'Сначала уточни, куда человек едет.' }).errors).toEqual(expect.arrayContaining([
      expect.stringContaining('minimum for day is 40'),
    ]));
    expect(validate({ forecast: example().forecast.replace(/\n\n/gu, ' ') }).errors).toEqual([]);
    expect(validate({ forecast: example('week').forecast.replace('. ', '.\n\n') }, 'week').errors).toEqual([]);
    expect(validate({
      title: 'Тишина наводит порядок',
      forecast: 'В этом месяце тебе, вероятно, захочется держать вокруг чуть больше тишины и личного пространства. После насыщенного общения легче ненадолго отстраниться, а затем вернуться к людям с новым интересом, без ощущения, что тебя торопят. Особенно порадуют небольшие занятия, где результат виден сразу: аккуратно расставить вещи, подобрать сочетание, привести в порядок угол комнаты. Чужая небрежность в словах и мелочах способна раздражать, зато внимательное отношение к деталям поможет точнее понимать собеседников и не строить лишних догадок.',
      closing: 'Порядок вокруг вернёт ясность внутри.',
    }, 'month').errors).toEqual([]);
  });

  it('keeps title, closing and body contract errors independent from editorial preferences', () => {
    expect(validate({ title: 'Вот это поворот' }).errors).toEqual([]);
    expect(validate({ title: 'Деньги — не главное' }).errors).not.toContain('visible forecast copy contains a visible category label');
    expect(validate({ closing: 'Итог: вот и всё.' }).errors).toContain('closing contains a visible category label or question');
    expect(validate({ closing: 'Запишите ответ перед отправкой.' }).errors).toContain('visible forecast copy contains polite Вы or a plural imperative; address the reader as ты');
    expect(validate({ forecast: `Деньги: ${example().forecast}` }).errors).toContain('visible forecast copy contains a visible category label');
  });

  it('checks a named month against the selected period instead of banning every month name', () => {
    const raw = { ...example('month'), forecast: example('month').forecast.replace('В этом месяце', 'В сентябре') };
    expect(raw.forecast).toContain('В сентябре');
    const options = { language: 'ru' as const, periodKey: '2026-09' };
    expect(validateFreeGeneratedForecastFeed(raw, new Set(), 'month', options).errors).toEqual([]);
    expect(validateFreeGeneratedForecastFeed({ ...raw, forecast: raw.forecast.replace('В сентябре', 'В марте') }, new Set(), 'month', options).errors)
      .toEqual(['forecast contains a month-period mismatch']);
    expect(validateFreeGeneratedForecastFeed({ ...raw, title: 'Март приносит новости' }, new Set(), 'month', options).errors)
      .toContain('forecast contains a month-period mismatch');
    expect(validateFreeGeneratedForecastFeed(raw, new Set(), 'month', { language: 'ru' }).errors).toEqual([]);
    expect(validateFreeGeneratedForecastFeed({ ...raw, forecast: 'В начале сентября может быть легче разговаривать с незнакомыми людьми. В конце сентября приятнее оставаться дома за обычным занятием.' }, new Set(), 'month', options).errors)
      .toContain('visible forecast copy contains a chronological time segment');
  });

  it.each(['вероятны задержки', 'вероятен повторный разговор', 'вероятна задержка'])('recognizes the existing probability wording in its grammatical form: %s', (opening) => {
    const raw = {
      title: 'Снова проверять по кругу',
      forecast: `В этом месяце ${opening} с оплатами, документами и распределением денег: мелкая ошибка способна вернуть тебя к уже проверенному. Особенно будет раздражать, когда исправление очевидной детали снова отодвигает решение.\n\nЗато общие задачи могут заметно продвинуться, если заранее понятны роли и сроки. При размытых договорённостях быстро появится спор: кому досталось больше работы, а кто считает свой вклад недооценённым. Там, где ожидания совпадут, сотрудничество принесёт ощутимый результат без лишних выяснений. Ясные договорённости здесь окажутся ценнее добрых предположений.`,
      closing: 'Опять мелочь решает слишком многое.',
    };
    expect(validateFreeGeneratedForecastFeed(raw, new Set(), 'month', { language: 'ru', periodKey: '2026-09' }).errors).toEqual([]);
  });

  it.each([
    ['Планета обещает удачу.', 'visible forecast copy contains a forbidden astrology term'],
    ['Прислушайся к себе.', 'visible forecast copy contains a banned forecast voice phrase'],
    ['Ты точно получишь деньги.', 'visible forecast copy contains an unsupported event guarantee'],
    ['Выбранная вещь окажется дешевле.', 'visible forecast copy assumes an established backstory absent from birth details'],
    ['Проверь сообщения прямо сейчас.', 'forecast contains advice or an instruction'],
  ])('keeps hard content validity for longer readings: %s', (sentence, code) => {
    expect(validate({ forecast: `${example().forecast} ${sentence}` }).errors).toContain(code);
  });

  it('rejects paraphrased duplication and overlong sentences without forcing a miniature event outcome', () => {
    const first = example().forecast.split('\n\n')[0];
    expect(validate({ forecast: [first, first, ...example().forecast.split('\n\n').slice(2)].join('\n\n') }).errors).toContain('forecast repeats the same observation instead of adding content');
    expect(validate({ forecast: `${Array(30).fill('слово').join(' ')}. ${example().forecast}` }).errors).toContain('forecast sentence has 30 words; maximum is 24');
  });
});
