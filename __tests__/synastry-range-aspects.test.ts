import { computeSynastryAspects } from '../lib/synastry/synastryAspects';
import { calculateCompatibility } from '../lib/synastry/compatibilityEngine';

const exact = (longitude: number) => ({ longitude, reliability: 'exact' });
const ranged = (start: number, end: number) => ({
  longitude: start + (end - start) / 2,
  reliability: 'stable_in_range',
  range: { startLongitude: start, endLongitude: end },
});

const chart = (positions: Record<string, unknown>) => ({ positions } as any);

describe('synastry aspects without birth time', () => {
  it('drops a Moon contact that only holds for part of the birth day', () => {
    // Noon Moon sits exactly square the Sun, but over the day it drifts 14° — out of orb at the edges.
    const aspects = computeSynastryAspects(
      chart({ sun: exact(100) }),
      chart({ moon: ranged(183, 197) }),
    );
    expect(aspects).toHaveLength(0);
  });

  it('keeps a contact that holds all day and reports the worst-case orb', () => {
    const aspects = computeSynastryAspects(
      chart({ sun: exact(100) }),
      chart({ moon: ranged(188, 192) }),
    );
    expect(aspects).toHaveLength(1);
    expect(aspects[0]).toMatchObject({ aspectKey: 'square', orb: 2, reliability: 'stable_in_range' });
  });

  it('writes who-affects-whom facts with names in the nominative and without repeats', () => {
    const result = calculateCompatibility({
      subjectChart: chart({ saturn: exact(0), mars: exact(200) }),
      partnerChart: chart({ moon: exact(90), venus: exact(92), mercury: exact(80) }),
      calculationLevel: 'full',
      relationshipContext: 'relationship',
      subjectName: 'Михаил',
      partnerName: 'Дария',
      language: 'ru',
    });
    const facts = result.directionalPatterns.map((item) => item.fact);
    expect(facts.join(' ')).not.toMatch(/Михаил[аеу]|Дари[иею]\b/);
    const saturnFacts = facts.filter((fact) => fact.includes('правила и порядок'));
    expect(saturnFacts).toHaveLength(1);
  });
});
