import React from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import type { UserProfile, ViewState } from '../../types';
import { cn } from '../../lib/cn';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { ChatIcon, HeartIcon, HoroscopeIcon, NatalChartIcon } from '../icons/UiIcons';

type LumiaBottomTabBarProps = {
  profile: UserProfile;
  view: ViewState;
  onOpenToday: () => void;
  onOpenNatal: () => void;
  onOpenSynastry: () => void;
  onOpenAsk: () => void;
  onOpenMore: () => void;
};

const SHOW_ON: ViewState[] = ['dashboard', 'chart', 'synastry', 'oracle', 'settings'];

function getBottomNavLabels(language: UserProfile['language']) {
  if (language === 'en') {
    return {
      today: 'Today',
      chart: 'Map',
      union: 'Compatibility',
      ask: 'Ask',
      more: 'More',
    };
  }

  return {
    today: 'Сегодня',
    chart: 'Карта',
    union: 'Совместимость',
    ask: 'Спросить',
    more: 'Ещё',
  };
}

export function LumiaBottomTabBar({
  profile,
  view,
  onOpenToday,
  onOpenNatal,
  onOpenSynastry,
  onOpenAsk,
  onOpenMore,
}: LumiaBottomTabBarProps) {
  const labels = getBottomNavLabels(profile.language);
  const reduce = useReducedMotion();

  if (!SHOW_ON.includes(view)) return null;

  const items: Array<{
    id: string;
    label: string;
    active: boolean;
    icon: React.ReactNode;
    onClick: () => void;
  }> = [
    {
      id: 'today',
      label: labels.today,
      active: view === 'dashboard',
      icon: <HoroscopeIcon />,
      onClick: onOpenToday,
    },
    {
      id: 'chart',
      label: labels.chart,
      active: view === 'chart',
      icon: <NatalChartIcon />,
      onClick: onOpenNatal,
    },
    {
      id: 'union',
      label: labels.union,
      active: view === 'synastry',
      icon: <HeartIcon />,
      onClick: onOpenSynastry,
    },
    {
      id: 'ask',
      label: labels.ask,
      active: view === 'oracle',
      icon: <ChatIcon />,
      onClick: onOpenAsk,
    },
    {
      id: 'more',
      label: labels.more,
      active: view === 'settings',
      icon: <MoreHorizontal aria-hidden strokeWidth={1.75} />,
      onClick: onOpenMore,
    },
  ];

  return (
    <div className="lumia-bottom-tab-shell pointer-events-none">
      <LayoutGroup>
        <nav className="lumia-bottom-tab-bar pointer-events-auto" aria-label="Lumia">
          {items.map((item) => {
            return (
              <button
                key={item.id}
                type="button"
                data-tab-id={item.id}
                className={cn('lumia-bottom-tab-item', item.active && 'is-active')}
                aria-label={item.label}
                aria-current={item.active ? 'page' : undefined}
                onClick={() => {
                  lumiaSelectionHaptic();
                  item.onClick();
                }}
              >
                {item.active && !reduce ? (
                  <motion.span
                    layoutId="lumia-bottom-tab-pill"
                    className="lumia-bottom-tab-active-pill"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                ) : null}
                {item.active && reduce ? <span className="lumia-bottom-tab-active-pill" aria-hidden /> : null}
                <span className="lumia-bottom-tab-icon">
                  {item.icon}
                </span>
                <span className="lumia-bottom-tab-label">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </LayoutGroup>
    </div>
  );
}
