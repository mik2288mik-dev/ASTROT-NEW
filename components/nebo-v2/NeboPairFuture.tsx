import React, { useEffect, useRef, useState } from 'react';
import { getMoscowTodayKey } from '../../lib/date-utils';
import { getPersonalFutureTimelineStops } from '../../lib/personalFutureForecastContract';
import { PAIR_FUTURE_TOPICS, PAIR_QUESTIONS, pairFutureTopics, type PairFutureRequest, type PairFutureReading, type PairFutureTopic } from '../../lib/synastry/pairFutureContract';
import { loadPairFuture } from '../../services/pairFutureService';
import { NeboFutureTimeline } from './NeboFutureTimeline';
import { Glyph } from './Primitives';
import styles from './NeboPairFuture.module.css';

export type PairSubject = Pick<PairFutureRequest, 'mode' | 'signA' | 'signB' | 'relation' | 'language' | 'chartId' | 'partnerChartId' | 'partnerDate'>;
type Props = { pair: PairSubject; names: string; premium: boolean; onPremium: () => void };
function usePairReading(pair: PairSubject, premium: boolean, onPremium: () => void) {
  const [value, setValue] = useState<PairFutureReading | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [code, setCode] = useState('');
  const active = useRef<AbortController | null>(null);
  const identity = JSON.stringify(pair), latest = useRef(identity); latest.current = identity;
  const reset = () => { active.current?.abort(); active.current = null; setValue(null); setPhase('idle'); setCode(''); };
  useEffect(() => { reset(); return () => active.current?.abort(); }, [identity, premium]);
  async function read(selection: PairFutureRequest) {
    if (!premium) { onPremium(); return; }
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    const key = identity; setValue(null); setCode(''); setPhase('loading');
    const started = Date.now();
    try {
      const result = await loadPairFuture(selection, controller.signal);
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && Date.now() - started < 600) await new Promise<void>(resolve => window.setTimeout(resolve, 600 - (Date.now() - started)));
      if (controller.signal.aborted || latest.current !== key) return;
      setValue(result); setPhase('ready');
    } catch (error) {
      if (controller.signal.aborted || latest.current !== key) return;
      const failure = error as { status?: number; code?: string };
      setCode(failure.status === 401 ? 'LOGIN_REQUIRED' : failure.code || 'UNAVAILABLE'); setPhase('error');
      if (failure.status === 403) onPremium();
    }
  }
  return { value, phase, code, reset, read };
}
function failureText(code: string, en: boolean) {
  if (code === 'LOGIN_REQUIRED') return en ? 'Sign in to get a reading for your selected people.' : 'Войди в аккаунт, чтобы получить ответ для выбранных людей.';
  if (code === 'CHOOSE_FAMILY_CONTEXT') return en ? 'Choose a family or friendship context when comparing a child.' : 'Для сравнения с ребёнком выбери «Родственники» или «Друзья».';
  if (code === 'PAIR_CHART_REQUIRED' || code === 'PAIR_CHART_NOT_FOUND') return en ? 'Choose saved birth details for these people.' : 'Выбери сохранённые данные рождения этих людей.';
  if (code === 'PAIR_PROVIDER_UNAVAILABLE') return en ? 'The reading service is not connected yet.' : 'Сервис ответов пока не подключён.';
  return en ? 'The answer did not load. Try again.' : 'Ответ не загрузился. Попробуй ещё раз.';
}
function Reading({ value, en }: { value: PairFutureReading; en: boolean }) {
  return <><h3>{value.headline}</h3><p>{value.text}</p><small>{value.basis === 'signs' ? (en ? 'Based on two zodiac signs' : 'По двум знакам зодиака') : value.basis === 'charts' ? (en ? 'Based on two saved birth charts' : 'По двум сохранённым натальным картам') : (en ? 'Based on birth dates and available chart data' : 'По датам рождения и доступным данным карт')}</small></>;
}
export function NeboPairFuture({ pair, names, premium, onPremium }: Props) {
  const en = pair.language === 'en';
  const [today, setToday] = useState(getMoscowTodayKey);
  const [stop, setStop] = useState(() => getPersonalFutureTimelineStops(today)[0]);
  const [topic, setTopic] = useState<PairFutureTopic>('general');
  const reading = usePairReading(pair, premium, onPremium);
  const topics = pairFutureTopics(pair.relation), stops = getPersonalFutureTimelineStops(today);
  const selectedTopic = topics.includes(topic) ? topic : 'general';
  const index = stops.findIndex(value => value.date === stop.date && value.period === stop.period && value.endDate === stop.endDate);
  const selection = { ...pair, ...stop, kind: 'future' as const, topic: selectedTopic };
  const changeStop = (value: typeof stop) => { reading.reset(); setStop(value); };
  useEffect(() => {
    const refresh = () => { const next = getMoscowTodayKey(); if (next !== today) { setToday(next); changeStop(getPersonalFutureTimelineStops(next)[0]); } };
    const timer = window.setInterval(refresh, 60000); document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [today]);
  const [year, month, day] = stop.date.split('-');
  const dateLabel = new Intl.DateTimeFormat(en ? 'en-GB' : 'ru-RU', { ...(stop.period === 'month' ? {} : { day: 'numeric' as const }), month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${stop.date}T12:00:00Z`));
  return <div className={styles.future}>
    <h2>{en ? 'Your future together' : 'Ваше будущее'}</h2><p className={styles.names}>{names}</p>
    <div className={styles.stage} data-phase={reading.phase} aria-live="polite" aria-busy={reading.phase === 'loading'}>
      {reading.phase === 'idle' || reading.phase === 'loading' ? <><img src="/assets/nebo-refined/compatibility-v1/hero.webp" alt=""/><div className={styles.stageCopy}><small>{en ? 'Time machine for two' : 'Машина времени для двоих'}</small><h3>{en ? 'What lies ahead for you?' : 'Что вас ждёт впереди?'}</h3></div>{reading.phase === 'loading' ? <span className={styles.pending}>{en ? 'Preparing your reading…' : 'Готовим ваш прогноз…'}</span> : null}</> : <article className={styles.answer}><time>{dateLabel}{stop.endDate ? ` — ${stop.endDate.slice(8)}.${stop.endDate.slice(5, 7)}` : ''} · {PAIR_FUTURE_TOPICS[selectedTopic][en ? 1 : 0]}</time>{reading.value ? <Reading value={reading.value} en={en}/> : <p role="alert">{failureText(reading.code, en)}</p>}</article>}
    </div>
    <div className={styles.controls}>
      <NeboFutureTimeline today={today} {...stop} en={en} onChange={changeStop}/>
      <div className={styles.dateRow}><button type="button" disabled={index <= 0} aria-label={en ? 'Previous date' : 'Предыдущая дата'} onClick={() => changeStop(stops[index - 1])}><Glyph name="back" size={18}/></button><div className={styles.digits} aria-label={dateLabel}><span><small>{en ? 'DAY' : 'ДЕНЬ'}</small><b>{stop.period === 'month' ? '—' : stop.endDate ? `${day}–${stop.endDate.slice(8)}` : day}</b></span><span><small>{en ? 'MONTH' : 'МЕСЯЦ'}</small><b>{month}</b></span><span><small>{en ? 'YEAR' : 'ГОД'}</small><b>{year}</b></span></div><button type="button" disabled={index < 0 || index === stops.length - 1} aria-label={en ? 'Next date' : 'Следующая дата'} onClick={() => changeStop(stops[index + 1])}><Glyph name="next" size={18}/></button></div>
      <div className={styles.topics} role="group" aria-label={en ? 'Topic for two' : 'Тема для двоих'}>{topics.map(value => <button type="button" key={value} aria-pressed={selectedTopic === value} onClick={() => { reading.reset(); setTopic(value); }}>{PAIR_FUTURE_TOPICS[value][en ? 1 : 0]}</button>)}</div>
      <button className={styles.primary} type="button" disabled={reading.phase === 'loading' || reading.phase === 'ready' || index < 0} onClick={() => void reading.read(selection)}>{!premium ? (en ? 'Open with NEBO+' : 'Открыть с NEBO+') : reading.phase === 'loading' ? (en ? 'Preparing…' : 'Готовим…') : reading.phase === 'ready' ? (en ? 'Forecast opened' : 'Прогноз открыт') : reading.phase === 'error' ? (en ? 'Try again' : 'Повторить') : (en ? 'See your future' : 'Узнать, что впереди')}<Glyph name="next" size={18}/></button>
    </div>
  </div>;
}
export function NeboPairQuestions({ pair, names, premium, onPremium }: Props) {
  const en = pair.language === 'en', reading = usePairReading(pair, premium, onPremium);
  const [topic, setTopic] = useState<PairFutureTopic | null>(null);
  const choices = pairFutureTopics(pair.relation).filter(value => PAIR_QUESTIONS[value]);
  const select = (value: PairFutureTopic) => { setTopic(value); void reading.read({ ...pair, kind: 'question', date: getMoscowTodayKey(), period: 'day', topic: value }); };
  return <section className={styles.questions}>
    <h2>{en ? 'A question about you two' : 'Вопрос про вас'}</h2><p>{names} · {en ? 'Choose a question' : 'Выбери, что интересно'}</p>
    <div className={styles.questionButtons}>{choices.map(value => <button type="button" key={value} aria-pressed={topic === value && reading.phase !== 'idle'} onClick={() => select(value)}>{PAIR_QUESTIONS[value]?.[en ? 1 : 0]}<Glyph name="next" size={16}/></button>)}</div>
    <div aria-live="polite" aria-busy={reading.phase === 'loading'}>{reading.phase === 'loading' ? <p className={styles.questionLoading}>{en ? 'Preparing an answer for you two…' : 'Готовим ответ про вас…'}</p> : reading.value ? <article className={styles.answer}><Reading value={reading.value} en={en}/></article> : reading.phase === 'error' ? <div className={styles.answer}><p role="alert">{failureText(reading.code, en)}</p><button type="button" className={styles.primary} onClick={() => topic && select(topic)}>{en ? 'Try again' : 'Повторить'}</button></div> : null}</div>
    {!premium ? <small>{en ? 'Answers about you two — with NEBO+' : 'Ответы про вас — с NEBO+'}</small> : null}
  </section>;
}
