import React from 'react';

/**
 * Doodle skin primitives (visual-only). Hand-drawn personal-diary direction.
 * @see docs/doodle-redesign.md
 * Requires <DoodleDefs/> mounted once at the app root (see pages/_app.tsx).
 */

// ─── RoughBorder ────────────────────────────────────────────────────────────
// Absolutely-positioned hand-drawn border overlay. Drop into any `relative` box.

type RoughBorderProps = {
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
  variant?: 'soft' | 'tight';
  inset?: number;
  className?: string;
};

export function RoughBorder({
  radius = 18,
  stroke = '#20242A',
  strokeWidth = 2.2,
  variant = 'tight',
  inset = 3,
  className = '',
}: RoughBorderProps) {
  const filterId = variant === 'soft' ? 'doodle-rough' : 'doodle-rough2';
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{ width: '100%', height: '100%', overflow: 'visible' }}
    >
      <rect
        x={inset}
        y={inset}
        rx={radius}
        ry={radius}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        filter={`url(#${filterId})`}
        style={{ width: `calc(100% - ${inset * 2}px)`, height: `calc(100% - ${inset * 2}px)` }}
      />
    </svg>
  );
}

// ─── RoughCard ──────────────────────────────────────────────────────────────
// Filled card with a hand-drawn border. For static (non-animated) cards.

type RoughCardProps = React.HTMLAttributes<HTMLDivElement> & {
  fill?: string;
  radius?: number;
  stroke?: string;
  strokeWidth?: number;
  variant?: 'soft' | 'tight';
  innerClassName?: string;
};

export function RoughCard({
  fill = '#FFFFFF',
  radius = 18,
  stroke,
  strokeWidth,
  variant,
  innerClassName = '',
  className = '',
  style,
  children,
  ...rest
}: RoughCardProps) {
  return (
    <div className={`relative ${className}`} style={{ backgroundColor: fill, borderRadius: radius, ...style }} {...rest}>
      <RoughBorder radius={radius} stroke={stroke} strokeWidth={strokeWidth} variant={variant} />
      <div className={`relative ${innerClassName}`}>{children}</div>
    </div>
  );
}

// ─── Marker (highlight) ─────────────────────────────────────────────────────
// Marker-pen highlight behind inline text (irregular radius = hand feel).

export function Marker({
  color = '#FFE36E',
  className = '',
  children,
}: {
  color?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={className}
      style={{
        background: color,
        padding: '0 0.26em',
        borderRadius: '7px 10px 6px 11px',
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
      }}
    >
      {children}
    </span>
  );
}

// ─── Underline (wavy doodle) ────────────────────────────────────────────────

export function Underline({
  color = '#FF6B6B',
  width = 160,
  strokeWidth = 3.4,
  className = '',
}: {
  color?: string;
  width?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 160 11"
      width={width}
      height={Math.round((width * 11) / 160)}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      style={{ filter: 'url(#doodle-rough2)', display: 'block' }}
    >
      <path d="M2 6q13 -7 26 0t26 0t26 0t26 0t26 0" strokeLinecap="round" />
    </svg>
  );
}

// ─── WashiPhoto (polaroid avatar on tape) ───────────────────────────────────

export function WashiPhoto({
  src,
  initial = '?',
  size = 64,
  rotate = -4,
  className = '',
}: {
  src?: string | null;
  initial?: string;
  size?: number;
  rotate?: number;
  className?: string;
}) {
  return (
    <div className={`relative flex-shrink-0 ${className}`} style={{ width: size, height: size, transform: `rotate(${rotate}deg)` }}>
      <div className="h-full w-full rounded-[3px] bg-white p-1 shadow-[0_4px_10px_rgba(40,40,40,0.16)]">
        {src ? (
          <img src={src} alt="" draggable={false} className="h-full w-full rounded-[2px] object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-[2px] bg-doodle-sviolet font-doodleDisplay text-[26px] leading-none text-doodle-ink">
            {initial}
          </div>
        )}
      </div>
      <span aria-hidden="true" className="absolute -top-2 left-3 h-[18px] w-[38px] -rotate-6" style={{ background: 'rgba(255,210,90,0.75)' }} />
    </div>
  );
}

// ─── ScribbleSelect (hand-drawn active ring) ────────────────────────────────
// Stretches to fill its `relative` parent. Use for the selected calendar day.

export function ScribbleSelect({ color = '#9B7FD6', className = '' }: { color?: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={`pointer-events-none absolute ${className}`}
      viewBox="0 0 48 64"
      preserveAspectRatio="none"
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      style={{ inset: -3, width: 'calc(100% + 6px)', height: 'calc(100% + 6px)', overflow: 'visible', filter: 'url(#doodle-rough)' }}
    >
      <ellipse cx="24" cy="32" rx="20" ry="28" vectorEffect="non-scaling-stroke" />
      <ellipse cx="24" cy="32" rx="22" ry="30" strokeOpacity="0.45" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
