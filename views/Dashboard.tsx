import React, { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type {
  HoroscopeLayer,
  NatalChartData,
  TodayPulseResult,
  UserProfile,
} from '../types';
import {
  LumiaHomeContentCards,
  LumiaHomeHeroCard,
  LumiaHomePulseCard,
} from '../components/Dashboard/LumiaHomeSections';
import { UnifiedCollapsibleTopCluster } from '../components/lumia-ui/UnifiedCollapsibleTopCluster';
import { captureLumiaHomeLayout, lumiaDebugLog } from '../lib/lumiaDebug';
import { getTodayPulse } from '../services/astrologyService';

interface DashboardProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer) => void;
  onOpenSettings?: () => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
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
  ({ profile, chartData, chartId, onOpenHoroscopeLayer, onOpenSettings, scrollRef }) => {
    const shouldReduceMotion = useReducedMotion();
    const language = profile.language === 'en' ? 'en' : 'ru';
    const [pulseResult, setPulseResult] = React.useState<TodayPulseResult | null>(null);
    const [isPulseLoading, setIsPulseLoading] = React.useState(true);
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
        setIsPulseLoading(false);
        setPulseResult({
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

      setIsPulseLoading(true);
      lumiaDebugLog('pulse_request', {
        chartId: chartId ?? null,
        hasChartData: !!chartData,
        language,
      });
      getTodayPulse(profile, chartData, chartId ?? null)
        .then((result) => {
          if (!alive) return;
          setPulseResult(result);
          setIsPulseLoading(false);
        })
        .catch((error: any) => {
          if (!alive) return;
          lumiaDebugLog('pulse_api_error', {
            message: error?.message || String(error),
            code: error?.code || null,
          });
          setPulseResult({
            status: 'needs_setup',
            code: 'PROFILE_BIRTH_DATA_REQUIRED',
            message: language === 'ru'
              ? 'Проверь данные рождения в настройках, чтобы Lumia рассчитала пульс дня.'
              : 'Check birth data in settings so Lumia can calculate the day pulse.',
            actionLabel: language === 'ru' ? 'Открыть настройки' : 'Open settings',
          });
          setIsPulseLoading(false);
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
              scrollRef={scrollRef}
              onOpenHoroscopeLayer={onOpenHoroscopeLayer}
            />
            <div className="lumia-home-scroll-content space-y-[var(--lumia-home-gap-lg)] px-[var(--lumia-home-page-x)]">
              <LumiaHomePulseCard
                language={language}
                pulseResult={pulseResult}
                isLoading={isPulseLoading}
                onSetup={onOpenSettings}
              />
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
