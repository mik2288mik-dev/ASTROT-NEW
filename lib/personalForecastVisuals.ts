import type { CSSProperties } from 'react';
import {
  PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION,
  getPreviousPersonalForecastPeriodKey,
  stableHash,
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

export type ForecastVisualRequest = {
  userId: string;
  period: PersonalForecastPeriod;
  periodKey: string;
  sectionId: string;
  sectionIndex: number;
  kind: ForecastSectionKind;
  fixedKey?: FixedForecastSectionKey;
  sourceTopicKey?: ForecastTopicKey;
  visualTag: string;
};

export type ForecastVisualCrop = {
  position: string;
  scale: number;
};

export type ForecastVisualOverlayPreset = 'deep' | 'balanced' | 'soft';

export type ForecastVisualAssignment = {
  sectionId: string;
  assetId: string | null;
  path: string | null;
  sourceCategory: 'hero' | 'personal' | 'strips' | null;
  textSide: 'left' | 'right' | 'center';
  crop: {
    desktop: ForecastVisualCrop;
    mobile: ForecastVisualCrop;
  };
  mirrorX: boolean;
  overlayPreset: ForecastVisualOverlayPreset;
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

type ManifestAsset = {
  id: string;
  path: string;
  category: 'hero' | 'personal' | 'universal' | 'strips';
  theme: string;
  text_side: 'left' | 'right' | 'center';
  background_position: string;
  enabled: boolean;
  periods?: PersonalForecastPeriod[];
  topicKeys?: string[];
  paletteTag?: string;
  compositionTag?: string;
};

type ForecastVisualStyle = CSSProperties & {
  '--forecast-section-image'?: string;
  '--forecast-section-position'?: string;
  '--forecast-section-position-mobile'?: string;
  '--forecast-section-scale'?: string;
  '--forecast-section-scale-mobile'?: string;
  '--forecast-section-mirror'?: string;
  '--forecast-section-overlay'?: string;
  '--forecast-section-fallback-accent'?: string;
  '--forecast-section-fallback-soft'?: string;
};

const PREMIUM_FEED_ASSETS: ManifestAsset[] = [
  { id: 'feed_mood_day', path: '/assets/forecast-feed/mood-day.png', category: 'personal', theme: 'energy', text_side: 'center', background_position: '72% 50%', enabled: true },
  { id: 'feed_love_day', path: '/assets/forecast-feed/love-day.png', category: 'personal', theme: 'love', text_side: 'center', background_position: '74% 50%', enabled: true },
  { id: 'feed_work_day', path: '/assets/forecast-feed/work-day.png', category: 'personal', theme: 'work', text_side: 'center', background_position: '72% 50%', enabled: true },
  { id: 'feed_home_day', path: '/assets/forecast-feed/home-day.png', category: 'personal', theme: 'home_family', text_side: 'center', background_position: '73% 50%', enabled: true },
  { id: 'feed_friends_day', path: '/assets/forecast-feed/friends-day.png', category: 'personal', theme: 'friends', text_side: 'center', background_position: '73% 50%', enabled: true },
  { id: 'feed_money_day', path: '/assets/forecast-feed/money-day.png', category: 'personal', theme: 'money', text_side: 'center', background_position: '72% 50%', enabled: true },
  { id: 'feed_mercury_day', path: '/assets/forecast-feed/mercury-day.png', category: 'personal', theme: 'communication', text_side: 'center', background_position: '74% 50%', enabled: true },
  { id: 'feed_opportunity_day', path: '/assets/forecast-feed/opportunity-day.png', category: 'personal', theme: 'goals', text_side: 'center', background_position: '73% 50%', enabled: true },
];

const ASSETS = PREMIUM_FEED_ASSETS;

const FALLBACK_PALETTES: Record<
  PersonalForecastPeriod,
  { paletteTag: string; accent: string; soft: string }
> = {
  day: { paletteTag: 'day-coral', accent: '#f59d83', soft: '#fff2e9' },
  week: { paletteTag: 'week-blue', accent: '#7ea9e8', soft: '#edf4ff' },
  month: { paletteTag: 'month-plum', accent: '#a88ac4', soft: '#f4eff9' },
  year: { paletteTag: 'year-ochre', accent: '#c9974f', soft: '#fbf3e4' },
};

const VISUAL_TAG_THEMES: Record<string, string[]> = {
  overview: ['goals'],
  love: ['love'],
  mood: ['energy'],
  home: ['home_family'],
  home_family: ['home_family'],
  friends: ['friends'],
  'work-money': ['work', 'money'],
  work_money: ['work', 'money'],
  wishes: ['goals', 'overview'],
  career: ['work'],
  technology: ['work', 'communication'],
  business: ['work', 'money'],
  money: ['money'],
  'career-change': ['work', 'goals'],
  career_change: ['work', 'goals'],
  study: ['communication', 'work'],
  creativity: ['goals', 'friends'],
  relocation: ['home_family', 'energy'],
  property: ['home_family', 'money'],
  confidence: ['overview', 'goals'],
  decision: ['goals', 'work'],
  future: ['goals', 'overview'],
  rest: ['energy'],
  movement: ['energy'],
  documents: ['communication', 'work'],
  moon: ['advantage'],
  mercury: ['conversation'],
  retrograde: ['conversation'],
  astro: ['advantage', 'conversation'],
};

const SOURCE_TOPIC_THEMES: Partial<Record<ForecastTopicKey, string[]>> = {
  overview: ['overview'],
  love: ['love'],
  mood: ['energy'],
  home_family: ['home_family'],
  friends: ['friends'],
  work_money: ['work', 'money'],
  wishes: ['goals', 'overview'],
  professional_path: ['work'],
  it_direction: ['work', 'communication'],
  business: ['work', 'money'],
  income_growth: ['money'],
  work_change: ['work', 'goals'],
  study: ['communication', 'work'],
  creativity: ['goals', 'friends'],
  relocation: ['home_family', 'energy'],
  property_decision: ['home_family', 'money'],
  self_confidence: ['overview', 'goals'],
  important_decision: ['goals', 'work'],
  future_direction: ['goals', 'overview'],
  rest_recovery: ['energy'],
  physical_activity: ['energy'],
  documents_agreements: ['communication', 'work'],
};

const POSITION_VARIANTS = [
  { desktopX: -5, desktopY: -3, mobileX: 5, mobileY: -2 },
  { desktopX: 0, desktopY: 0, mobileX: 2, mobileY: 3 },
  { desktopX: 4, desktopY: -2, mobileX: 8, mobileY: 0 },
  { desktopX: -2, desktopY: 4, mobileX: 4, mobileY: 5 },
] as const;
const DESKTOP_SCALES = [1, 1.04, 1.08, 1.12] as const;
const MOBILE_SCALES = [1.04, 1.08, 1.12, 1.16] as const;

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function normalizeTag(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, '-');
}

function assetCategory(
  request: ForecastVisualRequest,
): Extract<ManifestAsset['category'], 'hero' | 'personal' | 'strips'> {
  void request;
  return 'personal';
}

function themesFor(request: ForecastVisualRequest): string[] {
  const normalized = normalizeTag(request.visualTag);
  const normalizedUnderscore = normalized.replace(/-/g, '_');
  const byTag = VISUAL_TAG_THEMES[normalized]
    || VISUAL_TAG_THEMES[normalizedUnderscore]
    || [];
  const bySource = request.sourceTopicKey
    ? SOURCE_TOPIC_THEMES[request.sourceTopicKey] || []
    : [];
  const byFixed = request.fixedKey
    ? SOURCE_TOPIC_THEMES[request.fixedKey] || []
    : [];
  return unique([...byTag, ...bySource, ...byFixed]);
}

function categoryAssets(request: ForecastVisualRequest): ManifestAsset[] {
  const category = assetCategory(request);
  return ASSETS.filter((asset) => (
    asset.category === category
    && (category !== 'hero' || asset.theme === 'personal_horoscope')
  ));
}

function semanticCandidates(request: ForecastVisualRequest): ManifestAsset[] {
  const category = assetCategory(request);
  const themes = themesFor(request);
  const assets = categoryAssets(request);
  if (category === 'hero') {
    const forPeriod = assets.filter((asset) => asset.periods?.includes(request.period));
    return forPeriod.length ? forPeriod : assets;
  }
  if (!themes.length) return assets;

  const semantic = assets.filter((asset) => (
    themes.includes(asset.theme)
    || asset.topicKeys?.some((key) => (
      themes.includes(key)
      || themes.includes(normalizeTag(key))
    ))
  ));
  if (!semantic.length) return assets;
  const forPeriod = semantic.filter((asset) => asset.periods?.includes(request.period));
  return forPeriod.length
    ? [
        ...forPeriod,
        ...semantic.filter((asset) => !forPeriod.includes(asset)),
      ]
    : semantic;
}

function clampPercent(value: number): number {
  return Math.max(12, Math.min(88, Math.round(value)));
}

function parsePosition(value: string): { x: number; y: number } {
  const match = String(value || '').match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
  if (!match) return { x: 50, y: 50 };
  return { x: Number(match[1]), y: Number(match[2]) };
}

function positionString(x: number, y: number): string {
  return `${clampPercent(x)}% ${clampPercent(y)}%`;
}

function overlayPresetFor(
  request: ForecastVisualRequest,
  seed: string,
): ForecastVisualOverlayPreset {
  if (request.kind === 'overview') return 'deep';
  if (request.kind === 'astro_accent') return 'balanced';
  if (request.kind === 'wishes') return 'soft';
  return stableHash(`${seed}|overlay`) % 3 === 0 ? 'soft' : 'balanced';
}

function overlayFor(
  preset: ForecastVisualOverlayPreset,
  textSide: ForecastVisualAssignment['textSide'],
): string {
  const direction = textSide === 'right' ? '270deg' : '90deg';
  if (preset === 'deep') {
    return `linear-gradient(${direction}, rgba(8, 10, 18, 0.91) 0%, rgba(8, 10, 18, 0.66) 48%, rgba(8, 10, 18, 0.18) 100%)`;
  }
  if (preset === 'soft') {
    return `linear-gradient(${direction}, rgba(11, 14, 24, 0.76) 0%, rgba(11, 14, 24, 0.47) 52%, rgba(11, 14, 24, 0.12) 100%)`;
  }
  return `linear-gradient(${direction}, rgba(9, 12, 22, 0.84) 0%, rgba(9, 12, 22, 0.56) 50%, rgba(9, 12, 22, 0.14) 100%)`;
}

function fallbackAssignment(request: ForecastVisualRequest): ForecastVisualAssignment {
  const fallback = FALLBACK_PALETTES[request.period];
  return {
    sectionId: request.sectionId,
    assetId: null,
    path: null,
    sourceCategory: null,
    textSide: 'left',
    crop: {
      desktop: { position: '50% 50%', scale: 1 },
      mobile: { position: '50% 50%', scale: 1 },
    },
    mirrorX: false,
    overlayPreset: 'balanced',
    overlay: 'linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.72))',
    paletteTag: fallback.paletteTag,
    compositionTag: null,
    visualFallback: true,
  };
}

function assignmentFromAsset(
  request: ForecastVisualRequest,
  asset: ManifestAsset,
): ForecastVisualAssignment {
  const seed = [
    request.userId,
    request.period,
    request.periodKey,
    request.sectionId,
    request.sectionIndex,
    request.visualTag,
    asset.id,
    PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION,
  ].join('|');
  const cropVariant = POSITION_VARIANTS[stableHash(`${seed}|crop`) % POSITION_VARIANTS.length];
  const scaleIndex = stableHash(`${seed}|scale`) % DESKTOP_SCALES.length;
  const basePosition = parsePosition(asset.background_position);
  const mirrorX = asset.category !== 'strips' && stableHash(`${seed}|mirror`) % 5 === 0;
  const textSide = mirrorX
    ? asset.text_side === 'left'
      ? 'right'
      : asset.text_side === 'right'
        ? 'left'
        : 'center'
    : asset.text_side;
  const overlayPreset = overlayPresetFor(request, seed);
  return {
    sectionId: request.sectionId,
    assetId: asset.id,
    path: asset.path,
    sourceCategory: asset.category as ForecastVisualAssignment['sourceCategory'],
    textSide,
    crop: {
      desktop: {
        position: positionString(
          basePosition.x + cropVariant.desktopX,
          basePosition.y + cropVariant.desktopY,
        ),
        scale: DESKTOP_SCALES[scaleIndex],
      },
      mobile: {
        position: positionString(
          basePosition.x + cropVariant.mobileX,
          basePosition.y + cropVariant.mobileY,
        ),
        scale: MOBILE_SCALES[scaleIndex],
      },
    },
    mirrorX,
    overlayPreset,
    overlay: overlayFor(overlayPreset, textSide),
    paletteTag: asset.paletteTag || null,
    compositionTag: asset.compositionTag || null,
    visualFallback: false,
  };
}

function deterministicPreviousPath(
  request: ForecastVisualRequest,
  candidates: ManifestAsset[],
): string | null {
  if (!candidates.length) return null;
  const previousPeriodKey = getPreviousPersonalForecastPeriodKey(
    request.period,
    request.periodKey,
  );
  const seed = [
    request.userId,
    request.period,
    previousPeriodKey,
    request.sectionId,
    request.visualTag,
    PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION,
  ].join('|');
  return candidates[stableHash(seed) % candidates.length]?.path || null;
}

function chooseAsset(input: {
  request: ForecastVisualRequest;
  usedPaths: Set<string>;
  adjacentPath: string | null;
  explicitPreviousPath?: string | null;
}): ManifestAsset | null {
  const semantic = semanticCandidates(input.request);
  const category = categoryAssets(input.request);
  const hasExplicitPreviousPath = input.explicitPreviousPath !== undefined;
  const previousPath = hasExplicitPreviousPath
    ? input.explicitPreviousPath || null
    : deterministicPreviousPath(input.request, semantic);
  const withoutAdjacent = (assets: ManifestAsset[]) => (
    assets.filter((asset) => asset.path !== input.adjacentPath)
  );
  const unused = (assets: ManifestAsset[]) => (
    assets.filter((asset) => !input.usedPaths.has(asset.path))
  );
  const withoutPrevious = (assets: ManifestAsset[]) => (
    assets.filter((asset) => asset.path !== previousPath)
  );
  const pools = hasExplicitPreviousPath
    ? [
        withoutPrevious(unused(withoutAdjacent(semantic))),
        withoutPrevious(unused(withoutAdjacent(category))),
        unused(withoutAdjacent(semantic)),
        unused(withoutAdjacent(category)),
        withoutPrevious(withoutAdjacent(semantic)),
        withoutPrevious(withoutAdjacent(category)),
        withoutAdjacent(semantic),
        withoutAdjacent(category),
      ]
    : [
        withoutPrevious(unused(withoutAdjacent(semantic))),
        unused(withoutAdjacent(semantic)),
        withoutPrevious(unused(withoutAdjacent(category))),
        unused(withoutAdjacent(category)),
        withoutPrevious(withoutAdjacent(semantic)),
        withoutAdjacent(semantic),
        withoutPrevious(withoutAdjacent(category)),
        withoutAdjacent(category),
      ];
  const pool = pools.find((candidate) => candidate.length > 0);
  if (!pool) return null;
  const seed = [
    input.request.userId,
    input.request.period,
    input.request.periodKey,
    input.request.sectionId,
    input.request.sectionIndex,
    input.request.visualTag,
    PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION,
  ].join('|');
  return pool[stableHash(seed) % pool.length] || null;
}

export function buildForecastVisualRequests(input: {
  userId: string;
  forecast: ForecastVisualFeedInput;
}): ForecastVisualRequest[] {
  return [input.forecast.overview, ...input.forecast.sections].map(
    (section, sectionIndex) => ({
      userId: input.userId,
      period: input.forecast.period,
      periodKey: input.forecast.periodKey,
      sectionId: section.id,
      sectionIndex,
      kind: section.kind,
      fixedKey: section.fixedKey,
      sourceTopicKey: section.sourceTopicKey,
      visualTag: section.visualTag,
    }),
  );
}

export const buildForecastSectionVisualRequests = buildForecastVisualRequests;

export function resolveForecastVisualScreen(
  requests: readonly ForecastVisualRequest[],
  options?: {
    previousSectionAssetPaths?: Readonly<Record<string, string | null | undefined>>;
  },
): ForecastVisualScreen {
  const ordered = [...requests].sort((a, b) => a.sectionIndex - b.sectionIndex);
  const usedPaths = new Set<string>();
  const assignments: Record<string, ForecastVisualAssignment> = {};
  let adjacentPath: string | null = null;

  for (const request of ordered) {
    const selected = chooseAsset({
      request,
      usedPaths,
      adjacentPath,
      explicitPreviousPath: options?.previousSectionAssetPaths?.[request.sectionId],
    });
    const assignment = selected
      ? assignmentFromAsset(request, selected)
      : fallbackAssignment(request);
    assignments[request.sectionId] = assignment;
    if (assignment.path) {
      usedPaths.add(assignment.path);
      adjacentPath = assignment.path;
    } else {
      adjacentPath = null;
    }
  }

  const sectionIds = ordered.map((request) => request.sectionId);
  return {
    version: PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION,
    sectionIds,
    assignments,
    sectionAssetIds: Object.fromEntries(
      sectionIds.map((sectionId) => [
        sectionId,
        assignments[sectionId]?.assetId || null,
      ]),
    ),
    visualFallback: Object.values(assignments).some(
      (assignment) => assignment.visualFallback,
    ),
  };
}

export const resolveForecastSectionVisuals = resolveForecastVisualScreen;

export function resolvePersonalForecastVisuals(input: {
  userId: string;
  forecast: ForecastVisualFeedInput;
  previousSectionAssetPaths?: Readonly<Record<string, string | null | undefined>>;
}): ForecastVisualScreen {
  return resolveForecastVisualScreen(
    buildForecastVisualRequests({
      userId: input.userId,
      forecast: input.forecast,
    }),
    { previousSectionAssetPaths: input.previousSectionAssetPaths },
  );
}

export function getForecastVisualAssignment(
  screen: ForecastVisualScreen,
  sectionId: string,
): ForecastVisualAssignment | null {
  return screen.assignments[sectionId] || null;
}

export function forecastVisualStyle(
  assignment: ForecastVisualAssignment | null | undefined,
  period: PersonalForecastPeriod,
): ForecastVisualStyle {
  if (assignment?.path) {
    return {
      '--forecast-section-image': `url("${assignment.path}")`,
      '--forecast-section-position': assignment.crop.desktop.position,
      '--forecast-section-position-mobile': assignment.crop.mobile.position,
      '--forecast-section-scale': String(assignment.crop.desktop.scale),
      '--forecast-section-scale-mobile': String(assignment.crop.mobile.scale),
      '--forecast-section-mirror': assignment.mirrorX ? '-1' : '1',
      '--forecast-section-overlay': assignment.overlay,
    };
  }
  const fallback = FALLBACK_PALETTES[period];
  return {
    '--forecast-section-fallback-accent': fallback.accent,
    '--forecast-section-fallback-soft': fallback.soft,
    '--forecast-section-overlay': fallbackAssignment({
      userId: '',
      period,
      periodKey: '',
      sectionId: '',
      sectionIndex: 0,
      kind: 'fixed',
      visualTag: '',
    }).overlay,
  };
}

export const forecastSectionVisualStyle = forecastVisualStyle;
