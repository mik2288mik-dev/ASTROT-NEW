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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        'lz-metric-tile flex min-h-[132px] flex-col p-[18px] text-left',
        dark ? 'lz-metric-tile-dark' : 'lz-metric-tile-light',
        onClick && 'cursor-pointer',
      )}
    >
      <span className={cn('text-[11px] font-bold uppercase tracking-[0.12em]', dark ? 'text-white/65' : 'text-mono-muted')}>
        {label}
      </span>
      <span className="mt-2 text-[36px] font-bold leading-none tracking-[-0.04em]">{value}%</span>
      <div className={cn('mt-auto h-[6px] w-full overflow-hidden rounded-full', dark ? 'bg-white/18' : 'bg-mono-plate')}>
        <motion.div
          className={cn('h-full rounded-full', dark ? 'bg-white' : 'bg-mono-black')}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, delay: delay + 0.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </Comp>
  );
}

type LzMetricsBentoProps = {
  metrics: Record<DailyMetricKey, number>;
  labels: Record<DailyMetricKey, string>;
  footnote: string;
  sectionLabel?: string;
  onMetricClick?: () => void;
};

export function LzMetricsBento({ metrics, labels, footnote, sectionLabel = 'Today', onMetricClick }: LzMetricsBentoProps) {
  const order: DailyMetricKey[] = ['mood', 'energy', 'communication', 'focus'];
  const variants: Array<'black' | 'white'> = ['white', 'black', 'black', 'white'];

  return (
    <section className="mt-7">
      <p className="lz-kicker mb-3">{sectionLabel}</p>
      <div className="grid grid-cols-2 gap-3">
        {order.map((key, index) => (
          <LzMetricTile
            key={key}
            label={labels[key]}
            value={metrics[key]}
            variant={variants[index]}
            onClick={onMetricClick}
            delay={index * 0.06}
          />
        ))}
      </div>
      <p className="lz-footnote mt-4">{footnote}</p>
    </section>
  );
}
