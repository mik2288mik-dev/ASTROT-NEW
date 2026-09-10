import React from 'react';
import { cn } from '../../lib/cn';

type MonoCardVariant = 'white' | 'gray' | 'black' | 'outline';

type MonoCardProps = {
  children: React.ReactNode;
  className?: string;
  variant?: MonoCardVariant;
  onClick?: () => void;
  as?: 'div' | 'button';
};

const variantClass: Record<MonoCardVariant, string> = {
  white: 'bg-mono-white border border-mono-line',
  gray: 'bg-mono-plate border border-transparent',
  black: 'bg-mono-black text-white border border-transparent',
  outline: 'bg-transparent border border-mono-line',
};

export function MonoCard({
  children,
  className,
  variant = 'white',
  onClick,
  as = onClick ? 'button' : 'div',
}: MonoCardProps) {
  const Comp = as;
  return (
    <Comp
      type={as === 'button' ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-mono-card text-left transition-transform active:scale-[0.98]',
        variantClass[variant],
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </Comp>
  );
}
