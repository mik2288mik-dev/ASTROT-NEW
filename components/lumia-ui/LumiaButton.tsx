import React from 'react';
import { cn } from '../../lib/cn';

export type LumiaButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

export const LumiaButton = ({
  children,
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: LumiaButtonVariant }) => {
  const variants: Record<LumiaButtonVariant, string> = {
    primary: 'bg-text-main text-white hover:bg-opacity-90',
    secondary: 'bg-accent-gold text-white hover:bg-opacity-90',
    outline: 'border border-text-main text-text-main hover:bg-text-main hover:text-white',
    ghost: 'text-text-muted hover:text-text-main hover:bg-black/5',
  };

  return (
    <button
      type="button"
      className={cn(
        'px-6 py-3 rounded-full font-medium transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
