import React from 'react';
import { motion } from 'framer-motion';

/**
 * Shared animated gauge primitives for the home "insight" widgets.
 * Vivid, youthful feel: bold accents, springy mount animation.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

/** Animated radial progress ring. `value` is 0..100. */
export function RadialGauge({
  value,
  size = 96,
  stroke = 10,
  track = '#ECE6F4',
  color = '#7B5CF6',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  track?: string;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - clamped / 100);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/** Animated horizontal meter. `value` is 0..100. */
export function LinearMeter({
  value,
  color = '#7B5CF6',
  track = '#ECE6F4',
  height = 8,
  delay = 0,
}: {
  value: number;
  color?: string;
  track?: string;
  height?: number;
  delay?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ height, background: track }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${clamped}%` }}
        transition={{ duration: 0.9, ease: EASE, delay }}
      />
    </div>
  );
}
