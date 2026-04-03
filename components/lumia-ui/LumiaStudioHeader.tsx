import React from 'react';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/cn';

interface LumiaStudioHeaderProps {
  onOpenSettings: () => void;
  /** Localized e.g. getText(lang, 'nav.settings') */
  settingsAriaLabel: string;
  className?: string;
}

/**
 * AIR hub: текст LUMIA по центру; шестерёнка справа сверху.
 */
export const LumiaStudioHeader: React.FC<LumiaStudioHeaderProps> = ({
  onOpenSettings,
  settingsAriaLabel,
  className,
}) => (
  <header
    className={cn(
      'mb-4 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-1 sm:grid-cols-[3rem_minmax(0,1fr)_3rem]',
      className
    )}
  >
    <span className="pointer-events-none w-11 shrink-0 sm:w-12" aria-hidden />
    <h1 className="text-center font-outfit text-3xl font-semibold leading-none tracking-[0.14em] text-text-main min-[400px]:text-4xl">
      LUMIA
    </h1>
    <button
      type="button"
      onClick={onOpenSettings}
      aria-label={settingsAriaLabel}
      className={cn(
        'z-10 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center justify-self-end rounded-full transition-all',
        'bg-white/90 text-text-muted shadow-sm ring-1 ring-black/[0.08] hover:text-text-main'
      )}
    >
      <Settings className="h-5 w-5" strokeWidth={1.75} aria-hidden />
    </button>
  </header>
);
