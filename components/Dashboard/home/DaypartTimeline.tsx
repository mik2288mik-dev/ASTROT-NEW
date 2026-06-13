import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { ForecastDaypartReading, ForecastDaypartSlot, NatalChartData, UserProfile } from '../../../types';
import { canAccessFeature } from '../../../lib/accessMatrix';
import { getFullDaypartForecast } from '../../../services/astrologyService';
import { lumiaSelectionHaptic } from '../../../lib/haptics';

const SLOTS: { key: ForecastDaypartSlot; ru: string; en: string; emoji: string }[] = [
  { key: 'morning', ru: 'Утро', en: 'Morning', emoji: '🌅' },
  { key: 'day', ru: 'День', en: 'Day', emoji: '☀️' },
  { key: 'evening', ru: 'Вечер', en: 'Evening', emoji: '🌙' },
];

function currentSlot(): ForecastDaypartSlot {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'day';
  return 'evening';
}

/** #4 — morning/day/evening forecast. Pro + chart; free sees a teaser. */
export function DaypartTimeline({
  profile,
  chartData,
  chartId,
  language,
  onNeedChart,
  onRequestPremium,
}: {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  language: 'ru' | 'en';
  onNeedChart?: () => void;
  onRequestPremium?: () => void;
}) {
  const access = canAccessFeature('personal_daily', profile, { chartData, primaryChartId: chartId ?? null });
  const [slot, setSlot] = useState<ForecastDaypartSlot>(currentSlot());
  const [reading, setReading] = useState<ForecastDaypartReading | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!access.allowed || !chartData) return;
    let alive = true;
    setReading(null);
    setLoading(true);
    void getFullDaypartForecast(profile, chartData, slot, { accessTier: 'premium', chartId: chartId ?? null })
      .then(({ reading: r }) => { if (alive) setReading(r); })
      .catch(() => { /* non-critical */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [access.allowed, chartData, slot, profile, chartId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mt-3 rounded-[24px] border border-[#EAE3F1] bg-white p-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9A93A3]">
        {language === 'ru' ? 'Таймлайн дня' : 'Day timeline'}
      </p>

      {!access.allowed ? (
        <div className="mt-3">
          <p className="text-[13px] leading-relaxed text-[#50465E]">
            {access.status === 'needs_chart'
              ? (language === 'ru' ? 'Создай карту, чтобы видеть прогноз на утро, день и вечер.' : 'Create a chart to see morning, day and evening.')
              : (language === 'ru' ? 'Прогноз по частям дня — в Premium.' : 'Part-of-day forecast is in Premium.')}
          </p>
          <button
            type="button"
            onClick={access.status === 'needs_chart' ? onNeedChart : onRequestPremium}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#7B5CF6] px-4 py-2.5 text-[13px] font-bold text-white"
          >
            <Sparkles size={15} />
            {access.status === 'needs_chart'
              ? (language === 'ru' ? 'Создать карту' : 'Create chart')
              : (language === 'ru' ? 'Открыть Premium' : 'Unlock Premium')}
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex gap-2">
            {SLOTS.map((s) => {
              const on = slot === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => { lumiaSelectionHaptic(); setSlot(s.key); }}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border py-2 text-[13px] font-semibold transition-colors ${
                    on ? 'border-[#7B5CF6] bg-[#7B5CF6] text-white' : 'border-[#EAE3F1] bg-white text-[#50465E]'
                  }`}
                >
                  <span>{s.emoji}</span>
                  {language === 'ru' ? s.ru : s.en}
                </button>
              );
            })}
          </div>
          {loading ? (
            <div className="mt-4 h-16 animate-pulse rounded-[16px] bg-black/[0.05]" aria-busy="true" />
          ) : reading ? (
            <div className="mt-3">
              <h3 className="font-lumiaHomeDisplay text-[18px] font-bold leading-tight text-[#1E1230]">{reading.headline}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#50465E]">{reading.summary}</p>
              {reading.guidance ? (
                <div className="mt-2 rounded-[14px] bg-[#F6F3FB] px-4 py-3 text-[13px] leading-relaxed text-[#3D3D3D]">
                  {reading.guidance}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </motion.div>
  );
}
