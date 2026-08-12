import React from 'react';
import type { DiaryEditorialPause } from '../../lib/personalForecastVisuals';
import { EditorialSticker } from '../EditorialSticker';

type EditorialVisualSize = 'small' | 'medium' | 'hero';

type EditorialForecastVisualProps = {
  asset: DiaryEditorialPause['asset'];
  size: EditorialVisualSize;
  priority?: boolean;
};

export function EditorialForecastVisual({
  asset,
  size,
  priority = false,
}: EditorialForecastVisualProps) {
  return (
    <div
      className={`forecast-editorial-visual is-${asset.collection}`}
      data-editorial-size={size}
      aria-hidden="true"
    >
      <EditorialSticker
        asset={asset}
        className="forecast-editorial-visual-image"
        priority={priority}
      />
    </div>
  );
}
