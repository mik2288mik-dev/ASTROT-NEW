import React from 'react';
import type { UserProfile, ViewState } from '../../types';
import { cn } from '../../lib/cn';
import { lumiaSelectionHaptic } from '../../lib/haptics';

type LumiaBottomTabBarProps = {
  profile: UserProfile;
  view: ViewState;
  onOpenToday: () => void;
  onOpenHoroscope: () => void;
  onOpenNatal: () => void;
  onOpenSynastry: () => void;
  onOpenAvatar: () => void;
};

const SHOW_ON: ViewState[] = ['dashboard', 'horoscope', 'chart', 'synastry', 'settings'];

type IconProps = React.SVGProps<SVGSVGElement>;

function TodayCalendarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="5.2" y="6.2" width="17.6" height="16.6" rx="4.1" strokeWidth="2.25" />
      <path d="M9.4 4.4v4.1M18.6 4.4v4.1M5.9 11.3h16.2" strokeWidth="2.25" />
      <path d="M10 16.2h.1M14 16.2h.1M18 16.2h.1M10 19.8h.1M14 19.8h.1" strokeWidth="2.8" />
    </svg>
  );
}


function HoroscopeCompassIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="14" cy="14" r="10.4" strokeWidth="2.1" />
      <path d="M18.7 9.3l-3 6.4-6.4 3 3-6.4 6.4-3Z" strokeWidth="2" />
      <circle cx="14" cy="14" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

function NatalPieIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="14" cy="14" r="10.3" strokeWidth="2.1" />
      <path d="M14 14V3.7" strokeWidth="2.1" />
      <path d="M14 14l8.95 5.05" strokeWidth="2.1" />
    </svg>
  );
}

function UnionHeartIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 23.4C6.9 18.9 3.4 14.8 3.4 10.6 3.4 7.5 5.9 5 9 5c1.97 0 3.78 1.04 5 2.86C15.22 6.04 17.03 5 19 5c3.1 0 5.6 2.5 5.6 5.6 0 4.2-3.5 8.3-10.6 12.8Z" strokeWidth="2.05" />
    </svg>
  );
}

function ProfileUserIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="14" cy="10" r="4.4" strokeWidth="2.05" />
      <path d="M5.5 22.6c.9-4.3 4.1-6.6 8.5-6.6s7.6 2.3 8.5 6.6" strokeWidth="2.1" />
    </svg>
  );
}

function getBottomNavLabels(language: UserProfile['language']) {
  if (language === 'en') {
    return {
      today: 'Today',
      horoscope: 'Horoscope',
      chart: 'Map',
      union: 'Union',
      settings: 'Profile',
    };
  }

  return {
    today: 'Сегодня',
    horoscope: 'Гороскоп',
    chart: 'Карта',
    union: 'Союз',
    settings: 'Профиль',
  };
}

export function LumiaBottomTabBar({
  profile,
  view,
  onOpenToday,
  onOpenHoroscope,
  onOpenNatal,
  onOpenSynastry,
  onOpenAvatar,
}: LumiaBottomTabBarProps) {
  const labels = getBottomNavLabels(profile.language);

  if (!SHOW_ON.includes(view)) return null;

  const items = [
    {
      id: 'today',
      label: labels.today,
      active: view === 'dashboard',
      icon: <TodayCalendarIcon />,
      onClick: onOpenToday,
    },
    {
      id: 'horoscope',
      label: labels.horoscope,
      active: view === 'horoscope',
      icon: <HoroscopeCompassIcon />,
      onClick: onOpenHoroscope,
    },
    {
      id: 'chart',
      label: labels.chart,
      active: view === 'chart',
      icon: <NatalPieIcon />,
      onClick: onOpenNatal,
    },
    {
      id: 'union',
      label: labels.union,
      active: view === 'synastry',
      icon: <UnionHeartIcon />,
      onClick: onOpenSynastry,
    },
    {
      id: 'settings',
      label: labels.settings,
      active: view === 'settings',
      icon: <ProfileUserIcon />,
      onClick: onOpenAvatar,
    },
  ];

  return (
    <div className="lumia-bottom-tab-shell pointer-events-none">
      <nav className="lumia-bottom-tab-bar pointer-events-auto" aria-label="Lumia">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn('lumia-bottom-tab-item', item.active && 'is-active')}
            aria-label={item.label}
            aria-current={item.active ? 'page' : undefined}
            onClick={() => {
              lumiaSelectionHaptic();
              item.onClick();
            }}
          >
            <span className="lumia-bottom-tab-icon">{item.icon}</span>
            <span className="lumia-bottom-tab-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
