import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import type { NatalChartData, SignHoroscopeReadingV2, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { sunSignFromDate } from '../../lib/synastry/compatScore';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { HoroscopeActivityBar } from '../../components/Horoscope/HoroscopeActivityBar';
import {
  formatDisplayDate,
  formatMonthPretty,
  formatWeekRangePretty,
  getMoscowIsoWeekKey,
  getMoscowMonthKey,
  getMoscowTodayKey,
} from '../../lib/date-utils';
import { getHoroscopeEngagementDateKey } from '../../lib/horoscope/signEngagement';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { shareToTelegram } from '../../lib/botLink';
import { APPROXIMATE_SUN_SIGN_DATES } from '../../lib/zodiac-utils';
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
import { FreshTabs } from '../../components/fresh-ui';
import { ZodiacIllustration, zodiacIllustrationUrl } from '../../components/icons/ZodiacArt';
import { normalizeZodiacKey, ZODIAC_KEYS, type ZodiacKey } from '../../lib/zodiacKeys';
import { LzSignPickerSheet } from '../../components/lumia-ui/v2/LzSignPickerSheet';
import {
  EditorialCurve,
  EditorialChartsButton,
} from '../../components/editorial/EditorialScreenChrome';

type Period = 'today' | 'week' | 'month';

function formatHoroscopePeriodDate(
  period: Period,
  periodKey: string,
  language: 'ru' | 'en',
): string {
  if (period === 'week') return formatWeekRangePretty(periodKey, language);
  if (period === 'month') return formatMonthPretty(periodKey, language);
  return formatDisplayDate(periodKey, language);
}

function formatZodiacDateRange(sign: ZodiacKey, language: 'ru' | 'en'): string {
  const range = APPROXIMATE_SUN_SIGN_DATES[sign];
  const formatter = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const formatBoundary = (month: number, day: number) => (
    formatter.format(new Date(Date.UTC(2024, month - 1, day)))
  );
  const start = formatBoundary(range.startMonth, range.startDay);
  const end = formatBoundary(range.endMonth, range.endDay);
  return language === 'ru' ? `с ${start} по ${end}` : `${start} to ${end}`;
}

type ReadyReadingSnapshot = {
  key: string;
  reading: SignHoroscopeReadingV2;
  sign: ZodiacKey;
  period: Period;
  periodKey: string;
};

type HoroscopeReaderUiPreview = {
  sign: string;
  pickerOpen?: boolean;
  readings: Record<Period, SignHoroscopeReadingV2>;
};

export type HoroscopeReaderProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onUpdateProfile?: (profile: UserProfile) => void;
  onOpenChart?: () => void;
  onOpenPersonalForecast?: () => void;
  onOpenCharts?: () => void;
  uiPreview?: HoroscopeReaderUiPreview;
};

