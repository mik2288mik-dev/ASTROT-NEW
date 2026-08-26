import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import type { UserProfile } from '../types';
import { hasActivePremium } from '../lib/accessMatrix';
import {
  buildPersonalForecastBirthProfileFingerprint,
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
import { ForecastSectionBlock } from '../components/PersonalForecastFeed/ForecastSectionBlock';
import { TodayEditorialFeed } from '../components/PersonalForecastFeed/TodayEditorialFeed';
import {
  TodayCalendarClock,
  TodayLineField,
} from '../components/PersonalForecastFeed/TodayCalendarClock';
import { AppTopBar } from '../components/lumia-ui/AppTopBar';
import { EditorialChartsButton } from '../components/editorial/EditorialScreenChrome';
import { lumiaSelectionHaptic } from '../lib/haptics';
import { selectForecastEndEditorialAsset } from '../lib/personalForecastVisuals';
import { formatPersonalForecastAttribution } from '../lib/personalForecastPresentation';

type DashboardProps = {
  profile: UserProfile;
  currentDateKey?: string;
  onCreateNatalChart?: () => void;
  requestedPeriod?: PersonalForecastPeriod;
  onPeriodChange?: (period: PersonalForecastPeriod) => void;
  onOpenCharts?: () => void;
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
      day: 'Creating your personal reading for today',
      week: 'Creating your personal reading for the week',
      month: 'Creating your personal reading for the month',
    }[period];
  }
  return {
    day: 'Создаём твой личный прогноз на сегодня',
    week: 'Создаём твой личный прогноз на неделю',
    month: 'Создаём твой личный прогноз на месяц',
  }[period];
}

function errorMessage(
  code: string | null,
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    if (code === 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED') {
      return 'The structured answer was incomplete. Retry this period only.';
    }
    if (code === 'PERSONAL_FORECAST_WRITER_INCOMPLETE') {
      return 'The forecast was incomplete. Retry this period only.';
    }
    return 'The forecast did not load. Other application sections still work.';
  }
  if (code === 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED') {
    return 'Структурированный ответ получился неполным. Повторим только этот период.';
  }
  if (code === 'PERSONAL_FORECAST_WRITER_INCOMPLETE') {
    return 'Текст получился неполным. Повторим только этот период.';
  }
  return 'Прогноз не загрузился. Остальные разделы приложения работают.';
}

