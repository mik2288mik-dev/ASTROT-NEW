import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RefreshCw } from 'lucide-react';
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
  selectActiveReadyPersonalForecast,
  type PersonalForecastClientError,
  type PersonalForecastClientResult,
} from '../services/personalForecastService';
import { ForecastPromotion } from '../components/PersonalForecastFeed/ForecastPromotion';
import { ForecastSectionBlock } from '../components/PersonalForecastFeed/ForecastSectionBlock';
import { FreshTabs } from '../components/fresh-ui';
import { AppTopBar } from '../components/lumia-ui/AppTopBar';
import {
  AstrologyDetailsToggle,
  useAstrologyDetailsPreference,
} from '../components/AstrologyDetailsToggle';

type DashboardProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  currentDateKey?: string;
  onCreateNatalChart?: () => void;
  onOpenSynastry?: () => void;
  onOpenHoroscope?: () => void;
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
  const [stickerIdsByPeriod, setStickerIdsByPeriod] = useState<
    Partial<Record<PersonalForecastPeriod, string>>
  >({});
  const { showAstrology, setShowAstrology } = useAstrologyDetailsPreference();
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
  const todayWindow = useMemo(
    () => resolvePersonalForecastWindow('day', periodKeys.day, timezone),
    [periodKeys.day, timezone],
  );
  const todayDateLines = useMemo(
    () => formatPersonalForecastDateLabel(todayWindow, language)
      .split('\n')
      .filter(Boolean),
    [language, todayWindow],
  );
  const periodTabs = useMemo(() => PERIOD_TABS.map(({ id, ru, en }) => ({
    id,
    label: language === 'ru' ? ru : en,
  })), [language]);
  const stickerCycleKey = `${userId}:${periodKeys.day}:${periodKeys.week}:${periodKeys.month}`;

  useEffect(() => {
    setStickerIdsByPeriod({});
  }, [stickerCycleKey]);

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
      PERIOD_TABS.map(({ id }) => [id, readLocalPersonalForecast({
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
    loadPeriod('week');
    loadPeriod('month');
  }, [contextKey, loadPeriod]);

  const state = periodStates[activePeriod];
  const displayPeriod = activePeriod;
  const result = selectActiveReadyPersonalForecast(activePeriod, periodStates);
  const forecast = result?.forecast || null;
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
      excludeAssetIds: Object.entries(stickerIdsByPeriod)
        .filter(([period]) => period !== displayPeriod)
        .map(([, assetId]) => assetId),
      forecast: {
        period: forecast.period,
        periodKey: forecast.periodKey,
        overview: forecast.overview,
        sections: readySections,
      },
    });
  }, [displayPeriod, forecast, readySections, stickerIdsByPeriod, userId]);

  const editorialSticker = useMemo(() => {
    if (!forecast || forecast.meta.status !== 'ready') return null;
    const assignment = visual?.assignments[forecast.overview.id];
    if (!assignment?.path || !assignment.width || !assignment.height) return null;
    return {
      path: assignment.path,
      width: assignment.width,
      height: assignment.height,
    };
  }, [forecast, visual]);

  useEffect(() => {
    const assetId = forecast && visual?.assignments[forecast.overview.id]?.assetId;
    if (!assetId) return;
    setStickerIdsByPeriod((current) => (
      current[displayPeriod] === assetId
        ? current
        : { ...current, [displayPeriod]: assetId }
    ));
  }, [displayPeriod, forecast, visual]);

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
          <div className="forecast-feed-date-zone" aria-label={todayDateLines.join(' ')}>
            <div className="forecast-feed-date-cluster">
              <p className="forecast-feed-date">
                {todayDateLines.length > 1 ? (
                  <>
                    <span className="forecast-feed-date-weekday">{todayDateLines[0]}</span>
                    <span className="forecast-feed-date-value">{todayDateLines.slice(1).join(' ')}</span>
                  </>
                ) : (
                  <span className="forecast-feed-date-value">{todayDateLines[0]}</span>
                )}
              </p>
            </div>
          </div>
          <FreshTabs
            className="forecast-feed-period-tabs"
            tabs={periodTabs}
            activeTab={activePeriod}
            onTabChange={(id) => selectPeriod(id as PersonalForecastPeriod)}
          />
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
            hasVisual={!!editorialSticker}
            editorialSticker={editorialSticker}
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
                  editorialSticker={null}
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

          <footer className="forecast-feed-footer">
            <AstrologyDetailsToggle
              checked={showAstrology}
              onChange={setShowAstrology}
              language={language}
            />
          </footer>

        </>
      )}
    </div>
  );
});

Dashboard.displayName = 'Dashboard';
