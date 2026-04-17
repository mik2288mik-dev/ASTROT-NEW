import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ForecastDailyReading,
  UserProfile,
  NatalChartData,
  ViewState,
} from '../types';
import { getText } from '../constants';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import { getCachedDailyForecastLayer, mapLegacyHoroscopeToForecastDailyReading } from '../services/astrologyService';
import { LumiaStudioHeader } from '../components/lumia-ui/LumiaStudioHeader';
import { LumiaButton } from '../components/lumia-ui/LumiaButton';
import { TrueNatalWheelHero } from '../components/Dashboard/TrueNatalWheelHero';
import { cn } from '../lib/cn';

type DashboardView = Extract<ViewState, 'chart' | 'horoscope' | 'synastry' | 'oracle'>;
type StudioTab = 'natal' | 'compatibility' | 'horoscope';

interface DashboardProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  activeChartId?: number;
  onNavigate: (view: DashboardView) => void;
  onOpenSettings: () => void;
  onOpenWallet: () => void;
}

const cleanDashboardText = (value?: string | null): string =>
  String(value || '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const trimDashboardText = (value: string, maxLength: number): string => {
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, maxLength).trim();
  const lastSpace = slice.lastIndexOf(' ');
  const safeCut = lastSpace > Math.floor(maxLength * 0.6) ? lastSpace : maxLength;
  return `${slice.slice(0, safeCut).trim()}...`;
};

const splitIntoDashboardSentences = (value: string): string[] =>
  value
    .split(/(?<=[.!?])\s+/)
    .map((part) => cleanDashboardText(part))
    .filter(Boolean);

const WavyTabLabel: React.FC<{
  label: string;
  active: boolean;
  animateKey: number;
  reduceMotion: boolean;
}> = ({ label, active, animateKey, reduceMotion }) => {
  const chars = Array.from(label);
  const shouldWave = active && animateKey > 0 && !reduceMotion;

  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap text-center text-[12px] font-medium leading-tight tracking-[0.01em] sm:text-[13px]',
        active ? 'text-text-main' : 'text-text-muted'
      )}
    >
      {chars.map((char, index) => (
        <motion.span
          key={`${animateKey}-${index}-${char}`}
          initial={false}
          animate={shouldWave ? { y: [0, -3.5, 0], opacity: [0.92, 1, 0.92] } : { y: 0, opacity: 1 }}
          transition={
            shouldWave
              ? {
                  duration: 0.42,
                  ease: [0.22, 1, 0.36, 1],
                  delay: index * 0.028,
                }
              : { duration: 0.16 }
          }
          className="inline-block"
        >
          {char === ' ' ? '\u00A0' : char}
        </motion.span>
      ))}
    </span>
  );
};

