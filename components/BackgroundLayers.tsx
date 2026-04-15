import React from 'react';
import { Theme, UserContext, ViewState } from '../types';
import { AuroraBackground } from './ui/aurora-background';

interface BackgroundLayersProps {
  view: ViewState;
  theme?: Theme;
  context?: UserContext | null;
  /** @deprecated Kept for API compatibility; background behavior is view-driven. */
  lumiaAir?: boolean;
}

export const BackgroundLayers: React.FC<BackgroundLayersProps> = ({ view }) => {
  const showAurora = view !== 'settings';

  return (
    <div className="fixed inset-0 z-0 overflow-hidden bg-white" aria-hidden>
      {showAurora && (
        <>
          <AuroraBackground
            showRadialGradient={false}
            className="fixed inset-0 h-[100dvh] justify-start bg-white text-transparent dark:bg-white"
          >
            <div className="hidden" />
          </AuroraBackground>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-8%,rgba(255,255,255,0.84),rgba(255,255,255,0.3)_30%,rgba(255,255,255,0)_64%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.2)_24%,rgba(255,255,255,0)_58%,rgba(255,255,255,0.06)_100%)]" />
        </>
      )}
    </div>
  );
};
