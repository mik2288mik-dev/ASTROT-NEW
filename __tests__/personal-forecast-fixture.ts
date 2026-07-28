import type { NatalChartData } from '../types';
import {
  FORECAST_FIXED_TITLES,
  FORECAST_WISHES_TITLES,
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  type ForecastEvidenceView,
  type ForecastSection,
  type ForecastSectionKind,
  type ForecastTopicKey,
  type PersonalForecastPackage,
} from '../lib/personalForecastContract';
import { APP_VOICE_VERSION } from '../lib/appVoice';

export const chartFixture = {
  sun: { planet: 'Sun', sign: 'Aries', degree: 10, longitude: 10, house: 1 },
  moon: { planet: 'Moon', sign: 'Taurus', degree: 12, longitude: 42, house: 2 },
  rising: { planet: 'Ascendant', sign: 'Gemini', degree: 4, longitude: 64, house: 1 },
  mercury: { planet: 'Mercury', sign: 'Pisces', degree: 28, longitude: 358, house: 10 },
  venus: { planet: 'Venus', sign: 'Aquarius', degree: 18, longitude: 318, house: 9 },
  mars: { planet: 'Mars', sign: 'Cancer', degree: 8, longitude: 98, house: 3 },
  jupiter: { planet: 'Jupiter', sign: 'Leo', degree: 10, longitude: 130, house: 4 },
  saturn: { planet: 'Saturn', sign: 'Scorpio', degree: 10, longitude: 220, house: 6 },
  uranus: { planet: 'Uranus', sign: 'Sagittarius', degree: 10, longitude: 250, house: 7 },
  neptune: { planet: 'Neptune', sign: 'Capricorn', degree: 10, longitude: 280, house: 8 },
  pluto: { planet: 'Pluto', sign: 'Scorpio', degree: 20, longitude: 230, house: 6 },
  houses: Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    sign: 'Aries',
    degree: 0,
    longitude: index * 30,
  })),
  aspects: [],
  timezone: 'Europe/Moscow',
  calculationVersion: 'swisseph-test-v1',
  birthTimeQuality: 'exact',
  chartQuality: {
    birthTimeQuality: 'exact',
    ascendantReliable: true,
    housesReliable: true,
    houseBasedPersonalization: true,
    notes: [],
  },
} as unknown as NatalChartData;

const evidenceView: ForecastEvidenceView = {
  id: 'e1',
  factor: 'Mars trine Sun',
  orb: 1.2,
  status: 'applying',
  period: '2026-07-26',
  meaning: 'This calculated factor supports the section conclusion.',
};

function expandedFixtureText(seed: string, minimum: number): string {
  const continuation =
    ' It connects the main conclusion with an ordinary choice, keeps the outcome conditional, and explains the practical reason without adding an unsupported event.';
  let value = seed;
  while (value.length < minimum) value += continuation;
  return value.slice(0, minimum + 18);
}

function sectionFixture(input: {
  id: string;
  kind: ForecastSectionKind;
  title?: string;
  text: string;
  importance: number;
  fixedKey?: ForecastSection['fixedKey'];
  sourceTopicKey?: ForecastTopicKey;
}): ForecastSection {
  const text = expandedFixtureText(
    input.text,
    input.kind === 'overview' ? 450 : 250,
  );
  const premiumTeaser =
    `Open the complete ${input.id} forecast section to see the calculated details.`;
  return {
    id: input.id,
    kind: input.kind,
    status: 'ready',
    diagnosticCode: null,
    fixedKey: input.fixedKey,
    sourceTopicKey: input.sourceTopicKey,
    title: input.title,
    text,
    importance: input.importance,
    visualTag: input.id,
    premiumTeaser,
    lockedPreview: buildForecastLockedPreview(text, premiumTeaser),
    explanationAnchors: [{
      id: `anchor:${input.id}`,
      conclusion: 'The conclusion follows from the calculated period factor.',
      explanation: expandedFixtureText(
        'The supplied calculation strengthens this subject during the selected period.',
        120,
      ).slice(0, 180),
      evidenceIds: ['e1'],
    }],
    inlineAstroAccent: null,
  };
}

export function personalForecastFixture(): PersonalForecastPackage {
  return {
    period: 'day',
    periodKey: '2026-07-26',
    periodStart: '2026-07-26',
    periodEnd: '2026-07-26',
    dateLabel: 'SUNDAY\n26 JULY',
    timezone: 'Europe/Moscow',
    overview: sectionFixture({
      id: 'overview',
      kind: 'overview',
      text: 'The central issue now is choosing one practical priority.',
      importance: 100,
      sourceTopicKey: 'overview',
    }),
    sections: [
      sectionFixture({
        id: 'mood',
        kind: 'fixed',
        fixedKey: 'mood',
        sourceTopicKey: 'mood',
        title: FORECAST_FIXED_TITLES.en.mood,
        text: 'Mental focus improves when the next task has exact boundaries.',
        importance: 86,
      }),
      sectionFixture({
        id: 'love',
        kind: 'fixed',
        fixedKey: 'love',
        sourceTopicKey: 'love',
        title: FORECAST_FIXED_TITLES.en.love,
        text: 'A direct conversation can define the limits of this relationship.',
        importance: 92,
      }),
      sectionFixture({
        id: 'home_family',
        kind: 'fixed',
        fixedKey: 'home_family',
        sourceTopicKey: 'home_family',
        title: FORECAST_FIXED_TITLES.en.home_family,
        text: 'A household decision benefits from specific roles and deadlines.',
        importance: 80,
      }),
      sectionFixture({
        id: 'friends',
        kind: 'fixed',
        fixedKey: 'friends',
        sourceTopicKey: 'friends',
        title: FORECAST_FIXED_TITLES.en.friends,
        text: 'One useful exchange identifies who will support the concrete plan.',
        importance: 78,
      }),
      sectionFixture({
        id: 'work_money',
        kind: 'fixed',
        fixedKey: 'work_money',
        sourceTopicKey: 'work_money',
        title: FORECAST_FIXED_TITLES.en.work_money,
        text: 'Work advances through a measurable decision about time and cost.',
        importance: 88,
      }),
      sectionFixture({
        id: 'wishes',
        kind: 'wishes',
        fixedKey: 'wishes',
        sourceTopicKey: 'wishes',
        title: FORECAST_WISHES_TITLES.en.day,
        text: 'Use the strongest hours for the decision that already has evidence.',
        importance: 70,
      }),
      sectionFixture({
        id: 'dynamic:business',
        kind: 'dynamic',
        sourceTopicKey: 'business',
        title: 'Business',
        text: 'Commercial progress depends on verifying demand before increasing commitments.',
        importance: 84,
      }),
      sectionFixture({
        id: 'dynamic:study',
        kind: 'dynamic',
        sourceTopicKey: 'study',
        title: 'Study',
        text: 'A defined learning target produces a visible result this period.',
        importance: 76,
      }),
    ],
    suggestedCrossPeriodLinks: [],
    evidence: { e1: evidenceView },
    visual: { sectionAssetIds: {} },
    meta: {
      model: 'gpt-4.1',
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: APP_VOICE_VERSION,
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      generatedAt: '2026-07-26T10:00:00.000Z',
      status: 'ready',
      diagnosticCode: null,
      freeSelection: {
        strongestSectionId: 'love',
        rotatedSectionId: 'mood',
        sectionIds: ['love', 'mood'],
      },
    },
  };
}
