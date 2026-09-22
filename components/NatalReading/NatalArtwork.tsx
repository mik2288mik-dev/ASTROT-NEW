import React from 'react';
import styles from './NatalSection.module.css';

export type NatalArt = 'character' | 'emotions' | 'love' | 'communication' | 'work' | 'money' | 'home' | 'plus' | 'planets' | 'houses' | 'aspects' | 'points';

// Display only the illustration regions from the supplied visual reference.
// Reference text, device frames and example chart data are never rendered.
const REGIONS: Record<Exclude<NatalArt, 'plus'>, [number, number, number, number]> = {
  character: [181, 241, 89, 65],
  emotions: [181, 349, 89, 60],
  love: [181, 454, 89, 78],
  communication: [181, 660, 89, 56],
  work: [181, 751, 89, 52],
  money: [184, 840, 86, 49],
  home: [648, 419, 141, 36],
  planets: [648, 208, 141, 36],
  houses: [648, 419, 141, 36],
  aspects: [648, 596, 141, 36],
  points: [648, 792, 141, 34],
};

const DETAIL_ARTWORKS: Partial<Record<NatalArt, string>> = {
  planets: '/natal-art/details-planets-v1.png',
  houses: '/natal-art/details-houses-v1.png',
  aspects: '/natal-art/details-aspects-v1.png',
  points: '/natal-art/details-ascendant-v1.png',
};

/** Decorative still lifes only. They do not encode or replace calculated chart facts. */
export function NatalArtwork({ art, className = '' }: { art: NatalArt; className?: string }) {
  const [x,y,width,height] = art === 'plus' ? [452,270,60,63] : REGIONS[art];
  const detailArtwork = DETAIL_ARTWORKS[art];
  return <span aria-hidden="true" data-art={art} className={`${styles.artwork} ${className}`} style={{
    backgroundImage: `url('${detailArtwork || `/natal-art/${art === 'plus' ? 'render-map-reference' : 'render-reference'}.png`}')`,
    backgroundSize: detailArtwork ? 'cover' : `${1672 / width * 100}% ${941 / height * 100}%`,
    backgroundPosition: detailArtwork ? 'left center' : `${x / (1672 - width) * 100}% ${y / (941 - height) * 100}%`,
    backgroundRepeat: 'no-repeat',
  }} />;
}
