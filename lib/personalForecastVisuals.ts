import type { CSSProperties } from 'react';
import {
  EDITORIAL_PLACEMENT_POLICY,
  selectPersonalEditorialAsset,
} from './personalForecastVisuals/editorialSelectors';
import type {
  DiaryEligibleAsset,
  EditorialTopic,
} from './personalForecastVisuals/editorialTypes';
import {
  PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION,
  type FixedForecastSectionKey,
  type ForecastSectionKind,
  type ForecastTopicKey,
  type ForecastVisualCue,
  type PersonalForecastPeriod,
} from './personalForecastContract';

export type ForecastVisualSectionInput = {
  id: string;
  kind: ForecastSectionKind;
  fixedKey?: FixedForecastSectionKey;
  sourceTopicKey?: ForecastTopicKey;
  visualTag: string;
  visualCue?: ForecastVisualCue | null;
};

export type ForecastVisualFeedInput = {
  period: PersonalForecastPeriod;
  periodKey: string;
  overview: ForecastVisualSectionInput;
  sections: readonly ForecastVisualSectionInput[];
};

export type ForecastVisualRequest = ForecastVisualSectionInput & {
  userId: string;
  period: PersonalForecastPeriod;
  periodKey: string;
  sectionId: string;
  sectionIndex: number;
};

export type ForecastVisualAssignment = {
  sectionId: string;
  assetId: string | null;
  path: string | null;
  width: number | null;
  height: number | null;
  sourceCategory: 'personal' | null;
  textSide: 'center';
  crop: { desktop: { position: string; scale: number }; mobile: { position: string; scale: number } };
  mirrorX: false;
  overlayPreset: 'milky';
  overlay: string;
  paletteTag: string | null;
  compositionTag: string | null;
  cue: ForecastVisualCue | null;
  visualFallback: boolean;
};

export type ForecastVisualScreen = {
  version: string;
  sectionIds: string[];
  assignments: Record<string, ForecastVisualAssignment>;
  sectionAssetIds: Record<string, string | null>;
  visualFallback: boolean;
};

export type DiaryEditorialPause = {
  afterSectionId: string;
  asset: DiaryEligibleAsset;
};

type Theme = 'general' | 'love' | 'mood' | 'work_money' | 'home_family' | 'friends' | 'opportunities' | 'decisions' | 'communication' | 'questions' | 'moon' | 'mercury';
type Lightness = 'light' | 'medium' | 'dark';

