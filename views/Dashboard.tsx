import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Bell, RefreshCw } from 'lucide-react';
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
  forecastSectionVisualStyle,
  resolvePersonalForecastVisuals,
} from '../lib/personalForecastVisuals';
import {
  resolvePersonalForecastPromotions,
  type PersonalForecastPromoPlacement,
} from '../lib/personalForecastPromo';
import {
  loadPersonalForecast,
  readLocalPersonalForecast,
  type PersonalForecastClientError,
  type PersonalForecastClientResult,
} from '../services/personalForecastService';
import { ForecastPromotion } from '../components/PersonalForecastFeed/ForecastPromotion';
import { ForecastQuestions } from '../components/PersonalForecastFeed/ForecastQuestions';
import { ForecastSectionBlock } from '../components/PersonalForecastFeed/ForecastSectionBlock';
import { AppTopBar } from '../components/lumia-ui/AppTopBar';
import {
  AstrologyDetailsToggle,
  useAstrologyDetailsPreference,
} from '../components/AstrologyDetailsToggle';
import type {
  PersonalForecastQuestionNotification,
} from '../services/personalForecastQuestionService';

type DashboardProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  currentDateKey?: string;
  onCreateNatalChart?: () => void;
  onOpenSynastry?: () => void;
  onOpenHoroscope?: () => void;
  requestedPeriod?: PersonalForecastPeriod;
  onRequestPremium?: (
    source?: string,
    eventPayload?: Record<string, unknown>,
  ) => Promise<void> | void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};

type PeriodState = {
  result: PersonalForecastClientResult | null;
  phase: 'idle' | 'loading' | 'ready' | 'error';
};

type PeriodRequest = {
  cacheOnly: boolean;
  promise: Promise<void>;
};

type DisplayedForecast = {
  identityKey: string;
  period: PersonalForecastPeriod;
  result: PersonalForecastClientResult;
};

const PERIOD_TABS: ReadonlyArray<{
  id: PersonalForecastPeriod;
  ru: string;
  en: string;
}> = [
  { id: 'day', ru: 'Сегодня', en: 'Today' },
  { id: 'week', ru: 'Неделя', en: 'Week' },
  { id: 'month', ru: 'Месяц', en: 'Month' },
] as const;

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
  return { result: null, phase: 'idle' };
}

type PersonalForecastPromoSlot = {
  id: string;
  afterSectionId: string;
  layout: 'pair' | 'single';
  placements: PersonalForecastPromoPlacement[];
};

function groupPromotionsBySection(
  placements: PersonalForecastPromoPlacement[],
): Map<string, PersonalForecastPromoSlot[]> {
  const grouped = new Map<string, PersonalForecastPromoSlot[]>();
  const addSlot = (slot: PersonalForecastPromoSlot) => {
    const current = grouped.get(slot.afterSectionId) || [];
    current.push(slot);
    grouped.set(slot.afterSectionId, current);
  };

  const mandatory = placements.filter(
    (placement) => placement.placementType === 'mandatory',
  );
  if (mandatory.length) {
    const anchor = mandatory.reduce((latest, placement) => (
      placement.afterSectionIndex > latest.afterSectionIndex
        ? placement
        : latest
    ));
    addSlot({
      id: mandatory.map((placement) => placement.id).join('|'),
      afterSectionId: anchor.afterSectionId,
      layout: mandatory.length > 1 ? 'pair' : 'single',
      placements: mandatory,
    });
  }

  for (const placement of placements) {
    if (placement.placementType !== 'contextual') continue;
    addSlot({
      id: placement.id,
      afterSectionId: placement.afterSectionId,
      layout: 'single',
      placements: [placement],
    });
  }
  return grouped;
}

function safeResolvePromotions(input: Parameters<typeof resolvePersonalForecastPromotions>[0]) {
  try {
    return resolvePersonalForecastPromotions(input);
  } catch {
    return [];
  }
}

