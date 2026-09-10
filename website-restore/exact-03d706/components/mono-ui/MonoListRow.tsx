import React from 'react';
import { cn } from '../../lib/cn';

type MonoListRowProps = {
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
};

export function MonoListRow({ title, subtitle, trailing, onClick, className }: MonoListRowProps) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-mono-card bg-mono-black px-4 py-4 text-left text-white transition-transform active:scale-[0.99]',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{title}</div>
        {subtitle ? <div className="mt-0.5 truncate text-[13px] text-white/65">{subtitle}</div> : null}
      </div>
      {trailing ?? (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="flex-shrink-0 opacity-70">
          <path d="M7 4.5 11.5 9 7 13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </Comp>
  );
}
