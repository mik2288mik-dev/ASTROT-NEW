import React, { useEffect, useId, useRef, useState } from 'react';
import type { UserProfile } from '../../types';
import { hasActivePremium } from '../../lib/accessMatrix';
import { getPersonalForecastPeriodKey, normalizeForecastTimezone } from '../../lib/personalForecastContract';
import { getPersonalFutureTimelineStops, type PersonalFutureForecast, type PersonalFutureForecastPeriod, type PersonalFutureTimelineStop } from '../../lib/personalFutureForecastContract';
import { loadPersonalFutureForecast } from '../../services/personalFutureForecastService';
import { Glyph } from './Primitives';
import { NeboFutureTimeline } from './NeboFutureTimeline';
import styles from './NeboFutureJourney.module.css';

export type NeboFutureJourneyProps = {
  profile: UserProfile;
  uiPreview?: boolean;
  previewReadings?: PersonalFutureForecast[];
  onRequestPremium: () => void;
};

const topics = [
  { id: 'general', ru: 'Общий прогноз', en: 'General forecast' },
  { id: 'luck', ru: 'Удача', en: 'Luck' },
  { id: 'work', ru: 'Работа', en: 'Work' },
  { id: 'love', ru: 'Любовь', en: 'Love' },
  { id: 'money', ru: 'Деньги', en: 'Money' },
  { id: 'family', ru: 'Семья', en: 'Family' },
  { id: 'communication', ru: 'Общение', en: 'Conversations' },
] as const;
type Topic = (typeof topics)[number]['id'];
type Period = PersonalFutureForecastPeriod;
type JourneyState = PersonalFutureTimelineStop & { phase: 'idle' | 'loading' | 'ready' | 'error' | 'premium'; topic: Topic; text: string };
type Scene = 'idle' | 'departing' | 'waiting' | 'result' | 'returning';

