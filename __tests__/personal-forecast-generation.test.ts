import {
  PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS,
  buildPersonalForecastFeedPrompt,
  buildPersonalForecastNatalContext,
  getPersonalForecastSystemPrompt,
  parseGeneratedFeedPayload,
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
  test('uses one compact JSON contract and treats the word cap as a maximum, not a target', () => {
    const system = getPersonalForecastSystemPrompt('en', 'day');
    expect(system).toContain('PERSONAL FORECAST TASK');
    expect(system).toContain('maximum of 150 words');
    expect(system).toContain('This is a ceiling, not a target');
    expect(system).toContain('"advice"');
    expect(system).toContain('one useful action');
    expect(system).not.toContain('separate task');
    expect(system).not.toContain('Return 2 or 3 sections');
  });

  test('gives every period its own job and maximum word count', () => {
    const build = (period: 'day' | 'week' | 'month') => getPersonalForecastSystemPrompt('en', period);
    expect(build('day')).toContain('maximum of 150 words');
    expect(build('day')).toContain('main course of the day');
    expect(build('day')).toContain('one useful action');
    expect(build('week')).toContain('maximum of 165 words');
    expect(build('week')).toContain('coherent dynamic of the week');
    expect(build('week')).toContain('turning point');
    expect(build('week')).toContain('Never split the week into a day-by-day list');
    expect(build('month')).toContain('maximum of 175 words');
    expect(build('month')).toContain('two meaningful phases');
    expect(build('month')).toContain('one strategic conclusion');
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
      headline: 'Check the terms twice',
      paragraphs: [
        { text: 'The agreement needs precision before speed.', evidence_ids: ['e1'] },
        { text: 'A direct question clears more than a confident guess.', evidence_ids: ['e1'] },
      ],
      advice: { text: 'Put the number and condition in writing.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');

    expect(valid.errors).toEqual([]);
    expect(valid.sections).toHaveLength(2);
    expect(valid.sections[0].title).toBe('Check the terms twice');
    expect(valid.sections[0].evidenceIds).toEqual(['e1']);
    expect(valid.sections.map((section) => section.blocks[0].role)).toEqual(['lead', 'action']);
  });

  test('allows concise copy and enforces existing evidence IDs and period-specific total caps', () => {
    const noAdvice = validateFreeGeneratedForecastFeed({
      headline: 'Clear terms win',
      paragraphs: [{ text: 'A compact factual reading.', evidence_ids: ['e1'] }],
      advice: null,
    }, new Set(['e1']), 'week');
    expect(noAdvice.errors).toEqual([]);
    expect(noAdvice.sections).toHaveLength(1);

    const unknownEvidence = validateFreeGeneratedForecastFeed({
      headline: 'Clear terms win',
      paragraphs: [{ text: 'Keep the wording exact.', evidence_ids: ['missing'] }],
      advice: null,
    }, new Set(['e1']), 'day');
    expect(unknownEvidence.errors.join(' ')).toContain('unknown');

    const dayTooLong = validateFreeGeneratedForecastFeed({
      headline: 'Three word headline',
      paragraphs: [{ text: words(146), evidence_ids: ['e1'] }],
      advice: { text: 'Two words', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(dayTooLong.errors.join(' ')).toContain('maximum for day is 150');

    const weekAtLimit = validateFreeGeneratedForecastFeed({
      headline: 'Weekly direction',
      paragraphs: [{ text: words(161), evidence_ids: ['e1'] }],
      advice: { text: 'Act now', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'week');
    expect(weekAtLimit.errors).toEqual([]);

    const monthTooLong = validateFreeGeneratedForecastFeed({
      headline: 'Monthly direction',
      paragraphs: [{ text: words(172), evidence_ids: ['e1'] }],
      advice: { text: 'Act with purpose', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'month');
    expect(monthTooLong.errors.join(' ')).toContain('maximum for month is 175');
  });

  test('rejects astrology vocabulary anywhere in visible forecast copy', () => {
    const technicalParagraph = validateFreeGeneratedForecastFeed({
      headline: 'Держи темп',
      paragraphs: [{ text: 'Луна в оппозиции к Венере усиливает напряжение.', evidence_ids: ['e1'] }],
      advice: null,
    }, new Set(['e1']), 'day');
    expect(technicalParagraph.errors.join(' ')).toContain('astrology term');

    const technicalAdvice = validateFreeGeneratedForecastFeed({
      headline: 'Keep the plan flexible',
      paragraphs: [{ text: 'A change of pace creates useful room.', evidence_ids: ['e1'] }],
      advice: { text: 'Use the Mars square carefully.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'week');
    expect(technicalAdvice.errors.join(' ')).toContain('astrology term');

    const zodiacSign = validateFreeGeneratedForecastFeed({
      headline: 'У Рыб начинается новый этап',
      paragraphs: [{ text: 'Сейчас полезно выбрать одну ясную цель.', evidence_ids: ['e1'] }],
      advice: { text: 'Запиши первый шаг.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(zodiacSign.errors.join(' ')).toContain('astrology term');
  });

  test('rejects formal or plural Russian address but accepts the app voice on ты', () => {
    const formal = validateFreeGeneratedForecastFeed({
      headline: 'Сохрани ясность',
      paragraphs: [{ text: 'Вам стоит проверить договор и не торопиться.', evidence_ids: ['e1'] }],
      advice: null,
    }, new Set(['e1']), 'day');
    expect(formal.errors.join(' ')).toContain('formal Russian address');

    const singular = validateFreeGeneratedForecastFeed({
      headline: 'Сохрани ясность',
      paragraphs: [{ text: 'Ты быстрее увидишь суть, если задашь прямой вопрос.', evidence_ids: ['e1'] }],
      advice: { text: 'Проверь условие до ответа.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(singular.errors).toEqual([]);
  });

  test('enforces the visible structure promised for day, week, and month', () => {
    const dayWithoutAction = validateFreeGeneratedForecastFeed({
      headline: 'Сохрани ясность',
      paragraphs: [{ text: 'Сегодня главный выбор становится заметнее.', evidence_ids: ['e1'] }],
      advice: null,
    }, new Set(['e1']), 'day');
    expect(dayWithoutAction.errors.join(' ')).toContain('day forecast requires one useful action');

    const weekAsCalendar = validateFreeGeneratedForecastFeed({
      headline: 'Keep the week flexible',
      paragraphs: [{
        text: 'Monday brings one task, Tuesday changes it, and Wednesday settles the question.',
        evidence_ids: ['e1'],
      }],
      advice: null,
    }, new Set(['e1']), 'week');
    expect(weekAsCalendar.errors.join(' ')).toContain('day-by-day breakdown');

    const monthWithoutTwoPhases = validateFreeGeneratedForecastFeed({
      headline: 'Собери месяц вокруг главного',
      paragraphs: [{ text: 'В начале месяца темп растёт, а потом становится ровнее.', evidence_ids: ['e1'] }],
      advice: { text: 'Оставь ресурс для главной цели.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'month');
    expect(monthWithoutTwoPhases.errors.join(' ')).toContain('month forecast requires two semantic phases');

    const monthWithoutConclusion = validateFreeGeneratedForecastFeed({
      headline: 'Собери месяц вокруг главного',
      paragraphs: [
        { text: 'Первая часть месяца помогает набрать темп.', evidence_ids: ['e1'] },
        { text: 'Во второй части становится проще закрепить результат.', evidence_ids: ['e1'] },
      ],
      advice: null,
    }, new Set(['e1']), 'month');
    expect(monthWithoutConclusion.errors.join(' ')).toContain('month forecast requires one strategic conclusion');
  });

  test('unwraps fenced and provider-wrapped JSON responses', () => {
    const payload = { data: {
      headline: 'Terms before speed',
      paragraphs: [{ text: 'A reply needs a second look.', evidence_ids: ['e1'] }],
      advice: { text: 'State the condition clearly.', evidence_ids: ['e1'] },
    } };
    const parsed = parseGeneratedFeedPayload(`\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``);
    expect(parsed).toEqual(payload.data);
  });
});
