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

const ACTIONS: Array<{ key: ActionTimingKey; ru: string; en: string; dru: string; den: string; color: string }> = [
  { key: 'message', ru: 'Написать', en: 'Message', dru: 'сообщения и переписка', den: 'texts & chats', color: '#5BB6EC' },
  { key: 'serious_talk', ru: 'Разговор', en: 'Serious talk', dru: 'важный разговор', den: 'an important talk', color: '#A98CEC' },
  { key: 'purchase', ru: 'Покупка', en: 'Purchase', dru: 'покупки и траты', den: 'buying & spending', color: '#FF7E8B' },
  { key: 'work', ru: 'Работа', en: 'Work', dru: 'дела и задачи', den: 'tasks & focus', color: '#34C39A' },
];

const DAY_START = 6;
const DAY_END = 24;
const dayPct = (h: number) => ((Math.max(DAY_START, Math.min(DAY_END, h)) - DAY_START) / (DAY_END - DAY_START)) * 100;

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

/* Понятный график дня: ОДНА шкала 6–24, лучшие окна — цветными блоками (по дорожкам, чтобы
   не наезжали), вертикальный маркер «сейчас». Ниже — расписание списком (время · действие). */
function ActionTracks({ rows, nowH, ru, reduce, hideHero }: { rows: Row[]; nowH: number; ru: boolean; reduce: boolean | null; hideHero?: boolean }) {
  const showNow = nowH >= DAY_START && nowH <= DAY_END;
  const hhh = (h: number) => `${String(Math.round(h)).padStart(2, '0')}:00`;
  const nowGood = rows.find((r) => r.rec.state === 'now');
  const upcoming = [...rows].filter((r) => r.start > nowH && r.end > nowH).sort((a, b) => a.start - b.start)[0];

  // раскладка по дорожкам (макс 2), чтобы блоки не накладывались
  const laneEnd: number[] = [];
  const blocks = [...rows].sort((a, b) => a.start - b.start).map((r) => {
    let lane = laneEnd.findIndex((e) => r.start >= e);
    if (lane === -1) lane = laneEnd.length;
    laneEnd[lane] = r.end;
    return { ...r, lane: Math.min(lane, 1) };
  });
  const lanes = Math.min(2, Math.max(1, laneEnd.length));
  const schedule = [...rows].sort((a, b) => a.start - b.start);

  return (
    <div className="awt">
      {hideHero ? null : (
        <div className="aw-verdict">
          <span className="aw-verdict-k">{ru ? 'Сейчас' : 'Now'}</span>
          {nowGood ? (
            <span className="aw-verdict-main">
              {ru ? 'хорошо для ' : 'good for '}
              <b style={{ color: nowGood.action.color }}>{(ru ? nowGood.action.ru : nowGood.action.en).toLowerCase()}</b>
            </span>
          ) : (
            <span className="aw-verdict-main">
              {ru ? 'спокойно' : 'calm'}
              {upcoming ? (
                <>
                  {ru ? ' · скоро ' : ' · soon '}
                  <b style={{ color: upcoming.action.color }}>{(ru ? upcoming.action.ru : upcoming.action.en).toLowerCase()}</b>
                  {ru ? ' в ' : ' at '}{hhh(upcoming.start)}
                </>
              ) : null}
            </span>
          )}
        </div>
      )}

      <div className="awg">
        <div className="awg-grid" style={{ height: lanes * 26 + 6 }}>
          {[12, 18].map((h) => <span key={h} className="awg-vline" style={{ left: `${dayPct(h)}%` }} />)}
          {blocks.map((r) => {
            const left = dayPct(r.start);
            const width = Math.max(7, dayPct(r.end) - left);
            const passed = r.rec.state !== 'now' && r.end <= nowH;
            return (
              <motion.div
                key={r.action.key}
                className="awg-block"
                style={{ left: `${left}%`, width: `${width}%`, top: r.lane * 26, background: r.action.color }}
                initial={reduce ? false : { scaleX: 0.7, opacity: 0 }}
                animate={{ scaleX: 1, opacity: passed ? 0.45 : 1 }}
                transition={reduce ? { duration: 0 } : { duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}
          {showNow ? <span className="awg-now" style={{ left: `${dayPct(nowH)}%` }} /> : null}
        </div>
        <div className="awg-axis"><span>6:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div>
      </div>

      <div className="awg-list">
        {schedule.map((r) => {
          const isNow = r.rec.state === 'now';
          const passed = !isNow && r.end <= nowH;
          const time = isNow ? (ru ? 'сейчас' : 'now') : `${passed ? (ru ? 'завтра ' : 'tmrw ') : ''}${fmtRange(r.start, r.end)}`;
          return (
            <div className={`awg-li${isNow ? ' awg-li--now' : ''}`} key={r.action.key}>
              <span className="awg-li-time" style={{ color: isNow ? r.action.color : undefined }}>{time}</span>
              <span className="awg-li-dot" style={{ background: r.action.color }} />
              <span className="awg-li-name">{ru ? r.action.ru : r.action.en}</span>
              <span className="awg-li-desc">{ru ? r.action.dru : r.action.den}</span>
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

  const currentPoint = home && home.status === 'ready' ? home.pulse.currentPoint : null;
  const nowTitle = currentPoint?.title;

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
    // Честный «сейчас»: если что-то реально хорошо прямо сейчас — показываем это
    // дело; иначе — простое состояние момента (без «лучше» про прошедшее окно).
    const nowGood = rows.find((r) => r.rec.state === 'now');
    return (
      <div className="aw-mini-wrap">
        <button
          type="button"
          className="aw-mini aw-mini--toggle"
          onClick={() => { lumiaSelectionHaptic(); setExpanded((v) => !v); }}
          aria-expanded={expanded}
        >
          <span className="aw-mini-dot" style={{ background: nowGood?.action.color || '#6366F1' }} />
          <span className="aw-mini-label">{nowGood ? (ru ? 'Сейчас хорошо' : 'Good now') : (ru ? 'Сейчас' : 'Now')}</span>
          <span className="aw-mini-action" style={{ color: nowGood?.action.color }}>
            {nowGood ? (ru ? nowGood.action.ru : nowGood.action.en) : (nowTitle || (ru ? 'спокойно' : 'calm'))}
          </span>
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
              <ActionTracks rows={rows} nowH={nowH} ru={ru} reduce={reduce} hideHero />
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
        <ActionTracks rows={rows} nowH={nowH} ru={ru} reduce={reduce} />
      )}
    </section>
  );
}
