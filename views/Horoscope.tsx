import React, { memo } from 'react';
import type { NatalChartData, UserProfile } from '../types';
import { HoroscopeStories } from '../components/lumia-ui/HoroscopeStories';

interface HoroscopeProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onOpenPersonalDaily?: () => void;
  onRequestPremium?: () => void;
  onBack?: () => void | Promise<void>;
  onBackgroundChange?: (state: { sign: string | null; tone: 'sign' } | null) => void;
}

// Horoscope is stories-only now: sign picker (if needed) → today's reading.
export const Horoscope = memo<HoroscopeProps>(({ profile, chartData, onBack, onUpdateProfile }) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  return (
    <HoroscopeStories
      open
      profile={profile}
      chartData={chartData}
      language={language}
      onClose={() => { void onBack?.(); }}
      onUpdateProfile={onUpdateProfile}
    />
  );
});

Horoscope.displayName = 'Horoscope';
