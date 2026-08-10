import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { NatalChartData, SynastryResult, UserProfile } from '../../types';
import type { SignCompatibilityResult } from '../../lib/synastry/signCompatibility';
import { getZodiacSign } from '../../constants';
import { hasActivePremium, hasNatalChart } from '../../lib/accessMatrix';
import { getCharts, type ChartListItem } from '../../services/storageService';
import { getSignCompatibility, calculateExtendedSynastry } from '../../services/astrologyService';
import { formatDisplayDate, toDateInputValue } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { getCompatScore, sunSignFromDate, DIMENSION_LABELS, type CompatResult, type CompatDimension } from '../../lib/synastry/compatScore';
import { ZodiacIcon } from '../../components/icons/ZodiacIcon';
import { ChevronRightIcon } from '../../components/icons/UiIcons';
import { FreshSignWheel, InfoNote } from '../../components/fresh-ui';
import { ZODIAC_KEYS } from '../../lib/zodiacKeys';
import { shareToTelegram } from '../../lib/botLink';
import { HoroscopeActivityBar } from '../../components/Horoscope/HoroscopeActivityBar';
import { loadCompatHistory, addCompatHistory, removeCompatHistory, buildCompatHistoryId, type CompatHistoryEntry } from '../../lib/compatHistory';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { buildLocalPersonSnapshot, type CompatGender } from '../../lib/synastry/localSignText';
import {
  RELATIONSHIP_CONTEXT_OPTIONS,
  getRelationshipContextLabel,
  getRelationshipContextOption,
  normalizeRelationshipContext,
  type RelationshipContext,
} from '../../lib/synastry/relationshipContext';
import { EditorialSticker } from '../../components/EditorialSticker';
import { selectSynastryEditorialSticker } from '../../lib/personalForecastVisuals';
import {
  EditorialProse,
  EditorialSectionHeading,
  EditorialSummary,
} from '../../components/EditorialReading';

type SynastryPrefill = {
  source: 'saved-chart' | 'manual';
  partnerChartId?: number;
  partnerName?: string;
  partnerDate?: string;
  partnerTime?: string;
  partnerPlace?: string;
} | null;

type UnionRoomProps = {
  profile: UserProfile;
  chartData?: NatalChartData | null;
  chartId?: number | null;
  requestPremium: () => void;
  initialPrefill?: SynastryPrefill;
  onOpenCharts?: () => void;
  onCreateNatalChart?: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
};

type Selected = {
  kind: 'sign' | 'person';
  relationshipContext: RelationshipContext;
  youSign: string;
  youGender: CompatGender;
  themGender: CompatGender;
  sign?: string;
  name?: string;
  date?: string;
  time?: string;
  place?: string;
  chartId?: number;
};

/* Переключатель пола М/Ж — две кнопки, без эмодзи. */
function GenderToggle({ value, onChange, ru, compact = false, labelledBy }: { value: CompatGender; onChange: (g: CompatGender) => void; ru: boolean; compact?: boolean; labelledBy?: string }) {
  return (
    <div
      className={`compat-gender${compact ? ' is-compact' : ''}`}
      role="group"
      aria-label={labelledBy ? undefined : (ru ? 'Пол' : 'Gender')}
      aria-labelledby={labelledBy}
    >
      <button type="button" className={`compat-gender-btn ${value === 'male' ? 'is-on' : ''}`} aria-pressed={value === 'male'} onClick={() => { lumiaSelectionHaptic(); onChange('male'); }}>
        {compact ? (ru ? 'М' : 'M') : (ru ? 'Мужчина' : 'Male')}
      </button>
      <button type="button" className={`compat-gender-btn ${value === 'female' ? 'is-on' : ''}`} aria-pressed={value === 'female'} onClick={() => { lumiaSelectionHaptic(); onChange('female'); }}>
        {compact ? (ru ? 'Ж' : 'F') : (ru ? 'Женщина' : 'Female')}
      </button>
    </div>
  );
}

function genderWord(g: CompatGender, ru: boolean): string {
  return ru ? (g === 'male' ? 'Мужчина' : 'Женщина') : (g === 'male' ? 'Male' : 'Female');
}

