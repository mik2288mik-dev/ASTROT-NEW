import React from 'react';
import type { UserProfile, ViewState } from '../types';
import { LumiaAppHeader } from './lumia-ui/LumiaAppHeader';

interface HeaderProps {
  profile: UserProfile | null;
  view: ViewState;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  view,
  scrollContainerRef,
}) => {
  if (!profile) return null;

  const isFunnel = view === 'onboarding' || view === 'hook' || view === 'paywall';
  const isStoriesViewer = view === 'horoscope';
  const isDashboard = view === 'dashboard';

  if (isFunnel || isStoriesViewer || isDashboard) return null;

  return (
    <LumiaAppHeader
      profile={profile}
      view={view}
      scrollContainerRef={scrollContainerRef}
    />
  );
};
