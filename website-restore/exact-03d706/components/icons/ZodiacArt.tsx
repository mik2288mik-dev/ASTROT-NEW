import React from 'react';
import { resolveZodiacKey, type ZodiacSignKey } from './ZodiacIcon';

/**
 * Raster zodiac art (steel/silver, recolored to the app palette).
 *
 * Two sets live in /public/zodiac:
 *  - sign_symbol_<key>.png       — sculpted glyph, for small selector chips
 *  - sign_illustration_<key>.png — themed figure (centaur, bull…), for large hero art
 *
 * Falls back to the stroke <ZodiacIcon> when the sign can't be resolved.
 */

function keyOf(sign: string | ZodiacSignKey | null | undefined): ZodiacSignKey | null {
  if (!sign) return null;
  if (typeof sign !== 'string') return sign;
  return resolveZodiacKey(sign) || (isKey(sign) ? (sign as ZodiacSignKey) : null);
}

const KEYS: ZodiacSignKey[] = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
function isKey(s: string): s is ZodiacSignKey {
  return (KEYS as string[]).includes(s.toLowerCase());
}

type SymbolProps = {
  sign: string | ZodiacSignKey | null | undefined;
  size?: number;
  className?: string;
  alt?: string;
};

export const ZodiacSymbol: React.FC<SymbolProps> = ({ sign, size = 22, className = '', alt = '' }) => {
  const key = keyOf(sign);
  if (!key) return null;
  return (
    <img
      src={`/zodiac/sign_symbol_${key}.png`}
      width={size}
      height={size}
      className={className}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading="lazy"
      decoding="async"
      draggable={false}
      style={{ display: 'block', objectFit: 'contain' }}
    />
  );
};

type IllustrationProps = {
  sign: string | ZodiacSignKey | null | undefined;
  className?: string;
  alt?: string;
  priority?: boolean;
};

export const ZodiacIllustration: React.FC<IllustrationProps> = ({
  sign,
  className = '',
  alt = '',
  priority = false,
}) => {
  const key = keyOf(sign);
  if (!key) return null;
  return (
    <img
      src={`/zodiac/sign_illustration_${key}.png`}
      className={className}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'sync' : 'async'}
      draggable={false}
    />
  );
};

/** URL helper for use as a CSS background-image. */
export function zodiacIllustrationUrl(sign: string | ZodiacSignKey | null | undefined): string | null {
  const key = keyOf(sign);
  return key ? `/zodiac/sign_illustration_${key}.png` : null;
}
