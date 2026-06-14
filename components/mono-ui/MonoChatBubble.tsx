import React from 'react';
import { cn } from '../../lib/cn';

type MonoChatBubbleProps = {
  children: React.ReactNode;
  role: 'user' | 'assistant';
  className?: string;
};

export function MonoChatBubble({ children, role, className }: MonoChatBubbleProps) {
  return (
    <div
      className={cn(
        'max-w-[85%] rounded-[20px] px-4 py-3 text-[15px] leading-relaxed',
        role === 'user'
          ? 'ml-auto bg-mono-plate text-mono-ink'
          : 'mr-auto bg-mono-black text-white',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MonoQuickReplies({
  options,
  onSelect,
}: {
  options: string[];
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          className="rounded-mono-pill border border-mono-line bg-white px-4 py-2 text-[13px] font-semibold text-mono-ink active:scale-[0.98]"
        >
          {option}
        </button>
      ))}
    </div>
  );
}
