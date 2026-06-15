import React from 'react';

/**
 * Editorial B&W line-art — placeholders for generated art.
 * Style: single-weight (~2.4px) rounded strokes, no fill, no shading, sparkle accents.
 * These are intentional stand-ins; final art is swapped via lib/lzArtAssets.ts (LzArtPlate).
 */

type Tone = 'ink' | 'light';
type SvgProps = { className?: string; size?: number; tone?: Tone };

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 120 120',
    fill: 'none' as const,
    'aria-hidden': true as const,
  };
}

const STROKE = {
  fill: 'none',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function ink(tone: Tone) {
  return tone === 'light' ? '#ffffff' : '#111111';
}

/** Small 4-point editorial sparkle */
function Sparkle({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <path
      d={`M${x} ${y - s} C${x} ${y - s / 3} ${x + s / 3} ${y} ${x + s} ${y} C${x + s / 3} ${y} ${x} ${y + s / 3} ${x} ${y + s} C${x} ${y + s / 3} ${x - s / 3} ${y} ${x - s} ${y} C${x - s / 3} ${y} ${x} ${y - s / 3} ${x} ${y - s} Z`}
      stroke={color}
      {...STROKE}
    />
  );
}

/** Person reading — personal day / daily reader */
export function MonoIllustPersonal({ className, size = 96, tone = 'ink' }: SvgProps) {
  const c = ink(tone);
  return (
    <svg {...base(size)} className={className}>
      <path d="M22 96h60" stroke={c} {...STROKE} />
      <circle cx="46" cy="32" r="11" stroke={c} {...STROKE} />
      <path d="M32 90c-2-22 6-37 14-37s16 13 14 33" stroke={c} {...STROKE} />
      <path d="M55 60c8 3 14 8 18 12" stroke={c} {...STROKE} />
      <path d="M73 64c-6-2-12-1-17 2l2 22c5-3 11-4 17-2z" stroke={c} {...STROKE} />
      <path d="M73 64c6-2 12-1 17 2l-2 22c-5-3-11-4-17-2" stroke={c} {...STROKE} />
      <path d="M73 66v20" stroke={c} {...STROKE} />
      <Sparkle x={92} y={30} s={6} color={c} />
      <Sparkle x={28} y={50} s={4.5} color={c} />
    </svg>
  );
}

/** Two people — compatibility / union */
export function MonoIllustCouple({ className, size = 104, tone = 'ink' }: SvgProps) {
  const c = ink(tone);
  return (
    <svg {...base(size)} className={className}>
      <path d="M22 94h76" stroke={c} {...STROKE} />
      <circle cx="44" cy="42" r="11" stroke={c} {...STROKE} />
      <path d="M30 94c-2-22 6-36 14-36s16 14 14 36" stroke={c} {...STROKE} />
      <circle cx="80" cy="42" r="11" stroke={c} {...STROKE} />
      <path d="M66 94c-2-22 6-36 14-36s16 14 14 36" stroke={c} {...STROKE} />
      <path d="M62 30c-2-3-7-2-7 2 0 4 7 8 7 8s7-4 7-8c0-4-5-5-7-2z" stroke={c} {...STROKE} />
      <Sparkle x={96} y={26} s={5} color={c} />
    </svg>
  );
}

/** Radiant sun — horoscope */
export function MonoIllustHoroscope({ className, size = 92, tone = 'ink' }: SvgProps) {
  const c = ink(tone);
  return (
    <svg {...base(size)} className={className}>
      <circle cx="58" cy="60" r="19" stroke={c} {...STROKE} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const r = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={58 + Math.cos(r) * 26}
            y1={60 + Math.sin(r) * 26}
            x2={58 + Math.cos(r) * 33}
            y2={60 + Math.sin(r) * 33}
            stroke={c}
            {...STROKE}
          />
        );
      })}
      <Sparkle x={92} y={32} s={6} color={c} />
      <Sparkle x={30} y={92} s={4.5} color={c} />
    </svg>
  );
}

/** Natal wheel — chart */
export function MonoIllustChart({ className, size = 92, tone = 'ink' }: SvgProps) {
  const c = ink(tone);
  return (
    <svg {...base(size)} className={className}>
      <circle cx="60" cy="60" r="34" stroke={c} {...STROKE} />
      <circle cx="60" cy="60" r="17" stroke={c} {...STROKE} />
      <circle cx="60" cy="60" r="2.6" stroke={c} {...STROKE} />
      <path d="M60 26v8M60 86v8M26 60h8M86 60h8" stroke={c} {...STROKE} />
      <path d="M37 37l5 5M83 37l-5 5M37 83l5-5M83 83l-5-5" stroke={c} {...STROKE} />
      <Sparkle x={96} y={26} s={5.5} color={c} />
    </svg>
  );
}

/** Waving person — onboarding welcome */
export function MonoIllustWelcome({ className, size = 132, tone = 'ink' }: SvgProps) {
  const c = ink(tone);
  return (
    <svg {...base(size)} className={className}>
      <path d="M30 100h60" stroke={c} {...STROKE} />
      <circle cx="58" cy="36" r="13" stroke={c} {...STROKE} />
      <path d="M40 100c-2-26 8-42 18-42s20 16 18 42" stroke={c} {...STROKE} />
      <path d="M70 62c8-3 13-9 15-16" stroke={c} {...STROKE} />
      <Sparkle x={92} y={28} s={7} color={c} />
      <Sparkle x={30} y={46} s={5} color={c} />
      <Sparkle x={98} y={64} s={4.5} color={c} />
    </svg>
  );
}

/** Envelope with lines — Ask / newsletter / notes */
export function MonoIllustLetter({ className, size = 96, tone = 'ink' }: SvgProps) {
  const c = ink(tone);
  return (
    <svg {...base(size)} className={className}>
      <rect x="24" y="38" width="72" height="48" rx="8" stroke={c} {...STROKE} />
      <path d="M26 44l34 24 34-24" stroke={c} {...STROKE} />
      <Sparkle x={94} y={28} s={6} color={c} />
      <Sparkle x={30} y={30} s={4} color={c} />
    </svg>
  );
}

/** Two speech bubbles — Ask Lumia chat */
export function MonoIllustChat({ className, size = 96, tone = 'ink' }: SvgProps) {
  const c = ink(tone);
  return (
    <svg {...base(size)} className={className}>
      <path d="M24 38h44a8 8 0 018 8v18a8 8 0 01-8 8H42l-12 10v-10h-6a8 8 0 01-8-8V46a8 8 0 018-8z" stroke={c} {...STROKE} />
      <path d="M76 56h12a8 8 0 018 8v12a8 8 0 01-8 8h-2v8l-10-8H66" stroke={c} {...STROKE} />
      <path d="M34 50h26M34 60h18" stroke={c} {...STROKE} />
      <Sparkle x={96} y={34} s={5} color={c} />
    </svg>
  );
}

/** Key / unlock with sparkles — premium paywall */
export function MonoIllustPremium({ className, size = 104, tone = 'ink' }: SvgProps) {
  const c = ink(tone);
  return (
    <svg {...base(size)} className={className}>
      <circle cx="46" cy="46" r="18" stroke={c} {...STROKE} />
      <path d="M58 58l28 28M74 74l8-8M80 80l8-8" stroke={c} {...STROKE} />
      <circle cx="46" cy="46" r="6" stroke={c} {...STROKE} />
      <Sparkle x={88} y={34} s={7} color={c} />
      <Sparkle x={30} y={84} s={5} color={c} />
      <Sparkle x={70} y={26} s={4.5} color={c} />
    </svg>
  );
}
