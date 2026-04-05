import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import {
  DashboardAirVariant,
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
import { cn } from '../lib/cn';
import {
  DASHBOARD_AIR_DEFAULT,
  resolveDashboardAirVariant,
} from '../lib/dashboardAirVariant';

type DashboardView = Extract<ViewState, 'chart' | 'horoscope' | 'synastry' | 'oracle'>;
type StudioTab = 'natal' | 'compatibility' | 'horoscope';

interface DashboardProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  activeChartId?: number;
  onNavigate: (view: DashboardView) => void;
  onOpenSettings: () => void;
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

export const Dashboard = memo<DashboardProps>(
  ({ profile, chartData, activeChartId, onNavigate, onOpenSettings }) => {
    const [activeTab, setActiveTab] = useState<StudioTab>('natal');
    const [dailyReading, setDailyReading] = useState<ForecastDailyReading | null>(null);
    const [airVariant, setAirVariant] = useState<DashboardAirVariant>(
      () =>
        resolveDashboardAirVariant({
          profileVariant: profile.dashboardAirVariant,
          envVariant: process.env.NEXT_PUBLIC_DASHBOARD_AIR_VARIANT,
        }) || DASHBOARD_AIR_DEFAULT
    );

    const language = useMemo(() => profile.language, [profile.language]);
    const langKey = useMemo(
      () => (profile.language === 'en' ? 'en' : 'ru') as 'ru' | 'en',
      [profile.language]
    );

    const isCloud = airVariant === 'cloud-ribbon';
    const isAero = airVariant === 'aero-stack';
    const isOrbit = airVariant === 'orbit-focus';
    const isFeather = airVariant === 'feather-cards';
    const isPulse = airVariant === 'pulse-air';

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

    const natalHighlights = useMemo(
      () => [
        getText(profile.language, 'dashboard.natal_point_character'),
        getText(profile.language, 'dashboard.natal_point_love'),
        getText(profile.language, 'dashboard.natal_point_strengths'),
      ],
      [profile.language]
    );

    const questionsSupport = profile.isPremium
      ? getText(profile.language, 'dashboard.questions_support_premium')
      : getText(profile.language, 'dashboard.questions_support_free');

    const signRows = [
      { id: 'sun', symbol: '\u2609', value: chartData?.sun?.sign || '\u2014' },
      { id: 'moon', symbol: '\u263D', value: chartData?.moon?.sign || '\u2014' },
      { id: 'asc', symbol: 'ASC', value: chartData?.rising?.sign || '\u2014' },
    ];

    const handleNavigateHoroscope = useCallback(() => onNavigate('horoscope'), [onNavigate]);
    const handleNavigateChart = useCallback(() => onNavigate('chart'), [onNavigate]);
    const handleNavigateSynastry = useCallback(() => onNavigate('synastry'), [onNavigate]);
    const handleNavigateOracle = useCallback(() => onNavigate('oracle'), [onNavigate]);

    useEffect(() => {
      setAirVariant((current) => {
        const next = resolveDashboardAirVariant({
          profileVariant: profile.dashboardAirVariant,
          queryVariant:
            typeof window !== 'undefined'
              ? new URLSearchParams(window.location.search).get('air')
              : null,
          envVariant: process.env.NEXT_PUBLIC_DASHBOARD_AIR_VARIANT,
        });
        return current === next ? current : next;
      });
    }, [profile.dashboardAirVariant]);

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

    const rootClass = cn(
      'relative mx-auto min-h-full max-w-md lumia-tg-hub-pad lumia-pad-bottom-tg-scroll text-text-main'
    );

    const tabShellClass = cn(
      'relative mb-4 flex w-full items-stretch rounded-full p-1 sm:mb-5',
      isCloud && 'border border-black/[0.06] bg-white/56 shadow-[0_8px_20px_rgba(0,0,0,0.05)]',
      isAero &&
        'border border-black/[0.08] bg-gradient-to-r from-white/75 via-white/55 to-white/78 shadow-[0_10px_22px_rgba(0,0,0,0.07)]',
      isOrbit && 'border border-black/[0.06] bg-white/60 shadow-[0_8px_20px_rgba(0,0,0,0.06)]',
      isFeather && 'border border-black/[0.04] bg-white/72 shadow-[0_6px_16px_rgba(0,0,0,0.04)]',
      isPulse &&
        'border border-black/[0.1] bg-gradient-to-r from-white/88 via-white/64 to-white/86 shadow-[0_10px_24px_rgba(0,0,0,0.09)]'
    );

    const tabButtonClass = cn(
      'relative z-0 flex min-h-[44px] flex-1 items-center justify-center px-1 py-1',
      isAero && 'min-h-[46px]'
    );

    const tabIndicatorClass = cn(
      'absolute inset-y-0.5 left-0.5 right-0.5 rounded-full',
      isCloud && 'bg-white',
      isAero && 'bg-white/95 shadow-[0_6px_14px_rgba(0,0,0,0.09)]',
      isOrbit && 'bg-white shadow-[0_7px_16px_rgba(0,0,0,0.08)]',
      isFeather && 'bg-white/95',
      isPulse && 'bg-gradient-to-r from-white via-[#fff9ee] to-white shadow-[0_8px_16px_rgba(212,175,55,0.28)]'
    );

    const cardClass = cn(
      'rounded-[30px] p-5 sm:p-6',
      isCloud &&
        'lumia-glass border border-black/[0.06] bg-white/78 shadow-[0_20px_40px_rgba(0,0,0,0.06)]',
      isAero &&
        'lumia-glass bg-gradient-to-b from-white/92 via-white/80 to-white/62 shadow-[0_14px_30px_rgba(0,0,0,0.08)]',
      isOrbit &&
        'lumia-glass ring-1 ring-black/[0.04] bg-gradient-to-b from-white/88 to-white/66 shadow-[0_16px_32px_rgba(0,0,0,0.07)]',
      isFeather &&
        'border border-black/[0.045] bg-gradient-to-b from-white/90 to-white/64 backdrop-blur-[14px] shadow-[0_10px_24px_rgba(0,0,0,0.05)]',
      isPulse &&
        'lumia-glass bg-gradient-to-b from-white/94 to-white/72 shadow-[0_18px_34px_rgba(0,0,0,0.07)]'
    );

    const secondaryCardClass = cn(
      'rounded-[28px] p-5 sm:p-6',
      isCloud && 'border border-black/[0.055] bg-white/74 shadow-[0_14px_30px_rgba(0,0,0,0.05)] backdrop-blur-xl',
      isAero && 'border border-black/[0.07] bg-white/76 shadow-[0_10px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl',
      isOrbit && 'border border-black/[0.06] bg-white/78 shadow-[0_12px_26px_rgba(0,0,0,0.06)] backdrop-blur-xl',
      isFeather && 'border border-black/[0.04] bg-gradient-to-b from-white/88 to-white/66 shadow-[0_8px_20px_rgba(0,0,0,0.04)]',
      isPulse && 'border border-black/[0.08] bg-gradient-to-b from-white/92 to-white/72 shadow-[0_12px_26px_rgba(0,0,0,0.07)] backdrop-blur-xl'
    );

    const motionTransition = isPulse
      ? { type: 'spring' as const, stiffness: 500, damping: 32 }
      : { type: 'spring' as const, stiffness: 420, damping: 34 };

    const panelTransition = isPulse ? { duration: 0.24 } : { duration: 0.2 };

    if (!chartData) {
      return (
        <div className={rootClass} data-air-variant={airVariant}>
          <LumiaStudioHeader
            variant={airVariant}
            onOpenSettings={onOpenSettings}
            settingsAriaLabel={getText(language, 'nav.settings')}
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
        </div>
      );
    }

    const tabs: { id: StudioTab; label: string }[] = [
      { id: 'natal', label: getText(language, 'dashboard.studio_tab_natal') },
      { id: 'compatibility', label: getText(language, 'dashboard.studio_tab_union') },
      { id: 'horoscope', label: getText(language, 'dashboard.studio_tab_horoscope') },
    ];

    return (
      <div className={rootClass} data-air-variant={airVariant}>
        <LumiaStudioHeader
          variant={airVariant}
          onOpenSettings={onOpenSettings}
          settingsAriaLabel={getText(language, 'nav.settings')}
        />

        <LayoutGroup id="studioTabs">
          <div className={tabShellClass}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={tabButtonClass}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="studioTabIndicator"
                    className={tabIndicatorClass}
                    transition={motionTransition}
                  />
                )}
                <span
                  className={cn(
                    'relative z-10 whitespace-nowrap text-center text-[10px] font-semibold leading-tight tracking-[0.02em] sm:text-[11px]',
                    activeTab === tab.id ? 'text-text-main' : 'text-text-muted'
                  )}
                >
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </LayoutGroup>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={panelTransition}
            className={cn('space-y-4 sm:space-y-5', isAero && 'space-y-5 sm:space-y-6', isPulse && 'lumia-pulse-enter')}
          >
            {activeTab === 'natal' && (
              <>
                <section className={cn(cardClass, 'space-y-5', isAero && 'space-y-6')}>
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted/70">
                    {getText(language, 'dashboard.natal_label')}
                  </p>

                  <div className={cn('grid grid-cols-3 gap-2 text-center', isOrbit && 'gap-3')}>
                    {signRows.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          isOrbit &&
                            'rounded-full border border-black/[0.07] bg-white/74 px-2.5 py-3 shadow-[0_8px_16px_rgba(0,0,0,0.06)]'
                        )}
                      >
                        <p className="text-[10px] uppercase text-text-muted/60">{item.symbol}</p>
                        <p className="serif mt-1 text-lg font-medium text-text-main">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {isOrbit && <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-black/[0.12] to-transparent" />}

                  <p className="px-1 text-center text-sm leading-relaxed text-text-muted">
                    {getText(language, 'dashboard.natal_body')}
                  </p>

                  <ul className="space-y-2 px-1">
                    {natalHighlights.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm text-text-main/90">
                        <span
                          className={cn(
                            'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                            isPulse ? 'bg-accent-gold' : 'bg-accent-gold/70'
                          )}
                        />
                        {point}
                      </li>
                    ))}
                  </ul>

                  <LumiaButton
                    className={cn('min-h-[46px] w-full', isPulse && 'shadow-[0_10px_20px_rgba(212,175,55,0.22)]')}
                    variant={isPulse ? 'secondary' : 'primary'}
                    onClick={handleNavigateChart}
                  >
                    {getText(language, 'dashboard.natal_cta')}
                  </LumiaButton>
                </section>

                <section className={cn(secondaryCardClass, 'space-y-3')}>
                  <p className="text-[10px] uppercase tracking-wider text-text-muted">
                    {getText(language, 'dashboard.questions_label')}
                  </p>
                  <p className="text-sm leading-relaxed text-text-main/90">{questionsSupport}</p>
                  <LumiaButton
                    className="min-h-[46px] w-full"
                    variant={isPulse ? 'outline' : 'primary'}
                    onClick={handleNavigateOracle}
                  >
                    {getText(language, 'dashboard.questions_cta')}
                  </LumiaButton>
                </section>
              </>
            )}

            {activeTab === 'compatibility' && (
              <section className={cn(cardClass, 'space-y-5 text-center', isAero && 'space-y-6')}>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-gold">
                  {getText(language, 'dashboard.synastry_label')}
                </p>
                <h3 className="serif text-2xl text-text-main">{getText(language, 'dashboard.menu_synastry')}</h3>
                <p className="text-left text-sm leading-relaxed text-text-muted">
                  {getText(language, 'dashboard.synastry_body')}
                </p>
                <p className="text-xs italic text-text-muted/80">{getText(language, 'dashboard.synastry_hint')}</p>
                <LumiaButton
                  className={cn('min-h-[46px] w-full', isPulse && 'shadow-[0_10px_20px_rgba(212,175,55,0.2)]')}
                  variant={isPulse ? 'secondary' : 'primary'}
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
                  variant={isPulse ? 'secondary' : 'outline'}
                  className={cn('min-h-[46px] w-full', isPulse && 'shadow-[0_10px_20px_rgba(212,175,55,0.2)]')}
                  onClick={handleNavigateHoroscope}
                >
                  {getText(language, 'dashboard.hero_cta')}
                </LumiaButton>
              </section>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }
);

Dashboard.displayName = 'Dashboard';
