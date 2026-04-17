import React from 'react';
import { UserProfile, ViewState } from '../types';
import { getText } from '../constants';
import { StudioBrandBlock } from './lumia-ui/StudioBrandBlock';

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

  return (
    <header className="lumia-tg-header-bar relative z-40 shrink-0 bg-white">
      <div className="pt-0.5 pb-2">
        <StudioBrandBlock
          onOpenSettings={onOpenSettings}
          onOpenStore={onOpenWallet}
          settingsAriaLabel={getText(profile.language, 'nav.settings')}
          storeLabel={storeLabel}
          tagline={tagline}
        />

        <div className="mt-1 pt-1 text-center">
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
