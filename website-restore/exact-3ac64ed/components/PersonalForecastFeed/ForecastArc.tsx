import React from 'react';

type ForecastArcProps = {
  className?: string;
  direction?: 'up' | 'down';
  dot?: 'left' | 'center' | 'right';
  placement?: 'opening' | 'divider' | 'closing';
  variant: 'today' | 'week' | 'month';
};

const THREADS = {
  today: {
    up: {
      paths: ['M-24 54C54 8 130 6 198 28C265 51 326 52 414 4'],
      dots: {
        left: { cx: 62, cy: 22 },
        center: { cx: 195, cy: 27 },
        right: { cx: 330, cy: 39 },
      },
    },
    down: {
      paths: ['M-24 8C88 52 302 52 414 8'],
      dots: {
        left: { cx: 62, cy: 29 },
        center: { cx: 195, cy: 41 },
        right: { cx: 330, cy: 28 },
      },
    },
  },
  week: {
    up: {
      paths: ['M-24 40C12 14 38 8 64 18C104 34 150 48 198 31C236 14 285 9 330 28C360 41 390 38 414 18'],
      dots: {
        left: { cx: 64, cy: 18 },
        center: { cx: 198, cy: 31 },
        right: { cx: 330, cy: 28 },
      },
    },
    down: {
      paths: ['M-24 18C12 44 38 50 64 40C104 24 150 10 198 27C236 44 285 49 330 30C360 17 390 20 414 40'],
      dots: {
        left: { cx: 64, cy: 40 },
        center: { cx: 198, cy: 27 },
        right: { cx: 330, cy: 30 },
      },
    },
  },
  month: {
    up: {
      paths: [
        'M-24 53C8 55 30 28 64 14C110-3 165 2 198 18C244 40 281 52 330 42C369 34 398 14 414 4',
        'M-24 44C40 58 92 51 142 31C190 12 244 8 286 21C330 35 372 36 414 24',
      ],
      dots: {
        left: { cx: 64, cy: 14 },
        center: { cx: 198, cy: 18 },
        right: { cx: 330, cy: 42 },
      },
    },
    down: {
      paths: [
        'M-24 5C8 3 30 30 64 44C110 61 165 56 198 40C244 18 281 6 330 16C369 24 398 44 414 54',
        'M-24 14C40 0 92 7 142 27C190 46 244 50 286 37C330 23 372 22 414 34',
      ],
      dots: {
        left: { cx: 64, cy: 44 },
        center: { cx: 198, cy: 40 },
        right: { cx: 330, cy: 16 },
      },
    },
  },
} as const;

const WEEK_THREADS = {
  opening: {
    paths: ['M-24 11C12 8 38 9 64 12C112 16 154 21 198 27C245 33 286 37 330 40C362 42 390 44 414 46'],
    dots: {
      left: { cx: 64, cy: 12 },
      center: { cx: 198, cy: 27 },
      right: { cx: 330, cy: 40 },
    },
  },
  divider: {
    paths: ['M-24 47C15 46 39 44 64 41C108 36 152 30 198 25C244 20 286 15 330 13C360 11 390 11 414 10'],
    dots: {
      left: { cx: 64, cy: 41 },
      center: { cx: 198, cy: 25 },
      right: { cx: 330, cy: 13 },
    },
  },
  closing: {
    paths: ['M-24 17C20 15 41 16 64 18C116 21 157 27 198 32C245 38 288 42 330 44C360 45 390 43 414 40'],
    dots: {
      left: { cx: 64, cy: 18 },
      center: { cx: 198, cy: 32 },
      right: { cx: 330, cy: 44 },
    },
  },
} as const;

export function ForecastArc({
  className,
  direction = 'up',
  dot = 'right',
  placement,
  variant,
}: ForecastArcProps) {
  const thread = variant === 'week' && placement
    ? WEEK_THREADS[placement]
    : THREADS[variant][direction];
  const point = thread.dots[dot];

  return (
    <div
      className={[
        'forecast-editorial-arc',
        `variant-${variant}`,
        placement ? `placement-${placement}` : '',
        `is-${direction}`,
        `has-dot-${dot}`,
        className,
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <svg viewBox="0 0 390 58" preserveAspectRatio="none" focusable="false">
        {thread.paths.map((path, index) => (
          <path
            key={path}
            className={index === 0 ? 'is-primary' : 'is-secondary'}
            d={path}
          />
        ))}
        <circle cx={point.cx} cy={point.cy} r="2.2" />
      </svg>
    </div>
  );
}
