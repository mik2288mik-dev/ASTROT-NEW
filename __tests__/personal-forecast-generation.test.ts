import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildPersonalForecastFeedPrompt,
  buildPersonalForecastSectionPlans,
  buildCrossPeriodLinks,
  validateGeneratedForecastFeed,
} from '../lib/personalForecastGeneration';
import type { EvidenceCalculationResult } from '../lib/personalForecastEvidence';
import {
  DYNAMIC_FORECAST_TOPIC_KEYS,
  FIXED_FORECAST_SECTION_KEYS,
  resolvePersonalForecastWindow,
  type CalculatedAstroEvidence,
  type ForecastTopicKey,
  type TopicEvidence,
} from '../lib/personalForecastContract';
import { chartFixture } from './personal-forecast-fixture';

function calculatedEvidence(
  topic: ForecastTopicKey,
  index: number,
): CalculatedAstroEvidence {
  return {
    id: `e-${topic}`,
    kind: 'transit_to_natal',
    transitPlanet: 'saturn',
    natalPoint: 'sun',
    aspect: 'trine',
    orb: 1.2,
    status: 'applying',
    startsAt: '2026-07-26T00:00:00.000Z',
    endsAt: '2026-07-26T23:59:59.000Z',
    strength: 90 - index,
    polarity: 'supporting',
    topicKeys: [topic],
    calculationSource: 'test:swisseph',
  };
}

function calculatedFixture(): EvidenceCalculationResult {
  const generatedTopics: ForecastTopicKey[] = [
    'overview',
    ...FIXED_FORECAST_SECTION_KEYS,
    'business',
    'study',
  ];
  const evidence = generatedTopics.map(calculatedEvidence);
  const emptyBundle = (): TopicEvidence => ({
    primary: [],
    supporting: [],
    conflicting: [],
    confidence: 'low',
  });
  const topicEvidence = Object.fromEntries(
    [
      'overview',
      ...FIXED_FORECAST_SECTION_KEYS,
      ...DYNAMIC_FORECAST_TOPIC_KEYS,
    ].map((topic) => [topic, emptyBundle()]),
  ) as Record<ForecastTopicKey, TopicEvidence>;
  for (const item of evidence) {
    const topic = item.topicKeys[0];
    topicEvidence[topic] = {
      primary: [item],
      supporting: [],
      conflicting: [],
      confidence: 'high',
    };
  }
  return {
    evidence,
    continuationEvidence: [],
    topicEvidence,
    dynamicTopicKeys: ['business', 'study'],
    evidenceViews: Object.fromEntries(evidence.map((item) => [item.id, {
      id: item.id,
      factor: `Calculated factor for ${item.topicKeys[0]}`,
      orb: item.orb ?? null,
      status: item.status,
      period: '2026-07-26',
      meaning: 'This factor supports the supplied conclusion.',
    }])),
  };
}

type Plans = ReturnType<typeof buildPersonalForecastSectionPlans>;

function generatedText(seed: string, minimum: number): string {
  const continuation =
    ' It connects the conclusion with an ordinary practical choice and briefly explains why the supplied period calculation supports that direction without promising a fixed event.';
  let value = seed;
  while (value.length < minimum) value += continuation;
  return value.slice(0, minimum + 22);
}

function firstEvidenceId(
  plan: Plans['overview'] | Plans['sections'][number],
): string {
  return plan.evidence.primary[0].id;
}

function validRawFeed(plans: Plans) {
  const rawSection = (
    plan: Plans['overview'] | Plans['sections'][number],
    index: number,
  ) => ({
    id: plan.id,
    ...(plan.kind === 'dynamic' ? { title: `Focus ${index}` } : {}),
    text: generatedText(
      index < 0
        ? 'The main period conclusion identifies one practical priority and its timing.'
        : `Calculated section ${index} gives a distinct practical conclusion for this period.`,
      index < 0 ? 450 : 250,
    ),
    premium_teaser: `The complete section ${index + 2} explains the calculated conclusion and its practical meaning.`,
    explanation_anchors: [{
      id: `anchor-${plan.id}`,
      conclusion: `Conclusion ${index + 2} follows from the supplied period calculation.`,
      explanation: generatedText(
        'The supplied calculation supports this subject during the selected interval.',
        120,
      ).slice(0, 190),
      evidence_ids: [firstEvidenceId(plan)],
    }],
    inline_astro_accent: null,
  });
  return {
    overview: rawSection(plans.overview, -1),
    sections: plans.sections.map(rawSection),
  };
}

