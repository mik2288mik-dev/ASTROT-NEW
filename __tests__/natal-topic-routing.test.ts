import type {
  BuiltNatalModelContext,
  NatalEvidenceFact,
} from '../lib/natalReading/permanentReport';
import {
  resolveNatalReportAnswerEvidence,
  resolveNatalReportNarrativeEvidence,
} from '../lib/natalReading/reportCatalogEvidence';

function placement(body: string): NatalEvidenceFact {
  return {
    id: `natal.position.${body}`,
    kind: 'placement',
    object: body,
    data: { key: body, sign: 'Aries' },
  };
}

function aspect(
  id: string,
  from: string,
  to: string,
  type: string,
  orb: number,
): NatalEvidenceFact {
  return {
    id,
    kind: 'aspect',
    object: id,
    data: {
      from, to, fromKey: from, toKey: to, type, orb, reliable: true,
    },
  };
}

function builtFrom(evidence: NatalEvidenceFact[]): BuiltNatalModelContext {
  return {
    context: {
      evidence,
      chart: {} as any,
      subject: {} as any,
      birthTimeQuality: 'exact',
      reliability: {} as any,
      calculationVersion: 'test',
      chartQuality: {},
      reportPlan: [],
    },
    language: 'ru',
    evidenceIds: new Set(evidence.map((fact) => fact.id)),
    birthTimeQuality: 'exact',
    anglesIncluded: false,
    housesIncluded: false,
    ascendantIncluded: false,
    reliableAngleKeys: new Set(),
    reliableHouseNumbers: new Set(),
    reportPlanByKey: new Map(),
  } as unknown as BuiltNatalModelContext;
}

describe('natal topic routing boundaries', () => {
  const built = builtFrom([
    placement('sun'),
    placement('moon'),
    placement('mercury'),
    placement('venus'),
    placement('mars'),
    placement('saturn'),
    placement('jupiter'),
    aspect('natal.aspect.venus-trine-moon', 'venus', 'moon', 'trine', 0.4),
    aspect('natal.aspect.mercury-square-mars', 'mercury', 'mars', 'square', 0.5),
    aspect('natal.aspect.mars-trine-saturn', 'mars', 'saturn', 'trine', 0.7),
    aspect('natal.aspect.saturn-square-pluto', 'saturn', 'pluto', 'square', 0.1),
  ]);

  test('broad Love does not inherit a communication conflict aspect', () => {
    const ids = resolveNatalReportNarrativeEvidence(built, 'love').map((fact) => fact.id);
    expect(ids).toContain('natal.aspect.venus-trine-moon');
    expect(ids).not.toContain('natal.aspect.mercury-square-mars');
    expect(ids).not.toContain('natal.aspect.saturn-square-pluto');
  });

  test('broad Communication does not inherit relationship evidence', () => {
    const ids = resolveNatalReportNarrativeEvidence(built, 'communication').map((fact) => fact.id);
    expect(ids).toContain('natal.position.mercury');
    expect(ids).toContain('natal.aspect.mercury-square-mars');
    expect(ids).not.toContain('natal.aspect.venus-trine-moon');
  });

  test('explicit argument question may use Mercury-Mars without leaking it into Love', () => {
    const argumentIds = resolveNatalReportAnswerEvidence(
      built,
      'communication_arguments',
    ).evidenceIds;
    const loveIds = resolveNatalReportAnswerEvidence(
      built,
      'love_people_you_like',
    ).evidenceIds;

    expect(argumentIds).toContain('natal.aspect.mercury-square-mars');
    expect(argumentIds).not.toContain('natal.aspect.venus-trine-moon');
    expect(loveIds).toContain('natal.aspect.venus-trine-moon');
    expect(loveIds).not.toContain('natal.aspect.mercury-square-mars');
  });

  test('unrelated outer-planet tension cannot create a broad topic by itself', () => {
    for (const category of ['main', 'character', 'love', 'communication', 'work', 'money'] as const) {
      const ids = resolveNatalReportNarrativeEvidence(built, category).map((fact) => fact.id);
      expect(ids).not.toContain('natal.aspect.saturn-square-pluto');
    }
  });
});
