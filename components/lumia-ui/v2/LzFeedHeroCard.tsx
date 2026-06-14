import React from 'react';
import { motion } from 'framer-motion';
import { MonoTag } from '../../mono-ui/MonoTag';
import { LzArtPlate } from './LzArtPlate';
import { getLzArtSrc, type LzArtSlot } from '../../../lib/lzArtAssets';

type LzFeedHeroCardProps = {
  tag: string;
  title: string;
  summary: string;
  actionLabel: string;
  illustration: React.ReactNode;
  artSlot?: LzArtSlot;
  onClick?: () => void;
  delay?: number;
  variant?: 'light' | 'dark';
};

export function LzFeedHeroCard({
  tag,
  title,
  summary,
  actionLabel,
  illustration,
  artSlot,
  onClick,
  delay = 0,
  variant = 'light',
}: LzFeedHeroCardProps) {
  const dark = variant === 'dark';
  const imageSrc = artSlot ? getLzArtSrc(artSlot) : null;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay, ease: [0.22, 1, 0.36, 1] }}
      whileTap={{ scale: 0.985 }}
      onClick={onClick}
      className={`lz-feed-card group mt-6 w-full overflow-hidden text-left ${dark ? 'lz-feed-card-dark' : ''}`}
    >
      <LzArtPlate
        imageSrc={imageSrc}
        fallback={illustration}
        aspect="hero"
        className="rounded-none rounded-b-none"
        innerClassName="opacity-95"
      />

      <div className={`relative px-5 pb-5 pt-4 ${dark ? 'text-white' : ''}`}>
        <MonoTag dark={dark} className="w-fit">
          {tag}
        </MonoTag>
        <h2
          className={`relative z-10 mt-3 font-lora text-[clamp(1.45rem,5.5vw,1.75rem)] font-bold leading-[1.08] tracking-[-0.02em] ${
            dark ? 'text-white' : 'text-mono-ink'
          }`}
        >
          {title}
        </h2>
        <p className={`relative z-10 mt-2 line-clamp-3 text-[15px] leading-[1.55] ${dark ? 'text-white/78' : 'text-mono-muted'}`}>
          {summary}
        </p>
        <span
          className={`relative z-10 mt-5 inline-flex items-center gap-3 text-[14px] font-semibold ${
            dark ? 'text-white' : 'text-mono-ink'
          }`}
        >
          <span
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full transition-transform group-active:scale-95 ${
              dark ? 'bg-white text-mono-black' : 'bg-mono-black text-white'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {actionLabel}
        </span>
      </div>
    </motion.button>
  );
}
