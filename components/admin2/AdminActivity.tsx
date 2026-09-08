import React, { useEffect, useId, useRef, useState } from 'react';
import { Activity, LoaderCircle, RefreshCw } from 'lucide-react';
import { admin2, type AdminActivityReport, type AdminUserActivityReport } from '../../services/admin2Service';

type Period = 'day' | 'week' | 'month' | 'custom';
type Range = { from: string; to: string; period: Period; timezone: string };
type SeriesMetric = 'users' | 'visits' | 'events' | 'activeMs';
const TIMEZONE = 'Europe/Moscow';
const NUMBER = new Intl.NumberFormat('ru-RU');
const METRICS: Array<{ key: SeriesMetric; label: string }> = [
  { key: 'users', label: 'Пользователи' },
  { key: 'visits', label: 'Посещения' },
  { key: 'events', label: 'Действия' },
  { key: 'activeMs', label: 'Активное время' },
];

function today(): string {
  const parts = new Intl.DateTimeFormat('en', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function presetRange(period: Exclude<Period, 'custom'>): Range {
  const to = today();
  const from = new Date(`${to}T12:00:00Z`);
  from.setUTCDate(from.getUTCDate() - (period === 'day' ? 0 : period === 'week' ? 6 : 29));
  return { from: from.toISOString().slice(0, 10), to, period, timezone: TIMEZONE };
}

function duration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return 'Не измерено';
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} с`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} мин ${seconds % 60} с`;
  return `${NUMBER.format(Math.floor(seconds / 3600))} ч ${Math.floor((seconds % 3600) / 60)} мин`;
}

