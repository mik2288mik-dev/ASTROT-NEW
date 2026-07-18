import type { CSSProperties } from 'react';
import manifest from '../docs/design/card-background-system/card-background-manifest.json';
import type { PersonalDailySection } from '../types';

export type CardBackgroundCategory = 'hero' | 'personal' | 'universal' | 'strips';

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

const PERSONAL_THEME_BY_SECTION: Record<PersonalDailySection, string> = {
  overview: 'overview',
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

function selectAsset(
  category: CardBackgroundCategory,
  theme: string,
  userId: string,
  dateKey: string,
): CardBackgroundAsset | null {
  const candidates = ASSETS.filter(
    (asset) => asset.category === category && asset.theme === theme && asset.season === 'base',
  );
  if (!candidates.length) return null;
  const index = stableHash(`${userId || 'guest'}|${dateKey}|${category}|${theme}`) % candidates.length;
  return candidates[index] || candidates[0] || null;
}

export function getHeroCardBackground(userId: string, dateKey: string): CardBackgroundAsset | null {
  return selectAsset('hero', 'personal_horoscope', userId, dateKey);
}

export function getPersonalCardBackground(
  section: PersonalDailySection,
  userId: string,
  dateKey: string,
): CardBackgroundAsset | null {
  return selectAsset('personal', PERSONAL_THEME_BY_SECTION[section], userId, dateKey);
}

export function getUniversalCardBackground(
  theme: 'natal' | 'compatibility' | 'zodiac' | 'matrix' | 'more',
): CardBackgroundAsset | null {
  return ASSETS.find(
    (asset) => asset.category === 'universal' && asset.theme === theme && asset.season === 'base',
  ) || null;
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