export const HoroscopeReader = memo<HoroscopeReaderProps>(
  ({
    profile,
    chartData,
    onOpenCharts,
    uiPreview,
  }) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const previewFixture = process.env.NODE_ENV === 'development' ? uiPreview : undefined;
  const [today, setToday] = useState(() => getMoscowTodayKey());
  const [period, setPeriod] = useState<Period>('today');
  const reduceMotion = useReducedMotion();
  const readingAnchorRef = useRef<HTMLDivElement | null>(null);
  const pendingReadingScrollRef = useRef<ZodiacKey | null>(null);
  const detectedOwnSign = useMemo(() => {
    const fromPreview = normalizeZodiacKey(String(previewFixture?.sign || ''));
    const calculated = normalizeZodiacKey(String(chartData?.sun?.sign || ''));
    const fromBirth = normalizeZodiacKey(profile.birthDate ? sunSignFromDate(profile.birthDate) || '' : '');
    const selected = normalizeZodiacKey(String(profile.selectedZodiacSign || ''));
    return fromPreview || calculated || fromBirth || selected || null;
  }, [profile.birthDate, profile.selectedZodiacSign, chartData, previewFixture?.sign]);
  const ownSign = detectedOwnSign?.toLowerCase();
  const initialIndex = useMemo(() => {
    const index = ZODIAC_KEYS.findIndex((item) => item.toLowerCase() === ownSign);
    return index >= 0 ? index : 0;
  }, [ownSign]);

  const [signIndex, setSignIndex] = useState(initialIndex);
  const [readings, setReadings] = useState<Record<string, SignHoroscopeReadingV2 | null>>({});
  const [loadRevision, setLoadRevision] = useState(0);
  const [lastReadyReading, setLastReadyReading] = useState<ReadyReadingSnapshot | null>(null);
  const [signPickerOpen, setSignPickerOpen] = useState(Boolean(previewFixture?.pickerOpen));

  useEffect(() => {
    ZODIAC_KEYS.forEach((zodiacSign) => {
      const source = zodiacIllustrationUrl(zodiacSign);
      if (!source) return;
      const image = new Image();
      image.src = source;
    });
  }, []);

  useEffect(() => {
    if (!ownSign) return;
    setSignIndex(initialIndex);
  }, [initialIndex, ownSign]);

  useEffect(() => {
    if (previewFixture) return;
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
  }, [previewFixture]);

  const periodTabs = useMemo(() => ([
    { id: 'today', label: language === 'ru' ? 'Сегодня' : 'Today' },
    { id: 'week', label: language === 'ru' ? 'Неделя' : 'Week' },
    { id: 'month', label: language === 'ru' ? 'Месяц' : 'Month' },
  ]), [language]);

  const weekKey = useMemo(() => getMoscowIsoWeekKey(), [today]);
  const monthKey = useMemo(() => getMoscowMonthKey(), [today]);
  const sign = ZODIAC_KEYS[signIndex] as ZodiacKey;
  const periodKey = period === 'week' ? weekKey : period === 'month' ? monthKey : today;
  const readingKey = `${sign.toLowerCase()}|${period}|${periodKey}|${language}`;
  const localReading = useMemo(
    () => previewFixture
      ? previewFixture.readings[period]
      : readLocalSignHoroscope(period, sign, periodKey, language),
    [language, period, periodKey, previewFixture, sign],
  );
  const hasReadingResult = Object.prototype.hasOwnProperty.call(readings, readingKey);
  const reading = hasReadingResult ? readings[readingKey] : localReading;

  useEffect(() => {
    if (!reading) return;
    setLastReadyReading({ key: readingKey, reading, sign, period, periodKey: reading.periodKey });
  }, [period, periodKey, reading, readingKey, sign]);

  const displayed = reading
    ? { key: readingKey, reading, sign, period, periodKey }
    : lastReadyReading?.key === readingKey
      ? lastReadyReading
      : null;

  useEffect(() => {
    if (previewFixture) return;
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
        const cachedReading = period === 'week'
          ? await getCachedWeeklySignHoroscope(sign, periodKey, language)
          : period === 'month'
            ? await getCachedMonthlySignHoroscope(sign, periodKey, language)
            : await getCachedDailySignHoroscope(sign, periodKey, language);
        if (active && cachedReading) {
          setReadings((current) => ({ ...current, [readingKey]: cachedReading }));
        }

        const selectedReading = period === 'week'
          ? await ensureWeeklySignHoroscope(sign, periodKey, language)
          : period === 'month'
            ? await ensureMonthlySignHoroscope(sign, periodKey, language)
            : await ensureDailySignHoroscope(sign, periodKey, language);
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
  }, [language, loadRevision, period, periodKey, previewFixture, readingKey, sign]);

  const scrollForecastToTop = useCallback(() => {
    const target = readingAnchorRef.current;
    if (!target) return;

    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth';
    const scrollContainer = target.closest<HTMLElement>('.lumia-main-scroll');
    if (!scrollContainer) {
      target.scrollIntoView({ behavior, block: 'start' });
      return;
    }

    const topBar = target
      .closest<HTMLElement>('.horo-reader-page')
      ?.querySelector<HTMLElement>('.app-top-bar');
    const targetTop = scrollContainer.scrollTop
      + target.getBoundingClientRect().top
      - scrollContainer.getBoundingClientRect().top;
    const topBarOffset = topBar?.getBoundingClientRect().height ?? 0;
    scrollContainer.scrollTo({
      top: Math.max(0, targetTop - topBarOffset - 12),
      behavior,
    });
  }, [reduceMotion]);

  const chooseSign = (picked: string) => {
    const index = ZODIAC_KEYS.findIndex((item) => item.toLowerCase() === picked.toLowerCase());
    if (index < 0) return;
    const pickedSign = ZODIAC_KEYS[index] as ZodiacKey;
    lumiaSelectionHaptic();
    pendingReadingScrollRef.current = index === signIndex ? null : pickedSign;
    setSignIndex(index);
    window.requestAnimationFrame(scrollForecastToTop);
  };

  const choosePeriod = (next: string) => {
    if (next !== 'today' && next !== 'week' && next !== 'month') return;
    lumiaSelectionHaptic();
    setPeriod(next);
    window.requestAnimationFrame(scrollForecastToTop);
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

  const displayedReading = displayed?.reading ?? null;
  const displayedSign = displayed?.sign ?? sign;
  const displayedPeriod = displayed?.period ?? period;
  const displayedPeriodKey = displayedReading?.periodKey ?? periodKey;
  const displayedSignLabel = getZodiacSign(language, displayedSign);
  const selectedSignLabel = getZodiacSign(language, sign);
  const selectedSignDateRange = formatZodiacDateRange(sign, language);
  const displayedPeriodDate = formatHoroscopePeriodDate(displayedPeriod, displayedPeriodKey, language);
  const displayedEngagementDate = getHoroscopeEngagementDateKey(displayedPeriod, displayedPeriodKey);
  const hasReadingFailure = hasReadingResult && reading === null && !displayedReading;
  const readingSettledForScroll = hasReadingFailure || Boolean(displayedReading);

  useEffect(() => {
    if (pendingReadingScrollRef.current !== sign || !readingSettledForScroll) return;
    const frame = window.requestAnimationFrame(() => {
      scrollForecastToTop();
      pendingReadingScrollRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [readingSettledForScroll, scrollForecastToTop, sign]);

  return (
    <div className="fresh-page horo-reader-page">
      <AppTopBar
        title={language === 'ru' ? 'Гороскоп по знакам' : 'Sign horoscope'}
        rightAction={(
          <EditorialChartsButton
            label={language === 'ru' ? 'Открыть мои карты' : 'Open my charts'}
            onClick={onOpenCharts}
          />
        )}
      />

      <div className="horo-reader-controls">
        <FreshTabs
          className="horo-period-tabs"
          tabs={periodTabs}
          activeTab={period}
          onTabChange={choosePeriod}
        />
      </div>

      <header className="horo-reader-heading">
        <button
          type="button"
          className="horo-reader-sign-trigger"
          aria-haspopup="dialog"
          aria-expanded={signPickerOpen}
          onClick={() => {
            lumiaSelectionHaptic();
            setSignPickerOpen(true);
          }}
        >
          <span>{selectedSignLabel}</span>
          <ChevronDown aria-hidden="true" strokeWidth={1.45} />
        </button>
        <p className="horo-reader-sign-range">{selectedSignDateRange}</p>
      </header>

      <EditorialCurve className="horo-reader-curve" />

      <div ref={readingAnchorRef} className="horo-uni-wrap">
        <article
          key={displayed?.key || `pending:${readingKey}`}
          className="horo-uni horo-reader-article"
          aria-busy={!hasReadingFailure && !displayedReading}
        >
          <button
            type="button"
            className="horo-reader-symbol-stage"
            aria-label={language === 'ru' ? 'Выбрать другой знак зодиака' : 'Choose another zodiac sign'}
            onClick={() => {
              lumiaSelectionHaptic();
              setSignPickerOpen(true);
            }}
          >
            <ZodiacIllustration
              sign={displayedSign}
              className="horo-reader-selected-illustration"
              priority
            />
          </button>

          {displayedReading ? (
            <header className="horo-uni-hero">
              <p className="horo-reader-period-date">{displayedPeriodDate}</p>
              <h2 className="fresh-sticky horo-reader-headline">
                {displayedReading.headline}
              </h2>
            </header>
          ) : null}

          <div className="horo-uni-body horo-reader-reading">
            {hasReadingFailure ? (
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
                  userId={!previewFixture && profile.id ? String(profile.id) : undefined}
                  sign={displayedSign}
                  date={displayedEngagementDate}
                  period={displayedPeriod}
                  language={language}
                  onShare={previewFixture
                    ? () => undefined
                    : () => shareToTelegram(language === 'ru'
                      ? `Гороскоп для знака ${displayedSignLabel} в NEBO`
                      : `${displayedSignLabel} horoscope in NEBO`)}
                />
              </>
            ) : null}
          </div>
        </article>
      </div>

      <LzSignPickerSheet
        open={signPickerOpen}
        language={profile.language}
        current={sign}
        title={language === 'ru' ? 'Выбери знак' : 'Choose a sign'}
        subtitle={language === 'ru' ? 'Прогноз откроется в том же периоде' : 'The same period will stay selected'}
        variant="editorial"
        onPick={chooseSign}
        onClose={() => setSignPickerOpen(false)}
      />
    </div>
  );
});

HoroscopeReader.displayName = 'HoroscopeReader';
