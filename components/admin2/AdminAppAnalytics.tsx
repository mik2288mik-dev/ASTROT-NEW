import React, { useEffect, useState } from 'react';
import { ArrowRight, AlertTriangle, Check, ChevronRight, CircleCheck, Clock3, Search, UsersRound, X } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { admin2, type AdminMe, type AppTraceReport, type AppTraceDetail, type JourneyReport } from '../../services/admin2Service';
import { TRACE_SCREEN_LABELS } from '../../lib/appTelemetry';
import { STEP_LABELS } from '../../lib/journeyTelemetry';
import { operationLabel, readableLabel } from '../../lib/admin/telemetryCopy';
import { AppFlow, OnboardingFlow, JOURNEY_STATUS, VISIT_STATUS, type JourneyFilter } from './AnalyticsFlow';
import { AnalyticsPerson, analyticsSeconds as seconds, analyticsTime as time } from './AnalyticsPerson';
import type { AnalyticsTab } from './AdminJourneys';
import styles from './AdminJourneys.module.css';

type Props = { me: AdminMe; range: { from: string; to: string }; version: string; refresh: number; onVersions: (versions: string[]) => void;
  tab: AnalyticsTab; onNavigate: (tab: AnalyticsTab) => void; journeys: JourneyReport | null; journeyBusy: boolean; journeyError: string; onRefresh: () => void };
const shortDay = (day: string) => day.slice(5).split('-').reverse().join('.');
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
function DataTable({ headers, rows, empty = 'За этот период таких событий нет.' }: { headers: string[]; rows: React.ReactNode[][]; empty?: string }) {
  return rows.length ? <div className={styles.tableScroll}><table className={styles.table}><thead><tr>{headers.map(header => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, column) => column === 0 ? <th scope="row" key={column}>{cell}</th> : <td key={column}>{cell}</td>)}</tr>)}</tbody></table></div> : <p className={styles.empty}>{empty}</p>;
}

