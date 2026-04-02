import React from 'react';
import { Theme, UserContext, ViewState } from '../types';

interface BackgroundLayersProps {
  view: ViewState;
  theme?: Theme;
  context?: UserContext | null;
  /** @deprecated Kept for API compatibility; фон всегда белый */
  lumiaAir?: boolean;
}

/** Единый чистый белый фон под всем приложением (без космических картинок). */
export const BackgroundLayers: React.FC<BackgroundLayersProps> = () => (
  <div className="fixed inset-0 -z-10 bg-white" aria-hidden />
);
