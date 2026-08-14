import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import type { NatalChartData, UserProfile } from '../types';
import { hasActivePremium } from '../lib/accessMatrix';
import { buildAiPersonalHoroscopeProfileFingerprint } from '../lib/aiPersonalHoroscope';
import {
  formatPersonalForecastDateLabel,
  getPersonalForecastPeriodKey,
  normalizeForecastTimezone,
  resolvePersonalForecastWindow,
  type PersonalForecastPeriod,
} from '../lib/personalForecastContract';
import {
  loadPersonalForecast,
  readLocalPersonalForecast,
  selectActiveReadyPersonalForecast,
  type PersonalForecastClientError,
  type PersonalForecastClientResult,
} from '../services/personalForecastService';
import { AiPersonalHoroscopeReading } from '../components/PersonalForecastFeed/AiPersonalHoroscopeReading';
import { resolveRequestedPersonalForecastPeriod } from '../components/PersonalForecastFeed/periodSelection';
import { AppTopBar } from '../components/lumia-ui/AppTopBar';

type DashboardProps = {
  profile: UserProfile;
  /** Kept only for App.tsx source compatibility. Personal horoscopes do not read it. */
  chartData: NatalChartData | null;
  /** Kept only for App.tsx source compatibility. Personal horoscopes do not read it. */
  chartId?: number | null;
  currentDateKey?: string;
  onCreateNatalChart?: () => void;
  requestedPeriod?: PersonalForecastPeriod;
  onPeriodChange?: (period: PersonalForecastPeriod) => void;
  onRequestPremium?: (
    source?: string,
    eventPayload?: Record<string, unknown>,
  ) => Promise<void> | void;
  onPremiumAnalytics?: (
    eventType:
      | 'first_value_viewed'
      | 'locked_feature_tapped'
      | 'premium_promo_impression'
      | 'premium_promo_clicked'
      | 'premium_promo_dismissed',
    eventPayload: Record<string, unknown>,
  ) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  canPromotePremium?: boolean;
};

type PeriodState = {
  result: PersonalForecastClientResult | null;
  phase: 'idle' | 'loading' | 'ready' | 'error';
  errorCode: string | null;
};

type PeriodRequest = {
  promise: Promise<void>;
};

const FORECAST_PERIODS: readonly PersonalForecastPeriod[] = ['day', 'week', 'month'];

function emptyPeriodState(): PeriodState {
  return { result: null, phase: 'idle', errorCode: null };
}

function loadingLabel(
  period: PersonalForecastPeriod,
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    return {
      day: 'Writing your personal horoscope for today',
      week: 'Writing your personal horoscope for the week',
      month: 'Writing your personal horoscope for the month',
    }[period];
  }
  return {
    day: 'Пишем твой личный гороскоп на сегодня',
    week: 'Пишем твой личный гороскоп на неделю',
    month: 'Пишем твой личный гороскоп на месяц',
  }[period];
}

function errorMessage(
  code: string | null,
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    if (code === 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED') {
      return 'The text missed the quality bar. Retry this period only.';
    }
    if (code === 'PERSONAL_FORECAST_WRITER_INCOMPLETE') {
      return 'The horoscope was incomplete. Retry this period only.';
    }
    return 'The horoscope did not load. Other application sections still work.';
  }
  if (code === 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED') {
    return 'Текст не прошёл проверку качества. Повторим только этот период.';
  }
  if (code === 'PERSONAL_FORECAST_WRITER_INCOMPLETE') {
    return 'Текст получился неполным. Повторим только этот период.';
  }
  return 'Гороскоп не загрузился. Остальные разделы приложения работают.';
}

