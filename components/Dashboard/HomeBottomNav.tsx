import React, { memo } from 'react';
import { getText } from '../../constants';
import type { Language } from '../../types';
import type { HomeHubNavKey } from '../../lib/homeHubNav';

interface HomeBottomNavProps {
  language: Language;
  active: HomeHubNavKey;
  onHome: () => void;
  onChart: () => void;
  onDay: () => void;
  onCharts: () => void;
}

export const HomeBottomNav = memo<HomeBottomNavProps>(
  ({ language, active, onHome, onChart, onDay, onCharts }) => {
    const lang = language === 'en' ? 'en' : 'ru';

    const items: { key: HomeHubNavKey; label: string; onClick: () => void }[] = [
      { key: 'home', label: getText(lang, 'dashboard.nav_home'), onClick: onHome },
      { key: 'chart', label: getText(lang, 'dashboard.nav_chart'), onClick: onChart },
      { key: 'day', label: getText(lang, 'dashboard.nav_day'), onClick: onDay },
      { key: 'charts', label: getText(lang, 'dashboard.nav_charts'), onClick: onCharts },
    ];

    return (
      <nav
        className="pointer-events-none fixed bottom-0 left-0 right-0 z-30 flex justify-center pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-2"
        aria-label="Main"
      >
        <div className="pointer-events-auto mx-4 flex w-full max-w-md items-stretch justify-around gap-1 rounded-2xl border border-astro-border/40 bg-astro-card/88 px-1 py-1 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] backdrop-blur-xl">
          {items.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] font-medium transition-colors ${
                  isActive ? 'bg-astro-highlight/15 text-astro-highlight' : 'text-astro-subtext/90 hover:text-astro-text'
                }`}
              >
                <span className="text-sm leading-none" aria-hidden>
                  {item.key === 'home' && '⌂'}
                  {item.key === 'chart' && '◎'}
                  {item.key === 'day' && '☀'}
                  {item.key === 'charts' && '☰'}
                </span>
                <span className="truncate px-0.5">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }
);

HomeBottomNav.displayName = 'HomeBottomNav';
