import React from 'react';
import { cn } from '../lib/cn';

export interface PremiumUpsellPanelProps {
  title?: string;
  children: React.ReactNode;
  footerNote?: string;
  ctaLabel: string;
  onCta: () => void;
  className?: string;
  /** Smaller padding / no lock — for secondary hints (weekly/monthly). */
  compact?: boolean;
}

export const PremiumUpsellPanel = ({
  title,
  children,
  footerNote,
  ctaLabel,
  onCta,
  className,
  compact = false,
}: PremiumUpsellPanelProps) => {
  return (
    <div
      className={cn(
        'text-left',
        compact ? 'py-1' : 'py-2',
        className
      )}
    >
      {title ? (
        <h3
          className={cn(
            'font-serif font-medium text-text-main',
            compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
          )}
        >
          {title}
        </h3>
      ) : null}
      <div
        className={cn(
          'font-sans text-sm leading-relaxed text-text-main/80',
          title ? 'mt-3' : ''
        )}
      >
        {children}
      </div>
      {footerNote ? (
        <p className="mt-2 text-xs leading-relaxed text-text-muted">{footerNote}</p>
      ) : null}
      <button
        type="button"
        onClick={onCta}
        className={cn(
          'mt-4 inline-flex min-h-[42px] items-center justify-center rounded-full border border-black/8 bg-white/72 px-4 py-2.5 text-sm font-medium text-text-main transition-[box-shadow] hover:ring-1 hover:ring-black/10',
          compact && 'mt-3'
        )}
      >
        {ctaLabel}
      </button>
    </div>
  );
};
