import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface LoadingProps {
  message?: string;
  progress?: number;
}

const LOADING_LABEL = 'NEBO гороскоп и натальная карта';

/** Молочно-белый экран загрузки: название приложения + тонкая полоска прогресса. */
export const Loading: React.FC<LoadingProps> = ({ progress: externalProgress }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (externalProgress !== undefined) {
      setProgress(externalProgress);
      return;
    }
    const duration = 2000;
    const interval = 20;
    const increment = 100 / (duration / interval);
    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        return next >= 100 ? 100 : next;
      });
    }, interval);
    return () => clearInterval(timer);
  }, [externalProgress]);

  const progressPercent = Math.max(0, Math.min(100, Math.round(progress)));

  return (
    <div
      className="fixed inset-0 z-50 flex h-[100dvh] min-h-[100dvh] w-screen flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: 'var(--app-canvas, #FFFFFF)' }}
      role="status"
      aria-live="polite"
      aria-label={LOADING_LABEL}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '5px',
          fontFamily: 'var(--fresh-font, "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
          color: '#241f36',
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '30px', fontWeight: 800, letterSpacing: '0.08em', lineHeight: 1 }}>
          NEBO
        </span>
        <span style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.25 }}>
          гороскоп и натальная карта
        </span>
      </div>

      <div className="mt-5 h-0.5 w-full max-w-[190px] overflow-hidden rounded-full bg-[#241f36]/12">
        <motion.div
          className="h-full rounded-full bg-[#241f36]/55"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
      </div>
      <div className="mt-2 text-center text-[11px] font-semibold tabular-nums text-[#241f36]/45">
        {progressPercent}%
      </div>
    </div>
  );
};
