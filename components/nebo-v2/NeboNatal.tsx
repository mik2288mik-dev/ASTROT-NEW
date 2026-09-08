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
import { ActionRow, Art, birthLine, Glyph, Header, type ArtName } from './Primitives';
import styles from './NeboNatal.module.css';
import { LayeredSurface } from './LayeredSurface';
import { NeboPersonalExplore } from './NeboPersonalExplore';
import type { PersonalFutureForecast } from '../../lib/personalFutureForecastContract';
import type { LayeredSurfaceController } from '../../lib/neboDesign/layeredSurface';
import { useNeboDesign } from './useNeboDesign';
import { NeboMatrixRoom } from './NeboMatrixRoom';
type Props = Omit<React.ComponentProps<typeof NatalMagazine>, 'uiPreview'> & {
  onOpenMatrix: () => void; onOpenSettings: () => void;
  uiPreview?: NonNullable<React.ComponentProps<typeof NatalMagazine>['uiPreview']> & { questions?: React.ComponentProps<typeof NatalQuestionExperience>['uiPreview']; futureReadings?: PersonalFutureForecast[] };
};
const LegacyNatalMagazine = dynamic(() => import('../../views/v2/NatalMagazine').then(module => module.NatalMagazine), { ssr: false });
type Mode = 'overview' | 'map' | 'questions' | 'matrix';
type ExperienceProps = React.ComponentProps<typeof NatalMeaningExperience>;
const Host = createContext<{ props: Props; openQuestions: (key: NatalReportCategoryKey) => void; openMap: () => void; tabs: React.ReactNode; explore: React.ReactNode; questionRequest: number } | null>(null);
const chapterCards: Array<{ key: NatalReportCategoryKey; art: ArtName; tone: string }> = [
  { key: 'main', art: 'natal-pages', tone: 'peach' }, { key: 'character', art: 'flower', tone: 'lilac' }, { key: 'love', art: 'rings', tone: 'pink' },
  { key: 'communication', art: 'support', tone: 'blue' }, { key: 'work', art: 'work-pages', tone: 'blue' }, { key: 'money', art: 'matrix', tone: 'lime' },
];
function chapterTitle(key: NatalReportCategoryKey, language: 'ru' | 'en'): string { return getNatalReportCategory(key)?.title[language] || (language === 'ru' ? 'Разбор' : 'Reading'); }
function savedPerson(props: Props): boolean { return props.chartSubject?.subject_type === 'saved_person' || props.chartSubject?.is_primary === false; }
export function NatalTabs({ mode, language, onSelect }: { mode: Mode; language: 'ru' | 'en'; onSelect: (mode: Mode) => void }) {
  const tabs: Array<[Mode, string, string]> = [['map', 'Карта', 'Chart'], ['overview', 'Разбор', 'Reading'], ['matrix', 'Матрица судьбы', 'Destiny Matrix']];
  return <nav className={`nebo-natal-tabs ${styles.tabs}`} aria-label={language === 'ru' ? 'Натальная карта' : 'Natal chart'}>{tabs.map(([key, ru, en]) => <button type="button" key={key} aria-current={mode === key ? 'page' : undefined} onClick={() => onSelect(key)}>{language === 'ru' ? ru : en}</button>)}</nav>;
}
/** Existing catalog owns authorization, stored calculations, generation, cache and Premium. */
export function NeboNatal(props: Props) {
  const preview = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_UI_PREVIEW === '1' ? props.uiPreview : undefined;
  const design = useNeboDesign(props.profile);
  const initialMode: Mode = preview?.initialTab === 'map' ? 'map' : preview?.initialTab === 'matrix' ? 'matrix' : 'overview';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [questionRequest, setQuestionRequest] = useState(preview?.initialTab === 'questions' || preview?.initialTab === 'ask' ? 1 : 0);
  const [view, setView] = useState<NatalExperienceView>('foundation');
  const [questionCategory, setQuestionCategory] = useState<NatalReportCategoryKey>('main');
  const person = savedPerson(props);
  const name = props.chartSubject?.name || props.profile.name || '';
  const language = props.profile.language === 'en' ? 'en' : 'ru';
  const identity = `${props.profile.id}:${props.chartSubject?.id ?? props.chartId ?? 'primary'}`;
  useEffect(() => { setMode(initialMode); setView('foundation'); }, [identity, initialMode]);
  useEffect(() => { if (!props.openQuestionRequest || !props.data || person) return; setMode('overview'); setQuestionRequest(value => value + 1); props.onQuestionRequestHandled?.(); }, [props.openQuestionRequest, props.data, person, props.onQuestionRequestHandled]);
  useEffect(() => { if (props.premiumContinuation?.featureKey === 'natal_questions' && !person) { setMode('overview'); setQuestionRequest(value => value + 1); } }, [props.premiumContinuation?.paywallInstanceId, person]);
  useEffect(() => {
    const back = (event: Event) => { const detail = (event as CustomEvent<NativeBackEventDetail>).detail; if (mode === 'overview' || detail?.handled) return; if (detail) detail.handled = true; setMode('overview'); };
    window.addEventListener(NATIVE_BACK_EVENT, back); return () => window.removeEventListener(NATIVE_BACK_EVENT, back);
  }, [mode]);
  const openQuestions = (key: NatalReportCategoryKey) => { if (person) return; setQuestionCategory(key); setMode('overview'); setQuestionRequest(value => value + 1); };
  const explore = <NeboPersonalExplore profile={props.profile} chartData={props.data || undefined} chartId={props.chartId} requestPremium={props.requestPremium} uiPreview={Boolean(preview)} questionsPreview={preview?.questions} futureReadings={preview ? preview.futureReadings || [] : undefined} questionRequest={questionRequest} questionCategory={questionCategory} premiumContinuation={props.premiumContinuation} onPremiumContinuationHandled={props.onPremiumContinuationHandled}/>;
  const tabs = <NatalTabs mode={mode} language={language} onSelect={setMode}/>;
  // Keep the proven saved-person access boundary until that presentation is migrated separately.
  if (person) return <LegacyNatalMagazine {...props}/>;
  if (mode === 'matrix') return <div className="nebo-screen nebo-natal-screen"><Header name={name} title={language === 'ru' ? 'Натальная карта' : 'Natal chart'} onPeople={props.onOpenCharts} onProfile={props.onOpenSettings}/>{tabs}<NeboMatrixRoom profile={props.profile} onBack={() => setMode('overview')} uiPreview={preview ? {} : undefined} embedded/></div>;
  if (!props.data) return <div className="nebo-screen"><Header name={name} title="Натальная карта" onPeople={props.onOpenCharts} onProfile={props.onOpenSettings} onEscape={preview ? undefined : design.store.escapeToClassic}/>{tabs}<div className="nebo-reader-scroll"><h1>Натальная карта</h1><Art name="natal-pages" className="nebo-empty-art"/>{props.chartLoadState === 'loading' ? <p role="status">Загружаем карту…</p> : props.chartLoadState === 'error' ? <><p role="alert">Карта не загрузилась.</p><button type="button" className="nebo-primary" onClick={props.onRetryChart}>Повторить</button></> : <><p>Добавь данные рождения, чтобы открыть свою карту.</p><button type="button" className="nebo-primary" onClick={props.onCreateChart}>Добавить данные</button></>}</div></div>;
  if (mode === 'map') return <div className="nebo-screen nebo-natal-screen"><Header name={name} title={language === 'ru' ? 'Натальная карта' : 'Natal chart'} onPeople={props.onOpenCharts} onProfile={props.onOpenSettings}/>{tabs}<LayeredSurface initial={{ position: 'collapsed', scrollTop: 0 }} back={<div className={`nebo-reader-scroll nebo-existing-tool ${styles.scroll}`}><><h1>{language === 'ru' ? 'Планеты в твоей карте' : 'Planets in your chart'}</h1><p className="nebo-muted">{name} · {birthLine(props.profile)}</p><p>{language === 'ru' ? 'Значки показывают, где были планеты в момент рождения. Линии отмечают связи между их положениями.' : 'The symbols show planet positions at your birth. Lines mark the relationships between these positions.'}</p><NatalChartWheel chart={props.data} language={language}/><button type="button" className="nebo-soft-button" onClick={() => setMode('overview')}>{language === 'ru' ? 'Читать разбор' : 'Read the interpretation'}</button></></div>}>{explore}</LayeredSurface></div>;
  return <Host.Provider value={{ props, openQuestions, openMap: () => setMode('map'), tabs, explore, questionRequest }}><NatalCatalogReport key={identity} profile={props.profile} chartData={props.data} chartId={props.chartId} chartSubject={props.chartSubject} view={view} onViewChange={setView} requestPremium={props.requestPremium} premiumContinuation={props.premiumContinuation} onPremiumContinuationHandled={props.onPremiumContinuationHandled} canPromotePremium={props.canPromotePremium} onOpenQuestions={openQuestions} experienceComponent={NeboNatalExperience} uiPreview={props.uiPreview?.catalog}/></Host.Provider>;
}
function NeboNatalExperience(experience: ExperienceProps) {
  const host = useContext(Host);
  if (!host) throw new Error('NEBO_NATAL_HOST_REQUIRED');
  const { props, openQuestions, openMap, tabs, explore, questionRequest } = host;
  const exploreController = useRef<LayeredSurfaceController | null>(null);
  useEffect(() => { if (questionRequest) exploreController.current?.setPosition('expanded'); }, [questionRequest]);
  const preview = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_UI_PREVIEW === '1' ? props.uiPreview : undefined;
  const design = useNeboDesign(props.profile);
  const language = props.profile.language === 'en' ? 'en' : 'ru';
  const [readerOpen, setReaderOpen] = useState(false), [contentsOpen, setContentsOpen] = useState(false);
  const [explanation, setExplanation] = useState<NatalExplanationTarget | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const foundationScroller = useRef<HTMLDivElement>(null);
  const readingHeading = useRef<HTMLHeadingElement>(null);
  const foundationReturn = useRef<{ top: number; label: string | null } | null>(null);
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
  const flush = () => { if (persistTimer.current) clearTimeout(persistTimer.current); persistTimer.current = null; const reading = pendingPosition.current; pendingPosition.current = null; if (reading && !preview) void design.store.update({ reading }); };
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
  useLayoutEffect(() => {
    if (readerOpen) { readingHeading.current?.focus({ preventScroll: true }); return; }
    const position = foundationReturn.current;
    const element = foundationScroller.current;
    if (!position || !element) return;
    // Reopen the contents when the initiating button lives inside it.
    const button = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(item => item.textContent === position.label);
    const contents = button?.closest('details');
    if (contents) contents.open = true;
    button?.focus({ preventScroll: true });
    element.scrollTop = position.top;
  }, [readerOpen, selectedCategory]);
  useEffect(() => { if (props.premiumContinuation?.featureKey === 'natal_deep') setReaderOpen(true); }, [props.premiumContinuation?.paywallInstanceId]);
  const closeReading = () => { captureRef.current(); flushRef.current(); setReaderOpen(false); setContentsOpen(false); progressState.current = { key: '', restored: false }; };
  useEffect(() => {
    const back = (event: Event) => { const detail = (event as CustomEvent<NativeBackEventDetail>).detail; if (detail?.handled || explanation || !readerOpen) return; if (detail) detail.handled = true; if (contentsOpen) setContentsOpen(false); else closeReading(); };
    window.addEventListener(NATIVE_BACK_EVENT, back); return () => window.removeEventListener(NATIVE_BACK_EVENT, back);
  }, [readerOpen, contentsOpen, explanation]);
  const readCategory = (category: NatalReportCategoryKey) => { if (!readerOpen) foundationReturn.current = { top: foundationScroller.current?.scrollTop || 0, label: document.activeElement?.textContent || null }; captureRef.current(); flushRef.current(); setContentsOpen(false); setReaderOpen(true); progressState.current = { key: '', restored: false }; experience.onSelectCategory(category); };
  if (readerOpen) return <div className="nebo-screen nebo-natal-screen"><Header name={experience.subjectName} title={title} onBack={closeReading} onPeople={props.onOpenCharts} onProfile={props.onOpenSettings}/>{tabs}<div className="nebo-reading-toolbar"><button type="button" onClick={() => setContentsOpen(!contentsOpen)} aria-expanded={contentsOpen}>Разделы <Glyph name="next" size={16}/></button>{!locked && pack?.summary.length ? <button type="button" onClick={() => { captureRef.current(); flushRef.current(); }} aria-label="Запомнить место чтения"><Glyph name="bookmark"/></button> : null}</div>
    {contentsOpen ? <nav className="nebo-contents" aria-label="Разделы разбора">{chapterCards.map(c => <button type="button" key={c.key} aria-current={selectedCategory === c.key ? 'page' : undefined} onClick={() => readCategory(c.key)}>{chapterTitle(c.key, language)}</button>)}</nav> : null}
    <div className="nebo-reader-scroll" ref={scroller} onScroll={capturePosition}><p className="nebo-muted">{experience.subjectName} · {birthLine(subject)}</p><h1 ref={readingHeading} tabIndex={-1}>{title}</h1>
      {reliability.quality !== 'exact' ? <button type="button" className="nebo-soft-button" onClick={() => setExplanation({ mode: 'accuracy', title: 'Что учтено в разборе' })}>Время рождения: что учтено?</button> : null}
      {locked ? <section className="nebo-locked"><Art name="premium"/><h2>Полный разбор с Premium</h2><p>Открой этот раздел и остальные главы своей карты.</p>{experience.canPromotePremium ? <button id={`natal-chapter-${selectedCategory}`} type="button" className="nebo-primary" onClick={() => experience.onRequestPremium(selectedCategory)}>Посмотреть доступ</button> : null}</section> : pack?.summary.length ? <article>{pack.summary.map((paragraph,index) => <section data-reading-block={index} className="nebo-reading-block" key={`${contentVersion}-${index}`}><div><h2 className={styles.observationTitle}>{index === 0 || index === 3 || index === 5 ? <Art name={index === 0 ? 'flower' : index === 3 ? 'work-pages' : 'support'} className={styles.observationArt}/> : null}<span>{paragraph.title}</span></h2><button type="button" className="nebo-why" onClick={() => setExplanation({ mode: 'why', title: paragraph.title || 'В твоей карте', text: paragraph.text, evidenceIds: paragraph.evidenceIds })}>Почему так?</button></div><p>{paragraph.text}</p></section>)}</article> : experience.categoryLoading ? <p role="status">Готовим разбор…</p> : <section role="alert"><p>{experience.categoryError || 'Разбор не загрузился.'}</p><button type="button" className="nebo-primary" onClick={experience.onRetryCategory}>Повторить</button></section>}
      {!locked && pack?.summary.length ? <section className="nebo-reading-next"><h2>Продолжить читать</h2>{(pack.followUps?.filter(f => f.categoryKey !== selectedCategory) || []).map(f => <ActionRow key={f.categoryKey} title={f.label} subtitle={chapterTitle(f.categoryKey,language)} onClick={() => readCategory(f.categoryKey)}/>)}<button type="button" className="nebo-primary" onClick={() => { setContentsOpen(true); scroller.current?.scrollTo({ top: 0 }); }}>Все разделы</button></section> : null}
      {design.error ? <p className="nebo-save-notice" role="status">Место чтения пока не синхронизировано.</p> : null}
    </div><NatalEvidenceSheet target={locked && explanation?.mode === 'why' ? null : explanation} profile={experience.profile} chartData={experience.chartData} onClose={() => setExplanation(null)}/>
  </div>;
  const back = <div className={`nebo-personal nebo-natal-foundation ${styles.foundation}`}>
    <h1>{language === 'ru' ? 'Коротко о тебе' : 'You, in a few words'}</h1>
    <p className="nebo-muted">{experience.subjectName} · {birthLine(subject)}</p>
    <p className={styles.intro}>{language === 'ru' ? 'Как ты выбираешь, общаешься и берёшься за дела. У каждого наблюдения можно посмотреть, откуда оно взялось в твоей карте.' : 'How you choose, communicate and approach things. Each observation includes the chart details behind it.'}</p>
    {reliability.quality !== 'exact' ? <button type="button" className="nebo-soft-button" onClick={() => setExplanation({ mode: 'accuracy', title: language === 'ru' ? 'Что известно без точного времени' : 'What is known without an exact time' })}>{language === 'ru' ? 'Время рождения: что учтено?' : 'Birth time: what is included?'}</button> : null}
    {saved && saved.category !== 'main' ? <ActionRow title={language === 'ru' ? 'Продолжить с места' : 'Continue reading'} subtitle={chapterTitle(saved.category,language)} onClick={() => readCategory(saved.category)}/> : null}
    {experience.mainPack?.summary.length ? <>
      <article aria-label={language === 'ru' ? 'Бесплатный разбор' : 'Free reading'}>{experience.mainPack.summary.map((paragraph, index) => <section className="nebo-reading-block" key={index}><div>{paragraph.title ? <h2>{paragraph.title}</h2> : null}<button type="button" className="nebo-why" aria-label={`${language === 'ru' ? 'Почему так' : 'Why'}: ${paragraph.title || paragraph.text}`} onClick={() => setExplanation({ mode: 'why', title: paragraph.title || (language === 'ru' ? 'В твоей карте' : 'In your chart'), text: paragraph.text, evidenceIds: paragraph.evidenceIds })}>{language === 'ru' ? 'Почему так?' : 'Why?'}</button></div><p>{paragraph.text}</p></section>)}</article>
    <details className={styles.chapters}>
      <summary>{language === 'ru' ? 'Все темы разбора' : 'All reading topics'}<Glyph name="next" size={18}/></summary>
      <nav aria-label={language === 'ru' ? 'Темы подробного разбора' : 'Detailed reading topics'}>{chapterCards.filter(c => c.key !== 'main').map(c => <ActionRow key={c.key} title={chapterTitle(c.key, language)} subtitle={experience.isPremium ? undefined : 'Premium'} onClick={() => readCategory(c.key)}/>)}</nav>
    </details>
      {experience.mainPack.followUps?.length ? <section className="nebo-reading-next"><h2>{language === 'ru' ? 'Что ещё про тебя?' : 'What else about you?'}</h2>{experience.mainPack.followUps.slice(0, 3).map(item => <ActionRow key={item.categoryKey} title={item.label} subtitle={`${chapterTitle(item.categoryKey, language)}${experience.isPremium ? '' : ' · Premium'}`} onClick={() => readCategory(item.categoryKey)}/>)}</section> : null}
    </> : experience.categoryLoading ? <p role="status">{language === 'ru' ? 'Готовим разбор…' : 'Preparing the reading…'}</p> : <section role="alert"><p>{experience.categoryError || (language === 'ru' ? 'Разбор не загрузился.' : 'The reading did not load.')}</p><button type="button" className="nebo-soft-button" onClick={experience.onRetryCategory}>{language === 'ru' ? 'Повторить загрузку' : 'Try again'}</button></section>}
    <ActionRow title={language === 'ru' ? 'Посмотреть схему планет' : 'View the planet chart'} subtitle={language === 'ru' ? 'Положения планет в момент твоего рождения' : 'Planet positions at your birth'} icon="chart" onClick={openMap}/>

    <ActionRow title={language === 'ru' ? 'Есть свой вопрос?' : 'Have your own question?'} subtitle={language === 'ru' ? 'Перейти в «Спросить о себе»' : 'Open Ask about yourself'} onClick={() => openQuestions('main')}/>
  </div>;
  return <div className="nebo-screen nebo-natal-screen"><Header name={experience.subjectName} title={language === 'ru' ? 'Натальная карта' : 'Natal chart'} onPeople={props.onOpenCharts} onProfile={props.onOpenSettings} onEscape={preview ? undefined : design.store.escapeToClassic}/>{tabs}<LayeredSurface initial={{ position: questionRequest ? 'expanded' : 'collapsed', scrollTop: 0 }} controlRef={exploreController} active={!explanation} back={<div ref={foundationScroller} className={`nebo-reader-scroll ${styles.scroll}`}>{back}</div>}>{explore}</LayeredSurface><NatalEvidenceSheet target={explanation} profile={experience.profile} chartData={experience.chartData} onClose={() => setExplanation(null)}/></div>;
}
