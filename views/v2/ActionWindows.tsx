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

const ACTIONS: Array<{ key: ActionTimingKey; ru: string; en: string }> = [
  { key: 'message', ru: 'Написать', en: 'Message' },
  { key: 'serious_talk', ru: 'Разговор', en: 'Talk' },
  { key: 'purchase', ru: 'Покупка', en: 'Purchase' },
  { key: 'work', ru: 'Работа', en: 'Work' },
];

const STATE_COLOR: Record<string, string> = {
  now: '#34C39A',     // зелёный — сейчас хорошо
  later: '#FF9B6A',   // янтарный — лучше позже
  no_edge: '#C2C9D4', // серый — без разницы
};

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

/* Текущий дробный час в нужной таймзоне (для живой метки «сейчас») */
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

function Row({ rec, label, nowH, reduce, ru, index }: {
  rec: ActionTimingRecommendation;
  label: string;
  nowH: number;
  reduce: boolean | null;
  ru: boolean;
  index: number;
}) {
  const color = STATE_COLOR[rec.state] || STATE_COLOR.no_edge;
  const start = toHour(rec.bestWindow?.start, 9);
  let end = toHour(rec.bestWindow?.end, start + 2);
  if (end <= start) end = 24; // окно «до конца дня» / переход через полночь
  const left = Math.max(0, Math.min(100, (start / 24) * 100));
  const width = Math.max(4, Math.min(100 - left, ((end - start) / 24) * 100));
  const isLive = nowH >= start && nowH < end;

  return (
    <div className="dw-row">
      <div className="dw-row-top">
        <span className="dw-row-label">{label}</span>
        <span className="dw-row-meta">
          <span className="dw-row-win">{rec.bestWindow?.label}</span>
          <span className="dw-row-dot" style={{ background: color }} />
          <span className="dw-row-state" style={{ color }}>{ru ? STATE_LABEL[rec.state]?.ru : STATE_LABEL[rec.state]?.en}</span>
        </span>
      </div>
      <div className="dw-track">
        <motion.div
          className="dw-band"
          style={{ left: `${left}%`, background: color }}
          initial={reduce ? false : { width: 0, opacity: 0.4 }}
          animate={{ width: `${width}%`, opacity: 1 }}
          transition={reduce ? { duration: 0 } : { duration: 0.6, delay: 0.06 * index, ease: [0.22, 1, 0.36, 1] }}
        />
        {isLive ? <span className="dw-band-live" style={{ left: `${left}%`, width: `${width}%`, borderColor: color }} /> : null}
        <span className="dw-track-now" style={{ left: `${Math.max(0, Math.min(100, (nowH / 24) * 100))}%` }} aria-hidden />
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

  // Источник данных — тот же today-assistant, что уже грузит главная (кэш тёплый).
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

  const rows = useMemo(() => {
    if (!home || home.status !== 'ready') return [];
    const byKey = new Map(home.quickActions.map((a) => [a.actionKey, a]));
    return ACTIONS.map((a) => ({ action: a, rec: byKey.get(a.key) })).filter((r): r is { action: typeof ACTIONS[number]; rec: ActionTimingRecommendation } => !!r.rec);
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
        <div className="dw-skeleton">
          {[0, 1, 2, 3].map((i) => <div key={i} className="dw-skeleton-row" />)}
        </div>
      ) : (
        <div className="dw">
          <div className="dw-nowcap" style={{ left: `${(nowH / 24) * 100}%` }} aria-hidden>{ru ? 'сейчас' : 'now'}</div>
          <div className="dw-rows">
            {rows.map(({ action, rec }, i) => (
              <Row key={action.key} rec={rec} label={ru ? action.ru : action.en} nowH={nowH} reduce={reduce} ru={ru} index={i} />
            ))}
          </div>
          <div className="dw-axis" aria-hidden>
            {[0, 6, 12, 18, 24].map((h) => <span key={h} style={{ left: `${(h / 24) * 100}%` }}>{h}ч</span>)}
          </div>
        </div>
      )}
    </section>
  );
}
