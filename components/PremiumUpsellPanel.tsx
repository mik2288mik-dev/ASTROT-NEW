import React from 'react';
import { Lock } from 'lucide-react';
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
        'relative overflow-hidden rounded-[28px] bg-accent-gold text-center shadow-[0_16px_48px_-28px_rgba(0,0,0,0.25)] ring-1 ring-black/10',
        compact ? 'px-4 py-5 sm:px-5 sm:py-5' : 'px-5 py-6 sm:px-6 sm:py-7',
        className
      )}
    >
      {!compact && (
        <Lock
          className="pointer-events-none absolute right-4 top-4 h-6 w-6 text-white/35 sm:right-5 sm:top-5 sm:h-7 sm:w-7"
          strokeWidth={1.5}
          aria-hidden
        />
      )}
      {title ? (
        <h3
          className={cn(
            'font-serif font-medium text-white',
            compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
          )}
        >
          {title}
        </h3>
      ) : null}
      <div
        className={cn(
          'font-sans text-sm leading-relaxed text-white/95',
          title ? 'mt-3' : ''
        )}
      >
        {children}
      </div>
      {footerNote ? (
        <p className="mt-3 text-xs leading-relaxed text-white/75">{footerNote}</p>
      ) : null}
      <button
        type="button"
        onClick={onCta}
        className={cn(
          'mt-5 w-full rounded-full bg-white px-5 py-3.5 text-sm font-bold text-text-main shadow-sm transition-transform hover:scale-[1.01] active:scale-[0.99]',
          compact && 'mt-4 py-3'
        )}
      >
        {ctaLabel}
      </button>
    </div>
  );
};
