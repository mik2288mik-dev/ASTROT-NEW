import type { UserProfile } from '../types';
import { APP_VOICE_VERSION } from './appVoice';
import {
  AI_PERSONAL_HOROSCOPE_CONTENT_MODE,
  AI_PERSONAL_HOROSCOPE_EVIDENCE_ID,
  type AiPersonalHoroscopePackage,
} from './aiPersonalHoroscope';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  formatPersonalForecastDateLabel,
  getPersonalForecastPackageValidationError,
  selectTodayFreeSections,
  type ForecastContentBlock,
  type ForecastContentBlockRole,
  type ForecastSection,
  type PersonalForecastPeriod,
  type PersonalForecastWindow,
} from './personalForecastContract';
import {
  buildAiPersonalHoroscopeSemanticFingerprint,
  type ValidatedHoroscope,
} from './aiPersonalHoroscopeVoice';

function makeSection(input: {
  id: string;
  kind: 'overview' | 'dynamic';
  text: string;
  blocks: Array<{ role: ForecastContentBlockRole; text: string; atomId: string }>;
  importance: number;
  language: 'ru' | 'en';
  semanticFingerprint: string;
}): ForecastSection {
  const factId = AI_PERSONAL_HOROSCOPE_EVIDENCE_ID;
  const anchorId = `anchor:${input.id}`;
  const contentBlocks: ForecastContentBlock[] = input.blocks.map((block, index) => ({
    id: `${input.id}:${block.role}:${index + 1}`,
    role: block.role,
    text: block.text,
    semanticFactId: factId,
    atomId: block.atomId,
    explanationAnchorId: index === 0 ? anchorId : null,
  }));
  const sectionText = input.text || contentBlocks.map((block) => block.text.trim()).join('\n\n');
  const teaser = input.language === 'ru'
    ? 'Продолжение личного гороскопа доступно в Premium.'
    : 'The rest of your personal horoscope is available with Premium.';

  return {
    id: input.id,
    kind: input.kind,
    status: 'ready',
    diagnosticCode: null,
    sourceTopicKey: input.kind === 'overview' ? 'overview' : undefined,
    text: sectionText,
    contentBlocks,
    semanticFactIds: [factId],
    semanticFingerprint: input.semanticFingerprint,
    importance: input.importance,
    visualTag: input.kind === 'overview' ? 'ai-opening' : input.id.replace(/^semantic:/u, 'ai-'),
    visualCue: null,
    premiumTeaser: teaser,
    lockedPreview: buildForecastLockedPreview(sectionText, teaser),
    explanationAnchors: [{
      id: anchorId,
      conclusion: contentBlocks[0]?.text || sectionText,
      explanation: 'AI-only personal horoscope generated from the saved profile, selected period, recent forecasts and conversation context.',
      evidenceIds: [factId],
    }],
    inlineAstroAccent: null,
  };
}

export function buildAiPersonalHoroscopePackage(input: {
  profile: UserProfile;
  language: 'ru' | 'en';
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  model: string;
  value: ValidatedHoroscope;
  attempts: 1 | 2;
}): AiPersonalHoroscopePackage {
  const readingFingerprint = buildAiPersonalHoroscopeSemanticFingerprint({
    version: 2,
    kind: 'reading',
    domain: input.value.memory.primaryDomain,
    idea: input.value.memory.mainIdeaKey,
    situation: input.value.memory.situationKey,
    turn: input.value.memory.turnKey,
    irony: input.value.memory.ironyKey,
    adviceKeys: input.value.memory.adviceKeys,
  });
  const adviceFingerprints = input.value.memory.adviceKeys.map((adviceKey) => (
    buildAiPersonalHoroscopeSemanticFingerprint({
      version: 2,
      kind: 'advice',
      domain: input.value.memory.primaryDomain,
      advice: adviceKey,
    })
  ));

  const overview = makeSection({
    id: 'overview',
    kind: 'overview',
    text: input.period === 'day' ? input.value.opening : '',
    blocks: input.period === 'day'
      ? [{ role: 'lead', text: input.value.opening, atomId: 'ai_opening' }]
      : [
          { role: 'lead', text: input.value.opening, atomId: 'ai_opening' },
          { role: 'detail', text: input.value.forecast, atomId: 'ai_forecast' },
          ...input.value.advice.map((advice, index) => ({
            role: 'action' as const,
            text: advice,
            atomId: `ai_advice_${index + 1}`,
          })),
        ],
    importance: 100,
    language: input.language,
    semanticFingerprint: readingFingerprint,
  });

  const sections = input.period === 'day'
    ? [
        makeSection({
          id: 'semantic:forecast',
          kind: 'dynamic',
          text: input.value.forecast,
          blocks: [{ role: 'detail', text: input.value.forecast, atomId: 'ai_forecast' }],
          importance: 100,
          language: input.language,
          semanticFingerprint: readingFingerprint,
        }),
        ...input.value.advice.map((advice, index) => makeSection({
          id: `semantic:advice-${index + 1}`,
          kind: 'dynamic',
          text: advice,
          blocks: [{ role: 'action', text: advice, atomId: `ai_advice_${index + 1}` }],
          importance: 72 - index,
          language: input.language,
          semanticFingerprint: adviceFingerprints[index],
        })),
      ]
    : [];

  const freeSelection = input.period === 'day'
    ? selectTodayFreeSections({
        sections,
        userId: String(input.profile.id || 'guest'),
        periodKey: input.window.periodKey,
      })
    : {
        strongestSectionId: null,
        rotatedSectionId: null,
        sectionIds: [],
      };

  const forecast: AiPersonalHoroscopePackage = {
    period: input.period,
    periodKey: input.window.periodKey,
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    dateLabel: formatPersonalForecastDateLabel(input.window, input.language),
    timezone: input.window.timezone,
    overview,
    sections,
    suggestedCrossPeriodLinks: [],
    evidence: {
      [AI_PERSONAL_HOROSCOPE_EVIDENCE_ID]: {
        id: AI_PERSONAL_HOROSCOPE_EVIDENCE_ID,
        factor: 'AI horoscope profile and continuity context',
        orb: null,
        status: 'active',
        period: input.window.periodKey,
        meaning: 'Luna generated this horoscope from the user profile, selected period, recent forecasts and saved conversation context without Swiss Ephemeris or natal chart input.',
      },
    },
    visual: { sectionAssetIds: {} },
    meta: {
      model: input.model,
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: APP_VOICE_VERSION,
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      semanticVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
      generationAttempts: input.attempts,
      validationStatus: 'valid',
      generatedAt: new Date().toISOString(),
      status: 'ready',
      diagnosticCode: null,
      freeSelection,
      contentMode: AI_PERSONAL_HOROSCOPE_CONTENT_MODE,
    },
  };

  const validationError = getPersonalForecastPackageValidationError(forecast);
  if (validationError) {
    throw new Error(`PERSONAL_FORECAST_PACKAGE_INVALID:${validationError}`);
  }
  return forecast;
}
