import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Settings } from 'lucide-react';
import { cn } from '../../lib/cn';

interface LumiaStudioHeaderProps {
  onOpenSettings: () => void;
  onOpenStore: () => void;
  /** Localized e.g. getText(lang, 'nav.settings') */
  settingsAriaLabel: string;
  storeLabel: string;
  storeBalance?: number;
  className?: string;
}

export const LumiaStudioHeader: React.FC<LumiaStudioHeaderProps> = ({
  onOpenSettings,
  onOpenStore,
  settingsAriaLabel,
  storeLabel,
  storeBalance = 0,
  className,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const brandLetters = ['L', 'U', 'M', 'I', 'A'];
  const settingsButtonClass =
    'z-10 mt-[2.35rem] inline-flex h-8 w-8 min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-full bg-white/86 text-text-main ring-1 ring-black/[0.045] shadow-[0_3px_10px_rgba(0,0,0,0.02)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/14';

  const taglineAnimate = shouldReduceMotion
    ? undefined
    : {
        opacity: [1, 0.94, 1, 0.97, 1],
        x: [0, 0.35, -0.2, 0.18, 0],
        y: [0, -0.7, 0.3, -0.45, 0],
      };

  const taglineTransition = shouldReduceMotion
    ? undefined
    : {
        duration: 9.6,
        ease: 'easeInOut' as const,
        repeat: Infinity,
        repeatType: 'mirror' as const,
        delay: 0.8,
      };

  return (
    <header className={cn('mb-5', className)}>
      <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-2">
        <div aria-hidden className="h-11 w-11" />
        <div className="min-w-0 text-center">
          <div className="inline-flex flex-col items-center">
            <p className="mb-0 font-serif text-[2.9rem] font-semibold leading-none tracking-[-0.065em] text-[#1f1f1f]">
              {brandLetters.map((letter, index) => (
                <motion.span
                  key={`${letter}-${index}`}
                  className="inline-block"
                  animate={
                    shouldReduceMotion
                      ? undefined
                      : {
                          x: [0, 0.5, -0.32, 0.22, 0],
                          y: [0, -1.05, 0.4, -0.72, 0],
                          rotate: [0, -0.35, 0.22, -0.15, 0],
                          opacity: [1, 0.96, 1, 0.98, 1],
                        }
                  }
                  transition={
                    shouldReduceMotion
                      ? undefined
                      : {
                          duration: 10.5 + index * 0.55,
                          ease: 'easeInOut' as const,
                          repeat: Infinity,
                          repeatType: 'mirror' as const,
                          delay: index * 0.55,
                        }
                  }
                >
                  {letter}
                </motion.span>
              ))}
            </p>
            <motion.p
              animate={taglineAnimate}
              transition={taglineTransition}
              className="mb-0 mt-2 text-[9px] uppercase tracking-[0.32em] text-[#8a857d]"
            >
              Твой путь к себе
            </motion.p>
          </div>
        </div>
        <div className="flex min-w-0 items-start justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onOpenStore}
            aria-label={storeLabel}
            className="relative inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-2 rounded-full border border-black/[0.08] bg-[#f7f3ea] px-3.5 py-2 text-text-main shadow-[0_4px_10px_rgba(0,0,0,0.03)] transition-colors hover:text-astro-text"
          >
            <span className="text-[12px] font-medium leading-none">{storeLabel}</span>
            <span className="rounded-full border border-black/[0.06] bg-white px-2 py-[3px] text-[10px] font-semibold leading-none text-text-main">
              {Math.max(0, storeBalance)}
            </span>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={settingsAriaLabel}
            className={cn(settingsButtonClass, 'justify-self-end self-start')}
          >
            <Settings className="h-[12px] w-[12px]" strokeWidth={1.7} aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
};