export const Dashboard = memo<DashboardProps>(({
  profile,
  chartData,
  chartId,
  currentDateKey,
  onCreateNatalChart,
  onOpenSynastry,
  onOpenHoroscope,
  requestedPeriod,
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
  const { showAstrology, setShowAstrology } = useAstrologyDetailsPreference();
  const [displayedForecast, setDisplayedForecast] = useState<DisplayedForecast | null>(null);
  const [unreadQuestions, setUnreadQuestions] =
    useState<PersonalForecastQuestionNotification[]>([]);
  const [focusQuestion, setFocusQuestion] =
    useState<PersonalForecastQuestionNotification | null>(null);
  const requestsRef = useRef<Partial<Record<PersonalForecastPeriod, PeriodRequest>>>({});
  const contextRef = useRef('');
  const accessContextRef = useRef('');
  const pendingSectionRef = useRef<string | null>(null);

  const periodKeys = useMemo<Record<PersonalForecastPeriod, string>>(() => ({
    day: getPersonalForecastPeriodKey('day', new Date(), timezone),
    week: getPersonalForecastPeriodKey('week', new Date(), timezone),
    month: getPersonalForecastPeriodKey('month', new Date(), timezone),
  }), [currentDateKey, timezone]);

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
  const forecastIdentityKey = [
    userId,
    chartId ?? 'primary',
    chartData?.calculationVersion || 'none',
    chartFingerprint,
    timezone,
    language,
    premium ? 'premium' : 'free',
  ].join(':');

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
      PERIOD_TABS.map(({ id }) => [id, readLocalPersonalForecast({
        profile,
        chartData,
        chartId,
        period: id,
        periodKey: periodKeys[id],
      })]),
    ) as Record<PersonalForecastPeriod, PersonalForecastClientResult | null>;
    const localDisplayPeriod = PERIOD_TABS.find(({ id }) => !!localResults[id])?.id;
    const localDisplay = localDisplayPeriod
      ? {
          identityKey: forecastIdentityKey,
          period: localDisplayPeriod,
          result: localResults[localDisplayPeriod] as PersonalForecastClientResult,
        }
      : null;
    setDisplayedForecast((current) => (
      current?.identityKey === forecastIdentityKey ? current : localDisplay
    ));
    setPeriodStates({
      day: { result: localResults.day, phase: localResults.day ? 'ready' : 'idle' },
      week: { result: localResults.week, phase: localResults.week ? 'ready' : 'idle' },
      month: { result: localResults.month, phase: localResults.month ? 'ready' : 'idle' },
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
    forecastIdentityKey,
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
          [period]: { result: next, phase: 'ready' },
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
            },
          }));
          void onRequestPremium?.('personal_forecast_feed', {
            period,
            periodKey,
            returnInPlace: true,
          });
          return;
        }
        setPeriodStates((current) => {
          const retained = current[period]?.result || local;
          return {
            ...current,
            [period]: {
              result: retained,
              phase: retained ? 'ready' : cacheOnly ? 'idle' : 'error',
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
    loadPeriod('week', { cacheOnly: true });
    loadPeriod('month', { cacheOnly: true });
  }, [contextKey, loadPeriod]);

  useEffect(() => {
    loadPeriod(activePeriod);
  }, [activePeriod, loadPeriod]);

  useEffect(() => {
    if (!requestedPeriod) return;
    setActivePeriod(requestedPeriod);
    loadPeriod(requestedPeriod);
  }, [loadPeriod, requestedPeriod]);

  const state = periodStates[activePeriod];
  const activeResult = state.result;
  const activeResultReady = activeResult?.forecast.meta.status === 'ready';
  const display: DisplayedForecast | null = activeResultReady && activeResult
    ? { identityKey: forecastIdentityKey, period: activePeriod, result: activeResult }
    : state.phase !== 'error' && displayedForecast?.identityKey === forecastIdentityKey
      ? displayedForecast
      : null;
  const displayPeriod = display?.period || activePeriod;
  const result = display?.result || null;
  const forecast = result?.forecast || null;
  useEffect(() => {
    if (!activeResultReady || !activeResult) return;
    setDisplayedForecast({
      identityKey: forecastIdentityKey,
      period: activePeriod,
      result: activeResult,
    });
  }, [activePeriod, activeResult, activeResultReady, forecastIdentityKey]);
  const lockedIds = useMemo(
    () => new Set(result?.lockedSectionIds || []),
    [result?.lockedSectionIds],
  );
  const readySections = useMemo(
    () => (
      forecast?.meta.status === 'ready'
        ? forecast.sections.filter((section) => section.status === 'ready')
        : []
    ),
    [forecast],
  );

  const visual = useMemo(() => {
    if (
      !forecast
      || forecast.meta.status !== 'ready'
      || forecast.overview.status !== 'ready'
    ) return null;
    return resolvePersonalForecastVisuals({
      userId,
      forecast: {
        period: forecast.period,
        periodKey: forecast.periodKey,
        overview: forecast.overview,
        sections: readySections,
      },
    });
  }, [forecast, readySections, userId]);

  const editorialStickerPath = useMemo(() => {
    if (!forecast || forecast.meta.status !== 'ready') return null;
    return visual?.assignments[forecast.overview.id]?.path || null;
  }, [forecast, visual]);

  const promotions = useMemo(() => {
    if (!forecast || forecast.meta.status !== 'ready') return [];
    return safeResolvePromotions({
      userId,
      period: displayPeriod,
      periodKey: forecast.periodKey,
      sections: readySections.map((section) => ({
        id: section.id,
        kind: section.kind,
        fixedKey: section.fixedKey,
        importance: section.importance,
        hasStrongAstro: section.kind === 'astro_accent',
      })),
    });
  }, [displayPeriod, forecast, readySections, userId]);
  const promotionSlotsBySection = useMemo(
    () => groupPromotionsBySection(promotions),
    [promotions],
  );

  const scrollToSection = useCallback((sectionId: string) => {
    const root = scrollRef?.current;
    const target = document.getElementById(
      sectionId === 'questions'
        ? 'forecast-questions'
        : `forecast-section-${sectionId}`,
    );
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
  ) => {
    lumiaSelectionHaptic();
    if (targetSectionId) pendingSectionRef.current = targetSectionId;
    setActivePeriod(period);
    loadPeriod(period);
    if (!targetSectionId) {
      scrollRef?.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [loadPeriod, scrollRef]);

  const openQuestionNotification = useCallback(() => {
    const notification = unreadQuestions[0];
    if (!notification) return;
    setFocusQuestion(notification);
    if (notification.period !== activePeriod) {
      selectPeriod(notification.period, 'questions');
      return;
    }
    scrollToSection('questions');
  }, [activePeriod, scrollToSection, selectPeriod, unreadQuestions]);

  const requestPremium = useCallback(() => {
    void onRequestPremium?.('personal_forecast_feed', {
      period: displayPeriod,
      periodKey: forecast?.periodKey || periodKeys[displayPeriod],
      returnInPlace: true,
    });
  }, [displayPeriod, forecast?.periodKey, onRequestPremium, periodKeys]);

  const renderPromo = (
    placement: PersonalForecastPromoPlacement,
    layout: 'tile' | 'wide',
  ) => (
    <ForecastPromotion
      key={placement.id}
      placement={placement}
      userId={userId}
      periodKey={forecast?.periodKey || periodKeys[displayPeriod]}
      dayKey={periodKeys.day}
      language={language}
      layout={layout}
      onOpenNatal={() => {
        lumiaSelectionHaptic();
        onCreateNatalChart?.();
      }}
      onOpenCompatibility={() => {
        lumiaSelectionHaptic();
        onOpenSynastry?.();
      }}
      onOpenZodiac={() => {
        lumiaSelectionHaptic();
        onOpenHoroscope?.();
      }}
    />
  );
  const renderPromoSlot = (slot: PersonalForecastPromoSlot) => (
    slot.layout === 'pair' ? (
      <div
        key={slot.id}
        className="forecast-feed-promo-pair"
        role="group"
        aria-label={language === 'ru'
          ? 'Перейти в другие разделы'
          : 'Open other sections'}
      >
        {slot.placements.map((placement) => renderPromo(placement, 'tile'))}
      </div>
    ) : (
      <React.Fragment key={slot.id}>
        {renderPromo(slot.placements[0], 'wide')}
      </React.Fragment>
    )
  );

  const overviewCrossLinks = forecast?.suggestedCrossPeriodLinks.filter(
    (link) => link.fromSectionId === 'overview',
  ) || [];
  const displayWindow = resolvePersonalForecastWindow(
    displayPeriod,
    periodKeys[displayPeriod],
    timezone,
  );
  const displayDateLines = (forecast?.dateLabel
    || formatPersonalForecastDateLabel(displayWindow, language))
    .split('\n')
    .filter(Boolean);
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
          rightAction={unreadQuestions.length > 0 ? (
            <div className="forecast-feed-top-actions">
              <button
                type="button"
                className="app-top-bar-action forecast-feed-top-action has-notification"
                aria-label={language === 'ru'
                  ? `Новых ответов: ${unreadQuestions.length}`
                  : `New answers: ${unreadQuestions.length}`}
                onClick={openQuestionNotification}
              >
                <Bell size={17} aria-hidden />
                <span className="forecast-feed-notification-dot" aria-hidden />
              </button>
            </div>
          ) : undefined}
        />
      </section>
      <div className="forecast-feed-ambient" aria-hidden />

      {hasChart ? (
        <div className="forecast-feed-reading-header">
          <div className="forecast-feed-date-zone" aria-label={displayDateLines.join(' ')}>
            <div className="forecast-feed-date-cluster">
              <p className="forecast-feed-date">
                {displayDateLines.length > 1 ? (
                  <>
                    <span className="forecast-feed-date-weekday">{displayDateLines[0]}</span>
                    <span className="forecast-feed-date-value">{displayDateLines.slice(1).join(' ')}</span>
                  </>
                ) : (
                  <span className="forecast-feed-date-value">{displayDateLines[0]}</span>
                )}
              </p>
            </div>
          </div>
          {forecast?.meta.status === 'ready' ? (
            <AstrologyDetailsToggle
              checked={showAstrology}
              onChange={setShowAstrology}
              language={language}
              className="forecast-feed-astrology-toggle"
            />
          ) : null}
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
              <p>
                {language === 'ru'
                  ? 'Остальные разделы доступны. Можно повторить только этот расчёт.'
                  : 'Other sections remain available. You can retry only this calculation.'}
              </p>
              <button type="button" onClick={() => loadPeriod(activePeriod, { retry: true })}>
                <RefreshCw size={17} aria-hidden />
                {language === 'ru' ? 'Повторить' : 'Retry'}
              </button>
            </>
          ) : (
            <div className="forecast-feed-loading-preview" aria-hidden="true">
              <span className="forecast-feed-loading-headline is-long" />
              <span className="forecast-feed-loading-headline is-short" />
              <div className="forecast-feed-loading-lead">
                <span />
                <span />
              </div>
              <div className="forecast-feed-loading-copy">
                <span />
                <span />
                <span />
              </div>
              <span className="forecast-feed-loading-section-title" />
              <div className="forecast-feed-loading-copy">
                <span />
                <span />
                <span />
              </div>
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
            evidence={forecast.evidence}
            style={forecastSectionVisualStyle(
              visual?.assignments[forecast.overview.id],
              displayPeriod,
            )}
            hasVisual={!!editorialStickerPath}
            editorialStickerPath={editorialStickerPath}
            showAstrology={showAstrology}
            onRequestPremium={requestPremium}
          >
            {overviewCrossLinks.map((link) => (
              <button
                key={link.id}
                type="button"
                className="forecast-feed-cross-link"
                onClick={() => selectPeriod(link.targetPeriod, link.targetSectionId)}
              >
                {link.label}
                <span aria-hidden>→</span>
              </button>
            ))}
          </ForecastSectionBlock>

          {readySections.map((section) => {
            const crossLinks = forecast.suggestedCrossPeriodLinks.filter(
              (link) => link.fromSectionId === section.id,
            );
            const sectionPromoSlots = promotionSlotsBySection.get(section.id) || [];
            return (
              <React.Fragment key={`${displayPeriod}:${forecast.periodKey}:${section.id}`}>
                <ForecastSectionBlock
                  section={section}
                  period={displayPeriod}
                  language={language}
                  locked={lockedIds.has(section.id)}
                  evidence={forecast.evidence}
                  style={forecastSectionVisualStyle(
                    visual?.assignments[section.id],
                    displayPeriod,
                  )}
                  hasVisual={false}
                  editorialStickerPath={null}
                  showAstrology={showAstrology}
                  onRequestPremium={requestPremium}
                >
                  {crossLinks.map((link) => (
                    <button
                      key={link.id}
                      type="button"
                      className="forecast-feed-cross-link"
                      onClick={() => selectPeriod(link.targetPeriod, link.targetSectionId)}
                    >
                      {link.label}
                      <span aria-hidden>→</span>
                    </button>
                  ))}
                </ForecastSectionBlock>
                {sectionPromoSlots.map(renderPromoSlot)}
              </React.Fragment>
            );
          })}

          <ForecastQuestions
            profile={profile}
            chartId={chartId}
            contextFingerprint={chartFingerprint}
            period={displayPeriod}
            periodKey={forecast.periodKey}
            premium={premium}
            focusNotification={focusQuestion}
            onRequestPremium={requestPremium}
            onUnreadChange={setUnreadQuestions}
            onFocusConsumed={() => setFocusQuestion(null)}
          />

        </>
      )}
    </div>
  );
});

Dashboard.displayName = 'Dashboard';
