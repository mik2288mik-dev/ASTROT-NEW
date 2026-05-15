import React, { useEffect, useState } from 'react';
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

function UnionHeartHandsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M14 22.2s-8.55-4.9-9.64-9.8C3.64 9.17 5.62 6.9 8.18 6.9c1.58 0 2.88.76 3.67 1.93.42.62 1.88.62 2.3 0 .79-1.17 2.09-1.93 3.67-1.93 2.56 0 4.54 2.27 3.82 5.5C20.55 17.3 14 22.2 14 22.2Z" strokeWidth="2.05" />
      <path d="M8 13.65l2.22-2.04c.66-.6 1.5-.66 2.22-.15l1.08.77c.46.33 1.06.3 1.47-.08l1.11-1.02" strokeWidth="1.8" opacity="0.78" />
      <path d="M9.12 14.86l3.46 3.18c.8.74 2.04.74 2.84 0l3.46-3.18" strokeWidth="1.9" opacity="0.9" />
      <path d="M11.08 16.66l.92-.86M13.48 18.36l1.04-1M16.92 16.66l-.92-.86" strokeWidth="1.48" opacity="0.64" />
    </svg>
  );
}

function getBottomNavLabels(language: UserProfile['language']) {
  if (language === 'en') {
    return {
      today: 'Today',
      chart: 'Map',
      union: 'Union',
      avatar: 'Settings',
    };
  }

  return {
    today: 'Сегодня',
    chart: 'Карта',
    union: 'Союз',
    avatar: 'Настройки',
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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const labels = getBottomNavLabels(profile.language);
  const initial = (profile.name || 'L').trim().slice(0, 1).toUpperCase();

  useEffect(() => {
    try {
      const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      setPhotoUrl(typeof tgUser?.photo_url === 'string' ? tgUser.photo_url : null);
    } catch {
      setPhotoUrl(null);
    }
  }, []);

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
      icon: <UnionHeartHandsIcon />,
      onClick: onOpenSynastry,
    },
    {
      id: 'avatar',
      label: labels.avatar,
      active: view === 'settings',
      icon: (
        <span className="lumia-bottom-tab-avatar" aria-hidden>
          {photoUrl ? <img src={photoUrl} alt="" draggable={false} /> : <span>{initial}</span>}
        </span>
      ),
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
