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

// Section headers on the map tab use the app's sky palette instead of space imagery.
const DETAIL_SKIES: Partial<Record<NatalArt, string>> = {
  planets: 'linear-gradient(90deg, #2d7ff0 0%, #78b4f4 100%)',
  houses: 'linear-gradient(90deg, #ec7558 0%, #f4a47c 100%)',
  aspects: 'linear-gradient(90deg, #26357a 0%, #9a76a8 100%)',
  points: 'linear-gradient(90deg, #f08a6c 0%, #f6c08f 100%)',
};

/** Decorative still lifes only. They do not encode or replace calculated chart facts. */
export function NatalArtwork({ art, className = '' }: { art: NatalArt; className?: string }) {
  const [x,y,width,height] = art === 'plus' ? [452,270,60,63] : REGIONS[art];
  const detailSky = DETAIL_SKIES[art];
  if (detailSky) {
    return <span aria-hidden="true" data-art={art} className={`${styles.artwork} ${className}`} style={{ backgroundImage: detailSky }} />;
  }
  return <span aria-hidden="true" data-art={art} className={`${styles.artwork} ${className}`} style={{
    backgroundImage: `url('/natal-art/${art === 'plus' ? 'render-map-reference' : 'render-reference'}.png')`,
    backgroundSize: `${1672 / width * 100}% ${941 / height * 100}%`,
    backgroundPosition: `${x / (1672 - width) * 100}% ${y / (941 - height) * 100}%`,
    backgroundRepeat: 'no-repeat',
  }} />;
}
