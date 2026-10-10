import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Clock3, MousePointer2, AlertTriangle, MessageSquare, Monitor } from 'lucide-react';
import { admin2, type AppTraceDetail, type JourneyDetail } from '../../services/admin2Service';
import { TRACE_SCREEN_LABELS } from '../../lib/appTelemetry';
import { STEP_LABELS } from '../../lib/journeyTelemetry';
import { detailLabel, readableLabel, traceNote } from '../../lib/admin/telemetryCopy';
import { JOURNEY_STATUS } from './AnalyticsFlow';
import styles from './AdminJourneys.module.css';

export const analyticsSeconds = (ms: number | null | undefined) => ms == null ? 'Не измерено' : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(ms / 1000)} с`;
const screenDuration = (ms: number | null | undefined) => ms == null ? 'Время не измерено' : `${analyticsSeconds(ms)} на экране`;
export const analyticsTime = (at: string | number) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(at));
const clock = (at: string | number) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(at));
type Props = { selected: string; name: string; detail: AppTraceDetail | null; busy: boolean; error: string; range: { from: string; to: string }; refresh: number; attemptId?: string; initialVisit?: string; onClose: () => void; onRetry: () => void };

export function AnalyticsPerson({ selected, name, detail, busy, error, range, refresh, attemptId, initialVisit, onClose, onRetry }: Props) {
  const [kind, setKind] = useState('main'); const [visit, setVisit] = useState('');
  const [onboarding, setOnboarding] = useState<JourneyDetail | null>(null); const [journeyError, setJourneyError] = useState(''); const [journeyBusy, setJourneyBusy] = useState(false);
  const [attempt, setAttempt] = useState('');
  useEffect(() => {
    setKind(attemptId ? 'onboarding' : 'main'); setVisit(initialVisit || ''); setAttempt(attemptId || '');
  }, [selected, attemptId, initialVisit]);
  useEffect(() => {
    setOnboarding(null); setJourneyError('');
    if (!selected.startsWith('user:')) return;
    let current = true; setJourneyBusy(true);
    admin2.userJourney(selected.slice(5), { ...range, period: 'custom', timezone: 'Europe/Moscow' })
      .then(data => { if (current) { setOnboarding(data); setAttempt(previous => data.attempts.some(a => a.id === previous) ? previous : data.attempts[0]?.id || ''); } })
      .catch(e => { if (current) setJourneyError(e instanceof Error ? e.message : 'Не удалось открыть первый вход.'); })
      .finally(() => { if (current) setJourneyBusy(false); });
    return () => { current = false; };
  }, [selected, range, refresh]);
  const visits = useMemo(() => {
    const grouped = new Map<string, AppTraceDetail['events']>();
    for (const event of detail?.events || []) { const events = grouped.get(event.visitId) || []; events.push(event); grouped.set(event.visitId, events); }
    return [...grouped].map(([id, events]) => ({ id, events: events.sort((a, b) => a.sequence - b.sequence || a.at - b.at) })).sort((a, b) => b.events[0].at - a.events[0].at);
  }, [detail]);
  const active = visits.find(v => v.id === visit) || visits[0];
  const viewTimes = useMemo(() => {
    const times = new Map<string, number>();
    for (const event of active?.events || []) if (typeof event.payload.visible_ms === 'number') {
      const key = String(event.payload.view_id); times.set(key, Math.max(times.get(key) || 0, event.payload.visible_ms));
    }
    return times;
  }, [active]);
  const screens = active?.events.filter(e => e.type === 'screen_view' || e.type === 'section_view') || [];
  const events = active?.events.filter(e => kind === 'all' || kind === 'requests' && e.type.startsWith('request_') || kind === 'questions' && e.type.startsWith('question_')
    || kind === 'main' && !['screen_progress', 'section_exit', 'content_view', 'control_view', 'field_changed', 'request_started'].includes(e.type)).slice(-2000) || [];
  const journey = onboarding?.attempts.find(a => a.id === attempt);
  const failed = active?.events.filter(e => e.type === 'client_error' || ['http_error', 'network_error', 'failed'].includes(String(e.payload.outcome))).length || 0;
  return <section className={styles.personDetail} aria-label={`История: ${name}`}>
    <div className={styles.personHeader}><button type="button" className={styles.iconButton} aria-label="Закрыть историю и вернуться к списку" onClick={onClose}><ArrowLeft size={20} /></button><div><span className={styles.eyebrow}>ИСТОРИЯ ПОЛЬЗОВАТЕЛЯ</span><h3>{name}</h3></div><span className={styles.tag}>{selected.startsWith('user:') ? `ID ${selected.slice(5)}` : 'Одно посещение'}</span></div>
    {busy ? <p role="status" className={styles.empty}>Открываем историю…</p> : error ? <p role="alert" className={styles.error}>{error} <button className={styles.button} type="button" onClick={onRetry}>Повторить</button></p> : detail ? <>
      {detail.truncated ? <p className={styles.error}>История ограничена числом записей. Сузь период, чтобы увидеть все действия.</p> : null}
      <p className={styles.note}>История за выбранный период · все версии приложения</p><div className={styles.detailToolbar}><label>Посещение<select value={active?.id || ''} onChange={e => setVisit(e.target.value)}>{visits.map(v => <option key={v.id} value={v.id}>{analyticsTime(v.events[0].at)} · записей: {v.events.length}</option>)}</select></label></div>
      <div className={styles.smallMetrics}><span><Monitor size={16} />Экранов: {screens.length}</span><span><MousePointer2 size={16} />Нажатий: {active?.events.filter(e => e.type === 'ui_click').length || 0}</span><span data-tone={failed ? 'warning' : 'muted'}><AlertTriangle size={16} />Ошибок: {failed}</span></div>
      <nav className={styles.subnav} aria-label="Что показать в истории">{[['main', 'Путь и действия'], ['requests', 'Ожидание'], ['questions', 'Спросить'], ...(selected.startsWith('user:') ? [['onboarding', 'Первый вход']] : []), ['all', 'Все события']].map(([key, label]) => <button key={key} type="button" aria-pressed={kind === key} onClick={() => setKind(key)}>{label}</button>)}</nav>
      {kind === 'onboarding' ? <>
        {journeyBusy ? <p role="status">Загружаем первый вход…</p> : journeyError ? <p role="alert" className={styles.error}>{journeyError} <button type="button" className={styles.button} onClick={onRetry}>Повторить</button></p> : !journey ? <p className={styles.empty}>Первый вход за этот период не записан. Смотри остальные посещения или расширь период.</p> : <>
          <label>Попытка<select value={attempt} onChange={e => setAttempt(e.target.value)}>{onboarding?.attempts.map(a => <option key={a.id} value={a.id}>{analyticsTime(a.startedAt)} · {JOURNEY_STATUS[a.status]}</option>)}</select></label>
          <p className={styles.statusNote} data-status={journey.status}>{JOURNEY_STATUS[journey.status]} · последнее окно: {STEP_LABELS[journey.lastStep] || 'Не записано'}</p>
          {journey.status === 'no_continuation' ? <p className={styles.note}>Дальше нет действий более 30 минут. Это место остановки, а не доказанная причина ухода.</p> : null}
          <ol className={styles.journeyRail} aria-label="Окна первого входа">{journey.events.filter(e => e.type === 'onboarding_step_view').map((e, i, rows) => {
            const samples = journey.events.filter(x => x.payload.view_id === e.payload.view_id && typeof x.payload.visible_ms === 'number').map(x => Number(x.payload.visible_ms));
            return <li key={e.id} data-tone={i === rows.length - 1 && journey.status === 'no_continuation' ? 'warning' : 'flow'}><span className={styles.railMarker}>{i + 1}</span><div><strong>{STEP_LABELS[String(e.payload.step)]}</strong><span>{clock(e.at)} · {screenDuration(samples.length ? Math.max(...samples) : null)}</span></div></li>;
          })}</ol>
          <ol className={styles.timeline}>{journey.events.filter(e => !['onboarding_step_progress', 'onboarding_wait_progress', 'onboarding_video'].includes(e.type)).map(e => <li key={e.id}><time dateTime={e.at}>{clock(e.at)}</time><div><strong>{e.label}</strong><span className={styles.eventScreen}>{STEP_LABELS[String(e.payload.step)]}</span><p>{traceNote(e.payload, analyticsSeconds)}</p></div></li>)}</ol>
        </>}
      </> : <>
        {kind === 'main' && screens.length ? <><h4 className={styles.sectionTitle}>Маршрут за это посещение</h4><ol className={styles.journeyRail}>{screens.slice(-100).map((e, i) => <li key={e.id}><span className={styles.railMarker}>{i + 1}</span><div><strong>{TRACE_SCREEN_LABELS[e.screen] || 'Другой экран'}{e.payload.detail ? ` / ${detailLabel(e.payload.detail)}` : ''}</strong><span>{clock(e.at)} · {screenDuration(viewTimes.get(String(e.payload.view_id)))}</span></div></li>)}</ol>{screens.length > 100 ? <p className={styles.note}>Показаны 100 последних окон этого посещения.</p> : null}</> : null}
        <h4 className={styles.sectionTitle}>{kind === 'requests' ? 'Что загружалось и сколько ждал' : kind === 'questions' ? 'Ввод вопроса и получение ответа' : 'Что происходило по времени'}</h4>
        <ol className={styles.timeline}>{events.map(e => {
          const failure = ['http_error', 'network_error', 'failed'].includes(String(e.payload.outcome)) || e.type === 'client_error';
          const Icon = failure ? AlertTriangle : e.type.startsWith('request_') ? Clock3 : e.type.startsWith('question_') ? MessageSquare : e.type === 'ui_click' ? MousePointer2 : e.type === 'screen_view' ? Monitor : Check;
          return <li key={e.id} data-tone={failure ? 'warning' : 'flow'}><time dateTime={new Date(e.at).toISOString()}>{clock(e.at)}</time><div className={styles.eventIcon}><Icon size={15} aria-hidden="true" /></div><div><strong>{readableLabel(e.label, 'Действие в приложении')}</strong><span className={styles.eventScreen}>{TRACE_SCREEN_LABELS[e.screen]}</span><p>{traceNote(e.payload, analyticsSeconds)}</p>{typeof e.payload.text === 'string' ? <blockquote className={styles.questionText}>{e.payload.text || '(текст удалён)'}</blockquote> : null}<details className={styles.technical}><summary>Для разработчика</summary><pre>{JSON.stringify({ event: e.type, ...Object.fromEntries(Object.entries(e.payload).filter(([key]) => key !== 'text')) }, null, 2)}</pre></details></div></li>;
        })}</ol>
        {!events.length ? <p className={styles.empty}>Таких событий в этом посещении нет.</p> : null}
        {active && active.events.length > 2000 ? <p className={styles.note}>Показаны до 2000 последних событий. Сузь период для более ранних записей.</p> : null}
        {kind === 'questions' ? <><h4 className={styles.sectionTitle}>Сохранённые вопросы и ответы за выбранный период</h4><p className={styles.note}>Для человека показана история за весь период; для отдельного посещения — связанные с ним сообщения.</p>{detail.questionsTruncated ? <p className={styles.note}>Показаны 500 последних сообщений. Для более ранних сузь период.</p> : null}{detail.canReadText ? detail.questions.length ? detail.questions.map(q => <details className={styles.question} key={q.id}><summary><MessageSquare size={15} aria-hidden="true" /> {q.role === 'user' ? 'Вопрос' : 'Ответ'} #{q.id} · {analyticsTime(q.at)}{q.questionId ? ` · к вопросу #${q.questionId}` : ''}</summary><p>{q.text}</p></details>) : <p className={styles.empty}>Сохранённых сообщений за период нет.</p> : <p className={styles.empty}>Для чтения вопросов и ответов нужно право просмотра личных данных.</p>}</> : null}
      </>}
    </> : null}
    {!busy && detail && !detail.events.length ? <p className={styles.note}>Подробная история начнёт появляться после обновления приложения у человека.</p> : null}
  </section>;
}
