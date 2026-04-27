import React, { useEffect, useMemo, useState } from 'react';
import type {
  NatalChartData,
  NatalChartMode,
  UserProfile,
} from '../types';
import { serializeChartForPrompt } from '../lib/natalReading/chartSerializer';
import type {
  NatalReadingAspects,
  NatalReadingDeepDive,
  NatalReadingDeepDiveKey,
  NatalReadingPortrait,
  NatalReadingToday,
  NatalReadingWeek,
} from '../lib/natalReading/types';
import {
  loadAspects,
  loadDeepDive,
  loadPortrait,
  loadToday,
  loadWeek,
} from '../services/natalReadingService';
import { Hero } from '../components/NatalReading/Hero';
import { Portrait } from '../components/NatalReading/Portrait';
import { Planets } from '../components/NatalReading/Planets';
import { Houses } from '../components/NatalReading/Houses';
import { Aspects } from '../components/NatalReading/Aspects';
import { Week } from '../components/NatalReading/Week';
import { Today } from '../components/NatalReading/Today';
import { DeepDive } from '../components/NatalReading/DeepDive';
import { ShimmerStyles } from '../components/NatalReading/Skeleton';
import { HumanReport } from '../components/NatalReading/HumanReport';
import { TrueNatalWheelHero } from '../components/Dashboard/TrueNatalWheelHero';

interface NatalChartProps {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  initialMode?: NatalChartMode;
  requestPremium: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  dictionaryOpenSignal?: number; // unused in new layout, kept for back-compat
}

