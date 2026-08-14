import type { ContentAccessTier, ContentSurface, ContentVariant } from '../types';
import {
  canAccessFeature,
  getFeatureAccessConfig,
  type FeatureKey,
  type ProfileAccessState,
} from './accessMatrix';

/**
 * Legacy surface/variant adapter. Access is derived from accessMatrix; this
 * module keeps only persistence and generation metadata for old content APIs.
 */

export type LockedBehavior = {
  showPreview: boolean;
  showTeaser: boolean;
  showLockedCard: boolean;
  requirePremium: boolean;
};

export type ContentAccessConfig = {
  surface: ContentSurface;
  variant: ContentVariant;
  featureKey: FeatureKey;
  label: string;
  description: string;
  calculationRequired: boolean;
  shouldPersistCalculation: boolean;
  shouldPersistInterpretation: boolean;
  defaultAccessTier: ContentAccessTier;
  unlockOptions: ContentAccessTier[];
  lockedBehavior: LockedBehavior;
};

export type UnlockedContentEntry = {
  surface: ContentSurface;
  variant: ContentVariant;
  accessTier: ContentAccessTier;
  cacheKey?: string;
};

export type UserState = ProfileAccessState & {
  userId: string;
  chartId: number | null;
  unlockedContent: UnlockedContentEntry[];
};

type ContentAccessSpec = Omit<
  ContentAccessConfig,
  'defaultAccessTier' | 'unlockOptions' | 'lockedBehavior'
>;

const CONTENT_ACCESS_SPECS: ContentAccessSpec[] = [
  {
    surface: 'natal',
    variant: 'anchor',
    featureKey: 'natal_basic',
    label: 'Basic natal reading',
    description: 'Basic interpretation of the saved natal chart.',
    calculationRequired: true,
    shouldPersistCalculation: true,
    shouldPersistInterpretation: true,
  },
  {
    surface: 'natal',
    variant: 'full',
    featureKey: 'natal_deep',
    label: 'Deep natal reading',
    description: 'Deep interpretation of the saved natal chart.',
    calculationRequired: true,
    shouldPersistCalculation: true,
    shouldPersistInterpretation: true,
  },
  {
    surface: 'natal',
    variant: 'planet_insight',
    featureKey: 'natal_deep',
    label: 'Planet insight',
    description: 'Deep interpretation of a natal planet or theme.',
    calculationRequired: true,
    shouldPersistCalculation: true,
    shouldPersistInterpretation: true,
  },
  {
    surface: 'natal',
    variant: 'living',
    featureKey: 'personality_deep',
    label: 'Deep personality reading',
    description: 'Deep personal interpretation for the current period.',
    calculationRequired: true,
    shouldPersistCalculation: true,
    shouldPersistInterpretation: true,
  },
  {
    surface: 'forecast',
    variant: 'daily',
    featureKey: 'personal_daily',
    label: 'Personal Today horoscope',
    description: 'AI-only personal horoscope for Today from the saved profile and continuity context.',
    calculationRequired: false,
    shouldPersistCalculation: false,
    shouldPersistInterpretation: true,
  },
  {
    surface: 'forecast',
    variant: 'weekly',
    featureKey: 'personal_weekly',
    label: 'Personal Week horoscope',
    description: 'AI-only personal horoscope for the week from the saved profile and continuity context.',
    calculationRequired: false,
    shouldPersistCalculation: false,
    shouldPersistInterpretation: true,
  },
  {
    surface: 'forecast',
    variant: 'monthly',
    featureKey: 'personal_monthly',
    label: 'Personal Month horoscope',
    description: 'AI-only personal horoscope for the month from the saved profile and continuity context.',
    calculationRequired: false,
    shouldPersistCalculation: false,
    shouldPersistInterpretation: true,
  },
  {
    surface: 'synastry',
    variant: 'brief',
    featureKey: 'synastry_by_charts',
    label: 'Compatibility by calculated charts',
    description: 'Compatibility based on two calculated natal charts.',
    calculationRequired: true,
    shouldPersistCalculation: true,
    shouldPersistInterpretation: true,
  },
  {
    surface: 'synastry',
    variant: 'full',
    featureKey: 'synastry_by_charts',
    label: 'Deep compatibility by calculated charts',
    description: 'Deep compatibility based on two calculated natal charts.',
    calculationRequired: true,
    shouldPersistCalculation: true,
    shouldPersistInterpretation: true,
  },
];

