import React, { useEffect, useRef, useState } from 'react';
import type { NatalChartData, SynastryResult, UserProfile } from '../../types';
import type { SignCompatibilityResult } from '../../lib/synastry/signCompatibility';
import type { PaywallContext } from '../../lib/paywallContext';
import { getZodiacSign } from '../../constants';
import { getProfilePremiumUntil, hasActivePremium } from '../../lib/accessMatrix';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import { COMPATIBILITY_STORY_TOPICS, compatibilityTopicTitle } from '../../lib/synastry/storyTopics';
import { getCharts, type ChartListItem } from '../../services/storageService';
import { calculateExtendedSynastry, getSignCompatibility } from '../../services/astrologyService';
import { toDateInputValue } from '../../lib/date-utils';
import { sunSignFromDate } from '../../lib/synastry/compatScore';
import {
  getRelationshipContextOption,
  normalizeRelationshipContext,
  type RelationshipContext,
} from '../../lib/synastry/relationshipContext';
import {
  addCompatHistory,
  buildCompatHistoryId,
  loadCompatHistory,
  type CompatHistoryEntry,
} from '../../lib/compatHistory';
import { ZODIAC_KEYS, type ZodiacKey, normalizeZodiacKey } from '../../lib/zodiacKeys';
import { Art, Glyph, Header, type ArtName } from './Primitives';
import homeStyles from './NeboUnionHome.module.css';
import { LayeredSurface } from './LayeredSurface';
import type { LayeredSurfaceController } from '../../lib/neboDesign/layeredSurface';
import { NeboPairFuture, NeboPairQuestions, type PairSubject } from './NeboPairFuture';

type SynastryPrefill = {
  source: 'saved-chart' | 'manual';
  partnerChartId?: number;
  partnerName?: string;
  partnerDate?: string;
  partnerTime?: string;
  partnerPlace?: string;
} | null;

type Props = {
  profile: UserProfile;
  chartData?: NatalChartData | null;
  chartId?: number | null;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  initialPrefill?: SynastryPrefill;
  onOpenCharts?: () => void;
  onCreateNatalChart?: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
  canPromotePremium?: boolean;
  onOpenEncyclopedia?: () => void;
  onOpenProfile?: () => void;
  uiPreview?: {
    screen?: 'home' | 'create' | 'result'; mode?: 'sign' | 'birth'; phase?: 'ready' | 'loading' | 'error';
    charts?: ChartListItem[]; result: SynastryResult; signResult: SignCompatibilityResult;
  };
};

type Screen = 'home' | 'create' | 'result' | 'detail';
type Mode = 'sign' | 'birth';

type ResultSection = {
  id: string;
  title: string;
  subtitle: string;
  text: string;
  tone: 'blue' | 'pink' | 'peach' | 'lilac' | 'lime';
  art: ArtName;
  evidenceIds?: string[];
};

const RELATIONS: Array<{ value: RelationshipContext; ru: string; en: string }> = [
  { value: 'relationship', ru: 'Пара', en: 'Couple' },
  { value: 'friendship', ru: 'Друзья', en: 'Friends' },
  { value: 'work', ru: 'Коллеги', en: 'Colleagues' },
  { value: 'family', ru: 'Родственники', en: 'Family' },
];

function initial(value?: string | null) {
  return String(value || '').trim().slice(0, 1).toUpperCase() || '•';
}

