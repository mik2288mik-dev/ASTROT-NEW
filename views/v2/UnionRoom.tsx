import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const { profile, chartData, chartId, requestPremium, initialPrefill, onOpenCharts, onCreateNatalChart } = props;
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

  const [screen, setScreen] = useState<'add' | 'result'>(initialPrefill ? 'result' : 'add');
  const [entryMode, setEntryMode] = useState<'birth' | 'sign'>(premium && hasChart ? 'birth' : 'sign');
  const [availableCharts, setAvailableCharts] = useState<ChartListItem[]>([]);
  const [people, setPeople] = useState<ChartListItem[]>([]);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const [firstChartId, setFirstChartId] = useState<number | null>(chartId ?? null);
  const [secondChartId, setSecondChartId] = useState<number | null>(initialPrefill?.partnerChartId ?? null);
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
      setPeople([]);
      setPeopleLoaded(true);
      return;
    }
    setPeopleLoaded(false);
    void getCharts(profile.id)
      .then((d) => {
        const readable = (d.charts || []).filter((chart) => !chart.archived_at && !chart.access_locked);
        const saved = readable.filter((chart) => chart.subject_type === 'saved_person');
        setAvailableCharts(readable);
        setPeople(saved);
        setFirstChartId((current) => {
          if (current && readable.some((chart) => chart.id === current)) return current;
          return readable.find((chart) => chart.subject_type === 'self')?.id ?? chartId ?? null;
        });
        setSecondChartId((current) => (
          current && readable.some((chart) => chart.id === current) ? current : null
        ));
      })
      .catch(() => {
        setAvailableCharts([]);
        setPeople([]);
      })
      .finally(() => setPeopleLoaded(true));
  }, [profile.id, premium, chartId]);

  useEffect(() => {
    if (!premium || !hasChart) setEntryMode('sign');
  }, [premium, hasChart]);

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
    if (!firstChart?.id) {
      setError(ru ? 'Выбери первую сохранённую карту.' : 'Choose the first saved chart.');
      return;
    }
    if (secondChartId != null && secondChartId === firstChart.id) {
      setError(ru ? 'Для сравнения нужны две разные карты.' : 'Choose two different charts.');
      return;
    }
    const partnerName = secondChart?.name || fName.trim();
    const partnerDate = secondChart?.birth_date || fDate;
    const partnerPlace = secondChart?.birth_place || fPlace.trim();
    if (!partnerName || !partnerDate || !partnerPlace) {
      setError(ru ? 'Выбери сохранённую карту или добавь имя, дату и место рождения.' : 'Choose a saved chart or add a name, birth date and birth place.');
      return;
    }
    setError(null);
    openResult({
      kind: 'person',
      relationshipContext,
      subjectChartId: firstChart.id,
      subjectName: firstChart.name,
      subjectDate: firstChart.birth_date,
      subjectTime: firstChart.birth_time || undefined,
      subjectPlace: firstChart.birth_place || undefined,
      name: partnerName,
      date: partnerDate,
      time: secondChart?.birth_time || (unknownTime ? undefined : (fTime || undefined)),
      place: partnerPlace,
      chartId: secondChart?.id,
      youSign: String(firstChart.chart_data?.sun?.sign || yourSun).toLowerCase(),
      youGender,
      themGender: fGender,
    });
  };

  const runDeep = useCallback(async () => {
    if (!selected || selected.kind !== 'person' || deepLoading) return;
    if (!hasChart) { onCreateNatalChart?.(); return; }
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
      selected.subjectChartId || 'self',
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
      );
      if (autoDeepKeyRef.current === requestKey) setDeep(out.result);
    } catch (e: any) {
      if (autoDeepKeyRef.current === requestKey) {
        setError(e?.message || (ru ? 'Не удалось собрать полный разбор.' : 'Could not build the full reading.'));
      }
    } finally {
      if (autoDeepKeyRef.current === requestKey) setDeepLoading(false);
    }
  }, [selected, deepLoading, hasChart, onCreateNatalChart, premium, requestPremium, peopleLoaded, availableCharts, profile, ru]);

  useEffect(() => {
    if (screen !== 'result' || selected?.kind !== 'person' || !premium || !hasChart || !peopleLoaded) return;
    const key = [
      selected.subjectChartId || 'self',
      selected.chartId || `${selected.name || ''}:${selected.date || ''}`,
      selected.relationshipContext,
    ].join('|');
    if (autoDeepKeyRef.current === key) return;
    autoDeepKeyRef.current = key;
    void runDeep();
  }, [screen, selected, premium, hasChart, peopleLoaded, runDeep]);

  /* ── ДОБАВЛЕНИЕ ── */
  if (screen === 'add') {
    return (
      <div className="fresh-page compat-editorial-page compat-editorial-page--add">
        <AppTopBar title={ru ? 'Твой гороскоп' : 'Your Horoscope'} />

        <header className="compat-page-heading">
          <h1>{ru ? 'Совместимость' : 'Compatibility'}</h1>
          <p>
            {ru
              ? 'Сравним двух людей — подробно по данным рождения или быстро по знакам зодиака.'
              : 'Compare two people in detail from birth data or quickly by zodiac signs.'}
          </p>
        </header>

        <div className="compat-mode-switch" role="group" aria-label={ru ? 'Способ сравнения' : 'Comparison method'}>
          <button
            type="button"
            className={entryMode === 'birth' ? 'is-active' : ''}
            aria-pressed={entryMode === 'birth'}
            onClick={() => {
              lumiaSelectionHaptic();
              if (!premium) {
                requestPremium();
                return;
              }
              if (!hasChart) {
                onCreateNatalChart?.();
                return;
              }
              setError(null);
              setEntryMode('birth');
            }}
          >
            <span>{ru ? 'По данным рождения' : 'By birth data'}</span>
            <small>Premium</small>
          </button>
          <button
            type="button"
            className={entryMode === 'sign' ? 'is-active' : ''}
            aria-pressed={entryMode === 'sign'}
            onClick={() => {
              lumiaSelectionHaptic();
              setError(null);
              setEntryMode('sign');
            }}
          >
            <span>{ru ? 'По знакам зодиака' : 'By zodiac signs'}</span>
            <small>{ru ? 'Бесплатно' : 'Free'}</small>
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
              <h2 className="compat-entry-who-title">
                {ru ? 'Кого сравниваем?' : 'Who are we comparing?'}
              </h2>

              <fieldset className="compat-entry-person">
                <legend className="compat-person-legend">
                  <span aria-hidden="true">1</span>
                  <strong>{firstChart?.name || (ru ? 'Первая карта' : 'First chart')}</strong>
                </legend>
                <label className="compat-chart-select-label" htmlFor="compat-first-chart">
                  {ru ? 'Выбрать карту' : 'Choose a chart'}
                </label>
                <select
                  id="compat-first-chart"
                  className="compat-chart-select"
                  value={firstChartId ?? ''}
                  onChange={(event) => {
                    lumiaSelectionHaptic();
                    setFirstChartId(event.target.value ? Number(event.target.value) : null);
                  }}
                >
                  <option value="" disabled>{peopleLoaded ? (ru ? 'Выберите карту' : 'Choose a chart') : (ru ? 'Загружаем карты…' : 'Loading charts…')}</option>
                  {availableCharts.map((chart) => (
                    <option key={chart.id} value={chart.id}>
                      {chart.name}{chart.subject_type === 'self' ? (ru ? ' · основная' : ' · primary') : ''}
                    </option>
                  ))}
                </select>
                <div className="compat-self-identity">
                  <strong>{getZodiacSign(lang, String(firstChart?.chart_data?.sun?.sign || yourSun))}</strong>
                  <span>
                    {[
                      firstChart?.birth_date ? formatDisplayDate(firstChart.birth_date, lang) : (profile.birthDate ? formatDisplayDate(profile.birthDate, lang) : null),
                      firstChart?.birth_time || profile.birthTime || null,
                      firstChart?.birth_place || profile.birthPlace || null,
                    ].filter(Boolean).join(' · ') || (ru ? 'Данные рождения не указаны' : 'Birth data is not set')}
                  </span>
                </div>
                <div>
                  <span id="compat-self-gender-label" className="fresh-field-label">{ru ? 'Пол' : 'Gender'}</span>
                  <GenderToggle value={youGender} onChange={setYouGender} ru={ru} labelledBy="compat-self-gender-label" />
                </div>
              </fieldset>

              <div className="compat-person-divider" aria-hidden="true"><span>+</span></div>

              <fieldset className="compat-entry-person">
                <legend className="compat-person-legend">
                  <span aria-hidden="true">2</span>
                  <strong>{secondChart?.name || fName.trim() || (ru ? 'Вторая карта' : 'Second chart')}</strong>
                </legend>
                <div className="union-form">
                  <div>
                    <label className="fresh-field-label" htmlFor="compat-second-chart">{ru ? 'Выбрать сохранённую карту' : 'Choose a saved chart'}</label>
                    <select
                      id="compat-second-chart"
                      className="compat-chart-select"
                      value={secondChartId ?? 'manual'}
                      onChange={(event) => {
                        lumiaSelectionHaptic();
                        if (event.target.value === 'manual') {
                          setSecondChartId(null);
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
                  </div>
                  <div>
                    <label className="fresh-field-label" htmlFor="compat-person-name">{ru ? 'Имя' : 'Name'}</label>
                    <input id="compat-person-name" className="fresh-input" value={fName} disabled={secondChartId != null} onChange={(event) => setFName(event.target.value)} placeholder={ru ? 'Например, Аня' : 'e.g. Alex'} autoComplete="name" />
                  </div>
                  <div className="compat-birth-row">
                    <div>
                      <label className="fresh-field-label" htmlFor="compat-person-birth-date">{ru ? 'Дата рождения' : 'Birth date'}</label>
                      <input id="compat-person-birth-date" className="fresh-input" type="date" value={fDate} disabled={secondChartId != null} onChange={(event) => setFDate(event.target.value)} />
                    </div>
                    <div className={unknownTime ? 'is-disabled' : ''}>
                      <label className="fresh-field-label" htmlFor="compat-person-time">{ru ? 'Время' : 'Time'}</label>
                      <input
                        id="compat-person-time"
                        className="fresh-input"
                        type="time"
                        value={fTime}
                        disabled={unknownTime || secondChartId != null}
                        onChange={(event) => setFTime(event.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="fresh-field-label" htmlFor="compat-person-place">{ru ? 'Место рождения' : 'Birth place'}</label>
                    <input id="compat-person-place" className="fresh-input" value={fPlace} disabled={secondChartId != null} onChange={(event) => setFPlace(event.target.value)} placeholder={ru ? 'Город' : 'City'} autoComplete="address-level2" />
                  </div>
                  <label className="compat-unknown-time">
                    <input
                      type="checkbox"
                      checked={unknownTime}
                      disabled={secondChartId != null}
                      onChange={(event) => {
                        setUnknownTime(event.target.checked);
                        if (event.target.checked) setFTime('');
                      }}
                    />
                    <span>{ru ? 'Не знаю точное время' : 'I do not know the exact time'}</span>
                  </label>
                  <div>
                    <span id="compat-person-gender-label" className="fresh-field-label">{ru ? 'Пол' : 'Gender'}</span>
                    <GenderToggle value={fGender} onChange={setFGender} ru={ru} labelledBy="compat-person-gender-label" />
                  </div>
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

              {error ? <p className="compat-entry-error" role="alert">{error}</p> : null}

              <button type="submit" className="fresh-btn-primary compat-entry-submit">
                {ru ? 'Сравнить карты' : 'Compare charts'}
              </button>
              <p className="compat-entry-note compat-entry-note--centered">
                {ru
                  ? 'Точное время улучшает расчёт, но можно продолжить и без него.'
                  : 'Exact birth time improves the calculation, but you can continue without it.'}
              </p>
            </form>

            {history.length ? (
              <section className="compat-saved-section">
                <div className="compat-saved-heading">
                  <h2>{ru ? 'История сравнений' : 'Comparison history'}</h2>
                  <button type="button" onClick={deleteAllHistory}>{ru ? 'Очистить' : 'Clear'}</button>
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
              </section>
            ) : null}

            <section className="compat-saved-section">
              <div className="compat-saved-heading">
                <h2>{ru ? `Сохранённые карты · ${people.length}/5` : `Saved charts · ${people.length}/5`}</h2>
                {onOpenCharts ? (
                  <button type="button" className="compat-manage-charts" onClick={onOpenCharts}>
                    {ru ? 'Управлять' : 'Manage'}
                  </button>
                ) : null}
              </div>
              {people.length ? (
                <div className="people-grid">
                  {people.map((chart) => {
                    return (
                      <button key={chart.id} type="button" className="people-card" onClick={() => {
                        if (!firstChart || firstChart.id === chart.id) return;
                        openResult({
                          kind: 'person',
                          relationshipContext,
                          subjectChartId: firstChart.id,
                          subjectName: firstChart.name,
                          subjectDate: firstChart.birth_date,
                          subjectTime: firstChart.birth_time || undefined,
                          subjectPlace: firstChart.birth_place || undefined,
                          name: chart.name,
                          date: toDateInputValue(chart.birth_date),
                          time: chart.birth_time || undefined,
                          place: chart.birth_place || undefined,
                          chartId: chart.id,
                          youSign: String(firstChart.chart_data?.sun?.sign || yourSun).toLowerCase(),
                          youGender,
                          themGender,
                        });
                      }} disabled={firstChart?.id === chart.id}>
                        <span className="people-card-icon"><ZodiacSymbol sign={chart.chart_data?.sun?.sign || sunSignFromDate(chart.birth_date)} size={32} /></span>
                        <span className="people-card-name">{chart.name}</span>
                        <span className="people-card-sign">{getZodiacSign(lang, sunSignFromDate(chart.birth_date) || '')}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="compat-saved-empty">
                  {ru ? 'Добавь карту человека — она сразу появится в обоих полях сравнения.' : 'Add a person’s chart and it will appear in both comparison fields.'}
                </p>
              )}
            </section>
          </>
        ) : (
          <form
            className="compat-sign-form"
            onSubmit={(event) => {
              event.preventDefault();
              openResult({ kind: 'sign', relationshipContext, sign: pickSign, youSign, youGender, themGender });
            }}
          >
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
              {deepLoading ? (ru ? 'Собираю по картам…' : 'Building from charts…') : !hasChart ? (ru ? 'Нужна твоя карта' : 'Your chart needed') : !premium ? (ru ? 'Глубокий разбор по двум картам — в Premium' : 'Deep two-chart reading — Premium') : (ru ? 'Разбор по двум картам' : 'Read both charts')}
            </div>
          </div>
          <span className="horo-premium-cta">{!hasChart ? (ru ? 'Создать' : 'Create') : !premium ? 'Premium' : (ru ? 'Открыть' : 'Open')}<ChevronRightIcon size={15} /></span>
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
