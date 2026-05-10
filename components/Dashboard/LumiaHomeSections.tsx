import React, { useEffect, useId, useState } from 'react';
import {
  ArrowRight,
  Bell,
  BookOpen,
  HeartHandshake,
  Lock,
  Map,
  Sparkles,
  Star,
} from 'lucide-react';
import type { HoroscopeLayer, UserProfile } from '../../types';
import {
  LumiaHomeBottomNavItem,
  LumiaHomeIconButton,
  LumiaHomeLargeCard,
  LumiaHomePrimaryButton,
  LumiaHomeStoryCircle,
} from './LumiaHomePrimitives';
import {
  getLumiaHomeCopy,
  LUMIA_HOME_PREVIEW_ITEMS,
  type LumiaHomeLanguage,
} from './lumiaHomeContent';

export function LumiaHomeHeader({
  profile,
  language,
  onOpenSettings,
}: {
  profile: UserProfile;
  language: LumiaHomeLanguage;
  onOpenSettings: () => void;
}) {
  const copy = getLumiaHomeCopy(language);
  const initial = (profile.name || 'L').trim().slice(0, 1).toUpperCase();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    try {
      const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      setPhotoUrl(typeof tgUser?.photo_url === 'string' ? tgUser.photo_url : null);
    } catch {
      setPhotoUrl(null);
    }
  }, []);

  return (
    <header className="px-[var(--lumia-home-page-x)] pb-4 pt-[calc(max(env(safe-area-inset-top,0px),var(--tg-content-safe-area-inset-top,0px))+0.9rem)]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <p className="mb-0 font-lumiaHomeDisplay text-[clamp(3.25rem,15.8vw,5.15rem)] font-extrabold leading-[0.8] tracking-normal text-lumiaHome-purpleDeep">
            LUMIA
          </p>
          <p className="mb-0 mt-3 font-lumiaHome text-[0.72rem] font-bold uppercase leading-none tracking-[0.27em] text-lumiaHome-muted">
            {copy.tagline}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3 pt-1.5">
          <LumiaHomeIconButton aria-label={copy.notifications} onClick={onOpenSettings}>
            <Bell size={23} strokeWidth={2.05} />
            <span className="lumia-home-notification-dot" aria-hidden />
          </LumiaHomeIconButton>
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label={copy.settings}
            className="lumia-home-avatar-button active:scale-[0.98]"
          >
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" draggable={false} />
            ) : (
              initial
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

export function LumiaHomeStoriesRow({
  profile,
  language,
  onOpenHoroscope,
}: {
  profile: UserProfile;
  language: LumiaHomeLanguage;
  onOpenHoroscope: (layer: HoroscopeLayer) => void;
}) {
  const copy = getLumiaHomeCopy(language).stories;
  const locked = !profile.isPremium;
  const stories = [
    {
      id: 'today',
      label: copy.today,
      imageSrc: '/natal-gateway/daily-horoscope-v2.webp',
      active: true,
      locked: false,
      onClick: () => onOpenHoroscope('sign'),
    },
    {
      id: 'love',
      label: copy.love,
      imageSrc: '/natal-gateway/synastry-union-v2.webp',
      active: false,
      locked,
      onClick: () => onOpenHoroscope('love'),
    },
    {
      id: 'money',
      label: copy.money,
      imageSrc: '/natal-backgrounds/work-money.webp',
      active: false,
      locked,
      onClick: () => onOpenHoroscope('work_money'),
    },
    {
      id: 'work',
      label: copy.work,
      imageSrc: '/natal-gateway/personality-map-v2.webp',
      active: false,
      locked,
      onClick: () => onOpenHoroscope('work_money'),
    },
    {
      id: 'rhythm',
      label: copy.rhythm,
      imageSrc: '/natal-backgrounds/daily.webp',
      active: false,
      locked,
      onClick: () => onOpenHoroscope('chart'),
    },
  ];

  return (
    <section className="overflow-hidden pb-2">
      <div className="scrollbar-hide flex gap-3 overflow-x-auto px-[var(--lumia-home-page-x)] pb-3 pt-1.5">
        {stories.map((story) => (
          <LumiaHomeStoryCircle key={story.id} {...story} />
        ))}
      </div>
    </section>
  );
}

export function LumiaHomeHeroCard({
  language,
  onOpen,
}: {
  language: LumiaHomeLanguage;
  onOpen: () => void;
}) {
  const copy = getLumiaHomeCopy(language);
  const titleLines = copy.heroTitle.split('\n');

  return (
    <LumiaHomeLargeCard className="lumia-home-hero-card min-h-[29.5rem] bg-lumiaHome-peach">
      <img
        src="/lumia-home/daily-hero-editorial-v1.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover object-[58%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,244,235,0.98)_0%,rgba(255,239,230,0.91)_38%,rgba(255,235,224,0.46)_63%,rgba(255,235,224,0.06)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#fff0e7]/90 via-[#fff0e7]/28 to-transparent" />
      <div className="absolute -left-16 top-12 h-64 w-64 rounded-full bg-white/52 blur-3xl" />

      <div className="relative z-10 flex min-h-[29.5rem] max-w-[78%] flex-col justify-between px-5 py-6 sm:px-6">
        <div>
          <p className="mb-0 font-lumiaHome text-[0.86rem] font-extrabold uppercase tracking-[0.08em] text-lumiaHome-purpleDeep/82">
            {copy.heroDate}
          </p>
          <h1 className="lumia-home-display mb-0 mt-7 max-w-[20rem] text-[clamp(3.28rem,13.9vw,4.75rem)] uppercase leading-[0.92]">
            {titleLines.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <p className="lumia-home-body mb-0 mt-6 max-w-[19rem] whitespace-pre-line text-[1.08rem] font-semibold leading-[1.55] text-lumiaHome-purpleDeep">
            {copy.heroSummary}
          </p>
        </div>

        <LumiaHomePrimaryButton onClick={onOpen} className="mt-8 w-fit px-5 py-4 shadow-[0_18px_42px_rgba(100,43,216,0.28)]">
          {copy.heroCta}
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-lumiaHome-purple">
            <ArrowRight size={21} strokeWidth={2.4} />
          </span>
        </LumiaHomePrimaryButton>
      </div>
    </LumiaHomeLargeCard>
  );
}

function PulseWave() {
  const safeId = useId().replace(/:/g, '');
  const lineId = `pulseLine-${safeId}`;
  const fillId = `pulseFill-${safeId}`;
  const glowId = `pulseGlow-${safeId}`;

  return (
    <div className="relative mt-5 h-[8.6rem] overflow-hidden rounded-[1.35rem]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_49%_26%,rgba(255,214,190,0.32),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 140" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={lineId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#6f4df5" />
            <stop offset="42%" stopColor="#f064c4" />
            <stop offset="68%" stopColor="#ffb17d" />
            <stop offset="100%" stopColor="#7c4df0" />
          </linearGradient>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffb17d" stopOpacity="0.42" />
            <stop offset="55%" stopColor="#8a4df0" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#16072f" stopOpacity="0" />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-80%" width="140%" height="240%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0.72 0 1 0 0 0.35 0 0 1 0 1 0 0 0 0.55 0"
              result="glow"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M0 98 C42 74 72 82 104 86 C150 92 172 28 218 24 C270 20 286 80 332 84 C370 88 386 66 420 76 L420 140 L0 140 Z"
          fill={`url(#${fillId})`}
        />
        <path
          d="M0 98 C42 74 72 82 104 86 C150 92 172 28 218 24 C270 20 286 80 332 84 C370 88 386 66 420 76"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M0 98 C42 74 72 82 104 86 C150 92 172 28 218 24 C270 20 286 80 332 84 C370 88 386 66 420 76"
          fill="none"
          stroke={`url(#${lineId})`}
          strokeWidth="5"
          strokeLinecap="round"
          filter={`url(#${glowId})`}
        />
        <circle cx="218" cy="24" r="8" fill="#ffffff" />
        <circle cx="218" cy="24" r="15" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2" />
      </svg>
    </div>
  );
}

function PulseZone({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-w-0 text-center">
      <p className="mb-0 font-lumiaHome text-[1rem] font-extrabold leading-tight text-white">{title}</p>
      <p className="mb-0 mt-1 font-lumiaHome text-[0.9rem] font-semibold leading-tight text-white/72">{body}</p>
    </div>
  );
}

function PulseTakeaway({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[4.4rem] items-center justify-center rounded-[1.05rem] bg-white/[0.065] px-2.5 text-center ring-1 ring-white/[0.075]">
      <p className="mb-0 font-lumiaHome text-[0.87rem] font-extrabold leading-snug text-white">{children}</p>
    </div>
  );
}

export function LumiaHomePulseCard({ language }: { language: LumiaHomeLanguage }) {
  const copy = getLumiaHomeCopy(language);
  const pulse = copy.pulse;
  const peakText = `${pulse.peak} ${pulse.peakText}`;

  return (
    <LumiaHomeLargeCard className="bg-lumiaHome-purpleDeep px-4 py-5 text-white shadow-[0_24px_64px_rgba(22,7,47,0.26)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_54%_6%,rgba(255,226,214,0.18),transparent_34%),radial-gradient(circle_at_15%_108%,rgba(100,43,216,0.35),transparent_38%)]" />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="mb-0 font-lumiaHomeDisplay text-[1.42rem] font-extrabold uppercase leading-none tracking-normal text-white">
            {copy.pulseTitle}
          </h2>
          <Sparkles size={19} className="text-[#f7b7ff]" strokeWidth={2.1} aria-hidden />
        </div>

        <PulseWave />

        <div className="mt-4 grid grid-cols-3 gap-2 border-b border-white/10 px-1 pb-5">
          <PulseZone title={pulse.morning} body={pulse.morningText} />
          <PulseZone title={pulse.day} body={pulse.dayText} />
          <PulseZone title={pulse.evening} body={pulse.eveningText} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <PulseTakeaway>{pulse.moon}</PulseTakeaway>
          <PulseTakeaway>{peakText}</PulseTakeaway>
          <PulseTakeaway>{pulse.avoid}</PulseTakeaway>
        </div>
      </div>
    </LumiaHomeLargeCard>
  );
}

function FullReadingPreview({
  label,
  imageSrc,
  locked,
}: {
  label: string;
  imageSrc: string;
  locked: boolean;
}) {
  return (
    <span
      className="relative inline-flex h-10 w-10 shrink-0 overflow-visible rounded-full border border-white/28 bg-white/10 p-[2px] shadow-[0_9px_20px_rgba(0,0,0,0.18)]"
      aria-label={label}
      title={label}
    >
      <img src={imageSrc} alt="" draggable={false} className="h-full w-full rounded-full object-cover" />
      <span className="absolute inset-[2px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(22,7,47,0.18))]" />
      {locked ? (
        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-white bg-white text-lumiaHome-purpleDeep shadow-[0_8px_18px_rgba(0,0,0,0.18)]">
          <Lock size={11} strokeWidth={2.35} />
        </span>
      ) : null}
    </span>
  );
}

export function LumiaHomeForecastCard({
  language,
  onOpen,
}: {
  language: LumiaHomeLanguage;
  onOpen: () => void;
}) {
  const forecast = getLumiaHomeCopy(language).forecast;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="lumia-home-large-card min-h-[18rem] bg-[#fff6f1] p-4 text-left shadow-[0_18px_42px_rgba(42,16,88,0.09)] active:scale-[0.99]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(238,230,255,0.94),transparent_48%),radial-gradient(circle_at_16%_96%,rgba(255,226,214,0.9),transparent_52%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/38 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div>
          <p className="mb-0 font-lumiaHome text-[0.76rem] font-extrabold uppercase tracking-[0.075em] text-lumiaHome-purple">
            {forecast.label}
          </p>
          <h3 className="mb-0 mt-7 whitespace-pre-line font-lumiaHomeDisplay text-[1.68rem] font-extrabold leading-[1.02] tracking-normal text-lumiaHome-purpleDeep">
            {forecast.title}
          </h3>
          <p className="mb-0 mt-4 whitespace-pre-line font-lumiaHome text-[0.96rem] font-semibold leading-[1.46] text-lumiaHome-purpleDeep/76">
            {forecast.body}
          </p>
        </div>

        <span className="mt-6 inline-flex min-h-[3.25rem] w-full items-center justify-between gap-3 rounded-full border border-lumiaHome-purple/28 bg-white/66 px-4 font-lumiaHome text-[0.94rem] font-extrabold text-lumiaHome-purple shadow-[0_12px_28px_rgba(100,43,216,0.08)]">
          <span className="min-w-0 leading-tight">{forecast.cta}</span>
          <ArrowRight size={20} strokeWidth={2.35} />
        </span>
      </div>
    </button>
  );
}

export function LumiaHomePremiumTeaseCard({
  language,
  isUnlocked,
  onOpen,
}: {
  language: LumiaHomeLanguage;
  isUnlocked: boolean;
  onOpen: () => void;
}) {
  const full = getLumiaHomeCopy(language).full;
  const previewItems = LUMIA_HOME_PREVIEW_ITEMS[language];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="lumia-home-large-card min-h-[18rem] bg-lumiaHome-plum p-4 text-left text-white shadow-[0_22px_52px_rgba(42,16,88,0.2)] active:scale-[0.99]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_9%,rgba(215,196,255,0.34),transparent_42%),radial-gradient(circle_at_8%_95%,rgba(244,184,199,0.28),transparent_42%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#211137]/82 to-transparent" />
      {!isUnlocked ? (
        <span className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/18">
          <Lock size={16} strokeWidth={2.2} />
        </span>
      ) : null}

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div>
          <p className="mb-0 pr-8 font-lumiaHome text-[0.76rem] font-extrabold uppercase tracking-[0.075em] text-white/72">
            {full.label}
          </p>
          <h3 className="mb-0 mt-7 whitespace-pre-line pr-1 font-lumiaHomeDisplay text-[1.54rem] font-extrabold leading-[1.04] tracking-normal text-white">
            {full.title}
          </h3>
        </div>

        <div className="mt-5">
          <div className="mb-4 flex items-center gap-2">
            {previewItems.map((item) => (
              <FullReadingPreview key={item.label} {...item} locked={!isUnlocked} />
            ))}
          </div>

          <span className="inline-flex min-h-[3.55rem] w-full items-center justify-between gap-2 rounded-full bg-white px-4 font-lumiaHome text-[0.86rem] font-extrabold text-lumiaHome-purple shadow-[0_14px_30px_rgba(0,0,0,0.16)]">
            <span className="min-w-0 leading-tight">{full.cta}</span>
            <ArrowRight className="shrink-0" size={20} strokeWidth={2.35} />
          </span>
        </div>
      </div>
    </button>
  );
}

export function LumiaHomeContentCards({
  language,
  isPremium,
  onOpenForecast,
  onOpenFull,
}: {
  language: LumiaHomeLanguage;
  isPremium: boolean;
  onOpenForecast: () => void;
  onOpenFull: () => void;
}) {
  return (
    <section className="grid grid-cols-2 gap-3.5">
      <LumiaHomeForecastCard language={language} onOpen={onOpenForecast} />
      <LumiaHomePremiumTeaseCard language={language} isUnlocked={isPremium} onOpen={onOpenFull} />
    </section>
  );
}

export function LumiaHomeBottomNavigation({
  language,
  onOpenNatal,
  onOpenForecast,
  onOpenSynastry,
  onOpenDiary,
}: {
  language: LumiaHomeLanguage;
  onOpenNatal: () => void;
  onOpenForecast: () => void;
  onOpenSynastry: () => void;
  onOpenDiary: () => void;
}) {
  const nav = getLumiaHomeCopy(language).nav;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-4 pb-[calc(0.65rem+max(env(safe-area-inset-bottom,0px),var(--tg-content-safe-area-inset-bottom,0px)))]">
      <nav className="lumia-home-bottom-nav pointer-events-auto px-2 py-1.5" aria-label="Lumia">
        <LumiaHomeBottomNavItem active label={nav.today} icon={<Sparkles size={23} strokeWidth={2.15} />} />
        <LumiaHomeBottomNavItem label={nav.chart} icon={<Map size={23} strokeWidth={2.1} />} onClick={onOpenNatal} />
        <LumiaHomeBottomNavItem
          center
          label={nav.lumia}
          icon={<Star size={30} fill="currentColor" strokeWidth={1.65} />}
          onClick={onOpenForecast}
        />
        <LumiaHomeBottomNavItem
          label={nav.union}
          icon={<HeartHandshake size={24} strokeWidth={2.05} />}
          onClick={onOpenSynastry}
        />
        <LumiaHomeBottomNavItem label={nav.diary} icon={<BookOpen size={23} strokeWidth={2.05} />} onClick={onOpenDiary} />
      </nav>
    </div>
  );
}
