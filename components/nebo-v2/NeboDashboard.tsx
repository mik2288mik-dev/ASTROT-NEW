import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Dashboard } from '../../views/Dashboard';
import { hasActivePremium } from '../../lib/accessMatrix';
import { getPersonalForecastPeriodKey, normalizeForecastTimezone, type ForecastSection, type PersonalForecastPeriod } from '../../lib/personalForecastContract';
import { loadPersonalForecast, type PersonalForecastClientResult } from '../../services/personalForecastService';
import { getCharts, type ChartListItem } from '../../services/storageService';
import { LayeredSurface } from './LayeredSurface';
import { ActionRow, Art, birthLine, Glyph, Header, ProductCard, type ArtName } from './Primitives';
import { useNeboDesign } from './useNeboDesign';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';

type Props = Omit<React.ComponentProps<typeof Dashboard>, 'onCreateNatalChart' | 'onOpenCharts'> & { active?: boolean; onCreateNatalChart: () => void; onOpenCharts: () => void; onOpenSynastry: () => void; onOpenMatrix: () => void; onOpenSettings: () => void };
type ForecastMini = { key: string; title: string; art: ArtName; tone: string; section: ForecastSection | null };

const periodLabels: Record<PersonalForecastPeriod,string> = { day:'Сегодня', week:'Неделя', month:'Месяц' };
const fallbackTitles: Record<string,string> = { love:'В отношениях', work_money:'В делах', mood:'Для тебя', home_family:'Дом и семья', friends:'Люди рядом', wishes:'Для тебя' };

function firstSentence(value: string, limit = 72): string {
  const clean = String(value || '').replace(/\s+/g,' ').trim();
  if (!clean) return 'Открыть';
  const sentence = clean.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || clean;
  return sentence.length > limit ? `${sentence.slice(0, limit - 1).trimEnd()}…` : sentence;
}

