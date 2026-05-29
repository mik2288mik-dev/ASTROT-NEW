import React from 'react';
import type {
  NatalChartData,
  NatalInterpretationReport,
  UserProfile,
} from '../types';
import { ShimmerStyles } from '../components/NatalReading/Skeleton';
import { HumanReport } from '../components/NatalReading/HumanReport';

interface NatalChartProps {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  requestPremium: (source?: string, payload?: Record<string, any>) => void | Promise<void>;
  onUpdateProfile?: (profile: UserProfile) => void;
  preloadedReport?: NatalInterpretationReport | null;
}

export const NatalChart: React.FC<NatalChartProps> = ({
  data,
  profile,
  chartId,
  requestPremium,
  onUpdateProfile,
  preloadedReport,
}) => {
  if (!data) {
    return (
      <div className="min-h-full bg-white px-5 pt-10">
        <p className="text-[13px] text-[#9a9a9a]">Готовим интерпретацию...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white pb-16 font-sans">
      <ShimmerStyles />

      <HumanReport
        profile={profile}
        chartData={data}
        chartId={chartId}
        requestPremium={requestPremium}
        onUpdateProfile={onUpdateProfile}
        preloadedReport={preloadedReport}
      />
    </div>
  );
};
