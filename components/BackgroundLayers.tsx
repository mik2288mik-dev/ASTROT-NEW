import React from 'react';
import { Theme, UserContext, ViewState } from '../types';

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
    <div className="fixed inset-0 -z-10 overflow-hidden bg-white" aria-hidden>
      {showAurora && (
        <>
          <div
            className="
              pointer-events-none absolute -inset-[12px]
              [--white-gradient:repeating-linear-gradient(100deg,var(--white)_0%,var(--white)_7%,var(--transparent)_10%,var(--transparent)_12%,var(--white)_16%)]
              [--aurora:repeating-linear-gradient(100deg,var(--blue-500)_10%,var(--indigo-300)_15%,var(--blue-300)_20%,var(--violet-200)_25%,var(--blue-400)_30%)]
              [background-image:var(--white-gradient),var(--aurora)]
              [background-size:300%,_200%]
              [background-position:50%_50%,50%_50%]
              opacity-[0.48] will-change-transform
              filter blur-[10px] invert
              [mask-image:radial-gradient(ellipse_at_50%_8%,black_10%,black_54%,transparent_96%)]
              after:absolute after:inset-0 after:content-['']
              after:[background-image:var(--white-gradient),var(--aurora)]
              after:[background-size:220%,_120%]
              after:[background-attachment:fixed]
              after:animate-aurora
              after:mix-blend-difference
            "
          />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-8%,rgba(255,255,255,0.84),rgba(255,255,255,0.3)_30%,rgba(255,255,255,0)_64%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(255,255,255,0.2)_24%,rgba(255,255,255,0)_58%,rgba(255,255,255,0.06)_100%)]" />
        </>
      )}
    </div>
  );
};
