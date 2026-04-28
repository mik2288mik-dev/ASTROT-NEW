import React, { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  UserProfile,
  NatalChartData,
  NatalChartMode,
  ViewState,
} from '../types';
import { getText } from '../constants';
import { LumiaStudioHeader } from '../components/lumia-ui/LumiaStudioHeader';
import { LumiaButton } from '../components/lumia-ui/LumiaButton';
import { NatalGatewayCarousel } from '../components/Dashboard/NatalGatewayCarousel';
import { cn } from '../lib/cn';

type DashboardView = Extract<ViewState, 'chart' | 'horoscope' | 'synastry' | 'oracle'>;

interface DashboardProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  onNavigate: (view: DashboardView) => void;
  onOpenNatalMode: (mode: NatalChartMode) => void;
  onOpenSettings: () => void;
  onOpenWallet: () => void;
}

export const Dashboard = memo<DashboardProps>(
  ({ profile, chartData, onNavigate, onOpenNatalMode, onOpenSettings, onOpenWallet }) => {
    const shouldReduceMotion = useReducedMotion();
    const language = profile.language;

    const rootStyle = {
      paddingBottom:
        'calc(1rem + max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)))',
    } as const;

    const rootClass = cn(
      'relative mx-auto flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden text-text-main'
    );

    const cardClass = cn(
      'rounded-[30px] p-5 sm:p-6',
      'lumia-glass border border-black/[0.06] bg-white/78 shadow-[0_20px_40px_rgba(0,0,0,0.06)]'
    );

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
            clipPath: 'inset(0 0 100% 0 round 0px)',
            filter: 'blur(8px)',
          },
          visible: {
            opacity: 1,
            clipPath: 'inset(0 0 0% 0 round 0px)',
            filter: 'blur(0px)',
            transition: {
              duration: 1.05,
              ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
            },
          },
        };

    if (!chartData) {
      return (
        <div className={rootClass} style={rootStyle}>
          <motion.div
            initial="hidden"
            animate="visible"
            variants={pageVariants}
            className="relative flex min-h-0 flex-1 flex-col"
            style={{ willChange: 'clip-path, opacity, filter' }}
          >
            <LumiaStudioHeader
              onOpenSettings={onOpenSettings}
              onOpenStore={onOpenWallet}
              settingsAriaLabel={getText(language, 'nav.settings')}
              storeLabel={language === 'en' ? 'Store' : 'Магазин'}
              className="mb-3"
            />

            <section className={cn(cardClass, 'space-y-4 text-center')}>
              <p className="font-medium text-text-main">{getText(language, 'dashboard.chart_load_failed_title')}</p>
              <p className="text-sm leading-relaxed text-text-muted">
                {getText(language, 'dashboard.chart_load_failed_body')}
              </p>
              <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-center">
                <LumiaButton type="button" className="min-h-[46px] w-full sm:w-auto" onClick={() => window.location.reload()}>
                  {getText(language, 'dashboard.chart_load_retry')}
                </LumiaButton>
                <LumiaButton
                  type="button"
                  variant="outline"
                  className="min-h-[46px] w-full sm:w-auto"
                  onClick={() => onNavigate('chart')}
                >
                  {getText(language, 'dashboard.chart_load_open_chart')}
                </LumiaButton>
              </div>
            </section>
          </motion.div>
        </div>
      );
    }

    return (
      <div className={rootClass} style={rootStyle}>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={pageVariants}
          className="relative flex min-h-0 flex-1 flex-col"
          style={{ willChange: 'clip-path, opacity, filter' }}
        >
          <NatalGatewayCarousel
            profile={profile}
            onOpenMode={onOpenNatalMode}
            onOpenSynastry={() => onNavigate('synastry')}
            onOpenHoroscope={() => onNavigate('horoscope')}
          />

          <LumiaStudioHeader
            onOpenSettings={onOpenSettings}
            onOpenStore={onOpenWallet}
            settingsAriaLabel={getText(language, 'nav.settings')}
            storeLabel={language === 'en' ? 'Store' : 'Магазин'}
            className="relative z-40 mb-0 bg-transparent"
          />
        </motion.div>
      </div>
    );
  }
);

Dashboard.displayName = 'Dashboard';
