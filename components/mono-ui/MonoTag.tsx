import React from 'react';
import { cn } from '../../lib/cn';

type MonoTagProps = {
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
};

export function MonoTag({ children, className, dark }: MonoTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-mono-pill px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
        dark ? 'bg-white/15 text-white' : 'bg-mono-plate text-mono-muted',
        className,
      )}
    >
      {children}
    </span>
  );
}
