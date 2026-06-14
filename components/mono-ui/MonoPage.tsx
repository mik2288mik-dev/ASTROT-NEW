import React from 'react';
import { cn } from '../../lib/cn';

type MonoPageProps = {
  children: React.ReactNode;
  className?: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  withTabClearance?: boolean;
};

export function MonoPage({ children, className, scrollRef, withTabClearance = true }: MonoPageProps) {
  return (
    <div
      ref={scrollRef}
      className={cn(
        'mono-page h-full overflow-y-auto font-lumiaHome text-mono-ink',
        withTabClearance && 'pb-[var(--lumia-bottom-tab-clearance)]',
        className,
      )}
      style={{
        paddingTop:
          'calc(max(env(safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px), 50px) + 4px)',
      }}
    >
      {children}
    </div>
  );
}
