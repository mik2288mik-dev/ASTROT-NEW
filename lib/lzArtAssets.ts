/** Drop PNG/WebP paths here when art is ready — UI picks them up automatically. */
export type LzArtSlot =
  | 'homeHoroscope'
  | 'homeNatal'
  | 'homeUnion'
  | 'readerHero'
  | 'magazineCover'
  | 'unionLanding'
  | 'onboardingWelcome';

export const LZ_ART_IMAGES: Record<LzArtSlot, string | null> = {
  homeHoroscope: null,
  homeNatal: null,
  homeUnion: null,
  readerHero: null,
  magazineCover: null,
  unionLanding: null,
  onboardingWelcome: null,
};

export function getLzArtSrc(slot: LzArtSlot): string | null {
  const src = LZ_ART_IMAGES[slot];
  return src?.trim() ? src : null;
}
