import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ChevronLeft, LoaderCircle, RefreshCw } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import type { UserProfile } from '../types';
import { hasActivePremium } from '../lib/accessMatrix';
import { noteForecastSeenForReview } from '../services/rustoreReview';
import {
  buildPersonalForecastBirthProfileFingerprint,
  getPersonalForecastPeriodKey,
  normalizeForecastTimezone,
  resolvePersonalForecastWindow,
  type PersonalForecastPeriod,
} from '../lib/personalForecastContract';
import {
  loadPersonalForecast,
  readLastSavedPersonalForecast,
  readLocalPersonalForecast,
  selectActiveReadyPersonalForecast,
  type PersonalForecastClientError,
  type PersonalForecastClientResult,
} from '../services/personalForecastService';
import { ForecastSectionBlock } from '../components/PersonalForecastFeed/ForecastSectionBlock';
import { PersonalForecastPremiumGate } from '../components/PersonalForecastFeed/PersonalForecastPremiumGate';
import { TodayEditorialFeed } from '../components/PersonalForecastFeed/TodayEditorialFeed';
import { TodayExploreCards } from '../components/PersonalForecastFeed/TodayExploreCards';
import { TodaySkyMonitor } from '../components/PersonalForecastFeed/TodaySkyMonitor';
import { FutureView } from '../components/PersonalForecastFeed/FutureView';
import { FuturePeriodCards, type FuturePeriodCardData } from '../components/PersonalForecastFeed/FuturePeriodCards';
import { readingOpeningLines } from '../lib/futurePeriodTeaser';
import { HomeEntryTiles } from '../components/home/HomeEntryTiles';
import { ForYouBlock } from '../components/home/ForYouBlock';
import { TodayAboutYou } from '../components/home/TodayAboutYou';
import { PeopleBlock } from '../components/home/PeopleBlock';
import { SeasonCard } from '../components/home/SeasonCard';
import { GiftIdeasSheet, type GiftPerson } from '../components/home/GiftIdeasSheet';
import { peekExploreCharts } from '../components/PersonalForecastFeed/exploreCharts';
import { computeMatrix } from '../lib/matrixOfDestiny';
import type { ForYouAction } from '../lib/forYou';
import { ListenForecastButton } from '../components/audio/ListenForecastButton';
import { buildForecastListenScript } from '../lib/tts/forecastListenScript';
import { DailyQuestionCard } from '../components/home/DailyQuestionCard';
import { claimWeekGift, loadGiftStatus, type GiftStatus } from '../services/giftService';
import { FutureInviteCard } from '../components/PersonalForecastFeed/FutureInviteCard';
import { futureHorizonDays } from '../lib/futureCalendar';
import { SkyHero } from '../components/home/SkyHero';
import { AppTopBar } from '../components/lumia-ui/AppTopBar';
import { EditorialChartsButton } from '../components/editorial/EditorialScreenChrome';
import { lumiaSelectionHaptic } from '../lib/haptics';
import { formatPersonalForecastAttribution } from '../lib/personalForecastPresentation';

type DashboardProps = {
  profile: UserProfile;
  currentDateKey?: string;
  onCreateNatalChart?: () => void;
  requestedPeriod?: PersonalForecastPeriod;
  onPeriodChange?: (period: PersonalForecastPeriod) => void;
  onOpenCharts?: () => void;
  onOpenSynastry?: () => void;
  onOpenMatrix?: () => void;
  /** Opens the birth details form to add the birth time. */
  onEditBirthTime?: () => void;
  /** Opens compatibility with a saved person. */
  onOpenPair?: (chartId: string, name: string) => void;
  /** Opens «Тесты о себе», optionally continuing one test. */
  onOpenTests?: (testId?: string) => void;
  /** Opens «Неделя настроения». */
  onOpenMood?: () => void;
  /** Opens «Звуки»: pause, calm sounds, music and sleep stories. */
  onOpenSounds?: () => void;
  /** Opens «Рассказы»: daily story series. */
  onOpenStories?: () => void;
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
  contextKey: string | null;
  result: PersonalForecastClientResult | null;
  phase: 'idle' | 'loading' | 'ready' | 'error';
  errorCode: string | null;
  errorStatus: number | null;
  failureCount: number;
};

type PeriodRequest = {
  promise: Promise<void>;
};

const FORECAST_PERIODS: readonly PersonalForecastPeriod[] = ['day', 'week', 'month'];
/**
 * The home switcher has two tabs: «Сегодня» and «Будущее». The week reading
 * lives inside «Будущее» next to the month one; `requestedPeriod: 'week'` opens it there.
 */