export const NatalChart: React.FC<NatalChartProps> = ({
  data,
  profile,
  chartId,
  initialMode = 'human',
  requestPremium,
  onUpdateProfile,
}) => {
  const [readingMode, setReadingMode] = useState<NatalChartMode>(initialMode);
  const [portrait, setPortrait] = useState<NatalReadingPortrait | null>(null);
  const [aspects, setAspects] = useState<NatalReadingAspects | null>(null);
  const [week, setWeek] = useState<NatalReadingWeek | null>(null);
  const [today, setToday] = useState<NatalReadingToday | null>(null);

  const [loadingPortrait, setLoadingPortrait] = useState(true);
  const [loadingAspects, setLoadingAspects] = useState(true);
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [loadingToday, setLoadingToday] = useState(false);

  const [errToday, setErrToday] = useState<string | null>(null);

  const [dives, setDives] = useState<Partial<Record<NatalReadingDeepDiveKey, NatalReadingDeepDive>>>(
    {}
  );
  const [diveLoading, setDiveLoading] = useState<NatalReadingDeepDiveKey | null>(null);

  const userId = profile.id ? String(profile.id) : '';
  const isPremium = !!profile.isPremium;

  useEffect(() => {
    setReadingMode(initialMode);
  }, [initialMode]);

  const serialized = useMemo(() => {
    if (!data) return null;
    return serializeChartForPrompt(profile, data);
  }, [data, profile]);

  useEffect(() => {
    if (!userId || !data || readingMode !== 'wheel') return;
    let cancelled = false;
    setLoadingPortrait(true);
    setLoadingAspects(true);
    setLoadingWeek(true);
    Promise.allSettled([
      loadPortrait(userId, chartId),
      loadAspects(userId, chartId),
      loadWeek(userId, chartId),
    ]).then(([p, a, w]) => {
      if (cancelled) return;
      if (p.status === 'fulfilled') setPortrait(p.value);
      setLoadingPortrait(false);

      if (a.status === 'fulfilled') setAspects(a.value);
      setLoadingAspects(false);

      if (w.status === 'fulfilled') setWeek(w.value);
      setLoadingWeek(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, data, chartId, readingMode]);

  useEffect(() => {
    if (!userId || !data || !isPremium || readingMode !== 'wheel') return;
    let cancelled = false;
    setLoadingToday(true);
    setErrToday(null);
    loadToday(userId, chartId)
      .then((t) => {
        if (!cancelled) setToday(t);
      })
      .catch((e: Error) => {
        if (!cancelled) setErrToday(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingToday(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, data, chartId, isPremium, readingMode]);

  const openDive = async (key: NatalReadingDeepDiveKey) => {
    if (!userId || !data) return;
    if (dives[key]) return;
    setDiveLoading(key);
    try {
      const result = await loadDeepDive(userId, key, chartId);
      setDives((prev) => ({ ...prev, [key]: result }));
    } catch (e) {
      console.warn('[NatalChart] Deep dive load failed', e);
    } finally {
      setDiveLoading(null);
    }
  };

  if (!data || !serialized) {
    return (
      <div className="bg-white min-h-full px-5 pt-10">
        <p className="text-[13px] text-[#9a9a9a]">Готовим карту…</p>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-full pb-16 font-sans">
      <ShimmerStyles />

      <div className="sticky top-0 z-20 bg-white/92 px-5 pb-3 pt-4 backdrop-blur-xl">
        <div className="grid grid-cols-2 rounded-full bg-[#f4f4f4] p-1">
          <button
            type="button"
            onClick={() => setReadingMode('human')}
            className={`min-h-[38px] rounded-full px-3 text-[13px] font-medium transition ${
              readingMode === 'human'
                ? 'bg-white text-[#1f1f1f] shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
                : 'text-[#777]'
            }`}
          >
            Карта личности
          </button>
          <button
            type="button"
            onClick={() => setReadingMode('wheel')}
            className={`min-h-[38px] rounded-full px-3 text-[13px] font-medium transition ${
              readingMode === 'wheel'
                ? 'bg-white text-[#1f1f1f] shadow-[0_6px_18px_rgba(0,0,0,0.08)]'
                : 'text-[#777]'
            }`}
          >
            Натальный круг
          </button>
        </div>
      </div>

      {readingMode === 'human' ? (
        <HumanReport
          profile={profile}
          chartData={data}
          chartId={chartId}
          requestPremium={requestPremium}
          onUpdateProfile={onUpdateProfile}
        />
      ) : (
        <>

      <section className="px-2 pb-4 pt-1">
        <div className="mx-auto min-h-[650px] w-full max-w-[27rem]">
          <TrueNatalWheelHero
            profile={profile}
            chartData={data}
            chartId={chartId}
            shouldAnimateIntro
            onOpenChart={() => setReadingMode('human')}
          />
        </div>
      </section>

      <div className="h-px w-full bg-[#f2f2f2]" />

      <Hero
        name={profile.name}
        birthDate={profile.birthDate}
        birthTime={profile.birthTime}
        birthPlace={profile.birthPlace}
        signature={{
          sun: serialized.signature.sun,
          moon: serialized.signature.moon,
          rising: serialized.signature.rising,
          mc: serialized.mc.sign,
        }}
        archetypes={portrait?.archetypes ?? null}
        loadingArchetypes={loadingPortrait}
      />

      <div className="h-px w-full bg-[#f2f2f2]" />
      <Portrait data={portrait} loading={loadingPortrait} />

      <Planets chart={serialized} />

      <Houses chart={serialized} />

      <Aspects data={aspects} loading={loadingAspects} />

      <Week data={week} loading={loadingWeek} />

      <div className="h-px w-full bg-[#f2f2f2]" />

      <Today
        isPremium={isPremium}
        data={today}
        loading={loadingToday}
        error={errToday}
        onUnlockPremium={requestPremium}
        onUnlockReading={() => {
          if (!userId) return;
          setLoadingToday(true);
          setErrToday(null);
          loadToday(userId, chartId)
            .then(setToday)
            .catch((e) => setErrToday(e instanceof Error ? e.message : 'Ошибка'))
            .finally(() => setLoadingToday(false));
        }}
      />

      <div className="h-px w-full bg-[#f2f2f2]" />

      <DeepDive
        isPremium={isPremium}
        loaded={dives}
        loading={diveLoading}
        onOpen={openDive}
        onUnlockPremium={requestPremium}
      />
        </>
      )}
    </div>
  );
};
