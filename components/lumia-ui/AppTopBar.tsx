import React from 'react';
import { ChevronLeft } from 'lucide-react';

type AppTopBarProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  reserveSpace?: boolean;
};

/**
 * The single top bar used by every primary application screen.
 * The optional context line sits below the glass so the bar itself never changes height.
 */
export function AppTopBar({
  title,
  subtitle,
  onBack,
  rightAction,
  reserveSpace = true,
}: AppTopBarProps) {
  return (
    <>
      <div className="home-logo-bar app-top-bar">
        <div className="app-top-bar-side app-top-bar-side--start">
          {onBack ? (
            <button
              className="app-top-bar-action"
              onClick={onBack}
              type="button"
              aria-label="Назад / Back"
            >
              <ChevronLeft aria-hidden strokeWidth={1.9} />
            </button>
          ) : null}
        </div>

        <span className="home-logo-wordmark app-top-bar-title">{title}</span>

        <div className="app-top-bar-side app-top-bar-side--end">
          {rightAction}
        </div>
      </div>
      {reserveSpace ? <div className="app-top-bar-spacer" aria-hidden /> : null}
      {reserveSpace && subtitle ? <div className="app-top-bar-context">{subtitle}</div> : null}
    </>
  );
}
