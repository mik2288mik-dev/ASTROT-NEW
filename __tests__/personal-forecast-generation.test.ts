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
  test('uses one compact JSON contract with an optional advice field', () => {
    const system = getPersonalForecastSystemPrompt('en', 'day');
    expect(system).toContain('PERSONAL FORECAST TASK');
    expect(system).toContain('no more than 150 words');
    expect(system).toContain('"advice"');
    expect(system).toContain('Advice is optional');
    expect(system).not.toContain('separate task');
    expect(system).not.toContain('Return 2 or 3 sections');
  });

  test('uses the same 150-word cap while preserving each period scale', () => {
    const build = (period: 'day' | 'week' | 'month') => getPersonalForecastSystemPrompt('en', period);
    expect(build('day')).toContain('no more than 150 words');
    expect(build('day')).toContain('this day only');
    expect(build('week')).toContain('no more than 150 words');
    expect(build('week')).toContain('Never split the week into a day-by-day list');
    expect(build('month')).toContain('no more than 150 words');
    expect(build('month')).toContain('Never turn it into a calendar');
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

  test('allows no advice and enforces existing evidence IDs and the 150-word cap', () => {
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

    const tooLong = validateFreeGeneratedForecastFeed({
      headline: 'The day has one job',
      paragraphs: [{ text: words(151), evidence_ids: ['e1'] }],
      advice: null,
    }, new Set(['e1']), 'month');
    expect(tooLong.errors.join(' ')).toContain('maximum for month is 150');
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
