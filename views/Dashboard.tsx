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
import { hasActivePremium, hasNatalChart } from '../lib/accessMatrix';
import { lumiaSelectionHaptic } from '../lib/haptics';
import {
  buildPersonalForecastChartFingerprint,
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
import { AppTopBar } from '../components/lumia-ui/AppTopBar';

type DashboardProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  currentDateKey?: string;
  onCreateNatalChart?: () => void;
  requestedPeriod?: PersonalForecastPeriod;
  onPeriodChange?: (period: PersonalForecastPeriod) => void;
  onRequestPremium?: (
    source?: string,
    eventPayload?: Record<string, unknown>,
  ) => Promise<void> | void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};

type PeriodState = {
  result: PersonalForecastClientResult | null;
  phase: 'idle' | 'loading' | 'ready' | 'error';
  errorCode: string | null;
};

type PeriodRequest = {
  cacheOnly: boolean;
  promise: Promise<void>;
};

type PendingPeriodSelection = {
  period: PersonalForecastPeriod;
  targetSectionId?: string;
};

const FORECAST_PERIODS: readonly PersonalForecastPeriod[] = ['day', 'week', 'month'];

function personalForecastLoadingLabel(
  period: PersonalForecastPeriod,
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    return {
      day: 'Creating your first personal reading',
      week: 'Creating your first weekly reading',
      month: 'Creating your first monthly reading',
    }[period];
  }
  return {
    day: 'Создаём первый личный разбор',
    week: 'Создаём первый недельный разбор',
    month: 'Создаём первый месячный разбор',
  }[period];
}

function emptyPeriodState(): PeriodState {
  return { result: null, phase: 'idle', errorCode: null };
}

function personalForecastErrorMessage(
  code: string | null,
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    if (code === 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED') {
      return 'This forecast text did not pass its quality check. Retry to recalculate only this period.';
    }
    if (code === 'PERSONAL_FORECAST_WRITER_INCOMPLETE') {
      return 'The forecast response was incomplete. Retry to recalculate only this period.';
    }
    if (code === 'PERSONAL_FORECAST_EVIDENCE_EMPTY') {
      return 'We could not collect enough data for this period yet. Retry this calculation.';
    }
    return 'Other sections remain available. You can retry only this calculation.';
  }
  if (code === 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED') {
    return 'Текст прогноза не прошёл внутреннюю проверку. Нажми «Повторить» — пересчитаем только этот период.';
  }
  if (code === 'PERSONAL_FORECAST_WRITER_INCOMPLETE') {
    return 'Ответ для прогноза получился неполным. Нажми «Повторить» — пересчитаем только этот период.';
  }
  if (code === 'PERSONAL_FORECAST_EVIDENCE_EMPTY') {
    return 'Для этого периода пока не удалось собрать достаточно данных. Повтори расчёт позже.';
  }
  return 'Остальные разделы доступны. Можно повторить только этот расчёт.';
}

