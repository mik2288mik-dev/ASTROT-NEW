import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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

const AX_START = 6;   // ось дня начинается с 6:00
const AX_END = 24;    // и заканчивается в 24:00
const AX_SPAN = AX_END - AX_START;

/* час → позиция в % по оси дня (с клампом в [6,24]) */
function pct(hour: number): number {
  const clamped = Math.max(AX_START, Math.min(AX_END, hour));
  return ((clamped - AX_START) / AX_SPAN) * 100;
}

/* компактный диапазон "12–15" для правой колонки */
function fmtRange(start: number, end: number): string {
  const h = (v: number) => String(Math.round(v)).padStart(2, '0');
  return `${h(start)}–${h(end)}`;
}

type Row = { action: typeof ACTIONS[number]; rec: ActionTimingRecommendation; start: number; end: number };

function ActionTracks({ rows, nowH, ru, reduce }: { rows: Row[]; nowH: number; ru: boolean; reduce: boolean | null }) {
  const best = rows.find((r) => r.rec.state === 'now')
    || [...rows].sort((a, b) => ((a.start - nowH + 24) % 24) - ((b.start - nowH + 24) % 24))[0];
  const nowLeft = pct(nowH);

  return (
    <div className="awt">
      <div className="awt-hero">
        <span className="awt-hero-k">{ru ? 'сейчас лучше' : 'best now'}</span>
        <span className="awt-hero-a" style={{ color: best?.action.color }}>{ru ? best?.action.ru : best?.action.en}</span>
        {best?.rec.bestWindow?.label ? <span className="awt-hero-w">{best.rec.bestWindow.label}</span> : null}
      </div>

      <div className="awt-axis" aria-hidden>
        <span />
        <div className="awt-axis-track">
          {[6, 12, 18, 24].map((h) => (
            <span key={h} className="awt-axis-tick" style={{ left: `${pct(h)}%` }}>{h}</span>
          ))}
        </div>
        <span />
      </div>

      <div className="awt-rows">
        {rows.map((r, i) => {
          const left = pct(r.start);
          const width = Math.max(6, pct(r.end) - left);
          const isNow = r.rec.state === 'now';
          return (
            <div className="awt-row" key={r.action.key}>
              <span className="awt-name">{ru ? r.action.ru : r.action.en}</span>
              <div className="awt-track">
                <motion.div
                  className="awt-seg"
                  style={{ left: `${left}%`, background: r.action.color }}
                  initial={reduce ? false : { width: 0, opacity: 0.4 }}
                  animate={{ width: `${width}%`, opacity: 1 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.5, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
                />
                <span className="awt-now" style={{ left: `${nowLeft}%` }} />
              </div>
              <span className={`awt-time${isNow ? ' awt-time--now' : ''}`}>
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
      <div className="aw-mini">
        <span className="aw-mini-dot" style={{ background: best?.action.color }} />
        <span className="aw-mini-label">{isNow ? (ru ? 'Сейчас лучше' : 'Best now') : (ru ? 'Скоро лучше' : 'Next best')}</span>
        <span className="aw-mini-action" style={{ color: best?.action.color }}>{ru ? best?.action.ru : best?.action.en}</span>
        {best?.rec.bestWindow?.label ? <span className="aw-mini-win">{best.rec.bestWindow.label}</span> : null}
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
        <ActionTracks rows={rows} nowH={nowH} ru={ru} reduce={reduce} />
      )}
    </section>
  );
}