export const Dashboard = memo<DashboardProps>(({
  profile,
  currentDateKey,
  requestedPeriod,
  onRequestPremium,
  onPremiumAnalytics,
  scrollRef,
  canPromotePremium = true,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const premium = hasActivePremium(profile);
  const activePeriod = resolveRequestedPersonalForecastPeriod(requestedPeriod);
  const timezone = normalizeForecastTimezone(profile.birthTimezone || 'Europe/Moscow');
  const profileFingerprint = buildAiPersonalHoroscopeProfileFingerprint(profile);
  const requestsRef = useRef<Partial<Record<PersonalForecastPeriod, PeriodRequest>>>({});
  const firstValueSeenRef = useRef<Set<string>>(new Set());
  const promoSeenRef = useRef<Set<string>>(new Set());
  const [periodStates, setPeriodStates] = useState<Record<PersonalForecastPeriod, PeriodState>>({
    day: emptyPeriodState(),
    week: emptyPeriodState(),
    month: emptyPeriodState(),
  });

  const periodKeys = useMemo<Record<PersonalForecastPeriod, string>>(() => {
    const now = new Date();
    return {
      day: getPersonalForecastPeriodKey('day', now, timezone),
      week: getPersonalForecastPeriodKey('week', now, timezone),
      month: getPersonalForecastPeriodKey('month', now, timezone),
    };
  }, [currentDateKey, timezone]);
  const activeWindow = useMemo(
    () => resolvePersonalForecastWindow(activePeriod, periodKeys[activePeriod], timezone),
    [activePeriod, periodKeys, timezone],
  );
  const activeDateLines = useMemo(
    () => formatPersonalForecastDateLabel(activeWindow, language)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    [activeWindow, language],
  );
  const activePeriodTitle = {
    day: language === 'ru' ? 'Сегодня' : 'Today',
    week: language === 'ru' ? 'Неделя' : 'Week',
    month: language === 'ru' ? 'Месяц' : 'Month',
  }[activePeriod];
  const activeDateValue = activePeriod === 'day'
    ? activeDateLines[activeDateLines.length - 1]
    : activeDateLines.join(' ');

  const productContextKey = [
    String(profile.id || 'guest'),
    profileFingerprint,
    language,
    timezone,
    periodKeys.day,
    premium ? 'premium' : 'free',
  ].join(':');

  useEffect(() => {
    requestsRef.current = {};
    setPeriodStates(Object.fromEntries(
      FORECAST_PERIODS.map((period) => {
        const local = readLocalPersonalForecast({
          profile,
          period,
          periodKey: periodKeys[period],
        });
        return [period, {
          result: local,
          phase: local ? 'ready' : 'idle',
          errorCode: null,
        }];
      }),
    ) as Record<PersonalForecastPeriod, PeriodState>);
  }, [productContextKey, periodKeys.day, periodKeys.month, periodKeys.week, profile]);

  const loadPeriod = useCallback((
    period: PersonalForecastPeriod,
    options?: { retry?: boolean },
  ) => {
    if (!premium && period !== 'day') {
      setPeriodStates((current) => ({
        ...current,
        [period]: emptyPeriodState(),
      }));
      return;
    }
    if (requestsRef.current[period]) return;

    const periodKey = periodKeys[period];
    const local = options?.retry
      ? null
      : readLocalPersonalForecast({ profile, period, periodKey });
    setPeriodStates((current) => ({
      ...current,
      [period]: {
        result: local || current[period]?.result || null,
        phase: local || current[period]?.result ? 'ready' : 'loading',
        errorCode: null,
      },
    }));

    const requestEntry: PeriodRequest = { promise: Promise.resolve() };
    const request = loadPersonalForecast({
      profile,
      period,
      periodKey,
      options: {
        force: options?.retry,
        maxInProgressRetries: 60,
      },
    }).then((result) => {
      if (requestsRef.current[period] !== requestEntry) return;
      setPeriodStates((current) => ({
        ...current,
        [period]: { result, phase: 'ready', errorCode: null },
      }));
    }).catch((error: PersonalForecastClientError) => {
      if (requestsRef.current[period] !== requestEntry) return;
      setPeriodStates((current) => ({
        ...current,
        [period]: {
          result: current[period]?.result || null,
          phase: current[period]?.result ? 'ready' : 'error',
          errorCode: current[period]?.result ? null : error.code || 'PERSONAL_FORECAST_GENERATION_FAILED',
        },
      }));
    }).finally(() => {
      if (requestsRef.current[period] === requestEntry) {
        delete requestsRef.current[period];
      }
    });
    requestEntry.promise = request;
    requestsRef.current[period] = requestEntry;
  }, [periodKeys, premium, profile]);

  useEffect(() => {
    loadPeriod(activePeriod);
  }, [activePeriod, loadPeriod, productContextKey]);

  useEffect(() => {
    scrollRef?.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activePeriod, scrollRef]);

  const state = periodStates[activePeriod];
  const result = selectActiveReadyPersonalForecast(activePeriod, periodStates);
  const forecast = result?.forecast || null;
  const lockedIds = useMemo(
    () => new Set(result?.lockedSectionIds || []),
    [result?.lockedSectionIds],
  );

  useEffect(() => {
    if (!forecast || activePeriod !== 'day') return;
    const key = `${String(profile.id || 'guest')}:${forecast.periodKey}`;
    if (firstValueSeenRef.current.has(key)) return;
    firstValueSeenRef.current.add(key);
    onPremiumAnalytics?.('first_value_viewed', {
      placement: 'today',
      featureKey: 'personal_daily',
      periodKey: forecast.periodKey,
      contentMode: 'ai-personal-horoscope',
    });
  }, [activePeriod, forecast, onPremiumAnalytics, profile.id]);

  useEffect(() => {
    if (!forecast || !lockedIds.size || !canPromotePremium) return;
    const key = `${String(profile.id || 'guest')}:${forecast.periodKey}:promo`;
    if (promoSeenRef.current.has(key)) return;
    promoSeenRef.current.add(key);
    onPremiumAnalytics?.('premium_promo_impression', {
      placement: activePeriod === 'day' ? 'today' : activePeriod,
      featureKey: activePeriod === 'day'
        ? 'personal_daily_full'
        : activePeriod === 'week'
          ? 'personal_weekly'
          : 'personal_monthly',
      periodKey: forecast.periodKey,
    });
  }, [activePeriod, canPromotePremium, forecast, lockedIds.size, onPremiumAnalytics, profile.id]);

  const requestPremium = useCallback(() => {
    if (activePeriod !== 'day') {
      onPremiumAnalytics?.('locked_feature_tapped', {
        placement: activePeriod,
        featureKey: activePeriod === 'week' ? 'personal_weekly' : 'personal_monthly',
        periodKey: periodKeys[activePeriod],
      });
    } else {
      onPremiumAnalytics?.('premium_promo_clicked', {
        placement: 'today',
        featureKey: 'personal_daily_full',
        periodKey: forecast?.periodKey || periodKeys.day,
      });
    }
    void onRequestPremium?.('personal_forecast_feed', {
      period: activePeriod,
      periodKey: forecast?.periodKey || periodKeys[activePeriod],
      placement: activePeriod === 'day' ? 'today' : activePeriod,
      featureKey: activePeriod === 'day'
        ? 'personal_daily_full'
        : activePeriod === 'week'
          ? 'personal_weekly'
          : 'personal_monthly',
      triggerType: activePeriod === 'day' ? 'inline_promo' : 'locked_feature',
      returnView: 'dashboard',
      returnScrollAnchor: 'personal-forecast-reading',
    });
  }, [activePeriod, forecast?.periodKey, onPremiumAnalytics, onRequestPremium, periodKeys]);

  return (
    <div
      id="personal-forecast-reading"
      className={`fresh-page home-screen forecast-feed-page lumia-main-scroll is-${activePeriod}`}
      ref={scrollRef as React.RefObject<HTMLDivElement>}
    >
      <section
        className="home-top"
        aria-label={language === 'ru' ? 'Личный гороскоп' : 'Personal horoscope'}
      >
        <AppTopBar
          title={language === 'ru' ? 'Твой Гороскоп' : 'Your Horoscope'}
          subtitle={activePeriodTitle}
        />
      </section>

      <div className="forecast-feed-reading-header">
        <div
          className="forecast-feed-date-zone"
          aria-label={`${activePeriodTitle} ${activeDateValue}`}
        >
          <div className="forecast-feed-date-cluster">
            <p className="forecast-feed-date">
              <time
                className="forecast-feed-date-value"
                dateTime={activeWindow.periodStart}
              >
                {activeDateValue}
              </time>
            </p>
          </div>
        </div>
      </div>

      {!premium && activePeriod !== 'day' ? (
        <section className="forecast-feed-status is-locked" aria-live="polite">
          <h1>
            {language === 'ru'
              ? `${activePeriod === 'week' ? 'Неделя' : 'Месяц'} — в Premium`
              : `${activePeriod === 'week' ? 'Week' : 'Month'} is in Premium`}
          </h1>
          <p>
            {language === 'ru'
              ? 'Этот личный гороскоп доступен в Premium.'
              : 'This personal horoscope is available with Premium.'}
          </p>
          {canPromotePremium ? (
            <button type="button" onClick={requestPremium}>
              {language === 'ru' ? 'Посмотреть Premium' : 'View Premium'}
            </button>
          ) : null}
        </section>
      ) : forecast ? (
        <AiPersonalHoroscopeReading
          forecast={forecast}
          lockedSectionIds={lockedIds}
          language={language}
          canPromotePremium={canPromotePremium}
          onRequestPremium={requestPremium}
        />
      ) : state.phase === 'error' ? (
        <section className="forecast-feed-status is-error" aria-live="polite">
          <h1>{language === 'ru' ? 'Гороскоп пока не загрузился' : 'The horoscope has not loaded yet'}</h1>
          <p>{errorMessage(state.errorCode, language)}</p>
          <button type="button" onClick={() => loadPeriod(activePeriod, { retry: true })}>
            <RefreshCw size={17} aria-hidden />
            {language === 'ru' ? 'Повторить' : 'Retry'}
          </button>
        </section>
      ) : (
        <section
          className="forecast-feed-status forecast-feed-status--loading is-loading"
          aria-live="polite"
          aria-busy="true"
          aria-label={loadingLabel(activePeriod, language)}
        >
          <div className="forecast-feed-loading-indicator" aria-hidden>
            <LoaderCircle className="forecast-feed-loading-spinner" size={28} strokeWidth={2} />
          </div>
          <p className="forecast-feed-loading-label">{loadingLabel(activePeriod, language)}</p>
        </section>
      )}
    </div>
  );
});

Dashboard.displayName = 'Dashboard';
