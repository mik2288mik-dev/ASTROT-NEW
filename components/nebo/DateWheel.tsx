import React, { useEffect, useRef } from 'react';

const ROW = 38;
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function Column({ items, index, onChange, label }: { items: string[]; index: number; onChange: (index: number) => void; label: string }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const timer = useRef<number | null>(null);
  const settling = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || Math.round(el.scrollTop / ROW) === index) return;
    settling.current = true;
    el.scrollTo({ top: index * ROW, behavior: 'auto' });
    window.setTimeout(() => { settling.current = false; }, 60);
  }, [index]);

  const onScroll = () => {
    if (settling.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const next = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ROW)));
      if (next !== index) onChange(next);
    }, 90);
  };

  return (
    <div className="nebo-wheel-col" ref={ref} onScroll={onScroll} role="listbox" aria-label={label} tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown') { event.preventDefault(); onChange(Math.min(items.length - 1, index + 1)); }
        if (event.key === 'ArrowUp') { event.preventDefault(); onChange(Math.max(0, index - 1)); }
      }}
    >
      <div className="nebo-wheel-pad" />
      {items.map((item, i) => {
        const distance = Math.abs(i - index);
        return (
          <button
            key={item + i}
            type="button"
            role="option"
            aria-selected={i === index}
            className={`nebo-wheel-item is-d${Math.min(distance, 3)}`}
            onClick={() => onChange(i)}
          >
            {item}
          </button>
        );
      })}
      <div className="nebo-wheel-pad" />
    </div>
  );
}

/** Day / month / year drums as on the canvas Entry board. Works with YYYY-MM-DD. */
export function DateWheel({ value, onChange, minYear = 1930 }: { value: string; onChange: (value: string) => void; minYear?: number }) {
  const now = new Date();
  const maxYear = now.getFullYear();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const year = match ? Number(match[1]) : 1995;
  const month = match ? Number(match[2]) : 6;
  const day = match ? Number(match[3]) : 15;
  const daysInMonth = new Date(year, month, 0).getDate();
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => String(minYear + i));
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

  const emit = (nextYear: number, nextMonth: number, nextDay: number) => {
    const limit = new Date(nextYear, nextMonth, 0).getDate();
    const safeDay = Math.min(nextDay, limit);
    onChange(`${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`);
  };

  // Show the default date at once, so the sign appears before the first touch.
  useEffect(() => { if (!match) emit(year, month, day); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="nebo-wheel">
      <span className="nebo-wheel-band" aria-hidden="true" />
      <Column label="День" items={days} index={day - 1} onChange={(i) => emit(year, month, i + 1)} />
      <Column label="Месяц" items={MONTHS} index={month - 1} onChange={(i) => emit(year, i + 1, day)} />
      <Column label="Год" items={years} index={Math.max(0, year - minYear)} onChange={(i) => emit(minYear + i, month, day)} />
    </div>
  );
}
