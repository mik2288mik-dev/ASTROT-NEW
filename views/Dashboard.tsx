import React, { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type {
  ActionTimingKey,
  ActionTimingRecommendation,
  DailyCheckInInput,
  HoroscopeLayer,
  NatalChartData,
  TodayAssistantHomeResult,
  UserProfile,
} from '../types';
import {
  LumiaHomeContentCards,
  LumiaHomeHeroCard,
  LumiaHomePulseCard,
  TodayAssistantCard,
} from '../components/Dashboard/LumiaHomeSections';
import { LumiaHomeQuickActionCard } from '../components/Dashboard/LumiaHomePrimitives';
import { getLumiaHomeCopy } from '../components/Dashboard/lumiaHomeContent';
import { UnifiedCollapsibleTopCluster } from '../components/lumia-ui/UnifiedCollapsibleTopCluster';
import { captureLumiaHomeLayout, lumiaDebugLog } from '../lib/lumiaDebug';
import { shouldShowTodayAssistantFirst } from '../lib/todayAssistantPriority';
import {
  getActionTimingRecommendation,
  getCachedTodayAssistantHome,
  getTodayAssistantHome,
  submitDailyCheckIn,
} from '../services/astrologyService';

interface DashboardProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer) => void;
  onOpenSettings?: () => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  initialTodaySection?: string | null;
}

function haptic(kind: 'select' | 'open' = 'select') {
  try {
    const webApp = (window as any)?.Telegram?.WebApp;
    if (kind === 'open') webApp?.HapticFeedback?.impactOccurred?.('light');
    else webApp?.HapticFeedback?.selectionChanged?.();
  } catch {
    /* Telegram haptics are optional */
  }
}

