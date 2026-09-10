import React from 'react';

/**
 * Quiet section header used across the natal-reading and horoscope screens.
 * Holds only the title and an optional small hint on the right.
 * Tier badges (Free / Premium) intentionally removed — gating is shown via
 * lock icons on the actual locked content, not as decorative chips.
 */
export const SectionLabel: React.FC<{
  hint?: string;
  children: React.ReactNode;
}> = ({ hint, children }) => {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-lora text-[18px] font-medium leading-[1.3] tracking-[-0.005em] text-[#1f1f1f]">
        {children}
      </h2>
      {hint ? (
        <span className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-[#9a9a9a]">
          {hint}
        </span>
      ) : null}
    </div>
  );
};

export const Divider: React.FC = () => (
  <div className="h-px w-full bg-[#f2f2f2]" />
);
