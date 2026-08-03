import {
  PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS,
  buildPersonalForecastFeedPrompt,
  buildPersonalForecastSectionPlans,
  validateGeneratedForecastFeed,
} from '../lib/personalForecastGeneration';
import {
  PERSONAL_FORECAST_SEMANTICS_VERSION,
  type ForecastSemanticFact,
} from '../lib/personalForecastSemantics';
import { resolvePersonalForecastWindow } from '../lib/personalForecastContract';

function semanticFact(overrides: Partial<ForecastSemanticFact> = {}): ForecastSemanticFact {
  return {
    id: 'fact:mercury-square-mars',
    semanticVersion: PERSONAL_FORECAST_SEMANTICS_VERSION,
    evidenceIds: ['e1'],
    evidenceFingerprint: 'evidence:1',
    semanticFingerprint: 'semantic:communication-friction',
    sourceKind: 'transit_to_natal',
    transitPlanet: 'mercury',
    natalPoint: 'mars',
    aspect: 'square',
    house: null,
    domain: 'communication_decisions',
    lifeContext: null,
    mechanism: {
      transit: 'information_exchange',
      dynamic: 'friction',
      stationDirection: null,
    },
    timing: {
      scope: 'temporary',
      period: 'day',
      phase: 'applying',
      startsAt: '2026-08-02T00:00:00.000Z',
      endsAt: '2026-08-02T23:59:59.999Z',
      exactAt: null,
    },
    confidence: 'high',
    strength: 88,
    allowedClaimAtoms: [
      'communication_and_decisions_are_temporarily_active',
      'temporary_friction_requires_precision',
    ],
    allowedManifestationAtoms: ['details_require_review'],
    allowedRiskAtoms: ['impulsive_reply_or_missed_detail'],
    allowedActionAtoms: ['verify_wording_numbers_and_sequence'],
    forbiddenClaimClasses: [
      'permanent_personality',
      'guaranteed_event',
      'invented_biography',
      'unsupported_life_domain',
    ],
    ...overrides,
  };
}

function plans() {
  return buildPersonalForecastSectionPlans({
    facts: [semanticFact()],
    period: 'day',
    language: 'en',
  });
}

function validRaw() {
  const built = plans();
  return {
    built,
    raw: {
      sections: [built.overview, ...built.sections].map((plan) => ({
        id: plan.id,
        blocks: plan.blocks.map((item) => ({
          id: item.id,
          role: item.role,
          semantic_fact_id: item.semanticFactId,
          atom_id: item.atomId,
          text: item.writerBrief,
        })),
      })),
    },
  };
}

