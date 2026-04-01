import React from 'react';
import { cn } from '../../lib/cn';

type LumiaCardVariant = 'panel' | 'float';

export const LumiaCard = ({
  children,
  className,
  variant = 'panel',
}: {
  children: React.ReactNode;
  className?: string;
  variant?: LumiaCardVariant;
}) => {
  if (variant === 'float') {
    return (
      <div
        className={cn(
          'rounded-[28px] px-5 py-5 backdrop-blur-2xl bg-white/30 ring-1 ring-white/70 shadow-none',
          className
        )}
      >
        {children}
      </div>
    );
  }

  return <div className={cn('glass-card rounded-[32px] p-6 airy-shadow', className)}>{children}</div>;
};
