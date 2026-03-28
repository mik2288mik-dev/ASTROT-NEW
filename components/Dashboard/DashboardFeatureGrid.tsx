import React, { memo } from 'react';

export type FeatureItem = {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClick: () => void;
  badge?: string;
};

interface DashboardFeatureGridProps {
  items: FeatureItem[];
}

export const DashboardFeatureGrid = memo<DashboardFeatureGridProps>(({ items }) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className="group relative flex flex-col rounded-2xl border border-astro-border/40 bg-astro-card/70 p-4 text-left shadow-sm transition-[transform,box-shadow] hover:border-astro-highlight/25 hover:shadow-md active:scale-[0.98]"
        >
          {item.badge ? (
            <span className="absolute right-2 top-2 rounded-full bg-astro-highlight/15 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-astro-highlight">
              {item.badge}
            </span>
          ) : null}
          <span className="text-2xl leading-none opacity-90 transition-opacity group-hover:opacity-100">{item.icon}</span>
          <h3 className="mt-3 font-serif text-[15px] font-semibold leading-snug text-astro-text">{item.title}</h3>
          {item.subtitle ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-astro-subtext">{item.subtitle}</p>
          ) : null}
        </button>
      ))}
    </div>
  );
});

DashboardFeatureGrid.displayName = 'DashboardFeatureGrid';
