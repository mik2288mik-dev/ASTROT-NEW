import React from 'react';
import { motion } from 'framer-motion';
import { MonoTag } from '../../mono-ui/MonoTag';

type LzFeedHeroCardProps = {
  tag: string;
  title: string;
  summary: string;
  actionLabel: string;
  illustration: React.ReactNode;
  onClick?: () => void;
  delay?: number;
};

export function LzFeedHeroCard({
  tag,
  title,
  summary,
  actionLabel,
  illustration,
  onClick,
  delay = 0,
}: LzFeedHeroCardProps) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className="relative mt-5 flex min-h-[168px] w-full flex-col overflow-hidden rounded-mono-card bg-mono-plate px-5 py-5 text-left"
    >
      <div className="pointer-events-none absolute bottom-1 right-1 opacity-90" aria-hidden="true">
        {illustration}
      </div>
      <MonoTag className="relative z-10 w-fit">{tag}</MonoTag>
      <h2 className="relative z-10 mt-2 max-w-[62%] text-[26px] font-bold leading-[1.05] tracking-[-0.02em] text-mono-ink">
        {title}
      </h2>
      <p className="relative z-10 mt-2 max-w-[68%] line-clamp-2 text-[14px] font-medium leading-snug text-mono-muted">
        {summary}
      </p>
      <span className="relative z-10 mt-4 inline-flex items-center gap-2 text-[14px] font-semibold text-mono-ink">
        {actionLabel}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </motion.button>
  );
}
