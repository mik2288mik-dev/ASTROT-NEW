import React from 'react';

/**
 * Doodle skin — decorative hand-drawn celestial art (visual-only, aria-hidden).
 * All shapes go through the global `doodle-rough2` filter for the sketch look.
 * @see docs/doodle-redesign.md
 */

const sketch = { filter: 'url(#doodle-rough2)' } as const;

/** Moon + scattered stars — for the hero corner. */
export function DoodleSky({ className = '', width = 150, ink = '#20242A' }: { className?: string; width?: number; ink?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={width}
      height={Math.round((width * 118) / 150)}
      viewBox="0 0 150 118"
      fill="none"
      stroke={ink}
      strokeWidth={2}
      style={sketch}
    >
      <circle cx="110" cy="38" r="20" />
      <path d="M110 18a20 20 0 0 0 0 40 16 16 0 0 1 0-40z" fill={ink} stroke="none" />
      <path d="M44 58l1.6 4 4 1.6-4 1.6L44 71l-1.6-3.8-4-1.6 4-1.6z" stroke="#E0A93C" strokeLinejoin="round" />
      <path d="M74 88l1.4 3.4 3.6 1.4-3.6 1.4L74 99l-1.4-3.4-3.6-1.4 3.6-1.4z" stroke="#FF6B6B" strokeLinejoin="round" />
      <circle cx="132" cy="84" r="2.4" fill={ink} stroke="none" />
      <path d="M30 30q10 8 22 2" stroke="#9B7FD6" strokeLinecap="round" />
    </svg>
  );
}

/** Ringed planet — card corner decor. */
export function DoodlePlanet({ className = '', size = 58, ink = '#20242A' }: { className?: string; size?: number; ink?: string }) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 58 58" fill="none" stroke={ink} strokeWidth={2} style={sketch}>
      <circle cx="29" cy="29" r="13" />
      <ellipse cx="29" cy="29" rx="25" ry="9" transform="rotate(25 29 29)" />
    </svg>
  );
}

/** Sun with rays. */
export function DoodleSun({ className = '', size = 58, ink = '#20242A' }: { className?: string; size?: number; ink?: string }) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 58 58" fill="none" stroke={ink} strokeWidth={2} strokeLinecap="round" style={sketch}>
      <circle cx="29" cy="29" r="11" />
      <path d="M29 6v7M29 45v7M6 29h7M45 29h7M13 13l5 5M40 40l5 5M45 13l-5 5M18 40l-5 5" />
    </svg>
  );
}

/** Four-point sparkle star. */
export function DoodleStar({ className = '', size = 24, color = '#20242A' }: { className?: string; size?: number; color?: string }) {
  return (
    <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" style={sketch}>
      <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
    </svg>
  );
}