export const Dashboard = memo<DashboardProps>(({
  profile,
  currentDateKey,
  onCreateNatalChart,
  requestedPeriod,
  onPeriodChange,
  onOpenCharts,
  onRequestPremium,
  onPremiumAnalytics,
  scrollRef,
  canPromotePremium = true,
}) => {
  const reduceMotion = useReducedMotion();
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const premium = hasActivePremium(profile);
  const activePeriod: PersonalForecastPeriod = requestedPeriod || 'day';
  const timezone = normalizeForecastTimezone(profile.birthTimezone);
  const requestsRef = useRef<Partial<Record<PersonalForecastPeriod, PeriodRequest>>>({});
  const firstValueSeenRef = useRef<Set<string>>(new Set());
  const promoSeenRef = useRef<Set<string>>(new Set());
  const periodTabRefs = useRef<Partial<Record<PersonalForecastPeriod, HTMLButtonElement | null>>>({});
  const [focusedPeriod, setFocusedPeriod] = useState<PersonalForecastPeriod>(activePeriod);
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
    () => resolvePersonalForecastWindow(
      activePeriod,
      periodKeys[activePeriod],
      timezone,
    ),
    [activePeriod, periodKeys, timezone],
  );
  const activeDateLines = useMemo(
    () => formatPersonalForecastDateLabel(activeWindow, language)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    [activeWindow, language],
  );
  const periodLabels: Record<PersonalForecastPeriod, string> = {
    day: language === 'ru' ? 'Сегодня' : 'Today',
    week: language === 'ru' ? 'Неделя' : 'Week',
    month: language === 'ru' ? 'Месяц' : 'Month',
  };
  const activePeriodTitle = periodLabels[activePeriod];
  const personalForecastNote: Record<PersonalForecastPeriod, string> = language === 'ru'
    ? {
        day: 'Личный прогноз на сегодня — по твоим данным рождения.',
        week: 'Личный прогноз на неделю — по твоим данным рождения.',
        month: 'Личный прогноз на месяц — по твоим данным рождения.',
      }
    : {
        day: 'Your personal forecast for today — based on your birth details.',
        week: 'Your personal forecast for the week — based on your birth details.',
        month: 'Your personal forecast for the month — based on your birth details.',
      };
  const activeDateValue = activePeriod === 'day'
    ? activeDateLines[activeDateLines.length - 1]
    : activeDateLines.join(' ');
  const personalForecastAttribution = useMemo(
    () => formatPersonalForecastAttribution({
      profile: {
        name: profile.name,
        birthDate: profile.birthDate,
      },
      window: activeWindow,
      language,
    }),
    [activeWindow, language, profile.birthDate, profile.name],
  );

  const productContextKey = [
    String(profile.id || 'guest'),
    buildPersonalForecastBirthProfileFingerprint(profile),
    language,
    timezone,
    periodKeys.day,
    premium ? 'premium' : 'free',
  ].join(':');

  useEffect(() => {
    requestsRef.current = {};
    if (!profile.name.trim() || !profile.birthDate.trim()) {
      setPeriodStates({
        day: emptyPeriodState(),
        week: emptyPeriodState(),
        month: emptyPeriodState(),
      });
      return;
    }
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
    if (!profile.name.trim() || !profile.birthDate.trim()) return;
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
          errorCode: current[period]?.result
            ? null
            : error.code || 'PERSONAL_FORECAST_GENERATION_FAILED',
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
    scrollRef?.current?.scrollTo({
      top: 0,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activePeriod, reduceMotion, scrollRef]);

  useEffect(() => {
    setFocusedPeriod(activePeriod);
  }, [activePeriod]);

  const selectPeriod = useCallback((period: PersonalForecastPeriod) => {
    if (period === activePeriod) return;
    lumiaSelectionHaptic();
    onPeriodChange?.(period);
  }, [activePeriod, onPeriodChange]);

  const handlePeriodTabKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLButtonElement>,
    period: PersonalForecastPeriod,
  ) => {
    const currentIndex = FORECAST_PERIODS.indexOf(period);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % FORECAST_PERIODS.length;
    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + FORECAST_PERIODS.length) % FORECAST_PERIODS.length;
    }
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = FORECAST_PERIODS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextPeriod = FORECAST_PERIODS[nextIndex];
    setFocusedPeriod(nextPeriod);
    periodTabRefs.current[nextPeriod]?.focus();
  }, []);

  const state = periodStates[activePeriod];
  const result = selectActiveReadyPersonalForecast(activePeriod, periodStates);
  const forecast = result?.forecast || null;
  const storySections = useMemo(
    () => forecast ? [forecast.overview, ...forecast.sections] : [],
    [forecast],
  );
  const lockedSectionIds = useMemo(
    () => new Set(result?.lockedSectionIds || []),
    [result?.lockedSectionIds],
  );
  const periodEndVisual = useMemo(() => {
    if (!forecast || activePeriod === 'day') return null;
    return selectForecastEndEditorialAsset({
      userId: String(profile.id || 'guest'),
      period: activePeriod,
      periodKey: forecast.periodKey,
      sections: storySections,
    });
  }, [activePeriod, forecast, profile.id, storySections]);
  const periodAdviceSectionId = useMemo(() => {
    for (let index = storySections.length - 1; index >= 0; index -= 1) {
      const section = storySections[index];
      if (section.contentBlocks.some((block) => block.role === 'action')) {
        return section.id;
      }
    }
    return null;
  }, [storySections]);

  useEffect(() => {
    if (!forecast || activePeriod !== 'day') return;
    const key = `${String(profile.id || 'guest')}:${forecast.periodKey}`;
    if (firstValueSeenRef.current.has(key)) return;
    firstValueSeenRef.current.add(key);
    onPremiumAnalytics?.('first_value_viewed', {
      placement: 'today',
      featureKey: 'personal_daily',
      periodKey: forecast.periodKey,
      contentMode: 'personal-forecast',
    });
  }, [activePeriod, forecast, onPremiumAnalytics, profile.id]);

  useEffect(() => {
    if (!forecast || !lockedSectionIds.size || !canPromotePremium) return;
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
  }, [activePeriod, canPromotePremium, forecast, lockedSectionIds.size, onPremiumAnalytics, profile.id]);

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
      className={`fresh-page home-screen forecast-feed-page lumia-main-scroll lumia-bottom-tab-scroll is-${activePeriod}`}
      ref={scrollRef as React.RefObject<HTMLDivElement>}
    >
      <section
        className="home-top"
        aria-label={language === 'ru' ? 'Личный гороскоп' : 'Personal horoscope'}
      >
        <AppTopBar
          title="NEBO"
          rightAction={(
            <EditorialChartsButton
              label={language === 'ru' ? 'Открыть мои карты' : 'Open my charts'}
              onClick={onOpenCharts}
            />
          )}
        />
      </section>

      <nav
        className="today-period-navigation"
        role="tablist"
        aria-label={language === 'ru' ? 'Период личного прогноза' : 'Personal forecast period'}
      >
        <div className="today-period-tabs" role="presentation">
          {FORECAST_PERIODS.map((period) => (
            <button
              key={period}
              id={`today-period-tab-${period}`}
              type="button"
              className="today-period-tab"
              role="tab"
              ref={(node) => {
                periodTabRefs.current[period] = node;
              }}
              aria-controls="today-period-panel"
              aria-selected={period === activePeriod}
              tabIndex={period === focusedPeriod ? 0 : -1}
              onFocus={() => setFocusedPeriod(period)}
              onKeyDown={(event) => handlePeriodTabKeyDown(event, period)}
              onClick={() => selectPeriod(period)}
            >
              <span>{periodLabels[period]}</span>
              {period === activePeriod ? (
                <span
                  className="today-period-tab-underline"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          ))}
        </div>
      </nav>

      <p className="today-period-personal-note">
        {personalForecastNote[activePeriod]}
      </p>

      {activePeriod !== 'day' ? (
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
      ) : null}

      <div
        id="today-period-panel"
        role="tabpanel"
        aria-labelledby={`today-period-tab-${activePeriod}`}
      >
      {!profile.name.trim() || !profile.birthDate.trim() ? (
        <section className="forecast-feed-status">
          <h1>{language === 'ru' ? 'Добавь данные рождения' : 'Add your birth details'}</h1>
          <p>
            {language === 'ru'
              ? 'Нужны имя и дата рождения. Главный экран останется доступен.'
              : 'A name and birth date are required for a personal forecast. The home screen stays available.'}
          </p>
          <button type="button" onClick={onCreateNatalChart}>
            {language === 'ru' ? 'Создать карту' : 'Create a chart'}
          </button>
        </section>
      ) : !premium && activePeriod !== 'day' ? (
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
      ) : forecast && activePeriod === 'day' ? (
        <TodayEditorialFeed
          sections={storySections}
          lockedSectionIds={lockedSectionIds}
          userId={String(profile.id || 'guest')}
          periodKey={forecast.periodKey}
          timezone={timezone}
          language={language}
          tone={forecast.meta.astrologerBrief.tone}
          premium={premium || !canPromotePremium}
          personalAttribution={personalForecastAttribution}
          onRequestPremium={requestPremium}
          onPremiumTeaserDismiss={() => {
            onPremiumAnalytics?.('premium_promo_dismissed', {
              placement: 'today',
              featureKey: 'personal_daily_full',
              periodKey: forecast.periodKey,
            });
          }}
        />
      ) : forecast ? (
        <article
          className="forecast-feed-story forecast-editorial-reading forecast-period-editorial-feed"
          data-forecast-period={activePeriod}
          lang={language}
        >
          {storySections.map((section) => (
            <ForecastSectionBlock
              key={`${activePeriod}:${forecast.periodKey}:${section.id}`}
              section={section}
              period={activePeriod}
              language={language}
              locked={lockedSectionIds.has(section.id)}
              onRequestPremium={requestPremium}
              endVisualAsset={section.id === periodAdviceSectionId ? periodEndVisual : null}
            />
          ))}
          {periodAdviceSectionId
            && !lockedSectionIds.has(periodAdviceSectionId)
            && personalForecastAttribution ? (
              <p className="today-period-personal-note forecast-personal-attribution">
                {personalForecastAttribution}
              </p>
            ) : null}
        </article>
      ) : state.phase === 'error' ? (
        <section className="forecast-feed-status is-error" aria-live="polite">
          <h1>{language === 'ru' ? 'Прогноз пока не загрузился' : 'The forecast has not loaded yet'}</h1>
          <p>{errorMessage(state.errorCode, language)}</p>
          <button type="button" onClick={() => loadPeriod(activePeriod, { retry: true })}>
            <RefreshCw size={17} aria-hidden />
            {language === 'ru' ? 'Повторить' : 'Retry'}
          </button>
        </section>
      ) : activePeriod === 'day' ? (
        <section
          className="today-minimal-hero today-minimal-loading"
          aria-live="polite"
          aria-busy="true"
          aria-label={loadingLabel(activePeriod, language)}
        >
          <h1 className="sr-only">
            {language === 'ru' ? 'Личный прогноз на сегодня' : 'Your personal forecast for today'}
          </h1>
          <div className="today-minimal-composition">
            <TodayLineField
              userId={String(profile.id || 'guest')}
              periodKey={periodKeys.day}
            />
            <TodayCalendarClock
              userId={String(profile.id || 'guest')}
              periodKey={periodKeys.day}
              timezone={timezone}
              language={language}
            />
            <div className="today-minimal-loading-copy" role="status">
              <LoaderCircle
                className="forecast-feed-loading-spinner"
                size={23}
                strokeWidth={1.5}
                aria-hidden
              />
              <p>{loadingLabel(activePeriod, language)}</p>
            </div>
          </div>
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
    </div>
  );
});

Dashboard.displayName = 'Dashboard';
