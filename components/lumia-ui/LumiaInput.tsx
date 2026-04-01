import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export const LumiaInput = ({
  label,
  icon: Icon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: LucideIcon }) => (
  <div className={cn('space-y-1 w-full', className)}>
    <label className="text-[10px] uppercase tracking-[0.15em] font-bold text-text-muted/60 ml-1">
      {label}
    </label>
    <div className="relative">
      {Icon && <Icon className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted/40" />}
      <input
        className={cn(
          'w-full bg-transparent border-b border-black/5 py-3 focus:outline-none focus:border-accent-gold/30 transition-all text-sm text-text-main placeholder:text-text-muted/30',
          Icon && 'pl-7'
        )}
        {...props}
      />
    </div>
  </div>
);
