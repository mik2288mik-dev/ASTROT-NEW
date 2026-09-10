import React, { useEffect, useState } from 'react';
import type { NatalChartData, SynastryResult, UserProfile } from '../../types';
import type { SignCompatibilityResult } from '../../lib/synastry/signCompatibility';
import type { PaywallContext } from '../../lib/paywallContext';
import { getZodiacSign } from '../../constants';
import { hasActivePremium } from '../../lib/accessMatrix';
import { getCharts, type ChartListItem } from '../../services/storageService';
import { calculateExtendedSynastry, getSignCompatibility } from '../../services/astrologyService';
import { toDateInputValue } from '../../lib/date-utils';
import { sunSignFromDate } from '../../lib/synastry/compatScore';
import {
  getRelationshipContextOption,
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

function readableDate(value?: string | null) {
  if (!value) return '';
  const normalized = toDateInputValue(value);
  if (!normalized) return value;
  const parsed = new Date(`${normalized}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parsed).replace(' г.', '');
}

function deepSections(result: SynastryResult, ru: boolean): ResultSection[] {
  const tones: ResultSection['tone'][] = ['blue', 'pink', 'peach', 'lilac', 'lime'];
  const arts: ArtName[] = ['support', 'compatibility', 'today', 'security', 'saved-cards'];
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
  const candidates: Array<[string, string, string, ResultSection['tone'], ArtName]> = [
    [ru ? 'Общение' : 'Communication', ru ? 'Как вы разговариваете и слышите друг друга' : 'How you talk and understand each other', result.intellectualConnection || result.briefOverview?.introduction || result.summary, 'blue', 'support'],
    [ru ? 'Притяжение' : 'Attraction', ru ? 'Что тянет друг к другу' : 'What draws you together', result.fullAnalysis?.attraction || result.emotionalConnection || result.briefOverview?.harmony || result.summary, 'pink', 'compatibility'],
    [ru ? 'Разногласия' : 'Friction', ru ? 'Где вы можете цепляться' : 'Where you may clash', result.fullAnalysis?.difficulties || result.challenge || result.briefOverview?.challenges || result.summary, 'peach', 'today'],
    [ru ? 'Доверие' : 'Trust', ru ? 'Насколько легко положиться друг на друга' : 'How easy it is to rely on each other', result.fullAnalysis?.potential || result.closing?.strength || result.summary, 'lilac', 'security'],
    [ru ? 'Быт' : 'Everyday life', ru ? 'Как связь выглядит в обычной жизни' : 'How the bond feels day to day', result.fullAnalysis?.recommendations?.join(' ') || result.closing?.action || result.summary, 'lime', 'saved-cards'],
  ];
  return candidates.filter((item) => item[2]?.trim()).map((item, index) => ({
    id: `fallback-${index}`,
    title: item[0], subtitle: item[1], text: item[2], tone: item[3], art: item[4],
  }));
}

function signSections(result: SignCompatibilityResult, ru: boolean): ResultSection[] {
  return [
    { id: 'communication', title: ru ? 'Общение' : 'Communication', subtitle: ru ? 'Как вам легче понимать друг друга' : 'How you understand each other', text: result.communication, tone: 'blue', art: 'support' },
    { id: 'attraction', title: ru ? 'Притяжение' : 'Attraction', subtitle: ru ? 'Что может цеплять в этой паре' : 'What may draw you together', text: result.attraction, tone: 'pink', art: 'compatibility' },
    { id: 'difficulty', title: ru ? 'Разногласия' : 'Friction', subtitle: ru ? 'Где чаще всего начинаются споры' : 'Where friction may start', text: result.difficulty, tone: 'peach', art: 'today' },
  ];
}

function PersonRow({ name, detail, selected, onClick }: { name: string; detail: string; selected?: boolean; onClick: () => void }) {
  return <button type="button" className={`nebo-compat-person-row${selected ? ' is-selected' : ''}`} onClick={onClick}>
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
}: Props) {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const ru = language === 'ru';
  const premium = hasActivePremium(profile);
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

  useEffect(() => {
    setHistory(loadCompatHistory(profile.id).filter((entry) => entry.kind === 'person'));
    if (!profile.id) return;
    let alive = true;
    void getCharts(profile.id).then((response) => {
      if (!alive) return;
      setCharts((response.charts || []).filter((chart) => !chart.archived_at && chart.subject_type === 'saved_person'));
    }).catch(() => { if (alive) setCharts([]); });
    return () => { alive = false; };
  }, [profile.id]);

  useEffect(() => {
    if (!initialPrefill) return;
    setMode('birth'); setScreen('create');
    setPartnerName(initialPrefill.partnerName || '');
    setPartnerDate(toDateInputValue(initialPrefill.partnerDate || ''));
    setPartnerTime(initialPrefill.partnerTime || '');
    setPartnerPlace(initialPrefill.partnerPlace || '');
    setPartnerChartId(initialPrefill.partnerChartId);
    setUnknownTime(!initialPrefill.partnerTime);
  }, [initialPrefill]);

  const relationOption = getRelationshipContextOption(relation);

  const chooseSaved = (chart: ChartListItem) => {
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
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  };

  const runSign = async () => {
    setLoading(true); setError(null); setDeepResult(null);
    try {
      const result = await getSignCompatibility(signA, signB, language, 'unspecified', 'unspecified', relation);
      setSignResult(result);
      openResult(signSections(result, ru));
    } catch {
      setError(ru ? 'Не удалось загрузить сравнение. Попробуй ещё раз.' : 'Could not load the comparison. Try again.');
    } finally { setLoading(false); }
  };

  const runBirth = async () => {
    if (!profile.birthDate) { onCreateNatalChart?.(); return; }
    if (!partnerName.trim() || !partnerDate) {
      setError(ru ? 'Добавь имя и дату рождения второго человека.' : 'Add the second person’s name and birth date.');
      return;
    }
    if (!premium) {
      await requestPremium('synastry', {
        placement: 'synastry', featureKey: 'synastry_full', triggerType: 'locked_feature', returnView: 'synastry',
      });
      return;
    }
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
          gender: 'unspecified',
          birthTimeQuality: profile.birthTimeMode === 'approximate' ? 'approximate' : profile.birthTime ? 'exact' : 'unknown',
        },
        {
          source: partnerChartId ? 'saved' : 'birth',
          sign: normalizeZodiacKey(String(sunSignFromDate(partnerDate) || '')) || undefined,
          gender: 'unspecified',
          birthTimeQuality: unknownTime ? 'unknown' : 'exact',
        },
        relation,
      );
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
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : (ru ? 'Не удалось собрать разбор.' : 'Could not create the reading.'));
    } finally { setLoading(false); }
  };

  const startMode = (next: Mode) => {
    setMode(next); setError(null); setScreen('create');
  };

  const reopenHistory = (entry: CompatHistoryEntry) => {
    setMode('birth'); setRelation(entry.relationshipContext || 'relationship');
    setPartnerName(entry.name || ''); setPartnerDate(toDateInputValue(entry.date || ''));
    setPartnerTime(entry.time || ''); setUnknownTime(!entry.time); setPartnerPlace(entry.place || ''); setPartnerChartId(entry.chartId);
    setScreen('create');
  };

  if (screen === 'detail' && sections[activeSection]) {
    const section = sections[activeSection];
    return <div className="nebo-screen nebo-compat-screen">
      <Header title={section.title} name={profile.name || ''} onBack={() => setScreen('result')} onProfile={onOpenCharts}/>
      <div className="nebo-reader-scroll nebo-compat-detail">
        <div className={`nebo-compat-detail-hero nebo-tone-${section.tone}`}><Art name={section.art}/><span><h1>{section.title}</h1><p>{section.subtitle}</p></span></div>
        {section.text.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={`${section.id}-${index}`}>{paragraph}</p>)}
        {activeSection + 1 < sections.length ? <button type="button" className="nebo-primary" onClick={() => { setActiveSection(activeSection + 1); window.scrollTo({ top: 0 }); }}>{ru ? `Следующий раздел: ${sections[activeSection + 1].title}` : `Next: ${sections[activeSection + 1].title}`} <Glyph name="next" size={18}/></button> : null}
      </div>
    </div>;
  }

  if (screen === 'result') {
    const signMode = mode === 'sign';
    const left = signMode ? getZodiacSign(language, signA) : (profile.name || (ru ? 'Ты' : 'You'));
    const right = signMode ? getZodiacSign(language, signB) : partnerName;
    const summary = deepResult?.verdict || deepResult?.summary || signResult?.attraction || '';
    return <div className="nebo-screen nebo-compat-screen">
      <Header title={ru ? 'Совместимость' : 'Compatibility'} name={profile.name || ''} onBack={() => setScreen('create')} onProfile={onOpenCharts}/>
      <div className="nebo-reader-scroll nebo-compat-result">
        <h1>{left} + {right}</h1><p className="nebo-muted">{RELATIONS.find((item) => item.value === relation)?.[language] || relationOption.label[language]}</p>
        <section className="nebo-compat-result-hero"><div><strong>{ru ? 'Что между вами' : 'What this connection feels like'}</strong><p>{summary}</p></div><Art name="compatibility"/></section>
        <h2>{ru ? 'Разделы разбора' : 'Reading sections'}</h2>
        <div className="nebo-compat-result-list">{sections.map((section, index) => <button type="button" key={section.id} className={`nebo-compat-result-row nebo-tone-${section.tone}`} onClick={() => { setActiveSection(index); setScreen('detail'); }}><Art name={section.art}/><span><strong>{section.title}</strong><small>{section.subtitle}</small></span><Glyph name="next" size={18}/></button>)}</div>
      </div>
    </div>;
  }

  if (screen === 'create') {
    return <div className="nebo-screen nebo-compat-screen">
      <Header title={ru ? 'Совместимость' : 'Compatibility'} name={profile.name || ''} onBack={() => setScreen('home')} onProfile={onOpenCharts}/>
      <div className="nebo-reader-scroll nebo-compat-create">
        <h1>{ru ? 'Кого сравниваем?' : 'Who are we comparing?'}</h1>
        <p className="nebo-muted">{ru ? 'Выбери способ и добавь второго человека.' : 'Choose a method and add the second person.'}</p>
        <div className="nebo-compat-mode-tabs" role="tablist"><button type="button" aria-selected={mode === 'sign'} onClick={() => setMode('sign')}>{ru ? 'По знакам' : 'By signs'}</button><button type="button" aria-selected={mode === 'birth'} onClick={() => setMode('birth')}>{ru ? 'По данным рождения' : 'By birth data'}</button></div>
        {mode === 'sign' ? <>
          <div className="nebo-compat-sign-pair"><label><span>{ru ? 'Первый знак' : 'First sign'}</span><select value={signA} onChange={(event) => setSignA(event.target.value as ZodiacKey)}>{ZODIAC_KEYS.map((key) => <option key={key} value={key}>{getZodiacSign(language, key)}</option>)}</select></label><span className="nebo-compat-link-art"><Art name="compatibility"/></span><label><span>{ru ? 'Второй знак' : 'Second sign'}</span><select value={signB} onChange={(event) => setSignB(event.target.value as ZodiacKey)}>{ZODIAC_KEYS.map((key) => <option key={key} value={key}>{getZodiacSign(language, key)}</option>)}</select></label></div>
        </> : <>
          <section className="nebo-compat-self-card"><span className="nebo-compat-person-avatar">{initial(profile.name)}</span><span><strong>{profile.name || (ru ? 'Ты' : 'You')}</strong><small>{[readableDate(profile.birthDate), profile.birthTime, profile.birthPlace].filter(Boolean).join(', ')}</small></span></section>
          {charts.length ? <div className="nebo-compat-saved"><h2>{ru ? 'Сохранённые люди' : 'Saved people'}</h2>{charts.slice(0, 4).map((chart) => <PersonRow key={chart.id} name={chart.name} detail={[readableDate(chart.birth_date), chart.birth_place].filter(Boolean).join(', ')} selected={chart.id === partnerChartId} onClick={() => chooseSaved(chart)}/>)}</div> : null}
          <div className="nebo-compat-fields"><label><span>{ru ? 'Имя' : 'Name'}</span><input value={partnerName} onChange={(event) => { setPartnerName(event.target.value); setPartnerChartId(undefined); }} placeholder={ru ? 'Как зовут человека?' : 'Person name'}/></label><label><span>{ru ? 'Дата рождения' : 'Birth date'}</span><input type="date" value={partnerDate} onChange={(event) => { setPartnerDate(event.target.value); setPartnerChartId(undefined); }}/></label><div className="nebo-compat-two-fields"><label><span>{ru ? 'Время рождения' : 'Birth time'}</span><input type="time" value={unknownTime ? '' : partnerTime} disabled={unknownTime} onChange={(event) => setPartnerTime(event.target.value)}/></label><label><span>{ru ? 'Место рождения' : 'Birth place'}</span><input value={partnerPlace} onChange={(event) => setPartnerPlace(event.target.value)} placeholder={ru ? 'Город' : 'City'}/></label></div><label className="nebo-compat-check"><input type="checkbox" checked={unknownTime} onChange={(event) => setUnknownTime(event.target.checked)}/><span>{ru ? 'Не знаю точное время' : 'I do not know the exact time'}</span></label></div>
        </>}
        <h2>{ru ? 'Тип отношений' : 'Relationship'}</h2><div className="nebo-compat-relations">{RELATIONS.map((item) => <button type="button" key={item.value} aria-pressed={relation === item.value} onClick={() => setRelation(item.value)}>{item[language]}</button>)}</div>
        {error ? <p className="nebo-compat-error" role="alert">{error}</p> : null}
        <button type="button" className="nebo-primary" disabled={loading} onClick={() => { void (mode === 'sign' ? runSign() : runBirth()); }}>{loading ? (ru ? 'Собираем…' : 'Loading…') : ru ? 'Сравнить' : 'Compare'} <Glyph name="next" size={18}/></button>
        {mode === 'birth' && !premium ? <p className="nebo-compat-premium-note">{ru ? 'Сравнение по данным рождения открывается с Premium. Заполненные данные останутся на экране.' : 'Birth-data comparison requires Premium. Your entered details stay on screen.'}</p> : null}
      </div>
    </div>;
  }

  return <div className="nebo-screen nebo-compat-screen">
    <Header name={profile.name || ''} onProfile={onOpenCharts}/>
    <div className="nebo-reader-scroll nebo-compat-home">
      <h1>{ru ? 'Совместимость' : 'Compatibility'}</h1><p className="nebo-muted">{ru ? 'Посмотри, как вы сочетаетесь — по знакам или по данным рождения.' : 'Compare two people by signs or birth data.'}</p>
      <div className="nebo-compat-home-art"><Art name="compatibility"/></div>
      <div className="nebo-compat-home-modes"><button type="button" className="nebo-tone-peach" onClick={() => startMode('sign')}><strong>{ru ? 'По знакам' : 'By signs'}</strong><small>{ru ? 'Быстрое сравнение двух знаков' : 'Quick sign comparison'}</small><Art name="zodiac"/></button><button type="button" className="nebo-tone-lilac" onClick={() => startMode('birth')}><strong>{ru ? 'По данным рождения' : 'By birth data'}</strong><small>{ru ? 'Подробный разбор двух людей' : 'Detailed comparison'}</small><Art name="natal-chart"/></button></div>
      {history.length ? <section className="nebo-compat-history"><h2>{ru ? 'Ваши сравнения' : 'Your comparisons'}</h2>{history.slice(0, 4).map((entry) => <button type="button" key={entry.id} onClick={() => reopenHistory(entry)}><span className="nebo-compat-pair-avatars"><i>{initial(profile.name)}</i><Art name="compatibility"/><i>{initial(entry.name)}</i></span><span><strong>{profile.name || (ru ? 'Ты' : 'You')} + {entry.name || (ru ? 'Человек' : 'Person')}</strong><small>{getRelationshipContextOption(entry.relationshipContext || 'relationship').label[language]} · {new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { day:'2-digit', month:'2-digit', year:'numeric' }).format(new Date(entry.ts))}</small></span><Glyph name="next" size={18}/></button>)}</section> : <button type="button" className="nebo-action-row" onClick={() => startMode('birth')}><Glyph name="plus"/><span><strong>{ru ? 'Новое сравнение' : 'New comparison'}</strong><small>{ru ? 'Добавить человека и проверить совместимость' : 'Add a person and compare'}</small></span><Glyph name="next" size={18}/></button>}
    </div>
  </div>;
}
