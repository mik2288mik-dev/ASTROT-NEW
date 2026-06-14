import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { monoFadeIn } from './motion';

type MonoPageProps = {
  children: React.ReactNode;
  className?: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  withTabClearance?: boolean;
  animate?: boolean;
};

export function MonoPage({
  children,
  className,
  scrollRef,
  withTabClearance = true,
  animate = true,
}: MonoPageProps) {
  const reduce = useReducedMotion();
  const Comp = animate && !reduce ? motion.div : 'div';

  return (
    <Comp
      ref={scrollRef as React.RefObject<HTMLDivElement>}
      {...(animate && !reduce
        ? { initial: 'hidden', animate: 'visible', variants: monoFadeIn }
        : {})}
      className={cn(
        'mono-page h-full overflow-y-auto font-lumiaHome text-mono-ink',
        withTabClearance && 'pb-[var(--lumia-bottom-tab-clearance)]',
        className,
      )}
      style={{
        paddingTop:
          'calc(max(env(safe-area-inset-top, 0px), var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px), 50px) + 4px)',
      }}
    >
      {children}
    </Comp>
  );
}
