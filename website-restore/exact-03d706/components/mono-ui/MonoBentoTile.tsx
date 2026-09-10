import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/cn';
import { MonoTag } from './MonoTag';

type MonoBentoTileProps = {
  title: string;
  detail?: React.ReactNode;
  tag?: string;
  illustration?: React.ReactNode;
  variant?: 'black' | 'gray' | 'white';
  footer?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  delay?: number;
};

const bgClass = {
  black: 'bg-mono-black text-white',
  gray: 'bg-mono-plate text-mono-ink',
  white: 'bg-mono-white border border-mono-line text-mono-ink',
};

export function MonoBentoTile({
  title,
  detail,
  tag,
  illustration,
  variant = 'gray',
  footer,
  onClick,
  className,
  delay = 0,
}: MonoBentoTileProps) {
  const Comp = onClick ? motion.button : motion.div;

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        'relative flex min-h-[148px] flex-col overflow-hidden rounded-mono-card p-[18px] text-left',
        bgClass[variant],
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {illustration ? (
        <div className="pointer-events-none absolute bottom-2 right-2 opacity-90" aria-hidden="true">
          {illustration}
        </div>
      ) : null}
      <div className="relative z-10 flex flex-1 flex-col">
        {tag ? <MonoTag dark={variant === 'black'} className="mb-2 w-fit">{tag}</MonoTag> : null}
        <h3 className="pr-16 text-[22px] font-bold leading-[1.05] tracking-[-0.02em]">{title}</h3>
        {detail ? (
          <div className={cn('mt-2 flex-1 text-[14px] font-medium leading-snug', variant === 'black' ? 'text-white/75' : 'text-mono-muted')}>
            {detail}
          </div>
        ) : null}
        {footer ? <div className="relative z-10 mt-auto pt-3">{footer}</div> : null}
      </div>
    </Comp>
  );
}
