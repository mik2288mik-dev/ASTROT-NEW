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
};

const ACTIONS: Array<{ key: ActionTimingKey; ru: string; en: string; color: string }> = [
  { key: 'message', ru: 'Написать', en: 'Message', color: '#5BB6EC' },
  { key: 'serious_talk', ru: 'Разговор', en: 'Talk', color: '#A98CEC' },
  { key: 'purchase', ru: 'Покупка', en: 'Purchase', color: '#FF7E8B' },
  { key: 'work', ru: 'Работа', en: 'Work', color: '#34C39A' },
];

const STATE_LABEL: Record<string, { ru: string; en: string }> = {
  now: { ru: 'сейчас', en: 'now' },
  later: { ru: 'позже', en: 'later' },
  no_edge: { ru: 'ровно', en: 'flat' },
};

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

const SIZE = 200;
const CENTER = SIZE / 2;
const RADII = [84, 69, 54, 39]; // кольцо на каждое действие

function polar(r: number, hour: number): [number, number] {
  const a = ((hour / 24) * 360 - 90) * (Math.PI / 180);
  return [CENTER + r * Math.cos(a), CENTER + r * Math.sin(a)];
}

function arcPath(r: number, startH: number, endH: number): string {
  const span = (endH - startH + 24) % 24 || 24;
  const [x1, y1] = polar(r, startH);
  const [x2, y2] = polar(r, startH + span);
  const large = span > 12 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

type Row = { action: typeof ACTIONS[number]; rec: ActionTimingRecommendation; start: number; end: number };

function ActionDial({ rows, nowH, ru, reduce }: { rows: Row[]; nowH: number; ru: boolean; reduce: boolean | null }) {
  const [nx, ny] = polar(92, nowH);
  const best = rows.find((r) => r.rec.state === 'now')
    || [...rows].sort((a, b) => ((a.start - nowH + 24) % 24) - ((b.start - nowH + 24) % 24))[0];

  return (
    <div className="dwd">
      <div className="dwd-dial">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="dwd-svg" aria-hidden>
          {[0, 6, 12, 18].map((h) => {
            const [lx, ly] = polar(96, h);
            return <text key={h} x={lx} y={ly + 3} className="dwd-tick" textAnchor="middle">{h}</text>;
          })}
          {rows.map((r, i) => {
            const radius = RADII[i] ?? 39;
            return (
              <g key={r.action.key}>
                <circle cx={CENTER} cy={CENTER} r={radius} fill="none" stroke="var(--fresh-surface)" strokeWidth="6" />
                <motion.path
                  d={arcPath(radius, r.start, r.end)}
                  fill="none"
                  stroke={r.action.color}
                  strokeWidth="6"
                  strokeLinecap="round"
                  initial={reduce ? false : { pathLength: 0, opacity: 0.5 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.7, delay: 0.07 * i, ease: [0.22, 1, 0.36, 1] }}
                />
              </g>
            );
          })}
          {/* стрелка «сейчас» */}
          <line x1={CENTER} y1={CENTER} x2={nx} y2={ny} stroke="var(--fresh-text)" strokeWidth="2" strokeLinecap="round" />
          <circle cx={CENTER} cy={CENTER} r="3.5" fill="var(--fresh-text)" />
        </svg>
        <div className="dwd-center">
          <div className="dwd-center-kicker">{ru ? 'сейчас лучше' : 'best now'}</div>
          <div className="dwd-center-action" style={{ color: best?.action.color }}>{ru ? best?.action.ru : best?.action.en}</div>
          <div className="dwd-center-win">{best?.rec.bestWindow?.label}</div>
        </div>
      </div>

      <div className="dwd-legend">
        {rows.map((r) => (
          <div key={r.action.key} className="dwd-leg">
            <span className="dwd-leg-dot" style={{ background: r.action.color }} />
            <span className="dwd-leg-name">{ru ? r.action.ru : r.action.en}</span>
            <span className="dwd-leg-win">{r.rec.bestWindow?.label}</span>
            <span className="dwd-leg-state" style={{ color: r.rec.state === 'now' ? '#1f9e6e' : 'var(--fresh-muted)' }}>
              {ru ? STATE_LABEL[r.rec.state]?.ru : STATE_LABEL[r.rec.state]?.en}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActionWindows({ profile, chartData, chartId, onOpenChart, onRequestPremium }: Props) {
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
        <div className="dwd-skeleton" />
      ) : (
        <ActionDial rows={rows} nowH={nowH} ru={ru} reduce={reduce} />
      )}
    </section>
  );
}