export const Dashboard = memo<DashboardProps>(({
  profile,
  chartData,
  chartId,
  currentDateKey,
  onCreateNatalChart,
  requestedPeriod,
  onPeriodChange,
  onRequestPremium,
  scrollRef,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const userId = String(profile.id || 'guest');
  const premium = hasActivePremium(profile);
  const hasChart = hasNatalChart(profile, {
    chartData,
    primaryChartId: chartId ?? null,
  });
  const timezone = normalizeForecastTimezone(
    chartData?.timezone || profile.birthTimezone,
  );
  const chartFingerprint = chartData
    ? buildPersonalForecastChartFingerprint(chartData)
    : 'none';
  const [activePeriod, setActivePeriod] = useState<PersonalForecastPeriod>('day');
  const [periodStates, setPeriodStates] = useState<Record<PersonalForecastPeriod, PeriodState>>({
    day: emptyPeriodState(),
    week: emptyPeriodState(),
    month: emptyPeriodState(),
  });
  const requestsRef = useRef<Partial<Record<PersonalForecastPeriod, PeriodRequest>>>({});
  const contextRef = useRef('');
  const accessContextRef = useRef('');
  const pendingSectionRef = useRef<string | null>(null);
  const pendingPeriodRef = useRef<PendingPeriodSelection | null>(null);

  const periodKeys = useMemo<Record<PersonalForecastPeriod, string>>(() => ({
    day: getPersonalForecastPeriodKey('day', new Date(), timezone),
    week: getPersonalForecastPeriodKey('week', new Date(), timezone),
    month: getPersonalForecastPeriodKey('month', new Date(), timezone),
  }), [currentDateKey, timezone]);
  const activeWindow = useMemo(
    () => resolvePersonalForecastWindow(activePeriod, periodKeys[activePeriod], timezone),
    [activePeriod, periodKeys, timezone],
  );
  const activeDateLines = useMemo(
    () => formatPersonalForecastDateLabel(activeWindow, language)
      .split('\n')
      .filter(Boolean),
    [activeWindow, language],
  );

  const contextKey = useMemo(() => [
    userId,
    chartId ?? 'primary',
    chartData?.calculationVersion || 'none',
    chartFingerprint,
    timezone,
    language,
    periodKeys.day,
  ].join(':'), [
    chartData?.calculationVersion,
    chartFingerprint,
    chartId,
    language,
    periodKeys.day,
    timezone,
    userId,
  ]);
  const accessContextKey = `${contextKey}:${premium ? 'premium' : 'free'}`;
  useEffect(() => {
    if (contextRef.current === contextKey) return;
    contextRef.current = contextKey;
    requestsRef.current = {};
    if (!chartData || !hasChart) {
      setPeriodStates({
        day: emptyPeriodState(),
        week: emptyPeriodState(),
        month: emptyPeriodState(),
      });
      return;
    }
    const localResults = Object.fromEntries(
      FORECAST_PERIODS.map((id) => [id, readLocalPersonalForecast({
        profile,
        chartData,
        chartId,
        period: id,
        periodKey: periodKeys[id],
      })]),
    ) as Record<PersonalForecastPeriod, PersonalForecastClientResult | null>;
    setPeriodStates({
      day: { result: localResults.day, phase: localResults.day ? 'ready' : 'idle', errorCode: null },
      week: { result: localResults.week, phase: localResults.week ? 'ready' : 'idle', errorCode: null },
      month: { result: localResults.month, phase: localResults.month ? 'ready' : 'idle', errorCode: null },
    });
  }, [
    chartData,
    chartId,
    contextKey,
    hasChart,
    periodKeys.day,
    periodKeys.month,
    periodKeys.week,
    profile,
    chartFingerprint,
    userId,
  ]);

  useEffect(() => {
    if (accessContextRef.current === accessContextKey) return;
    accessContextRef.current = accessContextKey;
    requestsRef.current = {};
  }, [accessContextKey]);

  const loadPeriod = useCallback((
    period: PersonalForecastPeriod,
    options?: { retry?: boolean; cacheOnly?: boolean },
  ) => {
    if (!chartData || !hasChart) return;
    const currentRequest = requestsRef.current[period];
    const cacheOnly = options?.cacheOnly === true;
    if (currentRequest && (!currentRequest.cacheOnly || cacheOnly)) return;

    const periodKey = periodKeys[period];
    const local = readLocalPersonalForecast({
      profile,
      chartData,
      chartId,
      period,
      periodKey,
    });
    setPeriodStates((current) => {
      const retained = current[period]?.result || local;
      return {
        ...current,
        [period]: {
          result: retained,
          phase: retained ? 'ready' : cacheOnly ? 'idle' : 'loading',
          errorCode: null,
        },
      };
    });

    const requestContextKey = accessContextKey;
    const requestEntry: PeriodRequest = {
      cacheOnly,
      promise: Promise.resolve(),
    };
    const request = (async () => {
      try {
        const next = await loadPersonalForecast({
          profile,
          chartData,
          chartId,
          period,
          periodKey,
          options: {
            force: options?.retry,
            cacheOnly: options?.cacheOnly,
            maxInProgressRetries: 60,
          },
        });
        if (
          accessContextRef.current !== requestContextKey
          || requestsRef.current[period] !== requestEntry
        ) return;
        setPeriodStates((current) => ({
          ...current,
          [period]: { result: next, phase: 'ready', errorCode: null },
        }));
      } catch (error) {
        if (
          accessContextRef.current !== requestContextKey
          || requestsRef.current[period] !== requestEntry
        ) return;
        if (
          (error as PersonalForecastClientError)?.code
            === 'PERSONAL_FORECAST_PREMIUM_REQUIRED'
        ) {
          setPeriodStates((current) => ({
            ...current,
            [period]: {
              result: current[period]?.result || local,
              phase: current[period]?.result || local ? 'ready' : 'idle',
              errorCode: null,
            },
          }));
          void onRequestPremium?.('personal_forecast_feed', {
            period,
            periodKey,
            returnInPlace: true,
          });
          return;
        }
        const errorCode = (error as PersonalForecastClientError)?.code
          || 'PERSONAL_FORECAST_GENERATION_FAILED';
        setPeriodStates((current) => {
          const retained = current[period]?.result || local;
          return {
            ...current,
            [period]: {
              result: retained,
              phase: retained ? 'ready' : cacheOnly ? 'idle' : 'error',
              errorCode: retained || cacheOnly ? null : errorCode,
            },
          };
        });
      }
    })();
    requestEntry.promise = request;
    requestsRef.current[period] = requestEntry;
    void request.then(() => {
      if (requestsRef.current[period] === requestEntry) {
        delete requestsRef.current[period];
      }
    });
  }, [
    chartData,
    chartId,
    hasChart,
    premium,
    accessContextKey,
    onRequestPremium,
    periodKeys,
    profile,
  ]);

  useEffect(() => {
    loadPeriod('day');
  }, [contextKey, loadPeriod]);

  const state = periodStates[activePeriod];
  const displayPeriod = activePeriod;
  const result = selectActiveReadyPersonalForecast(activePeriod, periodStates);
  const forecast = result?.forecast || null;
  const lockedIds = useMemo(
    () => new Set(result?.lockedSectionIds || []),
    [result?.lockedSectionIds],
  );

  const scrollToSection = useCallback((sectionId: string) => {
    const root = scrollRef?.current;
    const target = document.getElementById(`forecast-section-${sectionId}`);
    if (!root || !target) return;
    root.scrollTo({
      top: Math.max(0, target.offsetTop - 84),
      behavior: 'smooth',
    });
  }, [scrollRef]);

  useEffect(() => {
    if (!forecast || !pendingSectionRef.current) return;
    const target = pendingSectionRef.current;
    pendingSectionRef.current = null;
    const frame = window.requestAnimationFrame(() => scrollToSection(target));
    return () => window.cancelAnimationFrame(frame);
  }, [forecast, scrollToSection]);

  const selectPeriod = useCallback((
    period: PersonalForecastPeriod,
    targetSectionId?: string,
    silently = false,
  ) => {
    if (!silently) lumiaSelectionHaptic();
    if (targetSectionId) pendingSectionRef.current = targetSectionId;
    loadPeriod(period);
    if (!selectActiveReadyPersonalForecast(period, periodStates)) {
      if (periodStates[period].phase !== 'error') {
        pendingPeriodRef.current = { period, targetSectionId };
      } else {
        pendingPeriodRef.current = null;
      }
      return;
    }
    pendingPeriodRef.current = null;
    setActivePeriod(period);
    onPeriodChange?.(period);
    if (!targetSectionId) {
      scrollRef?.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [loadPeriod, onPeriodChange, periodStates, scrollRef]);

  useEffect(() => {
    if (!requestedPeriod || requestedPeriod === activePeriod) return;
    if (periodStates[requestedPeriod].phase === 'error') return;
    selectPeriod(requestedPeriod, undefined, true);
  }, [activePeriod, periodStates, requestedPeriod, selectPeriod]);

  useEffect(() => {
    const pending = pendingPeriodRef.current;
    if (!pending || periodStates[pending.period].phase === 'error') return;
    if (!selectActiveReadyPersonalForecast(pending.period, periodStates)) return;
    selectPeriod(pending.period, pending.targetSectionId, true);
  }, [periodStates, selectPeriod]);

  const requestPremium = useCallback(() => {
    void onRequestPremium?.('personal_forecast_feed', {
      period: displayPeriod,
      periodKey: forecast?.periodKey || periodKeys[displayPeriod],
      returnInPlace: true,
    });
  }, [displayPeriod, forecast?.periodKey, onRequestPremium, periodKeys]);

  return (
    <div
      className="fresh-page home-screen forecast-feed-page lumia-main-scroll lumia-bottom-tab-scroll"
      ref={scrollRef as React.RefObject<HTMLDivElement>}
    >
      <section
        className="home-top"
        aria-label={language === 'ru' ? 'Твой Гороскоп' : 'Your Horoscope'}
      >
        <AppTopBar
          title={language === 'ru' ? 'Твой Гороскоп' : 'Your Horoscope'}
          reserveSpace={false}
        />
      </section>
      <div className="forecast-feed-ambient" aria-hidden />

      {hasChart ? (
        <div className="forecast-feed-reading-header">
          <div className="forecast-feed-date-zone" aria-label={activeDateLines.join(' ')}>
            <div className="forecast-feed-date-cluster">
              <p className="forecast-feed-date">
                {activeDateLines.length > 1 ? (
                  <>
                    <span className="forecast-feed-date-weekday">{activeDateLines[0]}</span>
                    <span className="forecast-feed-date-value">{activeDateLines.slice(1).join(' ')}</span>
                  </>
                ) : (
                  <span className="forecast-feed-date-value">{activeDateLines[0]}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {!hasChart ? (
        <section className="forecast-feed-status">
          <h1>
            {language === 'ru'
              ? 'Добавь данные рождения'
              : 'Add your birth details'}
          </h1>
          <p>
            {language === 'ru'
              ? 'Карта нужна для личного расчёта. Главный экран останется доступен.'
              : 'A chart is required for a personal calculation. The home screen stays available.'}
          </p>
          <button type="button" onClick={onCreateNatalChart}>
            {language === 'ru' ? 'Создать карту' : 'Create a chart'}
          </button>
        </section>
      ) : !forecast || forecast.meta.status !== 'ready' ? (
        <section
          className={`forecast-feed-status${state.phase === 'error' ? '' : ' forecast-feed-status--loading'} is-${state.phase}`}
          aria-live="polite"
          aria-busy={state.phase !== 'error'}
          aria-label={state.phase === 'error'
            ? undefined
            : personalForecastLoadingLabel(activePeriod, language)}
        >
          {state.phase === 'error' ? (
            <>
              <h1>{language === 'ru' ? 'Прогноз пока не загрузился' : 'The forecast has not loaded yet'}</h1>
              <p>{personalForecastErrorMessage(state.errorCode, language)}</p>
              <button type="button" onClick={() => loadPeriod(activePeriod, { retry: true })}>
                <RefreshCw size={17} aria-hidden />
                {language === 'ru' ? 'Повторить' : 'Retry'}
              </button>
            </>
          ) : (
            <div className="forecast-feed-loading-indicator" aria-hidden="true">
              <LoaderCircle className="forecast-feed-loading-spinner" size={28} strokeWidth={2} />
            </div>
          )}
        </section>
      ) : (
        <>
          <ForecastSectionBlock
            key={`${displayPeriod}:${forecast.periodKey}:${forecast.overview.id}`}
            section={forecast.overview}
            period={displayPeriod}
            language={language}
            locked={lockedIds.has(forecast.overview.id)}
            onRequestPremium={requestPremium}
          />
        </>
      )}
    </div>
  );
});

Dashboard.displayName = 'Dashboard';
