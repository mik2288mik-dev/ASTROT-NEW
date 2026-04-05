import React from 'react';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/cn';

interface LumiaStudioHeaderProps {
  onOpenSettings: () => void;
  /** Localized e.g. getText(lang, 'nav.settings') */
  settingsAriaLabel: string;
  className?: string;
  appChipLabel?: string;
}

export const LumiaStudioHeader: React.FC<LumiaStudioHeaderProps> = ({
  onOpenSettings,
  settingsAriaLabel,
  className,
  appChipLabel = 'LUMIA',
}) => {
  const settingsButtonClass =
    'z-10 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-white text-text-main ring-1 ring-black/[0.09] shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/25';

  return (
    <header className={cn('mb-5', className)}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 rounded-full border border-black/[0.06] bg-white/74 px-1.5 py-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl">
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
          className={cn(settingsButtonClass, 'justify-self-end')}
        >
          <Settings className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </header>
  );
};
