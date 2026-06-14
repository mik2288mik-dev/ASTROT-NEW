import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '../../lib/cn';

type MonoButtonVariant = 'primary' | 'ghost' | 'accent' | 'outline';

type MonoButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: MonoButtonVariant;
  fullWidth?: boolean;
};

const variantClass: Record<MonoButtonVariant, string> = {
  primary: 'bg-mono-black text-white hover:bg-mono-ink',
  ghost: 'bg-mono-plate text-mono-ink hover:bg-mono-line/40',
  accent: 'bg-mono-accent text-white hover:opacity-90',
  outline: 'border border-mono-line bg-white text-mono-ink hover:bg-mono-plate',
};

export function MonoButton({
  children,
  className,
  variant = 'primary',
  fullWidth,
  disabled,
  ...props
}: MonoButtonProps) {
  const reduce = useReducedMotion();
  const button = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex min-h-[48px] items-center justify-center rounded-mono-pill px-5 text-[15px] font-semibold transition-opacity disabled:opacity-45',
        variantClass[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );

  if (reduce || disabled) {
    return button;
  }

  return (
    <motion.span
      className={cn('inline-flex', fullWidth && 'w-full')}
      whileTap={{ scale: 0.96 }}
      whileHover={{ scale: 1.015 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
    >
      {button}
    </motion.span>
  );
}
