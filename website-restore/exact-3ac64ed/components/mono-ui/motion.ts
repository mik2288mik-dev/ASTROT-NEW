import type { Transition, Variants } from 'framer-motion';

/** Shared easing — soft editorial snap (Mono Friend). */
export const MONO_EASE = [0.22, 1, 0.36, 1] as const;

export const monoTransition = (duration = 0.32, delay = 0): Transition => ({
  duration,
  delay,
  ease: MONO_EASE,
});

export const monoFadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: monoTransition(0.34) },
};

export const monoFadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: monoTransition(0.28) },
};

export const monoScaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: monoTransition(0.3) },
};

export const monoSlideUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: monoTransition(0.38) },
};

export const monoStaggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

export const monoStaggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: monoTransition(0.3) },
};

/** Tap / hover micro-interactions for buttons and cards. */
export const monoPress = {
  whileTap: { scale: 0.97 },
  whileHover: { scale: 1.01 },
  transition: { type: 'spring' as const, stiffness: 420, damping: 28 },
};

export const monoPressSoft = {
  whileTap: { scale: 0.985 },
  transition: { duration: 0.14 },
};
