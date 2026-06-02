import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
  message?: string;
  progress?: number;
}

const LOADING_IMAGE_WEBP = '/loading-main.webp';
const LOADING_IMAGE_PNG = '/loading%20main.png';
const LOADING_LABEL = 'Загружаем LUMIA';

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
      className="fixed inset-0 z-50 min-h-[100dvh] w-full overflow-hidden bg-[#0a0a0a]"
      role="status"
      aria-live="polite"
      aria-label={LOADING_LABEL}
    >
      <img
        src={imageSrc}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-center"
        onError={() => setImageSrc(LOADING_IMAGE_PNG)}
      />

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/20"
        aria-hidden
      />

      <div
        className="absolute inset-x-0 bottom-0 flex flex-col items-center px-6 text-center"
        style={{
          paddingTop: 'max(env(safe-area-inset-top, 0px), var(--tg-content-safe-area-inset-top, 0px))',
          paddingBottom: 'max(calc(env(safe-area-inset-bottom, 0px) + 1.25rem), calc(var(--tg-content-safe-area-inset-bottom, 0px) + 1.25rem))',
        }}
      >
        <motion.p
          className="max-w-xs text-sm font-medium tracking-[0.02em] text-white/92"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          {LOADING_LABEL}
        </motion.p>

        {showBar ? (
          <div className="mt-5 h-0.5 w-full max-w-[240px] overflow-hidden rounded-full bg-white/25">
            <motion.div
              className="h-full rounded-full bg-white/90"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