export const Dashboard = memo<DashboardProps>(
  ({ profile, chartData, chartId, onOpenHoroscopeLayer, onOpenSettings, scrollRef, initialTodaySection }) => {
    const shouldReduceMotion = useReducedMotion();
    const language = profile.language === 'en' ? 'en' : 'ru';
    const pulseRef = React.useRef<HTMLDivElement | null>(null);
    const assistantRef = React.useRef<HTMLDivElement | null>(null);
    const deepLinkScrollDoneRef = React.useRef(false);
    const cachedAssistant = React.useMemo(
      () => getCachedTodayAssistantHome(profile, chartId ?? null, undefined, chartData),
      [chartData, chartId, profile.birthDate, profile.birthPlace, profile.birthTime, profile.id, profile.language]
    );
    const [assistantResult, setAssistantResult] = React.useState<TodayAssistantHomeResult | null>(cachedAssistant);
    const [isAssistantLoading, setIsAssistantLoading] = React.useState(!cachedAssistant);
    const pulseResult = React.useMemo(() => {
      if (!assistantResult) return null;
      if (assistantResult.status === 'ready') {
        return {
          status: 'ready' as const,
          pulse: assistantResult.pulse,
          chartId: assistantResult.chartId,
          source: assistantResult.source,
        };
      }
      return assistantResult;
    }, [assistantResult]);
    const pageVariants = shouldReduceMotion
      ? {
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
          },
        }
      : {
          hidden: {
            opacity: 0.22,
            y: 16,
            filter: 'blur(8px)',
          },
          visible: {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            transition: {
              duration: 0.72,
              ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            },
          },
        };

    const openHoroscope = (layer: HoroscopeLayer = 'sign') => {
      haptic('open');
      onOpenHoroscopeLayer(layer);
    };

    React.useEffect(() => {
      let alive = true;
      if (!profile.id) {
        setIsAssistantLoading(false);
        setAssistantResult({
          status: 'needs_setup',
          code: 'PROFILE_BIRTH_DATA_REQUIRED',
          message: language === 'ru'
            ? 'Добавь дату и место рождения, чтобы Lumia рассчитала персональный пульс дня.'
            : 'Add birth date and place so Lumia can calculate your personal day pulse.',
          actionLabel: language === 'ru' ? 'Заполнить профиль' : 'Complete profile',
        });
        return () => {
          alive = false;
        };
      }

      const cached = getCachedTodayAssistantHome(profile, chartId ?? null, undefined, chartData);
      if (cached) {
        setAssistantResult(cached);
        setIsAssistantLoading(false);
        return () => {
          alive = false;
        };
      }

      setIsAssistantLoading(true);
      lumiaDebugLog('today_home_request', {
        chartId: chartId ?? null,
        hasChartData: !!chartData,
        language,
      });
      getTodayAssistantHome(profile, chartData, chartId ?? null)
        .then((result) => {
          if (!alive) return;
          setAssistantResult(result);
          setIsAssistantLoading(false);
          if (result.status === 'ready') {
            lumiaDebugLog('today_home_ready', {
              dayMode: result.dayMode,
              chartId: result.chartId,
              historyCount: result.accuracySummary.historyCount,
              checkIn: result.checkIn.status,
            });
          }
        })
        .catch((error: any) => {
          if (!alive) return;
          lumiaDebugLog('today_home_error', {
            message: error?.message || String(error),
            code: error?.code || null,
          });
          setAssistantResult({
            status: 'needs_setup',
            code: 'PROFILE_BIRTH_DATA_REQUIRED',
            message: language === 'ru'
              ? 'Проверь данные рождения в настройках, чтобы Lumia рассчитала пульс дня.'
              : 'Check birth data in settings so Lumia can calculate the day pulse.',
            actionLabel: language === 'ru' ? 'Открыть настройки' : 'Open settings',
          });
          setIsAssistantLoading(false);
        });

      return () => {
        alive = false;
      };
    }, [chartData, chartId, language, profile]);

    React.useEffect(() => {
      lumiaDebugLog('home_mount', {
        profileState: {
          hasProfile: true,
          isPremium: !!profile.isPremium,
          language: profile.language || 'ru',
          isSetup: !!profile.isSetup,
        },
      });
      const t1 = window.setTimeout(() => captureLumiaHomeLayout('home_mount_120ms'), 120);
      const t2 = window.setTimeout(() => captureLumiaHomeLayout('home_mount_700ms'), 700);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }, [profile.isPremium, profile.isSetup, profile.language]);

    React.useEffect(() => {
      if (!initialTodaySection || deepLinkScrollDoneRef.current) return;
      if (isAssistantLoading && initialTodaySection !== 'pulse') return;

      const target =
        initialTodaySection === 'pulse'
          ? pulseRef.current
          : initialTodaySection === 'checkin' || initialTodaySection === 'best-time' || initialTodaySection === 'mini-win'
            ? assistantRef.current
            : null;
      if (!target) return;

      deepLinkScrollDoneRef.current = true;
      window.setTimeout(() => {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 180);
    }, [initialTodaySection, isAssistantLoading]);

    const handleSubmitCheckIn = React.useCallback(async (input: DailyCheckInInput) => {
      const result = await submitDailyCheckIn(profile, chartData, chartId ?? null, input);
      setAssistantResult((prev) => {
        if (!prev || prev.status !== 'ready') return prev;
        return {
          ...prev,
          checkIn: { status: 'completed', entry: result.checkIn },
          accuracySummary: result.accuracySummary,
          patternTeaser: result.patternTeaser,
          insights: result.insights,
        };
      });
      lumiaDebugLog('checkin_submit', {
        chartId: chartId ?? null,
        focus: input.focus,
        mood: input.mood,
        people: input.people,
        forecastFit: input.forecastFit,
        historyCount: result.accuracySummary.historyCount,
      });
    }, [chartData, chartId, profile]);

    const handleSelectAction = React.useCallback(async (actionKey: ActionTimingKey): Promise<ActionTimingRecommendation> => {
      const recommendation = await getActionTimingRecommendation(profile, chartData, chartId ?? null, actionKey);
      lumiaDebugLog('action_timing_select', {
        actionKey,
        state: recommendation.state,
        confidence: recommendation.confidence,
        window: recommendation.bestWindow,
      });
      return recommendation;
    }, [chartData, chartId, profile]);

    const assistantFirst = shouldShowTodayAssistantFirst(assistantResult);
    const homeCopy = React.useMemo(() => getLumiaHomeCopy(language), [language]);
    const quickActions = React.useMemo(
      () => [
        {
          id: 'today',
          title: homeCopy.quickActions.today.title,
          imageSrc: '/lumia-home/quick-actions/horoscope-today.webp',
          onClick: () => openHoroscope('sign'),
        },
        {
          id: 'love',
          title: homeCopy.quickActions.love.title,
          imageSrc: '/lumia-home/quick-actions/love.webp',
          onClick: () => openHoroscope('love'),
        },
        {
          id: 'money',
          title: homeCopy.quickActions.money.title,
          imageSrc: '/lumia-home/quick-actions/money.webp',
          onClick: () => openHoroscope('work_money'),
        },
        {
          id: 'work',
          title: homeCopy.quickActions.work.title,
          imageSrc: '/lumia-home/quick-actions/work.webp',
          onClick: () => openHoroscope('work_money'),
        },
        {
          id: 'rhythm',
          title: homeCopy.quickActions.rhythm.title,
          imageSrc: '/lumia-home/quick-actions/personal-rhythm.webp',
          onClick: () => openHoroscope('chart'),
        },
      ],
      [homeCopy, openHoroscope]
    );

    const pulseCard = (
      <div ref={pulseRef} data-today-section="pulse">
        <LumiaHomePulseCard
          language={language}
          pulseResult={pulseResult}
          isLoading={isAssistantLoading}
          onSetup={onOpenSettings}
        />
      </div>
    );

    const assistantCard = (
      <div ref={assistantRef} data-today-section="assistant">
        <TodayAssistantCard
          language={language}
          assistantResult={assistantResult}
          isLoading={isAssistantLoading}
          onSetup={onOpenSettings}
          onSubmitCheckIn={handleSubmitCheckIn}
          onSelectAction={handleSelectAction}
        />
      </div>
    );

    return (
      <div className="lumia-home-screen relative mx-auto flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={pageVariants}
          className="relative flex min-h-0 flex-1 flex-col"
          style={{ willChange: 'transform, opacity, filter' }}
        >
          <div className="lumia-main-scroll scrollbar-hide" ref={scrollRef}>
            <UnifiedCollapsibleTopCluster
              profile={profile}
              chartData={chartData}
              scrollRef={scrollRef}
            />
            <div className="lumia-home-scroll-content space-y-[var(--lumia-home-gap-lg)] px-[var(--lumia-home-page-x)]">
              <section
                className="lumia-home-content-actions"
                aria-label={language === 'ru' ? 'Быстрые разделы' : 'Quick sections'}
              >
                <div className="scrollbar-hide lumia-home-content-action-scroll">
                  {quickActions.map((action) => (
                    <LumiaHomeQuickActionCard
                      key={action.id}
                      title={action.title}
                      imageSrc={action.imageSrc}
                      active={action.id === 'today'}
                      onClick={action.onClick}
                    />
                  ))}
                </div>
              </section>
              {assistantFirst ? assistantCard : pulseCard}
              {assistantFirst ? pulseCard : assistantCard}
              <LumiaHomeHeroCard language={language} onOpen={() => openHoroscope('sign')} />
              <LumiaHomeContentCards
                language={language}
                isPremium={profile.isPremium}
                onOpenForecast={() => openHoroscope('sign')}
                onOpenFull={() => openHoroscope('chart')}
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }
);

Dashboard.displayName = 'Dashboard';
