import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { NatalChartData, SynastryResult, UserProfile } from '../../types';
import type { SignCompatibilityResult } from '../../lib/synastry/signCompatibility';
import { getZodiacSign } from '../../constants';
import { hasActivePremium, hasNatalChart } from '../../lib/accessMatrix';
import { getCharts, type ChartListItem } from '../../services/storageService';
import { getSignCompatibility, calculateExtendedSynastry } from '../../services/astrologyService';
import { toDateInputValue } from '../../lib/date-utils';
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
function GenderToggle({ value, onChange, ru }: { value: CompatGender; onChange: (g: CompatGender) => void; ru: boolean }) {
  return (
    <div className="compat-gender" role="group" aria-label={ru ? 'Пол' : 'Gender'}>
      <button type="button" className={`compat-gender-btn ${value === 'male' ? 'is-on' : ''}`} aria-pressed={value === 'male'} onClick={() => { lumiaSelectionHaptic(); onChange('male'); }}>
        {ru ? 'М' : 'M'}
      </button>
      <button type="button" className={`compat-gender-btn ${value === 'female' ? 'is-on' : ''}`} aria-pressed={value === 'female'} onClick={() => { lumiaSelectionHaptic(); onChange('female'); }}>
        {ru ? 'Ж' : 'F'}
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

/* Цвет на каждую сферу — в общей серо-синей палитре приложения */
const DIM_COLORS: Record<CompatDimension, string> = {
  love: '#1478FF',
  relationship: '#2563EB',
  friendship: '#38BDF8',
  work: '#64748B',
};

/* Плавный счёт от 0 к значению (как в кольце-score) */
function useCountUp(value: number, reduce: boolean | null) {
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setShown(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const dur = 800;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);
  return shown;
}

/* Одна цветная градиент-шкала со счётом и пружинной заливкой */
function DimBar({ label, value, color, top, index, reduce }: {
  label: string; value: number; color: string; top: boolean; index: number; reduce: boolean | null;
}) {
  const shown = useCountUp(value, reduce);
  return (
    <div className={`people-dim ${top ? 'is-top' : ''}`}>
      <div className="people-dim-row">
        <span className="people-dim-name">
          <span className="people-dim-dot" style={{ background: color }} />
          {label}
        </span>
        <span className="people-dim-val" style={{ color }}>{shown}</span>
      </div>
      <div className="people-dim-track">
        <motion.div
          className="people-dim-fill"
          style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
          initial={reduce ? false : { width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={reduce ? { duration: 0 } : { duration: 0.85, delay: 0.07 * index, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>
    </div>
  );
}

/* Один нумерованный редакционный раздел без цветной карточки. */
function CompatBlock({ title, number, index, reduce, children }: {
  title: string; number: number; index: number; reduce: boolean | null; children?: string | null;
}) {
  if (!children) return null;
  return (
    <motion.section
      className="compat-read-block"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.05 * index, ease: [0.22, 1, 0.36, 1] }}
    >
      <EditorialSectionHeading number={number} title={title} className="compat-read-heading" />
      <EditorialProse text={children} className="compat-read-text" />
    </motion.section>
  );
}

/* ── Кольцо-score: заполнение дуги + счёт ── */
function ScoreRing({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const r = 46;
  const circ = 2 * Math.PI * r;
  const [shown, setShown] = useState(reduce ? value : 0);

  useEffect(() => {
    if (reduce) { setShown(value); return; }
    let raf = 0;
    const t0 = performance.now();
    const dur = 900;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduce]);

  return (
    <div className="people-ring">
      <svg viewBox="0 0 110 110" width="104" height="104">
        <circle cx="55" cy="55" r={r} fill="none" stroke="var(--fresh-border)" strokeWidth="9" />
        <motion.circle
          cx="55" cy="55" r={r} fill="none" stroke="var(--fresh-link)" strokeWidth="9" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - value / 100) }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, ease: 'easeOut' }}
          transform="rotate(-90 55 55)"
        />
      </svg>
      <div className="people-ring-num">{shown}</div>
    </div>
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

  const [screen, setScreen] = useState<'hub' | 'add' | 'result'>(initialPrefill ? 'result' : 'hub');
  const [people, setPeople] = useState<ChartListItem[]>([]);
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

  const [fName, setFName] = useState(''); const [fDate, setFDate] = useState(''); const [fTime, setFTime] = useState(''); const [fPlace, setFPlace] = useState(''); const [fGender, setFGender] = useState<CompatGender>(initialThemGender);

  const [signText, setSignText] = useState<SignCompatibilityResult | null>(null);
  const [deep, setDeep] = useState<SynastryResult | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.id) return;
    void getCharts(profile.id).then((d) => setPeople((d.charts || []).filter((c) => !c.is_primary))).catch(() => setPeople([]));
  }, [profile.id]);

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
        <AppTopBar title={ru ? 'Совместимость' : 'Compatibility'} />
        <p className="compat-hub-intro">
          {ru ? 'Сравни по знакам за секунду — или разбери конкретного человека по дате рождения.' : 'Compare by signs in a second — or read a specific person by birth date.'}
        </p>
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
              <GenderToggle value={youGender} onChange={setYouGender} ru={ru} />
            </div>
            <span className="compat-x">×</span>
            <div className={`compat-pick ${activeSide === 'them' ? 'is-active' : ''}`}>
              <button type="button" className="compat-chip compat-chip--them" onClick={() => { lumiaSelectionHaptic(); setActiveSide('them'); }}>
                <ZodiacIcon sign={pickSign} size={18} /> {getZodiacSign(lang, pickSign)}
              </button>
              <GenderToggle value={themGender} onChange={setThemGender} ru={ru} />
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
        <AppTopBar
          title={ru ? 'Кто это?' : 'Who is this?'}
          onBack={() => { lumiaSelectionHaptic(); setScreen('hub'); }}
        />

        <RelationshipContextPicker
          value={relationshipContext}
          onChange={setRelationshipContext}
          ru={ru}
          compact
        />

        <div className="union-form" style={{ marginTop: 6 }}>
          <div>
            <label className="fresh-field-label">{ru ? 'Имя' : 'Name'}</label>
            <input className="fresh-input" value={fName} onChange={(e) => setFName(e.target.value)} placeholder={ru ? 'Например, Аня' : 'e.g. Alex'} />
          </div>
          <div>
            <label className="fresh-field-label">{ru ? 'Дата рождения' : 'Birth date'}</label>
            <input className="fresh-input" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
          </div>
          <div>
            <label className="fresh-field-label">{ru ? 'Пол' : 'Gender'}</label>
            <div style={{ marginTop: 6 }}><GenderToggle value={fGender} onChange={setFGender} ru={ru} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label className="fresh-field-label">{ru ? 'Время (если есть)' : 'Time (optional)'}</label>
              <input className="fresh-input" type="time" value={fTime} onChange={(e) => setFTime(e.target.value)} />
            </div>
            <div>
              <label className="fresh-field-label">{ru ? 'Место (если есть)' : 'Place (optional)'}</label>
              <input className="fresh-input" value={fPlace} onChange={(e) => setFPlace(e.target.value)} placeholder={ru ? 'Город' : 'City'} />
            </div>
          </div>
          <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--fresh-muted)' }}>
            {ru ? 'Хватит даты — базовый разбор готов сразу. Со временем и местом разбор точнее.' : 'A date is enough for a basic reading. Time and place make it more precise.'}
          </p>
        </div>
        {error ? <p className="union-pad" style={{ color: '#B91C1C', fontSize: 14, marginTop: 12 }}>{error}</p> : null}
        <button type="button" className="fresh-btn-primary" style={{ marginTop: 16 }} onClick={submitAdd}>
          {ru ? 'Посмотреть' : 'See it'}
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

  return (
    <div className="fresh-page compat-editorial-page compat-editorial-page--result">
      <AppTopBar
        title={theirName}
        onBack={() => { lumiaSelectionHaptic(); setScreen('hub'); }}
      />

      <div className="compat-result-context">
        {ru ? 'Смотрим' : 'Context'} · <strong>{resultContextLabel}</strong>
      </div>

      {score ? (
        <EditorialSummary
          label={ru ? 'Главный вывод' : 'Main takeaway'}
          title={score.verdict}
          className="compat-main-conclusion"
        >
          <p><strong>{ru ? 'Сильнее всего:' : 'Strongest:'}</strong> {strongestLabel}</p>
        </EditorialSummary>
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

      {resultSticker ? (
        <EditorialSticker
          asset={resultSticker}
          className="compat-result-sticker"
          priority
        />
      ) : null}

      <section className="compat-technical-data" aria-label={ru ? 'Данные сравнения' : 'Comparison data'}>
        <div className="editorial-reading-panel-label">{ru ? 'Данные сравнения' : 'Comparison data'}</div>
        <div className="people-split">
          <motion.div className="people-side" initial={reduce ? false : { x: -22, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
            <div className="people-side-ico"><ZodiacIcon sign={leftSun} size={32} strokeWidth={1.4} /></div>
            <div className="people-side-name">{ru ? 'Вы' : 'You'}</div>
            <div className="people-side-sign">{genderWord(leftGender, ru)} · {getZodiacSign(lang, leftSun)}</div>
          </motion.div>

          <div className="people-center">
            {score ? <ScoreRing value={score.overall} /> : null}
          </div>

          <motion.div className="people-side" initial={reduce ? false : { x: 22, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
            <div className="people-side-ico"><ZodiacIcon sign={theirSun} size={32} strokeWidth={1.4} /></div>
            <div className="people-side-name">{theirName}</div>
            <div className="people-side-sign">{genderWord(rightGender, ru)} · {getZodiacSign(lang, theirSun)}</div>
          </motion.div>
        </div>

        <div className="people-dims">
          {dimsOrder.map((k, i) => (
            <DimBar
              key={k}
              label={DIMENSION_LABELS[k][lang]}
              value={score?.dims[k] ?? 0}
              color={DIM_COLORS[k]}
              top={!!score && k === score.strongest}
              index={i}
              reduce={reduce}
            />
          ))}
        </div>
      </section>

      {signText ? (
        <div className="compat-read" style={{ marginTop: 14 }}>
          <CompatBlock title={resultTitles[0]} number={1} index={0} reduce={reduce}>{signText.attraction}</CompatBlock>
          <CompatBlock title={resultTitles[1]} number={2} index={1} reduce={reduce}>{signText.difficulty}</CompatBlock>
          <CompatBlock title={resultTitles[2]} number={3} index={2} reduce={reduce}>{signText.communication}</CompatBlock>
        </div>
      ) : (
        <p className="union-pad" style={{ marginTop: 12, color: 'var(--fresh-muted)', fontSize: 14 }}>{ru ? 'Готовим разбор…' : 'Preparing…'}</p>
      )}

      {deep ? (
        <div className="compat-read" style={{ marginTop: 18 }}>
          <CompatBlock title={resultDeepTitles[1]} number={4} index={0} reduce={reduce}>{deep.fullAnalysis?.attraction}</CompatBlock>
          <CompatBlock title={resultDeepTitles[2]} number={5} index={1} reduce={reduce}>{deep.fullAnalysis?.difficulties}</CompatBlock>
          <CompatBlock title={resultDeepTitles[3]} number={6} index={2} reduce={reduce}>{deep.fullAnalysis?.potential}</CompatBlock>
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

      {error ? <p className="union-pad" style={{ color: '#B91C1C', fontSize: 14, marginTop: 12 }}>{error}</p> : null}

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
