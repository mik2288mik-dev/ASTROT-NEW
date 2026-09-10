import React, { type CSSProperties } from 'react';
import type { DiaryTodayVisualPlan } from '../../lib/personalForecastVisuals';
import type { ForecastEditorialLayout } from './editorialLayout';

type ForecastEditorialSkeletonProps = {
  label: string;
  layout: ForecastEditorialLayout;
  visual?: DiaryTodayVisualPlan['asset'];
};

export function ForecastEditorialSkeleton({
  label,
  layout,
  visual,
}: ForecastEditorialSkeletonProps) {
  const showVisual = layout !== 'prose'
    && layout !== 'typography-first'
    && !!visual;
  const style = visual ? {
    '--forecast-skeleton-visual-ratio': `${visual.width} / ${visual.height}`,
  } as CSSProperties : undefined;

  return (
    <section
      className="forecast-editorial-skeleton"
      data-forecast-skeleton-layout={layout}
      style={style}
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="forecast-editorial-skeleton-canvas" aria-hidden="true">
        <span className="forecast-editorial-skeleton-line forecast-editorial-skeleton-headline" />
        <span className="forecast-editorial-skeleton-line forecast-editorial-skeleton-headline is-short" />
        <div className="forecast-editorial-skeleton-copy">
          <span className="forecast-editorial-skeleton-line forecast-editorial-skeleton-lead" />
          <span className="forecast-editorial-skeleton-line forecast-editorial-skeleton-lead is-short" />
        </div>
        <span className="forecast-editorial-skeleton-divider" />
        <div className="forecast-editorial-skeleton-beat">
          <div className="forecast-editorial-skeleton-copy">
            <span className="forecast-editorial-skeleton-line forecast-editorial-skeleton-body" />
            <span className="forecast-editorial-skeleton-line forecast-editorial-skeleton-body" />
            <span className="forecast-editorial-skeleton-line forecast-editorial-skeleton-body is-short" />
          </div>
          {showVisual ? <span className="forecast-editorial-skeleton-visual" /> : null}
        </div>
      </div>
    </section>
  );
}