const TAG_THEMES: Record<string, readonly Theme[]> = {
  overview: ['general'], love: ['love'], mood: ['mood'], home: ['home_family'], home_family: ['home_family'], friends: ['friends'],
  'work-money': ['work_money'], work_money: ['work_money'], wishes: ['opportunities'], career: ['work_money'], technology: ['communication'],
  business: ['work_money'], money: ['work_money'], 'career-change': ['opportunities'], career_change: ['opportunities'], study: ['communication'],
  creativity: ['mood'], relocation: ['opportunities'], property: ['home_family'], confidence: ['mood'], decision: ['decisions'], future: ['opportunities'],
  rest: ['mood'], movement: ['mood'], documents: ['communication'],
  moon: ['moon'], luna: ['moon'], lunar: ['moon'],
  mercury: ['mercury'], mercurial: ['mercury'], retrograde: ['mercury'],
  identity_priorities: ['decisions'],
  emotional_response: ['mood'],
  communication_decisions: ['communication'],
  values_agreements: ['decisions', 'love'],
  action_boundaries: ['decisions'],
  growth_judgment: ['opportunities'],
  responsibility_limits: ['work_money'],
  self_presentation: ['mood'],
  change_autonomy: ['opportunities', 'decisions'],
  imagination_clarity: ['mood', 'decisions'],
  power_control: ['decisions'],
  cycle_attention: ['opportunities'],
  personal_resources: ['work_money'],
  communication_learning: ['communication'],
  home_foundation: ['home_family'],
  creative_expression: ['mood'],
  work_routines: ['work_money'],
  partnerships: ['communication', 'love'],
  shared_resources: ['work_money'],
  study_travel: ['opportunities'],
  career_public_role: ['work_money'],
  groups_networks: ['friends'],
  rest_private_life: ['mood'],
};
const SOURCE_THEMES: Partial<Record<ForecastTopicKey, readonly Theme[]>> = {
  overview: ['general'], love: ['love'], mood: ['mood'], home_family: ['home_family'], friends: ['friends'], work_money: ['work_money'],
  wishes: ['opportunities'], professional_path: ['work_money'], it_direction: ['communication'], business: ['work_money'], income_growth: ['work_money'],
  work_change: ['opportunities'], study: ['communication'], creativity: ['mood'], relocation: ['opportunities'], property_decision: ['home_family'],
  self_confidence: ['mood'], important_decision: ['decisions'], future_direction: ['opportunities'], rest_recovery: ['mood'], physical_activity: ['mood'], documents_agreements: ['communication'],
};
const FALLBACK: Record<PersonalForecastPeriod, { accent: string; soft: string }> = {
  day: { accent: '#f59d83', soft: '#fff2e9' }, week: { accent: '#7ea9e8', soft: '#edf4ff' }, month: { accent: '#a88ac4', soft: '#f4eff9' },
};
const MILKY_OVERLAY = 'linear-gradient(180deg, rgba(251,250,247,1) 0%, rgba(251,250,247,0.86) 20%, rgba(251,250,247,0.58) 46%, rgba(251,250,247,0.64) 66%, rgba(251,250,247,0.9) 86%, rgba(251,250,247,1) 100%)';
const VISUAL_TREATMENT: Record<
  Lightness,
  { opacity: number; saturation: number; brightness: number }
> = {
  light: { opacity: 0.52, saturation: 0.68, brightness: 1.08 },
  medium: { opacity: 0.44, saturation: 0.58, brightness: 1.12 },
  dark: { opacity: 0.34, saturation: 0.5, brightness: 1.18 },
};

function normalise(value: string) { return value.trim().toLowerCase().replace(/[\s/]+/g, '-'); }
function themesFor(request: ForecastVisualRequest): readonly Theme[] {
  if (request.visualCue) return [request.visualCue];
  const tag = normalise(request.visualTag);
  return TAG_THEMES[tag] || TAG_THEMES[tag.replace(/-/g, '_')] || (request.sourceTopicKey ? SOURCE_THEMES[request.sourceTopicKey] || ['general'] : ['general']);
}

const EDITORIAL_TOPIC_BY_THEME: Record<Theme, EditorialTopic> = {
  general: 'general',
  love: 'love',
  mood: 'mood',
  work_money: 'work_money',
  home_family: 'home_family',
  friends: 'friends',
  opportunities: 'opportunities',
  decisions: 'decisions',
  communication: 'communication',
  questions: 'communication',
  moon: 'moon',
  mercury: 'mercury',
};

/**
 * Chooses a few decorative pauses for a continuous reading. The model supplies
 * only a semantic cue; exact assets and placement remain application-owned.
 */
