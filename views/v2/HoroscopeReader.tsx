import React, { memo, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, type PanInfo } from 'framer-motion';
import type { ForecastDailyReading, NatalChartData, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { getMoscowTodayKey, getMoscowIsoWeekKey, formatLumiaDate } from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { hasActivePremium, hasNatalChart } from '../../lib/accessMatrix';
import {
  getCachedDailySignHoroscope,
  ensureDailySignHoroscope,
  getCachedWeeklySignHoroscope,
  ensureWeeklySignHoroscope,
} from '../../services/astrologyService';
import { saveProfile } from '../../services/storageService';
import { MonoArticleSection, MonoShareBar, MonoTag } from '../../components/mono-ui';
import { FreshTabs, FreshSignCarousel } from '../../components/fresh-ui';
import { ZodiacIcon } from '../../components/icons/ZodiacIcon';
import { ChevronRightIcon } from '../../components/icons/UiIcons';
import { ZODIAC_KEYS, type ZodiacKey } from '../../lib/horoscope/signDaily';

const LOCAL_SIGN_KEY = 'lumia:selected-zodiac-sign';

type Period = 'today' | 'tomorrow' | 'week';

export type HoroscopeReaderProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onOpenPersonalDaily?: () => void;
  onRequestPremium?: () => void;
};

/* Цвет карточки по стихии знака (без космоса — просто палитра) */
const ELEMENT_COLOR: Record<string, string> = {
  aries: 'var(--fresh-coral)', leo: 'var(--fresh-coral)', sagittarius: 'var(--fresh-coral)',
  taurus: 'var(--fresh-mint)', virgo: 'var(--fresh-mint)', capricorn: 'var(--fresh-mint)',
  gemini: 'var(--fresh-sky)', libra: 'var(--fresh-sky)', aquarius: 'var(--fresh-sky)',
  cancer: 'var(--fresh-lavender)', scorpio: 'var(--fresh-lavender)', pisces: 'var(--fresh-lavender)',
};

/* +N дней к ключу даты YYYY-MM-DD (в UTC) */
function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

const cardVariants = {
  enter: (d: number) => ({ x: d > 0 ? 300 : d < 0 ? -300 : 0, opacity: 0, rotate: d > 0 ? 5 : d < 0 ? -5 : 0 }),
  center: { x: 0, opacity: 1, rotate: 0 },
  exit: (d: number) => ({ x: d > 0 ? -300 : d < 0 ? 300 : 0, opacity: 0, rotate: d > 0 ? -5 : d < 0 ? 5 : 0 }),
};