function readableDate(value?: string | null, language: 'ru' | 'en' = 'ru') {
  if (!value) return '';
  const normalized = toDateInputValue(value);
  if (!normalized) return value;
  const parsed = new Date(`${normalized}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed).replace(' г.', '');
}

export function deepSections(result: SynastryResult, ru: boolean): ResultSection[] {
  const tones: ResultSection['tone'][] = ['blue', 'pink', 'peach', 'lilac', 'lime'];
  const arts: ArtName[] = ['support', 'compatibility', 'today', 'security', 'saved-cards'];
  const paragraphs = result.storyParagraphs;
  if (paragraphs?.length && paragraphs.every(item => COMPATIBILITY_STORY_TOPICS.includes(item.topic))) {
    const context = normalizeRelationshipContext(result.relationshipContext);
    return [...new Set(paragraphs.map(item => item.topic))].map((topic, index) => {
      const items = paragraphs.filter(item => item.topic === topic);
      return {
        id: topic,
        title: compatibilityTopicTitle(topic, context, ru ? 'ru' : 'en'),
        subtitle: items[0].text.split(/(?<=[.!])\s/u)[0],
        text: items.map(item => item.text).join('\n\n'),
        evidenceIds: [...new Set(items.flatMap(item => item.evidenceIds))],
        tone: tones[index % tones.length], art: arts[index % arts.length],
      };
    });
  }
  if (result.sections?.length) {
    return result.sections.slice(0, 6).map((section, index) => ({
      id: section.id || `section-${index}`,
      title: section.title || (ru ? `Раздел ${index + 1}` : `Section ${index + 1}`),
      subtitle: section.text.slice(0, 78),
      text: section.text,
      tone: tones[index % tones.length],
      art: arts[index % arts.length],
    }));
  }
  // A saved story without chapters stays one complete reading. Never repeat it
  // under made-up topics or infer relationship claims from a new heading.
  return result.summary?.trim() ? [{
    id: 'saved-reading', title: ru ? 'Ваш разбор' : 'Your reading',
    subtitle: ru ? 'Читать полностью' : 'Read in full', text: result.summary,
    tone: 'lilac', art: 'compatibility', evidenceIds: result.narrativeEvidenceIds,
  }] : [];
}

function signSections(result: SignCompatibilityResult, ru: boolean): ResultSection[] {
  return [
    { id: 'communication', title: ru ? 'Общение' : 'Communication', subtitle: ru ? 'Как вам легче понимать друг друга' : 'How you understand each other', text: result.communication, tone: 'blue', art: 'support' },
    { id: 'attraction', title: ru ? 'Притяжение' : 'Attraction', subtitle: ru ? 'Что может цеплять в этой паре' : 'What may draw you together', text: result.attraction, tone: 'pink', art: 'compatibility' },
    { id: 'difficulty', title: ru ? 'Разногласия' : 'Friction', subtitle: ru ? 'Где чаще всего начинаются споры' : 'Where friction may start', text: result.difficulty, tone: 'peach', art: 'today' },
  ];
}

function PersonRow({ name, detail, selected, onClick }: { name: string; detail: string; selected?: boolean; onClick: () => void }) {
  return <button type="button" className={`nebo-compat-person-row${selected ? ' is-selected' : ''}`} aria-pressed={Boolean(selected)} onClick={onClick}>
    <span className="nebo-compat-person-avatar">{initial(name)}</span>
    <span><strong>{name}</strong><small>{detail}</small></span>
    <Glyph name="next" size={18}/>
  </button>;
}

export function NeboUnionRoom({
  profile,
  chartData,
  chartId,
  requestPremium,
  initialPrefill,
  onOpenCharts,
  onCreateNatalChart,
  premiumContinuation,
  onPremiumContinuationHandled,
  canPromotePremium = true,
  onOpenProfile,
  uiPreview,
}: Props) {
  const preview = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_UI_PREVIEW === '1' ? uiPreview : undefined;
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const ru = language === 'ru';
  const [clock, setClock] = useState(Date.now);
  const premium = hasActivePremium(profile, Math.max(clock, Date.now()));
  const premiumUntil = getProfilePremiumUntil(profile);
  const ownSign = normalizeZodiacKey(String(chartData?.sun?.sign || ''))
    || normalizeZodiacKey(String(sunSignFromDate(profile.birthDate) || ''))
    || 'Aries';
  const [screen, setScreen] = useState<Screen>(initialPrefill ? 'create' : 'home');
  const [mode, setMode] = useState<Mode>(initialPrefill ? 'birth' : 'sign');
  const [relation, setRelation] = useState<RelationshipContext>('relationship');
  const [signA, setSignA] = useState<ZodiacKey>(ownSign);
  const [signB, setSignB] = useState<ZodiacKey>('Taurus');
  const [partnerName, setPartnerName] = useState(initialPrefill?.partnerName || '');
  const [partnerDate, setPartnerDate] = useState(toDateInputValue(initialPrefill?.partnerDate || ''));
  const [partnerTime, setPartnerTime] = useState(initialPrefill?.partnerTime || '');
  const [partnerPlace, setPartnerPlace] = useState(initialPrefill?.partnerPlace || '');
  const [partnerChartId, setPartnerChartId] = useState<number | undefined>(initialPrefill?.partnerChartId);
  const [unknownTime, setUnknownTime] = useState(!initialPrefill?.partnerTime);
  const [charts, setCharts] = useState<ChartListItem[]>([]);
  const [history, setHistory] = useState<CompatHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signResult, setSignResult] = useState<SignCompatibilityResult | null>(null);
  const [deepResult, setDeepResult] = useState<SynastryResult | null>(null);
  const [sections, setSections] = useState<ResultSection[]>([]);
  const [activeSection, setActiveSection] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const futureSurface = useRef<LayeredSurfaceController | null>(null);
  const requestRef = useRef(0);
  const busyRef = useRef(false);
  const resumeRef = useRef('');

  useEffect(() => {
    const refresh = () => setClock(Date.now());
    const deadline = premiumUntil ? Date.parse(premiumUntil) : NaN;
    const timer = premium && Number.isFinite(deadline) && deadline > Date.now()
      ? setTimeout(refresh, Math.min(deadline - Date.now() + 1, 2_147_483_647)) : null;
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { if (timer) clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [clock, premium, premiumUntil]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    scrollRef.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }, [screen, activeSection]);
  useEffect(() => {
    const back = (event: Event) => {
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail?.handled || screen === 'home') return;
      if (screen === 'result' && futureSurface.current?.collapseOne()) { if (detail) detail.handled = true; event.preventDefault(); return; }
      if (detail) detail.handled = true;
      requestRef.current += 1; busyRef.current = false; setLoading(false);
      setScreen(screen === 'detail' ? 'result' : screen === 'result' ? 'create' : 'home');
    };
    window.addEventListener(NATIVE_BACK_EVENT, back);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, back);
  }, [screen]);

  useEffect(() => {
    if (preview) {
      const birth = preview.mode !== 'sign';
      setMode(birth ? 'birth' : 'sign');
      setCharts(preview.charts || []); setHistory([]);
      setLoading(preview.phase === 'loading');
      setError(preview.phase === 'error' ? (ru ? 'Разбор не загрузился. Попробуй ещё раз.' : 'The reading did not load. Try again.') : null);
      setDeepResult(birth ? preview.result : null); setSignResult(birth ? null : preview.signResult);
      setSections(birth ? deepSections(preview.result, ru) : signSections(preview.signResult, ru));
      setScreen(preview.phase && preview.phase !== 'ready' ? 'create' : preview.screen || 'home');
      return;
    }
    setSignResult(null); setDeepResult(null); setSections([]); setError(null); setLoading(false);
    setScreen(initialPrefill ? 'create' : 'home');
    setHistory(loadCompatHistory(profile.id).filter((entry) => entry.kind === 'person'));
    if (!profile.id) return;
    let alive = true;
    void getCharts(profile.id, { repairPrimary: false }).then((response) => {
      if (!alive) return;
      setCharts((response.charts || []).filter((chart) => !chart.archived_at && chart.subject_type === 'saved_person'));
    }).catch(() => { if (alive) setCharts([]); });
    return () => { alive = false; requestRef.current += 1; busyRef.current = false; };
  }, [profile.id, preview]);

  useEffect(() => {
    if (!initialPrefill || preview) return;
    requestRef.current += 1; busyRef.current = false; setLoading(false); setError(null);
    setMode('birth'); setScreen('create');
    setPartnerName(initialPrefill.partnerName || '');
    setPartnerDate(toDateInputValue(initialPrefill.partnerDate || ''));
    setPartnerTime(initialPrefill.partnerTime || '');
    setPartnerPlace(initialPrefill.partnerPlace || '');
    setPartnerChartId(initialPrefill.partnerChartId);
    setUnknownTime(!initialPrefill.partnerTime);
  }, [initialPrefill, preview]);

  const relationOption = getRelationshipContextOption(relation);

  const chooseSaved = (chart: ChartListItem) => {
    if (chart.access_locked) {
      if (canPromotePremium) void requestPremium('compatibility_by_charts', { featureKey: 'synastry_by_charts', returnView: 'synastry', returnAction: 'open_birth_compatibility' });
      return;
    }
    setPartnerChartId(chart.id);
    setPartnerName(chart.name);
    setPartnerDate(toDateInputValue(chart.birth_date));
    setPartnerTime(chart.birth_time || '');
    setPartnerPlace(chart.birth_place);
    setUnknownTime(!chart.birth_time);
    setMode('birth');
  };

  const openResult = (nextSections: ResultSection[]) => {
    setSections(nextSections);
    setActiveSection(0);
    setScreen('result');
  };

  const runSign = async () => {
    if (busyRef.current) return;
    if (preview) { setLoading(false); setError(null); setDeepResult(null); setSignResult(preview.signResult); openResult(signSections(preview.signResult, ru)); return; }
    busyRef.current = true;
    const request = ++requestRef.current;
    setLoading(true); setError(null); setDeepResult(null);
    try {
      const result = await getSignCompatibility(signA, signB, language, 'unspecified', 'unspecified', relation);
      if (request !== requestRef.current) return;
      setSignResult(result);
      openResult(signSections(result, ru));
    } catch {
      if (request !== requestRef.current) return;
      setError(ru ? 'Не удалось загрузить сравнение. Попробуй ещё раз.' : 'Could not load the comparison. Try again.');
    } finally { if (request === requestRef.current) { busyRef.current = false; setLoading(false); } }
  };

  const runBirth = async () => {
    if (busyRef.current) return;
    if (!profile.birthDate) { onCreateNatalChart?.(); return; }
    if (!partnerName.trim() || !partnerDate) {
      setError(ru ? 'Добавь имя и дату рождения второго человека.' : 'Add the second person’s name and birth date.');
      return;
    }
    if (!premium) {
      if (canPromotePremium) await requestPremium('compatibility_by_charts', {
        placement: 'compatibility_by_charts', featureKey: 'synastry_by_charts', triggerType: 'locked_feature', returnView: 'synastry', returnAction: 'open_birth_compatibility',
      });
      return;
    }
    if (preview) { setLoading(false); setError(null); setSignResult(null); setDeepResult(preview.result); openResult(deepSections(preview.result, ru)); return; }
    busyRef.current = true;
    const request = ++requestRef.current;
    setLoading(true); setError(null); setSignResult(null);
    try {
      const result = await calculateExtendedSynastry(
        profile,
        partnerName.trim(),
        partnerDate,
        unknownTime ? undefined : partnerTime || undefined,
        partnerPlace || undefined,
        relationOption.backendValue,
        partnerChartId,
        chartId ?? undefined,
        {
          name: profile.name || (ru ? 'Я' : 'Me'),
          date: profile.birthDate,
          time: profile.birthTime || undefined,
          place: profile.birthPlace || undefined,
          source: chartId ? 'saved' : 'birth',
          sign: ownSign,
          gender: profile.gender === 'female' || profile.gender === 'male' ? profile.gender : 'unspecified',
          birthTimeQuality: profile.birthTimeMode === 'unknown' ? 'unknown' : profile.birthTimeMode === 'approximate' ? 'approximate' : profile.birthTime ? 'exact' : 'unknown',
        },
        {
          source: partnerChartId ? 'saved' : 'birth',
          sign: normalizeZodiacKey(String(sunSignFromDate(partnerDate) || '')) || undefined,
          gender: 'unspecified',
          birthTimeQuality: unknownTime ? 'unknown' : 'exact',
        },
        relation,
      );
      if (request !== requestRef.current) return;
      setDeepResult(result.result);
      const partnerSun = normalizeZodiacKey(String(sunSignFromDate(partnerDate) || '')) || 'Libra';
      const overall = Number(result.result.overallScore ?? result.result.compatibilityScore ?? 0);
      setHistory(addCompatHistory({
        id: buildCompatHistoryId('person', undefined, partnerName, partnerDate, relation, chartId ?? undefined, partnerChartId),
        kind: 'person', name: partnerName, date: partnerDate, time: unknownTime ? undefined : partnerTime || undefined,
        place: partnerPlace, chartId: partnerChartId, subjectChartId: chartId ?? undefined,
        subjectName: profile.name, subjectDate: profile.birthDate, subjectTime: profile.birthTime,
        subjectPlace: profile.birthPlace, subjectSource: chartId ? 'saved' : 'birth', partnerSource: partnerChartId ? 'saved' : 'birth',
        subjectSign: ownSign, partnerSign: partnerSun, yourSun: ownSign, theirSun: partnerSun,
        relationshipContext: relation, overall: Number.isFinite(overall) ? overall : 0, ts: Date.now(),
      }, profile.id));
      openResult(deepSections(result.result, ru));
    } catch {
      if (request !== requestRef.current) return;
      setError(ru ? 'Разбор не загрузился. Проверь данные рождения и попробуй ещё раз.' : 'The reading did not load. Check the birth details and try again.');
    } finally { if (request === requestRef.current) { busyRef.current = false; setLoading(false); } }
  };

  useEffect(() => {
    if (!premium || premiumContinuation?.featureKey !== 'synastry_by_charts'
      || resumeRef.current === premiumContinuation.paywallInstanceId) return;
    resumeRef.current = premiumContinuation.paywallInstanceId;
    setMode('birth'); setScreen('create');
    onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
    if (partnerName.trim() && partnerDate) void runBirth();
    // Resume exactly once when the existing paywall grants this comparison.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [premium, premiumContinuation?.paywallInstanceId, onPremiumContinuationHandled]);

  const startMode = (next: Mode) => {
    setMode(next); setError(null); setScreen('create');
  };

  const navigateBack = (next: Screen) => {
    requestRef.current += 1; busyRef.current = false; setLoading(false); setScreen(next);
  };

  const reopenHistory = (entry: CompatHistoryEntry) => {
    setMode('birth'); setRelation(entry.relationshipContext || 'relationship');
    setPartnerName(entry.name || ''); setPartnerDate(toDateInputValue(entry.date || ''));
    setPartnerTime(entry.time || ''); setUnknownTime(!entry.time); setPartnerPlace(entry.place || ''); setPartnerChartId(entry.chartId);
    setScreen('create');
  };

  if (mode === 'birth' && !premium && (screen === 'detail' || screen === 'result')) {
    return <div className="nebo-screen nebo-compat-screen">
      <Header title={ru ? 'Совместимость' : 'Compatibility'} name={profile.name || ''} onBack={() => navigateBack('create')} onPeople={onOpenCharts} onProfile={onOpenProfile || onOpenCharts}/>
      <div ref={scrollRef} className="nebo-reader-scroll nebo-compat-create"><h1 tabIndex={-1}>{ru ? 'Подробный разбор' : 'Detailed reading'}</h1><p>{ru ? 'Эта часть совместимости доступна с Premium.' : 'This compatibility reading is available with Premium.'}</p>{canPromotePremium ? <button type="button" className="nebo-primary" onClick={() => void runBirth()}>{ru ? 'Открыть Premium' : 'Open Premium'}</button> : null}</div>
    </div>;
  }
  if (screen === 'detail' && sections[activeSection]) {
    const section = sections[activeSection];
    const facts = (deepResult?.evidence || []).filter(item => section.evidenceIds?.includes(item.id));
    return <div className="nebo-screen nebo-compat-screen">
      <Header title={ru ? 'Совместимость' : 'Compatibility'} name={profile.name || ''} onBack={() => navigateBack('result')} onPeople={onOpenCharts} onProfile={onOpenProfile || onOpenCharts}/>
      <div ref={scrollRef} className="nebo-reader-scroll nebo-compat-detail">
        <p className="nebo-compat-detail-people">{mode === 'birth' ? `${profile.name} + ${partnerName}` : `${getZodiacSign(language, signA)} + ${getZodiacSign(language, signB)}`}</p>
        <div className={`nebo-compat-detail-hero nebo-tone-${section.tone}`}><Art name={section.art}/><div><p>{ru ? `Раздел ${activeSection + 1} из ${sections.length}` : `Chapter ${activeSection + 1} of ${sections.length}`}</p><h1 tabIndex={-1}>{section.title}</h1></div></div>
        {section.text.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={`${section.id}-${index}`}>{paragraph}</p>)}
        {facts.length ? <details className="nebo-compat-evidence"><summary>{ru ? 'Почему так?' : 'Why?'}</summary><ul>{facts.map(item => <li key={item.id}>{item.label}</li>)}</ul></details> : null}
        {activeSection + 1 < sections.length ? <button type="button" className="nebo-primary" onClick={() => setActiveSection(activeSection + 1)}>{ru ? `Дальше: ${sections[activeSection + 1].title}` : `Next: ${sections[activeSection + 1].title}`} <Glyph name="next" size={18}/></button> : <button type="button" className="nebo-primary" onClick={() => setScreen('result')}>{ru ? 'К разделам разбора' : 'Back to chapters'}</button>}
      </div>
    </div>;
  }

  if (screen === 'result') {
    const signMode = mode === 'sign';
    const left = signMode ? getZodiacSign(language, signA) : (profile.name || (ru ? 'Ты' : 'You'));
    const right = signMode ? getZodiacSign(language, signB) : partnerName;
    const summary = deepResult?.storyParagraphs?.[0]?.text || deepResult?.summary?.split(/\n\s*\n/u)[0] || signResult?.attraction || '';
    const pair: PairSubject = { mode, signA, signB, relation, language, ...(chartId ? { chartId } : {}), ...(partnerChartId ? { partnerChartId } : {}), ...(partnerDate ? { partnerDate } : {}) };
    const names = `${left} + ${right}`;
    const onPairPremium = () => { void requestPremium('compatibility_pair_reading'); };
    const content = <div ref={scrollRef} className={`nebo-compat-result ${homeStyles.resultBack} ${signMode ? homeStyles.signResult : ''}`}>
        <h1 tabIndex={-1}>{left} + {right}</h1><p className="nebo-muted">{RELATIONS.find((item) => item.value === relation)?.[language] || relationOption.label[language]}</p>
        {signMode ? <>
          <div className={homeStyles.resultPair} aria-hidden="true"><img src={`/zodiac/sign_symbol_${signA.toLowerCase()}.png`} alt=""/><Art name="compatibility" size={54}/><img src={`/zodiac/sign_symbol_${signB.toLowerCase()}.png`} alt=""/></div>
          <div className={homeStyles.readings}>{sections.map(section => <section className={homeStyles.reading} data-tone={section.tone} key={section.id}><div className={homeStyles.readingHeading}><span><Glyph name={section.id === 'communication' ? 'message' : section.id === 'attraction' ? 'people' : 'sun'} size={22}/></span><h2>{section.id === 'attraction' && relation !== 'relationship' && relation !== 'romance' ? (ru ? 'Что вас сближает' : 'What brings you together') : section.title}</h2></div><div className={homeStyles.readingBody}>{section.text.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div></section>)}</div>
          <div className={homeStyles.resultActions}><button type="button" onClick={() => startMode('sign')}><Glyph name="people"/><span><strong>{ru ? 'Другая пара знаков' : 'Another pair of signs'}</strong><small>{ru ? 'Выбери, кого ещё сравнить' : 'Choose who to compare next'}</small></span><Glyph name="next" size={18}/></button><button type="button" onClick={() => startMode('birth')}><Glyph name="chart"/><span><strong>{ru ? 'А если подробнее?' : 'Want more detail?'}</strong><small>{ru ? 'Сравнение по данным рождения' : 'Compare using birth details'}</small></span><Glyph name="next" size={18}/></button></div>
        </> : <><section className="nebo-compat-result-hero"><div><strong>{ru ? 'Ваше сочетание' : 'Your connection'}</strong><p>{summary}</p></div><Art name="compatibility"/></section>
        <h2>{ru ? 'Разделы разбора' : 'Reading sections'}</h2>
        <div className="nebo-compat-result-list">{sections.map((section, index) => <button type="button" key={section.id} className={`nebo-compat-result-row nebo-tone-${section.tone}`} onClick={() => { setActiveSection(index); setScreen('detail'); }}><Art name={section.art}/><span><strong>{section.title}</strong><small>{section.subtitle}</small></span><Glyph name="next" size={18}/></button>)}</div>
        </>}
        {signMode ? <p className="nebo-compat-limitation">{ru ? 'Общий разбор по двум знакам. Для личного сравнения нужны данные рождения.' : 'A general reading of two signs. Birth details make the comparison personal.'}</p> : deepResult?.limitations?.length ? <details className="nebo-compat-evidence"><summary>{ru ? 'Что зависит от времени рождения' : 'What depends on birth time'}</summary><ul>{deepResult.limitations.map((text, index) => <li key={index}>{text}</li>)}</ul></details> : null}
        <button type="button" className={homeStyles.futureEntry} onClick={() => futureSurface.current?.setPosition('expanded')}><span><strong>{ru ? 'А что вас ждёт впереди?' : 'What lies ahead for you two?'}</strong><small>{ru ? 'Будущие даты и темы для вас двоих' : 'Future dates and topics for you two'}</small></span><Glyph name="next" size={20}/></button>
        <NeboPairQuestions key={`${mode}:${signA}:${signB}:${partnerChartId || partnerDate}:${relation}`} pair={pair} names={names} premium={premium} onPremium={onPairPremium}/>
      </div>;
    return <div className="nebo-screen nebo-compat-screen">
      <Header title={ru ? 'Совместимость' : 'Compatibility'} name={profile.name || ''} onBack={() => navigateBack('create')} onPeople={onOpenCharts} onProfile={onOpenProfile || onOpenCharts}/>
      <LayeredSurface controlRef={futureSurface} collapsedPeek={48} initial={{ position: 'collapsed', scrollTop: 0 }} back={content}>
        <NeboPairFuture key={`${mode}:${signA}:${signB}:${partnerChartId || partnerDate}:${relation}`} pair={pair} names={names} premium={premium} onPremium={onPairPremium}/>
      </LayeredSurface>
    </div>;
  }

  if (screen === 'create') {
    return <div className="nebo-screen nebo-compat-screen">
      <Header title={ru ? 'Совместимость' : 'Compatibility'} name={profile.name || ''} onBack={() => navigateBack('home')} onPeople={onOpenCharts} onProfile={onOpenProfile || onOpenCharts}/>
      <div ref={scrollRef} className="nebo-reader-scroll nebo-compat-create">
        <h1 tabIndex={-1}>{ru ? 'Кого сравниваем?' : 'Who are we comparing?'}</h1>
        <p className="nebo-muted">{ru ? 'Выбери способ и добавь второго человека.' : 'Choose a method and add the second person.'}</p>
        <form onSubmit={event => { event.preventDefault(); void (mode === 'sign' ? runSign() : runBirth()); }}>
        <fieldset disabled={loading} className="nebo-compat-form-fields">
        <legend className="sr-only">{ru ? 'Данные сравнения' : 'Comparison details'}</legend>
        <div className="nebo-compat-mode-tabs" role="group" aria-label={ru ? 'Способ сравнения' : 'Comparison method'}><button type="button" aria-pressed={mode === 'sign'} onClick={() => { setMode('sign'); setError(null); }}>{ru ? 'По знакам' : 'By signs'}</button><button type="button" aria-pressed={mode === 'birth'} onClick={() => { setMode('birth'); setError(null); }}>{ru ? 'По данным рождения' : 'By birth data'}</button></div>
        {mode === 'sign' ? <>
          <div className="nebo-compat-sign-pair"><label><span>{ru ? 'Первый знак' : 'First sign'}</span><select name="first-sign" value={signA} onChange={(event) => setSignA(event.target.value as ZodiacKey)}>{ZODIAC_KEYS.map((key) => <option key={key} value={key}>{getZodiacSign(language, key)}</option>)}</select></label><span className="nebo-compat-link-art"><Art name="compatibility"/></span><label><span>{ru ? 'Второй знак' : 'Second sign'}</span><select name="second-sign" value={signB} onChange={(event) => setSignB(event.target.value as ZodiacKey)}>{ZODIAC_KEYS.map((key) => <option key={key} value={key}>{getZodiacSign(language, key)}</option>)}</select></label></div>
        </> : <>
          <section className="nebo-compat-self-card"><span className="nebo-compat-person-avatar">{initial(profile.name)}</span><span><strong>{profile.name || (ru ? 'Ты' : 'You')}</strong><small>{[readableDate(profile.birthDate, language), profile.birthTimeMode === 'unknown' ? '' : profile.birthTime, profile.birthPlace].filter(Boolean).join(', ')}</small></span></section>
          {charts.length ? <details className="nebo-compat-saved"><summary>{ru ? 'Выбрать из сохранённых' : 'Choose a saved person'}</summary>{charts.map((chart) => <PersonRow key={chart.id} name={chart.name} detail={[readableDate(chart.birth_date, language), chart.birth_place, chart.access_locked ? 'Premium' : ''].filter(Boolean).join(', ')} selected={chart.id === partnerChartId} onClick={() => chooseSaved(chart)}/>)}</details> : null}
          <div className="nebo-compat-fields"><label><span>{ru ? 'Имя' : 'Name'}</span><input name="partner-name" autoComplete="off" required maxLength={100} value={partnerName} onChange={(event) => { setPartnerName(event.target.value); setPartnerChartId(undefined); }} placeholder={ru ? 'Как зовут человека?' : 'Person name'}/></label><label><span>{ru ? 'Дата рождения' : 'Birth date'}</span><input name="partner-date" type="date" required max={new Date().toISOString().slice(0, 10)} value={partnerDate} onChange={(event) => { setPartnerDate(event.target.value); setPartnerChartId(undefined); }}/></label><div className="nebo-compat-two-fields"><label><span>{ru ? 'Время рождения' : 'Birth time'}</span><input name="partner-time" type="time" value={unknownTime ? '' : partnerTime} disabled={unknownTime} onChange={(event) => { setPartnerTime(event.target.value); setPartnerChartId(undefined); }}/></label><label><span>{ru ? 'Место рождения' : 'Birth place'}</span><input name="partner-place" maxLength={200} value={partnerPlace} onChange={(event) => { setPartnerPlace(event.target.value); setPartnerChartId(undefined); }} placeholder={ru ? 'Город' : 'City'}/></label></div><label className="nebo-compat-check"><input name="unknown-time" type="checkbox" checked={unknownTime} onChange={(event) => { setUnknownTime(event.target.checked); setPartnerChartId(undefined); }}/><span>{ru ? 'Не знаю точное время' : 'I do not know the exact time'}</span></label></div>
        </>}
        <h2>{ru ? 'Тип отношений' : 'Relationship'}</h2><div className="nebo-compat-relations">{RELATIONS.map((item) => <button type="button" key={item.value} aria-pressed={relation === item.value} onClick={() => setRelation(item.value)}>{item[language]}</button>)}</div>
        </fieldset>
        {error ? <p className="nebo-compat-error" role="alert">{error}</p> : null}
        <button type="submit" className="nebo-primary" disabled={loading}>{loading ? (ru ? 'Готовим разбор…' : 'Preparing reading…') : ru ? 'Сравнить' : 'Compare'} <Glyph name="next" size={18}/></button>
        <span className="sr-only" role="status">{loading ? (ru ? 'Сравнение загружается. Это может занять минуту.' : 'The comparison is loading. This may take a minute.') : ''}</span>
        </form>
        {mode === 'birth' && !premium ? <p className="nebo-compat-premium-note">{ru ? 'Сравнение по данным рождения открывается с Premium. Заполненные данные останутся на экране.' : 'Birth-data comparison requires Premium. Your entered details stay on screen.'}</p> : null}
      </div>
    </div>;
  }

  return <div className="nebo-screen nebo-compat-screen">
    <Header title={ru ? 'Совместимость' : 'Compatibility'} name={profile.name || ''} onPeople={onOpenCharts} onProfile={onOpenProfile || onOpenCharts}/>
    <div ref={scrollRef} className={`nebo-reader-scroll nebo-compat-home ${homeStyles.home}`}>
      <h1 className="sr-only" tabIndex={-1}>{ru ? 'Совместимость' : 'Compatibility'}</h1><p className={`nebo-muted ${homeStyles.intro}`}>{ru ? 'Как лучше понимать друг друга — в паре, семье, дружбе и работе.' : 'Understand each other better — as a couple, family, friends or colleagues.'}</p>
      <div className={homeStyles.hero} aria-hidden="true"><img src="/assets/nebo-refined/compatibility-v1/hero.webp" alt=""/></div>
      <div className={homeStyles.modes}>
        <button type="button" className={`${homeStyles.modeCard} ${homeStyles.signCard}`} onClick={() => startMode('sign')}><span className={homeStyles.cardCopy}><strong>{ru ? 'По знакам' : 'By signs'}</strong><small>{ru ? 'Что общего у ваших знаков' : 'What your signs have in common'}</small></span><span className={homeStyles.cardImage}><img src="/assets/nebo-refined/compatibility-v1/signs.webp" alt=""/></span></button>
        <button type="button" className={`${homeStyles.modeCard} ${homeStyles.birthCard}`} onClick={() => startMode('birth')}><span className={homeStyles.cardCopy}><strong>{ru ? 'По дате рождения' : 'By birth date'}</strong><small>{ru ? 'С учётом времени и места рождения' : 'Including birth time and place'}</small></span><span className={homeStyles.cardImage}><img src="/assets/nebo-refined/compatibility-v1/birth.webp" alt=""/></span></button>
      </div>
      {history.length ? <section className="nebo-compat-history"><h2>{ru ? 'Ваши сравнения' : 'Your comparisons'}</h2>{history.slice(0, 4).map((entry) => <button type="button" key={entry.id} onClick={() => reopenHistory(entry)}><span className="nebo-compat-pair-avatars"><i>{initial(profile.name)}</i><Art name="compatibility"/><i>{initial(entry.name)}</i></span><span><strong>{profile.name || (ru ? 'Ты' : 'You')} + {entry.name || (ru ? 'Человек' : 'Person')}</strong><small>{getRelationshipContextOption(entry.relationshipContext || 'relationship').label[language]} · {new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date(entry.ts))}</small></span><Glyph name="next" size={18}/></button>)}</section> : <button type="button" className="nebo-action-row" onClick={() => startMode('birth')}><Glyph name="plus"/><span><strong>{ru ? 'Новое сравнение' : 'New comparison'}</strong><small>{ru ? 'Добавить человека и проверить совместимость' : 'Add a person and compare'}</small></span><Glyph name="next" size={18}/></button>}
    </div>
  </div>;
}
