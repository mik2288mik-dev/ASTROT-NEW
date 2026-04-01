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
  <header className="flex justify-between items-start gap-3 mb-8">
    <div className="min-w-0 max-w-[58%] pr-2">
      <h1 className="serif text-4xl max-[380px]:text-3xl font-medium tracking-tight text-text-main leading-tight">
        LUMIA
      </h1>
      <p className="text-text-muted text-xs tracking-wide opacity-60 mt-1">{subtitle}</p>
    </div>

    <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
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
