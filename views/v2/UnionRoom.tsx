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
import { FreshSignCarousel } from '../../components/fresh-ui';
import { MonoArticleSection } from '../../components/mono-ui';
import { ZODIAC_KEYS } from '../../lib/horoscope/signDaily';

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

  const openResult = (s: Selected) => { lumiaSelectionHaptic(); setSelected(s); setScreen('result'); };

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
          <FreshSignCarousel signs={ZODIAC_KEYS} active={pickSign} language={profile.language} onPick={(s) => { lumiaSelectionHaptic(); setPickSign(s); }} />
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
          <div key={k} className={`people-dim ${score && k === score.strongest ? 'is-top' : ''}`}>
            <div className="people-dim-row">
              <span>{DIMENSION_LABELS[k][lang]}</span>
              <span className="people-dim-val">{score?.dims[k]}</span>
            </div>
            <div className="people-dim-track">
              <motion.div className="people-dim-fill" initial={reduce ? false : { width: 0 }} animate={{ width: `${score?.dims[k] ?? 0}%` }} transition={reduce ? { duration: 0 } : { duration: 0.7, delay: 0.08 * i, ease: 'easeOut' }} />
            </div>
          </div>
        ))}
      </div>
      <div className="people-strong">{ru ? 'Сильнее всего' : 'Strongest'} — {strongestLabel}</div>

      {signText ? (
        <div className="union-pad space-y-3" style={{ marginTop: 8 }}>
          <MonoArticleSection title={ru ? 'Что вас тянет' : 'What draws you'}>{signText.attraction}</MonoArticleSection>
          <MonoArticleSection title={ru ? 'Где может быть сложно' : 'Where it gets hard'}>{signText.difficulty}</MonoArticleSection>
          <MonoArticleSection title={ru ? 'Как лучше общаться' : 'How to communicate'}>{signText.communication}</MonoArticleSection>
        </div>
      ) : (
        <p className="union-pad" style={{ marginTop: 8, color: 'var(--fresh-muted)', fontSize: 14 }}>{ru ? 'Готовим разбор…' : 'Preparing…'}</p>
      )}

      {deep ? (
        <div className="union-pad space-y-3" style={{ marginTop: 14 }}>
          <MonoArticleSection title={ru ? 'Как ощущается ваша связь' : 'How your bond feels'}>{deep.summary}</MonoArticleSection>
          <MonoArticleSection title={ru ? 'Что вас притягивает' : 'What draws you'}>{deep.fullAnalysis?.attraction}</MonoArticleSection>
          <MonoArticleSection title={ru ? 'Где вы задеваете друг друга' : 'Where you trigger each other'}>{deep.fullAnalysis?.difficulties}</MonoArticleSection>
          <MonoArticleSection title={ru ? 'Что может укрепить связь' : 'What can strengthen it'}>{deep.fullAnalysis?.potential}</MonoArticleSection>
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

      <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 24px)' }} />
    </div>
  );
}
