import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
  message?: string;
  progress?: number;
}

const LOADING_IMAGE_WEBP = '/loading-main.webp';
const LOADING_IMAGE_PNG = '/loading%20main.png';

export const Loading: React.FC<LoadingProps> = ({ message, progress: externalProgress }) => {
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

  const displayMessage = message?.trim() || 'Загружаем LUMIA';
  const showBar = progress > 0 && progress < 100;

  return (
    <div
      className="lumia-pad-top-tg fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-white text-center"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px))',
      }}
    >
      <motion.div
        className="relative z-10 flex w-full max-w-[280px] flex-col items-center px-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="relative w-full max-w-[220px]">
          <img
            src={imageSrc}
            alt=""
            className="mx-auto h-auto w-full max-h-[min(42vh,280px)] object-contain"
            onError={() => setImageSrc(LOADING_IMAGE_PNG)}
          />
        </div>

        <p className="mt-8 max-w-xs text-sm font-medium leading-relaxed text-[#2d2d2d]/80">{displayMessage}</p>

        {showBar ? (
          <div className="mt-6 h-0.5 w-full max-w-[220px] overflow-hidden rounded-full bg-black/[0.08]">
            <motion.div
              className="h-full rounded-full bg-[#1f1f1f]/70"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          </div>
        ) : null}
      </motion.div>
    </div>
  );
};
