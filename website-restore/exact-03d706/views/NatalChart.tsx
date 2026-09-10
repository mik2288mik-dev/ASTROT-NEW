import React from 'react';
import type {
  NatalChartData,
  UserProfile,
} from '../types';
import type { PreloadedNatalReport } from '../components/NatalReading/HumanReport';
import { NatalMagazine } from './v2/NatalMagazine';

interface NatalChartProps {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  requestPremium: (source?: string, payload?: Record<string, any>) => void | Promise<void>;
  onUpdateProfile?: (profile: UserProfile) => void;
  preloadedReport?: PreloadedNatalReport | null;
  onCreateChart?: () => void;
  onOpenPersonalDaily?: () => void;
  onOpenPersonalityReport: () => void;
}

export const NatalChart: React.FC<NatalChartProps> = (props) => <NatalMagazine {...props} />;
