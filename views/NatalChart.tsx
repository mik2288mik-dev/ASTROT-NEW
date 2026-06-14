import React from 'react';
import type {
  NatalChartData,
  NatalInterpretationReport,
  UserProfile,
} from '../types';
import { NatalMagazine } from './v2/NatalMagazine';

interface NatalChartProps {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  requestPremium: (source?: string, payload?: Record<string, any>) => void | Promise<void>;
  onUpdateProfile?: (profile: UserProfile) => void;
  preloadedReport?: NatalInterpretationReport | null;
  onCreateChart?: () => void;
  onOpenPersonalDaily?: () => void;
}

export const NatalChart: React.FC<NatalChartProps> = (props) => <NatalMagazine {...props} />;
