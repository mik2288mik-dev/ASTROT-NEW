import {
  PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS,
  buildPersonalForecastFeedPrompt,
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

describe('personal forecast direct evidence writer', () => {
  test('sends direct Swiss evidence and V2 factual context without a semantic writing plan', () => {
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'en',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-02', 'Europe/Moscow'),
      calculatedEvidence: evidence,
      canonicalNatalReport: { CoreIdentity: {} } as never,
    });

    expect(prompt).toContain('Direct Swiss Ephemeris calculation evidence');
    expect(prompt).toContain('"transit_planet": "mars"');
    expect(prompt).toContain('"natal_point": "venus"');
    expect(prompt).toContain('"house": 2');
    expect(prompt).toContain('Return 2 or 3 sections');
    expect(prompt).toContain('astro_evidence');
    expect(prompt).not.toContain('Approved semantic writing plan');
    expect(prompt).not.toContain('meaning_seed');
    expect(PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS).toBe(2);
  });

  test('changes the instruction for each forecast period', () => {
    const window = resolvePersonalForecastWindow('day', '2026-08-02', 'Europe/Moscow');
    const build = (period: 'day' | 'week' | 'month') => buildPersonalForecastFeedPrompt({
      language: 'en', period,
      window,
      calculatedEvidence: evidence,
    });
    expect(build('day')).toContain('short slice of this day');
    expect(build('week')).toContain("week's main vector");
    expect(build('month')).toContain('strategic reading of the month');
  });

  test('accepts free blocks with text and astro evidence, not writer identities', () => {
    const valid = validateFreeGeneratedForecastFeed({
      sections: [
        { blocks: [{ text: 'The answer sits like a stone in your shoe: small, but impossible to ignore in a purchase or reply.', astro_evidence: 'Mars square natal Venus' }] },
        { title: 'Terms', blocks: [{ text: 'Put the number and condition on the table before agreement turns into a vague promise.', astro_evidence: 'Mars in the 2nd house' }] },
      ],
    });
    expect(valid.errors).toEqual([]);
    expect(valid.sections[1].title).toBe('Terms');
  });

  test('rejects invalid free text without requiring atom ids or roles', () => {
    const invalid = validateFreeGeneratedForecastFeed({
      sections: [
        { blocks: [{ text: 'Too short', astro_evidence: 'Mars' }] },
        { blocks: [{ text: 'The reply needs more precision before it becomes a commitment.', astro_evidence: 'Mars square Mercury' }] },
      ],
    });
    expect(invalid.errors.join(' ')).toContain('invalid text');
  });
});
