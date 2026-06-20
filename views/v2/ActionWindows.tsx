import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import type { ActionTimingKey, ActionTimingRecommendation, NatalChartData, TodayAssistantHomeResult, UserProfile } from '../../types';
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
  /** Компактная одна строка «Сейчас лучше: X · время» — для верхнего блока главной. */
  compact?: boolean;
};

const ACTIONS: Array<{ key: ActionTimingKey; ru: string; en: string; color: string }> = [
  { key: 'message', ru: 'Написать', en: 'Message', color: '#5BB6EC' },
  { key: 'serious_talk', ru: 'Разговор', en: 'Talk', color: '#A98CEC' },
  { key: 'purchase', ru: 'Покупка', en: 'Purchase', color: '#FF7E8B' },
  { key: 'work', ru: 'Работа', en: 'Work', color: '#34C39A' },
];

/* "HH:MM" → дробный час (13:30 → 13.5) */
function toHour(value: string | undefined, fallback: number): number {
  if (!value || value.length < 2) return fallback;
  const h = Number(value.slice(0, 2));
  const m = Number(value.slice(3, 5));
  if (!Number.isFinite(h)) return fallback;
  return h + (Number.isFinite(m) ? m / 60 : 0);
}

function nowHourIn(timeZone: string): number {
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

/* компактный диапазон "12–15" для правой колонки */
function fmtRange(start: number, end: number): string {
  const h = (v: number) => String(Math.round(v)).padStart(2, '0');
  return `${h(start)}–${h(end)}`;
}

type Row = { action: typeof ACTIONS[number]; rec: ActionTimingRecommendation; start: number; end: number };
type PulsePoint = { hour: number; score: number };

/* Мини «линия дня»: плавная кривая пульса, нормализованная к своим min/max (чтобы разброс
   был виден, а не плоская линия), с явными маркерами ПИК и СПАД + подписью. */
function MiniPulseLine({ points, nowH, accent, reduce, ru }: { points: PulsePoint[]; nowH: number; accent: string; reduce: boolean | null; ru: boolean }) {
  const W = 300;
  const H = 60;
  const pad = 7;
  const sorted = [...points].filter((p) => Number.isFinite(p.hour) && Number.isFinite(p.score)).sort((a, b) => a.hour - b.hour);
  if (sorted.length < 2) return null;
  const scores = sorted.map((p) => p.score);
  const minS = Math.min(...scores);
  const span = Math.max(1, Math.max(...scores) - minS);
  const x = (h: number) => pad + (Math.max(0, Math.min(24, h)) / 24) * (W - 2 * pad);
  // нормализация к собственному диапазону (с полями 12–88%) — даже малый разброс читаем
  const y = (s: number) => pad + (1 - (0.12 + ((s - minS) / span) * 0.76)) * (H - 2 * pad);
  const line = sorted.map((p, i) => `${i ? 'L' : 'M'} ${x(p.hour).toFixed(1)} ${y(p.score).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(sorted[sorted.length - 1].hour).toFixed(1)} ${H - pad} L ${x(sorted[0].hour).toFixed(1)} ${H - pad} Z`;
  const peak = sorted.reduce((b, p) => (p.score > b.score ? p : b), sorted[0]);
  const low = sorted.reduce((b, p) => (p.score < b.score ? p : b), sorted[0]);
  const nx = x(nowH);
  const hh = (h: number) => `${String(Math.round(h)).padStart(2, '0')}:00`;

  return (
    <div className="aw-line">
      <svg viewBox={`0 0 ${W} ${H}`} className="aw-line-svg" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="aw-line-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0.26" />
            <stop offset="1" stopColor={accent} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#aw-line-grad)" />
        <motion.path
          d={line}
          fill="none"
          stroke={accent}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
        <line x1={nx} y1={pad} x2={nx} y2={H - pad} stroke="var(--fresh-text)" strokeWidth="1" opacity="0.32" />
        <circle cx={x(low.hour)} cy={y(low.score)} r="3" fill="#fff" stroke={accent} strokeWidth="1.6" />
        <circle cx={x(peak.hour)} cy={y(peak.score)} r="3.6" fill={accent} stroke="#fff" strokeWidth="1.6" />
      </svg>
      <div className="aw-line-axis"><span>6</span><span>12</span><span>18</span><span>24</span></div>
      <div className="aw-line-legend">
        <span className="aw-line-peak"><i style={{ background: accent }} />{ru ? 'пик' : 'peak'} {hh(peak.hour)}</span>
        <span className="aw-line-low"><i style={{ borderColor: accent }} />{ru ? 'спад' : 'low'} {hh(low.hour)}</span>
      </div>
    </div>
  );
}

function ActionTracks({ rows, points, nowH, ru, reduce, hideHero }: { rows: Row[]; points: PulsePoint[]; nowH: number; ru: boolean; reduce: boolean | null; hideHero?: boolean }) {
  const best = rows.find((r) => r.rec.state === 'now')
    || [...rows].sort((a, b) => ((a.start - nowH + 24) % 24) - ((b.start - nowH + 24) % 24))[0];

  return (
    <div className="awt">
      {hideHero ? null : (
        <div className="awt-hero">
          <span className="awt-hero-k">{ru ? 'сейчас лучше' : 'best now'}</span>
          <span className="awt-hero-a" style={{ color: best?.action.color }}>{ru ? best?.action.ru : best?.action.en}</span>
          {best?.rec.bestWindow?.label ? <span className="awt-hero-w">{best.rec.bestWindow.label}</span> : null}
        </div>
      )}

      <MiniPulseLine points={points} nowH={nowH} accent={best?.action.color || '#6366F1'} reduce={reduce} ru={ru} />

      <div className="aw-windows">
        {rows.map((r) => {
          const isNow = r.rec.state === 'now';
          return (
            <div className={`aw-win${isNow ? ' aw-win--now' : ''}`} key={r.action.key}>
              <span className="aw-win-dot" style={{ background: r.action.color }} />
              <span className="aw-win-name">{ru ? r.action.ru : r.action.en}</span>
              <span className={`aw-win-time${isNow ? ' aw-win-time--now' : ''}`}>
                {isNow ? (ru ? 'сейчас' : 'now') : fmtRange(r.start, r.end)}
              </span>
            </div>
          );
        })}
      </div>
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

  const rows = useMemo<Row[]>(() => {
    if (!home || home.status !== 'ready') return [];
    const byKey = new Map(home.quickActions.map((a) => [a.actionKey, a]));
    return ACTIONS.map((action) => {
      const rec = byKey.get(action.key);
      if (!rec) return null;
      const start = toHour(rec.bestWindow?.start, 9);
      let end = toHour(rec.bestWindow?.end, start + 2);
      if (end <= start) end = (start + 2) % 24;
      return { action, rec, start, end };
    }).filter((r): r is Row => !!r);
  }, [home]);

  const points = useMemo<PulsePoint[]>(
    () => (home && home.status === 'ready' ? home.pulse.points.map((p) => ({ hour: p.hour, score: p.score })) : []),
    [home],
  );

  if (compact) {
    if (!hasChart) {
      return (
        <button type="button" className="aw-mini aw-mini--cta" onClick={() => { lumiaSelectionHaptic(); onOpenChart?.(); }}>
          <span className="aw-mini-label">{ru ? 'Окна дня' : 'Day windows'}</span>
          <span className="aw-mini-cta">{ru ? 'Создать карту' : 'Create chart'}<ChevronRightIcon size={14} /></span>
        </button>
      );
    }
    if (!premium) {
      return (
        <button type="button" className="aw-mini aw-mini--cta" onClick={() => { lumiaSelectionHaptic(); onRequestPremium?.(); }}>
          <span className="aw-mini-label">{ru ? 'Лучшее время дня' : 'Best time today'}</span>
          <span className="aw-mini-cta">Premium<ChevronRightIcon size={14} /></span>
        </button>
      );
    }
    if (rows.length === 0) {
      return <div className="aw-mini aw-mini--load">{ru ? 'Считаю окна дня…' : 'Calculating windows…'}</div>;
    }
    const best = rows.find((r) => r.rec.state === 'now')
      || [...rows].sort((a, b) => ((a.start - nowH + 24) % 24) - ((b.start - nowH + 24) % 24))[0];
    const isNow = best?.rec.state === 'now';
    return (
      <div className="aw-mini-wrap">
        <button
          type="button"
          className="aw-mini aw-mini--toggle"
          onClick={() => { lumiaSelectionHaptic(); setExpanded((v) => !v); }}
          aria-expanded={expanded}
        >
          <span className="aw-mini-dot" style={{ background: best?.action.color }} />
          <span className="aw-mini-label">{isNow ? (ru ? 'Сейчас лучше' : 'Best now') : (ru ? 'Лучше' : 'Best')}</span>
          <span className="aw-mini-action" style={{ color: best?.action.color }}>{ru ? best?.action.ru : best?.action.en}</span>
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
              <ActionTracks rows={rows} points={points} nowH={nowH} ru={ru} reduce={reduce} hideHero />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <section className="aw">
      <div className="aw-head">
        <div className="aw-title">{ru ? 'Окна дня' : 'Day windows'}</div>
        <div className="aw-sub">{ru ? 'Когда лучше действовать — по твоей карте' : 'When to act — from your chart'}</div>
      </div>

      {!hasChart ? (
        <button type="button" className="aw-gate" onClick={() => { lumiaSelectionHaptic(); onOpenChart?.(); }}>
          <span>{ru ? 'Нужна твоя натальная карта' : 'Your natal chart is needed'}</span>
          <span className="aw-gate-cta">{ru ? 'Создать' : 'Create'}<ChevronRightIcon size={15} /></span>
        </button>
      ) : !premium ? (
        <button type="button" className="aw-gate" onClick={() => { lumiaSelectionHaptic(); onRequestPremium?.(); }}>
          <span>{ru ? 'Лучшее время для действий — в Premium' : 'Best timing — in Premium'}</span>
          <span className="aw-gate-cta">Premium<ChevronRightIcon size={15} /></span>
        </button>
      ) : rows.length === 0 ? (
        <div className="awt-skeleton" />
      ) : (
        <ActionTracks rows={rows} points={points} nowH={nowH} ru={ru} reduce={reduce} />
      )}
    </section>
  );
}
