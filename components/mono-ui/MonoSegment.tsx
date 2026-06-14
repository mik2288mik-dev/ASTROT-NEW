import React from 'react';
import { cn } from '../../lib/cn';

type MonoSegmentProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
};

export function MonoSegment<T extends string>({ value, onChange, options, className }: MonoSegmentProps<T>) {
  return (
    <div className={cn('grid rounded-mono-card bg-mono-plate p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-[14px] px-3 py-3 text-[13px] font-semibold transition-colors',
              active ? 'bg-mono-white text-mono-ink shadow-sm' : 'text-mono-muted',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
