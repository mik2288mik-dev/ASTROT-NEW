import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { cn } from '../../lib/cn';

type AppTopBarProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  className?: string;
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
  className,
}: AppTopBarProps) {
  return (
    <>
      <header className={cn('app-top-bar', className)}>
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

        <div className="app-top-bar-center">
          <span className="app-top-bar-title">{title}</span>
        </div>

        <div className="app-top-bar-side app-top-bar-side--end">
          {rightAction}
        </div>
      </header>
      <div className="app-top-bar-spacer" aria-hidden />
      {subtitle ? <div className="app-top-bar-context">{subtitle}</div> : null}
    </>
  );
}