function durationAxis(ms: number): string {
  const units = ms >= 3_600_000 ? { divisor: 3_600_000, label: 'ч' } : ms >= 60_000 ? { divisor: 60_000, label: 'мин' } : { divisor: 1000, label: 'с' };
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, notation: 'compact' }).format(ms / units.divisor)} ${units.label}`;
}

function timestamp(value: string, includeDate = true): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: TIMEZONE,
    ...(includeDate ? { day: 'numeric' as const, month: 'short' as const } : {}),
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function rangeLabel(range: Range): string {
  const format = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(`${value}T12:00:00Z`));
  return `${format(range.from)} — ${format(range.to)} · время Москвы`;
}

function PeriodPicker({ range, onChange, busy }: { range: Range; onChange: (range: Range) => void; busy: boolean }) {
  const id = useId();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [error, setError] = useState('');
  useEffect(() => { setFrom(range.from); setTo(range.to); setError(''); }, [range.from, range.to]);
  return <div>
    <form className="admin2-period-form" onSubmit={event => {
      event.preventDefault();
      if (!from || !to || from > to) { setError('Начало периода должно быть не позже его окончания.'); return; }
      setError('');
      onChange({ from, to, period: 'custom', timezone: TIMEZONE });
    }}>
      <div className="admin2-period-presets" role="group" aria-label="Быстрый выбор периода">
        {([['day', 'День'], ['week', 'Неделя'], ['month', 'Месяц']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={range.period === key} onClick={() => onChange(presetRange(key))}>{label}</button>)}
      </div>
      <label className="admin2-period-field" htmlFor={`${id}-from`}><span>С</span><input id={`${id}-from`} className="admin2-input" type="date" name="from" required value={from} max={to || today()} onChange={event => { setFrom(event.target.value); setError(''); }} /></label>
      <label className="admin2-period-field" htmlFor={`${id}-to`}><span>По</span><input id={`${id}-to`} className="admin2-input" type="date" name="to" required value={to} min={from} max={today()} onChange={event => { setTo(event.target.value); setError(''); }} /></label>
      <button className="admin2-button admin2-button--secondary" type="submit" disabled={busy && from === range.from && to === range.to}>Показать период</button>
    </form>
    {error ? <p className="admin2-error" role="alert">{error}</p> : null}
  </div>;
}

function Loading() {
  return <div className="admin2-loading" role="status"><LoaderCircle size={20} aria-hidden="true" />Загружаем данные за выбранный период…</div>;
}

function Failure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="admin2-error" role="alert"><p>{message}</p><button className="admin2-button admin2-button--secondary" type="button" onClick={onRetry}>Повторить</button></div>;
}

function Metric({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return <div className="admin2-metric"><dt>{label}</dt><dd>{value}</dd>{note ? <small>{note}</small> : null}</div>;
}

function ActivityChart({ data }: { data: AdminActivityReport }) {
  const [metric, setMetric] = useState<SeriesMetric>('users');
  const [width, setWidth] = useState(760);
  const chartRef = useRef<SVGSVGElement>(null);
  const id = useId();
  const series = data.series;
  const values = series.map(point => point[metric]);
  const available = values.some(value => value !== null);
  const max = Math.max(metric === 'activeMs' ? 60_000 : 4, ...values.flatMap(value => value === null ? [] : [Math.max(0, value)]));
  const height = 240;
  const left = 64;
  const right = 12;
  const top = 12;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const step = plotWidth / Math.max(1, series.length);
  const labelEvery = Math.max(1, Math.ceil(series.length / Math.max(2, Math.floor(plotWidth / 76))));
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const resize = () => setWidth(Math.max(260, Math.round(chart.getBoundingClientRect().width)));
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(chart);
    return () => observer.disconnect();
  }, [available, series.length]);
  const labelFor = (value: string) => {
    // Bucket timestamps are wall-clock values in report.timezone, without an offset.
    const isWallClock = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value);
    const date = new Date(isWallClock ? `${value}Z` : value);
    if (!Number.isFinite(date.getTime())) return value;
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: isWallClock ? 'UTC' : data.range.timezone,
      ...(data.range.bucket === 'hour' ? { hour: '2-digit' as const, minute: '2-digit' as const } : { day: 'numeric' as const, month: 'short' as const }),
    }).format(date);
  };
  const metricLabel = METRICS.find(item => item.key === metric)?.label || '';
  return <section className="admin2-chart-card" aria-labelledby={`${id}-title`}>
    <div className="admin2-chart-header"><h3 id={`${id}-title`}>Активность по времени</h3>
      <div className="admin2-chart-metrics" role="group" aria-label="Показатель графика">{METRICS.map(item => <button key={item.key} type="button" aria-pressed={item.key === metric} onClick={() => setMetric(item.key)}>{item.label}</button>)}</div>
    </div>
    {series.length && available ? <figure>
      <svg ref={chartRef} className="admin2-timeseries" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-chart-title ${id}-chart-description`}>
        <title id={`${id}-chart-title`}>{metricLabel} за выбранный период</title>
        <desc id={`${id}-chart-description`}>Столбцы показывают реальные значения. Все числа доступны в таблице под графиком.</desc>
        {[0, .25, .5, .75, 1].map(fraction => {
          const y = top + plotHeight * (1 - fraction);
          return <g key={fraction}><line className="admin2-chart-grid" x1={left} x2={width - right} y1={y} y2={y}/><text x={left - 9} y={y + 4} textAnchor="end">{metric === 'activeMs' ? durationAxis(max * fraction) : NUMBER.format(Math.round(max * fraction))}</text></g>;
        })}
        {series.map((point, index) => {
          const value = point[metric];
          const barHeight = value === null ? 0 : Math.max(0, value) / max * plotHeight;
          const x = left + index * step;
          return <g key={point.at}>
            {value !== null ? <rect className="admin2-chart-bar" x={x + step * .15} y={top + plotHeight - barHeight} width={step * .7} height={barHeight} rx={Math.min(4, step * .14)}><title>{labelFor(point.at)}: {metric === 'activeMs' ? duration(value) : NUMBER.format(value)}</title></rect> : null}
            {index % labelEvery === 0 ? <text x={x + step / 2} y={height - 10} textAnchor="middle">{labelFor(point.at)}</text> : null}
          </g>;
        })}
      </svg>
      <figcaption className="admin2-period-description">{metric === 'activeMs' ? 'Время измеряется только при открытом приложении и взаимодействии с ним.' : `Каждый столбец — ${data.range.bucket === 'hour' ? 'час' : 'день'} выбранного периода.`}</figcaption>
    </figure> : <div className="admin2-empty">{metric === 'activeMs' ? 'За этот период активное время ещё не измерялось. Историю посещений можно посмотреть отдельно.' : 'За этот период нет данных для графика.'}</div>}
    <details className="admin2-chart-table"><summary>Показать данные таблицей</summary><div><table><thead><tr><th scope="col">Время</th><th scope="col">Пользователи</th><th scope="col">Посещения</th><th scope="col">Действия</th><th scope="col">Активное время</th></tr></thead><tbody>{series.map(point => <tr key={point.at}><td>{labelFor(point.at)}</td><td>{NUMBER.format(point.users)}</td><td>{NUMBER.format(point.visits)}</td><td>{NUMBER.format(point.events)}</td><td>{duration(point.activeMs)}</td></tr>)}</tbody></table></div></details>
  </section>;
}

