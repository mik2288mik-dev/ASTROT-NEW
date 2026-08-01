import type { CSSProperties } from 'react';
import { selectMainEditorialSticker } from './personalForecastVisuals/editorialSelectors';
import type { EditorialTopic } from './personalForecastVisuals/editorialTypes';
import {
  PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION,
  type FixedForecastSectionKey,
  type ForecastSectionKind,
  type ForecastTopicKey,
  type PersonalForecastPeriod,
} from './personalForecastContract';

export type ForecastVisualSectionInput = {
  id: string;
  kind: ForecastSectionKind;
  fixedKey?: FixedForecastSectionKey;
  sourceTopicKey?: ForecastTopicKey;
  visualTag: string;
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
  sourceCategory: 'personal' | null;
  textSide: 'center';
  crop: { desktop: { position: string; scale: number }; mobile: { position: string; scale: number } };
  mirrorX: false;
  overlayPreset: 'milky';
  overlay: string;
  paletteTag: string | null;
  compositionTag: string | null;
  visualFallback: boolean;
};

export type ForecastVisualScreen = {
  version: string;
  sectionIds: string[];
  assignments: Record<string, ForecastVisualAssignment>;
  sectionAssetIds: Record<string, string | null>;
  visualFallback: boolean;
};

type Theme = 'general' | 'love' | 'mood' | 'work_money' | 'home_family' | 'friends' | 'opportunities' | 'decisions' | 'communication' | 'questions' | 'moon' | 'mercury';
type Lightness = 'light' | 'medium' | 'dark';
type BackgroundAsset = {
  id: string;
  file: string;
  themes: readonly Theme[];
  series: string;
  lightness: Lightness;
  periods: readonly PersonalForecastPeriod[];
  priority: number;
  position: string;
};

const ALL_PERIODS: readonly PersonalForecastPeriod[] = ['day', 'week', 'month', 'year'];
const SERIES: ReadonlyArray<{ name: string; lightness: Lightness; position: string }> = [
  { name: 'sunset-social', lightness: 'medium', position: '50% 50%' },
  { name: 'feather-abstract', lightness: 'medium', position: '50% 50%' },
  { name: 'cosmic-journey', lightness: 'dark', position: '50% 50%' },
  { name: 'pastel-dream', lightness: 'light', position: '50% 50%' },
  { name: 'magenta-vision', lightness: 'dark', position: '50% 50%' },
  { name: 'album-graphic', lightness: 'medium', position: '50% 50%' },
  { name: 'tropical-daylight', lightness: 'light', position: '50% 50%' },
  { name: 'tropical-night', lightness: 'medium', position: '50% 50%' },
  { name: 'floral-air', lightness: 'light', position: '50% 50%' },
  { name: 'floral-symbols', lightness: 'light', position: '50% 50%' },
];

const THEME_BY_INDEX: Partial<Record<number, Theme>> = {
  0: 'friends', 1: 'love', 2: 'mood', 3: 'work_money', 4: 'home_family', 5: 'friends', 6: 'opportunities', 7: 'general', 8: 'decisions', 9: 'work_money',
  10: 'friends', 11: 'love', 12: 'mood', 13: 'work_money', 14: 'friends', 15: 'friends', 16: 'opportunities', 17: 'mood', 18: 'decisions', 19: 'mood',
  30: 'general', 31: 'love', 32: 'mood', 33: 'questions', 34: 'work_money', 35: 'opportunities', 36: 'decisions', 37: 'mood', 38: 'decisions', 39: 'general',
};

function themeForIndex(index: number): Theme {
  if (THEME_BY_INDEX[index]) return THEME_BY_INDEX[index];
  const slot = index % 10;
  return (['general', 'love', 'mood', 'questions', 'work_money', 'opportunities', 'decisions', 'mood', 'decisions', 'general'] as const)[slot];
}

const ASTRO_BACKGROUND_ASSETS: readonly BackgroundAsset[] = [
  {
    id: 'forecast-astro-moon-01',
    file: '/assets/forecast-feed/forecast-astro-moon-01.webp',
    themes: ['moon'],
    series: 'pearl-moon-tides',
    lightness: 'light',
    periods: ALL_PERIODS,
    priority: 320,
    position: '62% 50%',
  },
  {
    id: 'forecast-astro-mercury-01',
    file: '/assets/forecast-feed/forecast-astro-mercury-01.webp',
    themes: ['mercury'],
    series: 'glass-mercury-signals',
    lightness: 'light',
    periods: ALL_PERIODS,
    priority: 319,
    position: '47% 50%',
  },
] as const;

const LIFESTYLE_BACKGROUND_ASSETS: readonly BackgroundAsset[] = Array.from({ length: 190 }, (_, index) => {
  const theme = themeForIndex(index);
  const series = SERIES[Math.floor(index / 20)] || SERIES[SERIES.length - 1];
  const number = String(index + 1).padStart(3, '0');
  return {
    id: `horoscope-${theme.replace('_', '-')}-${number}`,
    file: `/foni/horoscope-${theme.replace('_', '-')}-${number}.webp`,
    themes: [theme],
    series: series.name,
    lightness: series.lightness,
    periods: ALL_PERIODS,
    priority: 190 - index,
    position: series.position,
  };
});

export const PERSONAL_FORECAST_BACKGROUND_MANIFEST: readonly BackgroundAsset[] = [
  ...ASTRO_BACKGROUND_ASSETS,
  ...LIFESTYLE_BACKGROUND_ASSETS,
] as const;

