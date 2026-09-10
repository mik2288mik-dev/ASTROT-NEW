import React, { memo } from 'react';
import type { NatalChartData, UserProfile } from '../types';
import { HoroscopeReader } from './v2/HoroscopeReader';

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

export const Horoscope = memo<HoroscopeProps>((props) => <HoroscopeReader {...props} />);

Horoscope.displayName = 'Horoscope';
