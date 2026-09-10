import {
  PERSONAL_FORECAST_CONTRACT_VERSION,
  buildForecastLockedPreview,
  type ForecastSection,
  type PersonalForecastAccessPayload,
  type PersonalForecastPackage,
} from './personalForecastContract';

/** Bundled in the released RuStore 1.0.0/vc2 and 1.0.2/vc5 clients. */
export const LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION = 'personal-forecast-feed-v25-reference-four-part';

export function resolvePersonalForecastWireVersion(value: unknown): string | null {
  if (value === undefined) return LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION;
  return value === PERSONAL_FORECAST_CONTRACT_VERSION
    || value === LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION ? value : null;
}

type LegacyForecastPackage = Omit<PersonalForecastPackage, 'meta'> & {
  meta: Omit<PersonalForecastPackage['meta'], 'astrologerBrief' | 'semanticSignature'> & {
    astrologerBrief: {
      tone: PersonalForecastPackage['meta']['astrologerBrief']['tone'];
      coreForecast: string;
      secondaryForecast: string | null;
      distinctiveDetail: string;
      opportunity: string | null;
      friction: string | null;
      likelyResult: string;
      briefSignature: string;
    };
    semanticSignature: {
      coreForecast: string;
      secondaryForecast: string | null;
      title: string;
      punchline: string;
      forecast: string;
      closing: string;
    };
    currentGeneration: Pick<PersonalForecastPackage['meta'],
      'contractVersion' | 'semanticVersion' | 'promptVersion' | 'voiceVersion'
      | 'calculationVersion' | 'generationAttempts'>;
  };
};

type LegacyForecastAccessPayload = Omit<PersonalForecastAccessPayload, 'forecast'> & {
  forecast: LegacyForecastPackage;
};

function legacySection(
  source: ForecastSection,
  text: string,
  id: string,
  importance: number,
): ForecastSection {
  const overview = id === 'overview';
  return {
    ...source,
    id,
    kind: overview ? 'overview' : 'dynamic',
    title: overview ? source.title : undefined,
    sourceTopicKey: overview ? 'overview' : undefined,
    fixedKey: undefined,
    presentationStyle: undefined,
    text,
    contentBlocks: [{ ...source.contentBlocks[0], id: `${id}:wire`, text }],
    semanticFingerprint: `${source.semanticFingerprint}:wire-v25:${id}`,
    importance,
    lockedPreview: buildForecastLockedPreview(text, source.premiumTeaser),
  };
}

/** Shape-only slots: both released Today readers omit locked sections entirely. */
function closedLegacySlot(source: ForecastSection, id: string): ForecastSection {
  return {
    ...legacySection(source, '', id, 0),
    contentBlocks: [],
    semanticFactIds: [],
    semanticFingerprint: '',
    explanationAnchors: [],
    visualCue: null,
    premiumTeaser: 'NEBO',
    lockedPreview: { lead: 'NEBO', blurred: '', teaser: 'NEBO' },
  };
}

/** Adapt the already authorized response, never generate or persist another forecast. */
export function projectPersonalForecastForWire(
  payload: PersonalForecastAccessPayload,
  wireVersion: string,
): PersonalForecastAccessPayload | LegacyForecastAccessPayload {
  if (payload.periodLocked || (payload.accessTier === 'free' && payload.forecast.period !== 'day')) {
    throw new Error('PERSONAL_FORECAST_PREMIUM_REQUIRED');
  }
  if (wireVersion === PERSONAL_FORECAST_CONTRACT_VERSION) return payload;
  if (wireVersion !== LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION) {
    throw new Error('PERSONAL_FORECAST_CONTRACT_UNSUPPORTED');
  }

  const original = payload.forecast;
  const brief = original.meta.astrologerBrief;
  const signature = original.meta.semanticSignature;
  const closing = original.sections[0];
  let overview = legacySection(original.overview, original.overview.text, 'overview', 100);
  let sections = [legacySection(closing, closing.text, closing.id, 90)];
  let lockedSectionIds = [...payload.lockedSectionIds];
  let freeSelection = original.meta.freeSelection;
  if (original.period === 'day') {
    if (payload.accessTier === 'free') {
      // The whole free reading remains visible. The old validator requires
      // three trailing sections, but accepts at most two free section IDs.
      sections.push(
        closedLegacySlot(original.overview, 'semantic:legacy-slot:1'),
        closedLegacySlot(original.overview, 'semantic:legacy-slot:2'),
      );
      lockedSectionIds = sections.slice(1).map((section) => section.id);
      freeSelection = { strongestSectionId: closing.id, rotatedSectionId: null, sectionIds: [closing.id] };
    } else {
      // Current Day generation guarantees 3–4 sentences. Keep every sentence
      // exactly once and in order; the last fragment may contain two sentences.
      const sentences = original.overview.text.trim().split(/(?<=[.!?…][»”"')\]]*)\s+/u);
      if (sentences.length < 3) throw new Error('PERSONAL_FORECAST_LEGACY_STRUCTURE_UNSUPPORTED');
      overview = legacySection(original.overview, sentences[0], 'overview', 100);
      sections = [
        legacySection(original.overview, sentences[1], 'semantic:legacy-body:1', 90),
        legacySection(original.overview, sentences.slice(2).join(' '), 'semantic:legacy-body:2', 70),
        legacySection(closing, closing.text, closing.id, 80),
      ];
      freeSelection = {
        strongestSectionId: sections[0].id,
        rotatedSectionId: closing.id,
        sectionIds: [sections[0].id, closing.id],
      };
    }
  }

  return {
    ...payload,
    lockedSectionIds,
    forecast: {
      ...original,
      overview,
      sections,
      visual: {
        sectionAssetIds: Object.fromEntries(Object.entries(original.visual.sectionAssetIds)
          .filter(([id]) => id === overview.id || sections.some((section) => section.id === id))),
      },
      meta: {
        ...original.meta,
        contractVersion: LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION,
        semanticVersion: LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION,
        promptVersion: 'personal-forecast-feed.v42-reference-four-part+forecast-voice.9',
        voiceVersion: '9',
        calculationVersion: 'personal-forecast-luna-raw-profile-brief-v7',
        generationAttempts: Math.min(2, original.meta.generationAttempts) as 0 | 1 | 2,
        currentGeneration: {
          contractVersion: original.meta.contractVersion,
          semanticVersion: original.meta.semanticVersion,
          promptVersion: original.meta.promptVersion,
          voiceVersion: original.meta.voiceVersion,
          calculationVersion: original.meta.calculationVersion,
          generationAttempts: original.meta.generationAttempts,
        },
        astrologerBrief: {
          tone: brief.tone,
          coreForecast: brief.observations[0],
          secondaryForecast: brief.observations[1] || null,
          distinctiveDetail: brief.observations.at(-1)!,
          opportunity: null,
          friction: null,
          likelyResult: signature.outcome,
          briefSignature: brief.briefSignature,
        },
        semanticSignature: {
          coreForecast: signature.situation,
          secondaryForecast: signature.turn || null,
          title: signature.title,
          punchline: signature.title,
          forecast: signature.forecast,
          closing: signature.closing,
        },
        freeSelection,
      },
    },
  };
}
