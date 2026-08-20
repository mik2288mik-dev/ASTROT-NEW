import React from 'react';
import { UserRound } from 'lucide-react';

export type EditorialTabItem<T extends string> = {
  id: T;
  label: string;
};

type EditorialTabsProps<T extends string> = {
  label: string;
  tabs: readonly EditorialTabItem<T>[];
  activeTab: T;
  onTabChange: (tab: T) => void;
  className?: string;
};

export function EditorialTabs<T extends string>({
  label,
  tabs,
  activeTab,
  onTabChange,
  className,
}: EditorialTabsProps<T>) {
  return (
    <div
      className={['editorial-tabs', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            className={`editorial-tab${active ? ' is-active' : ''}`}
            aria-pressed={active}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
export function EditorialProfileButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="app-top-bar-action editorial-profile-button"
      aria-label={label}
      aria-haspopup={onClick ? 'dialog' : undefined}
      onClick={onClick}
      disabled={!onClick}
    >
      <UserRound aria-hidden="true" strokeWidth={1.35} />
    </button>
  );
}

export function EditorialCurve({ className }: { className?: string }) {
  return (
    <div className={['editorial-curve', className].filter(Boolean).join(' ')} aria-hidden="true">
      <svg viewBox="0 0 390 78" preserveAspectRatio="none">
        <path d="M-12 58C88 8 232 8 404 58" />
        <circle cx="331" cy="36" r="3" />
      </svg>
    </div>
  );
}