export const Dashboard = memo<DashboardProps>(
  ({ profile, chartData, activeChartId, onNavigate, onOpenSettings, onOpenWallet }) => {
    const [activeTab, setActiveTab] = useState<StudioTab>('natal');
    const [tabWaveKey, setTabWaveKey] = useState(0);
    const [dailyReading, setDailyReading] = useState<ForecastDailyReading | null>(null);
    const [hasNatalHeroAnimated, setHasNatalHeroAnimated] = useState(false);
    const shouldReduceMotion = useReducedMotion();
    const hasMountedRef = useRef(false);

    const language = useMemo(() => profile.language, [profile.language]);
    const langKey = useMemo(
      () => (profile.language === 'en' ? 'en' : 'ru') as 'ru' | 'en',
      [profile.language]
    );

    const horoscopeDateLabel = useMemo(
      () => formatLumiaDate(dailyReading?.date || getMoscowTodayKey(), language),
      [dailyReading?.date, language]
    );

    const adviceLines = useMemo(
      () =>
        (Array.isArray(dailyReading?.advice) ? dailyReading.advice : [])
          .map((item: string) => cleanDashboardText(item))
          .filter(Boolean)
          .slice(0, 3),
      [dailyReading?.advice]
    );

    const readingSentences = useMemo(
      () => splitIntoDashboardSentences(cleanDashboardText(dailyReading?.reading)),
      [dailyReading?.reading]
    );

    const heroHeadline = useMemo(() => {
      const raw =
        cleanDashboardText(dailyReading?.headline) ||
        adviceLines[0] ||
        readingSentences[0] ||
        getText(language, 'dashboard.hero_fallback_title');
      return trimDashboardText(raw.replace(/[.!?]+$/u, '').trim(), 84);
    }, [adviceLines, dailyReading?.headline, language, readingSentences]);

    const heroSupport = useMemo(() => {
      const summary = cleanDashboardText(dailyReading?.summary);
      const candidate =
        summary ||
        readingSentences.find((s) => s !== adviceLines[0]) ||
        cleanDashboardText(dailyReading?.context) ||
        '';
      if (!candidate) return null;
      const normalized = trimDashboardText(candidate, 148);
      if (normalized.replace(/[.!?]+$/u, '') === heroHeadline) return null;
      return normalized;
    }, [adviceLines, dailyReading?.context, dailyReading?.summary, heroHeadline, readingSentences]);

    const todayPoints = useMemo(
      () => [
        {
          label: getText(language, 'dashboard.chance'),
          value: trimDashboardText(
            cleanDashboardText(dailyReading?.chance) ||
              adviceLines[0] ||
              readingSentences[0] ||
              getText(language, 'dashboard.fallback_chance'),
            116
          ),
        },
        {
          label: getText(language, 'dashboard.risk'),
          value: trimDashboardText(
            cleanDashboardText(dailyReading?.risk) ||
              adviceLines[1] ||
              readingSentences[1] ||
              getText(language, 'dashboard.fallback_risk'),
            116
          ),
        },
        {
          label: getText(language, 'dashboard.focus'),
          value: trimDashboardText(
            cleanDashboardText(dailyReading?.focus) ||
              adviceLines[2] ||
              readingSentences[0] ||
              getText(language, 'dashboard.fallback_focus'),
            116
          ),
        },
      ],
      [adviceLines, dailyReading?.chance, dailyReading?.focus, dailyReading?.risk, language, readingSentences]
    );

    const handleNavigateHoroscope = useCallback(() => onNavigate('horoscope'), [onNavigate]);
    const handleNavigateSynastry = useCallback(() => onNavigate('synastry'), [onNavigate]);

    useEffect(() => {
      let cancelled = false;
      const today = getMoscowTodayKey();

      const fromLegacy = (): ForecastDailyReading | null => {
        const legacy = profile.generatedContent?.dailyHoroscope;
        if (legacy?.date === today && legacy.content) {
          return mapLegacyHoroscopeToForecastDailyReading(legacy, langKey);
        }
        return null;
      };

      const run = async () => {
        let next = fromLegacy();
        if (!profile.id) {
          if (!cancelled) setDailyReading(next);
          return;
        }
        try {
          const apiReading = await getCachedDailyForecastLayer(String(profile.id), activeChartId);
          if (
            !cancelled &&
            apiReading &&
            apiReading.date === today &&
            (apiReading.headline || apiReading.reading)
          ) {
            next = apiReading;
          }
        } catch {
          /* stable without forced generation */
        }
        if (!cancelled) setDailyReading(next);
      };

      void run();
      return () => {
        cancelled = true;
      };
    }, [activeChartId, langKey, profile.generatedContent?.dailyHoroscope, profile.id]);

    useEffect(() => {
      hasMountedRef.current = true;
    }, []);

    const rootStyle = {
      paddingBottom:
        'calc(1rem + max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)))',
    } as const;

    const rootClass = cn(
      'relative mx-auto flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden text-text-main'
    );

    const tabButtonClass =
      'relative flex min-h-[42px] flex-1 items-center justify-center px-1 pb-3 pt-1';

    const cardClass = cn(
      'rounded-[30px] p-5 sm:p-6',
      'lumia-glass border border-black/[0.06] bg-white/78 shadow-[0_20px_40px_rgba(0,0,0,0.06)]'
    );

    const panelTransition = { duration: 0.2 };

    const pageVariants = shouldReduceMotion
      ? {
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
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
              duration: 1.28,
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

    const tabs: { id: StudioTab; label: string }[] = [
      { id: 'natal', label: getText(language, 'dashboard.studio_tab_natal') },
      { id: 'compatibility', label: getText(language, 'dashboard.studio_tab_union') },
      { id: 'horoscope', label: getText(language, 'dashboard.studio_tab_horoscope') },
    ];

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
          >
            <div className="flex items-center gap-3">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (activeTab === tab.id) return;
                    setActiveTab(tab.id);
                    setTabWaveKey((current) => current + 1);
                  }}
                  className={tabButtonClass}
                >
                  <WavyTabLabel
                    label={tab.label}
                    active={activeTab === tab.id}
                    animateKey={activeTab === tab.id ? tabWaveKey : 0}
                    reduceMotion={!!shouldReduceMotion}
                  />
                </button>
              ))}
            </div>
          </LumiaStudioHeader>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={hasMountedRef.current ? (shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }) : false}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={panelTransition}
              className={cn(
                'min-h-0 flex-1 pr-0.5',
                activeTab === 'natal'
                  ? 'overflow-hidden'
                  : 'overflow-y-auto overscroll-y-contain space-y-4 sm:space-y-5'
              )}
            >
              {activeTab === 'natal' && (
                <section className="flex h-full min-h-0 flex-col px-1 pt-1">
                  <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[26.5rem] flex-col sm:max-w-[27rem]">
                    <TrueNatalWheelHero
                      profile={profile}
                      chartData={chartData}
                      chartId={activeChartId}
                      shouldAnimateIntro={!hasNatalHeroAnimated}
                      onIntroComplete={() => setHasNatalHeroAnimated(true)}
                      onOpenChart={() => onNavigate('chart')}
                    />
                  </div>
                </section>
              )}

              {activeTab === 'compatibility' && (
                <section className={cn(cardClass, 'space-y-5 text-center')}>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-gold">
                    {getText(language, 'dashboard.synastry_label')}
                  </p>
                  <h3 className="serif text-2xl text-text-main">{getText(language, 'dashboard.menu_synastry')}</h3>
                  <p className="text-left text-sm leading-relaxed text-text-muted">
                    {getText(language, 'dashboard.synastry_body')}
                  </p>
                  <p className="text-xs italic text-text-muted/80">{getText(language, 'dashboard.synastry_hint')}</p>
                  <LumiaButton
                    className="min-h-[46px] w-full"
                    variant="primary"
                    onClick={handleNavigateSynastry}
                  >
                    {getText(language, 'dashboard.synastry_cta')}
                  </LumiaButton>
                </section>
              )}

              {activeTab === 'horoscope' && (
                <section className={cn(cardClass, 'space-y-6')}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted/70">
                        {getText(language, 'dashboard.hero_label')}
                      </p>
                      <h3 className="serif mt-2 text-2xl leading-snug text-text-main">{heroHeadline}</h3>
                    </div>
                    {horoscopeDateLabel && (
                      <span className="shrink-0 text-[11px] tabular-nums text-text-muted">
                        {horoscopeDateLabel}
                      </span>
                    )}
                  </div>

                  {heroSupport && <p className="lumia-reading-body text-text-main/85">{heroSupport}</p>}

                  <div className="space-y-4">
                    {todayPoints.map((item) => (
                      <div key={item.label} className="space-y-1">
                        <p className="text-[10px] uppercase tracking-wider text-text-muted">{item.label}</p>
                        <p className="lumia-reading-body text-text-main/90">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <LumiaButton
                    variant="outline"
                    className="min-h-[46px] w-full"
                    onClick={handleNavigateHoroscope}
                  >
                    {getText(language, 'dashboard.hero_cta')}
                  </LumiaButton>
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }
);

Dashboard.displayName = 'Dashboard';
