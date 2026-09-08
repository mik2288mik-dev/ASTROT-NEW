import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { UserProfile } from '../../types';
import {
  createChart,
  deleteChart,
  getCharts,
  type ChartListItem,
  type ChartsResponse,
} from '../../services/storageService';
import { hasActivePremium } from '../../lib/accessMatrix';
import { isSelfChart, getChartSubjectType } from '../../lib/chartAccessPolicy';
import { clearLocalHumanBaseReport } from '../../lib/localHumanBaseReportCache';
import type { PaywallContext } from '../../lib/paywallContext';
import type { BirthTimeMode } from '../../lib/birthTime';
import { loadCompatHistory, type CompatHistoryEntry } from '../../lib/compatHistory';
import { Art, Glyph, Header, ProductCard } from './Primitives';

type SavedChartBirthTimeMode = Extract<BirthTimeMode, 'exact' | 'approximate' | 'unknown'>;

type Props = {
  profile: UserProfile;
  onChartSelect?: (chart: ChartListItem) => void;
  onProfileUpdate?: (profile: UserProfile) => void;
  onUseInSynastry?: (chart: ChartListItem) => void;
  onPrimaryChartUpdated?: () => Promise<void> | void;
  onRequestPremium?: (source?: string, payload?: Record<string, unknown>) => void;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
  canPromotePremium?: boolean;
  uiPreview?: ChartsResponse;
  embedded?: boolean;
};

type View = 'people' | 'history' | 'person';

function firstLetter(value?: string | null) {
  return String(value || '').trim().slice(0, 1).toUpperCase() || '•';
}

function prettyDate(value?: string | null, language: 'ru' | 'en' = 'ru') {
  if (!value) return '';
  const iso = String(value).slice(0, 10);
  const date = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(date).replace(' г.', '');
}

function PersonAvatar({ name, self = false }: { name?: string | null; self?: boolean }) {
  return <span className={`nebo-people-avatar${self ? ' is-self' : ''}`}>{firstLetter(name)}</span>;
}

