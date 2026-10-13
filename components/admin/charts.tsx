import React, { useEffect, useRef, useState } from 'react';
import { fmt, share } from './ui';

/**
 * Charts of the admin. One measure per chart (never two scales), plain words,
 * a tooltip on every bar and a table view for exact numbers.
 */

function niceMax(value: number): number {
  if (value <= 4) return Math.max(1, Math.ceil(value));
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * power >= value / 4)! * power;
  return Math.ceil(value / step) * step;
}

function dayLabel(day: string, withWeekday = false): string {
  const date = new Date(`${day}T12:00:00Z`);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', ...(withWeekday ? { weekday: 'short' } : {}), timeZone: 'UTC' }).format(date);
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver !== 'function') return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** A column rounded only at its data end; the baseline stays square. */
function roundedTop(x: number, base: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + w - r} Q${x + w},${base - h} ${x + w},${base - h + r} V${base} Z`;
}

/** Daily columns for one measure, with a tooltip and an optional table. */
export function DailyBars({ points, unit, format = fmt, label, average = false }: {
  points: Array<{ day: string; value: number }>; unit: string; format?: (v: number) => string; label: string;
  /** People per day cannot be summed (the same person comes on many days): show the daily average. */
  average?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const height = 220;
  const left = 40;
  const bottom = 26;
  const top = 12;
  const plotW = width - left - 8;
  const plotH = height - top - bottom;
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const step = plotW / Math.max(1, points.length);
  const barW = Math.max(3, Math.min(28, step - 2));
  const y = (value: number) => top + plotH - (value / max) * plotH;
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 64))));
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const active = hover == null ? null : points[hover];

  return (
    <div className="adm-chart" ref={ref}>
      <div className="adm-chart-summary">
        <span>{active ? `${dayLabel(active.day, true)}: ` : average ? `В среднем за день, ${points.length} дн.: ` : `Всего за ${points.length} дн.: `}</span>
        <strong>{format(active ? active.value : average ? total / Math.max(1, points.length) : total)}</strong> <span>{unit}</span>
      </div>
      {table ? (
        <div className="adm-table-wrap"><table className="adm-table">
          <thead><tr><th>День</th><th className="num">{label}</th></tr></thead>
          <tbody>{[...points].reverse().map((p) => <tr key={p.day}><td>{dayLabel(p.day, true)}</td><td className="num">{format(p.value)}</td></tr>)}</tbody>
        </table></div>
      ) : (
        <svg width={width} height={height} role="img" aria-label={`${label} по дням`} onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((part) => (
            <g key={part}>
              <line x1={left} x2={width - 8} y1={y(max * part)} y2={y(max * part)} className={part === 0 ? 'adm-axis' : 'adm-grid'} />
              <text x={left - 8} y={y(max * part) + 4} textAnchor="end" className="adm-tick">{format(max * part)}</text>
            </g>
          ))}
          {points.map((p, i) => {
            const x = left + i * step + (step - barW) / 2;
            const h = Math.max(p.value > 0 ? 2 : 0, top + plotH - y(p.value));
            return (
              <g key={p.day}>
                {p.value > 0 ? (
                  <path className={`adm-bar ${hover === i ? 'is-active' : ''}`} d={roundedTop(x, top + plotH, barW, h)} />
                ) : null}
                {i % labelEvery === 0 || i === points.length - 1
                  ? <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="adm-tick">{dayLabel(p.day)}</text> : null}
                <rect x={left + i * step} y={top} width={step} height={plotH} fill="transparent"
                  onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
      )}
      <button type="button" className="adm-link" onClick={() => setTable((v) => !v)}>{table ? 'Показать графиком' : 'Показать таблицей'}</button>
    </div>
  );
}

/** Steps of a path: how many people reached each step and how many were lost before it. */
export function Funnel({ steps }: { steps: Array<{ key: string; label: string; hint?: string; count: number }> }) {
  const first = steps[0]?.count || 0;
  if (!first) return <p className="adm-muted">В этом периоде новых людей не было.</p>;
  return (
    <ol className="adm-funnel">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1].count : step.count;
        const lost = Math.max(0, previous - step.count);
        return (
          <li key={step.key}>
            <div className="adm-funnel-row">
              <span className="adm-funnel-label">{step.label}{step.hint ? <small>{step.hint}</small> : null}</span>
              <span className="adm-funnel-value"><strong>{fmt(step.count)}</strong> <small>{share(step.count, first)}</small></span>
            </div>
            <div className="adm-funnel-track"><span style={{ width: `${step.count ? Math.max(1, (step.count / first) * 100) : 0}%` }} /></div>
            {index > 0 && lost > 0 ? <p className="adm-funnel-lost">потеряли {fmt(lost)} ({share(lost, previous)} от прошлого шага)</p> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** Day-N retention as columns with the share written on each. */
export function RetentionBars({ points }: { points: Array<{ day: number; cohort: number; returned: number }> }) {
  if (!points.some((p) => p.cohort > 0)) return <p className="adm-muted">Пока мало людей, чтобы посчитать удержание.</p>;
  return (
    <div className="adm-retention">
      {points.map((p) => {
        const value = p.cohort > 0 ? p.returned / p.cohort : 0;
        return (
          <div key={p.day} className="adm-retention-col" title={`${p.returned} из ${p.cohort}`}>
            <strong>{p.cohort > 0 ? share(p.returned, p.cohort) : '–'}</strong>
            <div className="adm-retention-track"><span style={{ height: `${Math.max(2, value * 100)}%` }} /></div>
            <span>день {p.day}</span>
            <small>{p.returned} из {p.cohort}</small>
          </div>
        );
      })}
    </div>
  );
}