export function NeboDashboard(props: Props) {
  const { profile, onOpenMatrix, onOpenSettings, onCreateNatalChart, onOpenSynastry, onOpenCharts, onRequestPremium } = props;
  const design = useNeboDesign(profile);
  const period = props.requestedPeriod || 'day';
  const premium = hasActivePremium(profile);
  const [state, setState] = useState<{ identity: string; result: PersonalForecastClientResult | null; error: boolean }>({ identity: '', result: null, error: false });
  const [retry, setRetry] = useState(0);
  const [reading, setReading] = useState(false);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [charts, setCharts] = useState<ChartListItem[]>([]);
  const eventKey = useRef('');
  const analytics = useRef(props.onPremiumAnalytics); analytics.current = props.onPremiumAnalytics;
  const timezone = normalizeForecastTimezone(profile.birthTimezone);
  const periodKey = getPersonalForecastPeriodKey(period, new Date(), timezone);
  const identity = [profile.id, profile.birthDate, profile.birthTime, profile.birthPlace, timezone, profile.language, premium, period, periodKey].join('|');
  const lockedPeriod = !premium && period !== 'day';

  useEffect(() => {
    const result = state.identity === identity ? state.result : null;
    if (props.active === false || !result || result.periodLocked || result.lockedSectionIds.includes('overview') || !result.forecast.overview.text || eventKey.current === identity || document.visibilityState !== 'visible') return;
    eventKey.current = identity;
    analytics.current?.('first_value_viewed', { period, periodKey, generatedDuringRequest: result.generatedDuringRequest === true });
  }, [props.active, state, identity, period, periodKey]);

  useEffect(() => {
    if (props.active === false || !profile.isSetup || lockedPeriod) return;
    let disposed = false;
    setState(current => current.identity === identity ? { ...current, error: false } : { identity, result: null, error: false });
    void loadPersonalForecast({ profile, period, periodKey, options: { maxInProgressRetries: 60 } }).then(result => {
      if (!disposed) setState({ identity, result, error: false });
    }).catch(() => { if (!disposed) setState(current => ({ ...current, identity, error: true })); });
    return () => { disposed = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, lockedPeriod, profile.isSetup, retry, props.active]);

  useEffect(() => {
    if (props.active === false || !profile.id) return;
    let alive = true;
    void getCharts(profile.id).then(value => { if (alive) setCharts(value.charts || []); }).catch(() => { if (alive) setCharts([]); });
    return () => { alive = false; };
  }, [profile.id, props.active, profile.premiumEntitlement?.state, profile.premiumEntitlement?.endsAt]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<NativeBackEventDetail>).detail;
      if (!props.active || detail?.handled) return;
      if (selectedSectionId) { if (detail) detail.handled = true; setSelectedSectionId(null); return; }
      if (reading) { if (detail) detail.handled = true; setReading(false); }
    };
    window.addEventListener(NATIVE_BACK_EVENT, handler); return () => window.removeEventListener(NATIVE_BACK_EVENT, handler);
  }, [props.active, reading, selectedSectionId]);

  const result = state.identity === identity ? state.result : null;
  const availableSections = useMemo(() => result && !result.periodLocked
    ? result.forecast.sections.filter(section => section.status === 'ready' && section.text?.trim())
    : [], [result]);
  const unlockedSections = availableSections.filter(section => !result?.lockedSectionIds.includes(section.id));
  const allText = [result?.forecast.overview, ...unlockedSections].filter(Boolean).map(section => section?.text || '').filter(Boolean).join('\n\n');
  const title = result?.forecast.overview.title || (period === 'week' ? 'Твоя неделя' : period === 'month' ? 'Твой месяц' : 'Сегодня особенный день');
  const openPremium = () => void onRequestPremium?.(period === 'day' ? 'today' : period, { placement: period === 'day' ? 'today' : period, featureKey: period === 'week' ? 'personal_weekly' : period === 'month' ? 'personal_monthly' : 'personal_daily_full', triggerType: 'locked_feature', returnView: 'dashboard' });
  const selectFixed = (key: string) => availableSections.find(section => section.fixedKey === key || section.sourceTopicKey === key) || null;
  const miniCards: ForecastMini[] = [
    { key:'love', title:'В отношениях', art:'compatibility', tone:'pink', section:selectFixed('love') },
    { key:'work_money', title:'В делах', art:'matrix-destiny', tone:'lime', section:selectFixed('work_money') },
    { key:'mood', title:'Для тебя', art:'zodiac', tone:'lilac', section:selectFixed('mood') || selectFixed('rest_recovery') || selectFixed('wishes') },
  ];
  const selectedSection = selectedSectionId ? availableSections.find(section => section.id === selectedSectionId) || null : null;
  const savedPeople = charts.filter(chart => chart.subject_type === 'saved_person' || chart.is_primary === false).slice(0,4);
  const primaryChart = charts.find(chart => chart.is_primary) || null;

  if (selectedSection) return <div className="nebo-screen nebo-forecast-detail"><Header name={profile.name || ''} title={selectedSection.title || fallbackTitles[selectedSection.fixedKey || ''] || 'Прогноз'} onBack={() => setSelectedSectionId(null)} onProfile={onOpenSettings}/><div className="nebo-reader-scroll"><p className="nebo-muted">{result?.forecast.dateLabel}</p><h1>{selectedSection.title || fallbackTitles[selectedSection.fixedKey || ''] || 'Для тебя'}</h1>{selectedSection.text.split(/\n\s*\n/).map((p,i)=><p key={i}>{p}</p>)}</div></div>;

  if (reading) return <div className="nebo-screen nebo-forecast-page"><Header name={profile.name || ''} onBack={() => setReading(false)} onProfile={onOpenSettings}/><div className="nebo-reader-scroll nebo-forecast-reader">
    <h1>{profile.name ? `Привет, ${profile.name}!` : 'Твой прогноз'}</h1><p className="nebo-muted">{birthLine(profile)}</p>
    <section className="nebo-forecast-hero nebo-tone-blue"><Art name={period === 'day' ? 'today' : period}/><div><strong>{title}</strong><span>{result?.forecast.dateLabel || periodLabels[period]}</span><p>{firstSentence(result?.forecast.overview.text || allText, 150)}</p></div></section>
    <div className="nebo-periods" role="group" aria-label="Период прогноза">{(['day','week','month'] as PersonalForecastPeriod[]).map(p=><button type="button" key={p} aria-pressed={period===p} onClick={()=>{setSelectedSectionId(null);props.onPeriodChange?.(p);}}>{periodLabels[p]}</button>)}</div>
    <div className="nebo-forecast-section-list">{availableSections.slice(0,5).map((section,index)=>{
      const locked = Boolean(result?.lockedSectionIds.includes(section.id));
      const art: ArtName = index%3===0?'compatibility':index%3===1?'matrix-destiny':'zodiac';
      return <button type="button" className={`nebo-forecast-section nebo-tone-${index%3===0?'pink':index%3===1?'blue':'lilac'}`} key={section.id} onClick={()=>locked?openPremium():setSelectedSectionId(section.id)}><Art name={art}/><span><strong>{section.title || fallbackTitles[section.fixedKey || ''] || 'Для тебя'}</strong><small>{locked?'Открыть с Premium':firstSentence(section.text,88)}</small></span><Glyph name="next" size={18}/></button>;
    })}</div>
    {result?.lockedSectionIds.length ? <button className="nebo-primary" type="button" onClick={openPremium}>Открыть полный прогноз</button> : null}
  </div></div>;

  const back = <div className="nebo-personal"><h1>{profile.name ? `Привет, ${profile.name}!` : 'Сегодня'}</h1><p className="nebo-muted">{birthLine(profile)}</p>
    <section className="nebo-forecast nebo-tone-lime"><Art name={period === 'day' ? 'today' : period}/><h2>{title}</h2>
      {!profile.isSetup ? <><p>Добавь данные рождения — и здесь появится твой личный прогноз.</p><button type="button" className="nebo-soft-button" onClick={onCreateNatalChart}>Добавить данные</button></> : lockedPeriod ? <><p>Прогноз на {period === 'week' ? 'неделю' : 'месяц'} доступен с Premium.</p><button type="button" className="nebo-soft-button" onClick={openPremium}>Открыть прогноз</button></> : state.error && !allText ? <><p role="alert">Прогноз не загрузился.</p><button className="nebo-soft-button" type="button" onClick={() => setRetry(v=>v+1)}>Повторить</button></> : !allText ? <p role="status" aria-live="polite">Готовим прогноз…</p> : <><p className="nebo-forecast-excerpt">{result?.forecast.overview.text || allText}</p><button className="nebo-soft-button" type="button" onClick={()=>setReading(true)}>Продолжить чтение <span aria-hidden="true">›</span></button></>}
    </section>
    <div className="nebo-home-subhead"><strong>Твоё сегодня</strong><button type="button" onClick={()=>setReading(true)} aria-label="Открыть прогноз"><Glyph name="next" size={18}/></button></div>
    <div className="nebo-today-mini-grid">{miniCards.map(item=><button type="button" key={item.key} className={`nebo-today-mini nebo-tone-${item.tone}`} onClick={()=>item.section?setSelectedSectionId(item.section.id):setReading(true)}><Art name={item.art}/><strong>{item.title}</strong><small>{item.section?firstSentence(item.section.text,28):'Открыть'}</small></button>)}</div>
    <ActionRow title="Продолжай изучать себя" subtitle="Натальная карта и сохранённые разборы" icon="book" onClick={onCreateNatalChart}/>
  </div>;

  return <div className="nebo-screen"><Header name={profile.name || ''} onProfile={onOpenSettings}/><LayeredSurface initial={design.preference.surfaces.dashboard} active={props.active !== false} onChange={surface=>{void design.store.update({surface:{id:'dashboard',...surface}});}} back={back}>
    <div className="nebo-panel-heading"><h2>Всё для твоего пути</h2><p>Инструменты, которые помогают лучше понять себя</p></div>
    <div className="nebo-product-grid"><ProductCard title="Натальная карта" subtitle="Ключ к твоей уникальности" art="natal-pages" tone="peach" onClick={onCreateNatalChart}/><ProductCard title="Совместимость" subtitle="Как вы сочетаетесь" art="rings" tone="lilac" onClick={onOpenSynastry}/><ProductCard title="Матрица судьбы" subtitle="Таланты и сильные стороны" art="matrix" tone="blue" onClick={onOpenMatrix}/><ProductCard title="Сохранённые карты" subtitle="Всё важное в одном месте" art="saved-cards" tone="lime" onClick={onOpenCharts}/></div>
    <div className="nebo-home-subhead"><strong>Недавние результаты</strong><button type="button" onClick={onOpenCharts}><Glyph name="next" size={18}/></button></div>
    <div className="nebo-recent-strip">{primaryChart?<button type="button" onClick={onCreateNatalChart}><Art name="natal-chart"/><span><strong>Моя карта</strong><small>{primaryChart.birth_date}</small></span><Glyph name="next" size={16}/></button>:null}{savedPeople[0]?<button type="button" onClick={onOpenCharts}><Art name="compatibility"/><span><strong>{savedPeople[0].name}</strong><small>{savedPeople[0].relation_label || 'Сохранённая карта'}</small></span><Glyph name="next" size={16}/></button>:null}</div>
    <div className="nebo-home-subhead"><strong>Твои люди</strong><button type="button" onClick={onOpenCharts}><Glyph name="next" size={18}/></button></div>
    <div className="nebo-people-strip"><button type="button" className="nebo-person-chip" onClick={onOpenCharts}><span className="nebo-person-add"><Glyph name="plus"/></span><small>Добавить</small></button>{savedPeople.map(person=><button type="button" className="nebo-person-chip" key={person.id} onClick={onOpenCharts}><span className="nebo-person-circle">{person.name.trim().slice(0,1).toUpperCase()}</span><strong>{person.name}</strong><small>{person.relation_label || 'Карта'}</small></button>)}</div>
    {props.canPromotePremium && !premium?<button type="button" className="nebo-offer nebo-tone-peach" onClick={openPremium}><span><strong>Новые горизонты</strong><small>Открой больше возможностей NEBO</small></span><Art name="premium"/></button>:null}
  </LayeredSurface></div>;
}
