import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/cn';
import {
  monoFadeIn,
  monoFadeUp,
  monoScaleIn,
  monoSlideUp,
  monoStaggerContainer,
  monoStaggerItem,
} from './motion';

type MotionVariant = 'fadeUp' | 'fadeIn' | 'scaleIn' | 'slideUp';

const variantMap = {
  fadeUp: monoFadeUp,
  fadeIn: monoFadeIn,
  scaleIn: monoScaleIn,
  slideUp: monoSlideUp,
};

type MonoFadeInProps = {
  children: React.ReactNode;
  className?: string;
  variant?: MotionVariant;
  delay?: number;
};

export function MonoFadeIn({
  children,
  className,
  variant = 'fadeUp',
  delay = 0,
}: MonoFadeInProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={variantMap[variant]}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

type MonoStaggerProps = {
  children: React.ReactNode;
  className?: string;
};

export function MonoStagger({ children, className }: MonoStaggerProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={monoStaggerContainer}
    >
      {children}
    </motion.div>
  );
}

type MonoStaggerItemProps = {
  children: React.ReactNode;
  className?: string;
};

export function MonoStaggerItem({ children, className }: MonoStaggerItemProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={cn(className)} variants={monoStaggerItem}>
      {children}
    </motion.div>
  );
}

type MonoRevealProps = {
  children: React.ReactNode;
  className?: string;
};

/** Cross-fade + slide — use with `key` + AnimatePresence. */
export function MonoReveal({ children, className }: MonoRevealProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
