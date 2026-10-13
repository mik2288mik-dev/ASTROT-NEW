import React from 'react';
import { ArrowRight, CircleCheck, CircleDashed, CornerDownRight, LogIn, Pause, UserRound } from 'lucide-react';
import type { AppTraceReport, JourneyReport } from '../../services/admin2Service';
import { TRACE_SCREEN_LABELS } from '../../lib/appTelemetry';
import styles from './AdminJourneys.module.css';

export type JourneyFilter = { status?: string; reached?: number; lostAfter?: number; step?: string };
export const JOURNEY_STATUS: Record<string, string> = { created: 'Прошёл', without_chart: 'Без карты', sign_in: 'Перешёл ко входу', pending: 'Ещё может продолжить', no_continuation: 'Остановился' };
export const VISIT_STATUS: Record<string, string> = { stopped: 'Нет действий 30 мин', recent: 'Недавно заходил', continued: 'Продолжил позже' };
const number = (value: number) => value.toLocaleString('ru-RU');
const FUNNEL_LABELS = ['Знакомство', 'Ввод данных', 'Данные отправлены', 'Разбор готов', 'Результат открыт'];

export function OnboardingFlow({ report, onSelect, canSelect }: { report: JourneyReport; onSelect: (filter: JourneyFilter) => void; canSelect: boolean }) {
  const first = report.funnel[0]?.count || 0;
  return <>
    <div className={styles.panelHeader}><div><h3>Как проходят первый вход</h3><p>Нажми на шаг или на потерю между шагами — увидишь конкретные попытки.</p></div><span className={styles.tag}>5 основных шагов</span></div>
    {report.truncated ? <p className={styles.error}>Записей много: график построен по части данных. Выбери период короче.</p> : null}
    {!first ? <div className={styles.empty}>Пока нет записанных прохождений. График заполнится после обновления приложения у людей.</div> : <div className={styles.graphScroll} tabIndex={0} aria-label="График прохождения первого входа, можно прокручивать">
      <div className={styles.funnelCanvas}>
        <svg viewBox="0 0 1000 290" aria-hidden="true" className={styles.funnelSvg}>
          {report.funnel.slice(0, -1).map((step, i) => {
            const next = report.funnel[i + 1]; const start = 124 + i * 195; const end = start + 195;
            const h1 = Math.max(6, 104 * step.count / first); const h2 = Math.max(3, 104 * next.count / first);
            return <path key={i} d={`M ${start} ${150 - h1 / 2} C ${start + 95} ${150 - h1 / 2}, ${end - 95} ${150 - h2 / 2}, ${end} ${150 - h2 / 2} L ${end} ${150 + h2 / 2} C ${end - 95} ${150 + h2 / 2}, ${start + 95} ${150 + h1 / 2}, ${start} ${150 + h1 / 2} Z`} fill={i === 3 ? '#55d9aa' : '#4edbe2'} fillOpacity={.16 + i * .025} />;
          })}
        </svg>
        {report.funnel.map((step, i) => <div className={styles.funnelStage} key={step.label} style={{ left: `${2 + i * 19.5}%` }}>
          <span className={styles.stageIndex}>0{i + 1}</span>
          <button type="button" disabled={!canSelect} className={styles.stageNode} data-tone={i === 4 ? 'success' : 'flow'} onClick={() => onSelect({ reached: i + 1 })} aria-label={`${step.label}: ${step.count}. Показать попытки`}>
            <span>{FUNNEL_LABELS[i] || step.label}</span><strong>{number(step.count)}</strong><small>{step.percent == null ? '—' : `${step.percent}%`} от начала</small>
          </button>
          {i < report.funnel.length - 1 ? <button type="button" className={styles.lossButton} disabled={!canSelect || step.count === report.funnel[i + 1].count} onClick={() => onSelect({ lostAfter: i + 1 })}>
            <CornerDownRight size={14} aria-hidden="true" /> {number(Math.max(0, step.count - report.funnel[i + 1].count))} не дошли дальше
          </button> : <span className={styles.finishLabel}><CircleCheck size={14} aria-hidden="true" /> Получили результат</span>}
        </div>)}
      </div>
    </div>}
    <div className={styles.outcomeStrip} aria-label="Итоги первого входа">{[
      ['created', report.summary.created, CircleCheck], ['without_chart', report.summary.withoutChart, UserRound],
      ['no_continuation', report.summary.noContinuation, Pause], ['pending', report.summary.pending, CircleDashed],
      ['sign_in', report.summary.signIn, LogIn],
    ].map(([status, count, Icon]) => {
      const StatusIcon = Icon as typeof CircleCheck;
      return <button key={String(status)} type="button" disabled={!canSelect} data-status={status} onClick={() => onSelect({ status: String(status) })}><StatusIcon size={17} aria-hidden="true" /><span>{JOURNEY_STATUS[String(status)]}</span><strong>{number(Number(count))}</strong></button>;
    })}</div>
    <p className={styles.note}>«Не дошли дальше» включает пропуск, ожидание и остановку. «Остановился» — нет продолжения более 30 минут; человек ещё может вернуться.</p>
  </>;
}

