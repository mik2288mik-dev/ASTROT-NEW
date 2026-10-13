import React, { useId, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';

/** Small shared pieces of the admin: cards, numbers, lists, states. */

export const fmt = (value: number) => new Intl.NumberFormat('ru-RU').format(Math.round(value));
export const rub = (value: number) => `${fmt(value)} ₽`;
export const share = (part: number, total: number) => (total > 0 ? `${Math.round((part * 100) / total)}%` : '–');

export function duration(seconds: number | null | undefined): string {
  if (seconds == null) return '–';
  if (seconds < 60) return `${Math.round(seconds * 10) / 10} с`.replace('.', ',');
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
}

export function dateTime(value: string | null | undefined, withYear = false): string {
  if (!value) return '–';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '–';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}),
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

export function ago(value: string | null | undefined): string {
  if (!value) return 'не заходил';
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60_000);
  if (minutes < 2) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'вчера' : `${days} дн. назад`;
}

export function Card({ title, hint, action, children, className = '' }: {
  title?: React.ReactNode; hint?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`adm-card ${className}`}>
      {title || action ? (
        <header className="adm-card-head">
          <div>
            {title ? <h2>{title}</h2> : null}
            {hint ? <p>{hint}</p> : null}
          </div>
          {action ? <div className="adm-card-action">{action}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** A number with its comparison to the previous period. */
export function Stat({ label, value, previous, help, format = fmt, inverse = false, sub }: {
  label: string; value: number; previous?: number; help?: string; format?: (v: number) => string; inverse?: boolean; sub?: React.ReactNode;
}) {
  let delta: React.ReactNode = null;
  if (previous !== undefined) {
    if (previous === 0 && value === 0) delta = <span className="adm-delta">как раньше</span>;
    else if (previous === 0) delta = <span className="adm-delta" data-dir="up">было 0</span>;
    else {
      const change = Math.round(((value - previous) * 100) / previous);
      const good = inverse ? change < 0 : change > 0;
      delta = change === 0
        ? <span className="adm-delta">как раньше</span>
        : <span className="adm-delta" data-dir={good ? 'up' : 'down'}>{change > 0 ? '↑' : '↓'} {Math.abs(change)}%</span>;
    }
  }
  return (
    <div className="adm-stat">
      <div className="adm-stat-label">{label}{help ? <InfoTip text={help} /> : null}</div>
      <div className="adm-stat-value">{format(value)}</div>
      <div className="adm-stat-sub">{delta}{sub ? <span>{sub}</span> : null}</div>
    </div>
  );
}

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="adm-tip">
      <button type="button" aria-label="Что это значит" aria-describedby={open ? id : undefined}
        onClick={() => setOpen((v) => !v)} onBlur={() => setOpen(false)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <Info aria-hidden="true" />
      </button>
      {open ? <span role="tooltip" id={id}>{text}</span> : null}
    </span>
  );
}

/** Ranked horizontal bars: sources, versions, devices, plans. */
export function BarList({ items, total, empty = 'Пока нет данных', format = fmt, onPick }: {
  items: Array<{ label: string; count: number; note?: string }>; total?: number; empty?: string; format?: (v: number) => string; onPick?: (label: string) => void;
}) {
  if (!items.length) return <Empty text={empty} />;
  const max = Math.max(1, ...items.map((i) => i.count));
  const sum = total ?? items.reduce((s, i) => s + i.count, 0);
  return (
    <ul className="adm-barlist">
      {items.map((item) => (
        <li key={item.label}>
          <button type="button" disabled={!onPick} onClick={() => onPick?.(item.label)}>
            <span className="adm-barlist-track"><span style={{ width: `${Math.max(2, (item.count / max) * 100)}%` }} /></span>
            <span className="adm-barlist-label">{item.label}{item.note ? <small>{item.note}</small> : null}</span>
            <span className="adm-barlist-value">{format(item.count)}<small>{share(item.count, sum)}</small></span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void; label: string;
}) {
  return (
    <div className="adm-segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Loading({ text = 'Загружаю…' }: { text?: string }) {
  return <div className="adm-state"><Loader2 className="adm-spin" aria-hidden="true" />{text}</div>;
}
export function Empty({ text }: { text: string }) {
  return <div className="adm-state adm-state--empty">{text}</div>;
}
export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : String(error || 'Не получилось загрузить');
  return (
    <div className="adm-error" role="alert">
      <XCircle aria-hidden="true" /><span>{message}</span>
      {onRetry ? <button type="button" className="adm-btn adm-btn--ghost" onClick={onRetry}>Повторить</button> : null}
    </div>
  );
}

export function Tone({ tone, children }: { tone: 'good' | 'warn' | 'bad' | 'info'; children: React.ReactNode }) {
  const Icon = tone === 'good' ? CheckCircle2 : tone === 'bad' ? XCircle : tone === 'warn' ? AlertTriangle : Info;
  return <span className="adm-tone" data-tone={tone}><Icon aria-hidden="true" />{children}</span>;
}

/** Load data for a section; keeps the last result while reloading. */
export function useLoad<T>(load: () => Promise<T>, deps: React.DependencyList) {
  const [state, setState] = React.useState<{ data: T | null; error: unknown; busy: boolean }>({ data: null, error: null, busy: true });
  const [nonce, setNonce] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    setState((current) => ({ ...current, busy: true, error: null }));
    load().then(
      (data) => { if (alive) setState({ data, error: null, busy: false }); },
      (error) => { if (alive) setState((current) => ({ ...current, error, busy: false })); },
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);
  return { ...state, reload: () => setNonce((n) => n + 1) };
}
