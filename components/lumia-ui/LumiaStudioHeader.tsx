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
  const brandLetters = ['L', 'U', 'M', 'I', 'A'];
  const settingsButtonClass =
    'z-10 mt-2 inline-flex h-10 w-10 min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-full bg-white/94 text-text-main ring-1 ring-black/[0.06] shadow-[0_4px_12px_rgba(0,0,0,0.03)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/16';

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
      <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-start gap-2">
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
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label={settingsAriaLabel}
          className={cn(settingsButtonClass, 'justify-self-end self-start')}
        >
          <Settings className="h-[15px] w-[15px]" strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </header>
  );
};