export function NeboFutureJourney({ profile, uiPreview = false, previewReadings, onRequestPremium }: NeboFutureJourneyProps) {
  const en = profile.language === 'en';
  const timezone = normalizeForecastTimezone(profile.birthTimezone);
  const [today, setToday] = useState(() => getPersonalForecastPeriodKey('day', new Date(), timezone));
  const [selection, setSelection] = useState<PersonalFutureTimelineStop>(() => getPersonalFutureTimelineStops(today)[0]);
  const { date, period, endDate } = selection;
  const [topic, setTopic] = useState<Topic>('general');
  const [scene, setSceneState] = useState<Scene>('idle');
  const sceneRef = useRef<Scene>('idle');
  const [state, setState] = useState<JourneyState>({ phase: 'idle', ...selection, topic, text: '' });
  const requestId = useRef(0);
  const inProgress = useRef(false);
  const timers = useRef(new Map<number, () => void>());
  const id = useId();
  const busy = scene === 'departing' || scene === 'waiting' || scene === 'returning';
  const answered = scene === 'result' && state.phase === 'ready';
  const premium = hasActivePremium(profile);
  const requiresPremium = !premium;
  const timelineStops = getPersonalFutureTimelineStops(today);
  const selectedIndex = timelineStops.findIndex(stop => stop.date === date && stop.period === period && stop.endDate === endDate);
  const dateValid = selectedIndex >= 0;
  const resultTopic = topics.find(item => item.id === state.topic)!;
  const identity = [profile.id, profile.birthDate, profile.birthTime, profile.birthPlace, timezone, profile.language, premium, uiPreview].join('|');

  const setScene = (next: Scene) => {
    sceneRef.current = next;
    setSceneState(next);
  };

  const clearPending = () => {
    requestId.current += 1;
    inProgress.current = false;
    timers.current.forEach((resolve, timer) => { window.clearTimeout(timer); resolve(); });
    timers.current.clear();
  };
  const pause = (milliseconds: number) => new Promise<void>(resolve => {
    const timer = window.setTimeout(() => { timers.current.delete(timer); resolve(); }, milliseconds);
    timers.current.set(timer, resolve);
  });

  useEffect(() => {
    clearPending();
    setScene('idle');
    setState(current => ({ ...current, phase: 'idle', text: '' }));
    return clearPending;
  }, [identity, today]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      const nextToday = getPersonalForecastPeriodKey('day', new Date(), timezone);
      const nextStops = getPersonalFutureTimelineStops(nextToday);
      setToday(nextToday);
      setSelection(current => nextStops.some(stop => stop.date === current.date && stop.period === current.period && stop.endDate === current.endDate) ? current : nextStops[0]);
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [timezone]);

  const restoreVehicle = () => {
    const previousScene = sceneRef.current;
    setState(current => ({ ...current, phase: 'idle', text: '' }));
    if (previousScene === 'returning') return;
    clearPending();
    if (previousScene === 'idle' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setScene('idle');
      return;
    }
    setScene('returning');
    const returnId = requestId.current;
    void pause(500).then(() => { if (requestId.current === returnId) setScene('idle'); });
  };
  const changeDestination = (next: PersonalFutureTimelineStop) => {
    if (date === next.date && period === next.period && endDate === next.endDate) return;
    setSelection(next);
    restoreVehicle();
  };
  const changeTopic = (next: Topic) => {
    if (topic === next) return;
    setTopic(next);
    restoreVehicle();
  };

  async function travel() {
    if (inProgress.current || sceneRef.current === 'returning' || !dateValid || answered) return;
    if (requiresPremium || (sceneRef.current === 'result' && state.phase === 'premium')) { onRequestPremium(); return; }
    inProgress.current = true;
    const currentRequest = ++requestId.current;
    const active = () => requestId.current === currentRequest;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const departing = sceneRef.current === 'idle' && !reducedMotion;
    setScene(departing ? 'departing' : 'waiting');
    setState({ phase: 'loading', ...selection, topic, text: '' });
    const arrival = departing ? pause(650).then(() => {
      if (active() && sceneRef.current === 'departing') setScene('waiting');
    }) : Promise.resolve();
    try {
      const response = uiPreview
        ? (previewReadings ? previewReadings.find(value => value.topic === topic && value.period === period && value.date === date && value.endDate === endDate)
          || { ...selection, topic, status: 'unavailable' as const, text: '' }
          : { ...selection, topic, status: 'unavailable' as const, text: '' })
        : await loadPersonalFutureForecast({ profile, ...selection, topic });
      await arrival;
      if (!active()) return;
      if (response.status !== 'ready' || !response.text.trim() || response.date !== date || response.topic !== topic || response.period !== period || response.endDate !== endDate) {
        setState({ phase: 'error', ...selection, topic, text: uiPreview && previewReadings
          ? (en ? 'No saved sample for this date and topic. The app generates it on request.' : 'Для этой даты и темы ещё нет сохранённого примера. В приложении он создаётся по запросу.')
          : (en ? 'The forecast is not ready yet. Try again.' : 'Прогноз ещё не готов. Попробуй ещё раз.') });
      } else {
        setState({ phase: 'ready', ...selection, topic, text: response.text });
      }
      setScene('result');
    } catch (error) {
      await arrival;
      if (!active()) return;
      const failure = error as { status?: number; code?: string; freeUsedTopic?: Topic };
      const needsPremium = failure.status === 403 || failure.code === 'PERSONAL_FUTURE_PREMIUM_REQUIRED';
      setState({ phase: needsPremium ? 'premium' : 'error', ...selection, topic, text: needsPremium
        ? (en ? 'This date and topic are available with NEBO+.' : 'Эта дата и тема доступны с NEBO+.')
        : (en ? 'Could not open the forecast. Try again.' : 'Не удалось открыть прогноз. Попробуй ещё раз.') });
      setScene('result');
    } finally {
      if (active()) inProgress.current = false;
    }
  }

  const readableDate = (value: string, readingPeriod: Period = period, readingEndDate?: string) => {
    const formatter = new Intl.DateTimeFormat(en ? 'en-GB' : 'ru-RU', { ...(readingPeriod !== 'month' ? { day: 'numeric' as const } : {}), month: 'long', year: 'numeric', timeZone: 'UTC' });
    const start = formatter.format(new Date(`${value}T12:00:00Z`));
    if (readingPeriod !== 'week' || !readingEndDate || readingEndDate === value) return start;
    const end = formatter.format(new Date(`${readingEndDate}T12:00:00Z`));
    return value.slice(0, 7) === readingEndDate.slice(0, 7) ? `${Number(value.slice(8))}–${end}` : `${start} — ${end}`;
  };
  const [year, month, day] = date.split('-');
  const [lastYear, lastMonth, lastDay] = (endDate || date).split('-');
  const dayDigits = period === 'month' ? '—' : period === 'week' && lastDay !== day ? `${day}–${lastDay}` : day;
  const monthDigits = period === 'week' && month !== lastMonth ? `${month}–${lastMonth}` : month;
  const yearDigits = period === 'week' && year !== lastYear ? `${year}–${lastYear}` : year;
  const sceneClass: Record<Scene, string> = { idle: styles.sceneIdle, departing: styles.sceneDeparting, waiting: styles.sceneWaiting, result: styles.sceneResult, returning: styles.sceneReturning };

  return <section className={styles.root} aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className={styles.heading}>{en ? 'Time machine' : 'Машина времени'}</h2>
    <div className={styles.card}>
      <div className={`${styles.stage} ${sceneClass[scene]}`} aria-live="polite" aria-busy={scene === 'departing' || scene === 'waiting'}>
        <div className={`${styles.cover} ${styles.sceneVehicle}`} aria-hidden="true">
          <div className={styles.coverCopy}>
            <strong className={styles.coverHeadline}>{en ? 'What’s ahead for you?' : 'Что ждёт тебя впереди?'}</strong>
            <span className={styles.coverCaption}>{en ? 'Choose a date and a topic' : 'Выбери дату и тему'}</span>
            <span className={styles.coverInvitation}>{en ? 'Discover your future' : 'Узнай своё будущее'}</span>
          </div>
          <div className={styles.sceneArtwork}>
            <img className={styles.scenePerson} src="/assets/nebo-refined/future-person-horizon-v1.webp" width={768} height={384} alt="" draggable={false}/>
          </div>
        </div>
        <div className={styles.scenePending} hidden={scene !== 'waiting'}>{en ? 'Preparing your forecast. It will appear here.' : 'Готовим твой прогноз. Он появится здесь.'}</div>
        <div className={styles.sceneForecast} hidden={scene !== 'result'} role="region" tabIndex={scene === 'result' ? 0 : -1} aria-label={en ? 'Your forecast' : 'Твой прогноз'}>
          <div className={styles.resultDate}><time dateTime={state.date}>{readableDate(state.date, state.period, state.endDate)}</time><span>{en ? resultTopic.en : resultTopic.ru}</span></div>
          <p className={styles.resultText}>{state.text}</p>
          {state.phase === 'error' ? <button type="button" className={styles.premium} onClick={() => void travel()}>{en ? 'Try again' : 'Попробовать ещё'}<Glyph name="next" size={17}/></button> : null}
          {state.phase === 'premium' ? <button type="button" className={styles.premium} onClick={onRequestPremium}>{en ? 'Open with NEBO+' : 'Открыть с NEBO+'}<Glyph name="next" size={17}/></button> : null}
        </div>
      </div>
      <div id={`${id}-controls`} className={styles.controls}>
      <div className={styles.content}>
        <NeboFutureTimeline today={today} date={date} period={period} endDate={endDate} en={en} onChange={changeDestination}/>
        <div className={styles.destinationLabel}>{period === 'week' ? (en ? 'Selected days' : 'Выбранные дни') : period === 'month' ? (en ? 'Whole month' : 'Месяц целиком') : (en ? 'Destination date' : 'Дата назначения')}</div>
        <div className={styles.dateControls}>
        <button type="button" className={styles.step} disabled={selectedIndex <= 0} aria-label={en ? 'Previous date' : 'Предыдущая дата'} onClick={() => changeDestination(timelineStops[selectedIndex - 1])}><Glyph name="back" size={18}/></button>
        <div className={`${styles.circuit}${period === 'week' ? ` ${styles.weekCircuit}` : ''}`} role="img" aria-label={readableDate(date, period, endDate)}>
          <span className={styles.digitGroup} aria-hidden="true"><small>{period === 'week' ? (en ? 'DAYS' : 'ДНИ') : (en ? 'DAY' : 'ДЕНЬ')}</small><strong className={`${styles.day}${period === 'week' ? ` ${styles.weekDigits}` : ''}`}>{dayDigits}</strong></span>
          <span className={styles.digitGroup} aria-hidden="true"><small>{en ? 'MONTH' : 'МЕСЯЦ'}</small><strong className={styles.month}>{monthDigits}</strong></span>
          <span className={styles.digitGroup} aria-hidden="true"><small>{en ? 'YEAR' : 'ГОД'}</small><strong className={styles.year}>{yearDigits}</strong></span>
        </div>
        <button type="button" className={styles.step} disabled={selectedIndex < 0 || selectedIndex >= timelineStops.length - 1} aria-label={en ? 'Next date' : 'Следующая дата'} onClick={() => changeDestination(timelineStops[selectedIndex + 1])}><Glyph name="next" size={18}/></button>
        </div>
        <div className={styles.topics} role="group" aria-label={en ? 'Forecast topic' : 'Тема прогноза'}>{topics.map(item => <button key={item.id} type="button" aria-pressed={topic === item.id} onClick={() => changeTopic(item.id)}>{en ? item.en : item.ru}</button>)}</div>
        <button type="button" className={styles.run} disabled={busy || !dateValid || answered} onClick={() => void travel()}><span>{scene === 'returning' ? (en ? 'Coming back' : 'Возвращаемся') : busy ? (en ? 'Preparing forecast' : 'Готовим прогноз') : answered ? (en ? 'Forecast is open' : 'Прогноз открыт') : requiresPremium || state.phase === 'premium' ? (en ? 'Open with NEBO+' : 'Открыть с NEBO+') : state.phase === 'error' ? (en ? 'Try again' : 'Попробовать ещё') : (en ? 'Read forecast' : 'Прочитать')}</span><Glyph name="next" size={19}/></button>
      </div>
      </div>
    </div>
  </section>;
}
