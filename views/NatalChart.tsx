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
      <div className="mono-page min-h-full px-5 pt-10">
        <div className="mx-auto max-w-md rounded-mono-card border border-mono-line bg-mono-white p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mono-muted">Личная карта</p>
          <h1 className="mt-3 text-[28px] font-bold leading-tight text-mono-ink">Создай натальную карту</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-mono-muted">Lumia рассчитает карту по дате, времени и месту рождения и откроет личные разборы.</p>
          <button type="button" onClick={onCreateChart} className="mt-6 min-h-[48px] rounded-mono-pill bg-mono-black px-5 text-[14px] font-semibold text-white">Создать карту</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mono-page min-h-full pb-16 font-sans">
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
