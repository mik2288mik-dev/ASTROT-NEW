import React, { memo } from 'react';
import { getText } from '../../constants';
import type { Language } from '../../types';

type NavKey = 'home' | 'chart' | 'day' | 'more';

interface HomeBottomNavProps {
  language: Language;
  active: NavKey;
  onSelect: (key: NavKey) => void;
}

export const HomeBottomNav = memo<HomeBottomNavProps>(({ language, active, onSelect }) => {
  const lang = language === 'en' ? 'en' : 'ru';
  const items: { key: NavKey; label: string }[] = [
    { key: 'home', label: getText(lang, 'dashboard.nav_home') },
    { key: 'chart', label: getText(lang, 'dashboard.nav_chart') },
    { key: 'day', label: getText(lang, 'dashboard.nav_day') },
    { key: 'more', label: getText(lang, 'dashboard.nav_more') },
  ];

  return (
    <nav
      className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 flex justify-center pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2"
      aria-label="Main"
    >
      <div className="pointer-events-auto mx-4 flex w-full max-w-md items-stretch justify-around gap-1 rounded-2xl border border-astro-border/45 bg-astro-card/90 px-1 py-1.5 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        {items.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors ${
                isActive ? 'bg-astro-highlight/15 text-astro-highlight' : 'text-astro-subtext hover:text-astro-text'
              }`}
            >
              <span className="text-sm leading-none" aria-hidden>
                {item.key === 'home' && '⌂'}
                {item.key === 'chart' && '◎'}
                {item.key === 'day' && '☀'}
                {item.key === 'more' && '⋯'}
              </span>
              <span className="truncate px-0.5">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});

HomeBottomNav.displayName = 'HomeBottomNav';
