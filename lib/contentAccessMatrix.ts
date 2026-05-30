import type { ContentAccessTier, ContentSurface, ContentVariant } from '../types';

export type LockedBehavior = {
  showPreview: boolean;
  showTeaser: boolean;
  showLockedCard: boolean;
  requirePremium: boolean;
};

export type ContentAccessConfig = {
  surface: ContentSurface;
  variant: ContentVariant;
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

export type UserState = {
  userId: string;
  chartId: number | null;
  isPremium: boolean;
  unlockedContent: UnlockedContentEntry[];
};

const CONTENT_ACCESS_MATRIX: ContentAccessConfig[] = [
  {
    surface: 'natal',
    variant: 'anchor',
    label: 'Natal anchor',
    description: 'Базовый портрет карты.',
    calculationRequired: true,
    shouldPersistCalculation: true,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'free',
    unlockOptions: ['free'],
    lockedBehavior: {
      showPreview: false,
      showTeaser: false,
      showLockedCard: false,
      requirePremium: false,
    },
  },
  {
    surface: 'natal',
    variant: 'full',
    label: 'Full natal portrait',
    description: 'Полный личный портрет.',
    calculationRequired: true,
    shouldPersistCalculation: true,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'premium',
    unlockOptions: ['premium'],
    lockedBehavior: {
      showPreview: true,
      showTeaser: true,
      showLockedCard: true,
      requirePremium: true,
    },
  },
  {
    surface: 'natal',
    variant: 'planet_insight',
    label: 'Planet insight',
    description: 'Разбор отдельной планеты или темы.',
    calculationRequired: true,
    shouldPersistCalculation: true,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'premium',
    unlockOptions: ['premium'],
    lockedBehavior: {
      showPreview: true,
      showTeaser: true,
      showLockedCard: true,
      requirePremium: true,
    },
  },
  {
    surface: 'natal',
    variant: 'living',
    label: 'Living natal layer',
    description: 'Живой персональный слой на текущий период.',
    calculationRequired: true,
    shouldPersistCalculation: true,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'premium',
    unlockOptions: ['premium'],
    lockedBehavior: {
      showPreview: true,
      showTeaser: true,
      showLockedCard: true,
      requirePremium: true,
    },
  },
  {
    surface: 'forecast',
    variant: 'daily',
    label: 'Daily pulse',
    description: 'Краткий пульс дня.',
    calculationRequired: true,
    shouldPersistCalculation: false,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'free',
    unlockOptions: ['free'],
    lockedBehavior: {
      showPreview: false,
      showTeaser: false,
      showLockedCard: false,
      requirePremium: false,
    },
  },
  {
    surface: 'forecast',
    variant: 'morning',
    label: 'Morning layer',
    description: 'Подробное утро.',
    calculationRequired: true,
    shouldPersistCalculation: false,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'premium',
    unlockOptions: ['premium'],
    lockedBehavior: {
      showPreview: true,
      showTeaser: true,
      showLockedCard: true,
      requirePremium: true,
    },
  },
  {
    surface: 'forecast',
    variant: 'day',
    label: 'Day layer',
    description: 'Подробный день.',
    calculationRequired: true,
    shouldPersistCalculation: false,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'premium',
    unlockOptions: ['premium'],
    lockedBehavior: {
      showPreview: true,
      showTeaser: true,
      showLockedCard: true,
      requirePremium: true,
    },
  },
  {
    surface: 'forecast',
    variant: 'evening',
    label: 'Evening layer',
    description: 'Подробный вечер.',
    calculationRequired: true,
    shouldPersistCalculation: false,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'premium',
    unlockOptions: ['premium'],
    lockedBehavior: {
      showPreview: true,
      showTeaser: true,
      showLockedCard: true,
      requirePremium: true,
    },
  },
  {
    surface: 'forecast',
    variant: 'weekly',
    label: 'Weekly forecast',
    description: 'Недельный прогноз.',
    calculationRequired: true,
    shouldPersistCalculation: false,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'premium',
    unlockOptions: ['premium'],
    lockedBehavior: {
      showPreview: true,
      showTeaser: true,
      showLockedCard: true,
      requirePremium: true,
    },
  },
  {
    surface: 'forecast',
    variant: 'monthly',
    label: 'Monthly forecast',
    description: 'Месячный прогноз.',
    calculationRequired: true,
    shouldPersistCalculation: false,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'premium',
    unlockOptions: ['premium'],
    lockedBehavior: {
      showPreview: true,
      showTeaser: true,
      showLockedCard: true,
      requirePremium: true,
    },
  },
  {
    surface: 'synastry',
    variant: 'brief',
    label: 'Brief synastry',
    description: 'Краткий союз.',
    calculationRequired: true,
    shouldPersistCalculation: true,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'free',
    unlockOptions: ['free'],
    lockedBehavior: {
      showPreview: false,
      showTeaser: false,
      showLockedCard: false,
      requirePremium: false,
    },
  },
  {
    surface: 'synastry',
    variant: 'full',
    label: 'Full synastry',
    description: 'Полный разбор союза.',
    calculationRequired: true,
    shouldPersistCalculation: true,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'premium',
    unlockOptions: ['premium'],
    lockedBehavior: {
      showPreview: true,
      showTeaser: true,
      showLockedCard: true,
      requirePremium: true,
    },
  },
  {
    surface: 'question',
    variant: 'brief',
    label: 'Starter Ask Lumia',
    description: 'Стартовый короткий вопрос.',
    calculationRequired: true,
    shouldPersistCalculation: false,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'free',
    unlockOptions: ['free'],
    lockedBehavior: {
      showPreview: false,
      showTeaser: false,
      showLockedCard: false,
      requirePremium: false,
    },
  },
  {
    surface: 'question',
    variant: 'full',
    label: 'Premium Ask Lumia',
    description: 'Глубокие premium-ответы.',
    calculationRequired: true,
    shouldPersistCalculation: false,
    shouldPersistInterpretation: true,
    defaultAccessTier: 'premium',
    unlockOptions: ['premium'],
    lockedBehavior: {
      showPreview: true,
      showTeaser: true,
      showLockedCard: true,
      requirePremium: true,
    },
  },
];

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

function hasActiveUnlock(
  userState: UserState,
  surface: ContentSurface,
  variant: ContentVariant,
  cacheKey?: string
) {
  if (userState.unlockedContent.some((entry) => matchesUnlockEntry(entry, surface, variant, cacheKey))) {
    return true;
  }

  if (surface === 'forecast' && (variant === 'morning' || variant === 'day' || variant === 'evening')) {
    return userState.unlockedContent.some((entry) => matchesUnlockEntry(entry, 'forecast', 'full', cacheKey));
  }

  return false;
}

export function canAccessContent(
  userState: UserState,
  surface: ContentSurface,
  variant: ContentVariant,
  cacheKey?: string
): boolean {
  const config = getContentAccessConfig(surface, variant);
  if (!config) return false;

  if (config.defaultAccessTier === 'free' && config.unlockOptions.includes('free')) {
    return true;
  }

  if (userState.isPremium && config.unlockOptions.includes('premium')) {
    return true;
  }

  if (hasActiveUnlock(userState, surface, variant, cacheKey)) {
    return true;
  }

  return false;
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
  const config = getContentAccessConfig(surface, variant);
  if (!config) return false;
  return config.calculationRequired;
}

export function shouldPersistContent(surface: ContentSurface, variant: ContentVariant): boolean {
  const config = getContentAccessConfig(surface, variant);
  if (!config) return false;
  return config.shouldPersistCalculation || config.shouldPersistInterpretation;
}

export function listContentAccessMatrix(): ContentAccessConfig[] {
  return CONTENT_ACCESS_MATRIX.slice();
}
