import React from 'react';
import { Theme, UserContext, ViewState } from '../types';

interface BackgroundLayersProps {
  view: ViewState;
  theme?: Theme;
  context?: UserContext | null;
  /** @deprecated Kept for API compatibility; background behavior is view-driven. */
  lumiaAir?: boolean;
}

export const BackgroundLayers: React.FC<BackgroundLayersProps> = ({ view }) => (
  <div className="fixed inset-0 z-0 overflow-hidden bg-white" aria-hidden data-view={view} />
);
