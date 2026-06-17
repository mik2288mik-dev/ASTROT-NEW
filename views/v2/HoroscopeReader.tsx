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
import { MonoShareBar } from '../../components/mono-ui';
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

  /* Поделиться самим разбором (а не ссылкой на бота) */
  const shareReading = () => {
    const parts = [`${signLabel} · ${periodLabel}`];
    if (reading?.headline) parts.push(reading.headline);
    if (reading?.summary) parts.push(reading.summary);
    if (reading?.advice?.length) {
      parts.push((language === 'ru' ? 'Советы:' : 'Advice:') + '\n' + reading.advice.slice(0, 3).map((a) => `• ${a}`).join('\n'));
    }
    const text = parts.join('\n\n');
    try {
      const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp;
      const url = 'https://t.me/lumia_astrology_bot';
      tg?.openTelegramLink?.(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
    } catch {
      /* optional */
    }
  };

  return (
    <div className="fresh-page">
      {/* Заголовок — по центру, компактно */}
      <div className="fresh-page-title-block" style={{ textAlign: 'center', paddingTop: 0, paddingBottom: 12 }}>
        <div className="fresh-page-kicker">
          {language === 'ru' ? 'Гороскоп' : 'Horoscope'} · {periodDateLabel}
        </div>
        <div className="fresh-page-title">{signLabel}</div>
      </div>

      {/* Личный день — премиум-карточка наверху (это то, что продаём) */}
      <button type="button" className="horo-premium" onClick={openPersonal}>
        <div className="horo-premium-text">
          <div className="horo-premium-kicker">{language === 'ru' ? 'Личный день' : 'Personal day'}</div>
          <div className="horo-premium-title">{personalSubtitle}</div>
        </div>
        <span className="horo-premium-cta">{personalCta}<ChevronRightIcon size={15} /></span>
      </button>

      {/* Лента знаков */}
      <FreshSignCarousel signs={ZODIAC_KEYS} active={sign} language={language} onPick={chooseSign} />

      {/* Период */}
      <FreshTabs
        tabs={periodTabs}
        activeTab={period}
        onTabChange={(id) => { lumiaSelectionHaptic(); setDir(0); setPeriod(id as Period); }}
      />

      {/* Единая свайп-карточка: весь гороскоп + советы вместе (свайп ← → меняет знак) */}
      <div className="horo-uni-wrap">
        <AnimatePresence custom={dir} initial={false} mode="popLayout">
          <motion.div
            key={currentKey}
            className="horo-uni"
            custom={dir}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 34 }}
            drag={reduce ? false : 'x'}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={onDragEnd}
          >
            <div className="horo-uni-hero" style={{ background: ELEMENT_COLOR[sign.toLowerCase()] || 'var(--fresh-sky)' }}>
              <div className="fresh-hero-chip" style={{ top: 14, right: 14 }}>{periodLabel}</div>
              <div className="fresh-hero-icon" aria-hidden><ZodiacIcon sign={sign} size={72} strokeWidth={1.1} /></div>
              <div className="fresh-sticky" style={{ transform: 'rotate(-2deg)' }}>
                {reading?.headline || (language === 'ru' ? 'Готовим разбор…' : 'Preparing…')}
              </div>
            </div>
            <div className="horo-uni-body">
              <p className="horo-uni-summary">
                {loading ? (language === 'ru' ? 'Готовим разбор…' : 'Preparing reading…') : reading?.summary}
              </p>
              {!loading && reading?.advice?.length ? (
                <div className="horo-uni-advice">
                  <div className="horo-uni-advice-title">{language === 'ru' ? 'Советы' : 'Advice'}</div>
                  <ul>{reading.advice.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="horo-hint">{language === 'ru' ? 'Свайп ← → меняет знак' : 'Swipe ← → to change sign'}</div>

      <MonoShareBar
        label={language === 'ru' ? 'Поделиться' : 'Share'}
        withTabClearance
        onShare={shareReading}
      />
    </div>
  );
});

HoroscopeReader.displayName = 'HoroscopeReader';
