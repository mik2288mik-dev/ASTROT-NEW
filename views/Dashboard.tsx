import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Bell, Info, RefreshCw } from 'lucide-react';
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
  type PersonalForecastClientResult,
} from '../services/personalForecastService';
import { ForecastBottomSheet } from '../components/PersonalForecastFeed/ForecastBottomSheet';
import { ForecastPromotion } from '../components/PersonalForecastFeed/ForecastPromotion';
import { ForecastQuestions } from '../components/PersonalForecastFeed/ForecastQuestions';
import { ForecastSectionBlock } from '../components/PersonalForecastFeed/ForecastSectionBlock';
import { ForecastSideNavigator } from '../components/PersonalForecastFeed/ForecastSideNavigator';
import { ForecastTopicNavigation } from '../components/PersonalForecastFeed/ForecastTopicNavigation';
import { AppTopBar } from '../components/lumia-ui/AppTopBar';
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

const PERIOD_TABS: ReadonlyArray<{
  id: PersonalForecastPeriod;
  ru: string;
  en: string;
}> = [
  { id: 'day', ru: 'Сегодня', en: 'Today' },
  { id: 'week', ru: 'Неделя', en: 'Week' },
  { id: 'month', ru: 'Месяц', en: 'Month' },
  { id: 'year', ru: 'Год', en: 'Year' },
] as const;

function periodTabLabel(
  period: PersonalForecastPeriod,
  language: 'ru' | 'en',
): string {
  return PERIOD_TABS.find((tab) => tab.id === period)?.[language] || period;
}

function personalForecastIntro(
  period: PersonalForecastPeriod,
  language: 'ru' | 'en',
): string {
  if (language === 'en') {
    return {
      day: 'A personal forecast for today based on your natal chart and today’s calculations.',
      week: 'A personal forecast for this week based on your natal chart and weekly calculations.',
      month: 'A personal forecast for this month based on your natal chart and monthly calculations.',
      year: 'A personal forecast for this year based on your natal chart and yearly calculations.',
    }[period];
  }
  return {
    day: 'Личный прогноз на сегодня по твоей натальной карте и расчётам дня.',
    week: 'Личный прогноз на неделю по твоей натальной карте и расчётам недели.',
    month: 'Личный прогноз на месяц по твоей натальной карте и расчётам месяца.',
    year: 'Личный прогноз на год по твоей натальной карте и расчётам года.',
  }[period];
}

