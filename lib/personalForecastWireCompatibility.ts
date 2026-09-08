import {
  PERSONAL_FORECAST_CONTRACT_VERSION,
  buildForecastLockedPreview,
  type ForecastSection,
  type PersonalForecastAccessPayload,
  type PersonalForecastPackage,
} from './personalForecastContract';

/** Bundled in the released RuStore 1.0.0/vc2 and 1.0.2/vc5 clients. */
export const LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION = 'personal-forecast-feed-v25-reference-four-part';

/** Bundled in the released RuStore 1.0.3/vc6 and 1.0.4/vc7 clients. */
export const RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION = 'personal-forecast-feed-v29-period-horoscope';

// These readers share the current prose structure, but validate every identity
// field exactly. Keep their wire identities independent of the generator cache.
const RELEASED_READING_PROMPTS: Readonly<Record<string, string>> = {
  [RELEASED_PERSONAL_FORECAST_CONTRACT_VERSION]: 'personal-forecast-feed.v47-period-horoscope+forecast-voice.16',
  'personal-forecast-feed-v30-nebo-human-voice': 'personal-forecast-feed.v48-nebo-human-voice+forecast-voice.16',
};

export function resolvePersonalForecastWireVersion(value: unknown): string | null {
  if (value === undefined) return LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION;
  return value === PERSONAL_FORECAST_CONTRACT_VERSION
    || value === LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION
    || (typeof value === 'string' && Object.hasOwn(RELEASED_READING_PROMPTS, value)) ? value : null;
}

type CurrentGenerationIdentity = Pick<PersonalForecastPackage['meta'],
  'contractVersion' | 'semanticVersion' | 'promptVersion' | 'voiceVersion'
  | 'calculationVersion' | 'generationAttempts'>;

type ReleasedReadingAccessPayload = Omit<PersonalForecastAccessPayload, 'forecast'> & {
  forecast: Omit<PersonalForecastPackage, 'meta'> & {
    meta: PersonalForecastPackage['meta'] & { currentGeneration: CurrentGenerationIdentity };
  };
};

function generationIdentity(forecast: PersonalForecastPackage): CurrentGenerationIdentity {
  return {
    contractVersion: forecast.meta.contractVersion,
    semanticVersion: forecast.meta.semanticVersion,
    promptVersion: forecast.meta.promptVersion,
    voiceVersion: forecast.meta.voiceVersion,
    calculationVersion: forecast.meta.calculationVersion,
    generationAttempts: forecast.meta.generationAttempts,
  };
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
    currentGeneration: CurrentGenerationIdentity;
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
function sectionedReading(original: PersonalForecastPackage): PersonalForecastPackage {
  if (original.sections.length) return original;
  const sentences = original.overview.text.trim().split(/(?<=[.!?…])\s+/u);
  const ending = sentences.length > 1 ? sentences.pop()! : '';
  if (!ending) throw new Error('PERSONAL_FORECAST_LEGACY_STRUCTURE_UNSUPPORTED');
  const overview = legacySection(original.overview, sentences.join(' '), 'overview', 100);
  const closing = legacySection(original.overview, ending, 'semantic:legacy-ending', 90);
  closing.contentBlocks[0].role = 'action';
  const words = original.overview.text.trim().split(/\s+/u).slice(0, 180);
  const chunkSize = Math.max(8, Math.ceil(words.length / Math.min(4, Math.max(2, Math.ceil(words.length / 45)))));
  const observations = Array.from({ length: Math.ceil(words.length / chunkSize) }, (_, index) => words.slice(index * chunkSize, (index + 1) * chunkSize).join(' '));
  return { ...original, overview, sections: [closing], visual: { sectionAssetIds: { overview: null, [closing.id]: null } },
    meta: { ...original.meta,
      astrologerBrief: { tone: 'mixed', observations, briefSignature: 'direct-prose-wire-adapter' },
      semanticSignature: { ...original.meta.semanticSignature, closing: ending },
      freeSelection: original.period === 'day' ? { strongestSectionId: closing.id, rotatedSectionId: null, sectionIds: [closing.id] } : original.meta.freeSelection,
    } };
}

export function projectPersonalForecastForWire(
  payload: PersonalForecastAccessPayload,
  wireVersion: string,
): PersonalForecastAccessPayload | LegacyForecastAccessPayload | ReleasedReadingAccessPayload {
  if (payload.periodLocked || (payload.accessTier === 'free' && payload.forecast.period !== 'day')) {
    throw new Error('PERSONAL_FORECAST_PREMIUM_REQUIRED');
  }
  if (wireVersion === PERSONAL_FORECAST_CONTRACT_VERSION) return payload;
  if (Object.hasOwn(RELEASED_READING_PROMPTS, wireVersion)) {
    const compatible = sectionedReading(payload.forecast);
    return {
      ...payload,
      forecast: {
        ...compatible,
        meta: {
          ...compatible.meta,
          contractVersion: wireVersion,
          semanticVersion: wireVersion,
          promptVersion: RELEASED_READING_PROMPTS[wireVersion],
          voiceVersion: '16',
          calculationVersion: 'personal-forecast-luna-raw-profile-brief-v12',
          currentGeneration: generationIdentity(payload.forecast),
        },
      },
    };
  }
  if (wireVersion !== LEGACY_PERSONAL_FORECAST_CONTRACT_VERSION) {
    throw new Error('PERSONAL_FORECAST_CONTRACT_UNSUPPORTED');
  }

  const original = sectionedReading(payload.forecast);
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
      // Keep existing sentences once and in order in the older four-slot reader.
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
        currentGeneration: generationIdentity(original),
        astrologerBrief: {
          tone: brief.tone,
          coreForecast: brief.observations[0] || original.overview.text,
          secondaryForecast: brief.observations[1] || null,
          distinctiveDetail: brief.observations.at(-1) || closing.text,
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
