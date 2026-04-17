import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Settings, ShoppingBag } from 'lucide-react';
import { cn } from '../../lib/cn';

interface StudioBrandBlockProps {
  onOpenSettings: () => void;
  onOpenStore: () => void;
  settingsAriaLabel: string;
  storeLabel: string;
  tagline: string;
  animated?: boolean;
  className?: string;
}

const brandLetters = ['L', 'U', 'M', 'I', 'A'];

const iconButtonClass =
  'inline-flex h-[28px] w-[28px] min-h-[28px] min-w-[28px] shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-white text-text-main shadow-[0_3px_10px_rgba(0,0,0,0.02)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/14 hover:text-astro-text';

const brandGridClass = 'grid grid-cols-[40px_minmax(0,1fr)_40px] items-start gap-2';

export const StudioBrandBlock: React.FC<StudioBrandBlockProps> = ({
  onOpenSettings,
  onOpenStore,
  settingsAriaLabel,
  storeLabel,
  tagline,
  animated = false,
  className,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const shouldAnimateBrand = animated && !shouldReduceMotion;

  const taglineAnimate = shouldAnimateBrand
    ? {
        opacity: [1, 0.94, 1, 0.97, 1],
        x: [0, 0.35, -0.2, 0.18, 0],
        y: [0, -0.7, 0.3, -0.45, 0],
      }
    : undefined;

  const taglineTransition = shouldAnimateBrand
    ? {
        duration: 9.6,
        ease: 'easeInOut' as const,
        repeat: Infinity,
        repeatType: 'mirror' as const,
        delay: 0.8,
      }
    : undefined;

  return (
    <div className={cn('relative', className)}>
      <div className={brandGridClass}>
        <div aria-hidden className="h-10 w-10" />
        <div className="min-w-0 text-center">
          <div className="inline-flex flex-col items-center">
            <p className="mb-0 font-serif text-[2.72rem] font-semibold leading-none tracking-[-0.065em] text-[#1f1f1f]">
              {brandLetters.map((letter, index) =>
                shouldAnimateBrand ? (
                  <motion.span
                    key={`${letter}-${index}`}
                    className="inline-block"
                    animate={{
                      x: [0, 0.5, -0.32, 0.22, 0],
                      y: [0, -1.05, 0.4, -0.72, 0],
                      rotate: [0, -0.35, 0.22, -0.15, 0],
                      opacity: [1, 0.96, 1, 0.98, 1],
                    }}
                    transition={{
                      duration: 10.5 + index * 0.55,
                      ease: 'easeInOut',
                      repeat: Infinity,
                      repeatType: 'mirror',
                      delay: index * 0.55,
                    }}
                  >
                    {letter}
                  </motion.span>
                ) : (
                  <span key={`${letter}-${index}`} className="inline-block">
                    {letter}
                  </span>
                )
              )}
            </p>
            <motion.p
              animate={taglineAnimate}
              transition={taglineTransition}
              className="mb-0 mt-[6px] text-[8px] uppercase tracking-[0.28em] text-[#8a857d]"
            >
              {tagline}
            </motion.p>
          </div>
        </div>
        <div aria-hidden className="h-10 w-10" />
      </div>

      <div className={cn(brandGridClass, 'relative z-10 -mt-[12px]')}>
        <div className="flex min-w-0 items-start justify-start">
          <button
            type="button"
            onClick={onOpenStore}
            aria-label={storeLabel}
            className={iconButtonClass}
          >
            <ShoppingBag className="h-[10px] w-[10px]" strokeWidth={1.7} aria-hidden />
          </button>
        </div>

        <div />

        <div className="flex min-w-0 items-start justify-end">
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={settingsAriaLabel}
            className={iconButtonClass}
          >
            <Settings className="h-[10px] w-[10px]" strokeWidth={1.7} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
};
