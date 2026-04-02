import React from 'react';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/cn';

interface LumiaStudioHeaderProps {
  onOpenSettings: () => void;
  /** Localized e.g. getText(lang, 'nav.settings') */
  settingsAriaLabel: string;
}

/**
 * AIR hub: текст LUMIA по центру; шестерёнка справа сверху.
 */
export const LumiaStudioHeader: React.FC<LumiaStudioHeaderProps> = ({ onOpenSettings, settingsAriaLabel }) => (
  <header className="relative mb-6">
    <button
      type="button"
      onClick={onOpenSettings}
      aria-label={settingsAriaLabel}
      className={cn(
        'absolute right-0 top-0 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-all',
        'bg-white/90 text-text-muted shadow-sm ring-1 ring-black/[0.08] hover:text-text-main'
      )}
    >
      <Settings className="h-5 w-5" strokeWidth={1.75} aria-hidden />
    </button>

    <div className="flex justify-center px-2 pr-[3.25rem] min-[400px]:pr-14">
      <h1 className="serif text-3xl font-medium leading-tight tracking-tight text-text-main min-[400px]:text-4xl">
        LUMIA
      </h1>
    </div>
  </header>
);
