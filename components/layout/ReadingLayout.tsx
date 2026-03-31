import React, { memo } from 'react';
import { AIR_GLASS_PANEL_CLASS } from './ScreenShell';

/**
 * Max-width reading column for long-form AI content (natal, horoscope).
 * Horizontal padding matches ScreenShell / AIR rollout.
 */
export const READING_PAGE_CLASS = 'mx-auto w-full max-w-reading-wide px-4 sm:px-5';

/** Inner padding for glass sections; prefer `READING_GLASS_SECTION_CLASS` for full panel. */
export const READING_SECTION_PAD = 'px-5 py-5 sm:px-6 sm:py-6';

/** Single import for `lumia-glass` forecast/natal panels. */
export const READING_GLASS_SECTION_CLASS = AIR_GLASS_PANEL_CLASS;

interface ReadingLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const ReadingLayout = memo<ReadingLayoutProps>(({ children, className = '' }) => (
  <div className={`${READING_PAGE_CLASS} ${className}`.trim()}>{children}</div>
));

ReadingLayout.displayName = 'ReadingLayout';
