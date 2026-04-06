import React from 'react';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/cn';

interface LumiaStudioHeaderProps {
  onOpenSettings: () => void;
  /** Localized e.g. getText(lang, 'nav.settings') */
  settingsAriaLabel: string;
  className?: string;
}

export const LumiaStudioHeader: React.FC<LumiaStudioHeaderProps> = ({
  onOpenSettings,
  settingsAriaLabel,
  className,
}) => {
  const settingsButtonClass =
    'z-10 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-white/94 text-text-main ring-1 ring-black/[0.08] shadow-[0_6px_18px_rgba(0,0,0,0.05)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/18';

  return (
    <header className={cn('mb-6', className)}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div aria-hidden className="h-11" />
        <div className="min-w-0 text-center">
          <h1 className="truncate font-outfit text-[30px] font-semibold leading-none tracking-[0.14em] text-text-main min-[400px]:text-[34px]">
            LUMIA
          </h1>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={settingsAriaLabel}
          className={cn(settingsButtonClass, 'justify-self-end')}
        >
          <Settings className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </header>
  );
};
