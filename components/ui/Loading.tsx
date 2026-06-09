import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
  message?: string;
  progress?: number;
}

const LOADING_SPLASH = '/lumiastart.webp';
const LOADING_LABEL = 'Загружаем LUMIA';

/** Matches splash edge tone — fills letterbox when aspect ratio differs. */
const LOADING_BACKDROP = '#83564e';

export const Loading: React.FC<LoadingProps> = ({ progress: externalProgress }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (externalProgress !== undefined) {
      setProgress(externalProgress);
    } else {
      const duration = 2000;
      const interval = 20;
      const steps = duration / interval;
      const increment = 100 / steps;

      const timer = setInterval(() => {
        setProgress((prev) => {
          const next = prev + increment;
          return next >= 100 ? 100 : next;
        });
      }, interval);

      return () => clearInterval(timer);
    }
  }, [externalProgress]);

  const progressPercent = Math.max(0, Math.min(100, Math.round(progress)));
  const showBar = progressPercent > 0 && progressPercent < 100;

  return (
    <div
      className="fixed inset-0 z-50 h-[100dvh] min-h-[100dvh] w-screen overflow-hidden"
      style={{ backgroundColor: LOADING_BACKDROP }}
      role="status"
      aria-live="polite"
      aria-label={LOADING_LABEL}
    >
      <img
        src={LOADING_SPLASH}
        alt={LOADING_LABEL}
        decoding="async"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-top"
      />

      {showBar ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-8 pb-[max(calc(env(safe-area-inset-bottom,0px)+1rem),calc(var(--tg-content-safe-area-inset-bottom,0px)+1rem))] pt-3"
          style={{
            paddingTop: 'max(0.75rem, var(--tg-content-safe-area-inset-top, 0px))',
          }}
        >
          <div className="mx-auto h-0.5 w-full max-w-[260px] overflow-hidden rounded-full bg-[#1a2a3a]/12">
            <motion.div
              className="h-full rounded-full bg-[#1a2a3a]/55"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          </div>
          <div className="mt-2 text-center text-[11px] font-semibold tabular-nums text-[#1a2a3a]/55">
            {progressPercent}%
          </div>
        </div>
      ) : null}
    </div>
  );
};
