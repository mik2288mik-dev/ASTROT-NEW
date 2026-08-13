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
import {
  PERSONAL_FORECAST_CONTRACT_VERSION,
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
import {
  resolveDiaryEditorialPauses,
  resolveDiaryTodayVisualPlan,
  type DiaryEditorialPause,
} from '../lib/personalForecastVisuals';
import { ForecastSectionBlock } from '../components/PersonalForecastFeed/ForecastSectionBlock';
import { TodayEditorialFeed } from '../components/PersonalForecastFeed/TodayEditorialFeed';
import {
  resolveRequestedPersonalForecastPeriod,
  updatePersonalForecastPeriodBucket,
} from '../components/PersonalForecastFeed/periodSelection';
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
  cacheOnly: boolean;
  promise: Promise<void>;
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
  onPremiumAnalytics,
  scrollRef,
  canPromotePremium = true,
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
  const activePeriod = resolveRequestedPersonalForecastPeriod(requestedPeriod);
  const [periodStates, setPeriodStates] = useState<Record<PersonalForecastPeriod, PeriodState>>({
    day: emptyPeriodState(),
    week: emptyPeriodState(),
    month: emptyPeriodState(),
  });
  const requestsRef = useRef<Partial<Record<PersonalForecastPeriod, PeriodRequest>>>({});
  const contextRef = useRef('');
  const accessContextRef = useRef('');
  const pendingSectionRef = useRef<string | null>(null);
  const stickerPlanCacheRef = useRef<Map<string, DiaryEditorialPause[]>>(new Map());
  const recentStickerIdsRef = useRef<string[]>([]);
  const previousPremiumRef = useRef(premium);

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
  const activePeriodTitle = {
    day: language === 'ru' ? 'Сегодня' : 'Today',
    week: language === 'ru' ? 'Неделя' : 'Week',
    month: language === 'ru' ? 'Месяц' : 'Month',
  }[activePeriod];
  const activeDateValue = activePeriod === 'day'
    ? activeDateLines[activeDateLines.length - 1]
    : activeDateLines.join(' ');

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
    stickerPlanCacheRef.current.clear();
    recentStickerIdsRef.current = [];
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
    if (!premium && period !== 'day') {
      setPeriodStates((current) => ({
        ...current,
        [period]: emptyPeriodState(),
      }));
      return;
    }
    const currentRequest = requestsRef.current[period];
    const cacheOnly = options?.cacheOnly === true;
    if (currentRequest && (!currentRequest.cacheOnly || cacheOnly)) return;

    const periodKey = periodKeys[period];
    const localCandidate = readLocalPersonalForecast({
      profile,
      chartData,
      chartId,
      period,
      periodKey,
    });
    const expectedAccessTier = premium ? 'premium' : 'free';
    const local = localCandidate?.accessTier === expectedAccessTier ? localCandidate : null;
    setPeriodStates((current) => {
      const currentResult = current[period]?.result;
      const retained = currentResult?.accessTier === expectedAccessTier ? currentResult : local;
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
        setPeriodStates((current) => updatePersonalForecastPeriodBucket(
          current,
          period,
          { result: next, phase: 'ready', errorCode: null },
        ));
      } catch (error) {
        if (
          accessContextRef.current !== requestContextKey
          || requestsRef.current[period] !== requestEntry
        ) return;
        if (
          (error as PersonalForecastClientError)?.code
            === 'PERSONAL_FORECAST_PREMIUM_REQUIRED'
        ) {
          setPeriodStates((current) => {
            const currentResult = current[period]?.result;
            const retained = currentResult?.accessTier === expectedAccessTier ? currentResult : local;
            return {
              ...current,
              [period]: {
                result: retained,
                phase: retained ? 'ready' : 'idle',
                errorCode: null,
              },
            };
          });
          void onRequestPremium?.('personal_forecast_feed', {
            period,
            periodKey,
            placement: period,
            featureKey: period === 'week' ? 'personal_weekly' : 'personal_monthly',
            triggerType: 'locked_feature',
            returnView: 'dashboard',
            returnScrollAnchor: 'personal-forecast-reading',
          });
          return;
        }
        const errorCode = (error as PersonalForecastClientError)?.code
          || 'PERSONAL_FORECAST_GENERATION_FAILED';
        setPeriodStates((current) => {
          const currentResult = current[period]?.result;
          const retained = currentResult?.accessTier === expectedAccessTier ? currentResult : local;
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
    onPremiumAnalytics,
    periodKeys,
    profile,
  ]);

  useEffect(() => {
    loadPeriod(activePeriod);
  }, [activePeriod, contextKey, loadPeriod]);

  useEffect(() => {
    const wasPremium = previousPremiumRef.current;
    previousPremiumRef.current = premium;
    if (!wasPremium && premium) {
      loadPeriod(activePeriod, { cacheOnly: true });
    } else if (wasPremium && !premium) {
      pendingSectionRef.current = null;
      onPeriodChange?.('day');
      setPeriodStates({
        day: emptyPeriodState(),
        week: emptyPeriodState(),
        month: emptyPeriodState(),
      });
    }
  }, [activePeriod, loadPeriod, onPeriodChange, premium]);

  const state = periodStates[activePeriod];
  const displayPeriod = activePeriod;
  const candidateResult = selectActiveReadyPersonalForecast(activePeriod, periodStates);
  const result = candidateResult?.accessTier === (premium ? 'premium' : 'free')
    ? candidateResult
    : null;
  const forecast = result?.forecast || null;
  const lockedIds = useMemo(
    () => new Set(result?.lockedSectionIds || []),
    [result?.lockedSectionIds],
  );
  const storySections = useMemo(
    () => (forecast ? [forecast.overview, ...forecast.sections] : []),
    [forecast],
  );
  const stickerEligibleSections = useMemo(
    () => storySections.filter((section) => (
      section.status === 'ready'
      && !lockedIds.has(section.id)
      && section.contentBlocks.some((block) => block.text.trim())
    )),
    [lockedIds, storySections],
  );
  const stickerPlanKey = useMemo(() => [
    userId,
    displayPeriod,
    forecast?.periodKey || '',
  ].join('|'), [
    displayPeriod,
    forecast?.periodKey,
    userId,
  ]);
  const todayVisualPlan = useMemo(() => resolveDiaryTodayVisualPlan({
    userId,
    periodKey: displayPeriod === 'day'
      ? forecast?.periodKey || periodKeys.day
      : periodKeys.day,
    contractVersion: forecast?.meta.contractVersion
      || PERSONAL_FORECAST_CONTRACT_VERSION,
  }), [
    displayPeriod,
    forecast?.meta.contractVersion,
    forecast?.periodKey,
    periodKeys.day,
    userId,
  ]);
  const stickerPauses = useMemo(() => {
    if (displayPeriod === 'day' || !forecast || !stickerEligibleSections.length) return [];
    const cached = stickerPlanCacheRef.current.get(stickerPlanKey);
    if (cached) return cached;
    const next = resolveDiaryEditorialPauses({
      userId,
      period: displayPeriod,
      periodKey: forecast.periodKey,
      sections: stickerEligibleSections,
      excludeAssetIds: recentStickerIdsRef.current,
    });
    stickerPlanCacheRef.current.set(stickerPlanKey, next);
    return next;
  }, [displayPeriod, forecast, stickerEligibleSections, stickerPlanKey, userId]);
  const stickerPausesBySection = useMemo(
    () => new Map(stickerPauses.map((pause) => [pause.afterSectionId, pause.asset])),
    [stickerPauses],
  );

  useEffect(() => {
    if (!stickerPauses.length) return;
    const current = recentStickerIdsRef.current;
    recentStickerIdsRef.current = [
      ...new Set([...stickerPauses.map((pause) => pause.asset.id), ...current]),
    ].slice(0, 18);
  }, [stickerPauses]);

  const scrollToSection = useCallback((sectionId: string) => {
    const root = scrollRef?.current;
    const target = document.getElementById(`forecast-section-${sectionId}`);
    if (!root || !target) return;
    const rootRect = root.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    root.scrollTo({
      top: Math.max(0, root.scrollTop + targetRect.top - rootRect.top - 84),
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

  useEffect(() => {
    if (!requestedPeriod) return;
    pendingSectionRef.current = null;
    scrollRef?.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [requestedPeriod, scrollRef]);

  const requestPremium = useCallback(() => {
    if (displayPeriod !== 'day') {
      onPremiumAnalytics?.('locked_feature_tapped', {
        placement: displayPeriod,
        featureKey: displayPeriod === 'week' ? 'personal_weekly' : 'personal_monthly',
        periodKey: forecast?.periodKey || periodKeys[displayPeriod],
      });
    }
    void onRequestPremium?.('personal_forecast_feed', {
      period: displayPeriod,
      periodKey: forecast?.periodKey || periodKeys[displayPeriod],
      placement: displayPeriod === 'day' ? 'today' : displayPeriod,
      featureKey: displayPeriod === 'day'
        ? 'personal_daily_full'
        : displayPeriod === 'week'
          ? 'personal_weekly'
          : 'personal_monthly',
      triggerType: displayPeriod === 'day' ? 'inline_promo' : 'locked_feature',
      returnView: 'dashboard',
      returnScrollAnchor: displayPeriod === 'day'
        ? 'today-premium-teaser'
        : 'personal-forecast-reading',
    });
  }, [displayPeriod, forecast?.periodKey, onPremiumAnalytics, onRequestPremium, periodKeys]);

  return (
    <div
      id="personal-forecast-reading"
      className={`fresh-page home-screen forecast-feed-page lumia-main-scroll is-${displayPeriod}`}
      ref={scrollRef as React.RefObject<HTMLDivElement>}
    >
      <section
        className="home-top"
        aria-label={language === 'ru' ? 'Твой Гороскоп' : 'Your Horoscope'}
      >
        <AppTopBar
          title={language === 'ru' ? 'Твой Гороскоп' : 'Your Horoscope'}
          subtitle={activePeriodTitle}
        />
      </section>
      <div className="forecast-feed-ambient" aria-hidden />

      {hasChart ? (
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
      ) : !premium && displayPeriod !== 'day' ? (
        <section className="forecast-feed-status is-locked" aria-live="polite">
          <h1>
            {language === 'ru'
              ? `${displayPeriod === 'week' ? 'Неделя' : 'Месяц'} — в Premium`
              : `${displayPeriod === 'week' ? 'Week' : 'Month'} is in Premium`}
          </h1>
          <p>
            {language === 'ru'
              ? 'Этот личный прогноз не создаётся в Free. Открой Premium, когда захочешь продолжить.'
              : 'This personal forecast is not generated on Free. Open Premium when you want to continue.'}
          </p>
          {canPromotePremium ? (
            <button type="button" onClick={requestPremium}>
              {language === 'ru' ? 'Посмотреть Premium' : 'View Premium'}
            </button>
          ) : null}
        </section>
      ) : !forecast || forecast.meta.status !== 'ready' ? (
        state.phase === 'error' ? (
          <section
            className={`forecast-feed-status is-${state.phase}`}
            aria-live="polite"
          >
            <h1>{language === 'ru' ? 'Прогноз пока не загрузился' : 'The forecast has not loaded yet'}</h1>
            <p>{personalForecastErrorMessage(state.errorCode, language)}</p>
            <button type="button" onClick={() => loadPeriod(activePeriod, { retry: true })}>
              <RefreshCw size={17} aria-hidden />
              {language === 'ru' ? 'Повторить' : 'Retry'}
            </button>
          </section>
        ) : (
          <section
            className={`forecast-feed-status forecast-feed-status--loading is-${state.phase}`}
            aria-live="polite"
            aria-busy="true"
            aria-label={personalForecastLoadingLabel(activePeriod, language)}
          >
            <div className="forecast-feed-loading-indicator" aria-hidden="true">
              <LoaderCircle className="forecast-feed-loading-spinner" size={28} strokeWidth={2} />
            </div>
            <p className="forecast-feed-loading-label">
              {personalForecastLoadingLabel(activePeriod, language)}
            </p>
          </section>
        )
      ) : displayPeriod === 'day' ? (
        <TodayEditorialFeed
          sections={storySections}
          lockedSectionIds={lockedIds}
          pauses={stickerPauses}
          visualPlan={todayVisualPlan}
          userId={userId}
          periodKey={forecast.periodKey}
          language={language}
          premium={premium}
          onRequestPremium={requestPremium}
          onFirstValueViewed={() => onPremiumAnalytics?.('first_value_viewed', {
            placement: 'today',
            featureKey: 'personal_daily',
            periodKey: forecast.periodKey,
          })}
          onPremiumTeaserImpression={() => onPremiumAnalytics?.('premium_promo_impression', {
            placement: 'today',
            featureKey: 'personal_daily_full',
            periodKey: forecast.periodKey,
          })}
          onPremiumTeaserClick={() => onPremiumAnalytics?.('premium_promo_clicked', {
            placement: 'today',
            featureKey: 'personal_daily_full',
            periodKey: forecast.periodKey,
          })}
          onPremiumTeaserDismiss={() => onPremiumAnalytics?.('premium_promo_dismissed', {
            placement: 'today',
            featureKey: 'personal_daily_full',
            periodKey: forecast.periodKey,
          })}
        />
      ) : (
        <article
          className="forecast-feed-story forecast-editorial-reading forecast-period-editorial-feed"
          data-forecast-period={displayPeriod}
          lang={language}
        >
          {storySections.map((section) => (
            <ForecastSectionBlock
              key={`${displayPeriod}:${forecast.periodKey}:${section.id}`}
              section={section}
              period={displayPeriod}
              language={language}
              locked={lockedIds.has(section.id)}
              sticker={stickerPausesBySection.get(section.id) || null}
              onRequestPremium={requestPremium}
            />
          ))}
        </article>
      )}
    </div>
  );
});

Dashboard.displayName = 'Dashboard';
