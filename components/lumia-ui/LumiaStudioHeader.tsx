import React from 'react';
import Image from 'next/image';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/cn';

interface LumiaStudioHeaderProps {
  onOpenSettings: () => void;
  /** Localized e.g. getText(lang, 'nav.settings') */
  settingsAriaLabel: string;
}

/**
 * AIR hub: лого по центру; шестерёнка справа сверху — в зоне под системным меню Telegram (⋯).
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

    {/* pr-* оставляет место под кнопку настроек справа */}
    <div className="flex justify-center px-2 pr-[3.25rem] min-[400px]:pr-14">
      <div className="relative h-[56px] w-full max-w-[min(100%,268px)] min-[400px]:h-[64px] min-[400px]:max-w-[min(100%,300px)]">
        <Image
          src="/brand/lumia-logo-light.png"
          alt="Lumia"
          fill
          className="object-contain object-center"
          sizes="300px"
          priority
        />
      </div>
    </div>
  </header>
);
