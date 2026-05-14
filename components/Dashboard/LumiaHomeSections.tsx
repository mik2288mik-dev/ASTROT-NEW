import React, { useEffect, useId, useState } from 'react';
import {
  ArrowRight,
  HeartHandshake,
  Lock,
  Map,
  Sparkles,
  SunMoon,
} from 'lucide-react';
import {
  LumiaHomeBottomNavItem,
  LumiaHomeLargeCard,
  LumiaHomePrimaryButton,
} from './LumiaHomePrimitives';
import {
  getLumiaHomeCopy,
  LUMIA_HOME_PREVIEW_ITEMS,
  type LumiaHomeLanguage,
} from './lumiaHomeContent';
import type { UserProfile } from '../../types';

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
    <LumiaHomeLargeCard className="lumia-home-hero-card min-h-[20.75rem] bg-[#ffe45c] shadow-[0_18px_44px_rgba(239,35,60,0.16)]">
      <img
        src="/lumia-home/daily-hero-editorial-v1.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover object-[62%_center]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,247,211,0.98)_0%,rgba(255,228,92,0.84)_38%,rgba(255,122,0,0.26)_68%,rgba(255,122,0,0.06)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#ffd400]/78 via-[#ff7a00]/18 to-transparent" />
      <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-white/52 blur-3xl" />

      <div className="relative z-10 flex min-h-[20.75rem] max-w-[92%] flex-col justify-between px-4 py-[1.125rem] sm:px-5">
        <div>
          <p className="mb-0 font-lumiaHome text-[0.72rem] font-extrabold uppercase tracking-[0.07em] text-lumiaHome-purpleDeep/82">
            {copy.heroDate}
          </p>
          <h1 className="lumia-home-display mb-0 mt-4 max-w-[21.5rem] text-[clamp(1.58rem,6.75vw,2.45rem)] uppercase leading-[0.98]">
            {titleLines.map((line) => (
              <span key={line} className="block whitespace-nowrap">
                {line}
              </span>
            ))}
          </h1>
          <p className="lumia-home-body mb-0 mt-3.5 max-w-[17rem] whitespace-pre-line text-[0.86rem] font-semibold leading-[1.45] text-lumiaHome-purpleDeep">
            {copy.heroSummary}
          </p>
        </div>

        <LumiaHomePrimaryButton onClick={onOpen} className="mt-5 w-fit px-4 py-2.5 shadow-[0_12px_30px_rgba(90,47,88,0.22)]">
          {copy.heroCta}
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-lumiaHome-purple">
            <ArrowRight size={18} strokeWidth={2.4} />
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
    <div className="relative mt-3.5 h-[5.55rem] overflow-hidden rounded-[1.05rem]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_49%_26%,rgba(255,214,190,0.32),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.015))]" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 420 140" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id={lineId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#00a7ff" />
            <stop offset="42%" stopColor="#18c964" />
            <stop offset="68%" stopColor="#ffd400" />
            <stop offset="100%" stopColor="#ff7a00" />
          </linearGradient>
          <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffd400" stopOpacity="0.5" />
            <stop offset="55%" stopColor="#ef233c" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#2a1633" stopOpacity="0" />
          </linearGradient>
          <filter id={glowId} x="-20%" y="-80%" width="140%" height="240%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0.56 0 1 0 0 0.42 0 0 1 0 0.52 0 0 0 0.34 0"
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
      <p className="mb-0 font-lumiaHome text-[0.82rem] font-extrabold leading-tight text-white">{title}</p>
      <p className="mb-0 mt-0.5 font-lumiaHome text-[0.72rem] font-semibold leading-tight text-white/72">{body}</p>
    </div>
  );
}

function PulseTakeaway({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[2.85rem] items-center justify-center rounded-[0.8rem] bg-white/[0.075] px-2 text-center ring-1 ring-white/[0.08]">
      <p className="mb-0 font-lumiaHome text-[0.68rem] font-extrabold leading-snug text-white">{children}</p>
    </div>
  );
}

