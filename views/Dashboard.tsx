import React, { memo, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  Heart,
  Lock,
  MessageCircleHeart,
  Sparkles,
  Target,
} from 'lucide-react';
import type {
  HoroscopeReactionKey,
  HoroscopeLayer,
  NatalChartData,
  NatalChartMode,
  TodayMetric,
  TodayOverview,
  UserProfile,
  ViewState,
} from '../types';
import { getText } from '../constants';
import { LumiaStudioHeader } from '../components/lumia-ui/LumiaStudioHeader';
import { LumiaButton } from '../components/lumia-ui/LumiaButton';
import { cn } from '../lib/cn';
import { getMoscowTodayKey } from '../lib/date-utils';
import { getTodayOverview, setHoroscopeReaction } from '../services/astrologyService';

type DashboardView = Extract<ViewState, 'chart' | 'horoscope' | 'synastry'>;

interface DashboardProps {
  profile: UserProfile;
  chartData: NatalChartData | null;
  onNavigate: (view: DashboardView) => void;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer) => void;
  onOpenNatalMode: (mode: NatalChartMode) => void;
  onOpenSettings: () => void;
  onOpenWallet: () => void;
}

const REACTION_ORDER: HoroscopeReactionKey[] = ['spot_on', 'funny', 'gentle', 'not_mine'];

function haptic(kind: 'select' | 'open' = 'select') {
  try {
    const webApp = (window as any)?.Telegram?.WebApp;
    if (kind === 'open') webApp?.HapticFeedback?.impactOccurred?.('light');
    else webApp?.HapticFeedback?.selectionChanged?.();
  } catch {
    /* Telegram haptics are optional */
  }
}

