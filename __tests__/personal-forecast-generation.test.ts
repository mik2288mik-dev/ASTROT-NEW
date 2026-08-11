import {
  PERSONAL_FORECAST_MAX_PROMPT_EVIDENCE,
  PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS,
  buildPersonalForecastFeedPrompt,
  buildPersonalForecastNatalContext,
  getPersonalForecastWriterMaxOutputTokens,
  getPersonalForecastGenerationDiagnosticCode,
  getPersonalForecastSystemPrompt,
  parseGeneratedFeedPayload,
  PERSONAL_FORECAST_RESPONSE_SCHEMA,
  selectPersonalForecastPromptEvidence,
  validateFreeGeneratedForecastFeed,
} from '../lib/personalForecastGeneration';
import { resolvePersonalForecastWindow } from '../lib/personalForecastContract';
import { chartFixture } from './personal-forecast-fixture';

const evidence = [{
  id: 'e1',
  kind: 'transit_to_natal' as const,
  transitPlanet: 'mars',
  natalPoint: 'venus',
  aspect: 'square',
  house: 2,
  orb: 1.2,
  status: 'applying' as const,
  exactAt: '2026-08-02T12:00:00.000Z',
  startsAt: '2026-08-02T00:00:00.000Z',
  endsAt: '2026-08-02T23:59:59.999Z',
  strength: 88,
  polarity: 'challenging' as const,
  calculationSource: 'Swiss Ephemeris',
}];

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index + 1}`).join(' ');
}

describe('personal forecast concise direct-evidence writer', () => {
  test('uses a short evidence-backed phrase, bounded narrative, and concrete advice', () => {
    const system = getPersonalForecastSystemPrompt('en', 'day');
    expect(system).toContain('PERSONAL FORECAST TASK');
    expect(system).toContain('60 to 95 words');
    expect(system).toContain('headline of 3 to 8 words');
    expect(system).toContain('small, recognisable personal scene');
    expect(system).toContain('"advice"');
    expect(system).toContain('one small action you can finish today');
    expect(system).not.toContain('"headline"');
    expect(system).not.toContain('separate task');
    expect(system).not.toContain('Return 2 or 3 sections');
  });

  test('defines a strict output shape before the server validates evidence semantics', () => {
    expect(PERSONAL_FORECAST_RESPONSE_SCHEMA).toMatchObject({
      type: 'object',
      required: ['phrase', 'paragraphs', 'advice', 'visual_cue'],
      additionalProperties: false,
      properties: {
        phrase: expect.objectContaining({
          required: ['text', 'evidence_ids'],
          additionalProperties: false,
        }),
        paragraphs: {
          type: 'array',
          items: expect.objectContaining({
            required: ['text', 'evidence_ids'],
            additionalProperties: false,
          }),
        },
        advice: expect.objectContaining({
          required: ['text', 'evidence_ids'],
          additionalProperties: false,
        }),
        visual_cue: expect.objectContaining({
          required: ['key', 'evidence_ids'],
          additionalProperties: false,
        }),
      },
    });
  });

  test('gives every period a distinct narrative job without chronological segments', () => {
    const build = (period: 'day' | 'week' | 'month') => getPersonalForecastSystemPrompt('en', period);
    expect(build('day')).toContain('60 to 95 words');
    expect(build('day')).toContain('current state of one day');
    expect(build('week')).toContain('80 to 120 words');
    expect(build('week')).toContain('one trend that runs through the whole week');
    expect(build('month')).toContain('100 to 145 words');
    expect(build('month')).toContain('one global monthly trend');
    expect(build('day')).toContain('one small action you can finish today');
    expect(build('week')).toContain('reusable rule for the week');
    expect(build('month')).toContain('one meaningful commitment for the month');
    for (const period of ['day', 'week', 'month'] as const) {
      expect(build(period)).toContain('Never divide the forecast into time segments');
      expect(build(period)).toContain('morning, afternoon, evening');
      expect(build(period)).toContain('beginning, middle, or end of the period');
    }
  });

  test('keeps the user-facing copy free of astrology terms and formal Russian address', () => {
    const system = getPersonalForecastSystemPrompt('ru', 'day');
    expect(system).toContain('только на «ты»');
    expect(system).toContain('Названия планет');
    expect(system).toContain('будут отклонены проверкой');
  });

  test('sends factual Swiss evidence without semantic interpretation fields', () => {
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'en',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-02', 'Europe/Moscow'),
      calculatedEvidence: evidence,
      natalContext: { positions: [{ key: 'venus', sign: 'Aries', degree: 10 }] },
      canonicalNatalReport: { DominantPatterns: ['legacy'] },
    });

    expect(prompt).toContain('Calculated evidence:');
    expect(prompt).toContain('"id": "e1"');
    expect(prompt).toContain('"transit_planet": "mars"');
    expect(prompt).toContain('"natal_point": "venus"');
    expect(prompt).toContain('"house": 2');
    expect(prompt).toContain('"positions"');
    expect(prompt).not.toContain('"polarity"');
    expect(prompt).not.toContain('DominantPatterns');
    expect(prompt).not.toContain('meaning_seed');
    expect(PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS).toBe(2);
  });

  test('bounds a monthly writer prompt while preserving the strongest evidence kinds', () => {
    const repeatedAspects = Array.from({ length: 30 }, (_, index) => ({
      ...evidence[0],
      id: `aspect-${index}`,
      strength: 100 - index,
      exactAt: `2026-08-${String((index % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
    }));
    const diverseEvidence = [
      ...repeatedAspects,
      {
        ...evidence[0],
        id: 'station-strong',
        kind: 'station' as const,
        transitPlanet: 'mercury',
        natalPoint: null,
        aspect: null,
        house: null,
        orb: null,
        strength: 75,
      },
      {
        ...evidence[0],
        id: 'ingress-strong',
        kind: 'ingress' as const,
        transitPlanet: 'venus',
        natalPoint: null,
        aspect: null,
        house: 5,
        orb: null,
        strength: 74,
      },
    ];

    const selected = selectPersonalForecastPromptEvidence(diverseEvidence, 'month');

    expect(selected).toHaveLength(PERSONAL_FORECAST_MAX_PROMPT_EVIDENCE.month);
    expect(selected.map((item) => item.id)).toEqual(expect.arrayContaining([
      'aspect-0',
      'station-strong',
      'ingress-strong',
    ]));

    const prompt = buildPersonalForecastFeedPrompt({
      language: 'en',
      period: 'month',
      window: resolvePersonalForecastWindow('month', '2026-08', 'Europe/Moscow'),
      calculatedEvidence: diverseEvidence,
      natalContext: {},
    });
    expect(prompt.match(/"id":/g)).toHaveLength(PERSONAL_FORECAST_MAX_PROMPT_EVIDENCE.month);
  });

  test('maps writer failures to a safe, actionable diagnostic code', () => {
    expect(getPersonalForecastGenerationDiagnosticCode(
      new Error('PERSONAL_FORECAST_GENERATION_INVALID:contains chronological time segment'),
    )).toBe('PERSONAL_FORECAST_WRITER_VALIDATION_FAILED');
    expect(getPersonalForecastGenerationDiagnosticCode(
      new Error('PERSONAL_FORECAST_WRITER_REQUEST_FAILED:OPENAI_RESPONSE_INCOMPLETE:max_output_tokens'),
    )).toBe('PERSONAL_FORECAST_WRITER_OUTPUT_LIMIT');
  });

  test('gives the monthly strict writer enough room and escalates after an incomplete reply', () => {
    expect(getPersonalForecastWriterMaxOutputTokens('day')).toBe(1_200);
    expect(getPersonalForecastWriterMaxOutputTokens('week')).toBe(1_200);
    expect(getPersonalForecastWriterMaxOutputTokens('month')).toBe(3_000);
    expect(getPersonalForecastWriterMaxOutputTokens('month', true)).toBe(4_000);
  });

  test('passes only natal points touched by the period evidence', () => {
    const context = buildPersonalForecastNatalContext(chartFixture, evidence) as {
      birth_time_quality: string;
      positions: Array<{ key: string }>;
      angles: Array<{ key: string }>;
      aspects?: unknown[];
      houses?: unknown[];
    };

    expect(context.birth_time_quality).toBeTruthy();
    expect(context.positions.map((position) => position.key)).toEqual(['venus']);
    expect(context.angles).toEqual([]);
    expect(context.aspects).toBeUndefined();
    expect(context.houses).toBeUndefined();
  });

  test('accepts a grounded reading and optional advice from the same payload', () => {
    const valid = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Clear room, clear choice.', evidence_ids: ['e1'] },
      visual_cue: { key: 'decisions', evidence_ids: ['e1'] },
      paragraphs: [
        { text: words(55), evidence_ids: ['e1'] },
        { text: words(5), evidence_ids: ['e1'] },
      ],
      advice: { text: 'Put the number and condition in writing.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');

    expect(valid.errors).toEqual([]);
    expect(valid.sections).toHaveLength(2);
    expect(valid.sections[0].title).toBe('Clear room, clear choice.');
    expect(valid.sections[0].visualCue).toBe('decisions');
    expect(valid.sections[0].evidenceIds).toEqual(['e1']);
    expect(valid.sections.map((section) => section.blocks[0].role)).toEqual(['lead', 'action']);
  });

  test('allows concise copy and enforces existing evidence IDs and period-specific total caps', () => {
    const weekAtMinimum = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Clear work, calmer choices.', evidence_ids: ['e1'] },
      paragraphs: [{ text: words(72), evidence_ids: ['e1'] }],
      advice: { text: 'Choose one priority and protect it.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'week');
    expect(weekAtMinimum.errors).toEqual([]);
    expect(weekAtMinimum.sections).toHaveLength(2);

    const unknownEvidence = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [{ text: 'Keep the wording exact.', evidence_ids: ['missing'] }],
      advice: { text: 'Check the details before answering.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(unknownEvidence.errors.join(' ')).toContain('unknown');

    const missingPhrase = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: words(100), evidence_ids: ['e1'] }],
      advice: { text: 'Take one clear step.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(missingPhrase.errors.join(' ')).toContain('phrase requires valid text');

    const tooManyParagraphs = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [
        { text: words(31), evidence_ids: ['e1'] },
        { text: words(31), evidence_ids: ['e1'] },
        { text: words(31), evidence_ids: ['e1'] },
      ],
      advice: { text: 'Take one clear step.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(tooManyParagraphs.errors.join(' ')).toContain('maximum for day is 2');

    const dayTooLong = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [{ text: words(90), evidence_ids: ['e1'] }],
      advice: { text: 'Take one clear step.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(dayTooLong.errors.join(' ')).toContain('maximum for day is 95');

    const weekAtLimit = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Clear work, calmer choices.', evidence_ids: ['e1'] },
      paragraphs: [{ text: words(110), evidence_ids: ['e1'] }],
      advice: { text: 'Choose one priority and protect it.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'week');
    expect(weekAtLimit.errors).toEqual([]);

    const monthTooLong = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Choose the horizon carefully.', evidence_ids: ['e1'] },
      paragraphs: [{ text: words(140), evidence_ids: ['e1'] }],
      advice: { text: 'Act with purpose now.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'month');
    expect(monthTooLong.errors.join(' ')).toContain('maximum for month is 145');
  });

  test('rejects the report-like filler that made the reading feel generic', () => {
    const generic = validateFreeGeneratedForecastFeed({
      phrase: { text: 'A sharper way forward.', evidence_ids: ['e1'] },
      paragraphs: [{
        text: `${words(54)} The period brings your visibility and external realisation to the foreground.`,
        evidence_ids: ['e1'],
      }],
      advice: { text: 'Write the decision in one plain sentence.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');

    expect(generic.errors.join(' ')).toContain('banned filler phrase');
  });

  test('rejects astrology vocabulary anywhere in visible forecast copy', () => {
    const technicalParagraph = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [{ text: `${words(91)} Луна в оппозиции к Венере усиливает напряжение.`, evidence_ids: ['e1'] }],
      advice: { text: 'Сохрани спокойный темп.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(technicalParagraph.errors.join(' ')).toContain('astrology term');

    const technicalAdvice = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [{ text: words(115), evidence_ids: ['e1'] }],
      advice: { text: 'Use the Mars square carefully.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'week');
    expect(technicalAdvice.errors.join(' ')).toContain('astrology term');

    const zodiacSign = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [{ text: `${words(91)} У Рыб начинается новый этап.`, evidence_ids: ['e1'] }],
      advice: { text: 'Запиши первый шаг.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(zodiacSign.errors.join(' ')).toContain('astrology term');
  });

  test('rejects formal or plural Russian address but accepts the app voice on ты', () => {
    const formal = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [{ text: `${words(91)} Вам стоит проверить договор и не торопиться.`, evidence_ids: ['e1'] }],
      advice: { text: 'Проверь условие до ответа.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(formal.errors.join(' ')).toContain('formal Russian address');

    const singular = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [{ text: `${words(79)} Ты быстрее увидишь суть, если задашь прямой вопрос.`, evidence_ids: ['e1'] }],
      advice: { text: 'Проверь условие до ответа.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(singular.errors).toEqual([]);
  });

  test('requires one concrete advice and rejects chronological framing for every period', () => {
    const dayWithoutAction = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [{ text: words(100), evidence_ids: ['e1'] }],
      advice: null,
    }, new Set(['e1']), 'day');
    expect(dayWithoutAction.errors.join(' ')).toContain('day forecast requires one concrete action');

    const dayWithTimeSegment = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [{ text: `${words(94)} Вечером лучше не спорить.`, evidence_ids: ['e1'] }],
      advice: { text: 'Оставь разговор до ясного решения.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(dayWithTimeSegment.errors.join(' ')).toContain('chronological time segment');

    const weekWithTimeSegment = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [{
        text: `${words(112)} In the middle of the week, the situation changes.`,
        evidence_ids: ['e1'],
      }],
      advice: { text: 'Keep one clear priority.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'week');
    expect(weekWithTimeSegment.errors.join(' ')).toContain('chronological time segment');

    const monthWithTimeSegment = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [{ text: `${words(122)} В конце месяца темп станет ровнее.`, evidence_ids: ['e1'] }],
      advice: { text: 'Оставь ресурс для главной цели.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'month');
    expect(monthWithTimeSegment.errors.join(' ')).toContain('chronological time segment');

    const monthWithoutAdvice = validateFreeGeneratedForecastFeed({
      phrase: { text: 'Keep the focus honest.', evidence_ids: ['e1'] },
      paragraphs: [{ text: words(130), evidence_ids: ['e1'] }],
      advice: null,
    }, new Set(['e1']), 'month');
    expect(monthWithoutAdvice.errors.join(' ')).toContain('month forecast requires one concrete action');
  });

  test('unwraps fenced and provider-wrapped JSON responses', () => {
    const payload = { data: {
      paragraphs: [{ text: 'A reply needs a second look.', evidence_ids: ['e1'] }],
      advice: { text: 'State the condition clearly.', evidence_ids: ['e1'] },
    } };
    const parsed = parseGeneratedFeedPayload(`\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``);
    expect(parsed).toEqual(payload.data);
  });
});