export function LumiaHomePulseCard({ language }: { language: LumiaHomeLanguage }) {
  const copy = getLumiaHomeCopy(language);
  const pulse = copy.pulse;
  const peakText = `${pulse.peak} ${pulse.peakText}`;

  return (
    <LumiaHomeLargeCard className="bg-[linear-gradient(135deg,#18072c_0%,#5010a8_54%,#ef233c_126%)] px-3.5 py-3.5 text-white shadow-[0_18px_44px_rgba(139,28,255,0.24)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_54%_6%,rgba(255,212,0,0.28),transparent_34%),radial-gradient(circle_at_15%_108%,rgba(0,167,255,0.24),transparent_38%)]" />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 className="mb-0 font-lumiaHomeDisplay text-[0.98rem] font-extrabold uppercase leading-none tracking-normal text-white">
            {copy.pulseTitle}
          </h2>
          <Sparkles size={17} className="text-[#ffd400]" strokeWidth={2.1} aria-hidden />
        </div>

        <PulseWave />

        <div className="mt-3 grid grid-cols-3 gap-2 border-b border-white/10 px-1 pb-3">
          <PulseZone title={pulse.morning} body={pulse.morningText} />
          <PulseZone title={pulse.day} body={pulse.dayText} />
          <PulseZone title={pulse.evening} body={pulse.eveningText} />
        </div>

        <div className="mt-2.5 grid grid-cols-3 gap-2">
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
      className="relative inline-flex h-8 w-8 shrink-0 overflow-visible rounded-full border border-white/28 bg-white/10 p-[2px] shadow-[0_7px_16px_rgba(0,0,0,0.16)]"
      aria-label={label}
      title={label}
    >
      <img src={imageSrc} alt="" draggable={false} className="h-full w-full rounded-full object-cover" />
      <span className="absolute inset-[2px] rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(22,7,47,0.18))]" />
      {locked ? (
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-white text-lumiaHome-purpleDeep shadow-[0_6px_14px_rgba(0,0,0,0.16)]">
          <Lock size={9} strokeWidth={2.35} />
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
      className="lumia-home-large-card min-h-[14.6rem] bg-[#fff7d3] p-3.5 text-left shadow-[0_14px_34px_rgba(255,122,0,0.12)] active:scale-[0.99]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_18%,rgba(0,167,255,0.22),transparent_48%),radial-gradient(circle_at_16%_96%,rgba(255,122,0,0.28),transparent_52%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/38 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div>
          <p className="mb-0 font-lumiaHome text-[0.64rem] font-extrabold uppercase tracking-[0.07em] text-lumiaHome-purple">
            {forecast.label}
          </p>
          <h3 className="mb-0 mt-5 whitespace-pre-line font-lumiaHomeDisplay text-[1.27rem] font-extrabold leading-[1.04] tracking-normal text-lumiaHome-purpleDeep">
            {forecast.title}
          </h3>
          <p className="mb-0 mt-3 whitespace-pre-line font-lumiaHome text-[0.82rem] font-semibold leading-[1.42] text-lumiaHome-purpleDeep/76">
            {forecast.body}
          </p>
        </div>

        <span className="mt-5 inline-flex min-h-[2.75rem] w-full items-center justify-between gap-2 rounded-full border border-lumiaHome-purple/24 bg-white/70 px-3.5 font-lumiaHome text-[0.8rem] font-extrabold text-lumiaHome-purple shadow-[0_10px_22px_rgba(90,47,88,0.07)]">
          <span className="min-w-0 leading-tight">{forecast.cta}</span>
          <ArrowRight size={17} strokeWidth={2.35} />
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
      className="lumia-home-large-card min-h-[14.6rem] bg-[linear-gradient(145deg,#8b1cff_0%,#ef233c_58%,#ff7a00_126%)] p-3.5 text-left text-white shadow-[0_16px_38px_rgba(239,35,60,0.22)] active:scale-[0.99]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_9%,rgba(255,212,0,0.34),transparent_42%),radial-gradient(circle_at_8%_95%,rgba(0,167,255,0.24),transparent_42%)]" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#171314]/70 to-transparent" />
      {!isUnlocked ? (
        <span className="absolute right-3.5 top-3.5 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-white/12 text-white ring-1 ring-white/18">
          <Lock size={13} strokeWidth={2.2} />
        </span>
      ) : null}

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div>
          <p className="mb-0 pr-7 font-lumiaHome text-[0.64rem] font-extrabold uppercase tracking-[0.07em] text-white/72">
            {full.label}
          </p>
          <h3 className="mb-0 mt-5 whitespace-pre-line pr-1 font-lumiaHomeDisplay text-[1.16rem] font-extrabold leading-[1.08] tracking-normal text-white">
            {full.title}
          </h3>
        </div>

        <div className="mt-4">
          <div className="mb-3 flex items-center gap-1.5">
            {previewItems.map((item) => (
              <FullReadingPreview key={item.label} {...item} locked={!isUnlocked} />
            ))}
          </div>

          <span className="inline-flex min-h-[2.8rem] w-full items-center justify-between gap-2 rounded-full bg-white px-3.5 font-lumiaHome text-[0.76rem] font-extrabold text-lumiaHome-purple shadow-[0_10px_24px_rgba(0,0,0,0.14)]">
            <span className="min-w-0 leading-tight">{full.cta}</span>
            <ArrowRight className="shrink-0" size={17} strokeWidth={2.35} />
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
    <section className="grid grid-cols-2 gap-3">
      <LumiaHomeForecastCard language={language} onOpen={onOpenForecast} />
      <LumiaHomePremiumTeaseCard language={language} isUnlocked={isPremium} onOpen={onOpenFull} />
    </section>
  );
}

export function LumiaHomeBottomNavigation({
  language,
  profile,
  onOpenNatal,
  onOpenForecast,
  onOpenSynastry,
  onOpenSettings,
}: {
  language: LumiaHomeLanguage;
  profile: UserProfile;
  onOpenNatal: () => void;
  onOpenForecast: () => void;
  onOpenSynastry: () => void;
  onOpenSettings: () => void;
}) {
  const nav = getLumiaHomeCopy(language).nav;
  const copy = getLumiaHomeCopy(language);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const initial = (profile.name || 'L').trim().slice(0, 1).toUpperCase();

  useEffect(() => {
    try {
      const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      setPhotoUrl(typeof tgUser?.photo_url === 'string' ? tgUser.photo_url : null);
    } catch {
      setPhotoUrl(null);
    }
  }, []);

  return (
    <div className="lumia-home-bottom-nav-shell pointer-events-none">
      <nav className="lumia-home-bottom-nav pointer-events-auto px-1.5 py-1" aria-label="Lumia">
        <LumiaHomeBottomNavItem active label={nav.today} icon={<Sparkles size={20} strokeWidth={2.15} />} />
        <LumiaHomeBottomNavItem label={nav.chart} icon={<Map size={20} strokeWidth={2.1} />} onClick={onOpenNatal} />
        <LumiaHomeBottomNavItem label={nav.horoscope} icon={<SunMoon size={20} strokeWidth={2.1} />} onClick={onOpenForecast} />
        <LumiaHomeBottomNavItem
          label={nav.union}
          icon={<HeartHandshake size={21} strokeWidth={2.05} />}
          onClick={onOpenSynastry}
        />
      </nav>
      <button
        type="button"
        className="lumia-home-bottom-avatar-action pointer-events-auto"
        aria-label={copy.settings}
        onClick={onOpenSettings}
      >
        {photoUrl ? <img src={photoUrl} alt="" draggable={false} /> : <span>{initial}</span>}
      </button>
    </div>
  );
}
