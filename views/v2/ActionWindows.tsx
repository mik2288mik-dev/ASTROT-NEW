import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { NatalChartData, TodayAssistantHomeResult, UserProfile } from '../../types';
import { hasActivePremium, hasNatalChart } from '../../lib/accessMatrix';
import { getCachedTodayAssistantHome, getTodayAssistantHome } from '../../services/astrologyService';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { ChevronRightIcon } from '../../components/icons/UiIcons';

type Props = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onOpenChart?: () => void;
  onRequestPremium?: () => void;
  /** Компактный блок-тоггл для главной (под луной). */
  compact?: boolean;
};

export type PulsePoint = { hour: number; score: number };

export function nowHourIn(timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return (h % 24) + m / 60;
  } catch {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }
}

export function scoreColor(s: number): string {
  return s >= 70 ? '#34C39A' : s >= 50 ? '#5BB6EC' : s >= 35 ? '#F5A623' : '#9AA0A6';
}
export function scoreLabel(s: number, ru: boolean): string {
  if (s >= 78) return ru ? 'отличный день' : 'great day';
  if (s >= 58) return ru ? 'хороший день' : 'good day';
  if (s >= 42) return ru ? 'ровный день' : 'steady day';
  return ru ? 'спокойный день' : 'calm day';
}

