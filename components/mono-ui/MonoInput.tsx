import React from 'react';
import { cn } from '../../lib/cn';

type MonoInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export function MonoInput({ label, className, id, ...props }: MonoInputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-mono-muted">
          {label}
        </span>
      ) : null}
      <input
        id={inputId}
        className={cn(
          'w-full rounded-mono-card border border-mono-line bg-mono-white px-4 py-3.5 text-[15px] text-mono-ink placeholder:text-mono-muted/60 focus:border-mono-ink focus:outline-none',
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function MonoSelect({
  label,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.06em] text-mono-muted">
          {label}
        </span>
      ) : null}
      <select
        className={cn(
          'w-full rounded-mono-card border border-mono-line bg-mono-white px-4 py-3.5 text-[15px] text-mono-ink focus:border-mono-ink focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
