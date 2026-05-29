import type { AskLumiaTier, ContentAccessTier } from '../types';

/** Product-facing access tiers. `lumi` is legacy storage only. */
export type ProductAccessTier = 'free' | 'premium' | 'stars';

export function normalizeProductAccessTier(
  tier: string | null | undefined
): ProductAccessTier | null {
  if (tier === 'free' || tier === 'premium' || tier === 'stars') return tier;
  if (tier === 'lumi') return 'stars';
  return null;
}

export function normalizeAskLumiaTier(value: unknown): AskLumiaTier | null {
  if (value === 'free' || value === 'premium' || value === 'stars') return value;
  if (value === 'lumi') return 'stars';
  return null;
}

export function isStarsLikeAccessTier(tier: ContentAccessTier | string | null | undefined) {
  return tier === 'stars' || tier === 'lumi';
}

export function normalizeStoredAccessTier(tier: ContentAccessTier): ContentAccessTier {
  return tier === 'lumi' ? 'stars' : tier;
}

export function toStorageAccessTier(tier: ContentAccessTier): ContentAccessTier {
  if (tier === 'stars') return 'stars';
  return tier;
}
