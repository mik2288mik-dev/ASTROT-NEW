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
 * Google Studio lumia 2.0 top row: brand + gear + lock (no avatar on hub).
 */
export const LumiaStudioHeader: React.FC<LumiaStudioHeaderProps> = ({
  subtitle,
  isPremium,
  onOpenSettings,
  onPremiumClick,
}) => (
  <header className="flex justify-between items-center mb-10">
    <div>
      <h1 className="serif text-4xl font-medium tracking-tight text-text-main">LUMIA</h1>
      <p className="text-text-muted text-xs tracking-wide opacity-60">{subtitle}</p>
    </div>

    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Settings"
        className="p-2 rounded-full transition-all bg-white border border-black/5 text-text-muted hover:text-text-main hover:border-black/10"
      >
        <Settings className="w-5 h-5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={onPremiumClick}
        aria-label={isPremium ? 'Premium' : 'Premium'}
        className={cn(
          'p-2 rounded-full transition-all',
          isPremium ? 'bg-accent-gold text-white' : 'bg-white border border-black/5 text-text-muted'
        )}
      >
        {isPremium ? <Star className="w-5 h-5 fill-current" strokeWidth={1.75} /> : <Lock className="w-5 h-5" strokeWidth={1.75} />}
      </button>
    </div>
  </header>
);
