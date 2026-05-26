import React from 'react';
import type { UserProfile, ViewState } from '../../types';
import { cn } from '../../lib/cn';
import { lumiaSelectionHaptic } from '../../lib/haptics';

type LumiaBottomTabBarProps = {
  profile: UserProfile;
  view: ViewState;
  onOpenToday: () => void;
  onOpenNatal: () => void;
  onOpenSynastry: () => void;
  onOpenAvatar: () => void;
};

const SHOW_ON: ViewState[] = ['dashboard', 'chart', 'synastry', 'settings'];

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

function NatalCircleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="14" cy="14" r="10.2" strokeWidth="2.15" />
      <circle cx="14" cy="14" r="4.1" strokeWidth="1.95" />
      <path d="M14 3.8v5.7M14 18.5v5.7M3.8 14h5.7M18.5 14h5.7" strokeWidth="1.95" />
      <path d="M7 7l4.1 4.1M17 17l4 4M21 7l-4.1 4.1M11 17l-4 4" strokeWidth="1.55" opacity="0.72" />
      <circle cx="20.2" cy="11.1" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function UnionProfilesIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="10.6" cy="10.3" r="3.45" strokeWidth="2.05" />
      <circle cx="17.4" cy="10.3" r="3.45" strokeWidth="2.05" opacity="0.72" />
      <path d="M4.6 21.1c.78-3.55 3.05-5.45 6-5.45 1.32 0 2.42.38 3.4 1.12.98-.74 2.08-1.12 3.4-1.12 2.95 0 5.22 1.9 6 5.45" strokeWidth="2.15" />
      <path d="M11.9 17.48c.64.6 1.34.9 2.1.9s1.46-.3 2.1-.9" strokeWidth="1.6" opacity="0.68" />
      <path d="M14 15.95v2.3" strokeWidth="1.55" opacity="0.58" />
    </svg>
  );
}

function SettingsGearIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path
        d="M11.7 4.2c.58-1.5 3.02-1.5 3.6 0l.35.9c.18.46.55.82 1.02.99.47.18.98.15 1.43-.06l.86-.41c1.47-.7 3.2 1.03 2.5 2.5l-.41.86c-.21.45-.24.96-.06 1.43.17.47.53.84.99 1.02l.9.35c1.5.58 1.5 3.02 0 3.6l-.9.35c-.46.18-.82.55-.99 1.02-.18.47-.15.98.06 1.43l.41.86c.7 1.47-1.03 3.2-2.5 2.5l-.86-.41c-.45-.21-.96-.24-1.43-.06-.47.17-.84.53-1.02.99l-.35.9c-.58 1.5-3.02 1.5-3.6 0l-.35-.9c-.18-.46-.55-.82-1.02-.99-.47-.18-.98-.15-1.43.06l-.86.41c-1.47.7-3.2-1.03-2.5-2.5l.41-.86c.21-.45.24-.96.06-1.43-.17-.47-.53-.84-.99-1.02l-.9-.35c-1.5-.58-1.5-3.02 0-3.6l.9-.35c.46-.18.82-.55.99-1.02.18-.47.15-.98-.06-1.43l-.41-.86c-.7-1.47 1.03-3.2 2.5-2.5l.86.41c.45.21.96.24 1.43.06.47-.17.84-.53 1.02-.99l.35-.9Z"
        strokeWidth="1.85"
      />
      <circle cx="13.5" cy="13.8" r="3.75" strokeWidth="2.05" />
    </svg>
  );
}

function getBottomNavLabels(language: UserProfile['language']) {
  if (language === 'en') {
    return {
      today: 'Today',
      chart: 'Map',
      union: 'Union',
      settings: 'Settings',
    };
  }

  return {
    today: 'Сегодня',
    chart: 'Карта',
    union: 'Союз',
    settings: 'Настройки',
  };
}

export function LumiaBottomTabBar({
  profile,
  view,
  onOpenToday,
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
      id: 'chart',
      label: labels.chart,
      active: view === 'chart',
      icon: <NatalCircleIcon />,
      onClick: onOpenNatal,
    },
    {
      id: 'union',
      label: labels.union,
      active: view === 'synastry',
      icon: <UnionProfilesIcon />,
      onClick: onOpenSynastry,
    },
    {
      id: 'settings',
      label: labels.settings,
      active: view === 'settings',
      icon: <SettingsGearIcon />,
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
