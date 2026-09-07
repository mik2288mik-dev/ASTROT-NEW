import React, { useEffect, useRef, useState } from 'react';
import type { Dashboard } from '../../views/Dashboard';
import { hasActivePremium } from '../../lib/accessMatrix';
import { getPersonalForecastPeriodKey, normalizeForecastTimezone, type PersonalForecastPeriod } from '../../lib/personalForecastContract';
import { loadPersonalForecast, type PersonalForecastClientResult } from '../../services/personalForecastService';
import { LayeredSurface } from './LayeredSurface';
import { ActionRow, Art, birthLine, Header, ProductCard } from './Primitives';
import { useNeboDesign } from './useNeboDesign';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
type Props = Omit<React.ComponentProps<typeof Dashboard>, 'onCreateNatalChart' | 'onOpenCharts'> & { active?: boolean; onCreateNatalChart: () => void; onOpenCharts: () => void; onOpenSynastry: () => void; onOpenMatrix: () => void; onOpenSettings: () => void };
export function NeboDashboard(props: Props) {
  const { profile, onOpenMatrix, onOpenSettings, onCreateNatalChart, onOpenSynastry, onOpenCharts, onRequestPremium } = props;
  const design = useNeboDesign(profile);
  const period = props.requestedPeriod || 'day';
  const premium = hasActivePremium(profile);
  const [state, setState] = useState<{ identity: string; result: PersonalForecastClientResult | null; error: boolean }>({ identity: '', result: null, error: false });
  const [retry, setRetry] = useState(0), [reading, setReading] = useState(false);
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
    // Presentation changes never invalidate the existing forecast cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, lockedPeriod, profile.isSetup, retry, props.active]);
  useEffect(() => {
    const handler = (e: Event) => { const detail = (e as CustomEvent<NativeBackEventDetail>).detail; if (!props.active || !reading || detail?.handled) return; if (detail) detail.handled = true; setReading(false); };
    window.addEventListener(NATIVE_BACK_EVENT, handler); return () => window.removeEventListener(NATIVE_BACK_EVENT, handler);
  }, [props.active, reading]);
  const result = state.identity === identity ? state.result : null;
  const sections = result && !result.periodLocked ? [result.forecast.overview, ...result.forecast.sections].filter(s => !result.lockedSectionIds.includes(s.id) && s.text?.trim()) : [];
  const text = sections.map(s => s.text).join('\n\n');
  const title = result?.forecast.overview.title || (period === 'week' ? 'Твоя неделя' : period === 'month' ? 'Твой месяц' : 'Сегодня');
  const openPremium = () => void onRequestPremium?.(period === 'day' ? 'today' : period, { placement: period === 'day' ? 'today' : period, featureKey: period === 'week' ? 'personal_weekly' : period === 'month' ? 'personal_monthly' : 'personal_daily_full', triggerType: 'locked_feature', returnView: 'dashboard' });
  if (reading) return <div className="nebo-screen"><Header name={profile.name || ''} title={title} onBack={() => setReading(false)} onProfile={onOpenSettings}/><div className="nebo-reader-scroll"><p className="nebo-muted">{result?.forecast.dateLabel}</p><h1>{title}</h1>{text.split(/\n\s*\n/).map((p,i) => <p key={i}>{p}</p>)}{result?.lockedSectionIds.length ? <button className="nebo-primary" type="button" onClick={openPremium}>Читать с Premium</button> : null}</div></div>;
  const back = <div className="nebo-personal"><h1>{profile.name ? `Привет, ${profile.name}!` : 'Сегодня'}</h1><p className="nebo-muted">{birthLine(profile)}</p>
    <div className="nebo-periods" role="group" aria-label="Выбрать прогноз">{(['day','week','month'] as PersonalForecastPeriod[]).map((p,i) => <button type="button" key={p} aria-pressed={period === p} onClick={() => props.onPeriodChange?.(p)}>{['Сегодня','Неделя','Месяц'][i]}</button>)}</div>
    <section className="nebo-forecast nebo-tone-lime"><Art name={period === 'day' ? 'today' : period}/><h2>{title}</h2>
      {!profile.isSetup ? <><p>Укажи данные рождения, чтобы открыть личный прогноз.</p><button type="button" className="nebo-soft-button" onClick={onCreateNatalChart}>Добавить данные</button></> : lockedPeriod ? <><p>Этот прогноз доступен с Premium.</p><button type="button" className="nebo-soft-button" onClick={openPremium}>Открыть прогноз</button></> : state.error && !text ? <><p role="alert">Прогноз не загрузился.</p><button className="nebo-soft-button" type="button" onClick={() => setRetry(v => v+1)}>Повторить</button></> : !text ? <p role="status" aria-live="polite">Загружаем прогноз…</p> : <><p className="nebo-forecast-excerpt">{text}</p><button className="nebo-soft-button" type="button" onClick={() => setReading(true)}>Продолжить чтение <span aria-hidden="true">›</span></button></>}
    </section>
    <ActionRow title="Натальная карта" subtitle="Читать свой разбор" onClick={onCreateNatalChart}/><ActionRow title="Сохранённые карты" onClick={onOpenCharts} icon="people"/>
  </div>;
  return <div className="nebo-screen"><Header name={profile.name || ''} onProfile={onOpenSettings} onEscape={design.store.escapeToClassic}/><LayeredSurface initial={design.preference.surfaces.dashboard} active={props.active !== false} onChange={surface => { void design.store.update({ surface: { id: 'dashboard', ...surface } }); }} back={back}>
    <div className="nebo-panel-heading"><h2>Твои разделы</h2></div><div className="nebo-product-grid">
      <ProductCard title="Натальная карта" art="natal-pages" tone="peach" onClick={onCreateNatalChart}/><ProductCard title="Совместимость" art="rings" tone="lilac" onClick={onOpenSynastry}/><ProductCard title="Матрица судьбы" art="matrix" tone="blue" onClick={onOpenMatrix}/><ProductCard title="Сохранённые карты" art="saved-cards" tone="lime" onClick={onOpenCharts}/>
    </div><h2 className="nebo-section-title">Продолжить</h2><ActionRow title="Твой прогноз" subtitle={result?.forecast.dateLabel} onClick={() => { if (text) setReading(true); else onCreateNatalChart(); }}/><ActionRow title="Твоя натальная карта" onClick={onCreateNatalChart} icon="chart"/>
    {props.canPromotePremium && !premium ? <button type="button" className="nebo-offer nebo-tone-peach" onClick={openPremium}><span><strong>NEBO Premium</strong><small>Посмотреть возможности</small></span><Art name="premium"/></button> : null}
  </LayeredSurface></div>;
}
