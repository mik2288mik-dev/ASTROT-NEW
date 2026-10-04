import { useEffect, useState } from 'react';
import { LiveSky } from '../home/LiveSky';
import { ChevronRight } from 'lucide-react';
import {
  buildFutureMonth,
  formatDayRu,
  natalPointsFromChart,
  type CalendarDay,
  type PersonalEvent,
} from '../../lib/futureCalendar';
import { loadExploreCharts, peekExploreCharts } from './exploreCharts';
import type { ChartListItem } from '../../services/storageService';

type FutureInviteCardProps = {
  userId: string;
  todayKey: string;
  timezone: string;
  premium: boolean;
  onOpen: () => void;
};

let inviteEngine: Promise<typeof import('astronomy-engine')> | null = null;

type Preview = { week: CalendarDay[]; next: PersonalEvent | null; count: number };

function addDays(dayKey: string, days: number): string {
  const date = new Date(`${dayKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

function importantDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} важный день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} важных дня`;
  return `${count} важных дней`;
}

/** Home invitation into «Будущее»: the next personal day and a week strip from the real calendar. */
export function FutureInviteCard({ userId, todayKey, timezone, premium, onOpen }: FutureInviteCardProps) {
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let active = true;
    inviteEngine ??= import('astronomy-engine');
    const render = (engine: typeof import('astronomy-engine'), charts: ChartListItem[]) => {
        const natal = natalPointsFromChart(charts.find((chart) => chart.is_primary)?.chart_data ?? null);
        const [year, month] = todayKey.split('-').map(Number);
        const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
        const months = [buildFutureMonth(engine, year, month, natal, timezone), buildFutureMonth(engine, next.year, next.month, natal, timezone)];
        const horizon = addDays(todayKey, 30);
        const days = months.flatMap((item) => item.days);
        const upcoming = months.flatMap((item) => item.personalEvents)
          .filter((event) => event.dayKey > todayKey && event.dayKey <= horizon);
        if (!active) return;
        setPreview({
          week: Array.from({ length: 7 }, (_, index) => days.find((day) => day.dayKey === addDays(todayKey, index))).filter((day): day is CalendarDay => Boolean(day)),
          next: upcoming[0] ?? null,
          count: new Set(upcoming.map((event) => event.dayKey)).size,
        });
    };
    void inviteEngine
      .then((engine) => {
        const saved = peekExploreCharts(userId);
        if (saved) render(engine, saved);
        return loadExploreCharts(userId).then((charts) => render(engine, charts));
      })
      .catch(() => { inviteEngine = null; });
    return () => { active = false; };
  }, [timezone, todayKey, userId]);

  if (!preview) return null;

  return (
    <section className="future-invite" aria-labelledby="future-invite-title">
      <button type="button" className="future-invite-card is-sky" onClick={onOpen}>
        <LiveSky sunAltitude={40} className="future-invite-sky" />
        <span className="future-invite-kicker">Будущее</span>
        <span id="future-invite-title" className="future-invite-title">
          {preview.count ? `${importantDays(preview.count)} для тебя в ближайший месяц` : 'Календарь твоего месяца вперёд'}
        </span>
        {preview.next ? (
          <span className="future-invite-next">
            Ближайший — {formatDayRu(preview.next.dayKey)}: {preview.next.headline}
            {premium ? '' : '. Что это значит — в NEBO+'}
          </span>
        ) : null}
        <span className="future-invite-week" aria-hidden="true">
          {preview.week.map((day) => (
            <span key={day.dayKey} className={day.dayKey === todayKey ? 'is-today' : undefined}>
              <small>{WEEKDAYS[day.weekday]}</small>
              <b>{day.day}</b>
              <i className={day.tone && premium ? `is-${day.tone}` : day.personal.length ? 'is-hidden' : ''} />
            </span>
          ))}
        </span>
        <span className="future-invite-cta">Открыть календарь <ChevronRight size={16} aria-hidden="true" /></span>
      </button>
    </section>
  );
}
