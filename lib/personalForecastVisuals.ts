import type { CSSProperties } from 'react';
import manifest from '../docs/design/card-background-system/card-background-manifest.json';
import {
  PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION,
  getPreviousPersonalForecastPeriodKey,
  stableHash,
  type DynamicForecastTopicKey,
  type FixedForecastTopicKey,
  type ForecastTopicKey,
  type PersonalForecastPeriod,
} from './personalForecastContract';

export type ForecastVisualRequest = {
  userId: string;
  period: PersonalForecastPeriod;
  periodKey: string;
  topicKey: ForecastTopicKey;
  slot: 'hero' | 'fixed' | 'dynamic';
  slotIndex: number;
};

export type ForecastVisualAssignment = {
  assetId: string | null;
  path: string | null;
  textSide: 'left' | 'right' | 'center';
  backgroundPosition: string;
  paletteTag: string | null;
  visualFallback: boolean;
};

export type ForecastVisualScreen = {
  version: string;
  assignments: Record<string, ForecastVisualAssignment>;
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
  topicKeys?: ForecastTopicKey[];
  paletteTag?: string;
  compositionTag?: string;
};

type ForecastVisualStyle = CSSProperties & {
  '--card-bg-image'?: string;
  '--card-bg-position'?: string;
  '--forecast-fallback-accent'?: string;
  '--forecast-fallback-soft'?: string;
};

const ASSETS = (manifest.assets as ManifestAsset[]).filter((asset) => asset.enabled);

const FALLBACK_PALETTES: Record<
  PersonalForecastPeriod,
  { paletteTag: string; accent: string; soft: string }
> = {
  day: { paletteTag: 'day-coral', accent: '#f59d83', soft: '#fff2e9' },
  week: { paletteTag: 'week-blue', accent: '#7ea9e8', soft: '#edf4ff' },
  month: { paletteTag: 'month-plum', accent: '#a88ac4', soft: '#f4eff9' },
  year: { paletteTag: 'year-ochre', accent: '#c9974f', soft: '#fbf3e4' },
};

const LEGACY_THEME_BY_TOPIC: Record<ForecastTopicKey, string> = {
  overview: 'overview',
  love: 'love',
  work: 'work',
  money: 'money',
  mood_energy: 'energy',
  communication: 'communication',
  luck: 'goals',
  business: 'work',
  study: 'communication',
  home_family: 'home_family',
  friends_social: 'friends',
  creativity: 'goals',
  travel_movement: 'energy',
  documents_deals: 'communication',
  purchases_property: 'money',
  public_visibility: 'overview',
  rest_recovery: 'energy',
  physical_activity: 'energy',
  important_choice: 'goals',
};

function fallbackAssignment(period: PersonalForecastPeriod): ForecastVisualAssignment {
  return {
    assetId: null,
    path: null,
    textSide: 'left',
    backgroundPosition: 'center',
    paletteTag: FALLBACK_PALETTES[period].paletteTag,
    visualFallback: true,
  };
}

function candidatesFor(request: ForecastVisualRequest): ManifestAsset[] {
  const category = request.slot === 'hero' ? 'hero' : 'personal';
  return ASSETS.filter((asset) => {
    if (asset.category !== category) return false;
    if (request.slot === 'hero' && asset.theme !== 'personal_horoscope') return false;
    if (request.slot !== 'hero') {
      const topicMatch = asset.topicKeys?.length
        ? asset.topicKeys.includes(request.topicKey)
        : asset.theme === LEGACY_THEME_BY_TOPIC[request.topicKey];
      if (!topicMatch) return false;
    }
    return !asset.periods?.length || asset.periods.includes(request.period);
  });
}

function assignmentFromAsset(asset: ManifestAsset): ForecastVisualAssignment {
  return {
    assetId: asset.id,
    path: asset.path,
    textSide: asset.text_side,
    backgroundPosition: asset.background_position || 'center',
    paletteTag: asset.paletteTag || null,
    visualFallback: false,
  };
}

