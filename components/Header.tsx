import React from 'react';
import { Settings } from 'lucide-react';
import { UserProfile, ViewState } from '../types';
import { getText } from '../constants';

interface HeaderProps {
  profile: UserProfile | null;
  view: ViewState;
  onOpenSettings: () => void;
  onBack: () => void;
  onOpenWallet: () => void;
}

const SCREEN_TITLES: Partial<Record<ViewState, { ru: string; en: string }>> = {
  chart: { ru: 'Натальная карта', en: 'Natal Chart' },
  charts: { ru: 'Мои карты', en: 'My Charts' },
  horoscope: { ru: 'Гороскоп', en: 'Horoscope' },
  oracle: { ru: 'Спросить Lumia', en: 'Ask Lumia' },
  synastry: { ru: 'Совместимость', en: 'Synastry' },
  wallet: { ru: 'Кошелёк Lumi', en: 'Lumi Wallet' },
  settings: { ru: 'Настройки', en: 'Settings' },
  admin: { ru: 'Админ-панель', en: 'Admin Panel' },
  dashboard: { ru: 'Lumia', en: 'Lumia' },
};

function getScreenTitle(profile: UserProfile, view: ViewState) {
  return SCREEN_TITLES[view]?.[profile.language] || 'Lumia';
}

function StudioChromeHeader({
  profile,
  view,
  onBack,
  onOpenSettings,
  onOpenWallet,
}: {
  profile: UserProfile;
  view: ViewState;
  onBack: () => void;
  onOpenSettings: () => void;
  onOpenWallet: () => void;
}) {
  const lumiValue = Math.max(0, profile.lumiBalance ?? 0);
  const tagline = profile.language === 'en' ? 'Your path to self' : 'Твой путь к себе';
  const storeLabel = profile.language === 'en' ? 'Store' : 'Магазин';

  return (
    <header className="lumia-tg-header-bar relative z-40 shrink-0 border-b border-black/[0.06] bg-white">
      <div className="pt-1 pb-2.5">
        <div className="grid grid-cols-[minmax(2.75rem,auto)_minmax(0,1fr)_auto] items-start gap-2">
          <div className="flex min-w-0 items-start justify-start">
            <button
              onClick={onBack}
              type="button"
              className="flex min-h-[44px] min-w-[44px] items-center gap-1 pr-1 text-astro-subtext transition-colors hover:text-astro-text active:opacity-70"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              <span className="max-[360px]:hidden text-xs font-medium tracking-wide">
                {getText(profile.language, 'header.back')}
              </span>
            </button>
          </div>

          <div className="min-w-0 px-1 text-center">
            <div className="inline-flex flex-col items-center">
              <p className="font-serif text-[2.5rem] font-semibold leading-none tracking-[-0.06em] text-[#1f1f1f]">
                LUMIA
              </p>
              <p className="mt-1.5 text-[8px] uppercase tracking-[0.3em] text-[#8a857d]">
                {tagline}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-start justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onOpenWallet}
              aria-label={storeLabel}
              className="relative inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-2 rounded-full border border-black/[0.08] bg-[#f7f3ea] px-3.5 py-2 text-text-main shadow-[0_4px_10px_rgba(0,0,0,0.03)] transition-colors hover:text-astro-text"
            >
              <span className="text-[12px] font-medium leading-none">{storeLabel}</span>
              <span className="rounded-full border border-black/[0.06] bg-white px-2 py-[3px] text-[10px] font-semibold leading-none text-text-main">
                {lumiValue}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={getText(profile.language, 'nav.settings')}
              className="mt-[1.55rem] inline-flex h-8 w-8 min-h-[32px] min-w-[32px] items-center justify-center rounded-full border border-black/[0.08] bg-white text-text-main shadow-[0_3px_10px_rgba(0,0,0,0.02)] transition-colors hover:text-astro-text"
            >
              <Settings className="h-[12px] w-[12px]" strokeWidth={1.7} aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-3 border-t border-black/[0.06] pt-3 text-center">
          <p className="text-[13px] font-medium tracking-[0.01em] text-text-main">
            {getScreenTitle(profile, view)}
          </p>
        </div>
      </div>
    </header>
  );
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  view,
  onOpenSettings,
  onBack,
  onOpenWallet,
}) => {
  if (!profile) return null;

  const isHub = view === 'dashboard';
  const isFunnel = view === 'onboarding' || view === 'hook' || view === 'paywall';

  if (isFunnel || isHub) return null;

  return (
    <StudioChromeHeader
      profile={profile}
      view={view}
      onBack={onBack}
      onOpenSettings={onOpenSettings}
      onOpenWallet={onOpenWallet}
    />
  );
};