export function AdminActivityDashboard() {
  const [range, setRange] = useState<Range>(() => presetRange('week'));
  const [data, setData] = useState<AdminActivityReport | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    setBusy(true); setError(''); setData(null);
    admin2.activity(range).then(result => { if (current) setData(result); }).catch((reason: unknown) => { if (current) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить активность.'); }).finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [range, retry]);
  return <div className="admin2-activity">
    <div className="admin2-section-heading"><div><h2>Что происходит в приложении</h2><p>Посещения, действия и активное время. Выбери период, чтобы увидеть динамику и путь к покупке.</p></div><button type="button" className="admin2-button admin2-button--secondary" disabled={busy} onClick={() => setRetry(value => value + 1)}><RefreshCw size={16} aria-hidden="true"/>Обновить</button></div>
    <PeriodPicker range={range} onChange={setRange} busy={busy}/>
    <p className="admin2-period-description">{rangeLabel(range)}{data ? ` · обновлено ${timestamp(data.generatedAt)}` : ''}</p>
    {busy ? <Loading/> : error ? <Failure message={error} onRetry={() => setRetry(value => value + 1)}/> : data ? <>
      <dl className="admin2-activity-kpis">
        <Metric label="Пользователи" value={NUMBER.format(data.summary.uniqueUsers)} note={`Новые активные: ${NUMBER.format(data.summary.newUsers)} · вернулись: ${NUMBER.format(data.summary.returningUsers)}`}/>
        <Metric label="Посещения" value={NUMBER.format(data.summary.visits)} note={`${NUMBER.format(data.summary.events)} действий`}/>
        <Metric label="Активное время" value={duration(data.summary.activeMs)} note={`Измерено посещений: ${NUMBER.format(data.summary.measuredVisits)}`}/>
        <Metric label="Среднее по измеренным визитам" value={duration(data.summary.avgActiveMs)} note="Посещения без измерений не учитываются"/>
      </dl>
      {data.summary.measuredVisits < data.summary.visits || data.summary.activeMs === null ? <p className="admin2-data-note">В старых посещениях активное время не измерялось. Они учитываются в посещениях, но не в средней длительности.</p> : null}
      <ActivityChart data={data}/>
      <div className="admin2-analysis-grid">
        <section><h3>Путь новых пользователей к покупке</h3><p className="admin2-period-description">Только аккаунты, созданные за выбранный период. Шаги учитываются последовательно до конца периода.</p>{data.funnels.length ? <ol className="admin2-funnel">{data.funnels.map(stage => <li key={stage.key}><div className="admin2-funnel-heading"><span>{stage.label}</span><strong>{NUMBER.format(stage.users)}{stage.percent !== null ? ` · ${stage.percent}%` : ''}</strong></div><div className="admin2-funnel-bar"><span style={{ width: `${stage.percent === null ? 0 : Math.max(0, Math.min(100, stage.percent))}%` }}/></div>{stage.pctOfPrev !== null ? <small className="admin2-period-description">{stage.pctOfPrev}% от предыдущего шага</small> : null}</li>)}</ol> : <p className="admin2-empty">За выбранный период шаги воронки не зафиксированы.</p>}</section>
        <section><h3>Что открывают и делают</h3>{data.topActions.length ? <ul className="admin2-actions-list">{data.topActions.map(action => <li key={action.key}><span>{action.label}<small>{NUMBER.format(action.users)} пользователей</small></span><strong>{NUMBER.format(action.events)}</strong></li>)}</ul> : <p className="admin2-empty">Действий за этот период пока нет.</p>}</section>
      </div>
      {data.topScreens.length ? <section className="admin2-card"><h3 className="admin2-section-heading">Популярные экраны</h3><div className="admin2-chart-table"><div><table><thead><tr><th scope="col">Экран</th><th scope="col">Пользователи</th><th scope="col">Открытия</th><th scope="col">Активное время</th></tr></thead><tbody>{data.topScreens.map(screen => <tr key={screen.key}><td>{screen.label}</td><td>{NUMBER.format(screen.users)}</td><td>{NUMBER.format(screen.events)}</td><td>{duration(screen.activeMs)}</td></tr>)}</tbody></table></div></div></section> : null}
    </> : null}
  </div>;
}

export function AdminUserActivity({ userId }: { userId: string }) {
  const [range, setRange] = useState<Range>(() => presetRange('week'));
  const [data, setData] = useState<AdminUserActivityReport | null>(null);
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [moreError, setMoreError] = useState('');
  const [retry, setRetry] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const current = ++request.current;
    setBusy(true); setLoadingMore(false); setError(''); setMoreError(''); setData(null);
    admin2.userActivity(userId, { ...range, limit: 40 }).then(result => { if (current === request.current) setData(result); }).catch((reason: unknown) => { if (current === request.current) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить историю.'); }).finally(() => { if (current === request.current) setBusy(false); });
    return () => { request.current += 1; };
  }, [userId, range, retry]);
  const loadMore = async () => {
    if (!data?.nextCursor || loadingMore) return;
    const current = request.current;
    setLoadingMore(true); setMoreError('');
    try {
      const next = await admin2.userActivity(userId, { ...range, cursor: data.nextCursor, limit: 40 });
      if (current !== request.current) return;
      setData(previous => previous ? { ...previous, nextCursor: next.nextCursor, timeline: [...previous.timeline, ...next.timeline.filter(event => !previous.timeline.some(existing => existing.id === event.id))] } : next);
    } catch (reason) {
      if (current === request.current) setMoreError(reason instanceof Error ? reason.message : 'Не удалось загрузить следующие события.');
    } finally {
      if (current === request.current) setLoadingMore(false);
    }
  };
  return <section className="admin2-user-activity admin2-activity" aria-label="История активности пользователя">
    <div className="admin2-section-heading"><div><h2>История активности</h2><p>Когда человек открывал приложение, что смотрел и сколько времени провёл в нём.</p></div><Activity size={22} aria-hidden="true"/></div>
    <PeriodPicker range={range} onChange={setRange} busy={busy}/>
    <p className="admin2-period-description">{rangeLabel(range)}</p>
    {busy ? <Loading/> : error ? <Failure message={error} onRetry={() => setRetry(value => value + 1)}/> : data ? <>
      <dl className="admin2-activity-kpis"><Metric label="Посещения" value={NUMBER.format(data.summary.visits)}/><Metric label="Действия" value={NUMBER.format(data.summary.events)}/><Metric label="Активное время" value={duration(data.summary.activeMs)}/><Metric label="Среднее по измеренным визитам" value={duration(data.summary.avgActiveMs)} note={`Измерено: ${NUMBER.format(data.summary.measuredVisits)}`}/></dl>
      {data.visits.length ? <details className="admin2-chart-table"><summary>Посещения и устройства</summary><div><table><thead><tr><th scope="col">Вход</th><th scope="col">Последняя активность</th><th scope="col">Устройство</th><th scope="col">Активное время</th></tr></thead><tbody>{data.visits.map(visit => <tr key={visit.id}><td>{timestamp(visit.startedAt)}</td><td>{timestamp(visit.lastSeenAt)}</td><td>{visit.device || visit.platform || 'Не указано'}</td><td>{duration(visit.activeMs)}</td></tr>)}</tbody></table></div></details> : null}
      {data.timeline.length ? <ol className="admin2-timeline">{data.timeline.map(event => <li key={event.id}><time dateTime={event.at}>{timestamp(event.at)}</time><div><strong>{event.label}</strong><div className="admin2-event-meta">{event.section ? <span>{event.section}</span> : null}{event.source ? <span>{event.source}</span> : null}{event.activeMs !== undefined ? <span>Активное время: {duration(event.activeMs)}</span> : null}</div></div></li>)}</ol> : <p className="admin2-empty">За выбранный период действий не найдено. Выбери другой период.</p>}
      {moreError ? <Failure message={moreError} onRetry={() => void loadMore()}/> : null}
      {data.nextCursor ? <button type="button" className="admin2-button admin2-button--secondary" disabled={loadingMore} aria-busy={loadingMore} onClick={() => void loadMore()}>{loadingMore ? 'Загружаем…' : 'Показать более ранние события'}</button> : null}
    </> : null}
  </section>;
}
