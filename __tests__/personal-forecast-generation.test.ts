import {
  PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS,
  PERSONAL_FORECAST_PROFILE_EVIDENCE_ID,
  PERSONAL_FORECAST_RESPONSE_SCHEMA,
  buildPersonalForecastFeedPrompt,
  buildPersonalForecastNatalContext,
  getPersonalForecastGenerationDiagnosticCode,
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

function generatedFragment(index: number, text = words(22, `fragment${index}word`)) {
  return {
    text,
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
    fragments: Array.from({ length: count }, (_, index) => generatedFragment(
      index + 1,
      words(fragmentWords, `fragment${index + 1}word`),
    )),
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
    expect(fragmentProperties).not.toHaveProperty('category');
    expect(fragmentProperties).not.toHaveProperty('title');
    expect(fragmentProperties).not.toHaveProperty('love');
    expect(fragmentProperties).not.toHaveProperty('work');
    expect(fragmentProperties).not.toHaveProperty('mood');
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
