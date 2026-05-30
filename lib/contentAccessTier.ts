import type { AskLumiaTier, ContentAccessTier } from '../types';

export type ProductAccessTier = 'free' | 'premium';

export function normalizeProductAccessTier(
  tier: string | null | undefined
): ProductAccessTier | null {
  if (tier === 'free' || tier === 'premium') return tier;
  return null;
}

export function normalizeAskLumiaTier(value: unknown): AskLumiaTier | null {
  if (value === 'free' || value === 'premium') return value;
  return null;
}

export function normalizeStoredAccessTier(tier: ContentAccessTier): ContentAccessTier {
  return tier === 'free' || tier === 'premium' ? tier : 'premium';
}

export function toStorageAccessTier(tier: ContentAccessTier): ContentAccessTier {
  return tier;
}