describe('personal forecast V3 single-feed generation', () => {
  const calculated = calculatedFixture();
  const plans = buildPersonalForecastSectionPlans({
    calculated,
    period: 'day',
    language: 'en',
  });
  const window = resolvePersonalForecastWindow(
    'day',
    '2026-07-26',
    'Europe/Moscow',
  );

  it('builds the exact fixed sequence, two calculated dynamics and evidence for every plan', () => {
    expect(
      plans.sections
        .filter((plan) => plan.kind === 'fixed' || plan.kind === 'wishes')
        .map((plan) => plan.fixedKey),
    ).toEqual(FIXED_FORECAST_SECTION_KEYS);
    expect(
      plans.sections
        .filter((plan) => plan.kind === 'dynamic')
        .map((plan) => plan.sourceTopicKey),
    ).toEqual(['business', 'study']);

    for (const plan of [plans.overview, ...plans.sections]) {
      expect(plan.evidence.primary).toHaveLength(1);
      expect(plan.evidence.primary[0].topicKeys).toContain(plan.sourceTopicKey);
    }
  });

  it('puts every section and its allowed evidence into one task prompt without a local persona', () => {
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'en',
      period: 'day',
      window,
      chartData: chartFixture,
      overview: plans.overview,
      sections: plans.sections,
    });

    expect(prompt).toContain('Create one structured personal forecast feed');
    expect(prompt).toContain('"overview"');
    expect(prompt).toContain('"sections"');
    expect(prompt).toContain('overview text is 450–650 characters');
    for (const plan of [plans.overview, ...plans.sections]) {
      expect(prompt).toContain(`"id": "${plan.id}"`);
      expect(prompt).toContain(`"id": "${firstEvidenceId(plan)}"`);
    }
    expect(prompt).not.toMatch(
      /\b(astrologer|psychologist|therapist|coach|mentor|friend|mystical guide|fortune-teller)\b/i,
    );
  });

  it('removes unreliable Ascendant and house data from the natal prompt context', () => {
    const prompt = buildPersonalForecastFeedPrompt({
      language: 'en',
      period: 'day',
      window,
      chartData: {
        ...chartFixture,
        birthTimeQuality: 'unknown',
        chartQuality: {
          birthTimeQuality: 'unknown',
          ascendantReliable: false,
          housesReliable: false,
          houseBasedPersonalization: false,
          notes: ['Birth time is unavailable'],
        },
      },
      overview: plans.overview,
      sections: plans.sections,
    });

    expect(prompt).toContain('"rising": null');
    expect(prompt).toContain('"houses": []');
    expect(prompt).toContain('"birthTimeQuality": "unknown"');
    expect(prompt).toContain('"ascendantReliable": false');
    expect(prompt).toContain('"houseBasedPersonalization": false');
  });

  it('gives simultaneous strong astro accents unique deterministic titles', () => {
    const base = calculatedFixture();
    const stations: CalculatedAstroEvidence[] = [
      {
        ...calculatedEvidence('mood', 20),
        id: 'e-uranus-station',
        kind: 'station',
        transitPlanet: 'uranus',
        natalPoint: null,
        aspect: null,
        strength: 92,
        status: 'active',
      },
      {
        ...calculatedEvidence('mood', 21),
        id: 'e-neptune-station',
        kind: 'station',
        transitPlanet: 'neptune',
        natalPoint: null,
        aspect: null,
        strength: 91,
        status: 'active',
      },
    ];
    const stationPlans = buildPersonalForecastSectionPlans({
      calculated: {
        ...base,
        evidence: [...base.evidence, ...stations],
      },
      period: 'year',
      language: 'en',
    });
    const titles = stationPlans.sections
      .filter((plan) => plan.kind === 'astro_accent')
      .map((plan) => plan.staticTitle);

    expect(titles).toEqual([
      'Uranus changes direction',
      'Neptune changes direction',
    ]);
    expect(new Set(titles).size).toBe(titles.length);
    expect(validateGeneratedForecastFeed({
      raw: validRawFeed(stationPlans),
      period: 'year',
      overviewPlan: stationPlans.overview,
      sectionPlans: stationPlans.sections,
    }).errors).toEqual([]);
  });

  it('validates one complete ordered feed and builds real locked previews', () => {
    const validation = validateGeneratedForecastFeed({
      raw: validRawFeed(plans),
      period: 'day',
      overviewPlan: plans.overview,
      sectionPlans: plans.sections,
    });

    expect(validation.errors).toEqual([]);
    expect(validation.overview?.id).toBe('overview');
    expect(validation.sections.map((section) => section.id)).toEqual(
      plans.sections.map((plan) => plan.id),
    );
    for (const section of [validation.overview!, ...validation.sections]) {
      expect(section.lockedPreview.lead).toBeTruthy();
      expect(section.lockedPreview.blurred).toBeTruthy();
      expect(section.lockedPreview.teaser).toBe(section.premiumTeaser);
    }
  });

  it('keeps concise length ranges as generation guidance instead of failing the whole feed', () => {
    const raw = validRawFeed(plans);
    raw.overview.text =
      'The main conclusion is clear now. It points to one practical priority and explains the reason without inventing an event.';
    raw.sections[0].text = generatedText(
      'This section stays readable even when the model slightly exceeds the preferred presentation range.',
      460,
    );
    const validation = validateGeneratedForecastFeed({
      raw,
      period: 'day',
      overviewPlan: plans.overview,
      sectionPlans: plans.sections,
    });

    expect(validation.errors).toEqual([]);
  });

  it('rejects wrong order, foreign evidence, unsupported dates and voice violations', () => {
    const wrongOrder = validRawFeed(plans);
    wrongOrder.sections.reverse();
    const orderValidation = validateGeneratedForecastFeed({
      raw: wrongOrder,
      period: 'day',
      overviewPlan: plans.overview,
      sectionPlans: plans.sections,
    });
    expect(orderValidation.errors.join(' ')).toContain('returned id does not match');

    const invalid = validRawFeed(plans);
    invalid.sections[0].explanation_anchors[0].evidence_ids = ['e-overview'];
    invalid.sections[1].text = 'Trust your path because everything will become clear.';
    invalid.sections[2].text = 'A concrete decision is guaranteed on 2026-08-10.';
    const validation = validateGeneratedForecastFeed({
      raw: invalid,
      period: 'day',
      overviewPlan: plans.overview,
      sectionPlans: plans.sections,
    });
    const errors = validation.errors.join(' ');
    expect(errors).toContain('evidence_ids are invalid');
    expect(errors).toContain('app voice violation');
    expect(errors).toContain('unsupported dates 2026-08-10');
  });

  it('rejects guaranteed future outcomes even when their date is calculated', () => {
    const invalid = validRawFeed(plans);
    invalid.sections[0].text =
      'A promotion will definitely happen on 26.07.2026, and the result is already settled.';
    const validation = validateGeneratedForecastFeed({
      raw: invalid,
      period: 'day',
      overviewPlan: plans.overview,
      sectionPlans: plans.sections,
    });
    const errors = validation.errors.join(' ');

    expect(errors).toContain('guaranteed future outcome');
    expect(errors).not.toContain('unsupported dates 26.07.2026');
  });

  it('checks numeric and English day-first dates, including dynamic titles', () => {
    const invalid = validRawFeed(plans);
    invalid.sections[0].text =
      'The practical decision is scheduled for 10.08.2026 without support in the supplied calculation.';
    invalid.sections[1].text =
      'The next concrete step is scheduled for 11/08/2026 without calculated support.';
    const dynamicIndex = plans.sections.findIndex((plan) => plan.kind === 'dynamic');
    invalid.sections[dynamicIndex].title = 'Plans for 12 August 2026';
    const validation = validateGeneratedForecastFeed({
      raw: invalid,
      period: 'day',
      overviewPlan: plans.overview,
      sectionPlans: plans.sections,
    });
    const errors = validation.errors.join(' ');

    expect(errors).toContain('10.08.2026');
    expect(errors).toContain('11/08/2026');
    expect(errors).toContain('12 August 2026');
  });

  it('rejects duplicate explanation-anchor ids before final package assembly', () => {
    const invalid = validRawFeed(plans);
    invalid.overview.explanation_anchors.push({
      ...invalid.overview.explanation_anchors[0],
    });
    const validation = validateGeneratedForecastFeed({
      raw: invalid,
      period: 'day',
      overviewPlan: plans.overview,
      sectionPlans: plans.sections,
    });

    expect(validation.errors.join(' ')).toContain('id is duplicated');
  });

  it('rejects text that cannot produce a real blurred continuation', () => {
    const invalid = validRawFeed(plans);
    invalid.sections[0].text = 'Only five words are here';
    const validation = validateGeneratedForecastFeed({
      raw: invalid,
      period: 'day',
      overviewPlan: plans.overview,
      sectionPlans: plans.sections,
    });

    expect(validation.errors.join(' ')).toContain(
      'text is too short for an honest locked preview',
    );
  });

  it('builds a reachable current longer-period link from bounded continuation evidence', () => {
    const validation = validateGeneratedForecastFeed({
      raw: validRawFeed(plans),
      period: 'day',
      overviewPlan: plans.overview,
      sectionPlans: plans.sections,
    });
    const continuation = {
      ...calculatedEvidence('love', 0),
      startsAt: window.startsAt.toISOString(),
      endsAt: new Date(
        window.endsAt.getTime() + 3 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      strength: 88,
    };
    const links = buildCrossPeriodLinks({
      period: 'day',
      window,
      sections: validation.sections,
      plans: plans.sections,
      continuationEvidence: [continuation],
      language: 'en',
    });
    expect(links).toEqual([
      expect.objectContaining({
        fromSectionId: 'love',
        targetPeriod: 'week',
        targetSectionId: 'love',
        continuationAt: expect.any(String),
      }),
    ]);
  });

  it('has one completion call site for the complete feed, not one per section', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/personalForecastGeneration.ts'),
      'utf8',
    );
    expect(source.match(/chat\.completions\.create/g)).toHaveLength(1);
    expect(source).toContain('buildPersonalForecastFeedPrompt');
    expect(source).not.toContain('buildPersonalForecastTopicPrompt');
  });
});