export function resolveDiaryEditorialPauses(input: {
  userId: string;
  period: PersonalForecastPeriod;
  periodKey: string;
  sections: readonly ForecastVisualSectionInput[];
  excludeAssetIds?: readonly string[];
}): DiaryEditorialPause[] {
  if (!input.sections.length) return [];
  const requests = input.sections.map((section, sectionIndex): ForecastVisualRequest => ({
    ...section,
    userId: input.userId,
    period: input.period,
    periodKey: input.periodKey,
    sectionId: section.id,
    sectionIndex,
  }));
  const maximumPauses = input.period === 'day' && requests.length >= 5
    ? EDITORIAL_PLACEMENT_POLICY.diary.maxPauses
    : 1;
  const anchorIndexes = maximumPauses === 1
    ? [Math.min(requests.length - 1, Math.floor(requests.length / 2))]
    : Array.from({ length: maximumPauses }, (_, index) => (
        Math.min(
          requests.length - 1,
          Math.floor(((index + 1) * requests.length) / (maximumPauses + 1)),
        )
      ));
  const excluded = new Set(input.excludeAssetIds || []);
  const pauses: DiaryEditorialPause[] = [];

  for (const [slot, anchorIndex] of anchorIndexes.entries()) {
    const request = requests[anchorIndex];
    if (!request) continue;
    const asset = selectPersonalEditorialAsset({
      period: input.period,
      periodKey: `${input.periodKey}|${request.sectionId}`,
      userId: input.userId,
      topics: themesFor(request).map((theme) => EDITORIAL_TOPIC_BY_THEME[theme]),
      excludeIds: [...excluded],
      slot,
      forceVisible: input.period !== 'day',
    });
    if (!asset) continue;
    excluded.add(asset.id);
    pauses.push({ afterSectionId: request.sectionId, asset });
  }

  return pauses;
}

function fallbackAssignment(request: ForecastVisualRequest): ForecastVisualAssignment {
  return { sectionId: request.sectionId, assetId: null, path: null, width: null, height: null, sourceCategory: null, textSide: 'center', crop: { desktop: { position: '50% 50%', scale: 1 }, mobile: { position: '50% 50%', scale: 1 } }, mirrorX: false, overlayPreset: 'milky', overlay: MILKY_OVERLAY, paletteTag: null, compositionTag: null, cue: request.visualCue || null, visualFallback: true };
}
export function buildForecastVisualRequests(input: { userId: string; forecast: ForecastVisualFeedInput }): ForecastVisualRequest[] {
  return [input.forecast.overview, ...input.forecast.sections].map((section, sectionIndex) => ({ ...section, userId: input.userId, period: input.forecast.period, periodKey: input.forecast.periodKey, sectionId: section.id, sectionIndex }));
}
export const buildForecastSectionVisualRequests = buildForecastVisualRequests;
export function resolveForecastVisualScreen(requests: readonly ForecastVisualRequest[], options?: {
  previousSectionAssetPaths?: Readonly<Record<string, string | null | undefined>>;
  excludeAssetIds?: readonly string[];
}): ForecastVisualScreen {
  const assignments: Record<string, ForecastVisualAssignment> = {};
  const ordered = [...requests].sort((left, right) => left.sectionIndex - right.sectionIndex);
  const visualRequest = ordered[0];
  const editorialAsset = visualRequest
    ? selectPersonalEditorialAsset({
        period: visualRequest.period,
        periodKey: visualRequest.periodKey,
        userId: visualRequest.userId,
        topics: themesFor(visualRequest).map((theme) => EDITORIAL_TOPIC_BY_THEME[theme]),
        excludeIds: options?.excludeAssetIds,
        forceVisible: true,
      })
    : null;
  for (const request of ordered) {
    const asset = request.sectionId === visualRequest?.sectionId ? editorialAsset : null;
    assignments[request.sectionId] = asset
      ? {
          sectionId: request.sectionId,
          assetId: asset.id,
          path: asset.path,
          width: asset.width,
          height: asset.height,
          sourceCategory: 'personal',
          textSide: 'center',
          crop: {
            desktop: { position: '100% 100%', scale: 1 },
            mobile: { position: '100% 100%', scale: 1 },
          },
          mirrorX: false,
          overlayPreset: 'milky',
          overlay: MILKY_OVERLAY,
          paletteTag: 'medium',
          compositionTag: asset.medium,
          cue: request.visualCue || null,
          visualFallback: false,
        }
      : fallbackAssignment(request);
  }
  const sectionIds = ordered.map((request) => request.sectionId);
  return {
    version: PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION,
    sectionIds,
    assignments,
    sectionAssetIds: Object.fromEntries(sectionIds.map((id) => [id, assignments[id]?.assetId || null])),
    visualFallback: !editorialAsset,
  };
}
export const resolveForecastSectionVisuals = resolveForecastVisualScreen;
export function resolvePersonalForecastVisuals(input: {
  userId: string;
  forecast: ForecastVisualFeedInput;
  previousSectionAssetPaths?: Readonly<Record<string, string | null | undefined>>;
  excludeAssetIds?: readonly string[];
}): ForecastVisualScreen {
  return resolveForecastVisualScreen(buildForecastVisualRequests(input), {
    previousSectionAssetPaths: input.previousSectionAssetPaths,
    excludeAssetIds: input.excludeAssetIds,
  });
}
export function getForecastVisualAssignment(screen: ForecastVisualScreen, sectionId: string) { return screen.assignments[sectionId] || null; }
type ForecastVisualStyle = CSSProperties & {
  '--forecast-section-image'?: string;
  '--forecast-section-position'?: string;
  '--forecast-section-position-mobile'?: string;
  '--forecast-section-scale'?: string;
  '--forecast-section-scale-mobile'?: string;
  '--forecast-section-mirror'?: string;
  '--forecast-section-overlay'?: string;
  '--forecast-section-media-opacity'?: string;
  '--forecast-section-media-saturation'?: string;
  '--forecast-section-media-brightness'?: string;
  '--forecast-section-fallback-accent'?: string;
  '--forecast-section-fallback-soft'?: string;
};
export function forecastVisualStyle(assignment: ForecastVisualAssignment | null | undefined, period: PersonalForecastPeriod): ForecastVisualStyle {
  if (assignment?.path) {
    const treatment = VISUAL_TREATMENT[
      assignment.paletteTag === 'light'
        || assignment.paletteTag === 'dark'
        ? assignment.paletteTag
        : 'medium'
    ];
    return {
      '--forecast-section-image': `url("${assignment.path}")`,
      '--forecast-section-position': assignment.crop.desktop.position,
      '--forecast-section-position-mobile': assignment.crop.mobile.position,
      '--forecast-section-scale': String(assignment.crop.desktop.scale),
      '--forecast-section-scale-mobile': String(assignment.crop.mobile.scale),
      '--forecast-section-mirror': '1',
      '--forecast-section-overlay': assignment.overlay,
      '--forecast-section-media-opacity': String(treatment.opacity),
      '--forecast-section-media-saturation': String(treatment.saturation),
      '--forecast-section-media-brightness': String(treatment.brightness),
    };
  }
  const fallback = FALLBACK[period];
  return { '--forecast-section-fallback-accent': fallback.accent, '--forecast-section-fallback-soft': fallback.soft, '--forecast-section-overlay': MILKY_OVERLAY };
}
export const forecastSectionVisualStyle = forecastVisualStyle;

