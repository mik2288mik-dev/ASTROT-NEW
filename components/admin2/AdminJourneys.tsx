import React, { useCallback, useEffect, useState } from 'react';
import { Activity, ChartNoAxesCombined, Compass, Lightbulb, RefreshCw, UsersRound } from 'lucide-react';
import { admin2, type AdminMe, type JourneyReport } from '../../services/admin2Service';
import { AdminAppAnalytics } from './AdminAppAnalytics';
import { AdminAnalyticsGuide } from './AdminAnalyticsGuide';
import styles from './AdminJourneys.module.css';

export type AnalyticsTab = 'overview' | 'people' | 'explore' | 'advice';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function week() { const to = today(); const date = new Date(`${to}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - 6); return { from: date.toISOString().slice(0, 10), to }; }

export function AdminJourneys({ me }: { me: AdminMe }) {
  const [range, setRange] = useState(week); const [draft, setDraft] = useState(range);
  const [version, setVersion] = useState(''); const [versions, setVersions] = useState<string[]>([]);
  const [journeys, setJourneys] = useState<JourneyReport | null>(null);
  const [busy, setBusy] = useState(true); const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0); const [tab, setTab] = useState<AnalyticsTab>('overview');
  const mergeVersions = useCallback((next: string[]) => setVersions(previous => [...new Set([...previous, ...next])].sort()), []);
  const canAnalytics = me.permissions.includes('analytics.view');
  useEffect(() => {
    if (!canAnalytics) return;
    let current = true; setBusy(true); setError(''); setJourneys(null);
    admin2.journeys({ ...range, period: 'custom', timezone: 'Europe/Moscow', ...(version ? { version } : {}) })
      .then(data => { if (current) { setJourneys(data); if (!version) mergeVersions(data.versions); } })
      .catch(e => { if (current) setError(e instanceof Error ? e.message : 'Не удалось получить первые шаги.'); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [range, version, refresh, mergeVersions, canAnalytics]);
  if (!canAnalytics) return <p role="alert">Для этого раздела нужно право просмотра аналитики.</p>;
  return <section className={styles.root} aria-label="Аналитика продукта">
    <header className={styles.heading}>
      <div><span className={styles.eyebrow}><Activity size={15} aria-hidden="true" /> NEBO / АНАЛИТИКА ПРОДУКТА</span><h2>Путь пользователей</h2><p>Кто дошёл до результата. Где остановился. Что можно улучшить.</p></div>
      <button type="button" className={styles.button} onClick={() => setRefresh(v => v + 1)}><RefreshCw size={15} aria-hidden="true" />Обновить</button>
    </header>
    <form className={styles.filters} onSubmit={e => { e.preventDefault(); if (!draft.from || !draft.to || draft.from > draft.to) { setError('Проверь начало и конец периода.'); return; } setRange(draft); }}>
      <label>С<input aria-label="Начало периода" type="date" value={draft.from} max={draft.to} onChange={e => setDraft({ ...draft, from: e.target.value })} required /></label>
      <label>По<input aria-label="Конец периода" type="date" value={draft.to} min={draft.from} max={today()} onChange={e => setDraft({ ...draft, to: e.target.value })} required /></label>
      <label>Версия приложения<select value={version} onChange={e => setVersion(e.target.value)}><option value="">Все версии</option>{versions.map(v => <option key={v} value={v}>{v === 'unknown' ? 'Версия не передана' : v}</option>)}</select></label>
      <button type="submit" className={styles.primaryButton}>Показать</button>
      <button type="button" className={styles.button} onClick={() => { const next = week(); setDraft(next); setRange(next); }}>7 дней</button>
      <span className={styles.timezone}>Время Москвы</span>
    </form>
    <nav className={styles.tabs} aria-label="Разделы аналитики">{([
      ['overview', 'Обзор', ChartNoAxesCombined], ['people', 'Пользователи', UsersRound],
      ['explore', 'Экраны и ожидание', Compass], ['advice', 'Как улучшить', Lightbulb],
    ] as const).map(([key, label, Icon]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}><Icon size={17} aria-hidden="true" />{label}</button>)}</nav>
    <AdminAppAnalytics me={me} range={range} version={version} refresh={refresh} onVersions={mergeVersions} tab={tab} onNavigate={setTab} journeys={journeys} journeyBusy={busy} journeyError={error} onRefresh={() => setRefresh(value => value + 1)} />
    {tab === 'advice' ? <details className={styles.guideToggle}><summary>Как пользоваться аналитикой — объяснение с примерами</summary><AdminAnalyticsGuide /></details> : null}
  </section>;
}
