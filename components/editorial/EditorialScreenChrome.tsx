import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Settings as SettingsIcon, UserRound } from 'lucide-react';

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
  const railRef = useRef<HTMLDivElement | null>(null);
  // A rail with more tabs than fit scrolls sideways; keep the active tab in view when it changes.
  useEffect(() => {
    const rail = railRef.current;
    const active = rail?.querySelector<HTMLElement>('.editorial-tab.is-active');
    if (!rail || !active || rail.scrollWidth <= rail.clientWidth) return;
    const target = active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, target), behavior: 'auto' });
  }, [activeTab]);

  // Arrows show only on a side that still hides tabs.
  const [edges, setEdges] = useState({ left: false, right: false });
  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    const next = { left: rail.scrollLeft > 4, right: max - rail.scrollLeft > 4 };
    setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  }, []);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    measure();
    rail.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(rail);
    return () => { rail.removeEventListener('scroll', measure); observer?.disconnect(); };
  }, [measure, tabs.length]);
  const nudge = (direction: 1 | -1) => {
    const rail = railRef.current;
    rail?.scrollBy({ left: direction * rail.clientWidth * 0.6, behavior: 'smooth' });
  };

  return (
    <div className={`editorial-tabs-wrap${edges.left ? ' can-left' : ''}${edges.right ? ' can-right' : ''}`}>
    {edges.left ? (
      <button type="button" className="editorial-tabs-arrow is-left" tabIndex={-1} aria-hidden="true" onClick={() => nudge(-1)}>
        <ChevronLeft size={18} strokeWidth={2} />
      </button>
    ) : null}
    <div
      ref={railRef}
      className={['editorial-tabs', className].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
      style={{ '--editorial-tab-count': tabs.length } as React.CSSProperties}
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
    {edges.right ? (
      <button type="button" className="editorial-tabs-arrow is-right" tabIndex={-1} aria-hidden="true" onClick={() => nudge(1)}>
        <ChevronRight size={18} strokeWidth={2} />
      </button>
    ) : null}
    </div>
  );
}
export function EditorialProfileButton({
  label,
  onClick,
  opensDialog = true,
}: {
  label: string;
  onClick?: () => void;
  opensDialog?: boolean;
}) {
  return (
    <button
      type="button"
      className="app-top-bar-action editorial-profile-button"
      aria-label={label}
      aria-haspopup={onClick && opensDialog ? 'dialog' : undefined}
      onClick={onClick}
      disabled={!onClick}
    >
      <UserRound aria-hidden="true" strokeWidth={1.35} />
    </button>
  );
}

export function EditorialChartsButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <EditorialProfileButton
      label={label}
      onClick={onClick}
      opensDialog={false}
    />
  );
}

export function EditorialSettingsButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className="app-top-bar-action editorial-settings-button"
      aria-label={label}
      onClick={onClick}
      disabled={!onClick}
    >
      <SettingsIcon aria-hidden="true" strokeWidth={1.35} />
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
