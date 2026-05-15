import React, { useEffect, useState } from 'react';
import type { UserProfile, ViewState } from '../../types';
import { cn } from '../../lib/cn';

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

function UnionRingsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="10.8" cy="14" r="6.1" strokeWidth="2.15" />
      <circle cx="17.2" cy="14" r="6.1" strokeWidth="2.15" opacity="0.72" />
      <path d="M12.1 10.3c1.22.84 2.17 2.16 2.58 3.7-.41 1.54-1.36 2.86-2.58 3.7" strokeWidth="1.65" opacity="0.9" />
      <path d="M15.9 10.3c-1.22.84-2.17 2.16-2.58 3.7.41 1.54 1.36 2.86 2.58 3.7" strokeWidth="1.65" opacity="0.56" />
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

function haptic() {
  try {
    (window as any)?.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  } catch {
    /* Telegram haptics are optional */
  }
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
      icon: <UnionRingsIcon />,
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
              haptic();
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
