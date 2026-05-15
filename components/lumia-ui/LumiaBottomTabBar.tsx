import React, { useEffect, useState } from 'react';
import { HeartHandshake, Map, Sparkles } from 'lucide-react';
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

function getBottomNavLabels(language: UserProfile['language']) {
  if (language === 'en') {
    return {
      today: 'Today',
      chart: 'Map',
      union: 'Union',
      avatar: 'Avatar',
    };
  }

  return {
    today: 'Сегодня',
    chart: 'Карта',
    union: 'Союз',
    avatar: 'Аватар',
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
      icon: <Sparkles size={24} strokeWidth={2.15} />,
      onClick: onOpenToday,
    },
    {
      id: 'chart',
      label: labels.chart,
      active: view === 'chart',
      icon: <Map size={24} strokeWidth={2.1} />,
      onClick: onOpenNatal,
    },
    {
      id: 'union',
      label: labels.union,
      active: view === 'synastry',
      icon: <HeartHandshake size={25} strokeWidth={2.05} />,
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
