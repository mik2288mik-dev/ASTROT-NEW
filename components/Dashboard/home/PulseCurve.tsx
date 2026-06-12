import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { NatalChartData, TodayPulse, TodayPulseResult, UserProfile } from '../../../types';
import { getCachedTodayPulse, getTodayPulse } from '../../../services/astrologyService';

const VIEW_W = 300;
const VIEW_H = 92;

function curvePaths(pulse: TodayPulse) {
  const pts = pulse.points ?? [];
  if (pts.length < 2) return null;
  const x = (i: number) => (i / (pts.length - 1)) * VIEW_W;
  const y = (score: number) => VIEW_H - (Math.max(0, Math.min(100, score)) / 100) * VIEW_H;
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.score).toFixed(1)}`).join(' ');
  const area = `${line} L${VIEW_W},${VIEW_H} L0,${VIEW_H} Z`;
  const curIdx = Math.max(0, pts.findIndex((p) => p.hour === pulse.currentPoint?.hour));
  return { line, area, marker: { x: x(curIdx), y: y(pts[curIdx]?.score ?? 0) } };
}

/** #8 — day-energy pulse curve from TodayPulse.points. */
export function PulseCurve({
  profile,
  chartData,
  chartId,
  language,
  onNeedChart,
}: {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  language: 'ru' | 'en';
  onNeedChart?: () => void;
}) {
  const [result, setResult] = useState<TodayPulseResult | null>(
    () => getCachedTodayPulse(profile, chartId, undefined, chartData),
  );
  const [loading, setLoading] = useState(!result);

  useEffect(() => {
    if (result) return;
    let alive = true;
    setLoading(true);
    void getTodayPulse(profile, chartData, chartId)
      .then((r) => { if (alive) setResult(r); })
      .catch(() => { /* non-critical */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [profile, chartData, chartId, result]);

  const pulse = result?.status === 'ready' ? result.pulse : null;
  const paths = useMemo(() => (pulse ? curvePaths(pulse) : null), [pulse]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mt-3 overflow-hidden rounded-[24px] border border-[#EAE3F1] bg-white p-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9A93A3]">
        {language === 'ru' ? 'Пульс дня' : 'Day pulse'}
      </p>

      {result?.status === 'needs_setup' ? (
        <div className="mt-3">
          <p className="text-[14px] leading-relaxed text-[#50465E]">{result.message}</p>
          <button
            type="button"
            onClick={onNeedChart}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#7B5CF6] px-4 py-2.5 text-[13px] font-bold text-white"
          >
            <Sparkles size={15} />
            {result.actionLabel || (language === 'ru' ? 'Добавить данные' : 'Add birth data')}
          </button>
        </div>
      ) : loading && !pulse ? (
        <div className="mt-4 h-[92px] animate-pulse rounded-[16px] bg-black/[0.05]" aria-busy="true" />
      ) : pulse && paths ? (
        <div className="mt-3">
          <h3 className="font-lumiaHomeDisplay text-[19px] font-bold leading-tight text-[#1E1230]">
            {pulse.currentPoint?.title}
          </h3>
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="mt-3 w-full" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7B5CF6" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#7B5CF6" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={paths.area} fill="url(#pulseFill)" />
            <motion.path
              d={paths.line}
              fill="none"
              stroke="#7B5CF6"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            />
            <circle cx={paths.marker.x} cy={paths.marker.y} r={5} fill="#7B5CF6" stroke="#fff" strokeWidth={2.5} />
          </svg>
          {pulse.currentPoint?.summary ? (
            <p className="mt-2 text-[13px] leading-relaxed text-[#50465E]">{pulse.currentPoint.summary}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-[#9A93A3]">
          {language === 'ru' ? 'Пульс пока недоступен.' : 'Pulse is not available yet.'}
        </p>
      )}
    </motion.div>
  );
}
