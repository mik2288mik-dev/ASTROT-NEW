import React from 'react';
import type { MoonPhaseSlot } from '../../lib/horoscope/moonPhase';

type Props = {
  slot: MoonPhaseSlot;
  size?: number;
  fill?: string;     // illuminated half color
  outline?: string;  // dark half outline
};

/**
 * Mono SVG icon for the eight moon phase slots.
 * Drawn as a circle with a clipping arc for the shadow side.
 */
export const MoonPhaseIcon: React.FC<Props> = ({
  slot,
  size = 22,
  fill = '#1f1f1f',
  outline = '#1f1f1f',
}) => {
  const r = 10;
  const c = 12;

  if (slot === 'full') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <circle cx={c} cy={c} r={r} fill={fill} />
      </svg>
    );
  }

  if (slot === 'new') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
        <circle cx={c} cy={c} r={r} fill="none" stroke={outline} strokeWidth={1.4} />
      </svg>
    );
  }

  // For other phases we render a full circle outline + a half-disc/crescent
  // shape on top. The "rx" of the inner ellipse encodes how much is lit.
  const isWaxing = slot.startsWith('waxing') || slot === 'first-quarter';
  const isQuarter = slot === 'first-quarter' || slot === 'last-quarter';
  const isCrescent = slot === 'waxing-crescent' || slot === 'waning-crescent';

  // Lit-side ellipse rx (negative = curve goes inward).
  const litRx = isQuarter ? 0 : isCrescent ? -r * 0.5 : r * 0.5;

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx={c} cy={c} r={r} fill="none" stroke={outline} strokeWidth={1.2} />
      <path
        d={
          isWaxing
            ? // lit half on the right
              `M ${c} ${c - r}
               A ${r} ${r} 0 0 1 ${c} ${c + r}
               A ${Math.abs(litRx)} ${r} 0 0 ${litRx >= 0 ? 1 : 0} ${c} ${c - r} Z`
            : // lit half on the left
              `M ${c} ${c - r}
               A ${r} ${r} 0 0 0 ${c} ${c + r}
               A ${Math.abs(litRx)} ${r} 0 0 ${litRx >= 0 ? 0 : 1} ${c} ${c - r} Z`
        }
        fill={fill}
      />
    </svg>
  );
};