export {
  PERSONAL_VISUAL_MANIFEST_VERSION,
  EDITORIAL_PLACEMENT_POLICY,
  getPersonalEditorialAssetLibrary,
  getPersonalPaperTemplateLibrary,
  selectNatalEditorialSticker,
  selectPersonalEditorialAsset,
  selectSynastryEditorialSticker,
} from './personalForecastVisuals/editorialSelectors';
export {
  DIARY_LAYOUTS,
  DIARY_TODAY_VISUAL_ENGINE_VERSION,
  DIARY_VISUAL_FAMILY_WEIGHTS,
  clampDiaryVisualSize,
  resolveDiaryTodayVisualPlan,
} from './personalForecastVisuals/diaryVisualEngine';
export type {
  EditorialAssetBase,
  DiaryEligibleAsset,
  DiaryPaperTemplateAsset,
  DiaryVisualFamily,
  DiaryVisualDisplayWeight,
  DiaryVisualRarity,
  EditorialOrientation,
  EditorialStickerAsset,
  EditorialTone,
  EditorialTopic,
  PersonalEditorialAsset,
  PersonalEditorialSource,
} from './personalForecastVisuals/editorialTypes';
export type {
  DiaryLayout,
  DiaryTodayVisualPlan,
  DiaryVisualRenderSize,
} from './personalForecastVisuals/diaryVisualEngine';
