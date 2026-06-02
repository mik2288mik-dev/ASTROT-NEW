import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
  message?: string;
  progress?: number;
}

const LOADING_IMAGE_WEBP = '/loading-main.webp';
const LOADING_IMAGE_PNG = '/loading%20main.png';
const LOADING_LABEL = 'Загружаем LUMIA';

/** Matches sky tone in splash art — fills letterbox when aspect ratio differs. */
const LOADING_BACKDROP = '#d6e5ef';

export const Loading: React.FC<LoadingProps> = ({ progress: externalProgress }) => {
  const [progress, setProgress] = useState(0);
  const [imageSrc, setImageSrc] = useState(LOADING_IMAGE_WEBP);

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
      className="fixed inset-0 z-50 flex min-h-[100dvh] w-full flex-col overflow-hidden"
      style={{ backgroundColor: LOADING_BACKDROP }}
      role="status"
      aria-live="polite"
      aria-label={LOADING_LABEL}
    >
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <img
          src={imageSrc}
          alt={LOADING_LABEL}
          decoding="async"
          fetchPriority="high"
          className="h-full w-full object-contain object-center"
          onError={() => setImageSrc(LOADING_IMAGE_PNG)}
        />
      </div>

      {showBar ? (
        <div
          className="shrink-0 px-8 pb-[max(calc(env(safe-area-inset-bottom,0px)+1rem),calc(var(--tg-content-safe-area-inset-bottom,0px)+1rem))] pt-3"
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
      ) : (
        <div
          className="shrink-0 pb-[max(env(safe-area-inset-bottom,0px),var(--tg-content-safe-area-inset-bottom,0px))]"
          aria-hidden
        />
      )}
    </div>
  );
};
