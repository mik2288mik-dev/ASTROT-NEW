import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { NatalChartData, SignHoroscopeReadingV2, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { sunSignFromDate } from '../../lib/synastry/compatScore';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { HoroscopeActivityBar } from '../../components/Horoscope/HoroscopeActivityBar';
import {
  getMoscowIsoWeekKey,
  getMoscowMonthKey,
  getMoscowTodayKey,
} from '../../lib/date-utils';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { shareToTelegram } from '../../lib/botLink';
import { canAccessFeature } from '../../lib/accessMatrix';
import {
  ensureDailySignHoroscope,
  ensureMonthlySignHoroscope,
  ensureWeeklySignHoroscope,
  getCachedDailySignHoroscope,
  getCachedMonthlySignHoroscope,
  getCachedWeeklySignHoroscope,
  prefetchSignHoroscopePeriod,
  readLocalSignHoroscope,
} from '../../services/astrologyService';
import { FreshTabs, ZodiacSignGrid } from '../../components/fresh-ui';
import { normalizeZodiacKey, ZODIAC_KEYS, type ZodiacKey } from '../../lib/zodiacKeys';

type Period = 'today' | 'week' | 'month';

type ReadyReadingSnapshot = {
  key: string;
  reading: SignHoroscopeReadingV2;
  sign: ZodiacKey;
  period: Period;
  periodKey: string;
};

export type HoroscopeReaderProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onOpenPersonalForecast?: () => void;
  onRequestPremium?: () => void;
};

