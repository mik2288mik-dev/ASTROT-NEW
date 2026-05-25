import React, { useEffect } from 'react';
import type {
  NatalChartData,
  NatalChartMode,
  NatalInterpretationReport,
  NatalStoryCardId,
  UserProfile,
} from '../types';
import { ShimmerStyles } from '../components/NatalReading/Skeleton';
import { HumanReport } from '../components/NatalReading/HumanReport';

interface NatalChartProps {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  initialMode?: NatalChartMode;
  requestPremium: (source?: string, payload?: Record<string, any>) => void | Promise<void>;
  onOpenWallet?: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenTodaySection: (section: 'pulse' | 'checkin') => void;
  onBack?: () => void;
  onViewerOpenChange?: (open: boolean) => void;
  initialStoryCardId?: NatalStoryCardId | null;
  preloadedReport?: NatalInterpretationReport | null;
  dictionaryOpenSignal?: number; // unused in the single-page layout, kept for back-compat
}

export const NatalChart: React.FC<NatalChartProps> = ({
  data,
  profile,
  chartId,
  requestPremium,
  onOpenWallet,
  onUpdateProfile,
  onViewerOpenChange,
  preloadedReport,
}) => {
  useEffect(() => {
    onViewerOpenChange?.(false);
  }, [onViewerOpenChange]);

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
        onOpenWallet={onOpenWallet}
        onUpdateProfile={onUpdateProfile}
        preloadedReport={preloadedReport}
      />
    </div>
  );
};