function MetricSparkline({ metric }: { metric: TodayMetric }) {
  const points = metric.history.length ? metric.history : [{ date: '', value: metric.value }];
  const width = 112;
  const height = 34;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const path = points
    .map((point, index) => {
      const x = index * step;
      const y = height - (Math.max(0, Math.min(100, point.value)) / 100) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[34px] w-full overflow-visible" aria-hidden="true">
      <polyline
        points={path}
        fill="none"
        stroke={metric.key === 'stress' ? '#C66C5F' : metric.key === 'love' ? '#D87993' : '#2D2D2D'}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricTile({ metric }: { metric: TodayMetric }) {
  return (
    <div className="min-h-[126px] rounded-[18px] border border-black/[0.06] bg-white/82 p-3.5 shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold leading-tight tracking-normal text-[#4f4b52]">{metric.label}</p>
          <p className="mt-1 text-[11.5px] leading-snug tracking-normal text-[#77717a]">{metric.description}</p>
        </div>
        <span className="shrink-0 text-[22px] font-semibold leading-none tracking-normal text-[#202024]">
          {metric.value}
        </span>
      </div>
      <div className="mt-3 h-[34px]">
        <MetricSparkline metric={metric} />
      </div>
    </div>
  );
}

function SkeletonMetric() {
  return (
    <div className="min-h-[126px] animate-pulse rounded-[18px] border border-black/[0.06] bg-white/72 p-3.5">
      <div className="h-3 w-20 rounded-full bg-black/10" />
      <div className="mt-3 h-2 w-full rounded-full bg-black/8" />
      <div className="mt-2 h-2 w-3/4 rounded-full bg-black/8" />
      <div className="mt-5 h-8 rounded-[10px] bg-black/8" />
    </div>
  );
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

function ReactionBar({
  overview,
  language,
  busyReaction,
  onReact,
}: {
  overview: TodayOverview;
  language: 'ru' | 'en';
  busyReaction: HoroscopeReactionKey | null;
  onReact: (reaction: HoroscopeReactionKey) => void;
}) {
  const counts = new Map(overview.reactions.counts.map((item) => [item.key, item]));
  const title = language === 'en' ? 'Mark the horoscope' : 'Отметить гороскоп';

  return (
    <div className="mt-4">
      <p className="text-[12px] font-medium tracking-normal text-[#77717a]">{title}</p>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {REACTION_ORDER.map((key) => {
          const item = counts.get(key);
          const active = overview.reactions.userReaction === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onReact(key)}
              disabled={busyReaction === key}
              className={cn(
                'min-h-[36px] shrink-0 rounded-full px-3 text-[12px] font-semibold tracking-normal transition active:scale-[0.98] disabled:opacity-60',
                active
                  ? 'bg-[#202024] text-white shadow-[0_10px_22px_rgba(0,0,0,0.12)]'
                  : 'border border-black/[0.07] bg-white/78 text-[#302d33]'
              )}
            >
              {item?.label || key}
              {item?.count ? <span className="ml-1 opacity-70">{item.count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TodaySection({
  overview,
  loading,
  error,
  language,
  busyReaction,
  onReact,
  onOpenHoroscope,
  onRetry,
}: {
  overview: TodayOverview | null;
  loading: boolean;
  error: string | null;
  language: 'ru' | 'en';
  busyReaction: HoroscopeReactionKey | null;
  onReact: (reaction: HoroscopeReactionKey) => void;
  onOpenHoroscope: () => void;
  onRetry: () => void;
}) {
  const fallbackDate = language === 'en' ? 'Today' : 'Сегодня';
  const title = overview?.headline || (loading
    ? language === 'en' ? 'Gathering your day' : 'Собираю твой день'
    : language === 'en' ? 'Your day did not load yet' : 'Твой день пока не загрузился');
  const summary = overview?.summary || (loading
    ? language === 'en'
      ? 'Lumia is calculating the chart, sky, horoscope, and rhythm metrics.'
      : 'Lumia считает карту, текущее небо, гороскоп и показатели ритма.'
    : language === 'en'
      ? 'Try again or open the horoscope while the day layer refreshes.'
      : 'Попробуй ещё раз или открой гороскоп, пока дневной слой обновляется.');

  return (
    <section className="pt-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9A7A43]">
            {language === 'en' ? 'Your day' : 'Твой день'}
          </p>
          <h1 className="mt-2 max-w-[21rem] text-[32px] font-semibold leading-[1.02] tracking-normal text-[#202024]">
            {title}
          </h1>
        </div>
        <div className="shrink-0 rounded-full border border-black/[0.06] bg-white/78 px-3 py-1 text-[11px] font-semibold tracking-normal text-[#4f4b52]">
          {overview?.dateLabel || fallbackDate}
        </div>
      </div>

      <p className="mt-3 max-w-[22rem] text-[15px] leading-relaxed tracking-normal text-[#5f5964]">{summary}</p>

      {overview?.metrics?.length || loading ? (
        <div className="mt-5 grid grid-cols-2 gap-2.5">
          {overview?.metrics?.length
            ? overview.metrics.map((metric) => <MetricTile key={metric.key} metric={metric} />)
            : Array.from({ length: 4 }, (_, index) => <SkeletonMetric key={index} />)}
        </div>
      ) : null}

      {overview ? (
        <div className="mt-5 divide-y divide-black/[0.07] rounded-[24px] border border-black/[0.06] bg-white/76 px-4 shadow-[0_18px_44px_rgba(0,0,0,0.05)]">
          <InsightLine
            label={language === 'en' ? `${overview.signLabel} horoscope` : `Гороскоп ${overview.signLabel}`}
            value={overview.horoscopeExcerpt}
            icon={<MessageCircleHeart size={15} strokeWidth={1.8} />}
          />
          <InsightLine
            label={language === 'en' ? 'Phrase of the day' : 'Фраза дня'}
            value={overview.phrase}
            icon={<Sparkles size={15} strokeWidth={1.8} />}
          />
          <InsightLine
            label={language === 'en' ? 'Best step' : 'Лучший шаг'}
            value={overview.bestAction}
            icon={<Target size={15} strokeWidth={1.8} />}
          />
          <InsightLine
            label={language === 'en' ? 'Soft risk' : 'Мягкий риск'}
            value={overview.softRisk}
            icon={<Sparkles size={15} strokeWidth={1.8} />}
          />
        </div>
      ) : null}

      {overview ? (
        <>
          <div className="mt-4 space-y-2 rounded-[22px] bg-[#f4efe7] px-4 py-4">
            <p className="text-[14px] leading-relaxed tracking-normal text-[#383239]">{overview.joke}</p>
            <p className="text-[13px] leading-relaxed tracking-normal text-[#6c626b]">{overview.comparison}</p>
          </div>
          <ReactionBar overview={overview} language={language} busyReaction={busyReaction} onReact={onReact} />
        </>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-[18px] border border-[#d9b9b0] bg-[#fff7f4] px-4 py-3 text-[13px] leading-relaxed text-[#8a5147]">
          <p>{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-[36px] items-center rounded-full bg-white px-3 text-[12px] font-semibold text-[#6f4038] shadow-[0_8px_18px_rgba(0,0,0,0.06)] active:scale-[0.98]"
          >
            {language === 'en' ? 'Try again' : 'Повторить'}
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onOpenHoroscope}
        className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#202024] px-4 text-[13px] font-semibold tracking-normal text-white shadow-[0_16px_32px_rgba(0,0,0,0.12)] active:scale-[0.98]"
      >
        {language === 'en' ? 'Open the full day' : 'Открыть весь день'}
        <ArrowRight size={15} strokeWidth={2} />
      </button>

      {loading && overview ? (
        <p className="mt-3 text-[12px] tracking-normal text-[#8f8992]">
          {language === 'en' ? 'Refreshing today’s rhythm...' : 'Обновляю ритм дня...'}
        </p>
      ) : null}
    </section>
  );
}

function PremiumEntryRow({
  language,
  onOpenLayer,
}: {
  language: 'ru' | 'en';
  onOpenLayer: (layer: HoroscopeLayer) => void;
}) {
  const items = language === 'en'
    ? [
        { title: 'Personal day', icon: Lock, layer: 'chart' as const },
        { title: 'Love today', icon: Heart, layer: 'love' as const },
        { title: 'Work and money', icon: BriefcaseBusiness, layer: 'work_money' as const },
      ]
    : [
        { title: 'Личный день', icon: Lock, layer: 'chart' as const },
        { title: 'Любовь сегодня', icon: Heart, layer: 'love' as const },
        { title: 'Работа и деньги', icon: BriefcaseBusiness, layer: 'work_money' as const },
      ];

  return (
    <section className="pt-1">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-semibold leading-tight tracking-normal text-[#202024]">
          {language === 'en' ? 'Open deeper' : 'Открыть глубже'}
        </h2>
        <span className="text-[11px] font-medium tracking-normal text-[#8a838d]">Premium / Lumi</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map(({ title, icon: Icon, layer }) => (
          <button
            key={title}
            type="button"
            onClick={() => onOpenLayer(layer)}
            className="flex min-h-[82px] flex-col justify-between rounded-[18px] border border-black/[0.06] bg-white/78 p-3 text-left shadow-[0_10px_26px_rgba(0,0,0,0.04)] active:scale-[0.985]"
          >
            <Icon size={17} strokeWidth={1.8} className="text-[#38333a]" />
            <span className="text-[12px] font-semibold leading-tight tracking-normal text-[#302d33]">{title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function GatewayCard({
  title,
  subtitle,
  image,
  onClick,
}: {
  title: string;
  subtitle: string;
  image: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative min-h-[132px] overflow-hidden rounded-[22px] text-left shadow-[0_16px_36px_rgba(0,0,0,0.08)] active:scale-[0.99]"
    >
      <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-active:scale-[1.03]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(16,16,18,0.72)_0%,rgba(16,16,18,0.42)_52%,rgba(16,16,18,0.10)_100%)]" />
      <div className="relative flex min-h-[132px] max-w-[72%] flex-col justify-end p-4 text-white">
        <h3 className="text-[20px] font-semibold leading-tight tracking-normal">{title}</h3>
        <p className="mt-1 text-[12.5px] leading-snug tracking-normal text-white/78">{subtitle}</p>
        <span className="mt-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#202024]">
          <ArrowRight size={15} strokeWidth={2.1} />
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
          title: 'Natal chart',
          subtitle: 'Your character, strengths, patterns, and natal wheel.',
          image: '/natal-gateway/personality-map.webp',
          onClick: onOpenNatal,
        },
        {
          title: 'Horoscope',
          subtitle: 'General zodiac forecast and personal daily layers.',
          image: '/natal-gateway/daily-horoscope.webp',
          onClick: onOpenHoroscope,
        },
        {
          title: 'Union',
          subtitle: 'How two charts meet in closeness and tension.',
          image: '/natal-gateway/synastry-union.webp',
          onClick: onOpenSynastry,
        },
      ]
    : [
        {
          title: 'Натальная карта',
          subtitle: 'Характер, сильные стороны, сценарии и натальный круг.',
          image: '/natal-gateway/personality-map.webp',
          onClick: onOpenNatal,
        },
        {
          title: 'Гороскоп',
          subtitle: 'Общий прогноз по знаку и личные слои дня.',
          image: '/natal-gateway/daily-horoscope.webp',
          onClick: onOpenHoroscope,
        },
        {
          title: 'Союз',
          subtitle: 'Как две карты встречаются в близости и напряжении.',
          image: '/natal-gateway/synastry-union.webp',
          onClick: onOpenSynastry,
        },
      ];

  return (
    <section className="space-y-3 pt-1">
      <h2 className="text-[16px] font-semibold leading-tight tracking-normal text-[#202024]">
        {language === 'en' ? 'Where next' : 'Куда дальше'}
      </h2>
      <div className="space-y-3">
        {cards.map((card) => (
          <GatewayCard key={card.title} {...card} />
        ))}
      </div>
    </section>
  );
}

export const Dashboard = memo<DashboardProps>(
  ({ profile, chartData, onNavigate, onOpenHoroscopeLayer, onOpenNatalMode, onOpenSettings, onOpenWallet }) => {
    const shouldReduceMotion = useReducedMotion();
    const language = profile.language === 'en' ? 'en' : 'ru';
    const todayKey = useMemo(() => getMoscowTodayKey(), []);
    const [overview, setOverview] = useState<TodayOverview | null>(null);
    const [loadingOverview, setLoadingOverview] = useState(false);
    const [overviewError, setOverviewError] = useState<string | null>(null);
    const [busyReaction, setBusyReaction] = useState<HoroscopeReactionKey | null>(null);

    const rootStyle = {
      paddingBottom:
        'calc(1rem + max(env(safe-area-inset-bottom, 0px), var(--tg-content-safe-area-inset-bottom, 0px)))',
    } as const;

    const rootClass = cn(
      'relative mx-auto flex h-full min-h-0 w-full max-w-md flex-col overflow-hidden bg-[#fbfaf7] text-text-main'
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

    const loadOverview = React.useCallback(() => {
      if (!profile.id || !chartData) return;
      let cancelled = false;
      setLoadingOverview(true);
      setOverviewError(null);

      getTodayOverview(profile, chartData, undefined, todayKey)
        .then((nextOverview) => {
          if (!cancelled) setOverview(nextOverview);
        })
        .catch((error: any) => {
          if (!cancelled) {
            const status = Number(error?.status || 0);
            const code = String(error?.code || '');
            if (code === 'INVALID_USER_ID' || status === 400) {
              setOverviewError(
                language === 'en'
                  ? 'Open Lumia through Telegram so the app can identify your profile.'
                  : 'Открой Lumia через Telegram, чтобы приложение смогло определить профиль.'
              );
            } else if (code === 'CHART_REQUIRED' || status === 409) {
              setOverviewError(
                language === 'en'
                  ? 'A saved natal chart is required for your day.'
                  : 'Для твоего дня нужна сохранённая натальная карта.'
              );
            } else {
              setOverviewError(
                language === 'en'
                  ? 'Your day did not load. Try again in a moment.'
                  : 'Твой день не загрузился. Попробуй ещё раз через пару секунд.'
              );
            }
          }
        })
        .finally(() => {
          if (!cancelled) setLoadingOverview(false);
        });

      return () => {
        cancelled = true;
      };
    }, [chartData, language, profile, todayKey]);

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

    const handleReaction = async (reaction: HoroscopeReactionKey) => {
      if (!profile.id || !overview || busyReaction) return;
      haptic('select');
      setBusyReaction(reaction);
      try {
        const reactions = await setHoroscopeReaction(profile.id, overview.sign, overview.date, reaction, language);
        setOverview((current) => (current ? { ...current, reactions } : current));
      } catch (error) {
        console.warn('[Dashboard] Failed to set horoscope reaction', error);
      } finally {
        setBusyReaction(null);
      }
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

            <section className={cn(cardClass, 'mx-4 space-y-4 text-center')}>
              <p className="font-medium tracking-normal text-text-main">{getText(language, 'dashboard.chart_load_failed_title')}</p>
              <p className="text-sm leading-relaxed tracking-normal text-text-muted">
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
                  onClick={() => onOpenNatalMode('human')}
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
              <TodaySection
                overview={overview}
                loading={loadingOverview}
                error={overviewError}
                language={language}
                busyReaction={busyReaction}
                onReact={handleReaction}
                onOpenHoroscope={() => openHoroscope('sign')}
                onRetry={() => {
                  void loadOverview();
                }}
              />
              {overview ? <PremiumEntryRow language={language} onOpenLayer={openHoroscope} /> : null}
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
