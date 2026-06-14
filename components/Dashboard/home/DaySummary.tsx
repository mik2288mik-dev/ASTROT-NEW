import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { ActionTimingRecommendation, NatalChartData, UserProfile } from '../../../types';
import { getMoonPhase } from '../../../lib/horoscope/moonPhase';
import { getActionTimingRecommendation } from '../../../services/astrologyService';

// Crescent that fills to the given illumination (0..100).
function MoonGlyph({ illumination }: { illumination: number }) {
  const lit = Math.max(0, Math.min(100, illumination)) / 100;
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true" className="flex-shrink-0">
      <circle cx="15" cy="15" r="12" fill="#CFC3EC" />
      <clipPath id="daySummaryMoon"><circle cx="15" cy="15" r="12" /></clipPath>
      <rect x={3 + (1 - lit) * 24} y="3" width={24 * lit} height="24" fill="#7B5CF6" clipPath="url(#daySummaryMoon)" />
    </svg>
  );
}

/** "Сводка дня" — one clean row: Moon phase + best time of day. No nested boxes. */
export function DaySummary({
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

  useEffect(() => {
    let alive = true;
    void getActionTimingRecommendation(profile, chartData, chartId ?? null, 'work')
      .then((r) => { if (alive) setTiming(r); })
      .catch(() => { /* non-critical */ });
    return () => { alive = false; };
  }, [profile, chartData, chartId]);

  const cap = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-[#7A6E94]';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
      className="mt-5 rounded-[20px] bg-[#DDD0F0] p-5"
    >
      <p className={cap}>{language === 'ru' ? 'Сводка дня' : 'Today at a glance'}</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <MoonGlyph illumination={moon.illumination} />
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#7A6E94]">{language === 'ru' ? 'Луна' : 'Moon'}</p>
            <p className="truncate font-lumiaHome text-[15px] font-bold leading-tight text-[#1E1230]">
              {moon.shortLabel} · {moon.illumination}%
            </p>
          </div>
        </div>
        <div className="h-9 w-px flex-shrink-0 bg-[#1E1230]/12" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-[#7A6E94]">{language === 'ru' ? 'Лучшее время' : 'Best time'}</p>
          <p className="truncate font-lumiaHome text-[15px] font-bold leading-tight text-[#1E1230]">
            {timing ? `${timing.bestWindow.start}–${timing.bestWindow.end}` : '…'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
