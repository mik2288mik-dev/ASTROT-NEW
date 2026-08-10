import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { NatalChartData, SynastryResult, UserProfile } from '../../types';
import type { SignCompatibilityResult } from '../../lib/synastry/signCompatibility';
import { getZodiacSign } from '../../constants';
import { hasActivePremium } from '../../lib/accessMatrix';
import { getCharts, type ChartListItem } from '../../services/storageService';
import { getSignCompatibility, calculateExtendedSynastry } from '../../services/astrologyService';
import { formatDisplayDate, toDateInputValue } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { getCompatScore, sunSignFromDate, DIMENSION_LABELS, type CompatResult, type CompatDimension } from '../../lib/synastry/compatScore';
import { ZodiacIcon } from '../../components/icons/ZodiacIcon';
import { ZodiacSymbol } from '../../components/icons/ZodiacArt';
import { ChevronRightIcon } from '../../components/icons/UiIcons';
import { ZODIAC_KEYS } from '../../lib/zodiacKeys';
import { shareToTelegram } from '../../lib/botLink';
import { HoroscopeActivityBar } from '../../components/Horoscope/HoroscopeActivityBar';
import { loadCompatHistory, addCompatHistory, removeCompatHistory, clearCompatHistory, buildCompatHistoryId, type CompatHistoryEntry } from '../../lib/compatHistory';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import type { CompatGender } from '../../lib/synastry/localSignText';
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
  subjectChartId?: number;
  subjectName?: string;
  subjectDate?: string;
  subjectTime?: string;
  subjectPlace?: string;
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
      className={`compat-choice-tabs compat-gender${compact ? ' is-compact' : ''}`}
      role="group"
      aria-label={labelledBy ? undefined : (ru ? 'Пол' : 'Gender')}
      aria-labelledby={labelledBy}
    >
      <button type="button" className={`compat-choice-tab compat-gender-btn ${value === 'male' ? 'is-on is-active' : ''}`} aria-pressed={value === 'male'} onClick={() => { lumiaSelectionHaptic(); onChange('male'); }}>
        {compact ? (ru ? 'М' : 'M') : (ru ? 'Мужчина' : 'Male')}
      </button>
      <button type="button" className={`compat-choice-tab compat-gender-btn ${value === 'female' ? 'is-on is-active' : ''}`} aria-pressed={value === 'female'} onClick={() => { lumiaSelectionHaptic(); onChange('female'); }}>
        {compact ? (ru ? 'Ж' : 'F') : (ru ? 'Женщина' : 'Female')}
      </button>
    </div>
  );
}

function PersonBirthFields({
  prefix,
  ru,
  name,
  date,
  time,
  place,
  gender,
  unknownTime,
  onNameChange,
  onDateChange,
  onTimeChange,
  onPlaceChange,
  onGenderChange,
  onUnknownTimeChange,
}: {
  prefix: string;
  ru: boolean;
  name: string;
  date: string;
  time: string;
  place: string;
  gender: CompatGender;
  unknownTime: boolean;
  onNameChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onPlaceChange: (value: string) => void;
  onGenderChange: (value: CompatGender) => void;
  onUnknownTimeChange: (value: boolean) => void;
}) {
  const genderLabelId = `${prefix}-gender-label`;
  return (
    <div className="compat-air-fields">
      <label className="compat-air-field compat-air-field--name" htmlFor={`${prefix}-name`}>
        <span className="compat-air-label">{ru ? 'Имя' : 'Name'}</span>
        <input id={`${prefix}-name`} className="compat-air-input" value={name} onChange={(event) => onNameChange(event.target.value)} placeholder={ru ? 'Например, Анна' : 'e.g. Anna'} autoComplete="name" />
      </label>

      <div className="compat-air-birth-row">
        <label className="compat-air-field" htmlFor={`${prefix}-date`}>
          <span className="compat-air-label">{ru ? 'Дата рождения' : 'Birth date'}</span>
          <input id={`${prefix}-date`} className="compat-air-input" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
        </label>
        <label className={`compat-air-field${unknownTime ? ' is-disabled' : ''}`} htmlFor={`${prefix}-time`}>
          <span className="compat-air-label">{ru ? 'Время' : 'Time'}</span>
          <input id={`${prefix}-time`} className="compat-air-input" type="time" value={time} disabled={unknownTime} onChange={(event) => onTimeChange(event.target.value)} />
        </label>
      </div>

      <div className="compat-air-options-row">
        <div className="compat-air-gender-field">
          <span id={genderLabelId} className="compat-air-label">{ru ? 'Пол' : 'Gender'}</span>
          <GenderToggle value={gender} onChange={onGenderChange} ru={ru} labelledBy={genderLabelId} />
        </div>
        <label className="compat-air-unknown-time">
          <input
            type="checkbox"
            checked={unknownTime}
            onChange={(event) => onUnknownTimeChange(event.target.checked)}
          />
          <span>{ru ? 'Точное время неизвестно' : 'Exact time unknown'}</span>
        </label>
      </div>

      <label className="compat-air-field compat-air-field--place" htmlFor={`${prefix}-place`}>
        <span className="compat-air-label">{ru ? 'Место рождения' : 'Birth place'}</span>
        <input id={`${prefix}-place`} className="compat-air-input" value={place} onChange={(event) => onPlaceChange(event.target.value)} placeholder={ru ? 'Город' : 'City'} autoComplete="address-level2" />
      </label>
    </div>
  );
}

