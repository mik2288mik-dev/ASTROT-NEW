import React, { memo } from 'react';

/**
 * Max-width reading column for long-form AI content (natal, horoscope).
 * Mirrors common editorial / wellness-app patterns: comfortable measure on large screens, full bleed on small.
 */
export const READING_PAGE_CLASS =
  'mx-auto w-full max-w-reading-wide px-4 sm:px-6';

export const READING_SECTION_PAD = 'p-4 sm:p-5 md:p-6';

interface ReadingLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export const ReadingLayout = memo<ReadingLayoutProps>(({ children, className = '' }) => (
  <div className={`${READING_PAGE_CLASS} ${className}`.trim()}>{children}</div>
));

ReadingLayout.displayName = 'ReadingLayout';
