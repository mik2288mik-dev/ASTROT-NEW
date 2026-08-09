import React from 'react';
import { cn } from '../../lib/cn';

type MonoInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function MonoInput({ label, className, id, ...props }: MonoInputProps) {
  const generatedId = React.useId();
  const inputId = id || `mono-input-${generatedId.replace(/:/g, '')}`;
  return (
    <div className="block">
      {label ? (
        <label htmlFor={inputId} className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-mono-muted">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cn(
          'w-full rounded-mono-card border border-mono-line bg-mono-white px-4 py-3.5 text-[16px] text-mono-ink placeholder:text-mono-muted/60 focus:border-mono-ink focus:outline-none sm:text-[15px]',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function MonoSelect({
  label,
  className,
  id,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const generatedId = React.useId();
  const selectId = id || `mono-select-${generatedId.replace(/:/g, '')}`;
  return (
    <div className="block">
      {label ? (
        <label htmlFor={selectId} className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-mono-muted">
          {label}
        </label>
      ) : null}
      <select
        id={selectId}
        className={cn(
          'w-full rounded-mono-card border border-mono-line bg-mono-white px-4 py-3.5 text-[16px] text-mono-ink focus:border-mono-ink focus:outline-none sm:text-[15px]',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
