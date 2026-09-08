import React, { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import styles from './NeboDashboard.module.css';
import type { Dashboard } from '../../views/Dashboard';
import { hasActivePremium } from '../../lib/accessMatrix';
import { buildPersonalForecastBirthProfileFingerprint, getPersonalForecastDayHorizon, getPersonalForecastPeriodAccess, getPersonalForecastPeriodKey, MAX_FUTURE_FORECAST_DAYS, normalizeForecastTimezone, type PersonalForecastPeriod } from '../../lib/personalForecastContract';
import { loadPersonalForecast, primePersonalForecastDayHorizon, readLocalPersonalForecast, type PersonalForecastClientResult } from '../../services/personalForecastService';
import { getCharts, type ChartListItem } from '../../services/storageService';
import { TodayCalendarClock } from '../PersonalForecastFeed/TodayCalendarClock';
import { LayeredSurface } from './LayeredSurface';
import { NeboPersonalExplore, type NeboPersonalExploreProps } from './NeboPersonalExplore';
import { ActionRow, Art, Glyph, Header, ProductCard } from './Primitives';
import { useNeboDesign } from './useNeboDesign';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import { type PersonalMicroForecast } from '../../lib/personalMicroForecastContract';
import { loadPersonalMicroForecast } from '../../services/personalMicroForecastService';
import type { PersonalFutureForecast } from '../../lib/personalFutureForecastContract';

export type NeboHomeTopic = PersonalMicroForecast['topics'][number];
export type NeboDashboardPreview = { forecasts: Partial<Record<PersonalForecastPeriod, PersonalForecastClientResult>>; topicsByPeriod?: Partial<Record<PersonalForecastPeriod, NeboHomeTopic[]>>; futureForecasts?: PersonalFutureForecast[]; charts?: ChartListItem[]; chartData?: NeboPersonalExploreProps['chartData']; questions?: NeboPersonalExploreProps['questionsPreview']; phase?: 'ready'|'loading'|'error' };
type Props = Omit<React.ComponentProps<typeof Dashboard>, 'onCreateNatalChart' | 'onOpenCharts'> & {
  active?: boolean; onCreateNatalChart: () => void; onOpenCharts: () => void; onOpenSynastry: () => void;
  onOpenMatrix: () => void; onOpenSettings: () => void; uiPreview?: NeboDashboardPreview; events?: React.ReactNode;
};
const periods: PersonalForecastPeriod[] = ['day', 'week', 'month'];
const labels = { ru: {day:'Сегодня',week:'Неделя',month:'Месяц'}, en:{day:'Today',week:'Week',month:'Month'} };
const homeTopics = {
  relationships: { ru: 'Ты и люди', en: 'You and people', art: 'rings' as const, tone: 'rose', motion: 'orbit' as const },
  things: { ru: 'Дела и затеи', en: 'Things and plans', art: 'home-notebook' as const, tone: 'sky', motion: 'lift' as const },
  yourself: { ru: 'Твоё настроение', en: 'Your mood', art: 'home-flower' as const, tone: 'lilac', motion: 'orbit' as const },
  career: { ru: 'Дела и деньги', en: 'Work and money', art: 'home-briefcase' as const, tone: 'sky', motion: 'lift' as const },
  wellbeing: { ru: 'Твоё настроение', en: 'Your mood', art: 'home-flower' as const, tone: 'lilac', motion: 'orbit' as const },
  themes: { ru: 'Главное для тебя', en: 'What matters to you', art: 'home-sprout' as const, tone: 'mint', motion: 'float' as const },
};
function readableDate(date: string, locale: string, weekday = false) {
  return new Intl.DateTimeFormat(locale, {day:'numeric',month:'long', ...(weekday ? {weekday:'short' as const} : {}),timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`));
}
function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0,10);
}
export function NeboDashboard(props: Props) {
  const {profile, onOpenMatrix, onOpenSettings, onCreateNatalChart, onOpenSynastry, onOpenCharts, onRequestPremium, uiPreview} = props;
  const design = useNeboDesign(profile);
  const period = props.requestedPeriod || 'day';
  const premium = hasActivePremium(profile);
  const en = profile.language === 'en';
  const locale = en ? 'en-GB' : 'ru-RU';
  const periodLabels = labels[en ? 'en' : 'ru'];
  const timezone = normalizeForecastTimezone(profile.birthTimezone);
  const [clock, setClock] = useState(() => new Date());
  const today = getPersonalForecastPeriodKey('day', clock, timezone);
  const [selectedDate, setSelectedDate] = useState<string|null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [readingOpen, setReadingOpen] = useState(false);
  const [topicOpen, setTopicOpen] = useState<NeboHomeTopic['id'] | null>(null);
  const topicDialog = useRef<HTMLDialogElement>(null);
  const [draftDate, setDraftDate] = useState(today);
  const dialog = useRef<HTMLDialogElement>(null);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{identity:string;result:PersonalForecastClientResult|null;error:boolean}>({identity:'',result:null,error:false});
  const [microState, setMicroState] = useState<{identity:string;result:PersonalMicroForecast|null;pending:boolean;error:boolean}>({identity:'',result:null,pending:false,error:false});
  const [microRetry, setMicroRetry] = useState(0);
  const [charts, setCharts] = useState<ChartListItem[]>(uiPreview?.charts || []);
  const periodKey = period === 'day' ? selectedDate || today : getPersonalForecastPeriodKey(period, clock, timezone);
  const identity = [profile.id, buildPersonalForecastBirthProfileFingerprint(profile), profile.language, premium, period, periodKey].join('|');
  const access = getPersonalForecastPeriodAccess({accessTier:premium ? 'premium' : 'free',period,periodKey,timezone,now:clock});
  const locked = access === 'premium_required';
  const maxDate = addDays(today,MAX_FUTURE_FORECAST_DAYS);
  const dayHorizon = getPersonalForecastDayHorizon(timezone,clock);
  const local = useMemo(() => uiPreview ? uiPreview.phase && uiPreview.phase !== 'ready' ? null : uiPreview.forecasts[period] || null : readLocalPersonalForecast({profile,period,periodKey}), [identity, uiPreview, retry]);
  const result = state.identity === identity && state.result ? state.result : local;
  const failed = uiPreview?.phase === 'error' || state.identity === identity && state.error;
  const firstView = useRef('');
  const analytics = useRef(props.onPremiumAnalytics); analytics.current = props.onPremiumAnalytics;

  useEffect(() => {
    const update = () => { if (document.visibilityState === 'visible') setClock(new Date()); };
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange',update);
    return () => { clearInterval(timer);document.removeEventListener('visibilitychange',update); };
  }, []);
  useEffect(() => { if (selectedDate && selectedDate < today) setSelectedDate(null); }, [today,selectedDate]);
  useEffect(() => {
    if (props.active === false || !profile.isSetup || access !== 'allowed' || uiPreview) return;
    let disposed = false;
    setState(current => current.identity === identity ? {...current,error:false} : {identity,result:local,error:false});
    void loadPersonalForecast({profile,period,periodKey,options:{maxInProgressRetries:60}}).then(value => {
      if (!disposed) setState({identity,result:value,error:false});
    }).catch(() => { if (!disposed) setState(current => ({identity,result:current.identity === identity ? current.result : null,error:true})); });
    return () => { disposed=true; };
  }, [identity, access, profile.isSetup, retry, props.active, uiPreview]);
  useEffect(() => {
    if (props.active === false || !profile.isSetup || uiPreview) return;
    void primePersonalForecastDayHorizon(profile);
  }, [profile.id, profile.isSetup, premium, today, props.active, uiPreview]);
  useEffect(() => {
    if (uiPreview) { setCharts(uiPreview.charts || []); return; }
    if (props.active === false || !profile.id) return;
    let alive=true;
    void getCharts(profile.id).then(value => {if(alive)setCharts(value.charts || []);}).catch(() => { /* Existing saved cards stay visible during a temporary outage. */ });
    return () => { alive=false; };
  }, [profile.id,props.active,uiPreview]);
  useEffect(() => {
    if (!result || locked || result.periodLocked || !result.forecast.overview.text || result.lockedSectionIds.includes('overview') || props.active === false || firstView.current === identity || document.visibilityState !== 'visible') return;
    firstView.current=identity;
    if (!uiPreview) analytics.current?.('first_value_viewed',{period,periodKey,generatedDuringRequest:result.generatedDuringRequest === true});
  }, [result,locked,identity,props.active,period,periodKey,uiPreview]);
  useEffect(() => {
    const modal=dialog.current;
    if (!modal) return;
    if (calendarOpen && !modal.open) modal.showModal();
    if (!calendarOpen && modal.open) modal.close();
  }, [calendarOpen]);
  useEffect(() => {
    const modal = topicDialog.current;
    if (!modal) return;
    if (topicOpen && !modal.open) modal.showModal();
    if (!topicOpen && modal.open) modal.close();
  }, [topicOpen]);
  useEffect(() => {
    const back=(event:Event) => {
      const detail=(event as CustomEvent<NativeBackEventDetail>).detail;
      if (props.active === false || detail?.handled || (!calendarOpen && !topicOpen && !readingOpen)) return;
      if (detail) detail.handled=true;
      event.preventDefault();
      if (topicOpen) setTopicOpen(null); else if (calendarOpen) setCalendarOpen(false); else { setReadingOpen(false); setSelectedDate(null); }
    };
    window.addEventListener(NATIVE_BACK_EVENT,back);return () => window.removeEventListener(NATIVE_BACK_EVENT,back);
  }, [calendarOpen,topicOpen,readingOpen,props.active]);

  const openPremium = () => void onRequestPremium?.(period === 'day' ? 'future' : period, {
    placement:period === 'day' ? 'future' : period, featureKey:period === 'week' ? 'personal_weekly' : period === 'month' ? 'personal_monthly' : 'personal_daily_full',
    triggerType:'locked_feature',returnView:'dashboard',periodKey,
  });
  const selectDate=(date:string) => {setSelectedDate(date === today ? null : date);props.onPeriodChange?.('day');setCalendarOpen(false);setReadingOpen(true);};
  const overview = !locked && !result?.periodLocked && !result?.lockedSectionIds.includes('overview') ? result?.forecast.overview : null;
  const closing = !locked && !result?.periodLocked ? result?.forecast.sections.filter(section => section.status === 'ready' && section.text?.trim() && !result.lockedSectionIds.includes(section.id)) || [] : [];
  const hasReading = Boolean(overview?.text);
  const topics = hasReading ? (uiPreview ? uiPreview.topicsByPeriod?.[period] || [] : microState.identity === identity && microState.result?.status === 'ready' ? microState.result.topics : []) : [];
  const selectedTopic = topics.find(topic => topic.id === topicOpen);
  const topicsHeading = en ? (period === 'day' ? 'Your day' : period === 'week' ? 'Your week' : 'Your month') : (period === 'day' ? 'Твоё сегодня' : period === 'week' ? 'Твоя неделя' : 'Твой месяц');
  const topicTitle = (id: NeboHomeTopic['id']) => id === 'relationships' && period === 'week' ? (en ? 'People around you' : 'Люди рядом') : homeTopics[id][en ? 'en' : 'ru'];
  useEffect(() => {
    if (uiPreview || props.active === false || !profile.isSetup || !hasReading || access !== 'allowed' || selectedDate) return;
    let alive = true;
    setMicroState(current => ({identity, result: current.identity === identity ? current.result : null, pending:true, error:false}));
    void loadPersonalMicroForecast({profile, period, periodKey}).then(value => {
      if (alive) setMicroState({identity, result:value, pending:false, error:value.status === 'unavailable'});
    }).catch(() => { if (alive) setMicroState({identity,result:null,pending:false,error:true}); });
    return () => { alive = false; };
  }, [identity, hasReading, access, props.active, uiPreview, selectedDate, microRetry]);
  useEffect(() => { setTopicOpen(null); }, [identity]);
  const people = charts.filter(chart => chart.subject_type === 'saved_person' || chart.is_primary === false).slice(0,4);
  const primary = charts.find(chart => chart.is_primary);
  const artworkDate = result?.forecast.periodStart || today;
  const [artYear, artMonth] = artworkDate.split('-').map(Number);
  const artDay = Math.floor(Date.parse(artworkDate + 'T00:00:00Z') / 86400000);
  const artSerial = period === 'month' ? artYear * 12 + artMonth - 1 : period === 'week' ? Math.floor(artDay / 7) : artDay;
  const artworkIndex = ((artSerial % 3) + 3) % 3 + 1;
  const artworkSource = `/assets/nebo-refined/forecast-cycle-v1/${period}-${artworkIndex}.png`;
  const forecastTitle = overview?.title || (period === 'week' ? (en ? 'Your week' : 'Твоя неделя') : period === 'month' ? (en ? 'Your month' : 'Твой месяц') : (en ? 'Your personal forecast' : 'Твой личный прогноз'));

  const periodTabs = <div className="nebo-periods" role="group" aria-label={en ? 'Forecast period' : 'Период прогноза'}>{periods.map(value => <button type="button" key={value} aria-pressed={period === value} onClick={() => { setSelectedDate(null); props.onPeriodChange?.(value); }}>{periodLabels[value]}</button>)}</div>;
  const reading = <article className={`nebo-personal-reading${hasReading ? ' is-ready' : ''}`} aria-busy={!hasReading && !failed && !locked && profile.isSetup}>
      <div className="nebo-reading-dateline"><span>{period === 'day' ? readableDate(periodKey,locale) : result?.forecast.dateLabel || periodLabels[period]}</span>{period === 'day' && selectedDate ? <button type="button" onClick={() => setSelectedDate(null)}>{en ? 'Back to today' : 'К сегодняшнему'}</button> : null}</div>
      <h2>{forecastTitle}</h2>
      {!profile.isSetup ? <><p>{en ? 'Add your birth details to read your personal forecast.' : 'Добавь данные рождения, чтобы получить свой личный прогноз.'}</p><button type="button" className="nebo-primary" onClick={onCreateNatalChart}>{en ? 'Add birth details' : 'Добавить данные'}</button></>
        : locked || result?.periodLocked ? <div className="nebo-forecast-access"><Glyph name="lock"/><p>{period === 'day' ? (en ? 'Today is free. With NEBO+, choose any date in the next 30 days.' : 'Сегодня — бесплатно. С NEBO+ можно выбрать любой день на ближайшие 30 дней.') : (en ? 'Weekly and monthly personal forecasts are available with NEBO+.' : 'Личные прогнозы на неделю и месяц доступны с NEBO+.')}</p><button type="button" className="nebo-primary" onClick={openPremium}>{en ? 'View NEBO+' : 'Посмотреть NEBO+'}</button></div>
        : access === 'outside_horizon' ? <><p>{en ? 'Choose a date within the next 30 days.' : 'Можно выбрать дату на ближайшие 30 дней.'}</p><button type="button" className="nebo-soft-button" onClick={() => setSelectedDate(null)}>{en ? 'Today' : 'К сегодняшнему прогнозу'}</button></>
        : hasReading ? <div className="nebo-forecast-prose">{overview!.text.split(/\n\s*\n/u).filter(Boolean).map((text,index) => <p key={index}>{text}</p>)}{closing.map(section => <p className="nebo-forecast-closing" key={section.id}>{section.text}</p>)}</div>
        : failed ? <div className="nebo-forecast-status"><p role="alert">{en ? 'Could not load the forecast. Please try again.' : 'Не удалось открыть прогноз. Попробуй ещё раз.'}</p><button type="button" className="nebo-soft-button" onClick={() => setRetry(value => value+1)}>{en ? 'Try again' : 'Повторить'}</button></div>
        : <div className="nebo-forecast-status" role="status"><span className="nebo-loading-dot" aria-hidden="true"/><p>{en ? 'Preparing your personal forecast. It will be saved here.' : 'Готовим твой личный прогноз. Он сохранится здесь.'}</p></div>}
    </article>;
  const openCalendar = () => {setDraftDate(selectedDate || today);setCalendarOpen(true);};
  const excerpt = overview?.text.match(/^.*?[.!?](?:\s+.*?[.!?])?/u)?.[0] || overview?.text || '';
  const back = <div className="nebo-personal">
    <div className="nebo-home-greeting"><p className="nebo-muted">{readableDate(periodKey.length === 10 ? periodKey : today, locale)}</p></div>
    <article className={`nebo-home-hero ${styles.forecastHero}`}>
      <img className="nebo-home-hero-image" src={artworkSource} width={1536} height={1024} alt="" fetchPriority="high"/>
      <div className="nebo-home-hero-copy"><h2>{forecastTitle}</h2><p>{hasReading ? excerpt : !profile.isSetup ? (en ? 'Add your birth details to get your personal forecast.' : 'Добавь данные рождения, чтобы получить свой прогноз.') : locked ? (en ? 'More about your week and month with NEBO+.' : 'Больше о твоей неделе и месяце — с NEBO+.') : failed ? (en ? 'Could not open the forecast. Please try again.' : 'Не удалось открыть прогноз. Попробуй ещё раз.') : (en ? 'Your first forecast is being prepared.' : 'Твой первый прогноз ещё готовится.')}</p></div>
      <button type="button" className="nebo-home-read-button" onClick={() => setReadingOpen(true)}>{en ? 'Read more' : 'Читать подробнее'}<Glyph name="next" size={17}/></button>
    </article>
    {periodTabs}
    {topics.length ? <section className={`nebo-home-topics is-${period}`} aria-label={topicsHeading}>
      <h2 className="nebo-home-section-heading">{topicsHeading}</h2>
      <div className="nebo-home-topic-list">{topics.map(topic => {
        const appearance = homeTopics[topic.id];
        return <button key={topic.id} type="button" className={`nebo-home-topic is-${appearance.tone}`} onClick={() => setTopicOpen(topic.id)} aria-haspopup="dialog">
          <Art name={appearance.art} motion={appearance.motion}/>
          <span className="nebo-home-topic-copy"><strong>{topicTitle(topic.id)}</strong><span key={topic.teaser}>{topic.teaser}</span></span>
        </button>;
      })}</div>
      {period === 'month' ? <button type="button" className="nebo-home-month-link" onClick={() => setReadingOpen(true)}>{en ? 'The whole month' : 'Месяц целиком'}</button> : null}
    </section> : !uiPreview && hasReading && !selectedDate ? <section className="nebo-home-micro-status" aria-live="polite"><p>{microState.error ? (en ? 'Could not open your short forecasts.' : 'Короткие прогнозы пока не загрузились.') : (en ? 'Preparing your short forecasts.' : 'Готовим твои короткие прогнозы.')}</p>{!microState.pending ? <button type="button" onClick={() => setMicroRetry(value => value + 1)}>{en ? 'Try again' : 'Повторить'}</button> : null}</section> : null}
    <h2 className="nebo-home-section-heading">{en ? 'At hand' : 'Под рукой'}</h2>
    <div className="nebo-home-shortcuts has-two">
      <button type="button" onClick={onOpenSynastry}><span className={`nebo-shortcut-icon ${styles.artSlot}`}><Image src="/assets/nebo-refined/reading-shortcuts/compare-v1.png" alt="" width={44} height={44} sizes="44px"/></span><strong>{en ? 'Compatibility' : 'Сравнить'}</strong><small>{en ? 'You and others' : 'Ты и близкие'}</small></button>
      <button type="button" onClick={onOpenCharts}><span className={`nebo-shortcut-icon ${styles.artSlot}`}><Image src="/assets/nebo-refined/reading-shortcuts/saved-v1.png" alt="" width={44} height={44} sizes="44px"/></span><strong>{en ? 'Saved' : 'Сохранённое'}</strong><small>{en ? 'Your charts' : 'Твои карты'}</small></button>
    </div>
    <div className="nebo-home-about"><button type="button" className="nebo-action-row" onClick={onCreateNatalChart}><div className={styles.bookSlot} aria-hidden="true"><Image src="/assets/nebo-refined/reading-shortcuts/book-v1.png" alt="" width={46} height={46} sizes="46px"/></div><span><strong>{en ? 'More about yourself' : 'Больше о себе'}</strong><small>{en ? 'Your character, relationships and strengths' : 'Характер, отношения и сильные стороны'}</small></span><Glyph name="next" size={18}/></button></div>
  </div>;
  return <div className={`nebo-screen nebo-home${readingOpen ? ' is-reading' : ''}`}><Header name={profile.name || ''} onPeople={onOpenCharts} onProfile={onOpenSettings} title={en ? 'Your horoscope' : 'Твой гороскоп'} onBack={readingOpen ? () => { setReadingOpen(false); setSelectedDate(null); } : undefined}/>
    {readingOpen ? <div className="nebo-home-reader">{periodTabs}{reading}<ActionRow title={en ? 'A look ahead' : 'Заглянуть вперёд'} subtitle={en ? 'Choose a day in the calendar' : 'Выбрать день в календаре'} icon="calendar" onClick={openCalendar}/>{period === 'day' && !selectedDate ? <div className="nebo-today-broadcast"><TodayCalendarClock userId={String(profile.id)} periodKey={today} timezone={timezone} language={en ? 'en' : 'ru'}/></div> : null}</div> : <LayeredSurface initial={design.preference.surfaces.dashboard} active={props.active !== false && !calendarOpen && !topicOpen} collapsedPeek={44} onChange={surface => {if(!uiPreview)void design.store.update({surface:{id:'dashboard',...surface}});}} back={back}>
      <NeboPersonalExplore profile={profile} uiPreview={Boolean(uiPreview)} futureReadings={uiPreview?.futureForecasts} chartData={uiPreview?.chartData} questionsPreview={uiPreview?.questions} requestPremium={(source, payload) => onRequestPremium?.(source, { ...payload, triggerType: 'locked_feature', returnView: 'dashboard' })}/>
      {props.events}
      <div className="nebo-panel-heading nebo-home-products-heading"><h2>{en ? 'More about you' : 'Больше о тебе'}</h2></div>
      <div className="nebo-product-grid">
        <ProductCard title={en ? 'Natal chart' : 'Натальная карта'} subtitle={en ? 'What makes you, you' : 'Твой характер и сильные стороны'} art="natal-pages" tone="peach" motion="orbit" onClick={onCreateNatalChart}/>
        <ProductCard title={en ? 'Compatibility' : 'Совместимость'} subtitle={en ? 'How you relate to each other' : 'Как вы понимаете друг друга'} art="rings" tone="lilac" motion="float" onClick={onOpenSynastry}/>
        <ProductCard title={en ? 'Destiny matrix' : 'Матрица судьбы'} subtitle={en ? 'Read your birth date' : 'Разбор по дате рождения'} art="matrix" tone="blue" motion="float" onClick={onOpenMatrix}/>
        <ProductCard title={en ? 'Saved charts' : 'Сохранённые карты'} subtitle={en ? 'Yours and the people you care about' : 'Твоя карта и карты близких'} art="saved-cards" tone="lime" motion="lift" onClick={onOpenCharts}/>
      </div>
      {primary ? <><h2 className="nebo-section-title">{en ? 'Your chart' : 'Твоя карта'}</h2><ActionRow title={primary.name || (en ? 'My chart' : 'Моя карта')} subtitle={en ? 'Open your saved reading' : 'Открыть сохранённый разбор'} icon="chart" onClick={onCreateNatalChart}/></> : null}
      <div className="nebo-home-subhead"><h2>{en ? 'Your people' : 'Близкие люди'}</h2><button type="button" onClick={onOpenCharts} aria-label={en ? 'All saved people' : 'Все сохранённые люди'}><Glyph name="next" size={20}/></button></div>
      <div className="nebo-people-strip"><button type="button" className="nebo-person-chip" onClick={onOpenCharts}><span className="nebo-person-add"><Glyph name="plus"/></span><strong>{en ? 'Add' : 'Добавить'}</strong></button>{people.map(person => <button type="button" className="nebo-person-chip" key={person.id} onClick={onOpenCharts}><span className="nebo-person-circle">{person.name.trim().slice(0,1).toUpperCase()}</span><strong>{person.name}</strong><small>{person.relation_label || (en ? 'Saved chart' : 'Карта')}</small></button>)}</div>
      {props.canPromotePremium && !premium ? <button type="button" className="nebo-offer nebo-tone-peach" onClick={openPremium}><span><strong>{en ? 'More with NEBO+' : 'Больше с NEBO+'}</strong><small>{en ? 'Future dates and deeper readings' : 'Будущие даты и подробные разборы'}</small></span><Art name="premium"/></button> : null}
    </LayeredSurface>}
    <dialog ref={dialog} className="nebo-date-dialog" onCancel={() => setCalendarOpen(false)} onClose={() => setCalendarOpen(false)} onClick={event => {if(event.target === event.currentTarget)setCalendarOpen(false);}} aria-labelledby="nebo-future-title">
      <div className="nebo-dialog-heading"><h2 id="nebo-future-title">{en ? 'A look ahead' : 'Заглянуть вперёд'}</h2><button type="button" className="nebo-icon-button" onClick={() => setCalendarOpen(false)} aria-label={en ? 'Close' : 'Закрыть'}><Glyph name="close"/></button></div>
      <p className="nebo-muted">{premium ? (en ? 'Choose any day in the next 30 days.' : 'Выбери любой день на ближайшие 30 дней.') : (en ? 'Today is free. Future dates are available with NEBO+.' : 'Сегодня — бесплатно. Будущие даты доступны с NEBO+.')}</p>
      <div className="nebo-day-choices">{dayHorizon.map((date,index) => <button type="button" key={date} aria-pressed={draftDate === date} onClick={() => setDraftDate(date)}><small>{index === 0 ? (en ? 'Today' : 'Сегодня') : index === 1 ? (en ? 'Tomorrow' : 'Завтра') : new Intl.DateTimeFormat(locale,{weekday:'short',timeZone:'UTC'}).format(new Date(`${date}T12:00:00Z`))}</small><strong>{Number(date.slice(-2))}</strong></button>)}</div>
      <label className="nebo-date-label" htmlFor="nebo-future-date">{en ? 'Date' : 'Дата'}</label><input id="nebo-future-date" type="date" value={draftDate} min={today} max={maxDate} onChange={event => setDraftDate(event.target.value)}/>
      <button type="button" className="nebo-primary" disabled={!draftDate || draftDate < today || draftDate > maxDate} onClick={() => selectDate(draftDate)}>{en ? 'Open forecast' : 'Открыть прогноз'}<Glyph name="next" size={19}/></button>
    </dialog>
    <dialog ref={topicDialog} className="nebo-home-topic-dialog" onCancel={() => setTopicOpen(null)} onClose={() => setTopicOpen(null)} onClick={event => { if (event.target === event.currentTarget) setTopicOpen(null); }} aria-labelledby="nebo-home-topic-title">
      {selectedTopic ? <div className="nebo-home-topic-sheet">
        <div className="nebo-dialog-heading"><span>{period === 'day' ? readableDate(today, locale) : result?.forecast.dateLabel || periodLabels[period]}</span><button type="button" className="nebo-icon-button" onClick={() => setTopicOpen(null)} aria-label={en ? 'Close' : 'Закрыть'}><Glyph name="close"/></button></div>
        <Art name={homeTopics[selectedTopic.id].art}/>
        <h2 id="nebo-home-topic-title">{topicTitle(selectedTopic.id)}</h2>
        <h3>{selectedTopic.teaser}</h3>
        <p>{selectedTopic.text}</p>
        <button type="button" className="nebo-primary" onClick={() => { setTopicOpen(null); setReadingOpen(true); }}>{en ? 'Open the main forecast' : 'Открыть общий прогноз'}<Glyph name="next" size={18}/></button>
      </div> : null}
    </dialog>
  </div>;
}
