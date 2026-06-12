import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { NatalChartData, UserEvolution, UserProfile } from '../../../types';
import { updateUserEvolution } from '../../../services/astrologyService';
import { LinearMeter } from './gauges';

const STAT_META = [
  { key: 'intuition', ru: 'Интуиция', en: 'Intuition', color: '#7B5CF6' },
  { key: 'confidence', ru: 'Уверенность', en: 'Confidence', color: '#FF8A8A' },
  { key: 'awareness', ru: 'Осознанность', en: 'Awareness', color: '#3FB7A0' },
] as const;

/** #2 — evolution level + three stat meters. updateUserEvolution is client-side. */
export function EvolutionMeter({
  profile,
  chartData,
  language,
}: {
  profile: UserProfile;
  chartData: NatalChartData | null;
  language: 'ru' | 'en';
}) {
  const [evo, setEvo] = useState<UserEvolution | null>(null);

  useEffect(() => {
    let alive = true;
    void updateUserEvolution(profile, chartData ?? undefined)
      .then((r) => { if (alive) setEvo(r); })
      .catch(() => { /* non-critical widget */ });
    return () => { alive = false; };
  }, [profile, chartData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mt-3 rounded-[24px] border border-[#EAE3F1] bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9A93A3]">
            {language === 'ru' ? 'Твоя эволюция' : 'Your evolution'}
          </p>
          <h3 className="mt-0.5 font-lumiaHomeDisplay text-[20px] font-bold text-[#1E1230]">{evo?.title ?? '—'}</h3>
        </div>
        <div className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-full bg-[#1E1230] text-white">
          <span className="text-[8px] font-semibold uppercase leading-none opacity-70">lvl</span>
          <span className="text-[16px] font-bold leading-none">{evo?.level ?? '—'}</span>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {STAT_META.map((s, i) => {
          const value = evo?.stats?.[s.key] ?? 0;
          return (
            <div key={s.key}>
              <div className="mb-1 flex items-center justify-between text-[12px] font-semibold">
                <span className="text-[#50465E]">{language === 'ru' ? s.ru : s.en}</span>
                <span className="text-[#1E1230]">{value}</span>
              </div>
              <LinearMeter value={value} color={s.color} delay={0.05 * i} />
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
