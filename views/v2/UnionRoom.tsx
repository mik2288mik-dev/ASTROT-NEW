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
import { FreshSignWheel } from '../../components/fresh-ui';
import { ZODIAC_KEYS } from '../../lib/horoscope/signDaily';
import { shareToTelegram } from '../../lib/botLink';
import { HoroscopeActivityBar } from '../../components/Horoscope/HoroscopeActivityBar';
import { loadCompatHistory, addCompatHistory, removeCompatHistory, buildCompatHistoryId, type CompatHistoryEntry } from '../../lib/compatHistory';

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

type Selected = { kind: 'sign' | 'person'; sign?: string; name?: string; date?: string; time?: string; place?: string; chartId?: number };

const REL_BACKEND: Record<CompatDimension, string> = {
  love: 'любовь', relationship: 'отношения', friendship: 'дружба', work: 'работа',
};

/* Цвет на каждую сферу — шкалы становятся красочными и читаемыми */
const DIM_COLORS: Record<CompatDimension, string> = {
  love: '#FF7E8B',          // тёплый коралл
  relationship: '#A98CEC',  // лаванда
  friendship: '#5BB6EC',    // небо
  work: '#34C39A',          // мята
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

/* Блок разбора — просто текст с цветным заголовком, без рамок-«окон» */
function CompatBlock({ title, color, index, reduce, children }: {
  title: string; color: string; index: number; reduce: boolean | null; children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <motion.section
      className="compat-read-block"
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.4, delay: 0.05 * index, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="compat-read-title" style={{ color }}>{title}</div>
      <p className="compat-read-text">{children}</p>
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

  const [screen, setScreen] = useState<'hub' | 'add' | 'result'>(initialPrefill ? 'result' : 'hub');
  const [people, setPeople] = useState<ChartListItem[]>([]);
  const [history, setHistory] = useState<CompatHistoryEntry[]>([]);
  const [pickSign, setPickSign] = useState<string>(() => ZODIAC_KEYS.find((s) => s.toLowerCase() !== yourSun) || ZODIAC_KEYS[0]);
  const [selected, setSelected] = useState<Selected | null>(
    initialPrefill
      ? { kind: 'person', name: initialPrefill.partnerName || '', date: toDateInputValue(initialPrefill.partnerDate || ''), time: initialPrefill.partnerTime, place: initialPrefill.partnerPlace, chartId: initialPrefill.partnerChartId }
      : null,
  );

  const [fName, setFName] = useState(''); const [fDate, setFDate] = useState(''); const [fTime, setFTime] = useState(''); const [fPlace, setFPlace] = useState('');

  const [signText, setSignText] = useState<SignCompatibilityResult | null>(null);
  const [deep, setDeep] = useState<SynastryResult | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.id) return;
    void getCharts(profile.id).then((d) => setPeople((d.charts || []).filter((c) => !c.is_primary))).catch(() => setPeople([]));
  }, [profile.id]);

  useEffect(() => { setHistory(loadCompatHistory()); }, []);

  const theirSun = selected ? (selected.kind === 'sign' ? String(selected.sign).toLowerCase() : (sunSignFromDate(selected.date) || 'libra')) : 'libra';
  const score: CompatResult | null = selected ? getCompatScore(yourSun, theirSun, lang) : null;
  const theirName = selected ? (selected.kind === 'sign' ? getZodiacSign(lang, theirSun) : (selected.name || (ru ? 'Человек' : 'Person'))) : '';

  useEffect(() => {
    if (screen !== 'result' || !selected) return;
    setSignText(null); setDeep(null); setError(null);
    let alive = true;
    void getSignCompatibility(yourSun, theirSun, lang)
      .then((r) => { if (alive) setSignText(r); })
      .catch(() => { /* optional */ });
    return () => { alive = false; };
  }, [screen, selected, yourSun, theirSun, lang]);

  const sunOf = (s: Selected) => (s.kind === 'sign' ? String(s.sign).toLowerCase() : (sunSignFromDate(s.date) || 'libra'));

  const openResult = (s: Selected) => {
    lumiaSelectionHaptic();
    setSelected(s);
    setScreen('result');
    const their = sunOf(s);
    const sc = getCompatScore(yourSun, their, lang);
    setHistory(addCompatHistory({
      id: buildCompatHistoryId(s.kind, s.sign, s.name, s.date),
      kind: s.kind, sign: s.sign, name: s.name, date: s.date, time: s.time, place: s.place, chartId: s.chartId,
      yourSun, theirSun: their, overall: sc.overall, ts: Date.now(),
    }));
  };

  const openFromHistory = (e: CompatHistoryEntry) => {
    if (e.kind === 'sign') openResult({ kind: 'sign', sign: e.sign });
    else openResult({ kind: 'person', name: e.name, date: e.date, time: e.time, place: e.place, chartId: e.chartId });
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
      ? `Совместимость с ${them}: ${score.overall}/100 — ${score.verdict}. Сильнее всего — ${strong}.\n\nПроверь свою совместимость в Lumia.`
      : `Compatibility with ${them}: ${score.overall}/100 — ${score.verdict}. Strongest — ${strong}.\n\nCheck yours in Lumia.`;
    shareToTelegram(text);
  };

  const submitAdd = () => {
    if (!fName.trim() || !fDate) { setError(ru ? 'Добавь имя и дату рождения.' : 'Add a name and birth date.'); return; }
    setError(null);
    openResult({ kind: 'person', name: fName.trim(), date: fDate, time: fTime || undefined, place: fPlace || undefined });
  };

  const runDeep = async () => {
    if (!selected || selected.kind !== 'person' || !score) return;
    if (!hasChart) { onCreateNatalChart?.(); return; }
    if (!premium) { requestPremium(); return; }
    setDeepLoading(true); setError(null);
    try {
      const out = await calculateExtendedSynastry(profile, selected.name || '', selected.date || '', selected.time, selected.place, REL_BACKEND[score.strongest], selected.chartId);
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
      <div className="fresh-page">
        <div className="fresh-page-title-block" style={{ paddingTop: 0, paddingBottom: 6 }}>
          <div className="fresh-page-title">{ru ? 'Совместимость' : 'Compatibility'}</div>
        </div>
        <p style={{ padding: '0 20px 16px', fontSize: 14, lineHeight: 1.5, color: 'var(--fresh-muted)' }}>
          {ru ? 'Сравни по знакам за секунду — или разбери конкретного человека по дате рождения.' : 'Compare by signs in a second — or read a specific person by birth date.'}
        </p>

        {/* Быстро по знакам */}
        <div className="compat-quick">
          <div className="compat-quick-head">{ru ? 'По знакам · быстро' : 'By signs · quick'}</div>
          <div className="compat-pair">
            <span className="compat-chip"><ZodiacIcon sign={yourSun} size={18} /> {ru ? 'Ты' : 'You'} · {getZodiacSign(lang, yourSun)}</span>
            <span className="compat-x">×</span>
            <span className="compat-chip compat-chip--them"><ZodiacIcon sign={pickSign} size={18} /> {getZodiacSign(lang, pickSign)}</span>
          </div>
          <FreshSignWheel signs={ZODIAC_KEYS} active={pickSign} language={profile.language} onPick={(s) => { lumiaSelectionHaptic(); setPickSign(s); }} />
          <button type="button" className="fresh-btn-primary" style={{ margin: '4px 0 0', width: '100%' }} onClick={() => openResult({ kind: 'sign', sign: pickSign })}>
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
                    <span className="compat-hist-sub">{e.kind === 'person' ? getZodiacSign(lang, e.theirSun) : (ru ? 'по знаку' : 'by sign')}</span>
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
                  <button key={c.id} type="button" className="people-card" onClick={() => openResult({ kind: 'person', name: c.name, date: toDateInputValue(c.birth_date), time: c.birth_time || undefined, place: c.birth_place || undefined, chartId: c.id })}>
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
      <div className="fresh-page">
        <div className="fresh-inner-header">
          <button className="fresh-back-btn" type="button" aria-label={ru ? 'Назад' : 'Back'} onClick={() => { lumiaSelectionHaptic(); setScreen('hub'); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="fresh-inner-title" style={{ flex: 1, textAlign: 'center' }}>{ru ? 'Кто это?' : 'Who is this?'}</div>
          <div style={{ width: 34 }} />
        </div>

        <div className="union-form" style={{ marginTop: 6 }}>
          <div>
            <label className="fresh-field-label">{ru ? 'Имя' : 'Name'}</label>
            <input className="fresh-input" value={fName} onChange={(e) => setFName(e.target.value)} placeholder={ru ? 'Например, Аня' : 'e.g. Alex'} />
          </div>
          <div>
            <label className="fresh-field-label">{ru ? 'Дата рождения' : 'Birth date'}</label>
            <input className="fresh-input" type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
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

  return (
    <div className="fresh-page">
      <div className="fresh-inner-header">
        <button className="fresh-back-btn" type="button" aria-label={ru ? 'Назад' : 'Back'} onClick={() => { lumiaSelectionHaptic(); setScreen('hub'); }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8L10 13" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="fresh-inner-title" style={{ flex: 1, textAlign: 'center' }}>{theirName}</div>
        <div style={{ width: 34 }} />
      </div>

      <div className="people-split">
        <motion.div className="people-side" initial={reduce ? false : { x: -22, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
          <div className="people-side-ico"><ZodiacIcon sign={yourSun} size={32} strokeWidth={1.4} /></div>
          <div className="people-side-name">{ru ? 'Вы' : 'You'}</div>
          <div className="people-side-sign">{getZodiacSign(lang, yourSun)}</div>
        </motion.div>

        <div className="people-center">
          {score ? <ScoreRing value={score.overall} /> : null}
          <div className="people-verdict">{score?.verdict}</div>
        </div>

        <motion.div className="people-side" initial={reduce ? false : { x: 22, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.4, ease: 'easeOut' }}>
          <div className="people-side-ico"><ZodiacIcon sign={theirSun} size={32} strokeWidth={1.4} /></div>
          <div className="people-side-name">{theirName}</div>
          <div className="people-side-sign">{getZodiacSign(lang, theirSun)}</div>
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
      <div className="people-strong">{ru ? 'Сильнее всего' : 'Strongest'} — {strongestLabel}</div>

      {signText ? (
        <div className="compat-read" style={{ marginTop: 14 }}>
          <CompatBlock title={ru ? 'Почему вас тянет друг к другу' : "Why you're drawn to each other"} color={DIM_COLORS.love} index={0} reduce={reduce}>{signText.attraction}</CompatBlock>
          <CompatBlock title={ru ? 'Что может быть непросто' : 'What can get tricky'} color={DIM_COLORS.relationship} index={1} reduce={reduce}>{signText.difficulty}</CompatBlock>
          <CompatBlock title={ru ? 'Как лучше понимать друг друга' : 'How to understand each other'} color={DIM_COLORS.friendship} index={2} reduce={reduce}>{signText.communication}</CompatBlock>
        </div>
      ) : (
        <p className="union-pad" style={{ marginTop: 12, color: 'var(--fresh-muted)', fontSize: 14 }}>{ru ? 'Готовим разбор…' : 'Preparing…'}</p>
      )}

      {deep ? (
        <div className="compat-read" style={{ marginTop: 18 }}>
          <CompatBlock title={ru ? 'Какая у вас связь' : 'What your bond is like'} color={DIM_COLORS.work} index={0} reduce={reduce}>{deep.summary}</CompatBlock>
          <CompatBlock title={ru ? 'Что вас сближает' : 'What brings you closer'} color={DIM_COLORS.love} index={1} reduce={reduce}>{deep.fullAnalysis?.attraction}</CompatBlock>
          <CompatBlock title={ru ? 'Из-за чего бывают трения' : 'Where friction comes from'} color={DIM_COLORS.relationship} index={2} reduce={reduce}>{deep.fullAnalysis?.difficulties}</CompatBlock>
          <CompatBlock title={ru ? 'Что сделает вас крепче' : 'What makes you stronger'} color={DIM_COLORS.friendship} index={3} reduce={reduce}>{deep.fullAnalysis?.potential}</CompatBlock>
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
          sign={`${yourSun}_${theirSun}`}
          date="2000-01-01"
          language={lang}
          onShare={shareCompat}
        />
      </div>

      <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }} />
    </div>
  );
}