export const HoroscopeReader = memo<HoroscopeReaderProps>(({
  profile,
  chartData,
  onRequestPremium,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const [today, setToday] = useState(() => getMoscowTodayKey());
  const reduceMotion = useReducedMotion();
  const readingAnchorRef = useRef<HTMLDivElement | null>(null);
  const detectedOwnSign = useMemo(() => {
    const calculated = normalizeZodiacKey(String(chartData?.sun?.sign || ''));
    const fromBirth = normalizeZodiacKey(profile.birthDate ? sunSignFromDate(profile.birthDate) || '' : '');
    const selected = normalizeZodiacKey(String(profile.selectedZodiacSign || ''));
    return calculated || fromBirth || selected || null;
  }, [profile.birthDate, profile.selectedZodiacSign, chartData]);
  const ownSign = detectedOwnSign?.toLowerCase();
  const initialIndex = useMemo(() => {
    const index = ZODIAC_KEYS.findIndex((item) => item.toLowerCase() === ownSign);
    return index >= 0 ? index : 0;
  }, [ownSign]);

  const [signIndex, setSignIndex] = useState(initialIndex);
  const [period, setPeriod] = useState<Period>('today');
  const [readings, setReadings] = useState<Record<string, SignHoroscopeReadingV2 | null>>({});
  const [loadRevision, setLoadRevision] = useState(0);
  const [lastReadyReading, setLastReadyReading] = useState<ReadyReadingSnapshot | null>(null);

  useEffect(() => {
    if (!ownSign) return;
    setSignIndex(initialIndex);
  }, [initialIndex, ownSign]);

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
  const localReading = useMemo(
    () => readLocalSignHoroscope(period, sign, periodKey, language),
    [language, period, periodKey, sign],
  );
  const hasReadingResult = Object.prototype.hasOwnProperty.call(readings, readingKey);
  const reading = hasReadingResult ? readings[readingKey] : localReading;
  const periodLocked = period !== 'today'
    && !canAccessFeature('weekly_sign_horoscope', profile, null).allowed;

  useEffect(() => {
    if (!reading) return;
    setLastReadyReading({ key: readingKey, reading, sign, period, periodKey });
  }, [period, periodKey, reading, readingKey, sign]);

  const displayed = periodLocked
    ? null
    : reading
      ? { key: readingKey, reading, sign, period, periodKey }
      : lastReadyReading?.key === readingKey
        ? lastReadyReading
        : null;

  useEffect(() => {
    if (periodLocked) return;
    let active = true;
    const hydrate = (prefetched: Record<string, SignHoroscopeReadingV2>) => {
      if (!active) return;
      setReadings((current) => {
        const hydrated = { ...current };
        Object.entries(prefetched).forEach(([prefetchedSign, prefetchedReading]) => {
          const key = `${prefetchedSign}|${period}|${periodKey}|${language}`;
          if (!hydrated[key]) hydrated[key] = prefetchedReading;
        });
        return hydrated;
      });
    };
    const load = async () => {
      try {
        const cachedReading = await (period === 'week'
          ? getCachedWeeklySignHoroscope(sign, periodKey, language)
          : period === 'month'
            ? getCachedMonthlySignHoroscope(sign, periodKey, language)
            : getCachedDailySignHoroscope(sign, periodKey, language));
        if (active && cachedReading) {
          setReadings((current) => ({ ...current, [readingKey]: cachedReading }));
        }
        const selectedReading = await (period === 'week'
          ? ensureWeeklySignHoroscope(sign, periodKey, language)
          : period === 'month'
            ? ensureMonthlySignHoroscope(sign, periodKey, language)
            : ensureDailySignHoroscope(sign, periodKey, language));
        if (active) setReadings((current) => ({ ...current, [readingKey]: selectedReading }));
      } catch {
        if (active && !readLocalSignHoroscope(period, sign, periodKey, language)) {
          setReadings((current) => ({ ...current, [readingKey]: null }));
        }
      } finally {
        if (active) {
          void prefetchSignHoroscopePeriod(period, periodKey, language)
            .then(hydrate)
            .catch(() => undefined);
        }
      }
    };
    void load();
    return () => { active = false; };
  }, [language, loadRevision, period, periodKey, periodLocked, readingKey, sign]);

  const chooseSign = (picked: string) => {
    const index = ZODIAC_KEYS.findIndex((item) => item.toLowerCase() === picked.toLowerCase());
    if (index < 0) return;
    lumiaSelectionHaptic();
    setSignIndex(index);
    window.requestAnimationFrame(() => {
      readingAnchorRef.current?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
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
  const signLabel = getZodiacSign(language, sign);
  const displayedReading = displayed?.reading ?? null;
  const displayedSign = displayed?.sign ?? sign;
  const displayedSignLabel = getZodiacSign(language, displayedSign);
  const hasReadingFailure = hasReadingResult && reading === null && !displayedReading;

  return (
    <div className="fresh-page horo-reader-page">
      <AppTopBar title={language === 'ru' ? 'Твой гороскоп' : 'Your Horoscope'} />

      <header className="horo-reader-heading">
        <h1>{language === 'ru' ? 'Гороскоп по знакам' : 'Sign horoscope'}</h1>
      </header>

      <div className="horo-reader-controls">
        <FreshTabs
          className="horo-period-tabs"
          tabs={periodTabs}
          activeTab={period}
          onTabChange={(id) => {
            lumiaSelectionHaptic();
            setPeriod(id as Period);
          }}
        />
        <ZodiacSignGrid
          signs={ZODIAC_KEYS}
          active={sign}
          ownSign={ownSign}
          language={language}
          onPick={chooseSign}
        />
      </div>

      <div ref={readingAnchorRef} className="horo-uni-wrap">
        <motion.article
          key={periodLocked ? `locked:${readingKey}` : displayed?.key || `pending:${readingKey}`}
          className="horo-uni horo-reader-article"
          aria-busy={!periodLocked && !hasReadingFailure && !displayedReading}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0.08 : 0.18, ease: 'easeOut' }}
        >
          <header className="horo-uni-hero">
            <h2 className="fresh-sticky horo-reader-headline">
              {displayedReading ? displayedReading.headline : signLabel}
            </h2>
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
                    ? 'Сегодня доступны все 12 знаков. Неделя и месяц открываются в Premium.'
                    : 'All 12 signs are free today. Week and month open in Premium.'}
                </p>
                {onRequestPremium ? (
                  <button type="button" className="fresh-btn-primary" onClick={onRequestPremium}>
                    {language === 'ru' ? 'Открыть Premium' : 'Open Premium'}
                  </button>
                ) : null}
              </div>
            ) : hasReadingFailure ? (
              <div className="horo-lock" role="alert">
                <div className="horo-lock-title">
                  {language === 'ru' ? 'Разбор пока недоступен' : 'The reading is unavailable'}
                </div>
                <button type="button" className="fresh-btn-primary" onClick={retryCurrent}>
                  {language === 'ru' ? 'Повторить' : 'Try again'}
                </button>
              </div>
            ) : displayedReading ? (
              <>
                <div className="horo-sign-story">
                  <p>{displayedReading.text}</p>
                </div>

                <HoroscopeActivityBar
                  userId={profile.id ? String(profile.id) : undefined}
                  sign={displayedSign}
                  date={today}
                  period={period}
                  language={language}
                  onShare={() => shareToTelegram(language === 'ru'
                    ? `Гороскоп для знака ${displayedSignLabel} в «Твой гороскоп»`
                    : `${displayedSignLabel} horoscope in Your Horoscope`)}
                />
              </>
            ) : null}
          </div>
        </motion.article>
      </div>
    </div>
  );
});

HoroscopeReader.displayName = 'HoroscopeReader';
