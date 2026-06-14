import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../../lib/cn';
import type { DailyMetricKey } from '../../../lib/localDailyMetrics';

type LzMetricTileProps = {
  label: string;
  value: number;
  variant?: 'black' | 'white';
  onClick?: () => void;
  delay?: number;
};

export function LzMetricTile({ label, value, variant = 'white', onClick, delay = 0 }: LzMetricTileProps) {
  const Comp = onClick ? motion.button : motion.div;
  const dark = variant === 'black';

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        'flex min-h-[118px] flex-col rounded-mono-card p-4 text-left',
        dark ? 'bg-mono-black text-white' : 'border border-mono-line bg-mono-white text-mono-ink',
        onClick && 'cursor-pointer',
      )}
    >
      <span className={cn('text-[13px] font-semibold', dark ? 'text-white/70' : 'text-mono-muted')}>{label}</span>
      <span className="mt-1 text-[32px] font-bold leading-none tracking-[-0.03em]">{value}%</span>
      <div className={cn('mt-auto h-1.5 w-full overflow-hidden rounded-full', dark ? 'bg-white/20' : 'bg-mono-plate')}>
        <div
          className={cn('h-full rounded-full transition-all', dark ? 'bg-white' : 'bg-mono-black')}
          style={{ width: `${value}%` }}
        />
      </div>
    </Comp>
  );
}

type LzMetricsBentoProps = {
  metrics: Record<DailyMetricKey, number>;
  labels: Record<DailyMetricKey, string>;
  footnote: string;
  onMetricClick?: () => void;
};

export function LzMetricsBento({ metrics, labels, footnote, onMetricClick }: LzMetricsBentoProps) {
  const order: DailyMetricKey[] = ['mood', 'energy', 'communication', 'focus'];
  const variants: Array<'black' | 'white'> = ['white', 'black', 'white', 'black'];

  return (
    <section className="mt-6">
      <div className="grid grid-cols-2 gap-3">
        {order.map((key, index) => (
          <LzMetricTile
            key={key}
            label={labels[key]}
            value={metrics[key]}
            variant={variants[index]}
            onClick={onMetricClick}
            delay={index * 0.05}
          />
        ))}
      </div>
      <p className="mt-3 text-[13px] font-medium leading-snug text-mono-muted">{footnote}</p>
    </section>
  );
}
