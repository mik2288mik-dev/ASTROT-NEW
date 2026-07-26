import type { CSSProperties } from 'react';
import manifest from '../docs/design/card-background-system/card-background-manifest.json';

export type CardBackgroundCategory = 'hero' | 'personal' | 'universal' | 'strips';
export type UniversalCardTheme = 'natal' | 'compatibility' | 'zodiac' | 'matrix' | 'more';

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

const MANIFEST_ASSETS = (manifest.assets as CardBackgroundAsset[]).filter(
  (asset) => asset.enabled,
);

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
    description: 'Editorial natal chart scene.',
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
    description: 'Editorial compatibility scene.',
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
    description: 'Editorial matrix scene.',
  })),
];

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
  theme: UniversalCardTheme,
  userId: string,
  dateKey: string,
): CardBackgroundAsset | null {
  const candidates = assets.filter(
    (asset) => asset.category === 'universal'
      && asset.theme === theme
      && asset.season === 'base',
  );
  if (!candidates.length) return null;
  const index = stableHash(`${userId}|${dateKey}|${theme}`) % candidates.length;
  return candidates[index] || candidates[0] || null;
}

export function getUniversalCardBackground(
  theme: UniversalCardTheme,
  userId = 'guest',
  dateKey = 'base',
): CardBackgroundAsset | null {
  const assets = theme === 'natal' || theme === 'compatibility' || theme === 'matrix'
    ? PRODUCT_ASSETS
    : MANIFEST_ASSETS;
  return selectFrom(assets, theme, userId, dateKey);
}

export function cardBackgroundStyle(
  asset: CardBackgroundAsset | null,
): CardBackgroundStyle | undefined {
  if (!asset) return undefined;
  return {
    '--card-bg-image': `url("${asset.path}")`,
    '--card-bg-position': asset.background_position,
  };
}
