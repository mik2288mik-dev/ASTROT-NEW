import {
  PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS,
  buildPersonalForecastFeedPrompt,
  getPersonalForecastSystemPrompt,
  parseGeneratedFeedPayload,
  validateFreeGeneratedForecastFeed,
} from '../lib/personalForecastGeneration';
import { resolvePersonalForecastWindow } from '../lib/personalForecastContract';

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
  test('uses a direct grounded voice and the compact JSON contract', () => {
    const system = getPersonalForecastSystemPrompt('en', 'day');
    expect(system).toContain('PERSONAL FORECAST TASK');
    expect(system).toContain('maximum 130');
    expect(system).toContain('Do not make anxiety, conflict, or risk mandatory');
    expect(system).toContain('{"headline":"short honest headline","lead"');
    expect(system).not.toContain('exactly two concrete practical pointers');
    expect(system).not.toContain('Return 2 or 3 sections');
  });

  test('sends factual Swiss evidence and natal context without semantic interpretation fields', () => {
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'en',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-02', 'Europe/Moscow'),
      calculatedEvidence: evidence,
      natalContext: { positions: { sun: { sign: 'Leo', degree: 10 } } },
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

  test('changes the length and time-scale rule for each period', () => {
    const build = (period: 'day' | 'week' | 'month') => getPersonalForecastSystemPrompt('en', period);
    expect(build('day')).toContain('maximum 130');
    expect(build('week')).toContain('coherent weekly reading');
    expect(build('week')).toContain('never split it into a day-by-day list');
    expect(build('month')).toContain('maximum 200');
    expect(build('month')).toContain('never turn it into a calendar');
  });

  test('accepts one grounded reading with a lead, a meaning section, and advice', () => {
    const valid = validateFreeGeneratedForecastFeed({
      headline: 'Check the terms twice',
      lead: { text: 'The agreement needs precision before speed.', evidence_ids: ['e1'] },
      sections: [{
        title: 'Put it in writing',
        text: 'A direct question clears more than a confident guess.',
        evidence_ids: ['e1'],
      }],
      advice: { text: 'Put the number and condition in writing.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');

    expect(valid.errors).toEqual([]);
    expect(valid.sections).toHaveLength(3);
    expect(valid.sections[0].title).toBe('Check the terms twice');
    expect(valid.sections[0].evidenceIds).toEqual(['e1']);
    expect(valid.sections.map((section) => section.blocks[0].role)).toEqual(['lead', 'insight', 'action']);
  });

  test('enforces existing evidence IDs and period word caps', () => {
    const unknownEvidence = validateFreeGeneratedForecastFeed({
      headline: 'Clear terms win',
      lead: { text: 'A compact factual reading.', evidence_ids: ['e1'] },
      sections: [{ title: 'One point', text: 'Keep the wording exact.', evidence_ids: ['e1'] }],
      advice: { text: 'Check the condition.', evidence_ids: ['missing'] },
    }, new Set(['e1']), 'day');
    expect(unknownEvidence.errors.join(' ')).toContain('unknown');

    const tooLong = validateFreeGeneratedForecastFeed({
      headline: 'The day has one job',
      lead: { text: 'Keep the wording exact.', evidence_ids: ['e1'] },
      sections: [{ title: 'Too much', text: words(127), evidence_ids: ['e1'] }],
      advice: { text: 'Pause before agreeing.', evidence_ids: ['e1'] },
    }, new Set(['e1']), 'day');
    expect(tooLong.errors.join(' ')).toContain('maximum for day is 130');
  });

  test('unwraps fenced and provider-wrapped JSON responses', () => {
    const payload = { data: {
      headline: 'Terms before speed',
      lead: { text: 'A reply needs a second look.', evidence_ids: ['e1'] },
      sections: [{ title: 'Read twice', text: 'Make the condition explicit.', evidence_ids: ['e1'] }],
      advice: { text: 'State the condition clearly.', evidence_ids: ['e1'] },
    } };
    const parsed = parseGeneratedFeedPayload(`\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``);
    expect(parsed).toEqual(payload.data);
  });
});
