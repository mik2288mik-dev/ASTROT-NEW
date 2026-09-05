import type { NatalChartData } from '../types';
import { PERSONAL_FORECAST_VOICE_VERSION } from '../lib/appVoice';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  type ForecastContentBlockRole,
  type ForecastEvidenceView,
  type ForecastSection,
  type PersonalForecastPackage,
} from '../lib/personalForecastContract';

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
  meaning: 'This calculated factor supports a temporary increase in direct action.',
};

function sectionFixture(input: {
  id: string;
  title?: string;
  importance: number;
  fingerprint: string;
  factId: string;
  blocks: Array<{ role: ForecastContentBlockRole; atomId: string; text: string }>;
  overview?: boolean;
}): ForecastSection {
  const anchorId = `anchor:${input.id}`;
  const contentBlocks = input.blocks.map((item, index) => ({
    id: `${input.id}:${item.role}:${index + 1}`,
    role: item.role,
    text: item.text,
    semanticFactId: input.factId,
    atomId: item.atomId,
    explanationAnchorId: index === 0 ? anchorId : null,
  }));
  const text = contentBlocks.map((item) => item.text).join('\n\n');
  const premiumTeaser = `Open the full ${input.title || 'forecast'} reading for the concrete risk and next step.`;
  return {
    id: input.id,
    kind: input.overview ? 'overview' : 'dynamic',
    status: 'ready',
    diagnosticCode: null,
    title: input.title,
    sourceTopicKey: input.overview ? 'overview' : undefined,
    text,
    contentBlocks,
    semanticFactIds: [input.factId],
    semanticFingerprint: input.fingerprint,
    importance: input.importance,
    visualTag: input.title?.toLowerCase().replace(/\s+/g, '-') || 'overview',
    premiumTeaser,
    lockedPreview: buildForecastLockedPreview(text, premiumTeaser),
    explanationAnchors: [{
      id: anchorId,
      conclusion: contentBlocks[0].text,
      explanation: 'Mars trine Sun. This is a temporary calculated factor for the selected period.',
      evidenceIds: ['e1'],
    }],
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
      title: 'A precise turn',
      importance: 100,
      fingerprint: 'overview:fixture',
      factId: 'fact:overview',
      overview: true,
      blocks: [
        {
          role: 'detail',
          atomId: 'forecast_body',
          text: 'A familiar task reveals the detail that needs a precise answer. The conversation quickly becomes concrete, and the next decision is easier to make.',
        },
      ],
    }),
    sections: [
      sectionFixture({
        id: 'semantic:closing',
        importance: 90,
        fingerprint: 'semantic:closing',
        factId: 'fact:communication',
        blocks: [
          { role: 'action', atomId: 'closing', text: 'Check the details, then answer without extra explanations.' },
        ],
      }),
    ],
    suggestedCrossPeriodLinks: [],
    evidence: { e1: evidenceView },
    visual: { sectionAssetIds: {} },
    meta: {
      model: 'gpt-4.1',
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: PERSONAL_FORECAST_VOICE_VERSION,
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      semanticVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      generationAttempts: 1,
      validationStatus: 'valid',
      generatedAt: '2026-07-26T10:00:00.000Z',
      status: 'ready',
      diagnosticCode: null,
      astrologerBrief: {
        tone: 'mixed',
        situation: 'знакомое дело получает ответ',
        turn: 'короткий разговор меняет решение',
        outcome: 'следующий шаг становится понятен',
        observableDetail: 'короткий ответ вместо долгого спора',
        briefSignature: 'fixture-brief',
      },
      semanticSignature: {
        situation: 'знакомое дело получает ответ',
        turn: 'короткий разговор меняет решение',
        outcome: 'следующий шаг становится понятен',
        title: 'A precise turn',
        forecast: 'A familiar task reveals the detail that needs a precise answer. The conversation quickly becomes concrete, and the next decision is easier to make.',
        closing: 'Check the details, then answer without extra explanations.',
      },
      freeSelection: {
        strongestSectionId: 'semantic:closing',
        rotatedSectionId: null,
        sectionIds: ['semantic:closing'],
      },
    },
  };
}

/** Question-product fixture retained separately from the canonical three-part forecast package. */
export function personalForecastQuestionFixture(): PersonalForecastPackage {
  const forecast = personalForecastFixture();
  const sections = [
    sectionFixture({
      id: 'semantic:communication',
      title: 'Conversations and decisions',
      importance: 92,
      fingerprint: 'semantic:communication',
      factId: 'fact:communication',
      blocks: [
        { role: 'detail', atomId: 'details_require_review', text: 'Wording, numbers, and sequence need another check before you answer.' },
        { role: 'risk', atomId: 'impulsive_reply_or_missed_detail', text: 'The main risk is an impulsive reply or a missed detail.' },
        { role: 'action', atomId: 'verify_wording_numbers_and_sequence', text: 'Check the wording, numbers, and order of steps.' },
      ],
    }),
    sectionFixture({
      id: 'semantic:boundaries',
      title: 'Action and boundaries',
      importance: 86,
      fingerprint: 'semantic:boundaries',
      factId: 'fact:boundaries',
      blocks: [
        { role: 'lead', atomId: 'action_and_boundaries_are_temporarily_active', text: 'Pace of action and personal boundaries are the central issue now.' },
        { role: 'detail', atomId: 'boundary_response_becomes_more_noticeable', text: 'Pressure is more likely to trigger a direct response or refusal.' },
        { role: 'action', atomId: 'choose_the_next_action_not_the_whole_battle', text: 'Choose the next concrete action, not the whole battle.' },
      ],
    }),
    sectionFixture({
      id: 'semantic:workload',
      title: 'Work and workload',
      importance: 78,
      fingerprint: 'semantic:workload',
      factId: 'fact:workload',
      blocks: [
        { role: 'lead', atomId: 'limits_and_commitments_are_temporarily_active', text: 'Limits and commitments cannot be left unchecked right now.' },
        { role: 'detail', atomId: 'routine_or_workload_context_becomes_more_noticeable', text: 'The main manifestations come through schedules, workload, and daily routines.' },
        { role: 'risk', atomId: 'ignoring_a_real_limit_or_commitment', text: 'The main risk is ignoring a real limit or commitment.' },
      ],
    }),
  ];
  return {
    ...forecast,
    sections,
    visual: {
      sectionAssetIds: Object.fromEntries(
        [forecast.overview, ...sections].map((section) => [section.id, null]),
      ),
    },
    meta: {
      ...forecast.meta,
      freeSelection: {
        strongestSectionId: 'semantic:communication',
        rotatedSectionId: 'semantic:boundaries',
        sectionIds: ['semantic:communication', 'semantic:boundaries'],
      },
    },
  };
}