function RelationshipContextPicker({
  value,
  onChange,
  ru,
  compact = false,
}: {
  value: RelationshipContext;
  onChange: (value: RelationshipContext) => void;
  ru: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`compat-context-picker ${compact ? 'is-compact' : ''}`}>
      {!compact ? (
        <div className="compat-context-heading">
          <span>{ru ? 'Какие у вас отношения?' : 'What is the relationship?'}</span>
          <small>{ru ? 'Разбор будет говорить именно об этом' : 'The reading will stay in this context'}</small>
        </div>
      ) : null}
      <div className="compat-context-options" role="radiogroup" aria-label={ru ? 'Тип отношений' : 'Relationship type'}>
        {RELATIONSHIP_CONTEXT_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`compat-context-option ${active ? 'is-active' : ''}`}
              onClick={() => {
                lumiaSelectionHaptic();
                onChange(option.value);
              }}
            >
              <span>{ru ? option.label.ru : option.label.en}</span>
              {!compact ? <small>{ru ? option.hint.ru : option.hint.en}</small> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type CompatibilityVisualDynamic =
  | 'adaptation'
  | 'attention'
  | 'communication'
  | 'coordination'
  | 'curiosity'
  | 'light-tension'
  | 'mutual-response'
  | 'playfulness'
  | 'reconnection'
  | 'shared-moment'
  | 'shared-pace'
  | 'timing';

function visualDynamicsForCompatibility(
  score: CompatResult,
  context: RelationshipContext,
): CompatibilityVisualDynamic[] {
  const strongest: Record<CompatDimension, readonly CompatibilityVisualDynamic[]> = {
    love: ['attention', 'mutual-response', 'shared-pace'],
    relationship: ['communication', 'coordination', 'timing'],
    friendship: ['playfulness', 'curiosity', 'shared-moment'],
    work: ['coordination', 'communication', 'timing'],
  };
  const contextual: Record<RelationshipContext, readonly CompatibilityVisualDynamic[]> = {
    romance: ['mutual-response', 'attention', 'shared-moment'],
    friendship: ['playfulness', 'curiosity', 'reconnection'],
    family: ['attention', 'communication', 'adaptation'],
    work: ['coordination', 'timing', 'communication'],
  };
  const pressure: readonly CompatibilityVisualDynamic[] = score.overall < 58
    ? ['adaptation', 'light-tension', 'reconnection']
    : score.overall < 70
      ? ['adaptation', 'communication', 'timing']
      : ['shared-pace', 'mutual-response', 'coordination'];

  return [...new Set([
    ...strongest[score.strongest],
    ...contextual[context],
    ...pressure,
  ])];
}

function readingTitles(context: RelationshipContext, ru: boolean) {
  if (context === 'friendship') {
    return ru
      ? ['Почему вам легко быть своими', 'Где дружба начинает трещать', 'Как не копить недосказанное']
      : ['Why it feels easy to be yourselves', 'Where friendship starts to crack', 'How to avoid the unsaid'];
  }
  if (context === 'work') {
    return ru
      ? ['Где вы усиливаете друг друга', 'Что ломает совместную работу', 'Как договариваться без хаоса']
      : ['Where you improve each other', 'What breaks the work', 'How to agree without chaos'];
  }
  if (context === 'family') {
    return ru
      ? ['Что держит вашу связь', 'Где включаются старые роли', 'Как говорить без семейного багажа']
      : ['What holds the bond', 'Where old roles take over', 'How to speak without old baggage'];
  }
  return ru
    ? ['Почему вас тянет друг к другу', 'Что может быть непросто', 'Как лучше понимать друг друга']
    : ["Why you're drawn to each other", 'What can get tricky', 'How to understand each other'];
}

function deepReadingTitles(context: RelationshipContext, ru: boolean) {
  if (context === 'friendship') {
    return ru
      ? ['На чём держится дружба', 'Что вас объединяет', 'Где появляются трения', 'Как сохранить взаимность']
      : ['What holds the friendship', 'What unites you', 'Where friction starts', 'How to keep it mutual'];
  }
  if (context === 'work') {
    return ru
      ? ['Как вы работаете вместе', 'Где усиливаете результат', 'Что тормозит', 'Как сделать союз рабочим']
      : ['How you work together', 'Where you improve the result', 'What slows you down', 'How to make it work'];
  }
  if (context === 'family') {
    return ru
      ? ['Как устроена ваша связь', 'Что помогает быть ближе', 'Из-за чего спор повторяется', 'Что меняет семейный сценарий']
      : ['How the bond works', 'What helps you stay close', 'Why the argument repeats', 'What changes the family pattern'];
  }
  return ru
    ? ['Какая у вас связь', 'Что вас сближает', 'Из-за чего бывают трения', 'Что сделает вас крепче']
    : ['What your bond is like', 'What brings you closer', 'Where friction comes from', 'What makes you stronger'];
}

/* Один редакционный раздел без цветной карточки. */
function CompatBlock({ title, index, reduce, children }: {
  title: string; index: number; reduce: boolean | null; children?: string | null;
}) {
  if (!children) return null;
  return (
    <motion.section
      className="compat-read-block"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.05 * index, ease: [0.22, 1, 0.36, 1] }}
    >
      <EditorialSectionHeading title={title} className="compat-read-heading" />
      <EditorialProse text={children} className="compat-read-text" />
    </motion.section>
  );
}

