import React, { memo, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { NatalChartData, SignHoroscopeReadingV2, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { sunSignFromDate } from '../../lib/synastry/compatScore';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import {
  formatDisplayDate,
  formatMonthPretty,
  formatWeekRangePretty,
  getMoscowIsoWeekKey,
  getMoscowMonthKey,
  getMoscowTodayKey,
} from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { canAccessFeature, hasActivePremium, hasNatalChart } from '../../lib/accessMatrix';
import {
  ensureDailySignHoroscope,
  ensureMonthlySignHoroscope,
  ensureWeeklySignHoroscope,
  getCachedDailySignHoroscope,
  getCachedMonthlySignHoroscope,
  getCachedWeeklySignHoroscope,
} from '../../services/astrologyService';
import { shareToTelegram } from '../../lib/botLink';
import { FreshTabs, InfoNote, ZodiacSignGrid } from '../../components/fresh-ui';
import { ChevronRightIcon } from '../../components/icons/UiIcons';
import { HoroscopeActivityBar } from '../../components/Horoscope/HoroscopeActivityBar';
import { normalizeZodiacKey, ZODIAC_KEYS, type ZodiacKey } from '../../lib/zodiacKeys';
import { selectZodiacEditorialSticker } from '../../lib/personalForecastVisuals';
import { EditorialSticker } from '../../components/EditorialSticker';

type Period = 'today' | 'week' | 'month';

export type HoroscopeReaderProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onOpenPersonalForecast?: () => void;
  onRequestPremium?: () => void;
};

function mondayKey(key: string): string {
  const [year, month, day] = key.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

export const HoroscopeReader = memo<HoroscopeReaderProps>(({
  profile,
  chartData,
  chartId,
  onOpenChart,
  onOpenPersonalForecast,
  onRequestPremium,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const [today, setToday] = useState(() => getMoscowTodayKey());
  const reduceMotion = useReducedMotion();
  const ownSign = useMemo(() => {
    const calculated = normalizeZodiacKey(String(chartData?.sun?.sign || ''));
    const fromBirth = normalizeZodiacKey(
      profile.birthDate ? sunSignFromDate(profile.birthDate) || '' : '',
    );
    const selected = normalizeZodiacKey(String(profile.selectedZodiacSign || ''));
    return (calculated || fromBirth || selected || ZODIAC_KEYS[0]).toLowerCase();
  }, [profile.birthDate, profile.selectedZodiacSign, chartData]);
  const initialIndex = useMemo(() => {
    const index = ZODIAC_KEYS.findIndex((item) => item.toLowerCase() === ownSign);
    return index >= 0 ? index : 0;
  }, [ownSign]);

  const [signIndex, setSignIndex] = useState(initialIndex);
  const [period, setPeriod] = useState<Period>('today');
  const [readings, setReadings] = useState<Record<string, SignHoroscopeReadingV2 | null>>({});
  const [loadRevision, setLoadRevision] = useState(0);

  useEffect(() => setSignIndex(initialIndex), [initialIndex]);
  useEffect(() => {
    const refreshPeriodKeys = () => setToday(getMoscowTodayKey());
    const timer = window.setInterval(refreshPeriodKeys, 60_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshPeriodKeys();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const sign = ZODIAC_KEYS[signIndex] as ZodiacKey;
  const periodKey = period === 'week'
    ? getMoscowIsoWeekKey()
    : period === 'month'
      ? getMoscowMonthKey()
      : today;
  const readingKey = `${sign.toLowerCase()}|${period}|${periodKey}|${language}`;
  const reading = readings[readingKey];
  const premium = hasActivePremium(profile);
  const periodLocked = period !== 'today'
    && !canAccessFeature('weekly_sign_horoscope', profile, null).allowed;
  const loading = !periodLocked && reading === undefined;

  useEffect(() => {
    if (periodLocked) return;
    let active = true;
    if (readingKey in readings) return;
    const load = async () => {
      try {
        const next = period === 'week'
          ? await getCachedWeeklySignHoroscope(sign, periodKey, language)
            || await ensureWeeklySignHoroscope(sign, periodKey, language)
          : period === 'month'
            ? await getCachedMonthlySignHoroscope(sign, periodKey, language)
              || await ensureMonthlySignHoroscope(sign, periodKey, language)
            : await getCachedDailySignHoroscope(sign, periodKey, language)
              || await ensureDailySignHoroscope(sign, periodKey, language);
        if (active) setReadings((current) => ({ ...current, [readingKey]: next }));
      } catch {
        if (active) setReadings((current) => ({ ...current, [readingKey]: null }));
      }
    };
    void load();
    return () => { active = false; };
  }, [language, loadRevision, period, periodKey, periodLocked, readingKey, readings, sign]);

  const chooseSign = (picked: string) => {
    const index = ZODIAC_KEYS.findIndex((item) => item.toLowerCase() === picked.toLowerCase());
    if (index < 0) return;
    lumiaSelectionHaptic();
    setSignIndex(index);
  };

  const retryCurrent = () => {
    lumiaSelectionHaptic();
    setReadings((current) => {
      const next = { ...current };
      delete next[readingKey];
      return next;
    });
    setLoadRevision((value) => value + 1);
  };

  const periodTabs = useMemo(() => [
    { id: 'today', label: language === 'ru' ? 'Сегодня' : 'Today' },
    { id: 'week', label: language === 'ru' ? 'Неделя' : 'Week' },
    { id: 'month', label: language === 'ru' ? 'Месяц' : 'Month' },
  ], [language]);
  const dateLine = useMemo(() => {
    if (period === 'week') return formatWeekRangePretty(periodKey, language);
    if (period === 'month') return formatMonthPretty(periodKey, language);
    const [year, month, day] = today.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    const weekday = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
      timeZone: 'UTC',
      weekday: 'long',
    }).format(date);
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${formatDisplayDate(today, language)}`;
  }, [language, period, periodKey, today]);
  const periodTag = period === 'week'
    ? formatWeekRangePretty(periodKey, language)
    : period === 'month'
      ? formatMonthPretty(periodKey, language)
      : formatDisplayDate(today, language);
  const signLabel = getZodiacSign(language, sign);
  const zodiacSticker = useMemo(() => selectZodiacEditorialSticker({
    sign,
    contentKey: `${period}:${periodKey}`,
    userId: profile.id ? String(profile.id) : undefined,
  }), [period, periodKey, profile.id, sign]);

  const hasChart = hasNatalChart(profile, { chartData, primaryChartId: chartId ?? null });
  const personalSubtitle = !hasChart
    ? (language === 'ru' ? 'Сначала создай натальную карту.' : 'Create a natal chart first.')
    : !premium
      ? (language === 'ru' ? 'Личный прогноз по карте доступен в Premium.' : 'Your chart-based forecast is available with Premium.')
      : (language === 'ru' ? 'Перейти к личному прогнозу.' : 'Open your personal forecast.');
  const personalCta = !hasChart
    ? (language === 'ru' ? 'Создать карту' : 'Create chart')
    : !premium
      ? (language === 'ru' ? 'Premium' : 'Premium')
      : (language === 'ru' ? 'Открыть' : 'Open');
  const openPersonal = () => {
    lumiaSelectionHaptic();
    if (hasChart && premium) onOpenPersonalForecast?.();
    else if (!hasChart) onOpenChart?.();
    else onRequestPremium?.();
  };
  const shareReading = () => {
    const hook = reading?.headline || (language === 'ru' ? 'Гороскоп на выбранный период' : 'Horoscope for this period');
    const text = language === 'ru'
      ? `Гороскоп · ${signLabel}\n«${hook}»\n\nУзнай свой в «Твой Гороскоп».`
      : `Horoscope · ${signLabel}\n“${hook}”\n\nRead yours in Your Horoscope.`;
    shareToTelegram(text);
  };

  return (
    <div className="fresh-page horo-reader-page">
      <AppTopBar title={language === 'ru' ? 'Гороскоп' : 'Horoscope'} subtitle={dateLine} />

      <div className="horo-reader-controls">
        <ZodiacSignGrid
          signs={ZODIAC_KEYS}
          active={sign}
          ownSign={ownSign}
          language={language}
          onPick={chooseSign}
        />
        <FreshTabs
          className="horo-period-tabs"
          tabs={periodTabs}
          activeTab={period}
          onTabChange={(id) => {
            lumiaSelectionHaptic();
            setPeriod(id as Period);
          }}
        />
      </div>

      <div className="horo-uni-wrap">
        <AnimatePresence initial={false} mode="wait">
          <motion.article
            key={readingKey}
            className="horo-uni horo-reader-article"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ duration: reduceMotion ? 0.08 : 0.18, ease: 'easeOut' }}
          >
            <header className="horo-uni-hero" style={{ background: 'transparent' }}>
              <div className="horo-hero-date">{periodTag}</div>
              <h1 className="fresh-sticky horo-reader-headline">
                {periodLocked
                  ? signLabel
                  : reading?.headline
                    || (reading === null
                      ? (language === 'ru' ? 'Не удалось загрузить' : 'Could not load')
                      : (language === 'ru' ? 'Готовим разбор…' : 'Preparing…'))}
              </h1>
            </header>

            <div className="horo-uni-body horo-reader-reading">
              {periodLocked ? (
                <div className="horo-lock">
                  <div className="horo-lock-title">
                    {period === 'week'
                      ? (language === 'ru' ? 'Гороскоп на неделю — в Premium' : 'Weekly horoscope — Premium')
                      : (language === 'ru' ? 'Гороскоп на месяц — в Premium' : 'Monthly horoscope — Premium')}
                  </div>
                  <p className="horo-lock-text">
                    {language === 'ru'
                      ? 'Сегодня доступны все 12 знаков бесплатно. Неделя и месяц открываются в Premium.'
                      : 'All 12 signs are free today. Week and month open in Premium.'}
                  </p>
                  {onRequestPremium ? (
                    <button type="button" className="fresh-btn-primary" onClick={onRequestPremium}>
                      {language === 'ru' ? 'Открыть Premium' : 'Open Premium'}
                    </button>
                  ) : null}
                </div>
              ) : reading === null ? (
                <div className="horo-lock">
                  <div className="horo-lock-title">
                    {language === 'ru' ? 'Разбор не загрузился' : 'The reading did not load'}
                  </div>
                  <button type="button" className="fresh-btn-primary" onClick={retryCurrent}>
                    {language === 'ru' ? 'Повторить' : 'Try again'}
                  </button>
                </div>
              ) : loading ? (
                <p className="horo-uni-summary">
                  {language === 'ru' ? 'Готовим разбор…' : 'Preparing reading…'}
                </p>
              ) : reading ? (
                <>
                  <div className="horo-sign-v2-flow">
                    <p className="horo-sign-v2-intro">{reading.mood.text}</p>
                    <section className="horo-sign-v2-section">
                      <h2>{language === 'ru' ? 'Отношения и общение' : 'Relationships and communication'}</h2>
                      <p>{reading.relationships.text}</p>
                    </section>
                    <section className="horo-sign-v2-section">
                      <h2>{language === 'ru' ? 'Дела и деньги' : 'Work and money'}</h2>
                      <p>{reading.work.text}</p>
                    </section>
                    <section className="horo-sign-v2-section">
                      <h2>{language === 'ru' ? 'Внутреннее состояние' : 'Inner state'}</h2>
                      <p>{reading.innerState.text}</p>
                    </section>
                    <p className="horo-sign-v2-advice">{reading.advice.text}</p>
                    {reading.warning ? (
                      <aside className="horo-sign-v2-warning"><p>{reading.warning.text}</p></aside>
                    ) : null}
                    {zodiacSticker ? (
                      <EditorialSticker asset={zodiacSticker} className="horo-zodiac-sticker horo-zodiac-sticker--inline" />
                    ) : null}
                  </div>
                  <HoroscopeActivityBar
                    userId={profile.id ? String(profile.id) : undefined}
                    sign={sign}
                    date={period === 'week' ? mondayKey(today) : period === 'month' ? `${periodKey}-01` : today}
                    period={period}
                    language={language}
                    onShare={shareReading}
                  />
                </>
              ) : null}
            </div>
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="horo-reader-info">
        <InfoNote title={language === 'ru' ? 'На чём основан гороскоп?' : 'What is this based on?'}>
          {language === 'ru'
            ? 'Положения и аспекты планет рассчитаны Swiss Ephemeris. Для каждого знака учитываются его управители и дома от солнечного знака.'
            : 'Positions and aspects are calculated with Swiss Ephemeris. Each reading also uses the sign rulers and whole-sign houses from the Sun sign.'}
        </InfoNote>
      </div>

      <button type="button" className="horo-premium horo-reader-personal" onClick={openPersonal}>
        <div className="horo-premium-text">
          <div className="horo-premium-kicker">{language === 'ru' ? 'Личный гороскоп' : 'Personal Horoscope'}</div>
          <div className="horo-premium-title">{personalSubtitle}</div>
        </div>
        <span className="horo-premium-cta">{personalCta}<ChevronRightIcon size={15} /></span>
      </button>
    </div>
  );
});

HoroscopeReader.displayName = 'HoroscopeReader';
