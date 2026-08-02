import React from 'react';
import type { UserProfile, ViewState } from '../types';
import { AppTopBar } from './lumia-ui/AppTopBar';

interface HeaderProps {
  profile: UserProfile | null;
  view: ViewState;
  onBack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  view,
  onBack,
}) => {
  if (!profile) return null;

  const isFunnel = view === 'onboarding' || view === 'paywall';
  const isDashboard = view === 'dashboard';
  const isHoroscope = view === 'horoscope';
  const isAdmin = view === 'admin';

  if (isFunnel || isDashboard || isHoroscope || isAdmin) return null;

  const language = profile.language === 'en' ? 'en' : 'ru';
  const titles: Partial<Record<ViewState, { ru: string; en: string }>> = {
    chart: { ru: 'Натальная карта', en: 'Natal chart' },
    synastry: { ru: 'Совместимость', en: 'Compatibility' },
    matrix: { ru: 'Матрица судьбы', en: 'Destiny matrix' },
    settings: { ru: 'Настройки', en: 'Settings' },
    charts: { ru: 'Мои карты', en: 'My charts' },
  };
  const title = titles[view]?.[language] || (language === 'ru' ? 'Твой Гороскоп' : 'Your Horoscope');

  return <AppTopBar title={title} onBack={onBack} />;
};