export function NeboMyCharts({
  profile,
  onChartSelect,
  onUseInSynastry,
  onRequestPremium,
  premiumContinuation,
  onPremiumContinuationHandled,
  canPromotePremium = true,
  embedded = false,
}: Props) {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const ru = language === 'ru';
  const premium = hasActivePremium(profile);
  const [data, setData] = useState<ChartsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('people');
  const [selected, setSelected] = useState<ChartListItem | null>(null);
  const [history, setHistory] = useState<CompatHistoryEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChartListItem | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('');
  const [birthMode, setBirthMode] = useState<SavedChartBirthTimeMode>('exact');
  const [birthPlace, setBirthPlace] = useState('');
  const [relation, setRelation] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const addDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);

  const load = useCallback(async () => {
    if (!profile.id) return null;
    setLoading(true); setError(null);
    try {
      const response = await getCharts(String(profile.id));
      setData(response);
      setHistory(loadCompatHistory(profile.id).filter((entry) => entry.kind === 'person'));
      return response;
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : (ru ? 'Не удалось загрузить людей.' : 'Could not load people.'));
      return null;
    } finally { setLoading(false); }
  }, [profile.id, ru]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const dialog = addDialog.current;
    if (!dialog) return;
    if (showAdd && !dialog.open) dialog.showModal();
    if (!showAdd && dialog.open) dialog.close();
  }, [showAdd]);
  useEffect(() => {
    const dialog = deleteDialog.current;
    if (!dialog) return;
    if (deleteTarget && !dialog.open) dialog.showModal();
    if (!deleteTarget && dialog.open) dialog.close();
  }, [deleteTarget]);

  const charts = data?.charts || [];
  const selfChart = charts.find(isSelfChart) || null;
  const saved = charts.filter((chart) => getChartSubjectType(chart) === 'saved_person' && !chart.archived_at);
  const canAdd = data?.canAddSavedPeople ?? data?.canAddMore ?? false;

  useEffect(() => {
    if (!premiumContinuation || !premium) return;
    if (premiumContinuation.featureKey !== 'saved_people') return;
    if (premiumContinuation.returnAction === 'add_saved_person') setShowAdd(true);
    if (premiumContinuation.returnAction === 'open_saved_person' && premiumContinuation.returnEntityId) {
      const chart = charts.find((item) => String(item.id) === premiumContinuation.returnEntityId);
      if (chart && !chart.access_locked) { setSelected(chart); setView('person'); }
    }
    onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
  }, [charts, onPremiumContinuationHandled, premium, premiumContinuation]);

  const resetForm = () => {
    setName(''); setBirthDate(''); setBirthTime(''); setBirthMode('exact'); setBirthPlace(''); setRelation(''); setFormError(null); setShowAdd(false);
  };

  const openAdd = () => {
    setFormError(null);
    if (!canAdd) {
      if (!premium && canPromotePremium && onRequestPremium) {
        onRequestPremium('charts', { placement:'saved_people', featureKey:'saved_people', triggerType:'locked_feature', returnView:'charts', returnAction:'add_saved_person' });
      } else {
        setError(ru ? 'Лимит сохранённых людей уже заполнен.' : 'Your saved people limit is full.');
      }
      return;
    }
    setShowAdd(true);
  };

  const addPerson = async () => {
    if (!profile.id || !birthDate || !birthPlace.trim() || (birthMode !== 'unknown' && !birthTime)) {
      setFormError(ru ? 'Заполни дату, место и время рождения — или отметь, что время неизвестно.' : 'Add date, place and birth time, or mark the time as unknown.');
      return;
    }
    setActionLoading('add'); setFormError(null);
    try {
      await createChart(String(profile.id), {
        name: name.trim() || (ru ? 'Без имени' : 'Unnamed'),
        birthDate,
        birthTime: birthMode === 'unknown' ? undefined : birthTime,
        birthTimeMode: birthMode,
        birthTimeUncertaintyMinutes: birthMode === 'approximate' ? 30 : null,
        birthPlace: birthPlace.trim(),
        language,
        relationLabel: relation.trim() || null,
      });
      resetForm();
      await load();
    } catch (caught) {
      setFormError(caught instanceof Error && caught.message ? caught.message : (ru ? 'Не удалось добавить человека.' : 'Could not add the person.'));
    } finally { setActionLoading(null); }
  };

  const removePerson = async () => {
    if (!profile.id || !deleteTarget || isSelfChart(deleteTarget)) return;
    const target = deleteTarget;
    setActionLoading(`delete-${target.id}`);
    try {
      await deleteChart(target.id, String(profile.id));
      clearLocalHumanBaseReport(profile, target.id, {
        subjectType: getChartSubjectType(target),
        subjectIdentity: { name: target.name, birthDate: target.birth_date, birthTime: target.birth_time, birthPlace: target.birth_place },
        chartData: target.chart_data,
        inputHash: target.input_hash,
        calculationVersion: target.calculation_version,
      });
      setDeleteTarget(null); setSelected(null); setView('people');
      await load();
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : (ru ? 'Не удалось удалить человека.' : 'Could not remove the person.'));
    } finally { setActionLoading(null); }
  };

  const openChart = (chart: ChartListItem) => {
    if (chart.access_locked) {
      if (!premium && canPromotePremium && onRequestPremium) {
        onRequestPremium('charts', { placement:'saved_people', featureKey:'saved_people', triggerType:'locked_feature', returnView:'charts', returnAction:'open_saved_person', returnEntityId:chart.id });
      }
      return;
    }
    onChartSelect?.(chart);
  };

  if (loading && !data) {
    return <div className="nebo-screen nebo-people-screen"><Header name={profile.name || ''}/><div className="nebo-reader-scroll"><h1>{ru ? 'Люди и сохранённое' : 'People and saved'}</h1><div className="nebo-people-loading" aria-busy="true"><span/><span/><span/></div></div></div>;
  }

  if (view === 'person' && selected) {
    const isSelf = isSelfChart(selected);
    return <div className="nebo-screen nebo-people-screen"><Header title={selected.name} name={profile.name || ''} onBack={() => { setSelected(null); setView('people'); }}/><div className="nebo-reader-scroll nebo-person-detail">
      <section className="nebo-person-detail-card"><PersonAvatar name={selected.name} self={isSelf}/><span><h1>{selected.name}</h1><p>{[prettyDate(selected.birth_date, language), selected.birth_time, selected.birth_place].filter(Boolean).join(', ')}</p>{selected.relation_label ? <small>{selected.relation_label}</small> : null}</span></section>
      <section className="nebo-person-quote"><span>“</span><p>{isSelf ? (ru ? 'Твоя основная карта и всё, что уже сохранено о тебе.' : 'Your main chart and everything saved about you.') : (ru ? 'Открой нужный раздел для этого человека.' : 'Open a section for this person.')}</p><Art name="people"/></section>
      <h2>{ru ? `Разделы для ${selected.name}` : `Sections for ${selected.name}`}</h2>
      <div className="nebo-product-grid"><ProductCard title={ru ? 'Натальная карта' : 'Natal chart'} subtitle={ru ? 'Характер и основные черты' : 'Core traits'} art="natal-chart" tone="peach" onClick={() => openChart(selected)}/>{!isSelf && onUseInSynastry ? <ProductCard title={ru ? 'Совместимость' : 'Compatibility'} subtitle={ru ? 'Сравнить с собой' : 'Compare with yourself'} art="compatibility" tone="lilac" onClick={() => onUseInSynastry(selected)}/> : <ProductCard title={ru ? 'Сохранённое' : 'Saved'} subtitle={ru ? 'Вернуться к своей карте' : 'Return to your chart'} art="saved-cards" tone="lime" onClick={() => openChart(selected)}/>}</div>
      {!isSelf ? <button type="button" className="nebo-person-delete" onClick={() => setDeleteTarget(selected)}>{ru ? 'Удалить человека' : 'Remove person'}</button> : null}
    </div></div>;
  }

  return <div className={`nebo-screen nebo-people-screen${embedded ? ' is-embedded' : ''}`}>{!embedded ? <Header name={profile.name || ''}/> : null}<div className="nebo-reader-scroll nebo-people-scroll">
    <h1>{ru ? 'Люди и сохранённое' : 'People and saved'}</h1><p className="nebo-muted">{ru ? 'Близкие люди и сохранённые результаты в одном месте.' : 'People and saved results in one place.'}</p>
    <div className="nebo-people-tabs" role="tablist"><button type="button" role="tab" aria-selected={view === 'people'} onClick={() => setView('people')}>{ru ? 'Люди' : 'People'}</button><button type="button" role="tab" aria-selected={view === 'history'} onClick={() => setView('history')}>{ru ? 'История' : 'History'}</button></div>
    {error ? <div className="nebo-people-error" role="alert"><span>{error}</span><button type="button" onClick={() => { void load(); }}>{ru ? 'Повторить' : 'Retry'}</button></div> : null}
    {view === 'people' ? <>
      <h2>{ru ? 'Мои люди' : 'My people'}</h2>
      <div className="nebo-people-list">{selfChart ? <button type="button" onClick={() => { setSelected(selfChart); setView('person'); }}><PersonAvatar name={selfChart.name} self/><span><strong>{selfChart.name}</strong><small>{[prettyDate(selfChart.birth_date, language), selfChart.birth_place].filter(Boolean).join(', ')}</small></span><span className="nebo-person-tag">{ru ? 'моя карта' : 'my chart'}</span><Glyph name="next" size={18}/></button> : null}{saved.map((chart) => <button type="button" key={chart.id} onClick={() => { if (chart.access_locked && !premium) { openChart(chart); return; } setSelected(chart); setView('person'); }}><PersonAvatar name={chart.name}/><span><strong>{chart.name}</strong><small>{[prettyDate(chart.birth_date, language), chart.birth_place].filter(Boolean).join(', ')}</small></span>{chart.access_locked ? <span className="nebo-person-tag">Premium</span> : null}<Glyph name="next" size={18}/></button>)}</div>
      <button type="button" className="nebo-add-person" onClick={openAdd}><span className="nebo-add-person-plus"><Glyph name="plus"/></span><span><strong>{ru ? 'Добавить человека' : 'Add person'}</strong><small>{ru ? 'Партнёр, друг, родственник и другие' : 'Partner, friend, relative and more'}</small></span></button>
      {!premium && !canAdd ? <section className="nebo-people-promo nebo-tone-lime"><div><h2>{ru ? 'Люди остаются рядом' : 'Keep people close'}</h2><p>{ru ? 'Сохранённые карты не удаляются. Дополнительные места открываются с Premium.' : 'Saved charts stay saved. Extra slots unlock with Premium.'}</p></div><Art name="people"/></section> : null}
    </> : <>
      <h2>{ru ? 'Сохранённое и история' : 'Saved and history'}</h2>
      <div className="nebo-history-list">{charts.map((chart) => <button type="button" key={`chart-${chart.id}`} onClick={() => openChart(chart)}><Art name="natal-chart"/><span><strong>{ru ? 'Натальная карта' : 'Natal chart'}</strong><small>{chart.name} · {prettyDate(chart.birth_date, language)}</small></span><Glyph name="next" size={18}/></button>)}{history.map((entry) => <button type="button" key={`compat-${entry.id}`} onClick={() => { const chart = saved.find((item) => item.id === entry.chartId); if (chart && onUseInSynastry) onUseInSynastry(chart); }}><Art name="compatibility"/><span><strong>{ru ? 'Совместимость' : 'Compatibility'}</strong><small>{[profile.name, entry.name].filter(Boolean).join(' + ')} · {new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date(entry.ts))}</small></span><Glyph name="next" size={18}/></button>)}</div>
      {!charts.length && !history.length ? <p className="nebo-people-empty">{ru ? 'Пока здесь пусто. Открывай карты и сравнения — они появятся здесь.' : 'Nothing here yet. Open charts and comparisons and they will appear here.'}</p> : null}
    </>}
  </div>
  <dialog ref={addDialog} className="nebo-bottom-dialog" onCancel={(event) => { event.preventDefault(); resetForm(); }}><form method="dialog" className="nebo-bottom-sheet" onSubmit={(event) => event.preventDefault()}><div className="nebo-sheet-grabber"/><div className="nebo-sheet-title"><h2>{ru ? 'Добавить человека' : 'Add person'}</h2><button type="button" onClick={resetForm} aria-label={ru ? 'Закрыть' : 'Close'}><Glyph name="close"/></button></div><div className="nebo-sheet-fields"><label><span>{ru ? 'Имя' : 'Name'}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={ru ? 'Как его зовут?' : 'Person name'}/></label><label><span>{ru ? 'Дата рождения' : 'Birth date'}</span><input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)}/></label><div className="nebo-sheet-two"><label><span>{ru ? 'Время' : 'Time'}</span><input type="time" disabled={birthMode === 'unknown'} value={birthMode === 'unknown' ? '' : birthTime} onChange={(event) => setBirthTime(event.target.value)}/></label><label><span>{ru ? 'Место рождения' : 'Birth place'}</span><input value={birthPlace} onChange={(event) => setBirthPlace(event.target.value)} placeholder={ru ? 'Город' : 'City'}/></label></div><label><span>{ru ? 'Кто это' : 'Relation'}</span><input value={relation} onChange={(event) => setRelation(event.target.value)} placeholder={ru ? 'Партнёр, мама, друг…' : 'Partner, parent, friend…'}/></label><div className="nebo-birth-mode" role="group">{(['exact','approximate','unknown'] as SavedChartBirthTimeMode[]).map((mode) => <button key={mode} type="button" aria-pressed={birthMode === mode} onClick={() => setBirthMode(mode)}>{mode === 'exact' ? (ru ? 'Точное время' : 'Exact') : mode === 'approximate' ? (ru ? 'Примерное' : 'Approximate') : (ru ? 'Не знаю' : 'Unknown')}</button>)}</div>{formError ? <p className="nebo-sheet-error" role="alert">{formError}</p> : null}<button type="button" className="nebo-primary" disabled={actionLoading === 'add'} onClick={() => { void addPerson(); }}>{actionLoading === 'add' ? (ru ? 'Добавляем…' : 'Adding…') : (ru ? 'Добавить' : 'Add')}</button></div></form></dialog>
  <dialog ref={deleteDialog} className="nebo-bottom-dialog" onCancel={(event) => { event.preventDefault(); setDeleteTarget(null); }}><div className="nebo-bottom-sheet nebo-delete-sheet"><div className="nebo-sheet-grabber"/><Art name="people"/><h2>{ru ? `Удалить ${deleteTarget?.name || 'человека'}?` : `Remove ${deleteTarget?.name || 'person'}?`}</h2><p>{ru ? 'Карта этого человека будет удалена из сохранённых. Твоя собственная карта не изменится.' : 'This saved chart will be removed. Your own chart stays unchanged.'}</p><div><button type="button" onClick={() => setDeleteTarget(null)}>{ru ? 'Отмена' : 'Cancel'}</button><button type="button" className="is-danger" disabled={actionLoading?.startsWith('delete-')} onClick={() => { void removePerson(); }}>{ru ? 'Удалить' : 'Remove'}</button></div></div></dialog>
  </div>;
}