function genderWord(g: CompatGender, ru: boolean): string {
  return ru ? (g === 'male' ? 'Мужчина' : 'Женщина') : (g === 'male' ? 'Male' : 'Female');
}

function SignSwipePicker({
  label,
  signs,
  active,
  language,
  onPick,
}: {
  label: string;
  signs: readonly string[];
  active: string;
  language: UserProfile['language'];
  onPick: (sign: string) => void;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<number | null>(null);
  const lang: 'ru' | 'en' = language === 'en' ? 'en' : 'ru';
  const activeKey = active.toLowerCase();

  const centerSign = (sign: string, behavior: ScrollBehavior) => {
    const track = trackRef.current;
    if (!track) return;
    const option = Array.from(track.querySelectorAll<HTMLButtonElement>('[data-sign]'))
      .find((candidate) => candidate.dataset.sign?.toLowerCase() === sign.toLowerCase());
    if (!option) return;
    const left = option.offsetLeft - (track.clientWidth - option.offsetWidth) / 2;
    track.scrollTo({ left, behavior });
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => centerSign(active, 'auto'));
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  useEffect(() => () => {
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
  }, []);

  const selectCenteredSign = () => {
    const track = trackRef.current;
    if (!track) return;
    const trackCenter = track.scrollLeft + track.clientWidth / 2;
    let nearest: HTMLButtonElement | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const option of Array.from(track.querySelectorAll<HTMLButtonElement>('[data-sign]'))) {
      const optionCenter = option.offsetLeft + option.offsetWidth / 2;
      const distance = Math.abs(optionCenter - trackCenter);
      if (distance < nearestDistance) {
        nearest = option;
        nearestDistance = distance;
      }
    }
    const sign = nearest?.dataset.sign;
    if (sign && sign.toLowerCase() !== activeKey) onPick(sign);
  };

  return (
    <section className="compat-sign-picker" aria-label={label}>
      <div className="compat-sign-picker-heading">
        <h2>{label}</h2>
        <span className="compat-sign-selected" aria-live="polite">
          <ZodiacSymbol sign={active} size={22} />
          {getZodiacSign(lang, active)}
        </span>
      </div>
      <div
        ref={trackRef}
        className="compat-sign-track scrollbar-hide"
        role="listbox"
        aria-label={label}
        onScroll={() => {
          if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
          scrollTimerRef.current = window.setTimeout(selectCenteredSign, 90);
        }}
      >
        {signs.map((sign) => {
          const selected = sign.toLowerCase() === activeKey;
          return (
            <button
              key={sign}
              type="button"
              role="option"
              data-sign={sign}
              aria-selected={selected}
              className={`compat-sign-option${selected ? ' is-selected' : ''}`}
              onClick={() => {
                onPick(sign);
                centerSign(sign, 'smooth');
              }}
            >
              <ZodiacSymbol sign={sign} size={34} />
              <span>{getZodiacSign(lang, sign)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
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
      <div className="compat-choice-tabs compat-context-options" role="radiogroup" aria-label={ru ? 'Тип отношений' : 'Relationship type'}>
        {RELATIONSHIP_CONTEXT_OPTIONS.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`compat-choice-tab compat-context-option ${active ? 'is-active' : ''}`}
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
  const { profile, chartData, chartId, requestPremium, initialPrefill, onOpenCharts } = props;
  const ru = profile.language !== 'en';
  const lang: 'ru' | 'en' = ru ? 'ru' : 'en';
  const reduce = useReducedMotion();

  const premium = hasActivePremium(profile);
  const yourSun = useMemo(
    () => String(chartData?.sun?.sign || profile.selectedZodiacSign || sunSignFromDate(profile.birthDate) || 'aries').toLowerCase(),
    [chartData, profile.selectedZodiacSign, profile.birthDate],
  );

  // Пол по умолчанию: «ты» — из профиля (иначе М), партнёр — противоположный (как в трендовых приложениях).
  const initialYouGender: CompatGender = profile.gender === 'female' ? 'female' : 'male';
  const initialThemGender: CompatGender = initialYouGender === 'male' ? 'female' : 'male';

  const [screen, setScreen] = useState<'add' | 'result'>(initialPrefill ? 'result' : 'add');
  const [entryMode, setEntryMode] = useState<'birth' | 'sign'>(premium ? 'birth' : 'sign');
  const [availableCharts, setAvailableCharts] = useState<ChartListItem[]>([]);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const [firstChartId, setFirstChartId] = useState<number | null>(null);
  const [secondChartId, setSecondChartId] = useState<number | null>(initialPrefill?.partnerChartId ?? null);
  const [openSavedPicker, setOpenSavedPicker] = useState<'first' | 'second' | null>(null);
  const [history, setHistory] = useState<CompatHistoryEntry[]>([]);
  const [pickSign, setPickSign] = useState<string>(() => ZODIAC_KEYS.find((s) => s.toLowerCase() !== yourSun) || ZODIAC_KEYS[0]);
  // «Твой» знак теперь можно менять (не жёстко из карты). По умолчанию — солнечный знак из карты.
  const [youSign, setYouSign] = useState<string>(yourSun);
  const [youGender, setYouGender] = useState<CompatGender>(initialYouGender);
  const [themGender, setThemGender] = useState<CompatGender>(initialThemGender);
  const [relationshipContext, setRelationshipContext] = useState<RelationshipContext>('romance');
  const [selected, setSelected] = useState<Selected | null>(
    initialPrefill
      ? {
          kind: 'person',
          relationshipContext: 'romance',
          youSign: yourSun,
          youGender: initialYouGender,
          themGender: initialThemGender,
          subjectChartId: chartId ?? undefined,
          subjectName: profile.name,
          subjectDate: profile.birthDate,
          subjectTime: profile.birthTime,
          subjectPlace: profile.birthPlace,
          name: initialPrefill.partnerName || '',
          date: toDateInputValue(initialPrefill.partnerDate || ''),
          time: initialPrefill.partnerTime,
          place: initialPrefill.partnerPlace,
          chartId: initialPrefill.partnerChartId,
        }
      : null,
  );

  const [sName, setSName] = useState('');
  const [sDate, setSDate] = useState('');
  const [sTime, setSTime] = useState('');
  const [sPlace, setSPlace] = useState('');
  const [sUnknownTime, setSUnknownTime] = useState(false);
  const [fName, setFName] = useState(initialPrefill?.partnerName || '');
  const [fDate, setFDate] = useState(() => toDateInputValue(initialPrefill?.partnerDate || ''));
  const [fTime, setFTime] = useState(initialPrefill?.partnerTime || '');
  const [fPlace, setFPlace] = useState(initialPrefill?.partnerPlace || '');
  const [fGender, setFGender] = useState<CompatGender>(initialThemGender);
  const [unknownTime, setUnknownTime] = useState(false);

  const [signText, setSignText] = useState<SignCompatibilityResult | null>(null);
  const [deep, setDeep] = useState<SynastryResult | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const autoDeepKeyRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.id || !premium) {
      setAvailableCharts([]);
      setPeopleLoaded(true);
      return;
    }
    setPeopleLoaded(false);
    void getCharts(profile.id)
      .then((d) => {
        const readable = (d.charts || []).filter((chart) => !chart.archived_at && !chart.access_locked);
        setAvailableCharts(readable);
        setFirstChartId((current) => (
          current && readable.some((chart) => chart.id === current) ? current : null
        ));
        setSecondChartId((current) => (
          current && readable.some((chart) => chart.id === current) ? current : null
        ));
      })
      .catch(() => {
        setAvailableCharts([]);
      })
      .finally(() => setPeopleLoaded(true));
  }, [profile.id, premium, chartId]);

  useEffect(() => {
    if (!premium) setEntryMode('sign');
  }, [premium]);

  useEffect(() => {
    if (firstChartId == null || secondChartId !== firstChartId) return;
    setSecondChartId(null);
    setFName('');
    setFDate('');
    setFTime('');
    setFPlace('');
    setUnknownTime(false);
  }, [firstChartId, secondChartId]);

  useEffect(() => {
    if (!peopleLoaded || selected?.kind !== 'person') return;
    const subjectMissing = selected.subjectChartId != null
      && !availableCharts.some((chart) => chart.id === selected.subjectChartId);
    const partnerMissing = selected.chartId != null
      && !availableCharts.some((chart) => chart.id === selected.chartId);
    if (!subjectMissing && !partnerMissing) return;
    setSelected(null);
    setScreen('add');
  }, [peopleLoaded, availableCharts, selected]);

  // История — ТОЛЬКО по конкретным людям (имя+дата+разбор). Проверки по знакам не храним.
  useEffect(() => {
    setHistory(loadCompatHistory(profile.id).filter((entry) => entry.kind === 'person'));
  }, [profile.id]);

  const firstChart = useMemo(
    () => availableCharts.find((chart) => chart.id === firstChartId) || null,
    [availableCharts, firstChartId],
  );
  const secondChart = useMemo(
    () => availableCharts.find((chart) => chart.id === secondChartId) || null,
    [availableCharts, secondChartId],
  );

  // Левая сторона результата всегда соответствует первой выбранной карте или знаку.
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
      selected.kind === 'sign' ? null : leftGender,
      selected.kind === 'sign' ? null : rightGender,
      selected.relationshipContext,
    )
      .then((r) => { if (alive) setSignText(r); })
      .catch(() => { /* optional */ });
    return () => { alive = false; };
  }, [screen, selected, leftSun, theirSun, lang, leftGender, rightGender]);

  const sunOf = (s: Selected) => (s.kind === 'sign' ? String(s.sign).toLowerCase() : (sunSignFromDate(s.date) || 'libra'));

  const openResult = (s: Selected) => {
    lumiaSelectionHaptic();
    autoDeepKeyRef.current = null;
    setDeepLoading(false);
    setSelected(s);
    setScreen('result');
    const their = sunOf(s);
    // Сохраняем в историю только разбор конкретного человека — по знакам не пишем (он и так везде).
    if (s.kind === 'person') {
      const sc = getCompatScore(s.youSign, their, lang);
      setHistory(addCompatHistory({
        id: buildCompatHistoryId(s.kind, s.sign, s.name, s.date, s.relationshipContext, s.subjectChartId, s.chartId),
        kind: s.kind, sign: s.sign, name: s.name, date: s.date, time: s.time, place: s.place, chartId: s.chartId,
        subjectChartId: s.subjectChartId,
        subjectName: s.subjectName,
        subjectDate: s.subjectDate,
        subjectTime: s.subjectTime,
        subjectPlace: s.subjectPlace,
        yourSun: s.youSign, theirSun: their, yourGender: s.youGender, theirGender: s.themGender,
        relationshipContext: s.relationshipContext, overall: sc.overall, ts: Date.now(),
      }, profile.id));
    }
  };

  const openFromHistory = (e: CompatHistoryEntry) => {
    const yg: CompatGender = e.yourGender === 'female' ? 'female' : 'male';
    const tg: CompatGender = e.theirGender === 'male' ? 'male' : 'female';
    const context = normalizeRelationshipContext(e.relationshipContext);
    setRelationshipContext(context);
    const base = {
      relationshipContext: context,
      youSign: e.yourSun || yourSun,
      youGender: yg,
      themGender: tg,
      subjectChartId: e.subjectChartId,
      subjectName: e.subjectName,
      subjectDate: e.subjectDate,
      subjectTime: e.subjectTime,
      subjectPlace: e.subjectPlace,
    };
    if (e.kind === 'sign') openResult({ kind: 'sign', sign: e.sign, ...base });
    else openResult({ kind: 'person', name: e.name, date: e.date, time: e.time, place: e.place, chartId: e.chartId, ...base });
  };

  const deleteHistory = (id: string, ev: React.MouseEvent) => {
    ev.stopPropagation();
    lumiaSelectionHaptic();
    setHistory(removeCompatHistory(id, profile.id));
  };

  const deleteAllHistory = () => {
    const confirmed = window.confirm(
      ru
        ? 'Удалить всю историю сравнений? Вернуть её не получится.'
        : 'Delete all comparison history? This cannot be undone.',
    );
    if (!confirmed) return;
    lumiaSelectionHaptic();
    setHistory(clearCompatHistory(profile.id));
  };

  const shareCompat = () => {
    if (!selected) return;
    const first = selected.kind === 'sign'
      ? getZodiacSign(lang, leftSun)
      : (selected.subjectName || profile.name || (ru ? 'Первая карта' : 'First chart'));
    const second = selected.kind === 'sign'
      ? getZodiacSign(lang, theirSun)
      : (selected.name || (ru ? 'Вторая карта' : 'Second chart'));
    const text = selected.kind === 'person'
      ? ru
        ? `Совместимость ${first} + ${second}: ${deep?.summary || 'подробный разбор по двум натальным картам'}.\n\nПроверь совместимость в «Твой Гороскоп».`
        : `Compatibility ${first} + ${second}: ${deep?.summary || 'a detailed two-chart reading'}.\n\nCheck compatibility in Your Horoscope.`
      : score
        ? ru
          ? `Совместимость ${first} + ${second}: ${score.overall}/100 — ${score.verdict}. Сильнее всего — ${DIMENSION_LABELS[score.strongest][lang]}.\n\nПроверь совместимость в «Твой Гороскоп».`
          : `Compatibility ${first} + ${second}: ${score.overall}/100 — ${score.verdict}. Strongest — ${DIMENSION_LABELS[score.strongest][lang]}.\n\nCheck compatibility in Your Horoscope.`
        : '';
    if (!text) return;
    shareToTelegram(text);
  };

  const submitAdd = () => {
    if (!premium) { requestPremium(); return; }
    if (firstChartId != null && secondChartId != null && secondChartId === firstChartId) {
      setError(ru ? 'Для сравнения нужны две разные карты.' : 'Choose two different charts.');
      return;
    }
    const subjectName = firstChart?.name || sName.trim();
    const subjectDate = firstChart?.birth_date || sDate;
    const subjectPlace = firstChart?.birth_place || sPlace.trim();
    const partnerName = secondChart?.name || fName.trim();
    const partnerDate = secondChart?.birth_date || fDate;
    const partnerPlace = secondChart?.birth_place || fPlace.trim();
    if (!subjectName || !subjectDate || !subjectPlace || !partnerName || !partnerDate || !partnerPlace) {
      setError(ru ? 'Для обоих людей укажи имя, дату и место рождения.' : 'Add a name, birth date and birth place for both people.');
      return;
    }
    setError(null);
    openResult({
      kind: 'person',
      relationshipContext,
      subjectChartId: firstChart?.id,
      subjectName,
      subjectDate,
      subjectTime: firstChart?.birth_time || (sUnknownTime ? undefined : (sTime || undefined)),
      subjectPlace,
      name: partnerName,
      date: partnerDate,
      time: secondChart?.birth_time || (unknownTime ? undefined : (fTime || undefined)),
      place: partnerPlace,
      chartId: secondChart?.id,
      youSign: String(firstChart?.chart_data?.sun?.sign || sunSignFromDate(subjectDate) || yourSun).toLowerCase(),
      youGender,
      themGender: fGender,
    });
  };

  const runDeep = useCallback(async () => {
    if (!selected || selected.kind !== 'person' || deepLoading) return;
    if (!premium) { requestPremium(); return; }
    if (
      (selected.chartId != null && (!peopleLoaded || !availableCharts.some((chart) => chart.id === selected.chartId)))
      || (selected.subjectChartId != null && (!peopleLoaded || !availableCharts.some((chart) => chart.id === selected.subjectChartId)))
    ) {
      setSelected(null);
      setScreen('add');
      return;
    }
    const requestKey = [
      selected.subjectChartId || `${selected.subjectName || ''}:${selected.subjectDate || ''}`,
      selected.chartId || `${selected.name || ''}:${selected.date || ''}`,
      selected.relationshipContext,
    ].join('|');
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
        selected.subjectChartId,
        {
          name: selected.subjectName || '',
          date: selected.subjectDate || '',
          time: selected.subjectTime,
          place: selected.subjectPlace,
        },
      );
      if (autoDeepKeyRef.current === requestKey) setDeep(out.result);
    } catch (e: any) {
      if (autoDeepKeyRef.current === requestKey) {
        setError(e?.message || (ru ? 'Не удалось собрать полный разбор.' : 'Could not build the full reading.'));
      }
    } finally {
      if (autoDeepKeyRef.current === requestKey) setDeepLoading(false);
    }
  }, [selected, deepLoading, premium, requestPremium, peopleLoaded, availableCharts, profile, ru]);

  useEffect(() => {
    if (screen !== 'result' || selected?.kind !== 'person' || !premium || !peopleLoaded) return;
    const key = [
      selected.subjectChartId || `${selected.subjectName || ''}:${selected.subjectDate || ''}`,
      selected.chartId || `${selected.name || ''}:${selected.date || ''}`,
      selected.relationshipContext,
    ].join('|');
    if (autoDeepKeyRef.current === key) return;
    autoDeepKeyRef.current = key;
    void runDeep();
  }, [screen, selected, premium, peopleLoaded, runDeep]);

  /* ── ДОБАВЛЕНИЕ ── */
  if (screen === 'add') {
    return (
      <div className="fresh-page compat-editorial-page compat-editorial-page--add">
        <AppTopBar
          title={ru ? 'Совместимость' : 'Compatibility'}
          subtitle={ru
            ? 'Сравним двух людей — по данным рождения или быстро по знакам.'
            : 'Compare two people by birth data or quickly by zodiac signs.'}
        />

        <div className="compat-choice-tabs compat-mode-switch" role="group" aria-label={ru ? 'Способ сравнения' : 'Comparison method'}>
          <button
            type="button"
            className={`compat-choice-tab${entryMode === 'birth' ? ' is-active' : ''}`}
            aria-pressed={entryMode === 'birth'}
            onClick={() => {
              lumiaSelectionHaptic();
              if (!premium) {
                requestPremium();
                return;
              }
              setError(null);
              setEntryMode('birth');
            }}
          >
            {ru ? 'По дате рождения' : 'By birth date'}
          </button>
          <button
            type="button"
            className={`compat-choice-tab${entryMode === 'sign' ? ' is-active' : ''}`}
            aria-pressed={entryMode === 'sign'}
            onClick={() => {
              lumiaSelectionHaptic();
              setError(null);
              setEntryMode('sign');
            }}
          >
            {ru ? 'По знакам зодиака' : 'By zodiac signs'}
          </button>
        </div>

        {entryMode === 'birth' ? (
          <>
            <form
              className="compat-entry-form"
              onSubmit={(event) => {
                event.preventDefault();
                submitAdd();
              }}
            >
              <div className="compat-entry-who-heading">
                <h2 className="compat-entry-who-title">
                  {ru ? 'Кого сравниваем?' : 'Who are we comparing?'}
                </h2>
              </div>

              <section className="compat-air-person" aria-labelledby="compat-first-person-title">
                <header className="compat-air-person-heading">
                  <span className="compat-air-person-index" aria-hidden="true">01</span>
                  <h3 id="compat-first-person-title">{ru ? 'Один человек' : 'One person'}</h3>
                  <button
                    type="button"
                    className="compat-air-saved-trigger"
                    aria-expanded={openSavedPicker === 'first'}
                    aria-controls="compat-first-saved-panel"
                    onClick={() => setOpenSavedPicker((current) => current === 'first' ? null : 'first')}
                  >
                    <span>{ru ? 'Из сохранённых' : 'Saved charts'}</span>
                    <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" /></svg>
                  </button>
                </header>

                {openSavedPicker === 'first' ? (
                  <div id="compat-first-saved-panel" className="compat-air-saved-panel">
                    <select
                      id="compat-first-chart"
                      className="compat-air-select"
                      aria-label={ru ? 'Выбрать сохранённую карту' : 'Choose a saved chart'}
                      value={firstChartId ?? 'manual'}
                      onChange={(event) => {
                        lumiaSelectionHaptic();
                        if (event.target.value === 'manual') {
                          setFirstChartId(null);
                          setSName(''); setSDate(''); setSTime(''); setSPlace(''); setSUnknownTime(false);
                          return;
                        }
                        const nextId = Number(event.target.value);
                        const nextChart = availableCharts.find((chart) => chart.id === nextId);
                        setFirstChartId(nextId);
                        if (nextChart) {
                          setSName(nextChart.name);
                          setSDate(toDateInputValue(nextChart.birth_date));
                          setSTime(nextChart.birth_time || '');
                          setSPlace(nextChart.birth_place || '');
                          setSUnknownTime(!nextChart.birth_time);
                        }
                      }}
                    >
                      <option value="manual">{peopleLoaded ? (ru ? 'Ввести данные вручную' : 'Enter details manually') : (ru ? 'Загружаем карты…' : 'Loading charts…')}</option>
                      {availableCharts.map((chart) => (
                        <option key={chart.id} value={chart.id} disabled={chart.id === secondChartId}>
                          {chart.name}{chart.subject_type === 'self' ? (ru ? ' · основная' : ' · primary') : ''}
                        </option>
                      ))}
                    </select>
                    {onOpenCharts ? <button type="button" className="compat-air-add-chart" onClick={onOpenCharts}>{ru ? 'Новая карта' : 'New chart'}</button> : null}
                  </div>
                ) : null}

                <PersonBirthFields
                  prefix="compat-first-person"
                  ru={ru}
                  name={sName}
                  date={sDate}
                  time={sTime}
                  place={sPlace}
                  gender={youGender}
                  unknownTime={sUnknownTime}
                  onNameChange={(value) => { setFirstChartId(null); setSName(value); }}
                  onDateChange={(value) => { setFirstChartId(null); setSDate(value); }}
                  onTimeChange={(value) => { setFirstChartId(null); setSTime(value); }}
                  onPlaceChange={(value) => { setFirstChartId(null); setSPlace(value); }}
                  onGenderChange={setYouGender}
                  onUnknownTimeChange={(value) => {
                    setFirstChartId(null);
                    setSUnknownTime(value);
                    if (value) setSTime('');
                  }}
                />
              </section>

              <div className="compat-person-divider" aria-hidden="true"><span>+</span></div>

              <section className="compat-air-person" aria-labelledby="compat-second-person-title">
                <header className="compat-air-person-heading">
                  <span className="compat-air-person-index" aria-hidden="true">02</span>
                  <h3 id="compat-second-person-title">{ru ? 'Другой человек' : 'Another person'}</h3>
                  <button
                    type="button"
                    className="compat-air-saved-trigger"
                    aria-expanded={openSavedPicker === 'second'}
                    aria-controls="compat-second-saved-panel"
                    onClick={() => setOpenSavedPicker((current) => current === 'second' ? null : 'second')}
                  >
                    <span>{ru ? 'Из сохранённых' : 'Saved charts'}</span>
                    <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" /></svg>
                  </button>
                </header>

                {openSavedPicker === 'second' ? (
                  <div id="compat-second-saved-panel" className="compat-air-saved-panel">
                    <select
                      id="compat-second-chart"
                      className="compat-air-select"
                      aria-label={ru ? 'Выбрать сохранённую карту' : 'Choose a saved chart'}
                      value={secondChartId ?? 'manual'}
                      onChange={(event) => {
                        lumiaSelectionHaptic();
                        if (event.target.value === 'manual') {
                          setSecondChartId(null);
                          setFName(''); setFDate(''); setFTime(''); setFPlace(''); setUnknownTime(false);
                          return;
                        }
                        const nextId = Number(event.target.value);
                        const nextChart = availableCharts.find((chart) => chart.id === nextId);
                        setSecondChartId(nextId);
                        if (nextChart) {
                          setFName(nextChart.name);
                          setFDate(toDateInputValue(nextChart.birth_date));
                          setFTime(nextChart.birth_time || '');
                          setFPlace(nextChart.birth_place || '');
                          setUnknownTime(!nextChart.birth_time);
                        }
                      }}
                    >
                      <option value="manual">{ru ? 'Ввести данные вручную' : 'Enter details manually'}</option>
                      {availableCharts.map((chart) => (
                        <option key={chart.id} value={chart.id} disabled={chart.id === firstChartId}>
                          {chart.name}{chart.subject_type === 'self' ? (ru ? ' · основная' : ' · primary') : ''}
                        </option>
                      ))}
                    </select>
                    {onOpenCharts ? <button type="button" className="compat-air-add-chart" onClick={onOpenCharts}>{ru ? 'Новая карта' : 'New chart'}</button> : null}
                  </div>
                ) : null}

                <PersonBirthFields
                  prefix="compat-second-person"
                  ru={ru}
                  name={fName}
                  date={fDate}
                  time={fTime}
                  place={fPlace}
                  gender={fGender}
                  unknownTime={unknownTime}
                  onNameChange={(value) => { setSecondChartId(null); setFName(value); }}
                  onDateChange={(value) => { setSecondChartId(null); setFDate(value); }}
                  onTimeChange={(value) => { setSecondChartId(null); setFTime(value); }}
                  onPlaceChange={(value) => { setSecondChartId(null); setFPlace(value); }}
                  onGenderChange={setFGender}
                  onUnknownTimeChange={(value) => {
                    setSecondChartId(null);
                    setUnknownTime(value);
                    if (value) setFTime('');
                  }}
                />
              </section>

              <section className="compat-entry-context" aria-labelledby="compat-context-title">
                <h2 id="compat-context-title">{ru ? 'Тип совместимости' : 'Compatibility type'}</h2>
                <RelationshipContextPicker
                  value={relationshipContext}
                  onChange={setRelationshipContext}
                  ru={ru}
                  compact
                />
              </section>

              {error ? <p className="compat-entry-error" role="alert">{error}</p> : null}

              <button type="submit" className="fresh-btn-primary compat-entry-submit">
                {ru ? 'Сравнить' : 'Compare'}
              </button>
            </form>

            {history.length ? (
              <details className="compat-history-panel">
                <summary>{ru ? 'История сравнений' : 'Comparison history'}</summary>
                <div className="compat-history-toolbar">
                  <button type="button" onClick={deleteAllHistory}>{ru ? 'Очистить историю' : 'Clear history'}</button>
                </div>
                <div className="compat-hist">
                  {history.map((entry) => (
                    <div key={entry.id} className="compat-hist-row" role="button" tabIndex={0} onClick={() => openFromHistory(entry)} onKeyDown={(event) => { if (event.key === 'Enter') openFromHistory(entry); }}>
                      <span className="compat-hist-ico"><ZodiacIcon sign={entry.theirSun} size={20} strokeWidth={1.5} /></span>
                      <span className="compat-hist-main">
                        <span className="compat-hist-name">
                          {entry.subjectName || profile.name || (ru ? 'Первая карта' : 'First chart')}
                          {' + '}
                          {entry.name || (ru ? 'Вторая карта' : 'Second chart')}
                        </span>
                        <span className="compat-hist-sub">{getZodiacSign(lang, entry.theirSun)} · {getRelationshipContextLabel(normalizeRelationshipContext(entry.relationshipContext), lang)}</span>
                      </span>
                      <span className="compat-hist-open" aria-hidden="true"><ChevronRightIcon size={17} /></span>
                      <button type="button" className="compat-hist-del" aria-label={ru ? 'Удалить' : 'Delete'} onClick={(event) => deleteHistory(entry.id, event)}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </>
        ) : (
          <form
            className="compat-sign-form"
            onSubmit={(event) => {
              event.preventDefault();
              openResult({ kind: 'sign', relationshipContext, sign: pickSign, youSign, youGender, themGender });
            }}
          >
            <h2 className="compat-entry-who-title">
              {ru ? 'Кого сравниваем?' : 'Who are we comparing?'}
            </h2>
            <SignSwipePicker
              label={ru ? 'Один человек' : 'One person'}
              signs={ZODIAC_KEYS}
              active={youSign}
              language={profile.language}
              onPick={(sign) => { lumiaSelectionHaptic(); setYouSign(sign); }}
            />

            <div className="compat-person-divider compat-person-divider--signs" aria-hidden="true"><span>+</span></div>

            <SignSwipePicker
              label={ru ? 'Другой человек' : 'Another person'}
              signs={ZODIAC_KEYS}
              active={pickSign}
              language={profile.language}
              onPick={(sign) => { lumiaSelectionHaptic(); setPickSign(sign); }}
            />

            <section className="compat-entry-context" aria-labelledby="compat-sign-context-title">
              <h2 id="compat-sign-context-title">{ru ? 'Тип совместимости' : 'Compatibility type'}</h2>
              <RelationshipContextPicker
                value={relationshipContext}
                onChange={setRelationshipContext}
                ru={ru}
                compact
              />
            </section>

            <button type="submit" className="fresh-btn-primary compat-entry-submit">
              {ru ? 'Сравнить' : 'Compare'}
            </button>
            <p className="compat-entry-note compat-entry-note--centered">
              {ru
                ? 'Для подробного разбора нужны дата, время и место рождения.'
                : 'A detailed reading needs the birth date, time and place.'}
            </p>
          </form>
        )}

        <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }} />
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
  const leftName = selected?.kind === 'sign'
    ? (ru ? 'Один человек' : 'One person')
    : (selected?.subjectName || profile.name || (ru ? 'Первая карта' : 'First chart'));
  const rightName = selected?.kind === 'sign'
    ? (ru ? 'Другой человек' : 'Another person')
    : theirName;
  const leftBirthDate = selected?.subjectDate || profile.birthDate;
  const leftDetail = selected?.kind === 'sign'
    ? getZodiacSign(lang, leftSun)
    : leftBirthDate
      ? `${genderWord(leftGender, ru)} — ${formatDisplayDate(leftBirthDate, lang)}`
      : `${genderWord(leftGender, ru)} · ${getZodiacSign(lang, leftSun)}`;
  const rightDetail = selected?.date
    ? `${selected.kind === 'sign' ? '' : `${genderWord(rightGender, ru)} — `}${formatDisplayDate(selected.date, lang)}`
    : selected?.kind === 'sign'
      ? getZodiacSign(lang, theirSun)
      : `${genderWord(rightGender, ru)} · ${getZodiacSign(lang, theirSun)}`;
  const signReadingBlocks = selected?.kind === 'sign' && signText
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
          setEntryMode(selected?.kind === 'sign' ? 'sign' : 'birth');
          setScreen('add');
        }}
      />

      <header className="compat-result-heading">
        <h1>{ru ? 'Совместимость' : 'Compatibility'}</h1>
        <div className="compat-result-people">
          <span><strong>{leftName}</strong><small>{leftDetail}</small></span>
          <span><strong>{rightName}</strong><small>{rightDetail}</small></span>
        </div>
      </header>

      <div className="compat-result-context">
        {ru ? 'Смотрим' : 'Context'} · <strong>{resultContextLabel}</strong>
      </div>

      {!isPerson && score ? (
        <section className="compat-main-conclusion">
          <h2>{score.verdict}</h2>
          <p><strong>{ru ? 'Сильнее всего:' : 'Strongest:'}</strong> {strongestLabel}</p>
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
      ) : (!isPerson || !deep) ? (
        <p className="union-pad" role="status" aria-live="polite" style={{ marginTop: 12, color: 'var(--fresh-muted)', fontSize: 14 }}>
          {isPerson
            ? (deepLoading ? (ru ? 'Сравниваем две натальные карты…' : 'Comparing two natal charts…') : (ru ? 'Готовим разбор по картам…' : 'Preparing the chart reading…'))
            : (ru ? 'Готовим разбор…' : 'Preparing…')}
        </p>
      ) : null}

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
        <button type="button" className="horo-premium" style={{ marginTop: 16 }} disabled={deepLoading} onClick={() => void runDeep()}>
          <div className="horo-premium-text">
            <div className="horo-premium-kicker">{ru ? 'Сравнение по двум картам' : 'Two-chart comparison'}</div>
            <div className="horo-premium-title">
              {deepLoading ? (ru ? 'Собираю по картам…' : 'Building from charts…') : !premium ? (ru ? 'Глубокий разбор по двум картам — в Premium' : 'Deep two-chart reading — Premium') : (ru ? 'Разбор по двум картам' : 'Read both charts')}
            </div>
          </div>
          <span className="horo-premium-cta">{!premium ? 'Premium' : (ru ? 'Открыть' : 'Open')}<ChevronRightIcon size={15} /></span>
        </button>
      ) : (
        <button type="button" className="horo-premium" style={{ marginTop: 16 }} onClick={() => {
          lumiaSelectionHaptic();
          if (!premium) {
            requestPremium();
            return;
          }
          setEntryMode('birth');
          setScreen('add');
        }}>
          <div className="horo-premium-text">
            <div className="horo-premium-kicker">Premium</div>
            <div className="horo-premium-title">{ru ? 'Подробное сравнение по двум натальным картам' : 'Detailed comparison from two natal charts'}</div>
          </div>
          <span className="horo-premium-cta">{premium ? (ru ? 'Открыть' : 'Open') : 'Premium'}<ChevronRightIcon size={15} /></span>
        </button>
      )}

      {!isPerson && score ? (
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

      {!isPerson || deep ? (
        <div className="union-pad" style={{ marginTop: 6 }}>
          <HoroscopeActivityBar
            userId={profile.id ? String(profile.id) : undefined}
            sign={`${leftSun}_${theirSun}`}
            date="2000-01-01"
            language={lang}
            onShare={shareCompat}
          />
        </div>
      ) : null}

      <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }} />
    </div>
  );
}
