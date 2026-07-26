import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NatalChartData, UserProfile } from '../types';
import { hasNatalChart } from '../lib/accessMatrix';
import { lumiaSelectionHaptic } from '../lib/haptics';
import { HomeFaq } from '../components/Dashboard/HomeFaq';
import { MATRIX_TITLE } from '../lib/matrixArcana';
import {
  cardBackgroundStyle,
  getUniversalCardBackground,
} from '../lib/cardBackgrounds';
import {
  FIXED_FORECAST_TOPIC_KEYS,
  FORECAST_OVERVIEW_TITLES,
  FORECAST_TOPIC_TITLES,
  getPersonalForecastPeriodKey,
  normalizeForecastTimezone,
  resolvePersonalForecastWindow,
  type ForecastTopicKey,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
} from '../lib/personalForecastContract';
import {
  buildForecastVisualRequests,
  forecastVisualStyle,
  resolveForecastVisualScreen,
} from '../lib/personalForecastVisuals';
import {
  loadPersonalForecast,
  readLocalPersonalForecast,
  type PersonalForecastClientResult,
} from '../services/personalForecastService';

export type PersonalForecastSelection = {
  forecast: PersonalForecastPackage;
  topicKey: ForecastTopicKey;
  locked: boolean;
};

type DashboardProps = {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  currentDateKey?: string;
  onOpenPersonalForecast: (selection: PersonalForecastSelection) => void;
  onCreateNatalChart?: () => void;
  onOpenSynastry?: () => void;
  onOpenMatrix?: () => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};

type PeriodState = {
  result: PersonalForecastClientResult | null;
  phase: 'idle' | 'loading' | 'ready' | 'error';
};

const EMPTY_PERIOD_STATE: PeriodState = { result: null, phase: 'idle' };

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

const FIXED_CARD_KEYS = FIXED_FORECAST_TOPIC_KEYS.filter(
  (key) => key !== 'overview',
);

function formatPeriodLabel(
  forecast: PersonalForecastPackage | null,
  period: PersonalForecastPeriod,
  periodKey: string,
  language: 'ru' | 'en',
  timezone: string,
): string {
  const window = forecast || resolvePersonalForecastWindow(period, periodKey, timezone);
  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  const start = new Date(`${window.periodStart}T12:00:00Z`);
  const end = new Date(`${window.periodEnd}T12:00:00Z`);
  const short = new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
  });
  if (period === 'day') {
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'long',
      weekday: 'long',
    }).format(start);
  }
  if (period === 'month') {
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric',
    }).format(start);
  }
  if (period === 'year') return String(start.getUTCFullYear());
  return `${short.format(start)} — ${short.format(end)}`;
}

function getTopicText(
  forecast: PersonalForecastPackage,
  topicKey: ForecastTopicKey,
) {
  if (FIXED_FORECAST_TOPIC_KEYS.includes(topicKey as any)) {
    return forecast[topicKey as keyof Pick<
      PersonalForecastPackage,
      'overview' | 'love' | 'work' | 'money' | 'mood_energy' | 'communication' | 'luck'
    >];
  }
  return forecast.dynamic.find((topic) => topic.key === topicKey)?.text || null;
}