function personalForecastGreeting(
  name: string,
  timezone: string,
  variant: number,
  language: 'ru' | 'en',
): string {
  let hour = new Date().getHours();
  try {
    hour = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(new Date()));
  } catch {
    // The normalized profile timezone is expected to be valid.
  }
  if (language === 'en') {
    if (variant === 1) return `Hi, ${name}`;
    if (variant === 2) return `Hello, ${name}`;
    if (hour >= 5 && hour < 12) return `Good morning, ${name}`;
    if (hour >= 12 && hour < 18) return `Good afternoon, ${name}`;
    if (hour >= 18 && hour < 23) return `Good evening, ${name}`;
    return `Good night, ${name}`;
  }
  if (variant === 1) return `Привет, ${name}`;
  if (variant === 2) return `Здравствуйте, ${name}`;
  if (hour >= 5 && hour < 12) return `Доброе утро, ${name}`;
  if (hour >= 12 && hour < 18) return `Добрый день, ${name}`;
  if (hour >= 18 && hour < 23) return `Добрый вечер, ${name}`;
  return `Доброй ночи, ${name}`;
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
  const [greetingVariant] = useState(() => Math.floor(Math.random() * 3));
  const [periodStates, setPeriodStates] = useState<Record<PersonalForecastPeriod, PeriodState>>({
    day: emptyPeriodState(),
    week: emptyPeriodState(),
    month: emptyPeriodState(),
    year: emptyPeriodState(),
  });
  const [compactTabsVisible, setCompactTabsVisible] = useState(false);
  const [feedScrolling, setFeedScrolling] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>('overview');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [unreadQuestions, setUnreadQuestions] =
    useState<PersonalForecastQuestionNotification[]>([]);
  const [focusQuestion, setFocusQuestion] =
    useState<PersonalForecastQuestionNotification | null>(null);
  const requestsRef = useRef<Partial<Record<PersonalForecastPeriod, Promise<void>>>>({});
  const contextRef = useRef('');
  const accessContextRef = useRef('');
  const pendingSectionRef = useRef<string | null>(null);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const periodKeys = useMemo<Record<PersonalForecastPeriod, string>>(() => ({
    day: getPersonalForecastPeriodKey('day', new Date(), timezone),
    week: getPersonalForecastPeriodKey('week', new Date(), timezone),
    month: getPersonalForecastPeriodKey('month', new Date(), timezone),
    year: getPersonalForecastPeriodKey('year', new Date(), timezone),
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

  useEffect(() => {
    if (contextRef.current === contextKey) return;
    contextRef.current = contextKey;
    requestsRef.current = {};
    if (!chartData || !hasChart) {
      setPeriodStates({
        day: emptyPeriodState(),
        week: emptyPeriodState(),
        month: emptyPeriodState(),
        year: emptyPeriodState(),
      });
      return;
    }
    const day = readLocalPersonalForecast({
      profile,
      chartData,
      chartId,
      period: 'day',
      periodKey: periodKeys.day,
    });
    setPeriodStates({
      day: { result: day, phase: day ? 'ready' : 'idle' },
      week: emptyPeriodState(),
      month: emptyPeriodState(),
      year: emptyPeriodState(),
    });
  }, [
    chartData,
    chartId,
    contextKey,
    hasChart,
    periodKeys.day,
    profile,
  ]);

  useEffect(() => {
    if (accessContextRef.current === accessContextKey) return;
    accessContextRef.current = accessContextKey;
    requestsRef.current = {};
  }, [accessContextKey]);

  const loadPeriod = useCallback((
    period: PersonalForecastPeriod,
    options?: { retry?: boolean },
  ) => {
    if (!chartData || !hasChart) return;
    if (requestsRef.current[period]) return;

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
          phase: retained ? 'ready' : 'loading',
        },
      };
    });

    const requestContextKey = accessContextKey;
    const request = (async () => {
      try {
        let next: PersonalForecastClientResult;
        if (options?.retry) {
          next = await loadPersonalForecast({
            profile,
            chartData,
            chartId,
            period,
            periodKey,
            options: { force: true },
          });
        } else {
          try {
            next = await loadPersonalForecast({
              profile,
              chartData,
              chartId,
              period,
              periodKey,
              options: { cacheOnly: true, force: true },
            });
          } catch (error: any) {
            if (error?.status !== 404) throw error;
            next = await loadPersonalForecast({
              profile,
              chartData,
              chartId,
              period,
              periodKey,
              options: { force: true },
            });
          }
        }
        if (accessContextRef.current !== requestContextKey) return;
        setPeriodStates((current) => ({
          ...current,
          [period]: { result: next, phase: 'ready' },
        }));
      } catch {
        if (accessContextRef.current !== requestContextKey) return;
        setPeriodStates((current) => {
          const retained = current[period]?.result || local;
          return {
            ...current,
            [period]: {
              result: retained,
              phase: retained ? 'ready' : 'error',
            },
          };
        });
      }
    })();
    requestsRef.current[period] = request;
    void request.then(() => {
      if (requestsRef.current[period] === request) {
        delete requestsRef.current[period];
      }
    });
  }, [
    chartData,
    chartId,
    hasChart,
    premium,
    accessContextKey,
    periodKeys,
    profile,
  ]);

  useEffect(() => {
    loadPeriod('day');
  }, [contextKey, loadPeriod]);

  useEffect(() => {
    loadPeriod(activePeriod);
  }, [activePeriod, loadPeriod]);

  const state = periodStates[activePeriod];
  const result = state.result;
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
      forecast: {
        period: forecast.period,
        periodKey: forecast.periodKey,
        overview: forecast.overview,
        sections: readySections,
      },
    });
  }, [forecast, readySections, userId]);

  const promotions = useMemo(() => {
    if (!forecast || forecast.meta.status !== 'ready') return [];
    return safeResolvePromotions({
      userId,
      period: activePeriod,
      periodKey: forecast.periodKey,
      sections: readySections.map((section) => ({
        id: section.id,
        kind: section.kind,
        fixedKey: section.fixedKey,
        importance: section.importance,
        hasStrongAstro: section.kind === 'astro_accent',
      })),
    });
  }, [activePeriod, forecast, readySections, userId]);
  const promotionSlotsBySection = useMemo(
    () => groupPromotionsBySection(promotions),
    [promotions],
  );

  const dateLabel = forecast?.dateLabel || formatPersonalForecastDateLabel(
    resolvePersonalForecastWindow(activePeriod, periodKeys[activePeriod], timezone),
    language,
  );

  const topicSections = useMemo(() => {
    if (!forecast || forecast.meta.status !== 'ready') return [];
    return [
      ...(forecast.overview.status === 'ready'
        ? [{
            id: 'overview',
            title: language === 'ru' ? 'Общее' : 'Overview',
          }]
        : []),
      ...readySections.flatMap((section) => {
        const title = section.title?.trim();
        return title ? [{ id: section.id, title }] : [];
      }),
    ];
  }, [forecast, language, readySections]);

  const sideSections = useMemo(() => {
    if (!topicSections.length) return [];
    return [
      ...topicSections,
      {
        id: 'questions',
        title: language === 'ru' ? 'Вопросы по карте' : 'Chart questions',
      },
    ];
  }, [language, topicSections]);

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
    const root = scrollRef?.current;
    if (!root) return;
    let lastScrollTop = root.scrollTop;
    const handleScroll = () => {
      const next = root.scrollTop;
      setFeedScrolling(true);
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = setTimeout(() => {
        setFeedScrolling(false);
      }, 620);
      if (next < 104) {
        setCompactTabsVisible(false);
      } else if (next < lastScrollTop - 2) {
        setCompactTabsVisible(true);
      } else if (next > lastScrollTop + 2) {
        setCompactTabsVisible(false);
      }
      lastScrollTop = next;
    };
    root.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      root.removeEventListener('scroll', handleScroll);
      if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    };
  }, [scrollRef]);

  useEffect(() => {
    const root = scrollRef?.current;
    if (!root || !forecast) return;
    const elements = Array.from(
      root.querySelectorAll<HTMLElement>('[data-forecast-section], #forecast-questions'),
    );
    if (!elements.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio);
      const target = visible[0]?.target as HTMLElement | undefined;
      const id = target?.dataset.forecastSection
        || (target?.id === 'forecast-questions' ? 'questions' : null);
      if (id) setActiveSectionId(id);
    }, {
      root,
      rootMargin: '-24% 0px -55% 0px',
      threshold: [0.05, 0.2, 0.5, 0.8],
    });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [forecast, scrollRef]);

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
    if (!targetSectionId) {
      scrollRef?.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [scrollRef]);

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
      period: activePeriod,
      periodKey: periodKeys[activePeriod],
      returnInPlace: true,
    });
  }, [activePeriod, onRequestPremium, periodKeys]);

  const renderPromo = (
    placement: PersonalForecastPromoPlacement,
    layout: 'tile' | 'wide',
  ) => (
    <ForecastPromotion
      key={placement.id}
      placement={placement}
      userId={userId}
      periodKey={periodKeys[activePeriod]}
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
  const displayName = profile.name?.trim()
    || (language === 'ru' ? 'друг' : 'friend');
  const greeting = useMemo(
    () => personalForecastGreeting(
      displayName,
      timezone,
      greetingVariant,
      language,
    ),
    [displayName, greetingVariant, language, timezone],
  );

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
        <div className="home-top-content">
          <div
            className="home-period-tabs"
            role="tablist"
            aria-label={language === 'ru' ? 'Период' : 'Period'}
          >
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`home-period-tab${tab.id === activePeriod ? ' is-active' : ''}`}
                role="tab"
                aria-selected={tab.id === activePeriod}
                onClick={() => selectPeriod(tab.id)}
              >
                <span className="home-period-tab-label">{tab[language]}</span>
              </button>
            ))}
          </div>
          <ForecastTopicNavigation
            sections={topicSections}
            activeId={activeSectionId}
            compactVisible={compactTabsVisible}
            language={language}
            onNavigate={scrollToSection}
          />
        </div>
      </section>

      <div className="forecast-feed-date-zone">
        <p className="forecast-feed-date">
          {dateLabel.split('\n').map((line) => <span key={line}>{line}</span>)}
        </p>
        <button
          type="button"
          className="forecast-feed-global-info"
          aria-label={language === 'ru' ? 'Как устроен прогноз' : 'How the forecast works'}
          onClick={() => setHowItWorksOpen(true)}
        >
          <Info size={16} aria-hidden />
        </button>
      </div>
      <div className="forecast-feed-intro">
        <div className="forecast-feed-greeting-row">
          <p className="home-top-greeting">
            {greeting}
          </p>
          <div className="forecast-feed-header-actions">
            {unreadQuestions.length > 0 ? (
              <button
                type="button"
                className="forecast-feed-header-action has-notification"
                aria-label={language === 'ru'
                  ? `Новых ответов: ${unreadQuestions.length}`
                  : `New answers: ${unreadQuestions.length}`}
                onClick={openQuestionNotification}
              >
                <Bell size={16} aria-hidden />
                <span className="forecast-feed-notification-dot" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        <p className="forecast-feed-intro-copy">
          {personalForecastIntro(activePeriod, language)}
        </p>
      </div>
      <div className="forecast-feed-ambient" aria-hidden />

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
        <section className={`forecast-feed-status is-${state.phase}`} aria-live="polite">
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
            <>
              <div className="forecast-feed-status-line" aria-hidden />
              <p>
                {language === 'ru'
                  ? `${periodTabLabel(activePeriod, language)} готовится в фоне`
                  : `${periodTabLabel(activePeriod, language)} is being prepared in the background`}
              </p>
            </>
          )}
        </section>
      ) : (
        <>
          <ForecastSectionBlock
            key={`${activePeriod}:${forecast.periodKey}:${forecast.overview.id}`}
            section={forecast.overview}
            period={activePeriod}
            language={language}
            locked={lockedIds.has(forecast.overview.id)}
            evidence={forecast.evidence}
            style={forecastSectionVisualStyle(
              visual?.assignments[forecast.overview.id],
              activePeriod,
            )}
            hasVisual={!!visual?.assignments[forecast.overview.id]?.path}
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
              <React.Fragment key={`${activePeriod}:${forecast.periodKey}:${section.id}`}>
                <ForecastSectionBlock
                  section={section}
                  period={activePeriod}
                  language={language}
                  locked={lockedIds.has(section.id)}
                  evidence={forecast.evidence}
                  style={forecastSectionVisualStyle(
                    visual?.assignments[section.id],
                    activePeriod,
                  )}
                  hasVisual={!!visual?.assignments[section.id]?.path}
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
            period={activePeriod}
            periodKey={periodKeys[activePeriod]}
            premium={premium}
            focusNotification={focusQuestion}
            onRequestPremium={requestPremium}
            onUnreadChange={setUnreadQuestions}
            onFocusConsumed={() => setFocusQuestion(null)}
          />

          <ForecastSideNavigator
            sections={sideSections}
            activeId={activeSectionId}
            onNavigate={scrollToSection}
            className={feedScrolling ? 'is-scrolling' : undefined}
            ariaLabel={language === 'ru'
              ? 'Навигация по разделам прогноза'
              : 'Forecast section navigation'}
          />
        </>
      )}

      <ForecastBottomSheet
        open={howItWorksOpen}
        title={language === 'ru' ? 'Как устроен прогноз' : 'How the forecast works'}
        closeLabel={language === 'ru' ? 'Закрыть' : 'Close'}
        onClose={() => setHowItWorksOpen(false)}
      >
        <div className="forecast-feed-how-copy">
          <p>
            {language === 'ru'
              ? 'Сначала мы рассчитываем положения планет, домов, аспектов и транзитов для твоей карты и выбранного периода.'
              : 'First, we calculate planets, houses, aspects, and transits for your chart and the selected period.'}
          </p>
          <p>
            {language === 'ru'
              ? 'Затем прогноз формулирует понятный вывод. Значок i рядом с ним открывает рассчитанный фактор и его смысл.'
              : 'The forecast then states a clear conclusion. The info icon beside it opens the calculated factor and its plain-language meaning.'}
          </p>
              <p>
                {language === 'ru'
                  ? 'Будущие события описываются как направление и период, а не как гарантированный факт.'
                  : 'Future events are described as a direction and a period, not as a guaranteed fact.'}
              </p>
              <p>
                {language === 'ru'
                  ? 'Разбор отличается у разных людей, потому что опирается на конкретную натальную карту, часовой пояс и расчёты выбранного периода.'
                  : 'The reading differs from person to person because it uses a specific natal chart, timezone, and calculations for the selected period.'}
              </p>
          <p>
            {language === 'ru'
              ? 'Сегодня обновляется каждый день, Неделя — по границе недели, Месяц и Год — по календарной границе. Изменение данных рождения или версии расчёта создаёт новый разбор.'
              : 'Today updates daily, Week at the week boundary, and Month and Year at their calendar boundaries. Changing birth data or the calculation version creates a new reading.'}
          </p>
          <p>
            {language === 'ru'
              ? 'Точное время рождения влияет на Асцендент и дома. Если оно неизвестно, разбор опирается на надёжно рассчитанные факторы и честно учитывает ограничения карты.'
              : 'Exact birth time affects the Ascendant and houses. If it is unknown, the reading uses reliably calculated factors and honestly accounts for the chart’s limits.'}
          </p>
          <p>
            {language === 'ru'
              ? 'Сначала выполняется астрономический расчёт. ИИ формулирует текст только по переданной карте и данным периода — он не должен придумывать события или факты о человеке.'
              : 'The astronomical calculation comes first. AI phrases the reading only from the supplied chart and period data; it must not invent events or facts about the person.'}
          </p>
          <p>
            {language === 'ru'
              ? 'Дата, время и место рождения используются для построения карты и персональных расчётов.'
              : 'Birth date, time, and place are used to build the chart and personal calculations.'}
          </p>
          <p>
            {language === 'ru'
              ? 'Это не медицинская, психологическая, юридическая или финансовая рекомендация и не замена консультации специалиста.'
              : 'This is not medical, psychological, legal, or financial advice and does not replace professional consultation.'}
          </p>
        </div>
      </ForecastBottomSheet>
    </div>
  );
});

Dashboard.displayName = 'Dashboard';
