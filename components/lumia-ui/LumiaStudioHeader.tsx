import React from 'react';
import { Lock, Settings, Star } from 'lucide-react';
import { cn } from '../../lib/cn';

interface LumiaStudioHeaderProps {
  subtitle: string;
  isPremium: boolean;
  onOpenSettings: () => void;
  onPremiumClick: () => void;
}

/**
 * AIR hub: brand constrained left; lock/star above, settings gear below (Telegram-safe).
 */
export const LumiaStudioHeader: React.FC<LumiaStudioHeaderProps> = ({
  subtitle,
  isPremium,
  onOpenSettings,
  onPremiumClick,
}) => (
  <header className="mb-6 flex items-center justify-between gap-3">
    <div className="min-w-0 flex-1 pr-2">
      <h1 className="serif text-3xl font-medium leading-[1.05] tracking-tight text-text-main min-[400px]:text-4xl">
        LUMIA
      </h1>
      <p className="mt-1 text-xs tracking-wide text-text-muted opacity-60">{subtitle}</p>
    </div>

    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={onPremiumClick}
        aria-label="Premium"
        className={cn(
          'p-2 rounded-full transition-all',
          isPremium ? 'bg-accent-gold text-white' : 'bg-white/80 border border-black/[0.06] text-text-muted shadow-sm'
        )}
      >
        {isPremium ? <Star className="w-5 h-5 fill-current" strokeWidth={1.75} /> : <Lock className="w-5 h-5" strokeWidth={1.75} />}
      </button>
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Settings"
        className="p-2 rounded-full transition-all bg-white/80 border border-black/[0.06] text-text-muted hover:text-text-main shadow-sm"
      >
        <Settings className="w-5 h-5" strokeWidth={1.75} />
      </button>
    </div>
  </header>
);