export function AdminAppAnalytics({ me, range, version, refresh, onVersions, tab, onNavigate, journeys, journeyBusy, journeyError, onRefresh }: Props) {
  const [report, setReport] = useState<AppTraceReport | null>(null); const [segment, setSegment] = useState('');
  const [compare, setCompare] = useState(true); const [mode, setMode] = useState<'first' | 'app'>('first');
  const [journeyFilter, setJourneyFilter] = useState<JourneyFilter>({}); const [screenFilter, setScreenFilter] = useState(''); const [visitStatus, setVisitStatus] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(true);
  const [selected, setSelected] = useState(''); const [selectedName, setSelectedName] = useState(''); const [selectedAttempt, setSelectedAttempt] = useState(''); const [selectedVisit, setSelectedVisit] = useState('');
  const [query, setQuery] = useState(''); const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]); const [searchError, setSearchError] = useState('');
  const [detail, setDetail] = useState<AppTraceDetail | null>(null); const [detailError, setDetailError] = useState(''); const [detailBusy, setDetailBusy] = useState(false);
  const [explore, setExplore] = useState('screens');
  const canUsers = me.permissions.includes('users.view');
  useEffect(() => {
    let current = true; setBusy(true); setError(''); setReport(null);
    admin2.appTelemetry({ ...range, period: 'custom', timezone: 'Europe/Moscow', ...(version ? { version } : {}), ...(segment ? { segment } : {}), compare: compare ? '1' : '0' })
      .then(data => { if (current && 'summary' in data) { setReport(data); if (!version) onVersions(data.versions); } })
      .catch(e => { if (current) setError(e instanceof Error ? e.message : 'Не удалось загрузить данные.'); })
      .finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [range, version, segment, compare, refresh, onVersions]);
  useEffect(() => {
    if (!selected || !canUsers) { setDetail(null); return; }
    let current = true; setDetailBusy(true); setDetailError(''); setDetail(null);
    const params = selected.startsWith('user:') ? { userId: selected.slice(5) } : { visitId: selected.slice(6) };
    admin2.appTelemetry({ ...range, period: 'custom', timezone: 'Europe/Moscow', ...params })
      .then(data => { if (current && 'events' in data) setDetail(data); })
      .catch(e => { if (current) setDetailError(e instanceof Error ? e.message : 'Не удалось открыть историю.'); })
      .finally(() => { if (current) setDetailBusy(false); });
    return () => { current = false; };
  }, [range, selected, canUsers, refresh]);
  useEffect(() => {
    setSearchError(''); setUsers([]);
    if (!query.trim() || !canUsers) return;
    let current = true;
    const timer = setTimeout(() => { admin2.listUsers({ q: query.trim(), pageSize: 20 }).then(data => {
      if (current) setUsers(data.users.map(u => ({ id: String(u.id), name: u.name || `Пользователь ${u.id}` })));
    }).catch(() => { if (current) setSearchError('Поиск не загрузился. Повтори запрос.'); }); }, 300);
    return () => { current = false; clearTimeout(timer); };
  }, [query, canUsers, refresh]);
  const choose = (key: string, name: string, attempt = '', visit = '') => { setSelected(key); setSelectedName(name); setSelectedAttempt(attempt); setSelectedVisit(visit); onNavigate('people'); };
  const chooseJourney = (filter: JourneyFilter) => { setMode('first'); setJourneyFilter(filter); setSelected(''); setQuery(''); onNavigate('people'); };
  const chooseScreen = (screen: string, status = '') => { setMode('app'); setScreenFilter(screen); setVisitStatus(status); setSelected(''); setQuery(''); onNavigate('people'); };
  const queryMatches = (name: string | null, id: string | null) => !query || `${name || ''} ${id || ''}`.toLowerCase().includes(query.toLowerCase());
  const attempts = (journeys?.attempts || []).filter(a => queryMatches(a.name, a.userId)
    && (!journeyFilter.status || a.status === journeyFilter.status) && (!journeyFilter.step || a.lastStep === journeyFilter.step)
    && (!journeyFilter.reached || a.reached >= journeyFilter.reached) && (!journeyFilter.lostAfter || a.reached === journeyFilter.lostAfter));
  const visits = (report?.visits || []).filter(v => queryMatches(v.name, v.userId)
    && (!screenFilter || (visitStatus === 'stopped' ? v.lastScreen === screenFilter : v.screensVisited.includes(screenFilter))) && (!visitStatus || v.state === visitStatus));
  const weak = [...(report?.weakPoints || [])].sort((a, b) => b.stopped - a.stopped).filter(p => p.stopped > 0).slice(0, 5);
  const retry = onRefresh;
  const activeFilter = mode === 'first' ? journeyFilter.status ? JOURNEY_STATUS[journeyFilter.status] : journeyFilter.step ? `Остановились: ${STEP_LABELS[journeyFilter.step]}`
    : journeyFilter.reached ? `Дошли до шага ${journeyFilter.reached}` : journeyFilter.lostAfter ? `Не дошли дальше шага ${journeyFilter.lostAfter}` : ''
    : [screenFilter ? TRACE_SCREEN_LABELS[screenFilter] : '', visitStatus ? VISIT_STATUS[visitStatus] : ''].filter(Boolean).join(' · ');
  const clearFilters = () => { setJourneyFilter({}); setScreenFilter(''); setVisitStatus(''); setQuery(''); setSelected(''); };
  const errorState = (message: string) => <div role="alert" className={styles.error}><AlertTriangle size={18} aria-hidden="true" />{message}<button className={styles.button} type="button" onClick={retry}>Повторить</button></div>;
  const peopleList = (compact = false) => <>
    <div className={styles.personList} aria-label={mode === 'first' ? 'Попытки первого входа' : 'Посещения приложения'}>
      {(compact ? mode === 'first' ? journeys?.attempts || [] : report?.visits || [] : mode === 'first' ? attempts : visits).slice(0, compact ? 5 : 200).map(item => {
        const isJourney = 'status' in item; const name = item.name || (item.userId ? `Пользователь ${item.userId}` : 'Без входа');
        const key = item.userId ? `user:${item.userId}` : `visit:${item.id}`; const status = isJourney ? item.status : item.state;
        return <button type="button" key={item.id} className={styles.personRow} aria-pressed={selected === key && (isJourney ? selectedAttempt === item.id : selectedVisit === item.id)} onClick={() => choose(key, name, isJourney ? item.id : '', isJourney ? '' : item.id)}>
          <span className={styles.avatar}>{initials(name)}</span><span className={styles.personInfo}><strong>{name}</strong><span>{isJourney ? STEP_LABELS[item.lastStep] || 'Первый вход' : TRACE_SCREEN_LABELS[item.lastScreen] || 'Другой экран'}</span><small>{time(isJourney ? item.startedAt : item.lastAt)}</small></span>
          <span className={styles.personEnd}><span className={styles.badge} data-status={status}>{isJourney ? JOURNEY_STATUS[status] : VISIT_STATUS[status]}</span>{!isJourney && item.errors ? <small className={styles.warning}>Ошибок: {item.errors}</small> : null}</span><ChevronRight size={16} aria-hidden="true" />
        </button>;
      })}
      {!(compact ? mode === 'first' ? journeys?.attempts || [] : report?.visits || [] : mode === 'first' ? attempts : visits).length ? <div className={styles.empty}><UsersRound size={26} aria-hidden="true" /><p>По этим условиям записей нет.</p>{activeFilter || query ? <button type="button" className={styles.button} onClick={clearFilters}>Сбросить условия</button> : <p className={styles.note}>Подробности появятся после обновления приложения у людей.</p>}</div> : null}
    </div>
  </>;
  const modeControl = <div className={styles.segmented} aria-label="Какие пути показать"><button type="button" aria-pressed={mode === 'first'} onClick={() => { setMode('first'); setSelected(''); }}>Первый вход</button><button type="button" aria-pressed={mode === 'app'} onClick={() => { setMode('app'); setSelected(''); }}>Всё приложение</button></div>;
  const metrics = report ? [
    { label: 'Посещения', value: report.summary.visits, previous: report.previous?.summary.visits, tone: 'flow' },
    { label: 'Люди с аккаунтом', value: report.summary.users, previous: report.previous?.summary.users, tone: 'muted' },
    { label: 'Отправленные вопросы', value: report.summary.questions, previous: report.previous?.summary.questions, tone: 'success' },
    { label: 'Записанные ошибки', value: report.summary.errors, previous: report.previous?.summary.errors, tone: report.summary.errors ? 'warning' : 'success' },
  ] : [];
  return <div className={styles.workspace}>
    {tab !== 'overview' && segment ? <div className={styles.filterSummary}><span>Активность приложения: {({new:'новые аккаунты',returning:'прежние аккаунты',anonymous:'до входа'} as Record<string,string>)[segment]}</span><button type="button" onClick={() => setSegment('')}>Показать всех<X size={15} /></button></div> : null}
    {tab === 'overview' ? <>
      <div className={styles.overviewToolbar}>{modeControl}<label>Активность кого<select value={segment} onChange={e => setSegment(e.target.value)}><option value="">Все</option><option value="new">Новые аккаунты</option><option value="returning">Прежние аккаунты</option><option value="anonymous">До входа</option></select></label></div>
      {segment && mode === 'first' ? <p className={styles.note}>Группа людей применяется к активности приложения. Первый вход ниже показан по всем записанным попыткам выбранной версии и периода.</p> : null}
      {busy ? <p role="status" className={styles.loading}>Получаем данные приложения…</p> : error ? errorState(error) : report ? <>
        <dl className={styles.metrics}>{metrics.map(metric => <div key={metric.label} data-tone={metric.tone}><dt>{metric.label}</dt><dd>{metric.value.toLocaleString('ru-RU')}</dd>{metric.previous != null ? <span>{metric.previous} в предыдущем периоде</span> : null}</div>)}</dl>
        <p className={styles.updated}>Обновлено {time(report.generatedAt)}{report.previous ? ` · сравнение с ${shortDay(report.previous.range.from)}–${shortDay(report.previous.range.to)}` : ''}{report.truncated ? ' · выборка ограничена: сузь период' : ''}</p>
      </> : null}
      <section className={styles.graphPanel}>{mode === 'first' ? journeyBusy ? <p role="status" className={styles.empty}>Строим график первого входа…</p> : journeyError ? errorState(journeyError) : journeys ? <OnboardingFlow report={journeys} onSelect={chooseJourney} canSelect={canUsers} /> : null : report ? <AppFlow report={report} onSelect={chooseScreen} canSelect={canUsers} /> : null}</section>
      {report ? <div className={styles.overviewGrid}>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h3>Где заканчивается посещение</h3><p>После какого экрана нет действий более 30 минут.</p></div><AlertTriangle size={18} className={styles.warning} aria-hidden="true" /></div>
          {weak.length ? <div className={styles.barList}>{weak.map(point => { const key = report?.screens.find(screen => screen.label === point.screen)?.key || ''; return <button key={point.screen} type="button" disabled={!canUsers || !key} onClick={() => chooseScreen(key, 'stopped')}><span>{point.screen}<strong>{point.stopped}</strong></span><span className={styles.barTrack}><span style={{ width: `${point.stopped / Math.max(1, weak[0].stopped) * 100}%` }} /></span><small>{point.percent}% от посещений этого экрана</small></button>; })}</div> : <p className={styles.empty}>Таких остановок пока не записано.</p>}
          <p className={styles.note}>Уход после чтения может быть нормальным. Открой человека и посмотри, получил ли он нужный результат.</p>
        </section>
        {canUsers ? <section className={styles.panel}><div className={styles.panelHeader}><div><h3>{mode === 'first' ? 'Последние попытки' : 'Последние посещения'}</h3><p>Выбери человека, чтобы открыть его путь.</p></div><button type="button" className={styles.link} onClick={() => onNavigate('people')}>Все <ArrowRight size={14} /></button></div>{peopleList(true)}</section> : <section className={styles.panel}><h3>Истории людей</h3><p className={styles.empty}>Для отдельных историй нужно право просмотра пользователей. Общие графики доступны.</p></section>}
      </div> : null}
      {report ? <section className={styles.panel}><div className={styles.panelHeader}><div><h3>Как меняется число посещений</h3><p>Один человек может открывать приложение несколько раз.</p></div><label className={styles.check}><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />Сравнить периоды</label></div>
        {report.daily.length ? <div className={styles.trendChart} role="img" aria-label={`Посещения по дням: ${report.daily.map(d => `${d.day}: ${d.visits}`).join(', ')}`}><ResponsiveContainer width="100%" height="100%"><AreaChart data={report.daily} margin={{ top: 12, right: 18, bottom: 8, left: -15 }}><defs><linearGradient id="analytics-visits-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4edbe2" stopOpacity={.28} /><stop offset="100%" stopColor="#4edbe2" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#243442" strokeDasharray="3 5" /><XAxis dataKey="day" tickFormatter={shortDay} tick={{ fill: '#acbdc9', fontSize: 14 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: '#acbdc9', fontSize: 14 }} axisLine={false} tickLine={false} /><Tooltip labelFormatter={value => shortDay(String(value))} formatter={value => [value ?? 0, 'Посещения']} contentStyle={{ background: '#152632', border: '1px solid #314651', borderRadius: 10, color: '#f4fafc' }} /><Area type="monotone" dataKey="visits" stroke="#4edbe2" strokeWidth={2.5} fill="url(#analytics-visits-fill)" isAnimationActive={false} /></AreaChart></ResponsiveContainer></div> : <p className={styles.empty}>Посещений за период нет.</p>}
        <p className={styles.note}>Сравнение есть и под цифрами сверху. Если в предыдущем периоде сбор ещё не работал, сравнивать с нулём рано.</p>
      </section> : null}
    </> : tab === 'people' ? canUsers ? <>
      <div className={styles.overviewToolbar}><div><h3 className={styles.pageTitle}>Пользователи и их путь</h3><p className={styles.note}>Поиск найдёт человека и за пределами последних записей.</p></div>{modeControl}</div>
      <div className={styles.peopleTools}><label className={styles.searchField}><Search size={17} aria-hidden="true" /><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Имя или ID пользователя" aria-label="Поиск пользователя" /></label>
        <label>Итог<select value={mode === 'first' ? journeyFilter.status || '' : visitStatus} onChange={e => { setSelected(''); mode === 'first' ? setJourneyFilter({ status: e.target.value }) : setVisitStatus(e.target.value); }}><option value="">Все итоги</option>{Object.entries(mode === 'first' ? JOURNEY_STATUS : VISIT_STATUS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      {activeFilter ? <div className={styles.filterSummary}><span><Check size={15} aria-hidden="true" />{activeFilter}</span><button type="button" aria-label="Сбросить выбранные условия" onClick={clearFilters}><X size={15} />Сбросить</button></div> : null}
      {query && users.length ? <div className={styles.searchResults}><span>Найденные аккаунты</span>{users.map(user => <button key={user.id} type="button" onClick={() => choose(`user:${user.id}`, user.name)}>{user.name}<small>ID {user.id}</small><ArrowRight size={14} aria-hidden="true" /></button>)}</div> : null}
      {searchError ? errorState(searchError) : null}
      <div className={`${styles.peopleWorkspace} ${selected ? styles.hasDetail : ''}`}>
        <section className={styles.peoplePane}><div className={styles.listHeader}><strong>{mode === 'first' ? 'Попыток' : 'Посещений'} в списке: {mode === 'first' ? attempts.length : visits.length}</strong></div>{mode === 'first' ? journeyBusy ? <p role="status" className={styles.empty}>Загружаем попытки…</p> : journeyError ? errorState(journeyError) : peopleList() : busy ? <p role="status" className={styles.empty}>Загружаем посещения…</p> : error ? errorState(error) : peopleList()}<p className={styles.note}>До 200 последних записей за период. Это список примеров; общие числа на графике могут быть больше.</p></section>
        {selected ? <AnalyticsPerson selected={selected} name={selectedName} detail={detail} busy={detailBusy} error={detailError} range={range} refresh={refresh} attemptId={selectedAttempt} initialVisit={selectedVisit} onClose={() => setSelected('')} onRetry={retry} /> : <div className={styles.selectionHint}><UsersRound size={32} aria-hidden="true" /><h3>Открой путь человека</h3><p>Выбери строку слева. Здесь появятся экраны, нажатия, ожидание и результат.</p></div>}
      </div>
    </> : <p className={styles.empty}>Для отдельных историй нужно право просмотра пользователей.</p> : tab === 'explore' ? <>
      <div className={styles.panelHeader}><div><h3>Разбираемся в деталях</h3><p>Выбери, что проверить: экраны, загрузку, внимание к блокам или возвраты.</p></div></div>
      <nav className={styles.subnav} aria-label="Подробные отчёты">{[['screens', 'Экраны'], ['waiting', 'Ожидание'], ['attention', 'Блоки и кнопки'], ['first', 'Первый вход'], ['returns', 'Возвраты'], ['sources', 'Источники'], ['versions', 'Версии'], ['results', 'Результаты']].map(([key, label]) => <button key={key} type="button" aria-pressed={explore === key} onClick={() => setExplore(key)}>{label}</button>)}</nav>
      {busy ? <p role="status" className={styles.loading}>Получаем подробности…</p> : error ? errorState(error) : report ? <section className={styles.reportSection}>
        {explore === 'screens' ? <><h3>Что открывают и сколько смотрят</h3><DataTable headers={['Экран', 'Открытия', 'Посетители', 'Обычно на экране', 'Дошли до ¾']} rows={report.screens.map(s => [canUsers ? <button className={styles.link} onClick={() => chooseScreen(s.key)}>{s.label}<ArrowRight size={13} /></button> : s.label, s.views, s.users, seconds(s.medianMs), s.depth75])} /><p className={styles.note}>Время в свёрнутом приложении не учитывается. Долгий просмотр может означать интерес или затруднение.</p><h3>Последний экран перед остановкой</h3><DataTable headers={['Экран', 'Нет действий 30 мин', 'Посещения экрана', 'Доля']} rows={report.weakPoints.map(p => [p.screen, p.stopped, p.visits, p.percent == null ? '—' : `${p.percent}%`])} /></> : null}
        {explore === 'waiting' ? <><h3>Что долго загружается</h3><div className={styles.barList}>{report.requests.filter(r => r.p90Ms != null).slice(0, 5).map(r => <div key={r.operation}><span>{operationLabel(r.operation)}<strong>{seconds(r.p90Ms)}</strong></span><span className={styles.barTrack} data-tone="flow"><span style={{ width: `${Math.max(2, (r.p90Ms || 0) / Math.max(1, ...report.requests.map(x => x.p90Ms || 0)) * 100)}%` }} /></span><small>В медленных случаях · обычно {seconds(r.medianMs)}</small></div>)}</div><DataTable headers={['Что загружается', 'Начали', 'Завершилось', 'Ошибки', 'Обычно', 'Медленно']} rows={report.requests.map(r => [<>{operationLabel(r.operation)}<details className={styles.technical}><summary>Для разработчика</summary><code>{r.operation}</code></details></>, r.started, r.completed, r.errors, seconds(r.medianMs), seconds(r.p90Ms)])} /><p className={styles.note}>Время — для успешных загрузок. «Медленно» — время, в которое уложились примерно 9 из 10 случаев. Загрузка может идти в фоне; в истории человека видно, ждал ли он на экране.</p></> : null}
        {explore === 'attention' ? <><h3>Какие блоки задерживают внимание</h3><div className={styles.barList}>{report.content.slice(0, 5).map((c, i) => <div key={i}><span>{readableLabel(c.block, 'Блок без названия')}<strong>{seconds(c.medianFocusMs)}</strong></span><span className={styles.barTrack} data-tone="flow"><span style={{ width: `${Math.max(2, (c.medianFocusMs || 0) / Math.max(1, ...report.content.map(x => x.medianFocusMs || 0)) * 100)}%` }} /></span><small>{c.screen} · {c.views} показов</small></div>)}</div><DataTable headers={['Экран / блок', 'Показы', 'Обычно виден', 'Главный на экране', 'Остановки']} rows={report.content.map(c => [`${c.screen} / ${readableLabel(c.block, 'Блок без названия')}`, c.views, seconds(c.medianMs), seconds(c.medianFocusMs), c.stops])} /><p className={styles.note}>«Главный» — блок занимает больше всего места на экране. Это возможность прочитать, а не доказательство чтения.</p><h3>Кнопки: увидели → нажали</h3><DataTable headers={['Кнопка', 'Показы', 'Нажатия после показа', 'Доля']} rows={report.controls.map(c => [`${c.screen} / ${c.label}`, c.shown, c.clicked, c.percent == null ? '—' : `${c.percent}%`])} /><p className={styles.note}>Показ — кнопка была видна хотя бы секунду. Быстрые нажатия без такого показа смотри ниже.</p><details className={styles.question}><summary>Все нажатия</summary><DataTable headers={['Экран / действие', 'Нажатия', 'Посетители']} rows={report.clicks.map(c => [`${c.screen} / ${c.label}`, c.count, c.users])} /></details></> : null}
        {explore === 'first' ? journeyBusy ? <p role="status">Загружаем первый вход…</p> : journeyError ? errorState(journeyError) : journeys ? <><h3>На каком окне первого входа остановились</h3><DataTable headers={['Окно', 'Открытия', 'Обычно на экране', 'Остановились', 'Нажатия']} rows={journeys.steps.map(s => [s.label, s.views, seconds(s.medianVisibleMs), canUsers && s.unresolved ? <button className={styles.link} onClick={() => chooseJourney({ status: 'no_continuation', step: s.key })}>{s.unresolved} · открыть</button> : s.unresolved, s.actions.map(a => `${a.label}: ${a.count}`).join(' · ') || 'Не записаны'])} /><h3>Ожидание карты и разбора</h3><DataTable headers={['Этап', 'Готово', 'Ошибка', 'Без завершения', 'Обычно', 'Медленно']} rows={journeys.waits.map(w => [w.label, w.samples, w.failed, w.unfinished, seconds(w.medianMs), seconds(w.p90Ms)])} /><p className={styles.note}>Незавершённое ожидание не считается нулевым. Последние замеры: {journeys.waits.filter(w => w.unfinished).map(w => `${w.label} — ${seconds(w.lastMeasuredMs)}`).join('; ') || 'незавершённых ожиданий нет'}. Человек мог ждать дальше.</p></> : null : null}
        {explore === 'returns' ? <><h3>Возвращаются ли люди</h3><DataTable headers={['Когда', 'Успели наблюдать', 'Вернулись', 'Доля']} rows={report.retention.map(r => [r.day === 1 ? 'На следующий день' : 'Через неделю', r.eligible, r.returned, r.eligible ? `${Math.round(r.returned / r.eligible * 100)}%` : 'Рано считать'])} /><p className={styles.note}>Учитываем только людей, за которыми успели наблюдать достаточно долго. Возврат — новое открытие экрана, нажатие или вопрос. Следующий день: 24–48 часов; через неделю: 168–192 часа.</p></> : null}
        {explore === 'sources' ? <><h3>Откуда пришли и что сделали</h3><DataTable headers={['Источник', 'Люди с аккаунтом', 'Посещения', 'Вопросы']} rows={report.acquisition.map(s => [s.source, s.users, s.visits, s.questions])} /><p className={styles.note}>Если метки источника нет, он остаётся неизвестным. Для стоимости привлечения нужны ещё расходы на рекламу.</p></> : null}
        {explore === 'versions' ? <><h3>Как ведут себя разные версии</h3><DataTable headers={['Версия', 'Посещения', 'Люди', 'Блок был виден', 'Остановки', 'Ошибки']} rows={report.versionsComparison.map(v => [v.version === 'unknown' ? 'Не передана' : v.version, v.visits, v.users, v.readVisits, v.stalled, v.errors])} /><p className={styles.note}>Разные версии могут использовать разные люди. Это сравнение наблюдений, а не случайный A/B-тест.</p></> : null}
        {explore === 'results' ? <><h3>Что приложение успело сделать</h3><DataTable headers={['Результат', 'Сколько раз', 'В скольких посещениях']} rows={report.outcomes.map(o => [o.label, o.count, o.visits])} /><h3>«Спросить»: от вопроса до ответа</h3><DataTable headers={['Шаг', 'Сколько раз']} rows={report.questionFunnel.map(s => [s.label, s.count])} /><p className={styles.note}>Отправить вопрос, получить ответ и увидеть его на экране — разные шаги. Они связаны с одним запросом в одном посещении.</p></> : null}
      </section> : null}
    </> : <>
      <div className={styles.panelHeader}><div><h3>Что проверить и как улучшить</h3><p>Подсказки из записанных действий. Сначала посмотри примеры, затем выбирай изменение.</p></div><span className={styles.tag}>По данным выбранного периода</span></div>
      {busy ? <p role="status">Готовим подсказки…</p> : error ? errorState(error) : report ? <div className={styles.insights}>{[...report.insights, ...(journeys?.insights || [])].map((insight, index) => <article key={`${index}:${insight.title}`}><span className={styles.insightIndex}>0{index + 1}</span><div><h4>{insight.title}</h4><p><strong>Что увидели.</strong> {insight.evidence}</p><p><strong>Следующий шаг.</strong> {insight.recommendation}</p>{canUsers && 'visitIds' in insight && insight.visitIds?.length ? <div className={styles.exampleLinks}>{insight.visitIds.map((id, i) => <button key={id} className={styles.button} type="button" onClick={() => choose(`visit:${id}`, report.visits.find(v => v.id === id)?.name || 'Посещение')}>Открыть пример {i + 1}<ArrowRight size={14} /></button>)}</div> : null}</div></article>)}</div> : null}
    </>}
  </div>;
}
