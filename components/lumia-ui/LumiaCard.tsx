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
          'rounded-[28px] px-5 py-5 backdrop-blur-2xl bg-white/85 ring-1 ring-black/[0.06] shadow-[0_20px_60px_-24px_rgba(0,0,0,0.12)]',
          className
        )}
      >
        {children}
      </div>
    );
  }

  return <div className={cn('glass-card rounded-[32px] p-6 airy-shadow', className)}>{children}</div>;
};
