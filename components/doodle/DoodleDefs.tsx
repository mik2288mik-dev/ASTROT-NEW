import React from 'react';

/**
 * Doodle skin — global SVG filter defs (hand-drawn "rough" line look).
 * Mounted once at the app root; primitives reference these by id.
 * @see docs/doodle-redesign.md
 *
 * `doodle-rough`  — gentler wobble for large frames (hero / big cards)
 * `doodle-rough2` — tighter wobble for small shapes (icons, underlines, tags)
 */
export function DoodleDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
    >
      <defs>
        <filter id="doodle-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="4" />
        </filter>
        <filter id="doodle-rough2" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="9" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3" />
        </filter>
      </defs>
    </svg>
  );
}

export default DoodleDefs;