const TAG_THEMES: Record<string, readonly Theme[]> = {
  overview: ['general'], love: ['love'], mood: ['mood'], home: ['home_family'], home_family: ['home_family'], friends: ['friends'],
  'work-money': ['work_money'], work_money: ['work_money'], wishes: ['opportunities'], career: ['work_money'], technology: ['communication'],
  business: ['work_money'], money: ['work_money'], 'career-change': ['opportunities'], career_change: ['opportunities'], study: ['communication'],
  creativity: ['mood'], relocation: ['opportunities'], property: ['home_family'], confidence: ['mood'], decision: ['decisions'], future: ['opportunities'],
  rest: ['mood'], movement: ['mood'], documents: ['communication'],
  moon: ['moon'], luna: ['moon'], lunar: ['moon'],
  mercury: ['mercury'], mercurial: ['mercury'], retrograde: ['mercury'],
};
const SOURCE_THEMES: Partial<Record<ForecastTopicKey, readonly Theme[]>> = {
  overview: ['general'], love: ['love'], mood: ['mood'], home_family: ['home_family'], friends: ['friends'], work_money: ['work_money'],
  wishes: ['opportunities'], professional_path: ['work_money'], it_direction: ['communication'], business: ['work_money'], income_growth: ['work_money'],
  work_change: ['opportunities'], study: ['communication'], creativity: ['mood'], relocation: ['opportunities'], property_decision: ['home_family'],
  self_confidence: ['mood'], important_decision: ['decisions'], future_direction: ['opportunities'], rest_recovery: ['mood'], physical_activity: ['mood'], documents_agreements: ['communication'],
};
const FALLBACK: Record<PersonalForecastPeriod, { accent: string; soft: string }> = {
  day: { accent: '#f59d83', soft: '#fff2e9' }, week: { accent: '#7ea9e8', soft: '#edf4ff' }, month: { accent: '#a88ac4', soft: '#f4eff9' }, year: { accent: '#c9974f', soft: '#fbf3e4' },
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
  const tag = normalise(request.visualTag);
  return TAG_THEMES[tag] || TAG_THEMES[tag.replace(/-/g, '_')] || (request.sourceTopicKey ? SOURCE_THEMES[request.sourceTopicKey] || ['general'] : ['general']);
}
function fallbackAssignment(request: ForecastVisualRequest): ForecastVisualAssignment {
  return { sectionId: request.sectionId, assetId: null, path: null, sourceCategory: null, textSide: 'center', crop: { desktop: { position: '50% 50%', scale: 1 }, mobile: { position: '50% 50%', scale: 1 } }, mirrorX: false, overlayPreset: 'milky', overlay: MILKY_OVERLAY, paletteTag: null, compositionTag: null, visualFallback: true };
}
export function buildForecastVisualRequests(input: { userId: string; forecast: ForecastVisualFeedInput }): ForecastVisualRequest[] {
  return [input.forecast.overview, ...input.forecast.sections].map((section, sectionIndex) => ({ ...section, userId: input.userId, period: input.forecast.period, periodKey: input.forecast.periodKey, sectionId: section.id, sectionIndex }));
}
export const buildForecastSectionVisualRequests = buildForecastVisualRequests;
export function resolveForecastVisualScreen(requests: readonly ForecastVisualRequest[], _options?: { previousSectionAssetPaths?: Readonly<Record<string, string | null | undefined>> }): ForecastVisualScreen {
  const assignments: Record<string, ForecastVisualAssignment> = {};
  const ordered = [...requests].sort((left, right) => left.sectionIndex - right.sectionIndex);
  const visualRequest = ordered[0];
  const editorialTopicMap: Record<Theme, EditorialTopic> = {
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
  const editorialAsset = visualRequest
    ? selectMainEditorialSticker({
        screenKey: 'personal-forecast',
        contentKey: `${visualRequest.period}|${visualRequest.periodKey}`,
        userId: visualRequest.userId,
        slot: 0,
        topics: themesFor(visualRequest).map((theme) => editorialTopicMap[theme]),
        allowedMedia: ['photo'],
      })
    : null;
  for (const request of ordered) {
    const asset = request.sectionId === visualRequest?.sectionId ? editorialAsset : null;
    assignments[request.sectionId] = asset
      ? {
          sectionId: request.sectionId,
          assetId: asset.id,
          path: asset.path,
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
export function resolvePersonalForecastVisuals(input: { userId: string; forecast: ForecastVisualFeedInput; previousSectionAssetPaths?: Readonly<Record<string, string | null | undefined>> }): ForecastVisualScreen {
  return resolveForecastVisualScreen(buildForecastVisualRequests(input));
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
  NEWSPAPER_VISUAL_MANIFEST_VERSION,
  getNewspaperVisualCounts,
  getZodiacEditorialSticker,
  selectMainEditorialSticker,
  selectSynastryEditorialSticker,
} from './personalForecastVisuals/editorialSelectors';
export type {
  EditorialAssetBase,
  EditorialMedium,
  EditorialOrientation,
  EditorialStickerAsset,
  EditorialTone,
  EditorialTopic,
  MainEditorialAsset,
  SynastryEditorialAsset,
  ZodiacEditorialAsset,
} from './personalForecastVisuals/editorialTypes';
