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
 * AIR hub: centered raster wordmark + settings below (Telegram-safe; no premium chip).
 */
export const LumiaStudioHeader: React.FC<LumiaStudioHeaderProps> = ({ onOpenSettings, settingsAriaLabel }) => (
  <header className="mb-6 flex flex-col items-center">
    <div className="relative mx-auto h-[52px] w-[min(100%,240px)] min-[400px]:h-[60px] min-[400px]:w-[min(100%,280px)]">
      <Image
        src="/brand/lumia-wordmark-air.png"
        alt="Lumia"
        fill
        className="object-contain object-center"
        sizes="280px"
        priority
      />
    </div>

    <button
      type="button"
      onClick={onOpenSettings}
      aria-label={settingsAriaLabel}
      className={cn(
        'mt-4 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-all',
        'bg-white/80 text-text-muted shadow-sm ring-1 ring-black/[0.06] hover:text-text-main'
      )}
    >
      <Settings className="h-5 w-5" strokeWidth={1.75} aria-hidden />
    </button>
  </header>
);
