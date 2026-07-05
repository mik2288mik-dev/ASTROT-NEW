import React, { memo, useId } from 'react';

type LumiaLogoProps = {
  /** Horizontal row: mark + wordmark */
  variant?: 'row' | 'mark';
  className?: string;
  /** Light text for dark / cosmic backgrounds */
  inverted?: boolean;
  /** Тёмный текст — для белого фона (экран загрузки и т.п.) */
  lightSurface?: boolean;
};

/**
 * Brand mark (crescent) + LUMIA wordmark — use until raster logo is added to /public.
 */
export const LumiaLogo = memo<LumiaLogoProps>(({ variant = 'row', className = '', inverted = false, lightSurface = false }) => {
  const gradId = useId().replace(/:/g, '');
  const textClass = inverted ? 'text-white/95' : lightSurface ? 'text-[#2d2d2d]' : 'text-astro-text';
  const markClass = inverted ? 'text-violet-200' : 'text-astro-highlight';

  const mark = (
    <svg
      className={`shrink-0 ${markClass}`}
      width={variant === 'row' ? 26 : 32}
      height={variant === 'row' ? 26 : 32}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="8" y1="4" x2="32" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor={inverted ? '#f5f3ff' : '#c4b5fd'} />
          <stop offset="0.45" stopColor={inverted ? '#ddd6fe' : '#a78bfa'} />
          <stop offset="1" stopColor={inverted ? '#a78bfa' : '#7c3aed'} />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradId})`}
        d="M20 3C10.6 3 3 10.6 3 20s7.6 17 17 17c1.4 0 2.8-.2 4.1-.5-6.9-1.6-12-7.8-12-15.5 0-7.7 5.1-13.9 12-15.5A17 17 0 0020 3z"
      />
    </svg>
  );

  if (variant === 'mark') {
    return <span className={`inline-flex ${className}`}>{mark}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      {mark}
      <span
        className={`lumia-brand-wordmark-row ${textClass}`}
        style={{ fontFeatureSettings: '"smcp" 0' }}
      >
        Твой Гороскоп
      </span>
    </span>
  );
});

LumiaLogo.displayName = 'LumiaLogo';
