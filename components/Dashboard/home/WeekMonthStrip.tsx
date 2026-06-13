import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import type { ForecastDailyReading, ForecastMonthlyReading, NatalChartData, UserProfile } from '../../../types';
import { getMoscowIsoWeekKey } from '../../../lib/date-utils';
import {
  getCachedWeeklySignHoroscope,
  ensureWeeklySignHoroscope,
  ensureMonthlyForecastLayer,
} from '../../../services/astrologyService';

const EASE = [0.22, 1, 0.36, 1] as const;

/** #15 — Week (free, sign-based) + Month (chart-based) overview strip. */
export function WeekMonthStrip({
  profile,
  chartData,
  chartId,
  sign,
  language,
  onNeedChart,
}: {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  sign: string;
  language: 'ru' | 'en';
  onNeedChart?: () => void;
}) {
  const weekKey = useMemo(() => getMoscowIsoWeekKey(), []);
  const [week, setWeek] = useState<ForecastDailyReading | null>(null);
  const [month, setMonth] = useState<ForecastMonthlyReading | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);
  const [monthLoading, setMonthLoading] = useState(false);

  useEffect(() => {
    if (!sign) return;
    let alive = true;
    setWeekLoading(true);
    void getCachedWeeklySignHoroscope(sign, weekKey, language)
      .then((c) => c || ensureWeeklySignHoroscope(sign, weekKey, language))
      .then((r) => { if (alive) setWeek(r); })
      .catch(() => { /* non-critical */ })
      .finally(() => { if (alive) setWeekLoading(false); });
    return () => { alive = false; };
  }, [sign, weekKey, language]);

  useEffect(() => {
    if (!chartData) return;
    let alive = true;
    setMonthLoading(true);
    void ensureMonthlyForecastLayer(profile, chartData, undefined, chartId ?? null)
      .then((r) => { if (alive) setMonth(r); })
      .catch(() => { /* non-critical */ })
      .finally(() => { if (alive) setMonthLoading(false); });
    return () => { alive = false; };
  }, [profile, chartData, chartId]);

  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      {/* Week — free */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE }}
        className="rounded-[20px] border border-[#EAE3F1] bg-white p-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9A93A3]">
          {language === 'ru' ? 'Эта неделя' : 'This week'}
        </p>
        {weekLoading && !week ? (
          <div className="mt-2 space-y-1.5" aria-busy="true">
            <div className="h-3 w-full animate-pulse rounded-full bg-black/10" />
            <div className="h-3 w-3/4 animate-pulse rounded-full bg-black/10" />
          </div>
        ) : week ? (
          <>
            <h4 className="mt-1 font-lumiaHomeDisplay text-[15px] font-bold leading-tight text-[#1E1230]">{week.headline}</h4>
            <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-[#50465E]">{week.summary}</p>
          </>
        ) : (
          <p className="mt-2 text-[12px] text-[#9A93A3]">{language === 'ru' ? 'Готовится…' : 'Preparing…'}</p>
        )}
      </motion.div>

      {/* Month — chart-based */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.06, ease: EASE }}
        className="rounded-[20px] border border-[#EAE3F1] bg-white p-4"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9A93A3]">
          {language === 'ru' ? 'Этот месяц' : 'This month'}
        </p>
        {!chartData ? (
          <button type="button" onClick={onNeedChart} className="mt-2 text-left">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#7B5CF6]">
              <Lock size={12} />
              {language === 'ru' ? 'По вашей карте' : 'From your chart'}
            </span>
            <p className="mt-1 text-[12px] leading-snug text-[#9A93A3]">
              {language === 'ru' ? 'Создай карту, чтобы открыть месяц.' : 'Create a chart to unlock the month.'}
            </p>
          </button>
        ) : monthLoading && !month ? (
          <div className="mt-2 space-y-1.5" aria-busy="true">
            <div className="h-3 w-full animate-pulse rounded-full bg-black/10" />
            <div className="h-3 w-3/4 animate-pulse rounded-full bg-black/10" />
          </div>
        ) : month ? (
          <>
            <h4 className="mt-1 font-lumiaHomeDisplay text-[15px] font-bold leading-tight text-[#1E1230]">{month.headline}</h4>
            <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-[#50465E]">{month.summary}</p>
          </>
        ) : (
          <p className="mt-2 text-[12px] text-[#9A93A3]">{language === 'ru' ? 'Готовится…' : 'Preparing…'}</p>
        )}
      </motion.div>
    </div>
  );
}
