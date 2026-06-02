import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
  message?: string;
  progress?: number;
}

const LOADING_SPLASH = '/lumia_splash_text_updated_1440x3040.webp';
const LOADING_LABEL = 'Загружаем LUMIA';

/** Matches sky tone in splash art — fills letterbox when aspect ratio differs. */
const LOADING_BACKDROP = '#d6e5ef';

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

  const showBar = progress > 0 && progress < 100;

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
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};
