import React from 'react';

type Tier = 'free' | 'premium';

const TIER_STYLE: Record<Tier, { color: string; bg: string; label: string }> = {
  free: { color: '#3f8a6c', bg: '#e9f3ee', label: 'Бесплатно' },
  premium: { color: '#6f4ea8', bg: '#efe7f7', label: 'Premium' },
};

export const SectionLabel: React.FC<{
  tier?: Tier;
  hint?: string; // e.g. "обновляется раз в неделю"
  children: React.ReactNode;
}> = ({ tier = 'free', hint, children }) => {
  const style = TIER_STYLE[tier];
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-lora text-[18px] font-medium leading-[1.3] tracking-[-0.005em] text-[#1f1f1f]">
        {children}
      </h2>
      <div className="flex items-center gap-2 shrink-0">
        {hint ? (
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#9a9a9a]">{hint}</span>
        ) : null}
        <span
          className="inline-flex items-center rounded-[20px] px-2.5 py-[3px] text-[10px] font-medium leading-none"
          style={{ color: style.color, background: style.bg }}
        >
          {style.label}
        </span>
      </div>
    </div>
  );
};

export const Divider: React.FC = () => (
  <div className="h-px w-full bg-[#f2f2f2]" />
);
