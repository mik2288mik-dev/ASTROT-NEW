import React, { memo, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles, Target } from 'lucide-react';
import type {
  HoroscopeLayer,
  NatalChartData,
  NatalChartMode,
  TodayOverview,
  UserProfile,
  ViewState,
} from '../types';
import { getText } from '../constants';
import { LumiaStudioHeader } from '../components/lumia-ui/LumiaStudioHeader';
import { cn } from '../lib/cn';
import { getMoscowTodayKey } from '../lib/date-utils';
import { getTodayOverview } from '../services/astrologyService';

type DashboardView = Extract<ViewState, 'chart' | 'horoscope' | 'synastry'>;

interface DashboardProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  chartId?: number | null;
  onNavigate: (view: DashboardView) => void;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer) => void;
  onOpenNatalMode: (mode: NatalChartMode) => void;
  onOpenSettings: () => void;
  onOpenWallet: () => void;
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

function InsightLine({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-3.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.04] text-[#302d33]">
        {icon || <Sparkles size={15} strokeWidth={1.8} />}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-[#918b95]">{label}</p>
        <p className="mt-1 text-[14px] leading-relaxed tracking-normal text-[#323036]">{value}</p>
      </div>
    </div>
  );
}

function TodaySkeleton({ language }: { language: 'ru' | 'en' }) {
  return (
    <section className="pt-2" aria-busy="true">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9A7A43]">
            {language === 'en' ? 'Today' : 'Сегодня'}
          </p>
          <div className="mt-3 h-8 w-4/5 animate-pulse rounded-full bg-black/10" />
          <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-black/8" />
          <div className="mt-2 h-3 w-3/4 animate-pulse rounded-full bg-black/8" />
        </div>
        <div className="h-7 w-20 shrink-0 animate-pulse rounded-full bg-black/8" />
      </div>
    </section>
  );
}

function TodaySection({
  overview,
  language,
}: {
  overview: TodayOverview;
  language: 'ru' | 'en';
}) {
  return (
    <section className="pt-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9A7A43]">
            {language === 'en' ? 'Today' : 'Сегодня'}
          </p>
          <h1 className="mt-2 max-w-[21rem] text-[32px] font-semibold leading-[1.02] tracking-normal text-[#202024]">
            {overview.headline}
          </h1>
        </div>
        <div className="shrink-0 rounded-full border border-black/[0.06] bg-white/78 px-3 py-1 text-[11px] font-semibold tracking-normal text-[#4f4b52]">
          {overview.dateLabel}
        </div>
      </div>

      <p className="mt-3 max-w-[22rem] text-[15px] leading-relaxed tracking-normal text-[#5f5964]">
        {overview.summary}
      </p>

      <div className="mt-5 divide-y divide-black/[0.07] rounded-[22px] border border-black/[0.06] bg-white/76 px-4 shadow-[0_18px_44px_rgba(0,0,0,0.05)]">
        <InsightLine
          label={language === 'en' ? 'Best step' : 'Лучший шаг'}
          value={overview.bestAction}
          icon={<Target size={15} strokeWidth={1.8} />}
        />
        <InsightLine
          label={language === 'en' ? 'Soft risk' : 'Мягкий риск'}
          value={overview.softRisk}
        />
      </div>
    </section>
  );
}

function GatewayCard({
  title,
  subtitle,
  cta,
  image,
  onClick,
}: {
  title: string;
  subtitle: string;
  cta: string;
  image: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-[170px] w-full overflow-hidden rounded-[22px] text-left shadow-[0_18px_40px_rgba(0,0,0,0.11)] active:scale-[0.99]"
    >
      <img
        src={image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-active:scale-[1.03]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(10,10,12,0.82)_0%,rgba(10,10,12,0.50)_52%,rgba(10,10,12,0.12)_100%)]" />
      <div className="relative flex h-full max-w-[76%] flex-col justify-end p-4 text-white">
        <h2 className="mb-0 text-[25px] font-semibold leading-tight tracking-normal">{title}</h2>
        <p className="mt-1.5 text-[13px] leading-snug tracking-normal text-white/82">{subtitle}</p>
        <span className="mt-4 inline-flex w-fit items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[12px] font-semibold text-[#202024]">
          {cta}
          <ArrowRight size={14} strokeWidth={2.2} />
        </span>
      </div>
    </button>
  );
}

