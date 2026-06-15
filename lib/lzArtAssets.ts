/**
 * Art slots for the Editorial B&W skin.
 *
 * HOW TO ADD REAL ART (no code changes elsewhere):
 *   1. Generate the image as black line-art on a white background (pure B&W, ~2px strokes)
 *   2. Drop the file in /public/art/ (e.g. /public/art/home-horoscope.webp)
 *   3. Put the path string in LZ_ART_IMAGES below (e.g. '/art/home-horoscope.webp')
 * The UI (LzArtPlate) auto-detects it and replaces the line-art placeholder.
 *
 * Until a slot has a path, the placeholder line-art from MonoIllustrations renders.
 */
export type LzArtSlot =
  | 'homeHoroscope'
  | 'homeNatal'
  | 'homeUnion'
  | 'readerHero'
  | 'magazineCover'
  | 'unionLanding'
  | 'unionResult'
  | 'onboardingWelcome'
  | 'paywallHero'
  | 'askEmpty'
  | 'personalDaily';

export const LZ_ART_IMAGES: Record<LzArtSlot, string | null> = {
  homeHoroscope: null,
  homeNatal: null,
  homeUnion: null,
  readerHero: null,
  magazineCover: null,
  unionLanding: null,
  unionResult: null,
  onboardingWelcome: null,
  paywallHero: null,
  askEmpty: null,
  personalDaily: null,
};

export function getLzArtSrc(slot: LzArtSlot): string | null {
  const src = LZ_ART_IMAGES[slot];
  return src?.trim() ? src : null;
}
