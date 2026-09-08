import React, { useMemo } from 'react';
import { getPersonalFutureTimelineStops, type PersonalFutureTimelineStop } from '../../lib/personalFutureForecastContract';
import styles from './NeboFutureTimeline.module.css';

type Selection = PersonalFutureTimelineStop;
type Props = Selection & {
  today: string;
  en: boolean;
  disabled?: boolean;
  onChange: (value: Selection) => void;
};

export function NeboFutureTimeline({ today, date, period, endDate, en, disabled = false, onChange }: Props) {
  const stops = useMemo(() => getPersonalFutureTimelineStops(today), [today]);
  const found = stops.findIndex((stop) => stop.date === date && stop.period === period && (period !== 'week' || !endDate || stop.endDate === endDate));
  const index = Math.max(0, found);
  const selected = stops[index];
  if (!selected) return null;

  const value = new Date(`${selected.date}T12:00:00Z`);
  const locale = en ? 'en-GB' : 'ru-RU';
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(value);
  const monthLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(value);
  const endLabel = selected.endDate ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${selected.endDate}T12:00:00Z`)) : '';
  const title = selected.period === 'month'
    ? (en ? `All of ${monthLabel} ${value.getUTCFullYear()}` : `${monthLabel} ${value.getUTCFullYear()} целиком`)
    : selected.period === 'week' ? `${dateLabel} — ${endLabel}` : dateLabel;
  const lastIndex = stops.length - 1;
  const progress = index / lastIndex * 100;
  const groups = (['day', 'week', 'month'] as const).flatMap((kind) => {
    const first = stops.findIndex((stop) => stop.period === kind);
    if (first < 0) return [];
    const count = stops.filter((stop) => stop.period === kind).length;
    return [{ kind, first, last: first + count - 1 }];
  });
  const labels = en ? { day: 'Days', week: 'Weeks', month: 'Months' } : { day: 'Дни', week: 'Недели', month: 'Месяцы' };

  return (
    <div className={`${styles.timeline} ${disabled ? styles.disabled : ''}`}>
      <div className={styles.control}>
        <div className={styles.rail} aria-hidden="true">
          {groups.map((group) => {
            const start = Math.max(0, group.first - 0.5) / lastIndex * 100;
            const end = Math.min(lastIndex, group.last + 0.5) / lastIndex * 100;
            return <span key={group.kind} className={`${styles.segment} ${styles[group.kind]}`} style={{ left: `${start}%`, width: `${end - start}%` }} />;
          })}
          <span className={styles.fill} style={{ width: `${progress}%` }} />
          {stops.map((stop, tick) => <i key={`${stop.period}-${stop.date}`} className={tick > 0 && stops[tick - 1].period !== stop.period ? styles.boundaryTick : styles.tick} style={{ left: `${tick / lastIndex * 100}%` }} />)}
          <img className={styles.car} src="/assets/nebo-refined/future-time-car-v1.webp" alt="" draggable={false} style={{ left: `${progress}%` }} />
        </div>
        <input
          className={styles.range}
          type="range"
          min={0}
          max={stops.length - 1}
          step={1}
          value={index}
          disabled={disabled}
          aria-label={en ? 'Choose a future day, week or whole month' : 'Выбрать будущий день, неделю или целый месяц'}
          aria-valuetext={title}
          onChange={(event) => {
            const next = stops[Number(event.currentTarget.value)];
            if (next) onChange(next);
          }}
        />
      </div>
      <div className={styles.labels} aria-hidden="true">
        {groups.map((group) => <span key={group.kind} className={selected.period === group.kind ? styles.activeLabel : ''} style={{ left: `${(group.first + group.last) / 2 / lastIndex * 100}%` }}>{labels[group.kind]}</span>)}
      </div>
    </div>
  );
}
