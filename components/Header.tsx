import React from 'react';
import { Settings, ShoppingBag } from 'lucide-react';
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
  wallet: { ru: 'Магазин', en: 'Store' },
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
  onOpenSettings,
  onOpenWallet,
}: {
  profile: UserProfile;
  view: ViewState;
  onOpenSettings: () => void;
  onOpenWallet: () => void;
}) {
  const tagline = profile.language === 'en' ? 'YOUR PATH TO SELF' : 'ТВОЙ ПУТЬ К СЕБЕ';
  const storeLabel = profile.language === 'en' ? 'Store' : 'Магазин';
  const iconButtonClass =
    'inline-flex h-8 w-8 min-h-[32px] min-w-[32px] shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-white text-text-main shadow-[0_3px_10px_rgba(0,0,0,0.02)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/14 hover:text-astro-text';

  return (
    <header className="lumia-tg-header-bar relative z-40 shrink-0 border-b border-black/[0.06] bg-white">
      <div className="pt-1 pb-2.5">
        <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-start gap-2">
          <div aria-hidden className="h-11 w-11" />

          <div className="min-w-0 text-center">
            <div className="inline-flex flex-col items-center">
              <p className="font-serif text-[2.5rem] font-semibold leading-none tracking-[-0.06em] text-[#1f1f1f]">
                LUMIA
              </p>
              <p className="mt-1.5 text-[8px] uppercase tracking-[0.3em] text-[#8a857d]">
                {tagline}
              </p>
            </div>
          </div>

          <div aria-hidden className="h-11 w-11" />
        </div>

        <div className="mt-2 grid grid-cols-[44px_minmax(0,1fr)_44px] items-start gap-2">
          <div className="flex min-w-0 items-start justify-start">
            <button
              type="button"
              onClick={onOpenWallet}
              aria-label={storeLabel}
              className={iconButtonClass}
            >
              <ShoppingBag className="h-[12px] w-[12px]" strokeWidth={1.7} aria-hidden />
            </button>
          </div>

          <div />

          <div className="flex min-w-0 items-start justify-end">
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={getText(profile.language, 'nav.settings')}
              className={iconButtonClass}
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
      onOpenSettings={onOpenSettings}
      onOpenWallet={onOpenWallet}
    />
  );
};
