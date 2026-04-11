import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
  const shouldReduceMotion = useReducedMotion();
  const settingsButtonClass =
    'z-10 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-white text-text-main ring-1 ring-black/[0.08] shadow-[0_4px_14px_rgba(0,0,0,0.035)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/18';

  const brandAnimate = shouldReduceMotion
    ? undefined
    : {
        opacity: [1, 0.94, 1],
        y: [0, -1.5, 0],
        scale: [1, 1.008, 1],
      };

  const brandTransition = shouldReduceMotion
    ? undefined
    : {
        duration: 4.6,
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
        repeat: Infinity,
        repeatDelay: 72,
        delay: 18,
      };

  return (
    <header className={cn('mb-5', className)}>
      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-start gap-2">
        <div aria-hidden className="h-11 w-11" />
        <div className="min-w-0 text-center">
          <motion.div animate={brandAnimate} transition={brandTransition} className="inline-flex flex-col items-center">
            <p className="mb-0 font-serif text-[2.9rem] font-semibold leading-none tracking-[-0.065em] text-[#1f1f1f]">
              LUMIA
            </p>
            <p className="mb-0 mt-2 text-[9px] uppercase tracking-[0.32em] text-[#8a857d]">Твой путь к себе</p>
          </motion.div>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={settingsAriaLabel}
          className={cn(settingsButtonClass, 'justify-self-end')}
        >
          <Settings className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </header>
  );
};
