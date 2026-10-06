import type React from 'react';

export type PlanetArtKey = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn';

/** Bright planet-over-landscape backgrounds for the natal tiles and profile cards. */
export function planetArtStyle(key: PlanetArtKey): React.CSSProperties {
  return { ['--planet-art' as string]: `url('/assets/planets/${key}.webp')` };
}