const HOME_TABS: readonly PersonalForecastPeriod[] = ['day', 'month'];
type FutureReader = 'week' | 'month';
const FORECAST_RECOVERY_DELAYS_MS = [3_000, 8_000, 15_000, 30_000, 60_000] as const;

function emptyPeriodState(): PeriodState {
  return {
    contextKey: null,
    result: null,
    phase: 'idle',
    errorCode: null,
    errorStatus: null,
    failureCount: 0,
  };
}

/**
 * Local storage is rendered first so the forecast opens instantly. A later
 * cache response with the same generated package must not replace that state:
 * React would rerender the whole reading even though the user-visible content
 * did not change.
 */
function isSameRenderedForecast(
  current: PersonalForecastClientResult | null,
  next: PersonalForecastClientResult,
): boolean {
  if (!current) return false;
  return current.accessTier === next.accessTier
    && current.periodLocked === next.periodLocked
    && current.forecast.period === next.forecast.period
    && current.forecast.periodKey === next.forecast.periodKey
    && current.forecast.meta.generatedAt === next.forecast.meta.generatedAt
    && current.lockedSectionIds.length === next.lockedSectionIds.length
    && current.lockedSectionIds.every((id, index) => id === next.lockedSectionIds[index]);
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

export const Dashboard = memo<DashboardProps>(({
  profile,
  currentDateKey,
  onCreateNatalChart,
  requestedPeriod,
  onPeriodChange,
  onOpenCharts,
  onOpenSynastry,
  onOpenMatrix,
  onEditBirthTime,
  onOpenPair,
  onOpenTests,
  onOpenMood,
  onOpenSounds,
  onOpenStories,
  onRequestPremium,
  onPremiumAnalytics,
  scrollRef,
  canPromotePremium = true,
}) => {
  const reduceMotion = useReducedMotion();
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const premium = hasActivePremium(profile);
  const activePeriod: PersonalForecastPeriod = requestedPeriod === 'week' ? 'month' : requestedPeriod || 'day';
  const [futureReader, setFutureReader] = useState<FutureReader | null>(requestedPeriod === 'week' ? 'week' : null);
  const [futureMonthKey, setFutureMonthKey] = useState<string | undefined>(undefined);
  const [giftStatus, setGiftStatus] = useState<GiftStatus | null>(null);
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
  const [lastSavedDay, setLastSavedDay] = useState<{
    contextKey: string;
    result: PersonalForecastClientResult;
  } | null>(null);

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
  const periodLabels: Record<PersonalForecastPeriod, string> = {
    day: language === 'ru' ? 'Сегодня' : 'Today',
    week: language === 'ru' ? 'Неделя' : 'Week',
    // The month tab is «Будущее»: week and month readings, then the calendar.
    month: language === 'ru' ? 'Будущее' : 'Future',
  };
  const personalForecastNote: Record<PersonalForecastPeriod, string> = language === 'ru'
    ? {
        day: 'Личный прогноз на сегодня — по твоим данным рождения.',
        week: 'Личный прогноз на неделю — по твоим данным рождения.',
        month: 'Твоя неделя, твой месяц и календарь вперёд — по твоим данным рождения.',
      }
    : {
        day: 'Your personal forecast for today — based on your birth details.',
        week: 'Your personal forecast for the week — based on your birth details.',
        month: 'Your week, your month and the calendar ahead — based on your birth details.',
      };
  const weekWindow = useMemo(
    () => resolvePersonalForecastWindow('week', periodKeys.week, timezone),
    [periodKeys.week, timezone],
  );
  const monthWindow = useMemo(
    () => resolvePersonalForecastWindow('month', periodKeys.month, timezone),
    [periodKeys.month, timezone],
  );
  const weekLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    return `${fmt.format(new Date(`${weekWindow.periodStart}T12:00:00Z`))} — ${fmt.format(new Date(`${weekWindow.periodEnd}T12:00:00Z`))}`;
  }, [language, weekWindow]);
  const monthName = useMemo(() => {
    const name = new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', { month: 'long', timeZone: 'UTC' })
      .format(new Date(`${monthWindow.periodStart}T12:00:00Z`));
    return language === 'ru' ? name.toLowerCase() : `${name[0].toUpperCase()}${name.slice(1)}`;
  }, [language, monthWindow]);
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
      setLastSavedDay(null);
      setPeriodStates({
        day: emptyPeriodState(),
        week: emptyPeriodState(),
        month: emptyPeriodState(),
      });
      return;
    }
    const savedDay = readLastSavedPersonalForecast({
      profile,
      currentPeriodKey: periodKeys.day,
    });
    setLastSavedDay(savedDay ? { contextKey: productContextKey, result: savedDay } : null);
    setPeriodStates(Object.fromEntries(
      FORECAST_PERIODS.map((period) => {
        const local = readLocalPersonalForecast({
          profile,
          period,
          periodKey: periodKeys[period],
        });
        return [period, {
          contextKey: productContextKey,
          result: local,
          phase: local ? 'ready' : 'idle',
          errorCode: null,
          errorStatus: null,
          failureCount: 0,
        }];
      }),
    ) as Record<PersonalForecastPeriod, PeriodState>);
  }, [productContextKey, periodKeys.day, periodKeys.month, periodKeys.week, profile]);

  const loadPeriod = useCallback((
    period: PersonalForecastPeriod,
    options?: { retry?: boolean; cacheOnly?: boolean },
  ) => {
    if (!profile.name.trim() || !profile.birthDate.trim()) return;
    const giftedWeek = period === 'week' && giftStatus?.weekGift?.periodKey === periodKeys.week;
    if (!premium && period !== 'day' && !giftedWeek) {
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
    setPeriodStates((current) => {
      const currentResult = current[period]?.contextKey === productContextKey
        ? current[period].result
        : null;
      const result = local || currentResult;
      const phase: PeriodState['phase'] = result ? 'ready' : 'loading';
      const failureCount = current[period]?.contextKey === productContextKey
        ? current[period].failureCount
        : 0;
      if (
        current[period]?.contextKey === productContextKey
        && current[period].phase === phase
        && current[period].errorCode === null
        && current[period].errorStatus === null
        && current[period].failureCount === failureCount
        && result !== null
        && isSameRenderedForecast(currentResult, result)
      ) return current;
      return {
        ...current,
        [period]: {
          contextKey: productContextKey,
          result,
          phase,
          errorCode: null,
          errorStatus: null,
          failureCount,
        },
      };
    });

    const requestEntry: PeriodRequest = { promise: Promise.resolve() };
    const request = loadPersonalForecast({
      profile,
      period,
      periodKey,
      options: {
        force: options?.retry,
        cacheOnly: options?.cacheOnly,
        maxInProgressRetries: 3,
      },
    }).then((result) => {
      if (requestsRef.current[period] !== requestEntry) return;
      setPeriodStates((current) => {
        const currentState = current[period];
        if (
          currentState.contextKey === productContextKey
          && currentState.phase === 'ready'
          && isSameRenderedForecast(currentState.result, result)
        ) return current;
        return {
          ...current,
          [period]: {
            contextKey: productContextKey,
            result,
            phase: 'ready',
            errorCode: null,
            errorStatus: null,
            failureCount: 0,
          },
        };
      });
    }).catch((error: PersonalForecastClientError) => {
      if (requestsRef.current[period] !== requestEntry) return;
      setPeriodStates((current) => {
        const result = current[period]?.contextKey === productContextKey
          ? current[period].result
          : null;
        const phase: PeriodState['phase'] = result ? 'ready' : 'error';
        const failureCount = current[period]?.contextKey === productContextKey
          ? current[period].failureCount + 1
          : 1;
        return {
          ...current,
          [period]: {
            contextKey: productContextKey,
            result,
            phase,
            errorCode: result ? null : error.code || 'PERSONAL_FORECAST_GENERATION_FAILED',
            errorStatus: result ? null : error.status || null,
            failureCount,
          },
        };
      });
    }).finally(() => {
      if (requestsRef.current[period] === requestEntry) {
        delete requestsRef.current[period];
      }
    });
    requestEntry.promise = request;
    requestsRef.current[period] = requestEntry;
  }, [giftStatus?.weekGift?.periodKey, periodKeys, premium, productContextKey, profile]);

  useEffect(() => {
    if (premium || !profile.birthDate.trim()) {
      setGiftStatus(null);
      return;
    }
    let active = true;
    void loadGiftStatus().then((status) => { if (active) setGiftStatus(status); }).catch(() => undefined);
    return () => { active = false; };
  }, [premium, productContextKey, profile.birthDate]);

  useEffect(() => {
    loadPeriod(activePeriod);
  }, [activePeriod, loadPeriod, productContextKey]);

  const activeState = periodStates[activePeriod].contextKey === productContextKey
    ? periodStates[activePeriod]
    : emptyPeriodState();
  useEffect(() => {
    if (activeState.result || activeState.phase !== 'error') return;
    const status = activeState.errorStatus;
    if (status !== null && status < 500 && ![202, 404, 408, 425, 429].includes(status)) return;

    const failures = activeState.failureCount;
    const delay = FORECAST_RECOVERY_DELAYS_MS[Math.min(
      Math.max(failures - 1, 0),
      FORECAST_RECOVERY_DELAYS_MS.length - 1,
    )];
    const checkPrepared = () => loadPeriod(activePeriod, { retry: true, cacheOnly: true });
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible') checkPrepared();
    };
    const timer = window.setTimeout(() => {
      loadPeriod(activePeriod, {
        retry: true,
        // Recheck the prepared package first; periodically re-trigger generation
        // for an account that has no package yet.
        cacheOnly: failures % 4 !== 0,
      });
    }, delay);
    window.addEventListener('online', checkPrepared);
    document.addEventListener('visibilitychange', checkWhenVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', checkPrepared);
      document.removeEventListener('visibilitychange', checkWhenVisible);
    };
  }, [activePeriod, activeState.errorStatus, activeState.failureCount, activeState.phase, activeState.result, loadPeriod]);

  useEffect(() => {
    scrollRef?.current?.scrollTo({
      top: 0,
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [activePeriod, reduceMotion, scrollRef]);

  useEffect(() => {
    setFocusedPeriod(activePeriod);
  }, [activePeriod]);

  useEffect(() => {
    if (requestedPeriod === 'week') setFutureReader('week');
    else if (requestedPeriod !== 'month') setFutureReader(null);
  }, [requestedPeriod]);

  useEffect(() => {
    scrollRef?.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [futureReader, scrollRef]);

  const selectPeriod = useCallback((period: PersonalForecastPeriod) => {
    if (period === activePeriod && !futureReader) return;
    lumiaSelectionHaptic();
    setFutureReader(null);
    setFutureMonthKey(undefined);
    onPeriodChange?.(period);
  }, [activePeriod, futureReader, onPeriodChange]);

  const closeFutureReader = useCallback(() => {
    setFutureReader(null);
    if (requestedPeriod === 'week') onPeriodChange?.('month');
  }, [onPeriodChange, requestedPeriod]);

  // «Будущее» opens with both NEBO+ readings: the week one loads next to the month.
  const weekGifted = !premium && giftStatus?.weekGift?.periodKey === periodKeys.week;
  useEffect(() => {
    if (activePeriod === 'month' && (premium || weekGifted)) loadPeriod('week');
  }, [activePeriod, loadPeriod, premium, productContextKey, weekGifted]);

  const handlePeriodTabKeyDown = useCallback((
    event: React.KeyboardEvent<HTMLButtonElement>,
    period: PersonalForecastPeriod,
  ) => {
    const currentIndex = HOME_TABS.indexOf(period);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % HOME_TABS.length;
    if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + HOME_TABS.length) % HOME_TABS.length;
    }
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = HOME_TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextPeriod = HOME_TABS[nextIndex];
    setFocusedPeriod(nextPeriod);
    periodTabRefs.current[nextPeriod]?.focus();
  }, []);

  const state = activeState;
  const result = state.result
    ? selectActiveReadyPersonalForecast(activePeriod, periodStates, periodKeys[activePeriod])
    : null;
  const forecast = result?.forecast || null;
  const savedDayForecast = activePeriod === 'day' && !forecast
    && lastSavedDay?.contextKey === productContextKey
    ? lastSavedDay.result.forecast
    : null;
  const savedDayDate = savedDayForecast
    ? new Intl.DateTimeFormat(language === 'ru' ? 'ru-RU' : 'en-US', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(`${savedDayForecast.periodKey}T12:00:00Z`))
    : null;
  useEffect(() => {
    if (forecast?.meta.diagnosticCode !== 'PERSONAL_FORECAST_PARTIAL_RECOVERY') return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadPeriod(activePeriod, { retry: true, cacheOnly: true });
      }
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [activePeriod, forecast?.meta.diagnosticCode, forecast?.periodKey, loadPeriod]);
  const storySections = useMemo(
    () => forecast ? [forecast.overview, ...forecast.sections] : [],
    [forecast],
  );
  const lockedSectionIds = useMemo(
    () => new Set(result?.lockedSectionIds || []),
    [result?.lockedSectionIds],
  );
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
    noteForecastSeenForReview();
    onPremiumAnalytics?.('first_value_viewed', {
      placement: 'today',
      featureKey: 'personal_daily',
      periodKey: forecast.periodKey,
      contentMode: 'personal-forecast',
      generatedDuringRequest: periodStates.day.result?.generatedDuringRequest === true,
    });
  }, [activePeriod, forecast, onPremiumAnalytics, periodStates.day.result, profile.id]);

  useEffect(() => {
    if (!forecast || activePeriod === 'day' || !lockedSectionIds.size || !canPromotePremium) return;
    const key = `${String(profile.id || 'guest')}:${forecast.periodKey}:promo`;
    if (promoSeenRef.current.has(key)) return;
    promoSeenRef.current.add(key);
    onPremiumAnalytics?.('premium_promo_impression', {
      placement: activePeriod,
      featureKey: 'personal_monthly',
      periodKey: forecast.periodKey,
    });
  }, [activePeriod, canPromotePremium, forecast, lockedSectionIds.size, onPremiumAnalytics, profile.id]);

  const requestPremiumFor = useCallback((targetPeriod: PersonalForecastPeriod) => {
    const targetKey = targetPeriod === activePeriod
      ? forecast?.periodKey || periodKeys[targetPeriod]
      : periodKeys[targetPeriod];
    if (targetPeriod !== 'day') {
      onPremiumAnalytics?.('locked_feature_tapped', {
        placement: targetPeriod,
        featureKey: targetPeriod === 'week' ? 'personal_weekly' : 'personal_monthly',
        periodKey: periodKeys[targetPeriod],
      });
    } else {
      onPremiumAnalytics?.('premium_promo_clicked', {
        placement: 'today',
        featureKey: 'personal_daily_full',
        periodKey: targetKey,
      });
    }
    void onRequestPremium?.('personal_forecast_feed', {
      period: targetPeriod,
      periodKey: targetKey,
      placement: targetPeriod === 'day' ? 'today' : targetPeriod,
      featureKey: targetPeriod === 'day'
        ? 'personal_daily_full'
        : targetPeriod === 'week'
          ? 'personal_weekly'
          : 'personal_monthly',
      triggerType: targetPeriod === 'day' ? 'inline_promo' : 'locked_feature',
      returnView: 'dashboard',
      returnScrollAnchor: 'personal-forecast-reading',
    });
  }, [activePeriod, forecast?.periodKey, onPremiumAnalytics, onRequestPremium, periodKeys]);
  const requestPremium = useCallback(() => requestPremiumFor(activePeriod), [activePeriod, requestPremiumFor]);

  const openFuture = useCallback((monthKey?: string) => {
    lumiaSelectionHaptic();
    setFutureMonthKey(monthKey);
    setFutureReader(null);
    onPeriodChange?.('month');
  }, [onPeriodChange]);

  const [giftPerson, setGiftPerson] = useState<GiftPerson | null>(null);

  const handleForYouAction = useCallback((action: Exclude<ForYouAction, { type: 'wishes' } | { type: 'month_review' }>) => {
    if (action.type === 'person_gift') {
      const chart = peekExploreCharts(String(profile.id || 'guest'))?.find((item) => String(item.id) === action.chartId);
      setGiftPerson({ name: action.name, chart: chart?.chart_data ?? null, relation: chart?.relation_label ?? null });
      return;
    }
    if (action.type === 'future') openFuture(action.monthKey);
    else if (action.type === 'compatibility') onOpenSynastry?.();
    else if (action.type === 'pair') onOpenPair?.(action.chartId, action.name);
    else if (action.type === 'birth_time') onEditBirthTime?.();
    else if (action.type === 'test') onOpenTests?.(action.testId);
    else if (action.type === 'mood') onOpenMood?.();
    else if (action.type === 'week') {
      if (!premium) {
        requestPremiumFor('week');
        return;
      }
      setFutureReader('week');
      onPeriodChange?.('month');
    } else if (action.type === 'gift') {
      void claimWeekGift(action.reason)
        .then((claimed) => {
          setGiftStatus((current) => (current ? { ...current, claimable: null, weekGift: claimed.weekGift } : current));
          setFutureReader('week');
          onPeriodChange?.('month');
        })
        .catch(() => { void loadGiftStatus().then(setGiftStatus).catch(() => undefined); });
    } else if (action.type === 'premium') {
      void onRequestPremium?.('for_you', {
        placement: 'for_you',
        featureKey: 'premium_renewal',
        triggerType: 'inline_promo',
        returnView: 'dashboard',
      });
    }
  }, [onEditBirthTime, onOpenMood, onOpenPair, onOpenSynastry, onOpenTests, onPeriodChange, onRequestPremium, openFuture, premium, profile.id, requestPremiumFor]);

  const futureReading = useCallback((period: FutureReader) => {
    const periodState = periodStates[period].contextKey === productContextKey
      ? periodStates[period]
      : emptyPeriodState();
    const ready = periodState.result
      ? selectActiveReadyPersonalForecast(period, periodStates, periodKeys[period])
      : null;
    return { state: periodState, ready };
  }, [periodKeys, periodStates, productContextKey]);

  const futureCardData = useCallback((period: FutureReader, teaser: readonly string[]): FuturePeriodCardData => {
    if (!premium && !(period === 'week' && weekGifted)) return { phase: 'locked', opening: '', teaser };
    const { state: periodState, ready } = futureReading(period);
    if (ready) {
      const overview = ready.forecast.overview;
      const prose = overview.contentBlocks
        .filter((block) => block.role !== 'action')
        .map((block) => block.text)
        .join(' ') || overview.text;
      return { phase: 'ready', opening: readingOpeningLines(prose), teaser };
    }
    return { phase: periodState.phase === 'error' ? 'error' : 'loading', opening: '', teaser };
  }, [futureReading, premium, weekGifted]);

  useEffect(() => {
    if (activePeriod !== 'month' || premium || !canPromotePremium) return;
    const key = `${String(profile.id || 'guest')}:${periodKeys.week}:future-cards`;
    if (promoSeenRef.current.has(key)) return;
    promoSeenRef.current.add(key);
    onPremiumAnalytics?.('premium_promo_impression', {
      placement: 'future',
      featureKey: 'personal_weekly',
      periodKey: periodKeys.week,
    });
  }, [activePeriod, canPromotePremium, onPremiumAnalytics, periodKeys.week, premium, profile.id]);

  const renderFutureReader = (period: FutureReader) => {
    const { state: periodState, ready } = futureReading(period);
    const readerForecast = ready?.forecast || null;
    const readerSections = readerForecast ? [readerForecast.overview, ...readerForecast.sections] : [];
    const readerLocked = new Set(ready?.lockedSectionIds || []);
    const readerAttribution = formatPersonalForecastAttribution({
      profile: { name: profile.name, birthDate: profile.birthDate },
      window: period === 'week' ? weekWindow : monthWindow,
      language,
    });
    return (
      <section className="future-reader" aria-labelledby="future-reader-title">
        <button type="button" className="future-reader-back" onClick={closeFutureReader}>
          <ChevronLeft size={18} aria-hidden="true" />
          {language === 'ru' ? 'Будущее' : 'Future'}
        </button>
        <p className="future-reader-kicker">
          {period === 'week' ? weekLabel : `${monthName} ${monthWindow.periodStart.slice(0, 4)}`}
        </p>
        <h1 id="future-reader-title" className="future-reader-title">
          {period === 'week'
            ? (language === 'ru' ? 'Твоя неделя' : 'Your week')
            : (language === 'ru' ? `Твой ${monthName}` : `Your ${monthName}`)}
        </h1>
        {!premium && !(period === 'week' && weekGifted) ? (
          <PersonalForecastPremiumGate
            period={period}
            language={language}
            onRequestPremium={() => requestPremiumFor(period)}
            canPromotePremium={canPromotePremium}
          />
        ) : readerForecast ? (
          <>
          <ListenForecastButton
            trackKey={`forecast:${period}:${readerForecast.periodKey}`}
            period={period}
            text={buildForecastListenScript({ forecast: readerForecast, name: profile.name, language, lockedSectionIds: ready?.lockedSectionIds })}
            language={language}
            premium={premium}
          />
          <article
            className="forecast-feed-story forecast-editorial-reading forecast-period-editorial-feed"
            data-forecast-period={period}
            lang={language}
          >
            {readerSections.map((section) => (
              <ForecastSectionBlock
                key={`${period}:${readerForecast.periodKey}:${section.id}`}
                section={section}
                period={period}
                language={language}
                locked={readerLocked.has(section.id)}
                onRequestPremium={() => requestPremiumFor(period)}
              />
            ))}
            {readerAttribution ? (
              <p className="today-period-personal-note forecast-personal-attribution">
                {readerAttribution}
              </p>
            ) : null}
          </article>
          </>
        ) : periodState.phase === 'error' ? (
          <section className="forecast-feed-status" aria-live="polite">
            <h2>{language === 'ru' ? 'Готовим твой прогноз' : 'Preparing your forecast'}</h2>
            <button type="button" onClick={() => loadPeriod(period, { retry: true, cacheOnly: true })}>
              <RefreshCw size={17} aria-hidden />
              {language === 'ru' ? 'Проверить' : 'Check again'}
            </button>
          </section>
        ) : (
          <section
            className="forecast-feed-status forecast-feed-status--loading is-loading"
            aria-live="polite"
            aria-busy="true"
            aria-label={loadingLabel(period, language)}
          >
            <div className="forecast-feed-loading-indicator" aria-hidden>
              <LoaderCircle className="forecast-feed-loading-spinner" size={28} strokeWidth={2} />
            </div>
            <p className="forecast-feed-loading-label">{loadingLabel(period, language)}</p>
          </section>
        )}
      </section>
    );
  };

  const skyCover = Boolean(
    forecast && activePeriod === 'day' && profile.name.trim() && profile.birthDate.trim(),
  );
  const matrixNumber = useMemo(() => {
    const matrix = profile.birthDate ? computeMatrix(profile.birthDate, language) : null;
    return matrix?.positions.find((position) => position.key === 'self')?.arcana ?? null;
  }, [language, profile.birthDate]);


  const periodSwitch = (
  <nav
    className="today-period-navigation"
    role="tablist"
    aria-label={language === 'ru' ? 'Период личного прогноза' : 'Personal forecast period'}
  >
    <div className="today-period-tabs" role="presentation">
      {HOME_TABS.map((period) => (
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
  );

  const topBar = (reserveSpace: boolean) => (
    <AppTopBar
      title="NEBO"
      leftAction={(
        <EditorialChartsButton
          label={language === 'ru' ? 'Открыть мои карты' : 'Open my charts'}
          onClick={onOpenCharts}
        />
      )}
      center={periodSwitch}
      reserveSpace={reserveSpace}
    />
  );

  const entryTiles = (
    <HomeEntryTiles
      language={language}
      matrixNumber={matrixNumber}
      tiles={[
        { id: 'future', onOpen: () => openFuture() },
        { id: 'compatibility', onOpen: onOpenSynastry },
        { id: 'matrix', onOpen: onOpenMatrix },
        { id: 'tests', onOpen: onOpenTests ? () => onOpenTests() : undefined },
        { id: 'sounds', onOpen: onOpenSounds },
        { id: 'stories', onOpen: onOpenStories },
      ]}
    />
  );

  return (
    <div
      id="personal-forecast-reading"
      className={`fresh-page home-screen forecast-feed-page lumia-main-scroll lumia-bottom-tab-scroll is-${activePeriod}${skyCover ? ' has-sky-cover' : ''}`}
      ref={scrollRef as React.RefObject<HTMLDivElement>}
    >
      <section
        className="home-top"
        aria-label={language === 'ru' ? 'Личный гороскоп' : 'Personal horoscope'}
      >
        {/* On the sky cover the sky runs under the glass bar; elsewhere the bar reserves its space. */}
        {topBar(!skyCover)}
      </section>

      {!skyCover ? (
        <p className="today-period-personal-note">
          {savedDayForecast
            ? (language === 'ru'
              ? 'Готовим твой прогноз на сегодня. Ниже — последний сохранённый.'
              : 'Preparing today’s forecast. The last saved one is below.')
            : personalForecastNote[activePeriod]}
        </p>
      ) : null}

      {activePeriod === 'day' && !skyCover ? entryTiles : null}

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
      ) : activePeriod === 'month' && futureReader ? (
        renderFutureReader(futureReader)
      ) : activePeriod === 'month' ? (
        <FutureView
          profile={profile}
          premium={premium}
          horizonDays={futureHorizonDays(profile.premiumEntitlement)}
          todayKey={periodKeys.day}
          weekEndKey={weekWindow.periodEnd}
          language={language}
          initialMonthKey={futureMonthKey}
          onRequestPremium={requestPremium}
          renderPeriodCards={(teasers) => (
            <FuturePeriodCards
              language={language}
              weekLabel={weekLabel}
              monthName={monthName}
              year={Number(monthWindow.periodStart.slice(0, 4))}
              week={futureCardData('week', teasers?.week ?? [])}
              month={futureCardData('month', teasers?.month ?? [])}
              canPromotePremium={canPromotePremium}
              onRead={(period) => {
                if (premium || (period === 'week' && weekGifted)) setFutureReader(period);
                else requestPremiumFor(period);
              }}
              onRetry={(period) => loadPeriod(period, { retry: true, cacheOnly: true })}
            />
          )}
        />
      ) : forecast && activePeriod === 'day' ? (
        <TodayEditorialFeed
          sections={storySections}
          lockedSectionIds={lockedSectionIds}
          userId={String(profile.id || 'guest')}
          periodKey={forecast.periodKey}
          timezone={timezone}
          language={language}
          tone={forecast.meta.astrologerBrief.tone}
          personalAttribution={personalForecastAttribution}
          onRequestPremium={requestPremium}
          afterHero={entryTiles}
          listen={(
            <ListenForecastButton
              trackKey={`forecast:day:${forecast.periodKey}`}
              period="day"
              text={buildForecastListenScript({ forecast, name: profile.name, language, lockedSectionIds: result?.lockedSectionIds })}
              language={language}
              premium={premium}
              onRequestPremium={canPromotePremium ? requestPremium : undefined}
            />
          )}
          footer={(
            <>
            <TodaySkyMonitor userId={String(profile.id || 'guest')} periodKey={forecast.periodKey} />
            <TodayAboutYou
              userId={String(profile.id || 'guest')}
              todayKey={periodKeys.day}
              birthDate={profile.birthDate}
              birthTime={profile.birthTime}
              birthTimeKnown={Boolean(profile.birthTime?.trim()) && profile.birthTimeMode !== 'unknown'}
              task={storySections.find((section) => !lockedSectionIds.has(section.id) && section.actionText?.trim())?.actionText?.trim() ?? null}
            />
            <ForYouBlock
              userId={String(profile.id || 'guest')}
              language={language}
              todayKey={periodKeys.day}
              weekKey={periodKeys.week}
              timezone={timezone}
              birthDate={profile.birthDate}
              birthTimeKnown={Boolean(profile.birthTime?.trim()) && profile.birthTimeMode !== 'unknown'}
              premium={premium}
              premiumEndsAt={profile.premiumEntitlement?.endsAt ?? null}
              premiumAutoRenew={profile.premiumEntitlement?.autoRenew ?? null}
              gift={giftStatus ? { streak: giftStatus.streak, daysToGift: giftStatus.daysToGift, claimable: giftStatus.claimable, hasWeekGift: Boolean(giftStatus.weekGift) } : null}
              onAction={handleForYouAction}
            />
            <DailyQuestionCard language={language} />
            <PeopleBlock
              userId={String(profile.id || 'guest')}
              todayKey={periodKeys.day}
              premium={premium}
              onOpenPair={onOpenPair}
              onAddPerson={onOpenSynastry}
              onGift={setGiftPerson}
            />
            <FutureInviteCard
              userId={String(profile.id || 'guest')}
              todayKey={periodKeys.day}
              timezone={timezone}
              premium={premium}
              onOpen={() => { onPeriodChange?.('month'); }}
            />
            <SeasonCard
              userId={String(profile.id || 'guest')}
              todayKey={periodKeys.day}
              onOpenFuture={() => openFuture()}
            />
            <TodayExploreCards
              language={language}
              userId={String(profile.id || 'guest')}
              birthDate={profile.birthDate}
              premium={premium}
              onOpenNatal={onCreateNatalChart}
              onOpenCompatibility={onOpenSynastry}
              onOpenMatrix={onOpenMatrix}
            />
            </>
          )}
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
      ) : savedDayForecast ? (
        <>
          <SkyHero
            dayKey={periodKeys.day}
            language={language}
            kicker={language === 'ru' ? 'Готовим прогноз на сегодня' : 'Preparing today’s forecast'}
            compact
          >
            <h1 className="sr-only">
              {language === 'ru' ? 'Личный прогноз на сегодня' : 'Your personal forecast for today'}
            </h1>
          </SkyHero>
          <article
            className="forecast-feed-story forecast-editorial-reading forecast-period-editorial-feed"
            data-forecast-period="day"
            lang={language}
          >
            <p className="today-period-personal-note">
              {language === 'ru'
                ? `Последний сохранённый прогноз за ${savedDayDate}`
                : `Last saved forecast for ${savedDayDate}`}
            </p>
            <ForecastSectionBlock
              section={savedDayForecast.overview}
              period="day"
              language={language}
              locked={false}
              onRequestPremium={requestPremium}
            />
          </article>
        </>
      ) : activePeriod === 'day' ? (
        <div aria-live="polite" aria-busy={state.phase === 'loading'}>
          <SkyHero
            dayKey={periodKeys.day}
            language={language}
            kicker={language === 'ru' ? 'Личный прогноз на сегодня' : 'Your personal forecast for today'}
            compact
          >
            <h1 className="sr-only">
              {language === 'ru' ? 'Личный прогноз на сегодня' : 'Your personal forecast for today'}
            </h1>
            <div className="sky-hero-loading" role="status">
              {state.phase === 'error' ? (
                <p>{language === 'ru' ? 'Готовим твой прогноз' : 'Preparing your forecast'}</p>
              ) : (
                <>
                  <LoaderCircle
                    className="forecast-feed-loading-spinner"
                    size={20}
                    strokeWidth={1.8}
                    aria-hidden
                  />
                  <p>{loadingLabel(activePeriod, language)}</p>
                </>
              )}
            </div>
          </SkyHero>
        </div>
      ) : state.phase === 'error' ? (
        <section className="forecast-feed-status" aria-live="polite">
          <h1>{language === 'ru' ? 'Готовим твой прогноз' : 'Preparing your forecast'}</h1>
          <button type="button" onClick={() => loadPeriod(activePeriod, { retry: true, cacheOnly: true })}>
            <RefreshCw size={17} aria-hidden />
            {language === 'ru' ? 'Проверить' : 'Check again'}
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
      <GiftIdeasSheet person={giftPerson} onClose={() => setGiftPerson(null)} />
    </div>
  );
});

Dashboard.displayName = 'Dashboard';
