import React from 'react';
import type { DiaryEditorialPause } from '../../lib/personalForecastVisuals';

type ForecastEndEditorialVisualProps = {
  asset: DiaryEditorialPause['asset'];
  className: string;
};

export function ForecastEndEditorialVisual({
  asset,
  className,
}: ForecastEndEditorialVisualProps) {
  return (
    <figure className={className} aria-hidden="true">
      <img
        src={asset.path}
        width={asset.width}
        height={asset.height}
        alt=""
        loading="lazy"
        decoding="async"
      />
    </figure>
  );
}
