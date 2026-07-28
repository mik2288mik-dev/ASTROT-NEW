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
  type ExplanationAnchor,
  type ForecastSection,
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

type ExplanationSelection = {
  section: ForecastSection;
  anchor: ExplanationAnchor;
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

function emptyPeriodState(): PeriodState {
  return { result: null, phase: 'idle' };
}

function groupBySection(
  placements: PersonalForecastPromoPlacement[],
): Map<string, PersonalForecastPromoPlacement[]> {
  const grouped = new Map<string, PersonalForecastPromoPlacement[]>();
  for (const placement of placements) {
    const current = grouped.get(placement.afterSectionId) || [];
    current.push(placement);
    grouped.set(placement.afterSectionId, current);
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
  const [periodStates, setPeriodStates] = useState<Record<PersonalForecastPeriod, PeriodState>>({
    day: emptyPeriodState(),
    week: emptyPeriodState(),
    month: emptyPeriodState(),
    year: emptyPeriodState(),
  });
  const [compactTabsVisible, setCompactTabsVisible] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>('overview');
  const [explanation, setExplanation] = useState<ExplanationSelection | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [unreadQuestions, setUnreadQuestions] =
    useState<PersonalForecastQuestionNotification[]>([]);
  const [focusQuestion, setFocusQuestion] =
    useState<PersonalForecastQuestionNotification | null>(null);
  const requestsRef = useRef<Partial<Record<PersonalForecastPeriod, Promise<void>>>>({});
  const contextRef = useRef('');
  const accessContextRef = useRef('');
  const pendingSectionRef = useRef<string | null>(null);

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
    _options?: { retry?: boolean },
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

  useEffect(() => {
    if (!premium) return;
    loadPeriod(activePeriod, { retry: true });
  }, [activePeriod, loadPeriod, premium]);

  const state = periodStates[activePeriod];
  const result = state.result;
  const forecast = result?.forecast || null;
  const lockedIds = useMemo(
    () => new Set(result?.lockedSectionIds || []),
    [result?.lockedSectionIds],
  );

  const visual = useMemo(() => {
    if (!forecast || forecast.meta.status !== 'ready') return null;
    return resolvePersonalForecastVisuals({
      userId,
      forecast: {
        period: forecast.period,
        periodKey: forecast.periodKey,
        overview: forecast.overview,
        sections: forecast.sections,
      },
    });
  }, [forecast, userId]);

  const promotions = useMemo(() => {
    if (!forecast || forecast.meta.status !== 'ready') return [];
    return safeResolvePromotions({
      userId,
      period: activePeriod,
      periodKey: forecast.periodKey,
      sections: forecast.sections.map((section) => ({
        id: section.id,
        kind: section.kind,
        fixedKey: section.fixedKey,
        importance: section.importance,
        hasStrongAstro: section.kind === 'astro_accent',
      })),
    });
  }, [activePeriod, forecast, userId]);
  const promotionsBySection = useMemo(
    () => groupBySection(promotions),
    [promotions],
  );

  const dateLabel = forecast?.dateLabel || formatPersonalForecastDateLabel(
    resolvePersonalForecastWindow(activePeriod, periodKeys[activePeriod], timezone),
    language,
  );

  const sideSections = useMemo(() => {
    if (!forecast || forecast.meta.status !== 'ready') return [];
    return [
      {
        id: 'overview',
        title: language === 'ru' ? 'Главное' : 'Overview',
      },
      ...forecast.sections.map((section) => ({
        id: section.id,
        title: section.title || (
          language === 'ru' ? 'Важный период' : 'Important period'
        ),
      })),
      {
        id: 'questions',
        title: language === 'ru' ? 'Вопросы' : 'Questions',
      },
    ];
  }, [forecast, language]);

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
    return () => root.removeEventListener('scroll', handleScroll);
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

  const openExplanation = useCallback((
    section: ForecastSection,
    anchor: ExplanationAnchor,
  ) => {
    lumiaSelectionHaptic();
    setExplanation({ section, anchor });
  }, []);

  const renderTabs = (compact = false) => (
    <div
      className={compact ? 'forecast-feed-tabs is-compact' : 'forecast-feed-tabs'}
      role="tablist"
      aria-label={language === 'ru' ? 'Период прогноза' : 'Forecast period'}
    >
      {PERIOD_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`forecast-feed-tab${tab.id === activePeriod ? ' is-active' : ''}`}
          role="tab"
          aria-selected={tab.id === activePeriod}
          tabIndex={compact && !compactTabsVisible ? -1 : undefined}
          onClick={() => selectPeriod(tab.id)}
        >
          {tab[language]}
        </button>
      ))}
    </div>
  );

  const renderPromo = (placement: PersonalForecastPromoPlacement) => (
    <ForecastPromotion
      key={placement.id}
      placement={placement}
      userId={userId}
      periodKey={periodKeys[activePeriod]}
      language={language}
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

  const overviewCrossLinks = forecast?.suggestedCrossPeriodLinks.filter(
    (link) => link.fromSectionId === 'overview',
  ) || [];

  return (
    <div
      className="forecast-feed-page lumia-main-scroll lumia-bottom-tab-scroll"
      ref={scrollRef as React.RefObject<HTMLDivElement>}
    >
      <header className="forecast-feed-header">
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
              <Bell size={19} aria-hidden />
              <span className="forecast-feed-notification-dot" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className="forecast-feed-header-action"
            aria-label={language === 'ru' ? 'Как устроен прогноз' : 'How the forecast works'}
            onClick={() => setHowItWorksOpen(true)}
          >
            <Info size={19} aria-hidden />
          </button>
        </div>
        {renderTabs()}
        <p className="forecast-feed-date">
          {dateLabel.split('\n').map((line) => <span key={line}>{line}</span>)}
        </p>
      </header>

      <div
        className={`forecast-feed-compact-tabs${compactTabsVisible ? ' is-visible' : ''}`}
        aria-hidden={!compactTabsVisible}
      >
        {renderTabs(true)}
      </div>

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
            section={forecast.overview}
            period={activePeriod}
            language={language}
            locked={lockedIds.has(forecast.overview.id)}
            style={forecastSectionVisualStyle(
              visual?.assignments[forecast.overview.id],
              activePeriod,
            )}
            hasVisual={!!visual?.assignments[forecast.overview.id]?.path}
            onExplain={openExplanation}
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

          {forecast.sections.map((section) => {
            const crossLinks = forecast.suggestedCrossPeriodLinks.filter(
              (link) => link.fromSectionId === section.id,
            );
            const sectionPromos = promotionsBySection.get(section.id) || [];
            return (
              <React.Fragment key={section.id}>
                <ForecastSectionBlock
                  section={section}
                  period={activePeriod}
                  language={language}
                  locked={lockedIds.has(section.id)}
                  style={forecastSectionVisualStyle(
                    visual?.assignments[section.id],
                    activePeriod,
                  )}
                  hasVisual={!!visual?.assignments[section.id]?.path}
                  onExplain={openExplanation}
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
                {sectionPromos.map(renderPromo)}
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
            onSelectPeriod={(period) => selectPeriod(period, 'questions')}
            onUnreadChange={setUnreadQuestions}
            onFocusConsumed={() => setFocusQuestion(null)}
          />

          <button
            type="button"
            className="forecast-feed-how-it-works"
            onClick={() => setHowItWorksOpen(true)}
          >
            <Info size={18} aria-hidden />
            {language === 'ru' ? 'Как это работает' : 'How it works'}
          </button>

          <ForecastSideNavigator
            sections={sideSections}
            activeId={activeSectionId}
            onNavigate={scrollToSection}
            ariaLabel={language === 'ru'
              ? 'Навигация по разделам прогноза'
              : 'Forecast section navigation'}
          />
        </>
      )}

      <ForecastBottomSheet
        open={!!explanation}
        title={explanation?.anchor.conclusion || ''}
        subtitle={explanation?.section.title}
        closeLabel={language === 'ru' ? 'Закрыть' : 'Close'}
        onClose={() => setExplanation(null)}
      >
        {explanation ? (
          <>
            <p className="forecast-feed-sheet-explanation">
              {explanation.anchor.explanation}
            </p>
            <div className="forecast-feed-sheet-evidence">
              {explanation.anchor.evidenceIds.map((id) => {
                const evidence = forecast?.evidence[id];
                if (!evidence) return null;
                return (
                  <div key={id} className="forecast-feed-sheet-evidence-row">
                    <strong>{evidence.factor}</strong>
                    <span>{evidence.meaning}</span>
                    {evidence.period ? <small>{evidence.period}</small> : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </ForecastBottomSheet>

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
              ? 'Затем прогноз формулирует понятный вывод и объясняет его. Кнопка i рядом с выводом показывает конкретное астрологическое основание.'
              : 'The forecast then states a clear conclusion and explains it. The i button beside a conclusion shows its specific astrological basis.'}
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
