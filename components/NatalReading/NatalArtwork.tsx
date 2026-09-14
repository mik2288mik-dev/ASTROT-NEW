import React from 'react';
import styles from './NatalSection.module.css';

export type NatalArt = 'character' | 'emotions' | 'love' | 'communication' | 'work' | 'home' | 'plus';

/** Decorative still lifes only. They do not encode or replace calculated chart facts. */
export function NatalArtwork({ art, className = '' }: { art: NatalArt; className?: string }) {
  if (art === 'plus') return <img src="/natal-art/question-glass.png" width={160} height={160} alt="" loading="lazy" className={`${styles.artwork} ${className}`} />;
  return <span aria-hidden="true" data-art={art} className={`${styles.artwork} ${styles.artworkTile} ${className}`} />;
}