export const Dashboard = memo<DashboardProps>(({
  profile,
  chartData,
  chartId,
  currentDateKey,
  onOpenPersonalForecast,
  onCreateNatalChart,
  onOpenSynastry,
  onOpenMatrix,
  scrollRef,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const userId = String(profile.id || 'guest');
  const hasChart = hasNatalChart(profile, {
    chartData,
    primaryChartId: chartId ?? null,
  });
  const timezone = normalizeForecastTimezone(
    chartData?.timezone || profile.birthTimezone,
  );
  const [activePeriod, setActivePeriod] = useState<PersonalForecastPeriod>('day');
  const [periodStates, setPeriodStates] = useState<Record<string, PeriodState>>({});
  const requestsRef = useRef<Partial<Record<string, Promise<void>>>>({});

  const periodKeys = useMemo<Record<PersonalForecastPeriod, string>>(() => ({
    day: getPersonalForecastPeriodKey('day', new Date(), timezone),
    week: getPersonalForecastPeriodKey('week', new Date(), timezone),
    month: getPersonalForecastPeriodKey('month', new Date(), timezone),
    year: getPersonalForecastPeriodKey('year', new Date(), timezone),
  }), [currentDateKey, timezone]);

  const contextKey = [
    userId,
    chartId ?? 'primary',
    chartData?.calculationVersion || 'none',
    timezone,
    language,
    periodKeys.day,
  ].join(':');

  useEffect(() => {
    requestsRef.current = {};
    if (!chartData || !hasChart) {
      setPeriodStates({});
      return;
    }
    const local = readLocalPersonalForecast({
      profile,
      chartData,
      chartId,
      period: 'day',
      periodKey: periodKeys.day,
    });
    setPeriodStates(local
      ? { day: { result: local, phase: 'ready' } }
      : { day: { result: null, phase: 'idle' } });
  }, [contextKey, chartData, chartId, hasChart, periodKeys.day, profile]);

  const loadPeriod = useCallback((
    period: PersonalForecastPeriod,
    options?: { retry?: boolean },
  ) => {
    if (!chartData || !hasChart) return;
    const periodKey = periodKeys[period];
    const requestKey = `${contextKey}:${period}:${periodKey}`;
    if (requestsRef.current[requestKey] && !options?.retry) return;

    const local = readLocalPersonalForecast({
      profile,
      chartData,
      chartId,
      period,
      periodKey,
    });
    if (local) {
      setPeriodStates((current) => ({
        ...current,
        [period]: { result: local, phase: 'ready' },
      }));
    } else {
      setPeriodStates((current) => ({
        ...current,
        [period]: {
          result: current[period]?.result || null,
          phase: current[period]?.result ? 'ready' : 'loading',
        },
      }));
    }

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
        setPeriodStates((current) => ({
          ...current,
          [period]: { result: next, phase: 'ready' },
        }));
      } catch {
        setPeriodStates((current) => ({
          ...current,
          [period]: {
            result: current[period]?.result || local,
            phase: current[period]?.result || local ? 'ready' : 'error',
          },
        }));
      } finally {
        delete requestsRef.current[requestKey];
      }
    })();
    requestsRef.current[requestKey] = request;
  }, [
    chartData,
    chartId,
    contextKey,
    hasChart,
    periodKeys,
    profile,
  ]);

  useEffect(() => {
    loadPeriod('day');
  }, [contextKey, loadPeriod]);

  useEffect(() => {
    loadPeriod(activePeriod);
  }, [activePeriod, loadPeriod]);

  const state = periodStates[activePeriod] || EMPTY_PERIOD_STATE;
  const result = state.result;
  const forecast = result?.forecast || null;
  const locked = useMemo(
    () => new Set(result?.lockedTopicKeys || []),
    [result?.lockedTopicKeys],
  );
  const visual = useMemo(() => resolveForecastVisualScreen(
    buildForecastVisualRequests({
      userId,
      period: activePeriod,
      periodKey: periodKeys[activePeriod],
      dynamicTopicKeys: forecast?.dynamic.map((topic) => topic.key) || [],
    }),
  ), [activePeriod, forecast?.dynamic, periodKeys, userId]);

  const heroVisual = visual.assignments['hero:overview'];
  const periodLabel = formatPeriodLabel(
    forecast,
    activePeriod,
    periodKeys[activePeriod],
    language,
    timezone,
  );
  const displayName = profile.name?.trim() || (language === 'ru' ? 'друг' : 'friend');
  const heroTitle = FORECAST_OVERVIEW_TITLES[language][activePeriod];
  const heroText = forecast?.overview.card || '';
  const isLoading = !forecast && (state.phase === 'idle' || state.phase === 'loading');
  const isError = !forecast && state.phase === 'error';

  const natalBackground = useMemo(
    () => getUniversalCardBackground('natal', userId, periodKeys.day),
    [periodKeys.day, userId],
  );
  const compatibilityBackground = useMemo(
    () => getUniversalCardBackground('compatibility', userId, periodKeys.day),
    [periodKeys.day, userId],
  );
  const matrixBackground = useMemo(
    () => getUniversalCardBackground('matrix', userId, periodKeys.day),
    [periodKeys.day, userId],
  );

  const selectPeriod = (period: PersonalForecastPeriod) => {
    lumiaSelectionHaptic();
    setActivePeriod(period);
  };

  const openTopic = (topicKey: ForecastTopicKey) => {
    lumiaSelectionHaptic();
    if (!hasChart) {
      onCreateNatalChart?.();
      return;
    }
    if (!forecast) {
      loadPeriod(activePeriod, { retry: true });
      return;
    }
    onOpenPersonalForecast({
      forecast,
      topicKey,
      locked: locked.has(topicKey),
    });
  };

  const renderTopicCard = (
    topicKey: ForecastTopicKey,
    title: string,
    text: string,
    slot: 'fixed' | 'dynamic',
  ) => {
    const assignment = visual.assignments[`${slot}:${topicKey}`];
    const topicLocked = locked.has(topicKey);
    return (
      <button
        key={topicKey}
        type="button"
        className={`home-sphere-card home-sphere-card--${topicKey}${assignment?.path ? ' has-card-background' : ' has-forecast-fallback'}${topicLocked ? ' is-locked' : ''}`}
        style={forecastVisualStyle(assignment, activePeriod)}
        onClick={() => openTopic(topicKey)}
      >
        <span className="home-sphere-title">{title}</span>
        <span className="home-sphere-hook">
          {text || (isError
            ? (language === 'ru' ? 'Не удалось загрузить. Нажми, чтобы повторить.' : 'Could not load. Tap to retry.')
            : (language === 'ru' ? 'Прогноз готовится' : 'Forecast is being prepared'))}
        </span>
        {topicLocked ? (
          <span className="home-forecast-topic-lock" aria-label="Premium">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <rect x="3.5" y="8" width="11" height="7" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <path d="M6 8V6.25a3 3 0 0 1 6 0V8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div
      className="fresh-page home-screen lumia-main-scroll lumia-bottom-tab-scroll"
      ref={scrollRef as React.RefObject<HTMLDivElement>}
    >
      <section className="home-top" aria-label={language === 'ru' ? 'Твой Гороскоп' : 'Your Horoscope'}>
        <div className="home-logo-bar">
          <span className="home-logo-wordmark">{language === 'ru' ? 'Твой Гороскоп' : 'Your Horoscope'}</span>
        </div>
        <div className="home-top-content">
          <p className="home-top-greeting">
            {language === 'ru' ? `Привет, ${displayName}` : `Hi, ${displayName}`}
          </p>
          <div className="home-period-tabs" role="tablist" aria-label={language === 'ru' ? 'Период' : 'Period'}>
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`home-period-tab${tab.id === activePeriod ? ' is-active' : ''}`}
                role="tab"
                aria-selected={tab.id === activePeriod}
                onClick={() => selectPeriod(tab.id)}
              >
                {tab[language]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <button
        type="button"
        className={`home-day-hero home-day-hero--${state.phase}${heroVisual?.path ? ' has-card-background' : ' has-forecast-fallback'}`}
        style={forecastVisualStyle(heroVisual, activePeriod)}
        onClick={() => openTopic('overview')}
        aria-busy={isLoading}
      >
        <span className="home-day-hero-glow" aria-hidden />
        <span className="home-day-hero-copy">
          <span className="home-day-hero-date">{periodLabel}</span>
          <span className="home-day-hero-title">{heroTitle}</span>
          <span className="home-day-hero-text">
            {heroText || (isError
              ? (language === 'ru' ? 'Прогноз пока недоступен. Нажми, чтобы повторить.' : 'Forecast is unavailable. Tap to retry.')
              : !hasChart
                ? (language === 'ru' ? 'Добавь данные рождения, чтобы получить личный прогноз.' : 'Add birth data to get your personal forecast.')
                : (language === 'ru' ? 'Личный прогноз готовится в фоне.' : 'Your personal forecast is being prepared in the background.'))}
          </span>
        </span>
      </button>

      <section className="home-spheres" aria-label={language === 'ru' ? 'Темы личного прогноза' : 'Personal forecast topics'}>
        <div className="home-spheres-track">
          {FIXED_CARD_KEYS.map((topicKey) => renderTopicCard(
            topicKey,
            FORECAST_TOPIC_TITLES[language][topicKey],
            forecast ? getTopicText(forecast, topicKey)?.card || '' : '',
            'fixed',
          ))}
        </div>
      </section>

      {forecast?.dynamic.length ? (
        <section className="home-forecast-dynamic" aria-label={language === 'ru' ? 'Что ещё важно' : 'What else matters'}>
          <h2 className="home-section-heading">{language === 'ru' ? 'Что ещё важно' : 'What else matters'}</h2>
          <div className="home-forecast-dynamic-list">
            {forecast.dynamic.map((topic) => renderTopicCard(
              topic.key,
              topic.title,
              topic.text.card,
              'dynamic',
            ))}
          </div>
        </section>
      ) : hasChart ? (
        <section className="home-forecast-dynamic" aria-label={language === 'ru' ? 'Что ещё важно' : 'What else matters'}>
          <h2 className="home-section-heading">{language === 'ru' ? 'Что ещё важно' : 'What else matters'}</h2>
          <div className="home-forecast-dynamic-list" aria-busy={!isError}>
            {[0, 1].map((index) => (
              <button
                key={index}
                type="button"
                className="home-sphere-card has-forecast-fallback"
                onClick={() => loadPeriod(activePeriod, { retry: true })}
              >
                <span className="home-sphere-title">
                  {language === 'ru' ? 'Дополнительная тема' : 'Additional topic'}
                </span>
                <span className="home-sphere-hook">
                  {isError
                    ? (language === 'ru' ? 'Не удалось загрузить. Нажми, чтобы повторить.' : 'Could not load. Tap to retry.')
                    : (language === 'ru' ? 'Определяется по расчёту периода' : 'Selected from the period calculation')}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="home-product-grid" aria-label={language === 'ru' ? 'Другие разделы' : 'Other sections'}>
        <button
          type="button"
          className={`home-product-card home-product-card--natal home-product-card--wide${natalBackground ? ' has-card-background' : ''}`}
          style={cardBackgroundStyle(natalBackground)}
          onClick={() => { lumiaSelectionHaptic(); onCreateNatalChart?.(); }}
        >
          <span className="home-product-card-copy">
            <span className="home-product-card-kicker">{language === 'ru' ? 'Натальная карта' : 'Natal chart'}</span>
            <span className="home-product-card-title">{language === 'ru' ? 'Вот почему ты именно такой' : 'This is why you are the way you are'}</span>
            <span className="home-product-card-text">
              {language === 'ru'
                ? 'Характер, сильные стороны и знакомые сценарии — по твоей карте рождения.'
                : 'Character, strengths, and familiar patterns from your birth chart.'}
            </span>
          </span>
        </button>

        <button
          type="button"
          className={`home-product-card home-product-card--compat home-product-card--wide${compatibilityBackground ? ' has-card-background' : ''}`}
          style={cardBackgroundStyle(compatibilityBackground)}
          onClick={() => { lumiaSelectionHaptic(); onOpenSynastry?.(); }}
        >
          <span className="home-product-card-copy">
            <span className="home-product-card-kicker">{language === 'ru' ? 'Совместимость' : 'Compatibility'}</span>
            <span className="home-product-card-title">{language === 'ru' ? 'Что между вами на самом деле' : 'What is really between you'}</span>
            <span className="home-product-card-text">
              {language === 'ru'
                ? 'Где вас тянет друг к другу, а где вы начинаете говорить на разных языках.'
                : 'Where you are drawn together and where you start speaking different languages.'}
            </span>
          </span>
        </button>

        {onOpenMatrix ? (
          <button
            type="button"
            className={`home-product-card home-product-card--matrix home-product-card--wide${matrixBackground ? ' has-card-background' : ''}`}
            style={cardBackgroundStyle(matrixBackground)}
            onClick={() => { lumiaSelectionHaptic(); onOpenMatrix(); }}
          >
            <span className="home-product-card-copy">
              <span className="home-product-card-kicker">{language === 'ru' ? MATRIX_TITLE.ru : MATRIX_TITLE.en}</span>
              <span className="home-product-card-title">{language === 'ru' ? 'Твоя дата — не просто цифры' : 'Your date is more than numbers'}</span>
              <span className="home-product-card-text">
                {language === 'ru'
                  ? 'Что даётся тебе легко, а где ты снова попадаешь в знакомый сюжет.'
                  : 'What comes naturally and where you keep returning to a familiar pattern.'}
              </span>
            </span>
          </button>
        ) : null}
      </section>

      <HomeFaq language={language} />

    </div>
  );
});

Dashboard.displayName = 'Dashboard';
