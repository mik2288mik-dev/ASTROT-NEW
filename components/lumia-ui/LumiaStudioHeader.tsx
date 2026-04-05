import React from 'react';
import { MoreHorizontal, Settings } from 'lucide-react';
import { cn } from '../../lib/cn';

export type LumiaStudioHeaderVariant =
  | 'cloud-ribbon'
  | 'aero-stack'
  | 'orbit-focus'
  | 'feather-cards'
  | 'pulse-air';

interface LumiaStudioHeaderProps {
  onOpenSettings: () => void;
  /** Localized e.g. getText(lang, 'nav.settings') */
  settingsAriaLabel: string;
  className?: string;
  variant?: LumiaStudioHeaderVariant;
  appChipLabel?: string;
}

export const LumiaStudioHeader: React.FC<LumiaStudioHeaderProps> = ({
  onOpenSettings,
  settingsAriaLabel,
  className,
  variant = 'cloud-ribbon',
  appChipLabel = 'LUMIA',
}) => {
  const isCloud = variant === 'cloud-ribbon';
  const isAero = variant === 'aero-stack';
  const isOrbit = variant === 'orbit-focus';
  const isFeather = variant === 'feather-cards';
  const isPulse = variant === 'pulse-air';

  const settingsButtonBase =
    'z-10 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25';

  if (isAero) {
    return (
      <header className={cn('mb-5', className)}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <h1 className="min-w-0 truncate font-outfit text-[30px] font-semibold leading-none tracking-[0.14em] text-text-main min-[400px]:text-[34px]">
            LUMIA
          </h1>
          <div className="inline-flex items-center gap-1 rounded-full border border-black/[0.07] bg-white/82 p-1 shadow-[0_8px_20px_rgba(0,0,0,0.07)] backdrop-blur-xl">
            <span
              aria-hidden
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.03] text-text-muted"
            >
              <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
            </span>
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={settingsAriaLabel}
              className={cn(settingsButtonBase, 'bg-white text-text-main shadow-sm ring-1 ring-black/[0.08]')}
            >
              <Settings className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            </button>
          </div>
        </div>
      </header>
    );
  }

  if (isOrbit) {
    return (
      <header className={cn('mb-5', className)}>
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_3rem]">
          <span className="pointer-events-none w-11 shrink-0 sm:w-12" aria-hidden />
          <div className="justify-self-center rounded-full border border-black/[0.06] bg-gradient-to-r from-white/90 via-white/78 to-white/90 px-5 py-2 shadow-[0_12px_26px_rgba(0,0,0,0.08)]">
            <h1 className="text-center font-outfit text-[30px] font-semibold leading-none tracking-[0.14em] text-text-main min-[400px]:text-[34px]">
              LUMIA
            </h1>
          </div>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={settingsAriaLabel}
            className={cn(settingsButtonBase, 'justify-self-end border border-black/[0.08] bg-white text-text-main shadow-[0_8px_18px_rgba(0,0,0,0.09)]')}
          >
            <Settings className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          </button>
        </div>
      </header>
    );
  }

  if (isFeather) {
    return (
      <header className={cn('mb-5', className)}>
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_3rem]">
          <span className="pointer-events-none w-11 shrink-0 sm:w-12" aria-hidden />
          <h1 className="text-center font-outfit text-[30px] font-semibold leading-none tracking-[0.14em] text-text-main min-[400px]:text-[34px]">
            LUMIA
          </h1>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={settingsAriaLabel}
            className={cn(settingsButtonBase, 'justify-self-end border border-black/[0.07] bg-white/88 text-text-main shadow-[0_6px_16px_rgba(0,0,0,0.06)]')}
          >
            <Settings className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </button>
        </div>
      </header>
    );
  }

  return (
    <header className={cn('mb-5', className)}>
      <div
        className={cn(
          'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 rounded-full px-1.5 py-1.5 backdrop-blur-xl',
          isCloud &&
            'border border-black/[0.06] bg-white/74 shadow-[0_10px_24px_rgba(0,0,0,0.06)]',
          isPulse &&
            'lumia-pulse-enter border border-black/[0.09] bg-gradient-to-r from-white/92 via-white/78 to-white/90 shadow-[0_12px_26px_rgba(0,0,0,0.09)]'
        )}
      >
        <span className="inline-flex min-h-[32px] items-center rounded-full border border-black/[0.06] bg-white/92 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">
          {appChipLabel}
        </span>
        <h1 className="min-w-0 truncate text-center font-outfit text-[30px] font-semibold leading-none tracking-[0.14em] text-text-main min-[400px]:text-[34px]">
          LUMIA
        </h1>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={settingsAriaLabel}
          className={cn(
            settingsButtonBase,
            'justify-self-end bg-white text-text-main ring-1 ring-black/[0.09] shadow-sm',
            isPulse && 'shadow-[0_8px_18px_rgba(0,0,0,0.1)]'
          )}
        >
          <Settings className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </header>
  );
};

