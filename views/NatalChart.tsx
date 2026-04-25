import React, { useEffect, useMemo, useState } from 'react';
import type {
  NatalChartData,
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

interface NatalChartProps {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  requestPremium: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  dictionaryOpenSignal?: number; // unused in new layout, kept for back-compat
}

export const NatalChart: React.FC<NatalChartProps> = ({
  data,
  profile,
  chartId,
  requestPremium,
}) => {
  const [portrait, setPortrait] = useState<NatalReadingPortrait | null>(null);
  const [aspects, setAspects] = useState<NatalReadingAspects | null>(null);
  const [week, setWeek] = useState<NatalReadingWeek | null>(null);
  const [today, setToday] = useState<NatalReadingToday | null>(null);

  const [loadingPortrait, setLoadingPortrait] = useState(true);
  const [loadingAspects, setLoadingAspects] = useState(true);
  const [loadingWeek, setLoadingWeek] = useState(true);
  const [loadingToday, setLoadingToday] = useState(false);

  const [errPortrait, setErrPortrait] = useState<string | null>(null);
  const [errAspects, setErrAspects] = useState<string | null>(null);
  const [errWeek, setErrWeek] = useState<string | null>(null);
  const [errToday, setErrToday] = useState<string | null>(null);

  const [dives, setDives] = useState<Partial<Record<NatalReadingDeepDiveKey, NatalReadingDeepDive>>>(
    {}
  );
  const [diveLoading, setDiveLoading] = useState<NatalReadingDeepDiveKey | null>(null);
  const [diveError, setDiveError] = useState<string | null>(null);

  const userId = profile.id ? String(profile.id) : '';
  const isPremium = !!profile.isPremium;

  const serialized = useMemo(() => {
    if (!data) return null;
    return serializeChartForPrompt(profile, data);
  }, [data, profile]);

  useEffect(() => {
    if (!userId || !data) return;
    let cancelled = false;
    setLoadingPortrait(true);
    setLoadingAspects(true);
    setLoadingWeek(true);
    setErrPortrait(null);
    setErrAspects(null);
    setErrWeek(null);
    Promise.allSettled([
      loadPortrait(userId, chartId),
      loadAspects(userId, chartId),
      loadWeek(userId, chartId),
    ]).then(([p, a, w]) => {
      if (cancelled) return;
      if (p.status === 'fulfilled') setPortrait(p.value);
      else setErrPortrait(p.reason?.message || 'Не удалось загрузить портрет');
      setLoadingPortrait(false);

      if (a.status === 'fulfilled') setAspects(a.value);
      else setErrAspects(a.reason?.message || 'Не удалось загрузить аспекты');
      setLoadingAspects(false);

      if (w.status === 'fulfilled') setWeek(w.value);
      else setErrWeek(w.reason?.message || 'Не удалось загрузить прогноз');
      setLoadingWeek(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, data, chartId]);

  useEffect(() => {
    if (!userId || !data || !isPremium) return;
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
  }, [userId, data, chartId, isPremium]);

  const openDive = async (key: NatalReadingDeepDiveKey) => {
    if (!userId || !data) return;
    if (dives[key]) return;
    setDiveLoading(key);
    setDiveError(null);
    try {
      const result = await loadDeepDive(userId, key, chartId);
      setDives((prev) => ({ ...prev, [key]: result }));
    } catch (e) {
      setDiveError(e instanceof Error ? e.message : 'Не удалось загрузить раздел');
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
    </div>
  );
};
