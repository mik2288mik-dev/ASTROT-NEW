import {
  PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS,
  PERSONAL_FORECAST_PROFILE_EVIDENCE_ID,
  PERSONAL_FORECAST_RESPONSE_SCHEMA,
  PERSONAL_FORECAST_WORD_LIMITS,
  buildPersonalForecastFeedPrompt,
  buildPersonalForecastNatalContext,
  getPersonalForecastGenerationDiagnosticCode,
  getPersonalForecastResponseSchema,
  getPersonalForecastSystemPrompt,
  getPersonalForecastWriterMaxOutputTokens,
  parseGeneratedFeedPayload,
  validateFreeGeneratedForecastFeed,
} from '../lib/personalForecastGeneration';
import { resolvePersonalForecastWindow } from '../lib/personalForecastContract';
import { chartFixture } from './personal-forecast-fixture';

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
    advice_key: index % 2 ? `advice ${index}` : '',
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
      const fragment = generatedFragment(
        index + 1,
        index === 0 && period === 'day'
          ? `${words(fragmentWords - 1, `fragment${index + 1}word`)} conversation`
          : words(fragmentWords, `fragment${index + 1}word`),
      );
      if (period !== 'day') delete fragment.presentation_style;
      return fragment;
    }),
  };
}

describe('personal forecast Luna personal-feed writer', () => {
  test('defines a forecast-specific voice and a continuous Today feed', () => {
    const system = getPersonalForecastSystemPrompt('en', 'day');
    expect(system).toContain('PERSONAL FORECAST WRITER');
    expect(system).toContain('4 to 6 sequential text fragments');
    expect(system).toContain('intelligent acquaintance');
    expect(system.toLowerCase()).toContain('occasional irony or one unexpected comparison');
    expect(system).toContain('not a stand-up comedian');
    expect(system).toContain('no visible categories');
    expect(system).toContain('conversation, message, request, decision, agreement');
    expect(system).toContain('Advice is optional');
    expect(system).toContain('presentation_style is hidden metadata');
    expect(system).toContain('first main fragment must be prose');
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
      required: ['headline', 'fragments'],
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
      },
    });
    const fragmentProperties = (PERSONAL_FORECAST_RESPONSE_SCHEMA.properties.fragments as {
      items: { properties: Record<string, unknown> };
    }).items.properties;
    expect(fragmentProperties.presentation_style).toEqual({
      type: 'string',
      enum: ['prose', 'pull_quote', 'paper_note'],
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

  test('builds primarily from saved personal/natal context, period, and anti-repeat history', () => {
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'en',
      period: 'month',
      window: resolvePersonalForecastWindow('month', '2026-08', 'Europe/Moscow'),
      profile: profile as never,
      natalContext: buildPersonalForecastNatalContext(chartFixture),
      recentForecasts: [{
        periodKey: '2026-07',
        fragments: [{ text: 'A recently used central thought.', semanticFingerprint: null }],
      }],
    });
    expect(prompt).toContain('"selected_period"');
    expect(prompt).toContain('"saved_natal_context"');
    expect(prompt).toContain('"birth_time": "12:00"');
    expect(prompt).toContain('"birth_place": "Moscow"');
    expect(prompt).toContain('"anti_repeat_context"');
    expect(prompt).toContain('A recently used central thought.');
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
    expect(PERSONAL_FORECAST_WORD_LIMITS.day).toBe(150);
  });

  test('uses the saved natal chart, including stored aspects, without period calculations', () => {
    const context = buildPersonalForecastNatalContext({
      ...chartFixture,
      aspects: [{ type: 'trine', angle: 120, orb: 1.2, from: 'Sun', to: 'Moon' }],
    });
    expect(context).toMatchObject({
      source: 'saved_natal_chart',
      positions: {
        sun: { sign: 'Aries' },
        moon: { sign: 'Taurus' },
        jupiter: { sign: 'Leo' },
      },
      aspects: [expect.objectContaining({ from: 'Sun', to: 'Moon', type: 'trine' })],
    });
    expect(context).not.toHaveProperty('transits');
    expect(context).not.toHaveProperty('period_aspects');
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
      generatedFragment(5, words(20, 'prosethree')),
    ];

    expect(validateFreeGeneratedForecastFeed(
      payload,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'en' },
    ).errors).toEqual([]);
  });

  test('requires a recognisable human situation but never requires advice', () => {
    const noAdvice = validPayload('day');
    noAdvice.fragments = noAdvice.fragments.map((fragment) => ({
      ...fragment,
      advice_key: '',
    }));
    expect(validateFreeGeneratedForecastFeed(
      noAdvice,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
      { language: 'en' },
    ).errors).toEqual([]);

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
    ).errors.join(' ')).toContain('recognisable human situation');
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
