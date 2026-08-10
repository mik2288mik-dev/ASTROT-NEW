import {
  PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS,
  buildPersonalForecastFeedPrompt,
  buildPersonalForecastNatalContext,
  getPersonalForecastSystemPrompt,
  parseGeneratedFeedPayload,
  PERSONAL_FORECAST_RESPONSE_SCHEMA,
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
  test('uses one heading-free JSON contract with a bounded narrative and a concrete advice', () => {
    const system = getPersonalForecastSystemPrompt('en', 'day');
    expect(system).toContain('PERSONAL FORECAST TASK');
    expect(system).toContain('100 to 150 words');
    expect(system).toContain('"advice"');
    expect(system).toContain('one concrete action for today');
    expect(system).toContain('Do not generate a headline');
    expect(system).not.toContain('"headline"');
    expect(system).not.toContain('separate task');
    expect(system).not.toContain('Return 2 or 3 sections');
  });

  test('defines a strict output shape before the server validates evidence semantics', () => {
    expect(PERSONAL_FORECAST_RESPONSE_SCHEMA).toMatchObject({
      type: 'object',
      required: ['paragraphs', 'advice'],
      additionalProperties: false,
      properties: {
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
      },
    });
  });

  test('gives every period a distinct narrative job without chronological segments', () => {
    const build = (period: 'day' | 'week' | 'month') => getPersonalForecastSystemPrompt('en', period);
    expect(build('day')).toContain('100 to 150 words');
    expect(build('day')).toContain('current state of one day');
    expect(build('week')).toContain('120 to 165 words');
    expect(build('week')).toContain('one trend that runs through the whole week');
    expect(build('month')).toContain('130 to 175 words');
    expect(build('month')).toContain('one global monthly trend');
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
      paragraphs: [
        { text: words(92), evidence_ids: ['e1'] },
        { text: words(5), evidence_ids: ['e1'] },
      ],
      advice: { text: 'Put the number and condition in writing.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');

    expect(valid.errors).toEqual([]);
    expect(valid.sections).toHaveLength(2);
    expect(valid.sections[0].title).toBeNull();
    expect(valid.sections[0].evidenceIds).toEqual(['e1']);
    expect(valid.sections.map((section) => section.blocks[0].role)).toEqual(['lead', 'action']);
  });

  test('allows concise copy and enforces existing evidence IDs and period-specific total caps', () => {
    const weekAtMinimum = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: words(116), evidence_ids: ['e1'] }],
      advice: { text: 'Choose one priority and protect it.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'week');
    expect(weekAtMinimum.errors).toEqual([]);
    expect(weekAtMinimum.sections).toHaveLength(2);

    const unknownEvidence = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: 'Keep the wording exact.', evidence_ids: ['missing'] }],
      advice: { text: 'Check the details before answering.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(unknownEvidence.errors.join(' ')).toContain('unknown');

    const dayTooLong = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: words(149), evidence_ids: ['e1'] }],
      advice: { text: 'Two words', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(dayTooLong.errors.join(' ')).toContain('maximum for day is 150');

    const weekAtLimit = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: words(163), evidence_ids: ['e1'] }],
      advice: { text: 'Act now', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'week');
    expect(weekAtLimit.errors).toEqual([]);

    const monthTooLong = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: words(174), evidence_ids: ['e1'] }],
      advice: { text: 'Act with purpose', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'month');
    expect(monthTooLong.errors.join(' ')).toContain('maximum for month is 175');
  });

  test('rejects astrology vocabulary anywhere in visible forecast copy', () => {
    const technicalParagraph = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: `${words(91)} Луна в оппозиции к Венере усиливает напряжение.`, evidence_ids: ['e1'] }],
      advice: { text: 'Сохрани спокойный темп.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(technicalParagraph.errors.join(' ')).toContain('astrology term');

    const technicalAdvice = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: words(115), evidence_ids: ['e1'] }],
      advice: { text: 'Use the Mars square carefully.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'week');
    expect(technicalAdvice.errors.join(' ')).toContain('astrology term');

    const zodiacSign = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: `${words(91)} У Рыб начинается новый этап.`, evidence_ids: ['e1'] }],
      advice: { text: 'Запиши первый шаг.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(zodiacSign.errors.join(' ')).toContain('astrology term');
  });

  test('rejects formal or plural Russian address but accepts the app voice on ты', () => {
    const formal = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: `${words(91)} Вам стоит проверить договор и не торопиться.`, evidence_ids: ['e1'] }],
      advice: { text: 'Проверь условие до ответа.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(formal.errors.join(' ')).toContain('formal Russian address');

    const singular = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: `${words(91)} Ты быстрее увидишь суть, если задашь прямой вопрос.`, evidence_ids: ['e1'] }],
      advice: { text: 'Проверь условие до ответа.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(singular.errors).toEqual([]);
  });

  test('requires one concrete advice and rejects chronological framing for every period', () => {
    const dayWithoutAction = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: words(100), evidence_ids: ['e1'] }],
      advice: null,
    }, new Set(['e1']), 'day');
    expect(dayWithoutAction.errors.join(' ')).toContain('day forecast requires one concrete action');

    const dayWithTimeSegment = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: `${words(94)} Вечером лучше не спорить.`, evidence_ids: ['e1'] }],
      advice: { text: 'Оставь разговор до ясного решения.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(dayWithTimeSegment.errors.join(' ')).toContain('chronological time segment');

    const weekWithTimeSegment = validateFreeGeneratedForecastFeed({
      paragraphs: [{
        text: `${words(112)} In the middle of the week, the situation changes.`,
        evidence_ids: ['e1'],
      }],
      advice: { text: 'Keep one clear priority.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'week');
    expect(weekWithTimeSegment.errors.join(' ')).toContain('chronological time segment');

    const monthWithTimeSegment = validateFreeGeneratedForecastFeed({
      paragraphs: [{ text: `${words(122)} В конце месяца темп станет ровнее.`, evidence_ids: ['e1'] }],
      advice: { text: 'Оставь ресурс для главной цели.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'month');
    expect(monthWithTimeSegment.errors.join(' ')).toContain('chronological time segment');

    const monthWithoutAdvice = validateFreeGeneratedForecastFeed({
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
