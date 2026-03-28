import React, { memo } from 'react';

interface DashboardSecondaryCtaProps {
  title: string;
  subtitle: string;
  onClick: () => void;
  badge?: string;
}

export const DashboardSecondaryCta = memo<DashboardSecondaryCtaProps>(({ title, subtitle, onClick, badge }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl border border-astro-border/40 bg-astro-card/55 p-4 text-left shadow-sm transition-[transform,box-shadow] hover:border-astro-highlight/22 hover:shadow-md active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-astro-highlight/12 text-xl text-astro-highlight">
        ✧
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-[15px] font-semibold text-astro-text">{title}</h3>
          {badge ? (
            <span className="rounded-full bg-astro-highlight/12 px-2 py-0.5 text-[8px] font-bold uppercase text-astro-highlight">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-astro-subtext">{subtitle}</p>
      </div>
      <span className="shrink-0 text-astro-subtext/60" aria-hidden>
        →
      </span>
    </button>
  );
});

DashboardSecondaryCta.displayName = 'DashboardSecondaryCta';