export function AppFlow({ report, onSelect, canSelect }: { report: AppTraceReport; onSelect: (screen: string) => void; canSelect: boolean }) {
  const links = report.transitions.slice(0, 8);
  const sources = [...new Set(links.map(link => link.from))]; const targets = [...new Set(links.map(link => link.to))];
  const height = Math.max(sources.length, targets.length, 3) * 88;
  const max = Math.max(1, ...links.map(link => link.visits));
  return <>
    <div className={styles.panelHeader}><div><h3>Куда переходят в приложении</h3><p>Восемь самых частых переходов между соседними экранами. Нажми на экран, чтобы выбрать посещения.</p></div><ArrowRight size={22} aria-hidden="true" /></div>
    {!links.length ? <p className={styles.empty}>Переходы появятся, когда в одном посещении будут открыты хотя бы два разных экрана.</p> : <>
      <div className={styles.graphScroll} tabIndex={0} aria-label="Карта переходов между экранами, можно прокручивать"><div className={styles.routeCanvas} style={{ height }}>
        <svg viewBox={`0 0 1000 ${height}`} className={styles.routeSvg} aria-hidden="true">
          {links.map(link => {
            const from = sources.indexOf(link.from) * 88 + 44; const to = targets.indexOf(link.to) * 88 + 44;
            return <path key={`${link.from}:${link.to}`} d={`M 270 ${from} C 490 ${from}, 510 ${to}, 730 ${to}`} stroke="#4edbe2" strokeWidth={4 + link.visits / max * 24} strokeOpacity={.14 + link.visits / max * .24} fill="none" />;
          })}
        </svg>
        {[sources, targets].map((nodes, column) => nodes.map((screen, i) => <button key={`${column}:${screen}`} type="button" disabled={!canSelect} className={styles.routeNode} style={{ top: i * 88 + 10, left: column ? '73%' : '1%' }} onClick={() => onSelect(screen)}>
          <span>{TRACE_SCREEN_LABELS[screen] || 'Другой экран'}</span><small>{report.screens.find(s => s.key === screen)?.views || 0} открытий</small><ArrowRight size={15} aria-hidden="true" />
        </button>))}
      </div></div>
      <details className={styles.question}><summary>Сколько посещений в каждом переходе</summary><ul className={styles.transitionList}>{links.map(link => <li key={`${link.from}:${link.to}`}><span>{TRACE_SCREEN_LABELS[link.from]} → {TRACE_SCREEN_LABELS[link.to]}</span><strong>{link.visits}</strong></li>)}</ul></details>
    </>}
    <p className={styles.note}>Толще линия — больше посещений. Повтор одного перехода в том же посещении считается один раз. Между разными посещениями линии не строятся.</p>
  </>;
}
