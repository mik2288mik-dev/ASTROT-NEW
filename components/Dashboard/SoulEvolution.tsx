import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { UserProfile, UserEvolution } from '../../types';
import { getText } from '../../constants';

interface SoulEvolutionProps {
  evolution: UserEvolution;
  language: 'ru' | 'en';
}

export const SoulEvolution = memo<SoulEvolutionProps>(({ evolution, language }) => {
  return (
    <div className="bg-astro-card p-5 rounded-xl border border-astro-border space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-[10px] uppercase tracking-widest text-astro-text font-bold">
          {getText(language, 'dashboard.evolution')}
        </h3>
        <span className="text-astro-highlight text-xs font-serif">
          {evolution.title} • Lvl {evolution.level}
        </span>
      </div>
      
      {/* Bars */}
      <div>
        <div className="flex justify-between text-[9px] text-astro-subtext mb-1 uppercase tracking-wider">
          <span>{getText(language, 'dashboard.stats_intuition')}</span>
          <span>{evolution.stats.intuition}%</span>
        </div>
        <div className="h-1.5 bg-astro-bg rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${evolution.stats.intuition}%` }}
            className="h-full bg-purple-400/70 rounded-full"
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-[9px] text-astro-subtext mb-1 uppercase tracking-wider">
          <span>{getText(language, 'dashboard.stats_confidence')}</span>
          <span>{evolution.stats.confidence}%</span>
        </div>
        <div className="h-1.5 bg-astro-bg rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }} 
            animate={{ width: `${evolution.stats.confidence}%` }}
            className="h-full bg-yellow-400/70 rounded-full"
          />
        </div>
      </div>
    </div>
  );
});

SoulEvolution.displayName = 'SoulEvolution';
