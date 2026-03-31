import React, { memo } from 'react';

/** Vertical rhythm + horizontal insets + bottom safe scroll padding (Phase 8 AIR). */
export const SCREEN_SHELL_CLASS = 'w-full min-w-0 space-y-air-lg px-4 sm:px-5 screen-pb';

/** Glass surface: matches Dashboard / forecast panels. */
export const AIR_GLASS_PANEL_CLASS =
  'lumia-glass rounded-air-panel px-5 py-5 sm:px-6 sm:py-6';

export const ScreenShell = memo<{
  children: React.ReactNode;
  className?: string;
}>(({ children, className = '' }) => (
  <div className={`${SCREEN_SHELL_CLASS} ${className}`.trim()}>{children}</div>
));

ScreenShell.displayName = 'ScreenShell';

/** Long-form screens: same rhythm + comfortable measure (inside `main` max-width). */
export const ReadingScreenShell = memo<{
  children: React.ReactNode;
  className?: string;
}>(({ children, className = '' }) => (
  <div
    className={`min-h-full space-y-air-lg pt-1 screen-pb mx-auto w-full max-w-reading-wide px-4 sm:px-5 ${className}`.trim()}
  >
    {children}
  </div>
));

ReadingScreenShell.displayName = 'ReadingScreenShell';

export const AirSection = memo<{
  children: React.ReactNode;
  variant?: 'glass' | 'plain';
  className?: string;
}>(({ children, variant = 'glass', className = '' }) => {
  const base =
    variant === 'glass'
      ? AIR_GLASS_PANEL_CLASS
      : 'px-0 pt-1';
  return <section className={`${base} ${className}`.trim()}>{children}</section>;
});

AirSection.displayName = 'AirSection';
