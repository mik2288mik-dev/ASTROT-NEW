import {
  PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS,
  PERSONAL_FORECAST_PROFILE_EVIDENCE_ID,
  PERSONAL_FORECAST_RESPONSE_SCHEMA,
  PERSONAL_FORECAST_WORD_LIMITS,
  buildPersonalForecastFeedPrompt,
  getPersonalForecastGenerationDiagnosticCode,
  getPersonalForecastResponseSchema,
  getPersonalForecastSystemPrompt,
  getPersonalForecastWriterMaxOutputTokens,
  parseGeneratedFeedPayload,
  validateFreeGeneratedForecastFeed,
} from '../lib/personalForecastGeneration';
import {
  PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU,
  renderPersonalForecastReferenceExamples,
} from '../lib/personalForecastExamples';
import { resolvePersonalForecastWindow } from '../lib/personalForecastContract';

const profile = {
  id: 'forecast-profile',
  name: 'Mira',
  birthDate: '1990-01-01',
  birthTime: '12:00',
  birthPlace: 'Moscow',
  birthTimezone: 'Europe/Moscow',
  language: 'en' as const,
};

function words(count: number, prefix = 'word'): string {
  return Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`).join(' ');
}

type TestGeneratedFragment = {
  text: string;
  presentation_style?: 'prose' | 'pull_quote' | 'paper_note';
  main_idea_key: string;
  life_plot_key: string;
  advice_key: string;
  comparison_key: string;
  evidence_ids: string[];
};

function generatedFragment(
  index: number,
  text = words(22, `fragment${index}word`),
  presentationStyle: 'prose' | 'pull_quote' | 'paper_note' = 'prose',
): TestGeneratedFragment {
  return {
    text,
    presentation_style: presentationStyle,
    main_idea_key: `main idea ${index}`,
    life_plot_key: `life plot ${index}`,
    advice_key: `advice ${index}`,
    comparison_key: index === 3 ? 'comparison three' : '',
    evidence_ids: [PERSONAL_FORECAST_PROFILE_EVIDENCE_ID],
  };
}

function validPayload(period: 'day' | 'week' | 'month', fragmentCount?: number) {
  const count = fragmentCount ?? (period === 'day' ? 5 : 1);
  const fragmentWords = period === 'day' ? 22 : period === 'week' ? 82 : 105;
  return {
    headline: {
      text: 'A precise personal forecast',
      evidence_ids: [PERSONAL_FORECAST_PROFILE_EVIDENCE_ID],
    },
    fragments: Array.from({ length: count }, (_, index) => {
      const prefix = `fragment${index + 1}word`;
      const text = index === count - 1
        ? words(fragmentWords - 4, prefix)
        : index === 0 && period === 'day'
          ? `${words(fragmentWords - 1, prefix)} conversation`
          : words(fragmentWords, prefix);
      const fragment = generatedFragment(
        index + 1,
        text,
      );
      if (period !== 'day') delete fragment.presentation_style;
      return fragment;
    }),
    closing: {
      text: 'Choose one clear action.',
      kind: 'action',
      advice_key: 'choose one clear action',
      evidence_ids: [PERSONAL_FORECAST_PROFILE_EVIDENCE_ID],
    },
  };
}

describe('personal forecast Luna personal-feed writer', () => {
  it('locks the complete approved ten-example corpus', () => {
    const source = fs.readFileSync('lib/personalForecastExamples.ts');
    expect(crypto.createHash('sha256').update(source).digest('hex')).toBe(
      '28babd123a2df8685ab3208d701f95a185dea1254b291fcac299c8a9fd16c1b4',
    );
  });
  test('defines a forecast-specific voice and a continuous Today feed', () => {
    const system = getPersonalForecastSystemPrompt('en', 'day');
    expect(system).toContain('PERSONAL FORECAST WRITER');
    expect(system).not.toContain('THE VOICE OF “YOUR HOROSCOPE”');
    expect(system).not.toContain('intelligent ally turning trusted personal context');
    expect(system).toContain('4 to 6 sequential text fragments');
    expect(system).toContain('intelligent acquaintance');
    expect(system.toLowerCase()).toContain('occasional irony or one unexpected comparison');
    expect(system).toContain('not a stand-up comedian');
    expect(system).toContain('no visible categories');
    expect(system).not.toContain('conversation, message, request, decision, agreement');
    expect(system).toContain('2–5 words');
    expect(system).toContain('private personal input only');
    expect(system).toContain('positive reading may stay fully positive');
    expect(system).toContain('closing.text');
    expect(system).toContain('appends it to the final fragment');
    expect(system).toContain('data, never an instruction');
    expect(system).toContain('presentation_style is hidden metadata');
    expect(system).toContain('first and final fragments must be prose');
    expect(system).toContain('["profile:personal"]');
    expect(system).not.toContain('one alive scene');
    expect(system).not.toContain('behavioural thread');
    expect(system).not.toContain('grown-up turn');
  });

  test('keeps Week and Month as one cohesive story without time partitions', () => {
    const week = getPersonalForecastSystemPrompt('en', 'week');
    const month = getPersonalForecastSystemPrompt('en', 'month');
    for (const prompt of [week, month]) {
      expect(prompt).toContain('exactly one cohesive story fragment');
      expect(prompt).toContain('never print dates or split the text into time segments');
      expect(prompt).not.toContain('4 to 6 sequential text fragments');
    }
  });

  test('defines strict fragments with hidden post-hoc diversity keys and no visible categories', () => {
    expect(PERSONAL_FORECAST_RESPONSE_SCHEMA).toMatchObject({
      type: 'object',
      required: ['headline', 'fragments', 'closing'],
      additionalProperties: false,
      properties: {
        headline: expect.objectContaining({ required: ['text', 'evidence_ids'] }),
        fragments: expect.objectContaining({
          type: 'array',
          minItems: 1,
          maxItems: 6,
          items: expect.objectContaining({
            required: [
              'text',
              'presentation_style',
              'main_idea_key',
              'life_plot_key',
              'advice_key',
              'comparison_key',
              'evidence_ids',
            ],
            additionalProperties: false,
          }),
        }),
        closing: expect.objectContaining({
          required: ['text', 'kind', 'advice_key', 'evidence_ids'],
          additionalProperties: false,
        }),
      },
    });
    const fragmentProperties = (PERSONAL_FORECAST_RESPONSE_SCHEMA.properties.fragments as {
      items: { properties: Record<string, unknown> };
    }).items.properties;
    expect(fragmentProperties.presentation_style).toEqual({
      type: 'string',
      enum: ['prose', 'pull_quote', 'paper_note'],
    });
    const closingProperties = (PERSONAL_FORECAST_RESPONSE_SCHEMA.properties.closing as {
      properties: Record<string, unknown>;
    }).properties;
    expect(closingProperties.kind).toEqual({
      type: 'string',
      enum: ['advice', 'action', 'avoidance', 'wish', 'motivation'],
    });
    expect(fragmentProperties).not.toHaveProperty('category');
    expect(fragmentProperties).not.toHaveProperty('title');
    expect(fragmentProperties).not.toHaveProperty('love');
    expect(fragmentProperties).not.toHaveProperty('work');
    expect(fragmentProperties).not.toHaveProperty('mood');
    const storyFragmentProperties = (getPersonalForecastResponseSchema('week').properties.fragments as {
      items: { properties: Record<string, unknown> };
    }).items.properties;
    expect(storyFragmentProperties).not.toHaveProperty('presentation_style');
    expect(PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS).toBe(2);
  });

  test('sends Luna only raw birth details, period, and anti-repeat history', () => {
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'en',
      period: 'month',
      window: resolvePersonalForecastWindow('month', '2026-08', 'Europe/Moscow'),
      profile: profile as never,
      astrologerBrief: {
        tone: 'favorable', coreForecast: 'новые впечатления', secondaryForecast: 'живые знакомства', distinctiveDetail: 'новое место', opportunity: 'выйти за привычный маршрут', friction: 'не забивать всё заранее', likelyResult: 'новое впечатление останется', briefSignature: 'test-brief',
      },
      recentForecasts: [{
        periodKey: '2026-07',
        fragments: [{ text: 'A recently used central thought.', semanticFingerprint: null }],
      }],
    });
    expect(prompt).toContain('"selected_period"');
    expect(prompt).toContain('"personal_profile"');
    expect(prompt).toContain('"name": "Mira"');
    expect(prompt).toContain('"birth_date": "1990-01-01"');
    expect(prompt).toContain('"birth_time": "12:00"');
    expect(prompt).toContain('"birth_place": "Moscow"');
    expect(prompt).toContain('"anti_repeat_context"');
    expect(prompt).toContain('A recently used central thought.');
    expect(prompt).not.toContain('"rejected_draft"');
    expect(prompt).not.toContain('saved_natal_context');
    expect(prompt).toContain('birth_timezone');
    expect(prompt).not.toContain('positions');
    expect(prompt).not.toContain('houses');
    expect(prompt).not.toContain('aspects');
    expect(prompt).not.toContain('story_direction');
    expect(prompt).not.toContain('Editorial plan');
    expect(prompt).not.toContain('a choice that makes more room');
    expect(prompt).not.toContain('transit_planet');
  });

  test('keeps output budgets bounded and allows one repair attempt', () => {
    expect(getPersonalForecastWriterMaxOutputTokens('day')).toBe(1_000);
    expect(getPersonalForecastWriterMaxOutputTokens('week')).toBe(1_000);
    expect(getPersonalForecastWriterMaxOutputTokens('month')).toBe(1_400);
    expect(getPersonalForecastWriterMaxOutputTokens('month', true)).toBe(1_800);
    expect(PERSONAL_FORECAST_WORD_LIMITS.day).toBe(90);
  });

  test('ships diverse Russian few-shot references for every personal period', () => {
    expect(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU).toHaveLength(10);
    expect(new Set(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.map((example) => example.period)))
      .toEqual(new Set(['day', 'week', 'month']));
    expect(new Set(PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.map((example) => example.tone)))
      .toEqual(new Set(['bright', 'steady', 'challenging']));
    for (const period of ['day', 'week', 'month'] as const) {
      const examples = PERSONAL_FORECAST_REFERENCE_EXAMPLES_RU.filter(
        (example) => example.period === period,
      );
      expect(examples).toHaveLength(period === 'day' ? 4 : 3);
      expect(renderPersonalForecastReferenceExamples('ru', period)).toContain(
        '<forecast_example_input>',
      );
      for (const example of examples) {
        const headlineWords = example.output.headline.trim().split(/\s+/u);
        expect(headlineWords.length).toBeGreaterThanOrEqual(2);
        expect(headlineWords.length).toBeLessThanOrEqual(5);
        expect(example.output.forecast).toBeTruthy();
        expect(example.output.takeaway).toBeTruthy();
        expect(example.output.do).toBeTruthy();
        expect(example.output.dont).toMatch(/^Не\s+/u);
        expect(example.output.closing).toBeTruthy();
      }
    }
    const dayReferences = renderPersonalForecastReferenceExamples('ru', 'day');
    expect(dayReferences).toContain('День твой. Забирай.');
    expect(dayReferences).toContain('Сегодня можно наглеть.');
    expect(dayReferences).toContain('Удача вышла на смену.');
    expect(dayReferences).toContain('<forecast_example_input>');
    expect(dayReferences).not.toContain('Неделя даёт разгон.');
    expect(dayReferences).not.toContain('"tone"');
    expect(renderPersonalForecastReferenceExamples('en', 'day')).toBe('');
  });

  test.each([4, 5, 6])('accepts Today with %s ordered fragments', (count) => {
    expect(validateFreeGeneratedForecastFeed(
      validPayload('day', count),
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'en' },
    ).errors).toEqual([]);
  });

  test('accepts one meaningful pull quote and one short paper note inside Today', () => {
    const payload = validPayload('day', 5);
    payload.fragments = [
      generatedFragment(1, `${words(27, 'proseone')} conversation`),
      generatedFragment(2, words(12, 'quote'), 'pull_quote'),
      generatedFragment(3, words(28, 'prosetwo')),
      generatedFragment(4, words(8, 'note'), 'paper_note'),
      generatedFragment(5, words(16, 'prosethree')),
    ];

    expect(validateFreeGeneratedForecastFeed(
      payload,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'en' },
    ).errors).toEqual([]);
  });

  test('allows a positive Today without a forced human situation and requires a closing', () => {
    const noAdvice = validPayload('day');
    noAdvice.closing.advice_key = '';
    expect(validateFreeGeneratedForecastFeed(
      noAdvice,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'en' },
    ).errors.join(' ')).toContain('closing requires valid visible text');

    const abstract = validPayload('day');
    abstract.fragments = abstract.fragments.map((fragment, index) => ({
      ...fragment,
      text: words(22, `abstract${index + 1}word`),
    }));
    expect(validateFreeGeneratedForecastFeed(
      abstract,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'en' },
    ).errors).toEqual([]);
  });

  test.each(['week', 'month'] as const)(
    'requires the practical closing for the %s story too',
    (period) => {
      const payload = validPayload(period);
      payload.closing.advice_key = '';
      expect(validateFreeGeneratedForecastFeed(
        payload,
        new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
        period,
        { language: 'en' },
      ).errors.join(' ')).toContain('closing requires valid visible text');
    },
  );

  test('requires a separate visible closing, not only hidden advice metadata', () => {
    const payload = validPayload('day');
    payload.closing.text = '';

    expect(validateFreeGeneratedForecastFeed(
      payload,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'en' },
    ).errors.join(' ')).toContain('closing requires valid visible text');
  });

  test.each([
    ['Не отвечай сгоряча.', 'avoidance'],
    ['Дай себе вечер без задач.', 'action'],
    ['Отдохни.', 'action'],
    ['Сбавь темп.', 'action'],
    ['Выдохни и вернись к разговору.', 'action'],
  ] as const)('accepts natural Russian closing forms without a verb whitelist: %s', (closing, kind) => {
    const payload = validPayload('day');
    payload.closing = {
      text: closing,
      kind,
      advice_key: 'короткая практичная концовка',
      evidence_ids: [PERSONAL_FORECAST_PROFILE_EVIDENCE_ID],
    };

    expect(validateFreeGeneratedForecastFeed(
      payload,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      {},
    ).errors).toEqual([]);
  });

  test('rejects a duplicated closing and keeps it out of a special-style fragment', () => {
    const duplicated = validPayload('day');
    duplicated.fragments.at(-1)!.text = `${words(14, 'closingbodyword')}. Choose one clear action.`;
    expect(validateFreeGeneratedForecastFeed(
      duplicated,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'en' },
    ).errors.join(' ')).toContain('closing duplicates the final story body');

    const special = validPayload('day');
    special.fragments.at(-1)!.presentation_style = 'paper_note';
    expect(validateFreeGeneratedForecastFeed(
      special,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'en' },
    ).errors.join(' ')).toContain('Today final fragment requires prose presentation');
  });

  test('accepts 2–5-word forecast openings and rejects longer or empty hooks', () => {
    for (const headline of ['Your move', 'Today is yours to take']) {
      const payload = validPayload('day');
      payload.headline.text = headline;
      expect(validateFreeGeneratedForecastFeed(
        payload,
        new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
        'day',
        { language: 'en' },
      ).errors).toEqual([]);
    }

    for (const headline of ['Go', 'This opening phrase is much too long']) {
      const payload = validPayload('day');
      payload.headline.text = headline;
      expect(validateFreeGeneratedForecastFeed(
        payload,
        new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
        'day',
        { language: 'en' },
      ).errors.join(' ')).toContain('headline has');
    }
  });

  test('rejects invalid Today presentation mixes and special-fragment lengths', () => {
    const cases = [
      {
        label: 'first fragment is prose',
        payload: (() => {
          const value = validPayload('day');
          value.fragments[0].presentation_style = 'pull_quote';
          value.fragments[0].text = `${words(11, 'openingquote')} conversation`;
          return value;
        })(),
        error: 'Today first fragment requires prose presentation',
      },
      {
        label: 'minimum prose',
        payload: (() => {
          const value = validPayload('day', 4);
          value.fragments = [
            generatedFragment(1, words(30, 'prose')),
            generatedFragment(2, words(16, 'quotea'), 'pull_quote'),
            generatedFragment(3, words(12, 'note'), 'paper_note'),
            generatedFragment(4, words(30, 'quoteb'), 'pull_quote'),
          ];
          return value;
        })(),
        error: 'at least 2 prose',
      },
      {
        label: 'maximum pull quote',
        payload: (() => {
          const value = validPayload('day');
          value.fragments[0].presentation_style = 'pull_quote';
          value.fragments[0].text = words(14, 'quoteone');
          value.fragments[1].presentation_style = 'pull_quote';
          value.fragments[1].text = words(14, 'quotetwo');
          return value;
        })(),
        error: 'at most 1 pull_quote',
      },
      {
        label: 'maximum paper note',
        payload: (() => {
          const value = validPayload('day');
          value.fragments[0].presentation_style = 'paper_note';
          value.fragments[0].text = words(8, 'noteone');
          value.fragments[1].presentation_style = 'paper_note';
          value.fragments[1].text = words(8, 'notetwo');
          return value;
        })(),
        error: 'at most 1 paper_note',
      },
      {
        label: 'short pull quote',
        payload: (() => {
          const value = validPayload('day');
          value.fragments[0].presentation_style = 'pull_quote';
          value.fragments[0].text = words(5, 'shortquote');
          return value;
        })(),
        error: 'pull_quote 1 has 5 words; expected 6-18',
      },
      {
        label: 'long pull quote',
        payload: (() => {
          const value = validPayload('day');
          value.fragments[0].presentation_style = 'pull_quote';
          value.fragments[0].text = words(19, 'longquote');
          return value;
        })(),
        error: 'pull_quote 1 has 19 words; expected 6-18',
      },
      {
        label: 'short paper note',
        payload: (() => {
          const value = validPayload('day');
          value.fragments[0].presentation_style = 'paper_note';
          value.fragments[0].text = words(3, 'shortnote');
          return value;
        })(),
        error: 'paper_note 1 has 3 words; expected 4-12',
      },
      {
        label: 'long paper note',
        payload: (() => {
          const value = validPayload('day');
          value.fragments[0].presentation_style = 'paper_note';
          value.fragments[0].text = words(13, 'longnote');
          return value;
        })(),
        error: 'paper_note 1 has 13 words; expected 4-12',
      },
    ];

    for (const { payload, error } of cases) {
      expect(validateFreeGeneratedForecastFeed(
        payload,
        new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
        'day',
        { language: 'en' },
      ).errors.join(' ')).toContain(error);
    }
  });

  test('rejects missing and unknown presentation metadata', () => {
    const missing = validPayload('day') as ReturnType<typeof validPayload> & {
      fragments: Array<ReturnType<typeof generatedFragment> & { presentation_style?: string }>;
    };
    delete (missing.fragments[0] as { presentation_style?: string }).presentation_style;
    const unknown = validPayload('day');
    unknown.fragments[0].presentation_style = 'banner' as 'prose';

    for (const payload of [missing, unknown]) {
      expect(validateFreeGeneratedForecastFeed(
        payload,
        new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
        'day',
        { language: 'en' },
      ).errors.join(' ')).toContain('invalid presentation_style');
    }
  });

  test.each([3, 7])('rejects Today with %s fragments', (count) => {
    expect(validateFreeGeneratedForecastFeed(
      validPayload('day', count),
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'en' },
    ).errors.join(' ')).toContain('Today requires 4-6 fragments');
  });

  test.each(['week', 'month'] as const)('accepts one cohesive %s fragment only', (period) => {
    expect(validateFreeGeneratedForecastFeed(
      validPayload(period),
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      period,
      { language: 'en' },
    ).errors).toEqual([]);
    expect(validateFreeGeneratedForecastFeed(
      validPayload(period, 2),
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      period,
      { language: 'en' },
    ).errors.join(' ')).toContain(`${period} requires exactly one fragment`);

    const styled = validPayload(period);
    styled.fragments[0].presentation_style = 'pull_quote';
    styled.fragments[0].text = words(period === 'week' ? 82 : 105, 'styled');
    expect(validateFreeGeneratedForecastFeed(
      styled,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      period,
      { language: 'en' },
    ).errors.join(' ')).toContain(`${period} fragments do not use presentation_style`);
  });

  test.each([
    ['forecast pseudo-psychology', 'Твой ресурс и проявленность входят в поток.'],
    ['forecast coaching', 'Прислушайся к себе и позволь себе быть в моменте.'],
    ['mysticism', 'Вселенная подаёт тебе сакральный знак.'],
    ['mystical astrology', 'Звёзды обещают тебе удачу.'],
    ['event guarantee', 'Ты обязательно получишь повышение.'],
    ['unconditional invented event', 'Сегодня тебе позвонит старый знакомый.'],
    ['invented biography', 'Ты работаешь бухгалтером и уже устал от отчётов.'],
    ['invented relative', 'Твоя дочь сегодня неожиданно поддержит тебя.'],
    ['medical claim', 'Твои симптомы указывают на мигрень, начни лечение.'],
    ['financial claim', 'Купи акции сейчас: инвестиции гарантируют прибыль.'],
    ['formal Russian address', 'Вы заметите перемены, проверьте детали.'],
    ['visible astrology', 'Меркурий в квадрате к Луне меняет твой день.'],
  ])('rejects %s', (_label, forbiddenText) => {
    const payload = validPayload('day');
    payload.fragments[0].text = `${words(16, 'безопасно')} ${forbiddenText}`;
    const errors = validateFreeGeneratedForecastFeed(
      payload,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'ru' },
    ).errors.join(' ');
    expect(errors).toMatch(/forbidden|banned|unsupported|formal|guarantee|biography|medical|financial|astrology/iu);
  });

  test('rejects a visible category label inside fragment text', () => {
    const payload = validPayload('day');
    payload.fragments[0].text = `Love: ${words(20, 'relationshipword')}`;
    expect(validateFreeGeneratedForecastFeed(
      payload,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'en' },
    ).errors.join(' ')).toContain('visible category label');
  });

  test('rejects a nominally Russian fragment that is mostly English', () => {
    const payload = validPayload('day');
    payload.headline.text = 'Точный прогноз без лишнего шума';
    payload.fragments = payload.fragments.map((fragment, index) => ({
      ...fragment,
      text: `ты ${words(21, `english${index}word`)}`,
    }));
    expect(validateFreeGeneratedForecastFeed(
      payload,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'ru' },
    ).errors.join(' ')).toContain('predominantly Russian');
  });

  test('rejects unknown hidden references', () => {
    const unknown = validPayload('day');
    unknown.headline.evidence_ids = ['profile:unknown'];
    expect(validateFreeGeneratedForecastFeed(
      unknown,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'en' },
    ).errors.join(' ')).toContain('headline requires valid text and existing evidence_ids');
  });

  test('maps incomplete and malformed provider responses to safe diagnostics', () => {
    expect(getPersonalForecastGenerationDiagnosticCode(
      new Error('PERSONAL_FORECAST_WRITER_REQUEST_FAILED:OPENAI_RESPONSE_INCOMPLETE:max_output_tokens'),
    )).toBe('PERSONAL_FORECAST_WRITER_OUTPUT_LIMIT');
    expect(getPersonalForecastGenerationDiagnosticCode(
      new Error('PERSONAL_FORECAST_GENERATION_INVALID:repeated opening'),
    )).toBe('PERSONAL_FORECAST_WRITER_VALIDATION_FAILED');
    expect(getPersonalForecastGenerationDiagnosticCode(
      new Error('PERSONAL_FORECAST_WRITER_REQUEST_FAILED:OPENAI_RESPONSE_REFUSAL'),
    )).toBe('PERSONAL_FORECAST_WRITER_REFUSED');
  });

  test('unwraps fenced and provider-wrapped JSON', () => {
    const payload = { data: validPayload('day') };
    expect(parseGeneratedFeedPayload(`\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``)).toEqual(payload.data);
  });
});
import fs from 'fs';
import crypto from 'crypto';
