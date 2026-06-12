import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type {
  ActionTimingKey,
  ActionTimingRecommendation,
  ActionTimingState,
  NatalChartData,
  UserProfile,
} from '../../../types';
import { getActionTimingRecommendation } from '../../../services/astrologyService';
import { lumiaSelectionHaptic } from '../../../lib/haptics';
import { RadialGauge } from './gauges';

const ACTIONS: { key: ActionTimingKey; emoji: string; ru: string; en: string }[] = [
  { key: 'message', emoji: '✉️', ru: 'Сообщение', en: 'Message' },
  { key: 'serious_talk', emoji: '🗣️', ru: 'Разговор', en: 'Talk' },
  { key: 'work', emoji: '💼', ru: 'Работа', en: 'Work' },
  { key: 'money', emoji: '💸', ru: 'Деньги', en: 'Money' },
  { key: 'purchase', emoji: '🛍️', ru: 'Покупка', en: 'Buy' },
  { key: 'rest', emoji: '🌿', ru: 'Отдых', en: 'Rest' },
];

const STATE_META: Record<ActionTimingState, { ru: string; en: string; color: string }> = {
  now: { ru: 'Сейчас', en: 'Now', color: '#3FB7A0' },
  later: { ru: 'Позже', en: 'Later', color: '#F6A23F' },
  no_edge: { ru: 'Без разницы', en: 'No edge', color: '#9A93A3' },
};

const pct = (n: number) => (n <= 1 ? Math.round(n * 100) : Math.round(n));

function hourFrac(t: string): number {
  const m = /(\d{1,2}):(\d{2})/.exec(String(t || ''));
  if (!m) return 0;
  return Math.max(0, Math.min(1, (Number(m[1]) + Number(m[2]) / 60) / 24));
}

/** #3 — best time to act. Generic timing is free; chart makes it personal. */
export function ActionTiming({
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
  const [active, setActive] = useState<ActionTimingKey | null>(null);
  const [rec, setRec] = useState<ActionTimingRecommendation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const pick = (key: ActionTimingKey) => {
    lumiaSelectionHaptic();
    setActive(key);
    setRec(null);
    setError(false);
    setLoading(true);
    void getActionTimingRecommendation(profile, chartData, chartId ?? null, key)
      .then((r) => setRec(r))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  const state = rec ? STATE_META[rec.state] : null;
  const start = rec ? hourFrac(rec.bestWindow.start) : 0;
  const end = rec ? hourFrac(rec.bestWindow.end) : 0;
  const left = Math.min(start, end) * 100;
  const width = Math.max(4, Math.abs(end - start) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="mt-3 rounded-[24px] border border-[#EAE3F1] bg-white p-5"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9A93A3]">
        {language === 'ru' ? 'Когда действовать' : 'When to act'}
      </p>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {ACTIONS.map((a) => {
          const on = active === a.key;
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => pick(a.key)}
              className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-semibold transition-colors ${
                on ? 'border-[#7B5CF6] bg-[#7B5CF6] text-white' : 'border-[#EAE3F1] bg-white text-[#50465E]'
              }`}
            >
              <span>{a.emoji}</span>
              {language === 'ru' ? a.ru : a.en}
            </button>
          );
        })}
      </div>

      {!active ? (
        <p className="mt-3 text-[13px] leading-relaxed text-[#9A93A3]">
          {language === 'ru' ? 'Выбери, для чего ищешь лучшее время.' : 'Pick what you want the best time for.'}
        </p>
      ) : loading ? (
        <div className="mt-4 h-16 animate-pulse rounded-[16px] bg-black/[0.05]" aria-busy="true" />
      ) : error || !rec || !state ? (
        <p className="mt-3 text-[13px] text-[#9A93A3]">
          {language === 'ru' ? 'Не удалось рассчитать. Попробуй ещё раз.' : 'Could not calculate. Try again.'}
        </p>
      ) : (
        <div className="mt-4 flex gap-4">
          <RadialGauge value={pct(rec.confidence)} size={76} stroke={9} color={state.color} track="#EFEAF6">
            <span className="font-lumiaHomeDisplay text-[17px] font-bold leading-none text-[#1E1230]">{pct(rec.confidence)}</span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.06em] text-[#9A93A3]">
              {language === 'ru' ? 'увер.' : 'conf.'}
            </span>
          </RadialGauge>
          <div className="min-w-0 flex-1">
            <span
              className="inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
              style={{ background: state.color }}
            >
              {language === 'ru' ? state.ru : state.en}
            </span>
            <p className="mt-1.5 text-[13px] font-semibold text-[#1E1230]">{rec.bestWindow.label}</p>
            {/* 24h timeline with the best window highlighted */}
            <div className="relative mt-2 h-2.5 w-full overflow-hidden rounded-full bg-[#EFEAF6]">
              <motion.div
                className="absolute top-0 h-full rounded-full"
                style={{ background: state.color, left: `${left}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${width}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <p className="mt-2 line-clamp-2 text-[12px] leading-snug text-[#50465E]">{rec.summary}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