export function UnionRoom(props: UnionRoomProps) {
  const { profile, chartData, chartId, requestPremium, initialPrefill, onCreateNatalChart } = props;
  const ru = profile.language !== 'en';
  const lang: 'ru' | 'en' = ru ? 'ru' : 'en';
  const reduce = useReducedMotion();

  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
  const premium = hasActivePremium(profile);
  const yourSun = useMemo(
    () => String(chartData?.sun?.sign || profile.selectedZodiacSign || sunSignFromDate(profile.birthDate) || 'aries').toLowerCase(),
    [chartData, profile.selectedZodiacSign, profile.birthDate],
  );

  // Пол по умолчанию: «ты» — из профиля (иначе М), партнёр — противоположный (как в трендовых приложениях).
  const initialYouGender: CompatGender = profile.gender === 'female' ? 'female' : 'male';
  const initialThemGender: CompatGender = initialYouGender === 'male' ? 'female' : 'male';

  const [screen, setScreen] = useState<'hub' | 'add' | 'result'>(initialPrefill ? 'result' : 'add');
  const [people, setPeople] = useState<ChartListItem[]>([]);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const [history, setHistory] = useState<CompatHistoryEntry[]>([]);
  const [pickSign, setPickSign] = useState<string>(() => ZODIAC_KEYS.find((s) => s.toLowerCase() !== yourSun) || ZODIAC_KEYS[0]);
  // «Твой» знак теперь можно менять (не жёстко из карты). По умолчанию — солнечный знак из карты.
  const [youSign, setYouSign] = useState<string>(yourSun);
  const [youGender, setYouGender] = useState<CompatGender>(initialYouGender);
  const [themGender, setThemGender] = useState<CompatGender>(initialThemGender);
  const [relationshipContext, setRelationshipContext] = useState<RelationshipContext>('romance');
  // Какую сторону сейчас крутит колесо знаков: «ты» или партнёр.
  const [activeSide, setActiveSide] = useState<'you' | 'them'>('them');
  const [selected, setSelected] = useState<Selected | null>(
    initialPrefill
      ? { kind: 'person', relationshipContext: 'romance', youSign: yourSun, youGender: initialYouGender, themGender: initialThemGender, name: initialPrefill.partnerName || '', date: toDateInputValue(initialPrefill.partnerDate || ''), time: initialPrefill.partnerTime, place: initialPrefill.partnerPlace, chartId: initialPrefill.partnerChartId }
      : null,
  );

  const [fName, setFName] = useState(initialPrefill?.partnerName || '');
  const [fDate, setFDate] = useState(() => toDateInputValue(initialPrefill?.partnerDate || ''));
  const [fTime, setFTime] = useState(initialPrefill?.partnerTime || '');
  const [fPlace, setFPlace] = useState(initialPrefill?.partnerPlace || '');
  const [fGender, setFGender] = useState<CompatGender>(initialThemGender);

  const [signText, setSignText] = useState<SignCompatibilityResult | null>(null);
  const [deep, setDeep] = useState<SynastryResult | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.id) return;
    setPeopleLoaded(false);
    void getCharts(profile.id)
      .then((d) => setPeople((d.charts || []).filter((chart) => (
        chart.subject_type === 'saved_person'
        && !chart.archived_at
        && !chart.access_locked
      ))))
      .catch(() => setPeople([]))
      .finally(() => setPeopleLoaded(true));
  }, [profile.id]);

  useEffect(() => {
    if (!peopleLoaded || selected?.kind !== 'person' || selected.chartId == null) return;
    if (people.some((chart) => chart.id === selected.chartId)) return;
    setSelected(null);
    setScreen('add');
  }, [peopleLoaded, people, selected]);

  // История — ТОЛЬКО по конкретным людям (имя+дата+разбор). Проверки по знакам не храним.
  useEffect(() => { setHistory(loadCompatHistory().filter((e) => e.kind === 'person')); }, []);

  // «Левая» сторона результата = выбранный «твой» знак/пол (а не жёстко из карты).
  const leftSun = selected?.youSign || yourSun;
  const leftGender = selected?.youGender ?? youGender;
  const rightGender = selected?.themGender ?? themGender;
  const theirSun = selected ? (selected.kind === 'sign' ? String(selected.sign).toLowerCase() : (sunSignFromDate(selected.date) || 'libra')) : 'libra';
  const score: CompatResult | null = selected ? getCompatScore(leftSun, theirSun, lang) : null;
  const theirName = selected ? (selected.kind === 'sign' ? getZodiacSign(lang, theirSun) : (selected.name || (ru ? 'Человек' : 'Person'))) : '';

  useEffect(() => {
    if (screen !== 'result' || !selected) return;
    setSignText(null); setDeep(null); setError(null);
    let alive = true;
    void getSignCompatibility(
      leftSun,
      theirSun,
      lang,
      leftGender,
      rightGender,
      selected.relationshipContext,
    )
      .then((r) => { if (alive) setSignText(r); })
      .catch(() => { /* optional */ });
    return () => { alive = false; };
  }, [screen, selected, leftSun, theirSun, lang, leftGender, rightGender]);

  const sunOf = (s: Selected) => (s.kind === 'sign' ? String(s.sign).toLowerCase() : (sunSignFromDate(s.date) || 'libra'));

  const openResult = (s: Selected) => {
    lumiaSelectionHaptic();
    setSelected(s);
    setScreen('result');
    const their = sunOf(s);
    // Сохраняем в историю только разбор конкретного человека — по знакам не пишем (он и так везде).
    if (s.kind === 'person') {
      const sc = getCompatScore(s.youSign, their, lang);
      setHistory(addCompatHistory({
        id: buildCompatHistoryId(s.kind, s.sign, s.name, s.date, s.relationshipContext),
        kind: s.kind, sign: s.sign, name: s.name, date: s.date, time: s.time, place: s.place, chartId: s.chartId,
        yourSun: s.youSign, theirSun: their, yourGender: s.youGender, theirGender: s.themGender,
        relationshipContext: s.relationshipContext, overall: sc.overall, ts: Date.now(),
      }));
    }
  };

  const openFromHistory = (e: CompatHistoryEntry) => {
    const yg: CompatGender = e.yourGender === 'female' ? 'female' : 'male';
    const tg: CompatGender = e.theirGender === 'male' ? 'male' : 'female';
    const context = normalizeRelationshipContext(e.relationshipContext);
    setRelationshipContext(context);
    const base = { relationshipContext: context, youSign: e.yourSun || yourSun, youGender: yg, themGender: tg };
    if (e.kind === 'sign') openResult({ kind: 'sign', sign: e.sign, ...base });
    else openResult({ kind: 'person', name: e.name, date: e.date, time: e.time, place: e.place, chartId: e.chartId, ...base });
  };

  const deleteHistory = (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    lumiaSelectionHaptic();
    setHistory(removeCompatHistory(id));
  };

  const shareCompat = () => {
    if (!score || !selected) return;
    const strong = DIMENSION_LABELS[score.strongest][lang];
    const them = selected.kind === 'sign' ? getZodiacSign(lang, theirSun) : (selected.name || '');
    const text = ru
      ? `Совместимость с ${them}: ${score.overall}/100 — ${score.verdict}. Сильнее всего — ${strong}.\n\nПроверь свою совместимость в «Твой Гороскоп».`
      : `Compatibility with ${them}: ${score.overall}/100 — ${score.verdict}. Strongest — ${strong}.\n\nCheck yours in Your Horoscope.`;
    shareToTelegram(text);
  };

  const submitAdd = () => {
    if (!fName.trim() || !fDate) { setError(ru ? 'Добавь имя и дату рождения.' : 'Add a name and birth date.'); return; }
    setError(null);
    openResult({ kind: 'person', relationshipContext, name: fName.trim(), date: fDate, time: fTime || undefined, place: fPlace || undefined, youSign: yourSun, youGender, themGender: fGender });
  };

  const runDeep = async () => {
    if (!selected || selected.kind !== 'person' || !score) return;
    if (!hasChart) { onCreateNatalChart?.(); return; }
    if (!premium) { requestPremium(); return; }
    if (
      selected.chartId != null
      && (!peopleLoaded || !people.some((chart) => chart.id === selected.chartId))
    ) {
      setSelected(null);
      setScreen('add');
      return;
    }
    setDeepLoading(true); setError(null);
    try {
      const context = getRelationshipContextOption(selected.relationshipContext);
      const out = await calculateExtendedSynastry(
        profile,
        selected.name || '',
        selected.date || '',
        selected.time,
        selected.place,
        context.backendValue,
        selected.chartId,
      );
      setDeep(out.result);
    } catch (e: any) {
      setError(e?.message || (ru ? 'Не удалось собрать полный разбор.' : 'Could not build the full reading.'));
    } finally {
      setDeepLoading(false);
    }
  };

  /* ── ХАБ ── */
  if (screen === 'hub') {
    return (
      <div className="fresh-page compat-hub-page compat-editorial-page compat-editorial-page--hub">
        <AppTopBar title={ru ? 'Твой гороскоп' : 'Your Horoscope'} />
        <header className="compat-page-heading">
          <h1>{ru ? 'Совместимость' : 'Compatibility'}</h1>
          <p>{ru ? 'Сравни по знакам или разбери конкретного человека по данным рождения.' : 'Compare signs or read a specific person from birth data.'}</p>
        </header>
        <div className="compat-info-wrap">
          <InfoNote title={ru ? 'Как считается совместимость?' : 'How is compatibility calculated?'}>
            {ru
              ? 'Быстрая проверка — по знакам Солнца обоих: это общий фон характеров. Точный разбор строится по двум натальным картам, когда добавляешь дату (а лучше время и место) рождения человека.'
              : 'The quick check uses both Sun signs — a general background of temperaments. A precise reading is built from two natal charts once you add the person’s birth date (ideally time and place too).'}
          </InfoNote>
        </div>

        <RelationshipContextPicker
          value={relationshipContext}
          onChange={setRelationshipContext}
          ru={ru}
        />

        {/* Быстро по знакам — обе стороны выбираемы, с полом */}
        <div className="compat-quick">
          <div className="compat-quick-head">{ru ? 'По знакам · быстро' : 'By signs · quick'}</div>
          <div className="compat-pair">
            <div className={`compat-pick ${activeSide === 'you' ? 'is-active' : ''}`}>
              <button type="button" className="compat-chip" onClick={() => { lumiaSelectionHaptic(); setActiveSide('you'); }}>
                <ZodiacIcon sign={youSign} size={18} /> {ru ? 'Ты' : 'You'} · {getZodiacSign(lang, youSign)}
              </button>
              <GenderToggle value={youGender} onChange={setYouGender} ru={ru} compact />
            </div>
            <span className="compat-x">×</span>
            <div className={`compat-pick ${activeSide === 'them' ? 'is-active' : ''}`}>
              <button type="button" className="compat-chip compat-chip--them" onClick={() => { lumiaSelectionHaptic(); setActiveSide('them'); }}>
                <ZodiacIcon sign={pickSign} size={18} /> {getZodiacSign(lang, pickSign)}
              </button>
              <GenderToggle value={themGender} onChange={setThemGender} ru={ru} compact />
            </div>
          </div>
          <div className="compat-pick-hint">
            {activeSide === 'you' ? (ru ? 'Меняешь свой знак' : 'Choosing your sign') : (ru ? 'Меняешь знак партнёра' : 'Choosing their sign')}
          </div>
          <FreshSignWheel
            signs={ZODIAC_KEYS}
            active={activeSide === 'you' ? youSign : pickSign}
            language={profile.language}
            onPick={(s) => { lumiaSelectionHaptic(); if (activeSide === 'you') setYouSign(s); else setPickSign(s); }}
          />
          <button type="button" className="fresh-btn-primary compat-check-btn" onClick={() => openResult({ kind: 'sign', relationshipContext, sign: pickSign, youSign, youGender, themGender })}>
            {ru ? 'Проверить' : 'Check'}
          </button>
        </div>

        {/* Конкретный человек */}
        <button type="button" className="compat-person" onClick={() => { lumiaSelectionHaptic(); setError(null); setScreen('add'); }}>
          <div className="compat-person-text">
            <div className="compat-person-title">{ru ? 'Конкретный человек' : 'A specific person'}</div>
            <div className="compat-person-sub">{ru ? 'По дате рождения — точнее, и глубокий разбор по картам' : 'By birth date — more precise, with a full chart reading'}</div>
          </div>
          <span className="compat-person-cta"><span className="compat-person-plus">+</span></span>
        </button>

        {history.length ? (
          <>
            <div className="union-rel-label" style={{ paddingTop: 4 }}>{ru ? 'История проверок' : 'Recent checks'}</div>
            <div className="compat-hist">
              {history.map((e) => (
                <div key={e.id} className="compat-hist-row" role="button" tabIndex={0} onClick={() => openFromHistory(e)} onKeyDown={(ev) => { if (ev.key === 'Enter') openFromHistory(e); }}>
                  <span className="compat-hist-ico"><ZodiacIcon sign={e.theirSun} size={20} strokeWidth={1.5} /></span>
                  <span className="compat-hist-main">
                    <span className="compat-hist-name">{e.kind === 'sign' ? getZodiacSign(lang, e.theirSun) : (e.name || (ru ? 'Человек' : 'Person'))}</span>
                    <span className="compat-hist-sub">
                      {e.kind === 'person'
                        ? `${getZodiacSign(lang, e.theirSun)} · ${getRelationshipContextLabel(normalizeRelationshipContext(e.relationshipContext), lang)}`
                        : (ru ? 'по знаку' : 'by sign')}
                    </span>
                  </span>
                  <span className="compat-hist-score">{e.overall}</span>
                  <button type="button" className="compat-hist-del" aria-label={ru ? 'Удалить' : 'Delete'} onClick={(ev) => deleteHistory(e.id, ev)}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {people.length ? (
          <>
            <div className="union-rel-label" style={{ paddingTop: 4 }}>{ru ? 'Сохранённые' : 'Saved'}</div>
            <div className="people-grid">
              {people.map((c) => {
                const s = getCompatScore(yourSun, sunSignFromDate(c.birth_date) || 'libra', lang);
                return (
                  <button key={c.id} type="button" className="people-card" onClick={() => openResult({ kind: 'person', relationshipContext, name: c.name, date: toDateInputValue(c.birth_date), time: c.birth_time || undefined, place: c.birth_place || undefined, chartId: c.id, youSign: yourSun, youGender, themGender })}>
                    <span className="people-card-score" style={{ color: 'var(--fresh-link)' }}>{s.overall}</span>
                    <span className="people-card-name">{c.name}</span>
                    <span className="people-card-sign">{getZodiacSign(lang, sunSignFromDate(c.birth_date) || '')}</span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}

        <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }} />
      </div>
    );
  }

  /* ── ДОБАВЛЕНИЕ ── */
  if (screen === 'add') {
    return (
      <div className="fresh-page compat-editorial-page compat-editorial-page--add">
        <AppTopBar title={ru ? 'Твой гороскоп' : 'Your Horoscope'} />

        <header className="compat-page-heading">
          <h1>{ru ? 'Совместимость' : 'Compatibility'}</h1>
          <p>{ru ? 'Введи данные для точного сравнения двух карт.' : 'Enter the details for a precise comparison of two charts.'}</p>
        </header>

        <form
          className="compat-entry-form"
          onSubmit={(event) => {
            event.preventDefault();
            submitAdd();
          }}
        >
          <fieldset className="compat-entry-person">
            <legend>{ru ? 'Человек 1' : 'Person 1'}</legend>
            <div className="compat-self-identity">
              <strong>{profile.name?.trim() || (ru ? 'Ты' : 'You')}</strong>
              <span>
                {profile.birthDate
                  ? formatDisplayDate(profile.birthDate, lang)
                  : (ru ? 'Дата рождения не указана' : 'Birth date is not set')}
              </span>
            </div>
            <div>
              <span id="compat-self-gender-label" className="fresh-field-label">{ru ? 'Пол' : 'Gender'}</span>
              <GenderToggle value={youGender} onChange={setYouGender} ru={ru} labelledBy="compat-self-gender-label" />
            </div>
          </fieldset>

          <fieldset className="compat-entry-person">
            <legend>{ru ? 'Человек 2' : 'Person 2'}</legend>
            <div className="union-form">
              <div>
                <label className="fresh-field-label" htmlFor="compat-person-name">{ru ? 'Имя' : 'Name'}</label>
                <input id="compat-person-name" className="fresh-input" value={fName} onChange={(event) => setFName(event.target.value)} placeholder={ru ? 'Например, Аня' : 'e.g. Alex'} autoComplete="name" />
              </div>
              <div>
                <label className="fresh-field-label" htmlFor="compat-person-birth-date">{ru ? 'Дата рождения' : 'Birth date'}</label>
                <input id="compat-person-birth-date" className="fresh-input" type="date" value={fDate} onChange={(event) => setFDate(event.target.value)} />
              </div>
              <div>
                <span id="compat-person-gender-label" className="fresh-field-label">{ru ? 'Пол' : 'Gender'}</span>
                <GenderToggle value={fGender} onChange={setFGender} ru={ru} labelledBy="compat-person-gender-label" />
              </div>
              <details className="compat-optional-details">
                <summary>{ru ? 'Добавить время и место' : 'Add time and place'}</summary>
                <div className="compat-optional-fields">
                  <div>
                    <label className="fresh-field-label" htmlFor="compat-person-time">{ru ? 'Время рождения' : 'Birth time'}</label>
                    <input id="compat-person-time" className="fresh-input" type="time" value={fTime} onChange={(event) => setFTime(event.target.value)} />
                  </div>
                  <div>
                    <label className="fresh-field-label" htmlFor="compat-person-place">{ru ? 'Место рождения' : 'Birth place'}</label>
                    <input id="compat-person-place" className="fresh-input" value={fPlace} onChange={(event) => setFPlace(event.target.value)} placeholder={ru ? 'Город' : 'City'} autoComplete="address-level2" />
                  </div>
                </div>
              </details>
            </div>
          </fieldset>

          <section className="compat-entry-context" aria-labelledby="compat-context-title">
            <h2 id="compat-context-title">{ru ? 'Тип совместимости' : 'Compatibility type'}</h2>
            <RelationshipContextPicker
              value={relationshipContext}
              onChange={setRelationshipContext}
              ru={ru}
              compact
            />
          </section>

          <p className="compat-entry-note">
            {ru
              ? 'Даты достаточно для базового сравнения. Время и место делают разбор точнее.'
              : 'Birth dates are enough for a basic comparison. Time and place make the reading more precise.'}
          </p>

          {error ? <p className="compat-entry-error" role="alert">{error}</p> : null}

          <button type="submit" className="fresh-btn-primary compat-entry-submit">
            {ru ? 'Рассчитать совместимость' : 'Calculate compatibility'}
          </button>
        </form>

        <button
          type="button"
          className="compat-alternate-mode"
          onClick={() => {
            lumiaSelectionHaptic();
            setError(null);
            setScreen('hub');
          }}
        >
          {ru ? 'Быстрое сравнение по знакам и сохранённые люди' : 'Quick sign comparison and saved people'}
        </button>
      </div>
    );
  }

  /* ── РЕЗУЛЬТАТ ── */
  const strongestLabel = score ? DIMENSION_LABELS[score.strongest][lang] : '';
  const dimsOrder: CompatDimension[] = ['love', 'relationship', 'friendship', 'work'];
  const isPerson = selected?.kind === 'person';
  const resultContext = selected?.relationshipContext || relationshipContext;
  const resultContextLabel = getRelationshipContextLabel(resultContext, lang);
  const resultTitles = readingTitles(resultContext, ru);
  const resultDeepTitles = deepReadingTitles(resultContext, ru);
  const resultVisualDynamics = score
    ? visualDynamicsForCompatibility(score, resultContext)
    : [];
  const resultSticker = selectSynastryEditorialSticker({
    screenKey: 'compatibility-result',
    contentKey: [
      selected?.kind || 'sign',
      selected?.chartId || 'none',
      leftSun,
      theirSun,
      resultContext,
    ].join('|'),
    context: resultContext === 'romance' ? 'love' : resultContext,
    dynamics: resultVisualDynamics,
  });
  const personSnapshot = isPerson
    ? buildLocalPersonSnapshot(theirSun, lang, resultContext, rightGender)
    : null;
  const leftDetail = profile.birthDate
    ? `${genderWord(leftGender, ru)} — ${formatDisplayDate(profile.birthDate, lang)}`
    : `${genderWord(leftGender, ru)} · ${getZodiacSign(lang, leftSun)}`;
  const rightDetail = selected?.date
    ? `${genderWord(rightGender, ru)} — ${formatDisplayDate(selected.date, lang)}`
    : `${genderWord(rightGender, ru)} · ${getZodiacSign(lang, theirSun)}`;
  const signReadingBlocks = signText
    ? [
        { title: resultTitles[0], text: String(signText.attraction || '') },
        { title: resultTitles[1], text: String(signText.difficulty || '') },
        { title: resultTitles[2], text: String(signText.communication || '') },
      ].filter((block) => block.text.trim().length > 0)
    : [];

  return (
    <div className="fresh-page compat-editorial-page compat-editorial-page--result" aria-busy={!signText && !error}>
      <AppTopBar
        title={ru ? 'Твой гороскоп' : 'Your Horoscope'}
        onBack={() => {
          lumiaSelectionHaptic();
          setScreen(selected?.kind === 'sign' ? 'hub' : 'add');
        }}
      />

      <header className="compat-result-heading">
        <h1>{ru ? 'Совместимость' : 'Compatibility'}</h1>
        <div className="compat-result-people">
          <span><strong>{ru ? 'Ты' : 'You'}</strong><small>{leftDetail}</small></span>
          <span><strong>{theirName}</strong><small>{rightDetail}</small></span>
        </div>
      </header>

      <div className="compat-result-context">
        {ru ? 'Смотрим' : 'Context'} · <strong>{resultContextLabel}</strong>
      </div>

      {score ? (
        <section className="compat-main-conclusion">
          <h2>{score.verdict}</h2>
          <p><strong>{ru ? 'Сильнее всего:' : 'Strongest:'}</strong> {strongestLabel}</p>
        </section>
      ) : null}

      {personSnapshot ? (
        <section className="compat-person-snapshot">
          <div className="compat-person-snapshot-kicker">
            {ru ? 'Сначала — кто перед тобой' : 'First — who this person is'}
          </div>
          <h2>{personSnapshot.headline}</h2>
          <p>{personSnapshot.body}</p>
          <p className="compat-person-snapshot-context">{personSnapshot.contextLine}</p>
          <small>{personSnapshot.limitation}</small>
        </section>
      ) : null}

      {signReadingBlocks.length ? (
        <div className="compat-read">
          {signReadingBlocks.map((block, index) => (
            <React.Fragment key={`${block.title}-${index}`}>
              <CompatBlock title={block.title} index={index} reduce={reduce}>{block.text}</CompatBlock>
              {index === 0 && resultSticker ? (
                <EditorialSticker
                  asset={resultSticker}
                  className="compat-result-sticker"
                  priority
                />
              ) : null}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <p className="union-pad" role="status" aria-live="polite" style={{ marginTop: 12, color: 'var(--fresh-muted)', fontSize: 14 }}>{ru ? 'Готовим разбор…' : 'Preparing…'}</p>
      )}

      {deep ? (
        <div className="compat-read" style={{ marginTop: 18 }}>
          <CompatBlock title={resultDeepTitles[1]} index={0} reduce={reduce}>{deep.fullAnalysis?.attraction}</CompatBlock>
          <CompatBlock title={resultDeepTitles[2]} index={1} reduce={reduce}>{deep.fullAnalysis?.difficulties}</CompatBlock>
          <CompatBlock title={resultDeepTitles[3]} index={2} reduce={reduce}>{deep.fullAnalysis?.potential}</CompatBlock>
          <EditorialSummary label={ru ? 'Итог' : 'Bottom line'} title={resultDeepTitles[0]} className="compat-final-summary">
            <EditorialProse text={deep.summary} />
          </EditorialSummary>
        </div>
      ) : isPerson ? (
        <button type="button" className="horo-premium" style={{ marginTop: 16 }} onClick={() => void runDeep()}>
          <div className="horo-premium-text">
            <div className="horo-premium-kicker">{ru ? `Полный разбор · ${strongestLabel}` : `Full reading · ${strongestLabel}`}</div>
            <div className="horo-premium-title">
              {deepLoading ? (ru ? 'Собираю по картам…' : 'Building from charts…') : !hasChart ? (ru ? 'Нужна твоя карта' : 'Your chart needed') : !premium ? (ru ? 'Глубокий разбор по двум картам — в Premium' : 'Deep two-chart reading — Premium') : (ru ? 'Разбор по двум картам' : 'Read both charts')}
            </div>
          </div>
          <span className="horo-premium-cta">{!hasChart ? (ru ? 'Создать' : 'Create') : !premium ? 'Premium' : (ru ? 'Открыть' : 'Open')}<ChevronRightIcon size={15} /></span>
        </button>
      ) : (
        <button type="button" className="horo-premium" style={{ marginTop: 16 }} onClick={() => { lumiaSelectionHaptic(); setScreen('add'); }}>
          <div className="horo-premium-text">
            <div className="horo-premium-kicker">{ru ? 'Хочешь подробнее?' : 'Want more?'}</div>
            <div className="horo-premium-title">{ru ? 'Добавь дату рождения — разбор по картам' : 'Add a birth date — full chart reading'}</div>
          </div>
          <span className="horo-premium-cta">{ru ? 'Добавить' : 'Add'}<ChevronRightIcon size={15} /></span>
        </button>
      )}

      {score ? (
        <details className="compat-technical-data">
          <summary>
            <span>{ru ? 'Расчёт совместимости' : 'Compatibility calculation'}</span>
            <strong>{score.overall}%</strong>
          </summary>
          <div className="compat-score-list" aria-label={ru ? 'Оценки по сферам' : 'Scores by area'}>
            {dimsOrder.map((key) => (
              <div key={key} className={key === score.strongest ? 'is-strongest' : ''}>
                <span>{DIMENSION_LABELS[key][lang]}</span>
                <strong>{score.dims[key]}%</strong>
              </div>
            ))}
          </div>
        </details>
      ) : null}

      {error ? <p className="union-pad" role="alert" style={{ color: '#B91C1C', fontSize: 14, marginTop: 12 }}>{error}</p> : null}

      <div className="union-pad" style={{ marginTop: 6 }}>
        <HoroscopeActivityBar
          userId={profile.id ? String(profile.id) : undefined}
          sign={`${leftSun}_${theirSun}`}
          date="2000-01-01"
          language={lang}
          onShare={shareCompat}
        />
      </div>

      <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }} />
    </div>
  );
}