export const HoroscopeReader = memo<HoroscopeReaderProps>(({
  profile,
  chartData,
  chartId,
  onUpdateProfile,
  onOpenChart,
  onOpenPersonalDaily,
  onRequestPremium,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const today = useMemo(() => getMoscowTodayKey(), []);
  const reduce = useReducedMotion();

  const initialIndex = useMemo(() => {
    const fromProfile = String(profile.selectedZodiacSign || chartData?.sun?.sign || '').trim().toLowerCase();
    const idx = ZODIAC_KEYS.findIndex((s) => s.toLowerCase() === fromProfile);
    return idx >= 0 ? idx : 0;
  }, [profile.selectedZodiacSign, chartData]);

  const [signIndex, setSignIndex] = useState(initialIndex);
  const [dir, setDir] = useState(0);
  const [period, setPeriod] = useState<Period>('today');
  const [readings, setReadings] = useState<Record<string, ForecastDailyReading | null>>({});

  useEffect(() => { setSignIndex(initialIndex); }, [initialIndex]);

  const sign = ZODIAC_KEYS[signIndex] as ZodiacKey;
  const keyOf = (s: string, p: Period) => `${s.toLowerCase()}|${p}`;
  const currentKey = keyOf(sign, period);
  const reading = readings[currentKey];
  const loading = reading === undefined;

  /* Загрузка текущего знака + префетч соседей (свайп ощущается мгновенным) */
  useEffect(() => {
    let alive = true;
    const loadFor = async (s: string, p: Period) => {
      const kk = keyOf(s, p);
      let already = false;
      setReadings((prev) => { already = kk in prev; return prev; });
      if (already) return;
      try {
        const r = p === 'week'
          ? (await getCachedWeeklySignHoroscope(s, getMoscowIsoWeekKey(), language)) || await ensureWeeklySignHoroscope(s, getMoscowIsoWeekKey(), language)
          : (await getCachedDailySignHoroscope(s, p === 'tomorrow' ? addDaysKey(today, 1) : today, language)) || await ensureDailySignHoroscope(s, p === 'tomorrow' ? addDaysKey(today, 1) : today, language);
        if (alive) setReadings((prev) => ({ ...prev, [kk]: r }));
      } catch {
        if (alive) setReadings((prev) => ({ ...prev, [kk]: null }));
      }
    };
    void loadFor(sign, period);
    void loadFor(ZODIAC_KEYS[(signIndex + 1) % 12], period);
    void loadFor(ZODIAC_KEYS[(signIndex + 11) % 12], period);
    return () => { alive = false; };
  }, [signIndex, sign, period, language, today]);

  const goToIndex = (next: number, direction: number) => {
    lumiaSelectionHaptic();
    setDir(direction);
    setSignIndex((next + 12) % 12);
    const normalized = ZODIAC_KEYS[(next + 12) % 12];
    try { window.localStorage.setItem(LOCAL_SIGN_KEY, normalized); } catch { /* optional */ }
    const updated = { ...profile, selectedZodiacSign: normalized };
    onUpdateProfile?.(updated);
    if (updated.id) void saveProfile(updated).catch(() => undefined);
  };

  const paginate = (delta: number) => goToIndex(signIndex + delta, delta);

  const chooseSign = (picked: string) => {
    const idx = ZODIAC_KEYS.findIndex((s) => s.toLowerCase() === picked.toLowerCase());
    if (idx < 0 || idx === signIndex) return;
    goToIndex(idx, idx > signIndex ? 1 : -1);
  };

  const onDragEnd = (_e: unknown, info: PanInfo) => {
    const power = info.offset.x + info.velocity.x * 0.2;
    if (power < -70) paginate(1);
    else if (power > 70) paginate(-1);
  };

  const signLabel = getZodiacSign(language, sign);

  const periodTabs = useMemo(() => ([
    { id: 'today', label: language === 'ru' ? 'Сегодня' : 'Today' },
    { id: 'tomorrow', label: language === 'ru' ? 'Завтра' : 'Tomorrow' },
    { id: 'week', label: language === 'ru' ? 'Неделя' : 'Week' },
  ]), [language]);

  const periodLabel = period === 'today'
    ? (language === 'ru' ? 'Сегодня' : 'Today')
    : period === 'tomorrow'
      ? (language === 'ru' ? 'Завтра' : 'Tomorrow')
      : (language === 'ru' ? 'Неделя' : 'This week');

  const periodDateLabel = period === 'week'
    ? (language === 'ru' ? 'На этой неделе' : 'This week')
    : formatLumiaDate(period === 'tomorrow' ? addDaysKey(today, 1) : today, language);

  /* Личный день — доступ по карте + Premium */
  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
  const premium = hasActivePremium(profile);
  const personalSubtitle = !hasChart
    ? (language === 'ru' ? 'Создайте натальную карту' : 'Create a natal chart')
    : !premium
      ? (language === 'ru' ? 'Доступно в Premium' : 'Available in Premium')
      : (language === 'ru' ? 'Разбор вашего дня по карте' : 'Your day, read from your chart');
  const personalCta = !hasChart
    ? (language === 'ru' ? 'Создать карту' : 'Create chart')
    : !premium
      ? (language === 'ru' ? 'Открыть Premium' : 'Open Premium')
      : (language === 'ru' ? 'Открыть' : 'Open');

  const openPersonal = () => {
    lumiaSelectionHaptic();
    if (hasChart && premium) onOpenPersonalDaily?.();
    else if (!hasChart) onOpenChart?.();
    else onRequestPremium?.();
  };

  return (
    <div className="fresh-page">
      {/* Заголовок */}
      <div className="fresh-page-title-block">
        <div className="fresh-page-kicker">
          {language === 'ru' ? 'Гороскоп' : 'Horoscope'} · {periodLabel}
        </div>
        <div className="fresh-page-title">{signLabel}</div>
      </div>

      {/* Лента знаков */}
      <FreshSignCarousel signs={ZODIAC_KEYS} active={sign} language={language} onPick={chooseSign} />

      {/* Период */}
      <FreshTabs
        tabs={periodTabs}
        activeTab={period}
        onTabChange={(id) => { lumiaSelectionHaptic(); setDir(0); setPeriod(id as Period); }}
      />

      {/* Свайп-колода: карточка знака */}
      <div className="horo-deck">
        <div className="horo-deck-ghost" aria-hidden />
        <AnimatePresence custom={dir} initial={false} mode="popLayout">
          <motion.div
            key={currentKey}
            className="horo-card"
            style={{ background: ELEMENT_COLOR[sign.toLowerCase()] || 'var(--fresh-sky)' }}
            custom={dir}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 34 }}
            drag={reduce ? false : 'x'}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={onDragEnd}
          >
            <div className="fresh-hero-chip" style={{ top: 14, right: 14 }}>{periodLabel}</div>
            <div className="fresh-hero-icon" aria-hidden><ZodiacIcon sign={sign} size={80} strokeWidth={1.1} /></div>
            {reading?.headline ? <div className="fresh-sticky" style={{ transform: 'rotate(-2deg)' }}>{reading.headline}</div> : null}
            <div className="fresh-hero-soft">{periodDateLabel}</div>
          </motion.div>
        </AnimatePresence>

        <button type="button" className="horo-nav horo-nav-prev" aria-label={language === 'ru' ? 'Предыдущий знак' : 'Previous sign'} onClick={() => paginate(-1)}>
          <span style={{ transform: 'rotate(180deg)', display: 'flex' }}><ChevronRightIcon size={18} /></span>
        </button>
        <button type="button" className="horo-nav horo-nav-next" aria-label={language === 'ru' ? 'Следующий знак' : 'Next sign'} onClick={() => paginate(1)}>
          <ChevronRightIcon size={18} />
        </button>
      </div>

      <div className="horo-hint">{language === 'ru' ? 'Свайп ← → меняет знак' : 'Swipe ← → to change sign'}</div>

      {/* Текст разбора (плавная смена) */}
      <AnimatePresence mode="wait">
        <motion.article
          key={currentKey}
          style={{ padding: '2px 20px 8px' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--fresh-text)', margin: 0 }}>
            {loading ? (language === 'ru' ? 'Готовим разбор…' : 'Preparing reading…') : reading?.summary}
          </p>

          {!loading && reading ? (
            <div className="space-y-4" style={{ marginTop: 24 }}>
              {reading.reading ? <MonoArticleSection title={language === 'ru' ? 'Подробнее' : 'More'}>{reading.reading}</MonoArticleSection> : null}
              {reading.focus ? <MonoArticleSection title={language === 'ru' ? 'Фокус' : 'Focus'}>{reading.focus}</MonoArticleSection> : null}
              {reading.chance ? <MonoArticleSection title={language === 'ru' ? 'Шанс' : 'Opportunity'}>{reading.chance}</MonoArticleSection> : null}
              {reading.risk ? <MonoArticleSection title={language === 'ru' ? 'Осторожно' : 'Watch out'}>{reading.risk}</MonoArticleSection> : null}
              {reading.advice?.length ? (
                <MonoArticleSection title={language === 'ru' ? 'Советы' : 'Advice'}>
                  <ul className="space-y-2">{reading.advice.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
                </MonoArticleSection>
              ) : null}
            </div>
          ) : null}

          <div style={{ marginTop: 24, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <MonoTag>{signLabel}</MonoTag>
            <MonoTag>{periodLabel}</MonoTag>
          </div>
        </motion.article>
      </AnimatePresence>

      {/* Личный день — переехал сюда из натальной карты */}
      <div style={{ padding: '6px 20px 28px' }}>
        <button
          type="button"
          onClick={openPersonal}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            background: 'var(--fresh-surface)', border: 'none',
            borderRadius: 'var(--fresh-radius-card)', padding: 16, textAlign: 'left', cursor: 'pointer',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fresh-text)', marginBottom: 4 }}>
              {language === 'ru' ? 'Личный день' : 'Personal day'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fresh-muted)' }}>{personalSubtitle}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fresh-link)', marginTop: 8 }}>{personalCta} →</div>
          </div>
          <div style={{ color: 'var(--fresh-muted)', flexShrink: 0 }}><ChevronRightIcon size={20} /></div>
        </button>
      </div>

      <MonoShareBar
        label={language === 'ru' ? 'Поделиться' : 'Share'}
        withTabClearance
        onShare={() => {
          try {
            const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } })
              .Telegram?.WebApp;
            tg?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent('https://t.me/lumia_astrology_bot')}`);
          } catch {
            /* optional */
          }
        }}
      />
    </div>
  );
});

HoroscopeReader.displayName = 'HoroscopeReader';
