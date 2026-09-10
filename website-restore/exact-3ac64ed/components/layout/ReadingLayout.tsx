import React, { memo } from 'react';

/**
 * Max-width reading column for long-form AI content (natal, horoscope).
 * Horizontal padding matches ScreenShell / AIR rollout.
 */
export const READING_PAGE_CLASS = 'mx-auto w-full max-w-reading-wide px-4 sm:px-5';

/** Reading sections in AIR mode: spacing only, no panel chrome. */
export const READING_SECTION_PAD = 'px-0 py-0';

/** Natal / horoscope surfaces: no frames, only vertical rhythm. */
export const READING_GLASS_SECTION_CLASS = 'border-t border-astro-border/10 px-0 pt-5 sm:pt-6';

interface ReadingLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const ReadingLayout = memo<ReadingLayoutProps>(({ children, className = '' }) => (
  <div className={`${READING_PAGE_CLASS} ${className}`.trim()}>{children}</div>
));

ReadingLayout.displayName = 'ReadingLayout';
