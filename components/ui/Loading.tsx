import React, { useState, useEffect } from 'react';

interface LoadingProps {
  message?: string;
  progress?: number;
}

const LOADING_LABEL = 'NEBO гороскоп натальная карта';

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
      className="flex flex-1 h-full w-full flex-col items-center justify-center overflow-hidden relative z-50"
      style={{
        backgroundColor: 'var(--app-canvas, #FFFFFF)',
      }}
      data-nebo-startup-loading="true"
      role="status"
      aria-live="polite"
      aria-label={LOADING_LABEL}
    >
      {/* Canvas splash: a soft lavender glow, the NEBO mark in a ring with a dot on its orbit, three progress dots. */}
      <div className="nebo-splash" aria-hidden="true">
        <span className="nebo-splash-glow" />
        <span className="nebo-splash-ring">
          <img src="/assets/brand/nebo-mark.webp" alt="" width={72} height={72} />
          <i className="nebo-splash-orbit"><b /></i>
        </span>
      </div>
      <div className="nebo-splash-dots" aria-hidden="true">
        {[0, 1, 2].map((step) => <i key={step} className={progressPercent > step * 33 ? 'is-on' : ''} />)}
      </div>
      <span className="sr-only tabular-nums">{progressPercent}%</span>
    </div>
  );
};