describe('personal forecast semantic writer', () => {
  test('plans only sections supported by compiled semantic facts', () => {
    const built = plans();

    expect(built.overview.semanticFactIds).toEqual(['fact:mercury-square-mars']);
    expect(built.sections).toHaveLength(1);
    expect(built.sections[0]).toMatchObject({
      id: expect.stringMatching(/^semantic:/),
      title: 'Conversations and decisions',
      semanticFactIds: ['fact:mercury-square-mars'],
      semanticFingerprint: 'semantic:communication-friction',
    });
    expect(built.sections[0].blocks.map((item) => item.role)).toEqual([
      'lead',
      'detail',
      'risk',
      'action',
    ]);
  });

  test('keeps one strongest section per supported topic and avoids repeated copy', () => {
    const second = semanticFact({
      id: 'fact:saturn-square-mercury',
      semanticFingerprint: 'semantic:communication-constraint',
      transitPlanet: 'saturn',
      mechanism: {
        transit: 'constraint_structure',
        dynamic: 'friction',
        stationDirection: null,
      },
      allowedClaimAtoms: [
        'communication_and_decisions_are_temporarily_active',
        'limits_and_commitments_are_temporarily_active',
        'temporary_friction_requires_precision',
      ],
      allowedManifestationAtoms: ['constraint_or_deadline_becomes_more_noticeable'],
      allowedRiskAtoms: ['ignoring_a_real_limit_or_commitment'],
      allowedActionAtoms: ['separate_fixed_limits_from_negotiable_conditions'],
      strength: 80,
    });
    const built = buildPersonalForecastSectionPlans({
      facts: [semanticFact(), second],
      period: 'day',
      language: 'en',
    });
    const blocks = [built.overview, ...built.sections].flatMap((plan) => plan.blocks);

    expect(built.sections).toHaveLength(1);
    expect(built.sections[0].semanticFactIds).toEqual(['fact:mercury-square-mars']);
    expect(built.overview.blocks.map((item) => item.atomId)).toEqual([
      'approved:lead:fact:mercury-square-mars',
    ]);
    expect(new Set(blocks.map((item) => item.writerBrief)).size).toBe(blocks.length);
  });

  test('keeps natal-target topics separate when they share one house context', () => {
    const communication = semanticFact({
      lifeContext: 'personal_resources',
      house: 2,
    });
    const agreements = semanticFact({
      id: 'fact:venus-square-venus',
      semanticFingerprint: 'semantic:agreements-friction',
      transitPlanet: 'venus',
      natalPoint: 'venus',
      house: 2,
      domain: 'values_agreements',
      lifeContext: 'personal_resources',
      mechanism: {
        transit: 'value_alignment',
        dynamic: 'friction',
        stationDirection: null,
      },
      strength: 84,
      allowedClaimAtoms: [
        'values_and_agreements_are_temporarily_active',
        'temporary_friction_requires_precision',
      ],
      allowedManifestationAtoms: ['agreement_terms_become_more_noticeable'],
      allowedRiskAtoms: ['agreeing_before_terms_are_clear'],
      allowedActionAtoms: ['state_terms_and_boundaries_explicitly'],
    });
    const built = buildPersonalForecastSectionPlans({
      facts: [communication, agreements],
      period: 'day',
      language: 'en',
    });

    expect(built.sections).toHaveLength(2);
    expect(built.sections.map((section) => section.title)).toEqual(expect.arrayContaining([
      'Conversations and decisions',
      'Terms and values',
    ]));
    expect(built.sections.map((section) => section.visualTag)).toEqual(expect.arrayContaining([
      'communication_decisions',
      'values_agreements',
    ]));
  });

  test('keeps a low-signal period honest without manufacturing extra themes', () => {
    const calm = semanticFact({
      id: 'fact:calm-period',
      semanticFingerprint: 'semantic:calm-period',
      sourceKind: 'period_aggregate',
      transitPlanet: null,
      natalPoint: null,
      aspect: null,
      domain: 'cycle_attention',
      mechanism: {
        transit: 'tempo_fluctuation',
        dynamic: 'low_signal',
        stationDirection: null,
      },
      confidence: 'low',
      strength: 31,
      allowedClaimAtoms: [
        'no_single_theme_dominates_period',
        'ordinary_priorities_can_remain_in_place',
      ],
      allowedManifestationAtoms: ['confirmed_signals_remain_distributed'],
      allowedRiskAtoms: ['forcing_a_story_from_weak_signals'],
      allowedActionAtoms: ['keep_plans_proportional_to_confirmed_signals'],
    });
    const built = buildPersonalForecastSectionPlans({
      facts: [calm],
      period: 'day',
      language: 'en',
    });

    expect(built.overview.blocks).toHaveLength(1);
    expect(built.sections).toHaveLength(1);
    expect(built.sections[0].title).toBe('A calm period');
    expect(built.sections[0].blocks.map((item) => item.role)).toEqual([
      'lead',
      'detail',
      'risk',
      'action',
    ]);
  });

  test('prompt sends an approved writing plan, not the natal chart', () => {
    const built = plans();
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'en',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-02', 'Europe/Moscow'),
      overviewPlan: built.overview,
      sectionPlans: built.sections,
    });

    expect(prompt).toContain('final copy editor, not the astrologer');
    expect(prompt).toContain('exact_meaning_to_rephrase');
    expect(prompt).toContain('There is no target word count');
    expect(prompt).toContain('fact:mercury-square-mars');
    expect(prompt).toContain('Never turn it into personality');
    expect(prompt).not.toContain('birthDate');
    expect(prompt).not.toContain('latitude');
    expect(prompt).not.toContain('longitude');
    expect(PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS).toBe(2);
  });

  test('prompt admits only enumerated non-identifying history facts', () => {
    const built = plans();
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'en',
      period: 'day',
      window: resolvePersonalForecastWindow('day', '2026-08-02', 'Europe/Moscow'),
      overviewPlan: built.overview,
      sectionPlans: built.sections,
      historyContext: {
        calculations: [],
        explicitFacts: [
          {
            factKey: 'preferred_decision_style',
            factValue: 'one step at a time',
            operation: 'assert',
          },
          {
            factKey: 'birth_city',
            factValue: 'Moscow',
            operation: 'assert',
          },
          {
            factKey: 'preferred_pace',
            factValue: 'Alice, +1 202 555 0100',
            operation: 'assert',
          },
        ],
        userMessages: [],
        artifactContinuity: [],
      } as never,
    });

    expect(prompt).toContain('one step at a time');
    expect(prompt).not.toContain('Moscow');
    expect(prompt).not.toContain('Alice');
    expect(prompt).not.toContain('555 0100');
  });

  test('independent validator accepts only exact semantic identities', () => {
    const { built, raw } = validRaw();
    const valid = validateGeneratedForecastFeed({
      raw,
      overviewPlan: built.overview,
      sectionPlans: built.sections,
    });

    expect(valid.errors).toEqual([]);
    expect(valid.blocksBySectionId.size).toBe(2);

    const altered = structuredClone(raw);
    altered.sections[1].blocks[0].atom_id = 'invented_event';
    const invalid = validateGeneratedForecastFeed({
      raw: altered,
      overviewPlan: built.overview,
      sectionPlans: built.sections,
    });
    expect(invalid.errors.join(' ')).toContain('changed the approved semantic identity');
  });

  test('independent validator rejects transit copy written as personality', () => {
    const { built, raw } = validRaw();
    raw.sections[0].blocks[0].text = 'You always react this way and your character never changes.';

    const invalid = validateGeneratedForecastFeed({
      raw,
      overviewPlan: built.overview,
      sectionPlans: built.sections,
    });
    expect(invalid.errors.join(' ')).toContain('failed independent copy validation');
  });

  test('independent validator rejects unsupported life areas and ungrounded copy', () => {
    const unsupported = validRaw();
    unsupported.raw.sections[0].blocks[0].text =
      'Your love life improves now, and a new relationship begins this week.';
    const unsupportedResult = validateGeneratedForecastFeed({
      raw: unsupported.raw,
      overviewPlan: unsupported.built.overview,
      sectionPlans: unsupported.built.sections,
    });
    expect(unsupportedResult.errors.join(' ')).toContain(
      'not grounded in its approved meaning',
    );

    const invented = validRaw();
    invented.raw.sections[0].blocks[0].text =
      'An unexpected invitation changes the week; verify the wording before you answer.';
    const inventedResult = validateGeneratedForecastFeed({
      raw: invented.raw,
      overviewPlan: invented.built.overview,
      sectionPlans: invented.built.sections,
    });
    expect(inventedResult.errors.join(' ')).toContain(
      'not grounded in its approved meaning',
    );
  });
});