function deriveAccessConfig(spec: ContentAccessSpec): ContentAccessConfig {
  const feature = getFeatureAccessConfig(spec.featureKey);
  if (!feature) throw new Error(`Missing accessMatrix entry for ${spec.featureKey}`);

  const premiumOnly = feature.tier === 'premium';
  const defaultAccessTier: ContentAccessTier = premiumOnly ? 'premium' : 'free';
  return {
    ...spec,
    defaultAccessTier,
    unlockOptions: [defaultAccessTier],
    lockedBehavior: premiumOnly
      ? {
          showPreview: true,
          showTeaser: true,
          showLockedCard: true,
          requirePremium: true,
        }
      : {
          showPreview: false,
          showTeaser: false,
          showLockedCard: false,
          requirePremium: false,
        },
  };
}

const CONTENT_ACCESS_MATRIX = CONTENT_ACCESS_SPECS.map(deriveAccessConfig);
const CONTENT_ACCESS_INDEX = new Map<string, ContentAccessConfig>(
  CONTENT_ACCESS_MATRIX.map((entry) => [buildContentAccessKey(entry.surface, entry.variant), entry])
);

export function buildContentAccessKey(surface: ContentSurface, variant: ContentVariant) {
  return `${surface}:${variant}`;
}

export function getContentAccessConfig(
  surface: ContentSurface,
  variant: ContentVariant
): ContentAccessConfig | null {
  return CONTENT_ACCESS_INDEX.get(buildContentAccessKey(surface, variant)) || null;
}

export function matchesUnlockEntry(
  entry: UnlockedContentEntry,
  surface: ContentSurface,
  variant: ContentVariant,
  cacheKey?: string
) {
  if (entry.surface !== surface || entry.variant !== variant) return false;
  if (cacheKey && entry.cacheKey && entry.cacheKey !== cacheKey) return false;
  return entry.accessTier === 'premium';
}

export function canAccessContent(
  userState: UserState,
  surface: ContentSurface,
  variant: ContentVariant,
  _cacheKey?: string,
  nowMs = Date.now(),
): boolean {
  const config = getContentAccessConfig(surface, variant);
  if (!config) return false;

  return canAccessFeature(
    config.featureKey,
    userState,
    { primaryChartId: userState.chartId },
    nowMs,
  ).allowed;
}

export function getLockedBehavior(
  userState: UserState,
  surface: ContentSurface,
  variant: ContentVariant
): LockedBehavior {
  const config = getContentAccessConfig(surface, variant);
  if (!config) {
    return {
      showPreview: false,
      showTeaser: false,
      showLockedCard: true,
      requirePremium: true,
    };
  }

  if (canAccessContent(userState, surface, variant)) {
    return {
      showPreview: false,
      showTeaser: false,
      showLockedCard: false,
      requirePremium: false,
    };
  }

  return config.lockedBehavior;
}

export function shouldPrecalculate(surface: ContentSurface, variant: ContentVariant): boolean {
  return getContentAccessConfig(surface, variant)?.calculationRequired ?? false;
}

export function shouldPersistContent(surface: ContentSurface, variant: ContentVariant): boolean {
  const config = getContentAccessConfig(surface, variant);
  return !!config && (config.shouldPersistCalculation || config.shouldPersistInterpretation);
}

export function listContentAccessMatrix(): ContentAccessConfig[] {
  return CONTENT_ACCESS_MATRIX.slice();
}