export function resolveForecastVisualScreen(
  requests: ForecastVisualRequest[],
  options?: { previousTopicAssetPaths?: Partial<Record<ForecastTopicKey, string | null>> },
): ForecastVisualScreen {
  const usedPaths = new Set<string>();
  const assignments: Record<string, ForecastVisualAssignment> = {};
  const ordered = [...requests].sort((a, b) => {
    const slotOrder = { hero: 0, fixed: 1, dynamic: 2 };
    return slotOrder[a.slot] - slotOrder[b.slot] || a.slotIndex - b.slotIndex;
  });

  for (const request of ordered) {
    const candidates = candidatesFor(request);
    const previousPeriodKey = getPreviousPersonalForecastPeriodKey(
      request.period,
      request.periodKey,
    );
    const previousSeed = [
      request.userId,
      request.period,
      request.topicKey,
      previousPeriodKey,
      request.slot,
      request.slotIndex,
      PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION,
    ].join('|');
    const previousPath = options?.previousTopicAssetPaths?.[request.topicKey]
      || (candidates.length
        ? candidates[stableHash(previousSeed) % candidates.length].path
        : null);
    const available = candidates.filter((asset) => !usedPaths.has(asset.path));
    const withoutPrevious = available.filter((asset) => asset.path !== previousPath);
    const pool = withoutPrevious.length ? withoutPrevious : available;
    const assignmentKey = `${request.slot}:${request.topicKey}`;
    if (!pool.length) {
      assignments[assignmentKey] = fallbackAssignment(request.period);
      continue;
    }
    const seed = [
      request.userId,
      request.period,
      request.topicKey,
      request.periodKey,
      request.slot,
      request.slotIndex,
      PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION,
    ].join('|');
    const selected = pool[stableHash(seed) % pool.length];
    usedPaths.add(selected.path);
    assignments[assignmentKey] = assignmentFromAsset(selected);
  }

  return {
    version: PERSONAL_FORECAST_VISUAL_MANIFEST_VERSION,
    assignments,
    visualFallback: Object.values(assignments).some((assignment) => assignment.visualFallback),
  };
}

export function buildForecastVisualRequests(input: {
  userId: string;
  period: PersonalForecastPeriod;
  periodKey: string;
  dynamicTopicKeys: DynamicForecastTopicKey[];
}): ForecastVisualRequest[] {
  const fixed: FixedForecastTopicKey[] = [
    'overview',
    'love',
    'work',
    'money',
    'mood_energy',
    'communication',
    'luck',
  ];
  return [
    {
      userId: input.userId,
      period: input.period,
      periodKey: input.periodKey,
      topicKey: 'overview',
      slot: 'hero',
      slotIndex: 0,
    },
    ...fixed
      .filter((key) => key !== 'overview')
      .map((topicKey, slotIndex) => ({
        userId: input.userId,
        period: input.period,
        periodKey: input.periodKey,
        topicKey,
        slot: 'fixed' as const,
        slotIndex,
      })),
    ...input.dynamicTopicKeys.map((topicKey, slotIndex) => ({
      userId: input.userId,
      period: input.period,
      periodKey: input.periodKey,
      topicKey,
      slot: 'dynamic' as const,
      slotIndex,
    })),
  ];
}

export function forecastVisualStyle(
  assignment: ForecastVisualAssignment | null | undefined,
  period: PersonalForecastPeriod,
): ForecastVisualStyle {
  if (assignment?.path) {
    return {
      '--card-bg-image': `url("${assignment.path}")`,
      '--card-bg-position': assignment.backgroundPosition || 'center',
    };
  }
  const fallback = FALLBACK_PALETTES[period];
  return {
    '--forecast-fallback-accent': fallback.accent,
    '--forecast-fallback-soft': fallback.soft,
  };
}
