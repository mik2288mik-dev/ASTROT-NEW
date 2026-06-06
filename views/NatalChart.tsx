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
  onCreateChart?: () => void;
  onOpenPersonalDaily?: () => void;
}

export const NatalChart: React.FC<NatalChartProps> = ({
  data,
  profile,
  chartId,
  requestPremium,
  onUpdateProfile,
  preloadedReport,
  onCreateChart,
  onOpenPersonalDaily,
}) => {
  if (!data) {
    return (
      <div className="min-h-full bg-white px-5 pt-10">
        <div className="mx-auto max-w-md rounded-[24px] border border-black/10 bg-white p-6 shadow-[0_18px_44px_rgba(0,0,0,0.07)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8c6bb1]">Личная карта</p>
          <h1 className="mt-3 text-[30px] font-semibold leading-tight text-[#1f1f1f]">Создай натальную карту</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#666]">Lumia рассчитает карту по дате, времени и месту рождения и откроет личные разборы.</p>
          <button type="button" onClick={onCreateChart} className="mt-6 min-h-[46px] rounded-full bg-[#1f1f1f] px-5 text-[14px] font-semibold text-white">Создать карту</button>
        </div>
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
        onOpenPersonalDaily={onOpenPersonalDaily}
      />
    </div>
  );
};
