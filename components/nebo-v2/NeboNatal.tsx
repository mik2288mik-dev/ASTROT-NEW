import dynamic from 'next/dynamic';
import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { NatalMagazine } from '../../views/v2/NatalMagazine';
import { NatalCatalogReport } from '../NatalReading/NatalCatalogReport';
import type { NatalMeaningExperience, NatalExperienceView } from '../NatalReading/NatalMeaningExperience';
import { NatalEvidenceSheet, type NatalExplanationTarget } from '../NatalReading/NatalEvidenceSheet';
import { NatalChartWheel } from '../NatalReading/NatalChartWheel';
import { NatalQuestionExperience } from '../NatalReading/NatalQuestionExperience';
import { getNatalReportCategory, type NatalReportCategoryKey } from '../../lib/natalReading/reportCatalog';
import { getPermanentNatalReliability } from '../../lib/natalReading/permanentReport';
import { buildNatalChartFingerprint } from '../../lib/natalChartFingerprint';
import { readingContentVersion, type ReadingPosition } from '../../lib/neboDesign/contract';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import { LayeredSurface } from './LayeredSurface';
import { ActionRow, Art, birthLine, Glyph, Header, ProductCard, type ArtName } from './Primitives';
import { useNeboDesign } from './useNeboDesign';
type Props = React.ComponentProps<typeof NatalMagazine> & { onOpenMatrix: () => void; onOpenSettings: () => void };
const LegacyNatalMagazine = dynamic(() => import('../../views/v2/NatalMagazine').then(module => module.NatalMagazine), { ssr: false });
type Mode = 'overview' | 'map' | 'questions';
type ExperienceProps = React.ComponentProps<typeof NatalMeaningExperience>;
const Host = createContext<{ props: Props; openQuestions: (key: NatalReportCategoryKey) => void; openMap: () => void } | null>(null);
const chapterCards: Array<{ key: NatalReportCategoryKey; art: ArtName; tone: string }> = [
  { key: 'main', art: 'natal-pages', tone: 'peach' }, { key: 'character', art: 'flower', tone: 'lilac' }, { key: 'love', art: 'rings', tone: 'pink' },
  { key: 'communication', art: 'support', tone: 'blue' }, { key: 'work', art: 'work-pages', tone: 'blue' }, { key: 'money', art: 'matrix', tone: 'lime' },
];
function chapterTitle(key: NatalReportCategoryKey, language: 'ru' | 'en'): string { return getNatalReportCategory(key)?.title[language] || (language === 'ru' ? 'Разбор' : 'Reading'); }
function savedPerson(props: Props): boolean { return props.chartSubject?.subject_type === 'saved_person' || props.chartSubject?.is_primary === false; }
/** Existing catalog owns authorization, stored calculations, generation, cache and Premium. */
export function NeboNatal(props: Props) {
  const design = useNeboDesign(props.profile);
  const [mode, setMode] = useState<Mode>('overview');
  const [view, setView] = useState<NatalExperienceView>('foundation');
  const [questionCategory, setQuestionCategory] = useState<NatalReportCategoryKey>('main');
  const person = savedPerson(props);
  const name = props.chartSubject?.name || props.profile.name || '';
  const identity = `${props.profile.id}:${props.chartSubject?.id ?? props.chartId ?? 'primary'}`;
  useEffect(() => { setMode('overview'); setView('foundation'); }, [identity]);
  useEffect(() => { if (!props.openQuestionRequest || !props.data || person) return; setMode('questions'); props.onQuestionRequestHandled?.(); }, [props.openQuestionRequest, props.data, person, props.onQuestionRequestHandled]);
  useEffect(() => { if (props.premiumContinuation?.featureKey === 'natal_questions' && !person) setMode('questions'); }, [props.premiumContinuation?.paywallInstanceId, person]);
  useEffect(() => {
    const back = (event: Event) => { const detail = (event as CustomEvent<NativeBackEventDetail>).detail; if (mode === 'overview' || detail?.handled) return; if (detail) detail.handled = true; setMode('overview'); };
    window.addEventListener(NATIVE_BACK_EVENT, back); return () => window.removeEventListener(NATIVE_BACK_EVENT, back);
  }, [mode]);
  const openQuestions = (key: NatalReportCategoryKey) => { if (person) return; setQuestionCategory(key); setMode('questions'); };
  // Keep the proven saved-person access boundary until that presentation is migrated separately.
  if (person) return <LegacyNatalMagazine {...props}/>;
  if (!props.data) return <div className="nebo-screen"><Header name={name} title="Натальная карта" onProfile={props.onOpenSettings} onEscape={design.store.escapeToClassic}/><div className="nebo-reader-scroll"><h1>Натальная карта</h1><Art name="natal-pages" className="nebo-empty-art"/>{props.chartLoadState === 'loading' ? <p role="status">Загружаем карту…</p> : props.chartLoadState === 'error' ? <><p role="alert">Карта не загрузилась.</p><button type="button" className="nebo-primary" onClick={props.onRetryChart}>Повторить</button></> : <><p>Добавь данные рождения, чтобы открыть свою карту.</p><button type="button" className="nebo-primary" onClick={props.onCreateChart}>Добавить данные</button></>}</div></div>;
  if (mode !== 'overview') return <div className="nebo-screen"><Header name={name} title={mode === 'map' ? 'Карта и расчёт' : 'Спросить о себе'} onBack={() => setMode('overview')} onProfile={props.onOpenSettings}/><div className="nebo-reader-scroll nebo-existing-tool">{mode === 'map' ? <NatalChartWheel chart={props.data} language={props.profile.language === 'en' ? 'en' : 'ru'}/> : <NatalQuestionExperience profile={props.profile} chartData={props.data} chartId={props.chartId} contextCategory={questionCategory} onContextChange={setQuestionCategory} requestPremium={props.requestPremium} premiumContinuation={props.premiumContinuation} onPremiumContinuationHandled={props.onPremiumContinuationHandled}/>}</div></div>;
  return <Host.Provider value={{ props, openQuestions, openMap: () => setMode('map') }}><NatalCatalogReport key={identity} profile={props.profile} chartData={props.data} chartId={props.chartId} chartSubject={props.chartSubject} view={view} onViewChange={setView} requestPremium={props.requestPremium} premiumContinuation={props.premiumContinuation} onPremiumContinuationHandled={props.onPremiumContinuationHandled} canPromotePremium={props.canPromotePremium} onOpenQuestions={openQuestions} experienceComponent={NeboNatalExperience} uiPreview={props.uiPreview?.catalog}/></Host.Provider>;
}
function NeboNatalExperience(experience: ExperienceProps) {
  const host = useContext(Host);
  if (!host) throw new Error('NEBO_NATAL_HOST_REQUIRED');
  const { props, openQuestions, openMap } = host;
  const design = useNeboDesign(props.profile);
  const language = props.profile.language === 'en' ? 'en' : 'ru';
  const [readerOpen, setReaderOpen] = useState(false), [contentsOpen, setContentsOpen] = useState(false);
  const [explanation, setExplanation] = useState<NatalExplanationTarget | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pendingPosition = useRef<ReadingPosition | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressState = useRef({ restored: false, key: '' });
  const selectedCategory = experience.activeCategoryKey;
  const locked = selectedCategory !== 'main' && !experience.isPremium;
  const pack = locked ? null : selectedCategory === 'main' ? experience.mainPack : experience.categoryPack;
  const fingerprint = buildNatalChartFingerprint(experience.chartData);
  const entityKey = `natal:${props.chartSubject?.id ?? props.chartId ?? 'primary'}:${readingContentVersion([fingerprint])}`;
  const contentVersion = useMemo(() => readingContentVersion([entityKey, language, experience.subjectName, selectedCategory, ...(pack?.summary || []).map(p => `${p.title || ''}\n${p.text}`)]), [entityKey, language, experience.subjectName, selectedCategory, pack]);
  const saved = design.preference.readings.find(r => r.entityKey === entityKey);
  const title = chapterTitle(selectedCategory, language);
  const subject = props.chartSubject ? { birthDate: props.chartSubject.birth_date, birthTime: props.chartSubject.birth_time || '', birthPlace: props.chartSubject.birth_place } : props.profile;
  const reliability = getPermanentNatalReliability(experience.chartData);
  const flush = () => { if (persistTimer.current) clearTimeout(persistTimer.current); persistTimer.current = null; const reading = pendingPosition.current; pendingPosition.current = null; if (reading) void design.store.update({ reading }); };
  const flushRef = useRef(flush); flushRef.current = flush;
  const capturePosition = () => {
    const el = scroller.current;
    if (!el || !readerOpen || !pack?.summary.length || locked || !progressState.current.restored) return;
    const blocks = Array.from(el.querySelectorAll<HTMLElement>('[data-reading-block]'));
    const top = el.getBoundingClientRect().top;
    let blockIndex = 0, offset = 0;
    for (let index = 0; index < blocks.length; index++) { const delta = top - blocks[index].getBoundingClientRect().top; if (delta >= -4) { blockIndex = index; offset = Math.max(0, Math.round(delta)); } else break; }
    pendingPosition.current = { entityKey, category: selectedCategory, contentVersion, blockIndex, blockOffset: Math.min(offset, 100000) };
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => flushRef.current(), 1000);
  };
  const captureRef = useRef(capturePosition); captureRef.current = capturePosition;
  useEffect(() => { const leave = () => { if (document.visibilityState === 'hidden') flushRef.current(); }; document.addEventListener('visibilitychange', leave); return () => { document.removeEventListener('visibilitychange', leave); flushRef.current(); }; }, []);
  useLayoutEffect(() => {
    if (!readerOpen || !pack?.summary.length || locked || !scroller.current) return;
    const key = `${entityKey}:${selectedCategory}:${contentVersion}`;
    if (progressState.current.key === key && progressState.current.restored) return;
    progressState.current = { key, restored: false };
    const el = scroller.current; el.scrollTop = 0;
    const match = saved?.category === selectedCategory && saved.contentVersion === contentVersion ? saved : null;
    const block = match ? el.querySelector<HTMLElement>(`[data-reading-block="${match.blockIndex}"]`) : null;
    if (block && match) el.scrollTop = Math.max(0, block.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop + match.blockOffset);
    const frame = requestAnimationFrame(() => { progressState.current.restored = true; }); return () => cancelAnimationFrame(frame);
    // Read the stored position on entering this content version, not after every save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerOpen, entityKey, selectedCategory, contentVersion, locked, Boolean(pack?.summary.length)]);
  useEffect(() => { setExplanation(null); }, [entityKey, selectedCategory, experience.isPremium]);
  useEffect(() => { if (props.premiumContinuation?.featureKey === 'natal_deep') setReaderOpen(true); }, [props.premiumContinuation?.paywallInstanceId]);
  const closeReading = () => { captureRef.current(); flushRef.current(); setReaderOpen(false); setContentsOpen(false); progressState.current = { key: '', restored: false }; };
  useEffect(() => {
    const back = (event: Event) => { const detail = (event as CustomEvent<NativeBackEventDetail>).detail; if (detail?.handled || explanation || !readerOpen) return; if (detail) detail.handled = true; if (contentsOpen) setContentsOpen(false); else closeReading(); };
    window.addEventListener(NATIVE_BACK_EVENT, back); return () => window.removeEventListener(NATIVE_BACK_EVENT, back);
  }, [readerOpen, contentsOpen, explanation]);
  const readCategory = (category: NatalReportCategoryKey) => { captureRef.current(); flushRef.current(); setContentsOpen(false); setReaderOpen(true); progressState.current = { key: '', restored: false }; experience.onSelectCategory(category); };
  if (readerOpen) return <div className="nebo-screen"><Header name={experience.subjectName} title={title} onBack={closeReading} onProfile={props.onOpenCharts}/><div className="nebo-reading-toolbar"><button type="button" onClick={() => setContentsOpen(!contentsOpen)} aria-expanded={contentsOpen}>Разделы <Glyph name="next" size={16}/></button>{!locked && pack?.summary.length ? <button type="button" onClick={() => { captureRef.current(); flushRef.current(); }} aria-label="Запомнить место чтения"><Glyph name="bookmark"/></button> : null}</div>
    {contentsOpen ? <nav className="nebo-contents" aria-label="Разделы разбора">{chapterCards.map(c => <button type="button" key={c.key} aria-current={selectedCategory === c.key ? 'page' : undefined} onClick={() => readCategory(c.key)}>{chapterTitle(c.key, language)}</button>)}</nav> : null}
    <div className="nebo-reader-scroll" ref={scroller} onScroll={capturePosition}><p className="nebo-muted">{experience.subjectName} · {birthLine(subject)}</p><h1>{title}</h1>
      {reliability.quality !== 'exact' ? <button type="button" className="nebo-soft-button" onClick={() => setExplanation({ mode: 'accuracy', title: 'Что учтено в разборе' })}>Время рождения: что учтено?</button> : null}
      {locked ? <section className="nebo-locked"><Art name="premium"/><h2>Полный разбор с Premium</h2><p>Открой этот раздел и остальные главы своей карты.</p>{experience.canPromotePremium ? <button id={`natal-chapter-${selectedCategory}`} type="button" className="nebo-primary" onClick={() => experience.onRequestPremium(selectedCategory)}>Посмотреть доступ</button> : null}</section> : pack?.summary.length ? <article>{pack.summary.map((paragraph,index) => <section data-reading-block={index} className="nebo-reading-block" key={`${contentVersion}-${index}`}><div><h2>{paragraph.title}</h2><button type="button" className="nebo-why" onClick={() => setExplanation({ mode: 'why', title: paragraph.title || 'В твоей карте', text: paragraph.text, evidenceIds: paragraph.evidenceIds })}>Почему так?</button></div><p>{paragraph.text}</p></section>)}</article> : experience.categoryLoading ? <p role="status">Готовим разбор…</p> : <section role="alert"><p>{experience.categoryError || 'Разбор не загрузился.'}</p><button type="button" className="nebo-primary" onClick={experience.onRetryCategory}>Повторить</button></section>}
      {!locked && pack?.summary.length ? <section className="nebo-reading-next"><h2>Продолжить читать</h2>{(pack.followUps?.filter(f => f.categoryKey !== selectedCategory) || []).map(f => <ActionRow key={f.categoryKey} title={f.label} subtitle={chapterTitle(f.categoryKey,language)} onClick={() => readCategory(f.categoryKey)}/>)}<button type="button" className="nebo-primary" onClick={() => { setContentsOpen(true); scroller.current?.scrollTo({ top: 0 }); }}>Все разделы</button></section> : null}
      {design.error ? <p className="nebo-save-notice" role="status">Место чтения пока не синхронизировано.</p> : null}
    </div><NatalEvidenceSheet target={locked && explanation?.mode === 'why' ? null : explanation} profile={experience.profile} chartData={experience.chartData} onClose={() => setExplanation(null)}/>
  </div>;
  const back = <div className="nebo-personal"><h1>Натальная карта</h1><p className="nebo-muted">{experience.subjectName} · {birthLine(subject)}</p><section className="nebo-natal-intro"><Art name="natal-pages"/><p>{experience.mainPack?.summary[0]?.text || (experience.categoryError ? 'Разбор не загрузился.' : 'Загружаем твой разбор…')}</p></section><button type="button" className="nebo-primary" onClick={() => readCategory('main')}>Читать разбор <Glyph name="next" size={18}/></button><ActionRow title="Карта и расчёт" icon="chart" onClick={openMap}/>{saved ? <ActionRow title="Продолжить с места" subtitle={chapterTitle(saved.category,language)} onClick={() => readCategory(saved.category)}/> : null}{experience.categoryError && !experience.mainPack ? <button type="button" className="nebo-soft-button" onClick={experience.onRetryCategory}>Повторить загрузку</button> : null}</div>;
  return <div className="nebo-screen"><Header name={experience.subjectName} onProfile={props.onOpenCharts} onEscape={design.store.escapeToClassic}/><LayeredSurface collapsedPeek={210} back={back} initial={design.preference.surfaces.chart} onChange={surface => { void design.store.update({ surface: { id: 'chart', ...surface } }); }}><div className="nebo-panel-heading"><h2>Разделы разбора</h2></div><div className="nebo-product-grid">{chapterCards.map(c => <ProductCard key={c.key} title={chapterTitle(c.key,language)} art={c.art} tone={c.tone} label={c.key === 'main' ? 'Бесплатно' : !experience.isPremium ? 'В Premium' : undefined} onClick={() => readCategory(c.key)}/>)}</div><ActionRow title="Спросить о себе" subtitle="По своей сохранённой карте" onClick={() => openQuestions('main')}/><ProductCard title="Матрица судьбы" art="matrix" tone="blue" onClick={props.onOpenMatrix}/></LayeredSurface></div>;
}
