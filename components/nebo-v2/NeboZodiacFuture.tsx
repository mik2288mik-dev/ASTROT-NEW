import React, { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../../types';
import type { ZodiacKey } from '../../lib/zodiacKeys';
import { getMoscowTodayKey } from '../../lib/date-utils';
import { hasActivePremium } from '../../lib/accessMatrix';
import { SIGN_FUTURE_LABELS, SIGN_FUTURE_TOPICS, signFutureStops, type SignFutureTopic, type SignFutureReading, type SignFutureSelection } from '../../lib/horoscope/signFutureContract';
import { loadZodiacFuture, type ZodiacFutureClientError } from '../../services/zodiacFutureService';
import { NeboFutureTimeline } from './NeboFutureTimeline';
import { Glyph } from './Primitives';
import styles from './NeboZodiac.module.css';

type Props = { profile: UserProfile; sign: ZodiacKey; preview: boolean; onPremium: () => void };
const previews: Record<SignFutureTopic, string> = {
  general: 'Обычный разговор может неожиданно прояснить то, над чем ты долго думал. Договориться о небольшом деле, вероятно, будет проще, чем о грандиозных планах.',
  luck: 'Полезный ответ может найтись там, где ты уже перестал его искать. Небольшое совпадение вполне способно сэкономить время.',
  work: 'В делах может стать понятнее, какой вопрос мешал закончить начатое. Одного уточнения иногда хватает, чтобы не переписывать всё заново.',
  love: 'Повод для тёплого разговора может оказаться совсем простым. Короткое приглашение на прогулку, вероятно, прозвучит лучше тщательно придуманной речи.',
  money: 'Разница между похожими предложениями может оказаться в мелкой строчке. На знакомую покупку вполне может найтись более удобное условие.',
  family: 'Договориться о бытовом вопросе может быть проще за обычным разговором. Повод вспомнить что-то смешное тоже может найтись неожиданно.',
  communication: 'Короткое сообщение может показаться резче, чем прозвучит та же фраза вслух. В разговоре будет проще уточнить, что человек имел в виду.',
};

export function NeboZodiacFuture({ profile, sign, preview, onPremium }: Props) {
  const en = profile.language === 'en', premium = hasActivePremium(profile);
  const [today, setToday] = useState(getMoscowTodayKey);
  const [stop, setStop] = useState(() => signFutureStops(today)[0]);
  const [topic, setTopic] = useState<SignFutureTopic>('general');
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error' | 'locked'>('idle');
  const [reading, setReading] = useState<SignFutureReading | null>(null);
  const [scene, setScene] = useState<'intro' | 'departing' | 'result'>('intro');
  const active = useRef<AbortController | null>(null), inProgress = useRef(false);
  const stops = signFutureStops(today);
  const index = stops.findIndex(item => item.date === stop.date && item.period === stop.period && item.endDate === stop.endDate);
  const locked = !premium;
  const selection: SignFutureSelection = { ...stop, sign, topic, language: en ? 'en' : 'ru' };
  const identity = [profile.id, sign, topic, stop.date, stop.endDate, stop.period, en, premium, today].join('|');
  const latest = useRef(identity); latest.current = identity;

  useEffect(() => {
    active.current?.abort(); inProgress.current = false; setReading(null); setPhase('idle'); setScene('intro');
    return () => active.current?.abort();
  }, [identity]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'visible') return; const day = getMoscowTodayKey(); setToday(day); setStop(current => signFutureStops(day).some(value => value.date === current.date && value.period === current.period && value.endDate === current.endDate) ? current : signFutureStops(day)[0]); };
    const timer = window.setInterval(refresh, 60000); document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);

  async function read() {
    if (inProgress.current || index < 0) return;
    if (locked || phase === 'locked') { onPremium(); return; }
    inProgress.current = true;
    const controller = new AbortController(); active.current = controller;
    const key = identity;
    setReading(null); setPhase('loading'); setScene('departing');
    const animation = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? Promise.resolve() : new Promise<void>(resolve => {
      const finish = () => { window.clearTimeout(timer); controller.signal.removeEventListener('abort', finish); resolve(); };
      const timer = window.setTimeout(finish, 650);
      controller.signal.addEventListener('abort', finish, { once: true });
    });
    try {
      // UI Preview is synthetic and never calls a paid provider or production API.
      const result: SignFutureReading = preview ? { ...selection, status: 'ready', headline: en ? 'A look ahead' : 'Что может ждать впереди', text: en ? 'A short conversation may make an unclear task simpler. An ordinary detail could turn out to be more useful than a long explanation.' : previews[topic] } : await loadZodiacFuture(selection, controller.signal);
      await animation;
      if (controller.signal.aborted || latest.current !== key) return;
      if (result.status !== 'ready') throw new Error('Not ready');
      setReading(result); setPhase('ready'); setScene('result');
    } catch (error) {
      if (controller.signal.aborted || latest.current !== key) return;
      const failure = error as ZodiacFutureClientError;
      setPhase(failure.status === 403 ? 'locked' : 'error'); setScene('result');
    } finally { if (active.current === controller) inProgress.current = false; }
  }
  const [year, month, day] = stop.date.split('-');
  const dayText = stop.period === 'month' ? '—' : stop.endDate ? `${day}–${stop.endDate.slice(8)}` : day;
  const fmt = (date: string, monthOnly = false) => new Intl.DateTimeFormat(en ? 'en-GB' : 'ru-RU', { ...(monthOnly ? {} : { day: 'numeric' as const }), month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
  const dateLabel = stop.period === 'month' ? fmt(stop.date, true) : stop.endDate ? `${Number(day)}–${fmt(stop.endDate)}` : fmt(stop.date);
  const selectStop = (value: typeof stop) => { setStop(value); };
  return <section className={styles.future} aria-label={en ? 'Future dates' : 'Будущие даты'}>
    <div className={styles.watchStage} data-scene={scene} aria-live="polite" aria-busy={phase === 'loading'}>
      {scene !== 'result' ? <div key={identity} className={styles.watchIntro}>
        <div className={styles.watchCopy}><span>{en ? 'Time machine' : 'Машина времени'}</span><h3>{en ? 'Your sign. Your future.' : 'Узнай своё будущее'}</h3><p>{en ? 'Choose when. Discover what may be ahead.' : 'Выбери дату. Посмотрим, что впереди.'}</p></div>
        <img className={styles.watchArt} src="/assets/nebo-refined/zodiac-v1/nebo-watch-scene-v3.webp?v=1" alt={en ? 'NEBO watch with zodiac signs on the dial' : 'Часы NEBO со знаками зодиака на циферблате'}/>
      </div> : reading ? <article className={styles.watchReading}><time>{dateLabel} · {SIGN_FUTURE_LABELS[topic][en ? 1 : 0]}</time><h3>{reading.headline}</h3><p>{reading.text}</p></article> : <div className={styles.watchReading}><h3>{phase === 'locked' ? (en ? 'More with NEBO+' : 'Будущее с NEBO+') : (en ? 'Please try again' : 'Попробуем ещё раз?')}</h3><p>{phase === 'locked' ? (en ? 'Open this forecast with a subscription.' : 'Этот прогноз доступен с подпиской.') : (en ? 'The forecast did not load. Your selected date is saved.' : 'Прогноз не загрузился. Выбранная дата осталась на месте.')}</p></div>}
      {phase === 'loading' ? <span className={styles.watchLoading}>{en ? 'Preparing your forecast…' : 'Готовим прогноз…'}</span> : null}
    </div>
    <div className={styles.timelineShortcuts} role="group" aria-label={en ? 'Time scale' : 'Масштаб времени'}>{(['day', 'week', 'month'] as const).map((value, position) => <button type="button" key={value} disabled={!stops.some(item => item.period === value)} aria-pressed={stop.period === value} onClick={() => { const next = stops.find(item => item.period === value); if (next) selectStop(next); }}>{(en ? ['Day', 'Week', 'Month'] : ['День', 'Неделя', 'Месяц'])[position]}</button>)}</div>
    <NeboFutureTimeline today={today} {...stop} en={en} onChange={selectStop}/>
    <div className={styles.dateRow}>
      <button type="button" className={styles.arrow} disabled={index <= 0} aria-label={en ? 'Previous date' : 'Предыдущая дата'} onClick={() => selectStop(stops[index - 1])}><Glyph name="back" size={18}/></button>
      <div className={styles.dateDisplay} role="img" aria-label={dateLabel}>
        <span aria-hidden="true"><small>{stop.period === 'week' ? (en ? 'DAYS' : 'ДНИ') : (en ? 'DAY' : 'ДЕНЬ')}</small><b className={stop.endDate ? styles.rangeDigits : ''}>{dayText}</b></span>
        <span aria-hidden="true"><small>{en ? 'MONTH' : 'МЕСЯЦ'}</small><b>{month}</b></span>
        <span aria-hidden="true"><small>{en ? 'YEAR' : 'ГОД'}</small><b>{year}</b></span>
      </div>
      <button type="button" className={styles.arrow} disabled={index < 0 || index >= stops.length - 1} aria-label={en ? 'Next date' : 'Следующая дата'} onClick={() => selectStop(stops[index + 1])}><Glyph name="next" size={18}/></button>
    </div>
    <div className={styles.topics} role="group" aria-label={en ? 'Forecast topic' : 'Тема прогноза'}>{SIGN_FUTURE_TOPICS.map(value => <button type="button" key={value} aria-pressed={topic === value} onClick={() => setTopic(value)}>{SIGN_FUTURE_LABELS[value][en ? 1 : 0]}</button>)}</div>
    {!premium ? <p className={styles.accessNote}>{en ? 'Future forecasts for every date and topic — with NEBO+.' : 'Прогнозы на будущие даты по всем темам — с NEBO+.'}</p> : null}
    <button className={styles.action} type="button" disabled={phase === 'loading' || index < 0 || phase === 'ready'} onClick={() => void read()}>{phase === 'loading' ? (en ? 'Preparing forecast' : 'Готовим прогноз') : locked || phase === 'locked' ? (en ? 'Open with NEBO+' : 'Открыть с NEBO+') : phase === 'ready' ? (en ? 'Forecast is open' : 'Прогноз открыт') : phase === 'error' ? (en ? 'Try again' : 'Повторить') : (en ? 'Read forecast' : 'Прочитать')}<Glyph name="next" size={18}/></button>
  </section>;
}



