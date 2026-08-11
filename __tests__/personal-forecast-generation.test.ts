import {
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
  language: 'en' as const,
};

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(' ');
}

function validPayload(period: 'day' | 'week' | 'month') {
  const paragraphWords = { day: 62, week: 82, month: 105 }[period];
  return {
    phrase: { text: 'Make room for yourself.', evidence_ids: [PERSONAL_FORECAST_PROFILE_EVIDENCE_ID] },
    paragraphs: [{ text: words(paragraphWords), evidence_ids: [PERSONAL_FORECAST_PROFILE_EVIDENCE_ID] }],
  };
}

describe('personal forecast Luna natal-profile writer', () => {
  test('asks for one compact, memorable personal story rather than an evidence report or advice block', () => {
    const system = getPersonalForecastSystemPrompt('en', 'day');
    expect(system).toContain('PERSONAL FORECAST STORY');
    expect(system).toContain('60 to 150 words');
    expect(system).toContain('bold, psychological, and alive');
    expect(system).toContain('one vivid, recognisable moment');
    expect(system).toContain('["profile:personal"]');
    expect(system).not.toContain('Advice is exactly');
    expect(system).not.toContain('visual_cue');
    expect(system).not.toContain('Calculated evidence');
    expect(system).not.toContain('Every statement must be grounded');
  });

  test('gives today, week, and month separate literary jobs without time partitions', () => {
    const day = getPersonalForecastSystemPrompt('en', 'day');
    const week = getPersonalForecastSystemPrompt('en', 'week');
    const month = getPersonalForecastSystemPrompt('en', 'month');
    expect(day).toContain('One day: catch one alive scene');
    expect(week).toContain('One week: describe one behavioural thread');
    expect(month).toContain('One month: tell of a grown-up turn');
    for (const prompt of [day, week, month]) {
      expect(prompt).toContain('never print dates or split the text into time segments');
    }
  });

  test('defines a strict structured response with a hidden profile reference', () => {
    expect(PERSONAL_FORECAST_RESPONSE_SCHEMA).toMatchObject({
      type: 'object',
      required: ['phrase', 'paragraphs'],
      additionalProperties: false,
      properties: {
        phrase: expect.objectContaining({ required: ['text', 'evidence_ids'] }),
      },
    });
    expect(PERSONAL_FORECAST_RESPONSE_SCHEMA.properties).not.toHaveProperty('advice');
    expect(PERSONAL_FORECAST_RESPONSE_SCHEMA.properties).not.toHaveProperty('visual_cue');
  });

  test('passes the saved natal base and editorial rotation, not transit calculations', () => {
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'en',
      period: 'month',
      window: resolvePersonalForecastWindow('month', '2026-08', 'Europe/Moscow'),
      profile: profile as never,
      natalContext: buildPersonalForecastNatalContext(chartFixture),
    });
    expect(prompt).toContain('"natal_profile"');
    expect(prompt).toContain('"sun"');
    expect(prompt).toContain('"story_direction"');
    expect(prompt).not.toContain('"advice_lenses"');
    expect(prompt).not.toContain('Calculated evidence');
    expect(prompt).not.toContain('transit_planet');
    expect(prompt).not.toContain('natal_point');
  });

  test('keeps the monthly request compact enough to avoid incomplete structured output', () => {
    expect(getPersonalForecastWriterMaxOutputTokens('day')).toBe(1_000);
    expect(getPersonalForecastWriterMaxOutputTokens('week')).toBe(1_000);
    expect(getPersonalForecastWriterMaxOutputTokens('month')).toBe(1_400);
    expect(getPersonalForecastWriterMaxOutputTokens('month', true)).toBe(1_800);
  });

  test('uses the stable natal chart as a compact profile rather than selecting transit-touched points', () => {
    const context = buildPersonalForecastNatalContext(chartFixture);
    expect(context).toMatchObject({
      source: 'saved_natal_chart',
      core: {
        sun: { sign: 'Aries' },
        moon: { sign: 'Taurus' },
      },
    });
    expect(context).not.toHaveProperty('positions');
    expect(context).not.toHaveProperty('aspects');
    expect(context).not.toHaveProperty('transits');
  });

  test.each(['day', 'week', 'month'] as const)(
    'accepts a compact %s story with its hidden profile reference',
    (period) => {
      expect(validateFreeGeneratedForecastFeed(
        validPayload(period),
        new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
        period,
      ).errors).toEqual([]);
    },
  );

  test('rejects unknown hidden references, clichés, astrology jargon, and chronological framing', () => {
    const unknown = validPayload('day');
    unknown.phrase.evidence_ids = ['profile:unknown'];
    expect(validateFreeGeneratedForecastFeed(
      unknown,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
    ).errors.join(' ')).toContain('phrase requires valid text and existing evidence_ids');

    const chronological = validPayload('day');
    chronological.paragraphs[0].text = `${words(62)} In the evening the answer arrives.`;
    expect(validateFreeGeneratedForecastFeed(
      chronological,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
    ).errors.join(' ')).toContain('chronological time segment');

    const astrological = validPayload('day');
    astrological.paragraphs[0].text = `${words(62)} Mercury decides the rhythm.`;
    expect(validateFreeGeneratedForecastFeed(
      astrological,
      new Set([PERSONAL_FORECAST_PROFILE_EVIDENCE_ID]),
      'day',
    ).errors.join(' ')).toContain('forbidden astrology term');
  });

  test('maps incomplete and malformed provider responses to safe diagnostics', () => {
    expect(getPersonalForecastGenerationDiagnosticCode(
      new Error('PERSONAL_FORECAST_WRITER_REQUEST_FAILED:OPENAI_RESPONSE_INCOMPLETE:max_output_tokens'),
    )).toBe('PERSONAL_FORECAST_WRITER_OUTPUT_LIMIT');
    expect(getPersonalForecastGenerationDiagnosticCode(
      new Error('PERSONAL_FORECAST_GENERATION_INVALID:unknown evidence'),
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
