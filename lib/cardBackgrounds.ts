import type { CSSProperties } from 'react';
import manifest from '../docs/design/card-background-system/card-background-manifest.json';
import type { PersonalDailySection } from '../types';

export type CardBackgroundCategory = 'hero' | 'personal' | 'universal' | 'strips';
export type UniversalCardTheme = 'natal' | 'compatibility' | 'zodiac' | 'matrix' | 'more';
export type DailyQuestionTheme = 'advantage' | 'conversation' | 'attention';

export type CardBackgroundAsset = {
  id: string;
  path: string;
  category: CardBackgroundCategory;
  theme: string;
  size: { width: number; height: number };
  text_side: 'left' | 'right' | 'center';
  main_object_position: string;
  background_position: string;
  season: string;
  enabled: boolean;
  description: string;
};

type CardBackgroundStyle = CSSProperties & {
  '--card-bg-image': string;
  '--card-bg-position': string;
};

const ASSETS = (manifest.assets as CardBackgroundAsset[]).filter((asset) => asset.enabled);

/**
 * Separate product family: same saturated editorial illustration language,
 * but no cats. Each product has three original variants and rotates stably.
 */
const PRODUCT_ASSETS: CardBackgroundAsset[] = [
  ...(['01', '02', '03'] as const).map((variant) => ({
    id: `product_natal_${variant}`,
    path: `/assets/card-backgrounds/products/natal_${variant}.svg`,
    category: 'universal' as const,
    theme: 'natal',
    size: { width: 1600, height: 900 },
    text_side: 'left' as const,
    main_object_position: 'right',
    background_position: 'center',
    season: 'base',
    enabled: true,
    description: 'Насыщенная рисованная архитектурная сцена и графика карты без животных.',
  })),
  ...(['01', '02', '03'] as const).map((variant) => ({
    id: `product_compatibility_${variant}`,
    path: `/assets/card-backgrounds/products/compatibility_${variant}.svg`,
    category: 'universal' as const,
    theme: 'compatibility',
    size: { width: 1600, height: 900 },
    text_side: 'left' as const,
    main_object_position: 'right',
    background_position: 'center',
    season: 'base',
    enabled: true,
    description: 'Парная рисованная композиция в насыщенной палитре без животных и сердечек.',
  })),
  ...(['01', '02', '03'] as const).map((variant) => ({
    id: `product_matrix_${variant}`,
    path: `/assets/card-backgrounds/products/matrix_${variant}.svg`,
    category: 'universal' as const,
    theme: 'matrix',
    size: { width: 1600, height: 900 },
    text_side: 'left' as const,
    main_object_position: 'right',
    background_position: 'center',
    season: 'base',
    enabled: true,
    description: 'Модульная рисованная система с сеткой, узлами и насыщенными цветами.',
  })),
];

/**
 * Premium questions belong to the Today family, so only here small cat fragments are allowed.
 * Each of the three question slots has three different illustrated scenes.
 */
const QUESTION_ASSETS: CardBackgroundAsset[] = (
  ['advantage', 'conversation', 'attention'] as const
).flatMap((theme) => (
  ['01', '02', '03'] as const
).map((variant) => ({
  id: `question_${theme}_${variant}`,
  path: `/assets/card-backgrounds/questions/question_${theme}_${variant}.svg`,
  category: 'personal' as const,
  theme: `question_${theme}`,
  size: { width: 1600, height: 700 },
  text_side: 'left' as const,
  main_object_position: 'right',
  background_position: 'center',
  season: 'base',
  enabled: true,
  description: 'Яркая рисованная сцена Today с небольшим фрагментом кота, без текста.',
})));

const PERSONAL_THEME_BY_SECTION: Record<Exclude<PersonalDailySection, 'overview'>, string> = {
  love: 'love',
  money: 'money',
  work: 'work',
  goals: 'goals',
  family: 'home_family',
  friendship: 'friends',
  energy: 'energy',
  communication: 'communication',
};

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function selectFrom(
  assets: CardBackgroundAsset[],
  category: CardBackgroundCategory,
  theme: string,
  userId: string,
  dateKey: string,
): CardBackgroundAsset | null {
  const candidates = assets.filter(
    (asset) => asset.enabled && asset.category === category && asset.theme === theme && asset.season === 'base',
  );
  if (!candidates.length) return null;
  const index = stableHash(`${userId || 'guest'}|${dateKey}|${category}|${theme}`) % candidates.length;
  return candidates[index] || candidates[0] || null;
}

function selectAsset(
  category: CardBackgroundCategory,
  theme: string,
  userId: string,
  dateKey: string,
): CardBackgroundAsset | null {
  return selectFrom(ASSETS, category, theme, userId, dateKey);
}

export function getHeroCardBackground(userId: string, dateKey: string): CardBackgroundAsset | null {
  return selectAsset('hero', 'personal_horoscope', userId, dateKey);
}

export function getPersonalCardBackground(
  section: PersonalDailySection,
  userId: string,
  dateKey: string,
): CardBackgroundAsset | null {
  if (section === 'overview') return getHeroCardBackground(userId, dateKey);
  return selectAsset('personal', PERSONAL_THEME_BY_SECTION[section], userId, dateKey);
}

export function getDailyQuestionCardBackground(
  theme: DailyQuestionTheme,
  userId: string,
  dateKey: string,
): CardBackgroundAsset | null {
  return selectFrom(QUESTION_ASSETS, 'personal', `question_${theme}`, userId, dateKey);
}

export function getUniversalCardBackground(
  theme: UniversalCardTheme,
  userId = 'guest',
  dateKey = 'base',
): CardBackgroundAsset | null {
  if (theme === 'natal' || theme === 'compatibility' || theme === 'matrix') {
    return selectFrom(PRODUCT_ASSETS, 'universal', theme, userId, dateKey);
  }
  return selectAsset('universal', theme, userId, dateKey);
}

export function getStripCardBackground(
  theme: 'advantage' | 'conversation',
): CardBackgroundAsset | null {
  return ASSETS.find(
    (asset) => asset.category === 'strips' && asset.theme === theme && asset.season === 'base',
  ) || null;
}

export function cardBackgroundStyle(asset: CardBackgroundAsset | null): CardBackgroundStyle | undefined {
  if (!asset) return undefined;
  return {
    '--card-bg-image': `url("${asset.path}")`,
    '--card-bg-position': asset.background_position || 'center',
  };
}
