import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LumiaLogo } from '../brand/LumiaLogo';

interface LoadingProps {
  message?: string;
  progress?: number;
}

export const Loading: React.FC<LoadingProps> = ({ message, progress: externalProgress }) => {
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

  return (
    <div
      className="lumia-pad-top-tg fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-white text-center"
      style={{
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px))',
      }}
    >
      <motion.div
        className="relative z-10 flex flex-col items-center px-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <motion.div
          animate={{ opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <LumiaLogo variant="row" lightSurface className="scale-110 sm:scale-125" />
        </motion.div>

        {message && (
          <p className="mt-8 max-w-xs text-sm font-medium leading-relaxed text-[#2d2d2d]/75">{message}</p>
        )}

        {progress > 0 && progress < 100 && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 220 }}
            transition={{ delay: 0.35 }}
            className="mt-6 h-0.5 overflow-hidden rounded-full bg-black/[0.08]"
          >
            <motion.div
              className="h-full rounded-full bg-astro-highlight/80"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.25 }}
            />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
