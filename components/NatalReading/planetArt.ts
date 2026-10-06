import type React from 'react';

export type PlanetArtKey = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

/**
 * Each planet gets its own colour filter over the blurred photo, spread round
 * the colour wheel so neighbouring cards differ (Jupiter royal blue, as in the tradition).
 */
const PLANET_TINT: Record<PlanetArtKey, [string, string]> = {
  sun: ['rgba(236, 160, 24, 0.5)', 'rgba(204, 116, 10, 0.66)'],
  moon: ['rgba(118, 98, 168, 0.6)', 'rgba(76, 58, 128, 0.74)'],
  mercury: ['rgba(20, 142, 184, 0.52)', 'rgba(12, 96, 138, 0.68)'],
  venus: ['rgba(214, 84, 140, 0.5)', 'rgba(160, 48, 104, 0.66)'],
  mars: ['rgba(176, 58, 38, 0.5)', 'rgba(124, 34, 24, 0.66)'],
  jupiter: ['rgba(54, 84, 196, 0.6)', 'rgba(34, 52, 146, 0.74)'],
  saturn: ['rgba(24, 132, 112, 0.56)', 'rgba(14, 92, 80, 0.72)'],
};

/** Bright planet-over-landscape backgrounds for the natal tiles and profile cards. */
export function planetArtStyle(key: PlanetArtKey): React.CSSProperties {
  const [top, bottom] = PLANET_TINT[key];
  return {
    ['--planet-art' as string]: `url('/assets/planets/${key}.webp')`,
    ['--art-tint' as string]: top,
    ['--art-tint-deep' as string]: bottom,
  };
}
