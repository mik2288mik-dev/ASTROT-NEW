import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { ActionTimingRecommendation, NatalChartData, UserProfile } from '../../../types';
import { getMoonPhase } from '../../../lib/horoscope/moonPhase';
import { getActionTimingRecommendation } from '../../../services/astrologyService';

// Simple crescent that fills to the given illumination (0..100).
function MoonGlyph({ illumination }: { illumination: number }) {
  const lit = Math.max(0, Math.min(100, illumination)) / 100;
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="11" fill="#E7E0F2" />
      <clipPath id="moonClip"><circle cx="14" cy="14" r="11" /></clipPath>
      <rect x={3 + (1 - lit) * 22} y="3" width={22 * lit} height="22" fill="#7B5CF6" clipPath="url(#moonClip)" />
    </svg>
  );
}

/** "Сводка дня" — factual day summary: Moon phase + best time of day. */
export function DaySummaryCard({
  profile,
  chartData,
  chartId,
  language,
}: {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  language: 'ru' | 'en';
}) {
  const moon = useMemo(() => getMoonPhase(new Date()), []);
  const [timing, setTiming] = useState<ActionTimingRecommendation | null>(null);
  const [timingLoading, setTimingLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setTimingLoading(true);
    void getActionTimingRecommendation(profile, chartData, chartId ?? null, 'work')
      .then((r) => { if (alive) setTiming(r); })
      .catch(() => { /* non-critical */ })
      .finally(() => { if (alive) setTimingLoading(false); });
    return () => { alive = false; };
  }, [profile, chartData, chartId]);

  const cell = 'rounded-[16px] bg-[#F4F1FB] p-3.5';
  const cap = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9A93A3]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mt-5 rounded-[20px] border border-[#EAE3F1] bg-white p-5 shadow-[0_12px_28px_rgba(30,18,48,0.08)]"
    >
      <p className={cap}>{language === 'ru' ? 'Сводка дня' : 'Today at a glance'}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className={cell}>
          <p className={cap}>{language === 'ru' ? 'Луна' : 'Moon'}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <MoonGlyph illumination={moon.illumination} />
            <div className="min-w-0">
              <p className="truncate font-lumiaHome text-[15px] font-bold leading-tight text-[#1E1230]">{moon.shortLabel}</p>
              <p className="text-[12px] font-medium text-[#7B5CF6]">{moon.illumination}%</p>
            </div>
          </div>
        </div>
        <div className={cell}>
          <p className={cap}>{language === 'ru' ? 'Лучшее время' : 'Best time'}</p>
          {timingLoading && !timing ? (
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded-full bg-black/10" aria-busy="true" />
          ) : timing ? (
            <>
              <p className="mt-1.5 font-lumiaHome text-[15px] font-bold leading-tight text-[#1E1230]">
                {timing.bestWindow.start}–{timing.bestWindow.end}
              </p>
              <p className="text-[12px] font-medium text-[#7B5CF6]">{language === 'ru' ? 'для важных дел' : 'for what matters'}</p>
            </>
          ) : (
            <p className="mt-2 text-[13px] text-[#9A93A3]">{language === 'ru' ? 'Скоро' : 'Soon'}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
