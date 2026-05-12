import React, { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type {
  HoroscopeLayer,
  NatalChartData,
  NatalChartMode,
  UserProfile,
  ViewState,
} from '../types';
import {
  LumiaHomeBottomNavigation,
  LumiaHomeContentCards,
  LumiaHomeHeroCard,
  LumiaHomePulseCard,
} from '../components/Dashboard/LumiaHomeSections';
import { UnifiedCollapsibleTopCluster } from '../components/lumia-ui/UnifiedCollapsibleTopCluster';

type DashboardView = Extract<ViewState, 'chart' | 'horoscope' | 'synastry' | 'oracle'>;

interface DashboardProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onNavigate: (view: DashboardView) => void;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer) => void;
  onOpenNatalMode: (mode: NatalChartMode) => void;
  onOpenSettings: () => void;
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
  ({ profile, onNavigate, onOpenHoroscopeLayer, onOpenNatalMode, onOpenSettings, scrollRef }) => {
    const shouldReduceMotion = useReducedMotion();
    const language = profile.language === 'en' ? 'en' : 'ru';
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

    const openNatal = () => {
      haptic('open');
      onOpenNatalMode('human');
    };

    const openSynastry = () => {
      haptic('open');
      onNavigate('synastry');
    };

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
              onOpenSettings={onOpenSettings}
              onOpenHoroscopeLayer={onOpenHoroscopeLayer}
            />
            <div className="lumia-home-scroll-content space-y-[var(--lumia-home-gap-lg)] px-[var(--lumia-home-page-x)]">
              <LumiaHomeHeroCard language={language} onOpen={() => openHoroscope('sign')} />
              <LumiaHomePulseCard language={language} />
              <LumiaHomeContentCards
                language={language}
                isPremium={profile.isPremium}
                onOpenForecast={() => openHoroscope('sign')}
                onOpenFull={() => openHoroscope('chart')}
              />
            </div>
          </div>

          <LumiaHomeBottomNavigation
            language={language}
            onOpenNatal={openNatal}
            onOpenForecast={() => openHoroscope('sign')}
            onOpenSynastry={openSynastry}
          />
        </motion.div>
      </div>
    );
  }
);

Dashboard.displayName = 'Dashboard';
