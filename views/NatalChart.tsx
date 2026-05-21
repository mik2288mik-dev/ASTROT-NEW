import React, { useEffect, useRef } from 'react';
import type {
  NatalChartData,
  NatalChartMode,
  NatalInterpretationReport,
  UserProfile,
} from '../types';
import { ShimmerStyles } from '../components/NatalReading/Skeleton';
import { HumanReport } from '../components/NatalReading/HumanReport';
import { TrueNatalWheelHero } from '../components/Dashboard/TrueNatalWheelHero';

interface NatalChartProps {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  initialMode?: NatalChartMode;
  requestPremium: () => void;
  onOpenWallet?: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  preloadedReport?: NatalInterpretationReport | null;
  dictionaryOpenSignal?: number; // unused in the single-page layout, kept for back-compat
}

export const NatalChart: React.FC<NatalChartProps> = ({
  data,
  profile,
  chartId,
  initialMode = 'human',
  requestPremium,
  onOpenWallet,
  onUpdateProfile,
  preloadedReport,
}) => {
  const wheelSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (initialMode !== 'wheel' || !data) return;
    const timer = window.setTimeout(() => {
      wheelSectionRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 260);
    return () => window.clearTimeout(timer);
  }, [data, initialMode]);

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

      <section ref={wheelSectionRef} className="border-t border-[#efefef] bg-white px-4 pb-12 pt-8">
        <div className="mx-auto w-full max-w-[27rem]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8c6bb1]">
            Натальное колесо
          </p>
          <h2 className="mt-2 font-lora text-[24px] leading-tight text-[#1f1f1f]">
            Круг карты
          </h2>
          <div className="mt-5">
            <TrueNatalWheelHero
              profile={profile}
              chartData={data}
              chartId={chartId}
              variant="embedded"
              shouldAnimateIntro
            />
          </div>
        </div>
      </section>
    </div>
  );
};
