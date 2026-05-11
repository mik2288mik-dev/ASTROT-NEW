import React from 'react';
import type { HoroscopeLayer, UserProfile, ViewState } from '../types';
import { LumiaAppHeader } from './lumia-ui/LumiaAppHeader';

interface HeaderProps {
  profile: UserProfile | null;
  view: ViewState;
  onOpenSettings: () => void;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer) => void;
  collapseProgress?: number;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  view,
  onOpenSettings,
  onOpenHoroscopeLayer,
  collapseProgress = 0,
}) => {
  if (!profile) return null;

  const isFunnel = view === 'onboarding' || view === 'hook' || view === 'paywall';
  const isStoriesViewer = view === 'horoscope';

  if (isFunnel || isStoriesViewer) return null;

  return (
    <LumiaAppHeader
      profile={profile}
      view={view}
      collapseProgress={view === 'dashboard' ? collapseProgress : 0}
      onOpenSettings={onOpenSettings}
      onOpenHoroscopeLayer={onOpenHoroscopeLayer}
    />
  );
};