function GatewaySection({
  language,
  onOpenNatal,
  onOpenHoroscope,
  onOpenSynastry,
}: {
  language: 'ru' | 'en';
  onOpenNatal: () => void;
  onOpenHoroscope: () => void;
  onOpenSynastry: () => void;
}) {
  const cards = language === 'en'
    ? [
        {
          title: 'Personality Map',
          subtitle: 'Character, strengths, patterns, and the natal wheel.',
          cta: 'Open reading',
          image: '/natal-gateway/personality-map-v2.webp',
          onClick: onOpenNatal,
        },
        {
          title: 'Horoscope',
          subtitle: 'Daily focus, zodiac forecast, and personal timing.',
          cta: 'Open forecast',
          image: '/natal-gateway/daily-horoscope-v2.webp',
          onClick: onOpenHoroscope,
        },
        {
          title: 'Union',
          subtitle: 'Attraction, closeness, and tension between two charts.',
          cta: 'Open union',
          image: '/natal-gateway/synastry-union-v2.webp',
          onClick: onOpenSynastry,
        },
      ]
    : [
        {
          title: 'Карта личности',
          subtitle: 'Характер, сильные стороны, сценарии и круг карты.',
          cta: 'Посмотреть разбор',
          image: '/natal-gateway/personality-map-v2.webp',
          onClick: onOpenNatal,
        },
        {
          title: 'Гороскоп',
          subtitle: 'Фокус дня, прогноз по знаку и личный ритм.',
          cta: 'Открыть прогноз',
          image: '/natal-gateway/daily-horoscope-v2.webp',
          onClick: onOpenHoroscope,
        },
        {
          title: 'Союз',
          subtitle: 'Притяжение, близость и напряжение двух карт.',
          cta: 'Посмотреть союз',
          image: '/natal-gateway/synastry-union-v2.webp',
          onClick: onOpenSynastry,
        },
      ];

  return (
    <section className="space-y-3 pt-1">
      <div className="space-y-3">
        {cards.map((card) => (
          <GatewayCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}

export const Dashboard = memo<DashboardProps>(
  ({ profile, chartData, chartId = null, onNavigate, onOpenHoroscopeLayer, onOpenNatalMode, onOpenSettings, onOpenWallet }) => {
    const shouldReduceMotion = useReducedMotion();
    const language = profile.language === 'en' ? 'en' : 'ru';
    const todayKey = useMemo(() => getMoscowTodayKey(), []);
    const [overview, setOverview] = useState<TodayOverview | null>(null);
    const [loadingOverview, setLoadingOverview] = useState(false);
    const overviewRetryRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const rootClass = cn(
      'relative mx-auto flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden bg-[#fbfaf7] text-text-main'
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

    const loadOverview = React.useCallback(() => {
      if (!profile.id || !chartData) return undefined;
      let cancelled = false;
      if (overviewRetryRef.current) {
        clearTimeout(overviewRetryRef.current);
        overviewRetryRef.current = null;
      }
      setLoadingOverview(true);

      getTodayOverview(profile, chartData, chartId, todayKey)
        .then((result) => {
          if (cancelled) return;
          if (result.status === 'generating') {
            const retryAfterMs = Math.max(1200, Math.min(result.retryAfterMs || 2500, 8000));
            overviewRetryRef.current = setTimeout(() => {
              overviewRetryRef.current = null;
              void loadOverview();
            }, retryAfterMs);
            return;
          }

          setOverview(result.overview);
          setLoadingOverview(false);
        })
        .catch((error: any) => {
          if (cancelled) return;
          console.warn('[Dashboard] Today overview is not ready yet', error?.message || error);
          setLoadingOverview(false);
          overviewRetryRef.current = setTimeout(() => {
            overviewRetryRef.current = null;
            void loadOverview();
          }, 6000);
        });

      return () => {
        cancelled = true;
        if (overviewRetryRef.current) {
          clearTimeout(overviewRetryRef.current);
          overviewRetryRef.current = null;
        }
      };
    }, [chartData, chartId, profile, todayKey]);

    useEffect(() => loadOverview(), [loadOverview]);

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
      <div className={rootClass}>
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
            className="bg-white/92"
          />

          <div className="lumia-main-scroll scrollbar-hide">
            <div className="space-y-6 px-4 pb-[calc(7rem+max(env(safe-area-inset-bottom,0px),var(--tg-content-safe-area-inset-bottom,0px)))] pt-3">
              {overview ? (
                <TodaySection overview={overview} language={language} />
              ) : chartData || loadingOverview ? (
                <TodaySkeleton language={language} />
              ) : null}

              <GatewaySection
                language={language}
                onOpenNatal={openNatal}
                onOpenHoroscope={() => openHoroscope('sign')}
                onOpenSynastry={openSynastry}
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }
);

Dashboard.displayName = 'Dashboard';
