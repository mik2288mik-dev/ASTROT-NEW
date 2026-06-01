/**
 * Premium content prewarm — not implemented yet.
 * See docs/CONTENT_CACHE_AND_PREWARM.md for the idempotent prewarm contract.
 */
export const PREMIUM_CONTENT_PREWARM_STATUS = 'not_implemented' as const;

export type PremiumPrewarmLayer = {
  contentSurface: 'natal' | 'forecast' | 'synastry';
  contentVariant: string;
  cacheKey: string;
  accessTier: 'premium' | 'free';
};

/** Layers that a future prewarm job should consider (documentation / tests only). */
export const PREMIUM_PREWARM_CANDIDATE_LAYERS: PremiumPrewarmLayer[] = [
  { contentSurface: 'natal', contentVariant: 'full', cacheKey: 'personality', accessTier: 'premium' },
  { contentSurface: 'forecast', contentVariant: 'daily', cacheKey: '<date>', accessTier: 'free' },
  { contentSurface: 'forecast', contentVariant: 'morning', cacheKey: '<date>:morning', accessTier: 'premium' },
  { contentSurface: 'forecast', contentVariant: 'day', cacheKey: '<date>:day', accessTier: 'premium' },
  { contentSurface: 'forecast', contentVariant: 'evening', cacheKey: '<date>:evening', accessTier: 'premium' },
  { contentSurface: 'forecast', contentVariant: 'weekly', cacheKey: '<iso-week>', accessTier: 'premium' },
  { contentSurface: 'forecast', contentVariant: 'monthly', cacheKey: '<month>', accessTier: 'premium' },
];