/* Кривая дня: плавный график «энергии» по часам (0–24) с маркером «сейчас». Цвет — по оценке дня. */
export function DayCurve({ points, nowH, color, reduce }: { points: PulsePoint[]; nowH: number; color: string; reduce: boolean | null }) {
  const W = 300;
  const H = 72;
  const pad = 8;
  const sorted = [...points].filter((p) => Number.isFinite(p.hour) && Number.isFinite(p.score)).sort((a, b) => a.hour - b.hour);
  if (sorted.length < 2) return null;
  const x = (h: number) => pad + (Math.max(0, Math.min(24, h)) / 24) * (W - 2 * pad);
  const y = (s: number) => pad + (1 - Math.max(0, Math.min(100, s)) / 100) * (H - 2 * pad);
  const line = sorted.map((p, i) => `${i ? 'L' : 'M'} ${x(p.hour).toFixed(1)} ${y(p.score).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(sorted[sorted.length - 1].hour).toFixed(1)} ${H - pad} L ${x(sorted[0].hour).toFixed(1)} ${H - pad} Z`;
  const nx = x(nowH);
  const nowPt = sorted.reduce((b, p) => (Math.abs(p.hour - nowH) < Math.abs(b.hour - nowH) ? p : b), sorted[0]);
  return (
    <div className="dp-curve">
      <svg viewBox={`0 0 ${W} ${H}`} className="dp-curve-svg" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="dp-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.24" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#dp-grad)" />
        <motion.path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
        <line x1={nx} y1={pad} x2={nx} y2={H - pad} stroke="var(--fresh-text)" strokeWidth="1" opacity="0.4" />
        <circle cx={nx} cy={y(nowPt.score)} r="4" fill={color} stroke="#fff" strokeWidth="2" />
      </svg>
      <div className="dp-axis"><span>6:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
    </div>
  );
}

/* Оценка дня: крупное число 0–100 + кривая дня по часам. Без текстовых «советов» и календарей —
   только честная картинка по карте. */
function DayPulse({ points, score, nowH, ru, reduce }: { points: PulsePoint[]; score: number; nowH: number; ru: boolean; reduce: boolean | null }) {
  const color = scoreColor(score);
  return (
    <div className="dp">
      <div className="dp-top">
        <div className="dp-score" style={{ color }}>{score}<span className="dp-score-max">/100</span></div>
        <div className="dp-top-r">
          <div className="dp-label" style={{ color }}>{scoreLabel(score, ru)}</div>
          <div className="dp-kicker">{ru ? 'оценка дня по твоей карте' : 'day score from your chart'}</div>
        </div>
      </div>
      <DayCurve points={points} nowH={nowH} color={color} reduce={reduce} />
    </div>
  );
}

export function ActionWindows({ profile, chartData, chartId, onOpenChart, onRequestPremium, compact }: Props) {
  const ru = profile.language !== 'en';
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
  const premium = hasActivePremium(profile);

  const [home, setHome] = useState<TodayAssistantHomeResult | null>(
    () => (premium && hasChart ? getCachedTodayAssistantHome(profile, chartId, undefined, chartData) : null),
  );

  useEffect(() => {
    if (!premium || !hasChart || !chartData) return;
    const cached = getCachedTodayAssistantHome(profile, chartId, undefined, chartData);
    if (cached) { setHome(cached); return; }
    let alive = true;
    void getTodayAssistantHome(profile, chartData, chartId)
      .then((r) => { if (alive) setHome(r); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [premium, hasChart, chartData, chartId, profile]);

  const timezone = home && home.status === 'ready' ? home.pulse.timezone : 'Europe/Moscow';
  const [nowH, setNowH] = useState(() => nowHourIn(timezone));
  useEffect(() => {
    setNowH(nowHourIn(timezone));
    const id = window.setInterval(() => setNowH(nowHourIn(timezone)), 60000);
    return () => window.clearInterval(id);
  }, [timezone]);

  const points = useMemo<PulsePoint[]>(
    () => (home && home.status === 'ready' ? home.pulse.points.map((p) => ({ hour: p.hour, score: p.score })) : []),
    [home],
  );
  const dayScore = useMemo(
    () => (points.length ? Math.round(points.reduce((s, p) => s + p.score, 0) / points.length) : null),
    [points],
  );

  if (compact) {
    if (!hasChart) {
      return (
        <button type="button" className="aw-mini aw-mini--cta" onClick={() => { lumiaSelectionHaptic(); onOpenChart?.(); }}>
          <span className="aw-mini-label">{ru ? 'Оценка дня' : 'Day score'}</span>
          <span className="aw-mini-cta">{ru ? 'Создать карту' : 'Create chart'}<ChevronRightIcon size={14} /></span>
        </button>
      );
    }
    if (!premium) {
      return (
        <button type="button" className="aw-mini aw-mini--cta" onClick={() => { lumiaSelectionHaptic(); onRequestPremium?.(); }}>
          <span className="aw-mini-label">{ru ? 'Оценка дня' : 'Day score'}</span>
          <span className="aw-mini-cta">Premium<ChevronRightIcon size={14} /></span>
        </button>
      );
    }
    if (dayScore == null) {
      return <div className="aw-mini aw-mini--load">{ru ? 'Считаю оценку дня…' : 'Scoring your day…'}</div>;
    }
    const color = scoreColor(dayScore);
    return (
      <div className="aw-mini-wrap">
        <button
          type="button"
          className="dp-toggle"
          onClick={() => { lumiaSelectionHaptic(); setExpanded((v) => !v); }}
          aria-expanded={expanded}
        >
          <span className="dp-toggle-k">{ru ? 'Оценка дня' : 'Day score'}</span>
          <span className="dp-toggle-score" style={{ color }}>{dayScore}<span className="dp-toggle-max">/100</span></span>
          <span className="dp-toggle-label">{scoreLabel(dayScore, ru)}</span>
          <svg className="aw-mini-chev" data-open={expanded ? 'true' : 'false'} width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <AnimatePresence initial={false}>
          {expanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <DayPulse points={points} score={dayScore} nowH={nowH} ru={ru} reduce={reduce} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <section className="aw">
      <div className="aw-head">
        <div className="aw-title">{ru ? 'Оценка дня' : 'Day score'}</div>
        <div className="aw-sub">{ru ? 'Как сегодня по твоей карте' : 'How today looks from your chart'}</div>
      </div>

      {!hasChart ? (
        <button type="button" className="aw-gate" onClick={() => { lumiaSelectionHaptic(); onOpenChart?.(); }}>
          <span>{ru ? 'Нужна твоя натальная карта' : 'Your natal chart is needed'}</span>
          <span className="aw-gate-cta">{ru ? 'Создать' : 'Create'}<ChevronRightIcon size={15} /></span>
        </button>
      ) : !premium ? (
        <button type="button" className="aw-gate" onClick={() => { lumiaSelectionHaptic(); onRequestPremium?.(); }}>
          <span>{ru ? 'Оценка дня по карте — в Premium' : 'Day score from your chart — in Premium'}</span>
          <span className="aw-gate-cta">Premium<ChevronRightIcon size={15} /></span>
        </button>
      ) : dayScore == null ? (
        <div className="awt-skeleton" />
      ) : (
        <DayPulse points={points} score={dayScore} nowH={nowH} ru={ru} reduce={reduce} />
      )}
    </section>
  );
}
