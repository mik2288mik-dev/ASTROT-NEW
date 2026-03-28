import React, { memo } from 'react';
import Image, { type StaticImageData } from 'next/image';

interface DailyHeroCardProps {
  heroImage: StaticImageData;
  label: string;
  dateLine: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  onCta: () => void;
}

export const DailyHeroCard = memo<DailyHeroCardProps>(
  ({ heroImage, label, dateLine, title, subtitle, ctaLabel, onCta }) => {
    return (
      <div className="relative overflow-hidden rounded-[22px] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.45)] ring-1 ring-white/[0.08]">
        <div className="absolute inset-0">
          <Image
            src={heroImage}
            alt=""
            fill
            priority
            sizes="(max-width: 448px) 100vw, 28rem"
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/[0.92] via-black/55 to-black/30"
            aria-hidden
          />
        </div>
        <div className="relative flex min-h-[220px] flex-col justify-end px-5 pb-5 pt-14 sm:min-h-[236px] sm:px-6 sm:pb-5 sm:pt-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/85">{label}</p>
          <p className="mt-1.5 text-xs font-medium text-white/70">{dateLine}</p>
          <h2 className="mt-3 max-w-[18ch] font-serif text-[21px] font-semibold leading-[1.22] tracking-tight text-white [text-wrap:balance] sm:max-w-[20ch] sm:text-[23px]">
            {title}
          </h2>
          <p className="mt-2 max-w-[34ch] text-[13px] leading-relaxed text-white/88 [text-wrap:pretty] sm:text-sm">
            {subtitle}
          </p>
          <button
            type="button"
            onClick={onCta}
            className="mt-5 w-full rounded-xl bg-white py-3.5 text-center text-sm font-semibold text-[#1a1520] shadow-lg transition-transform active:scale-[0.99] sm:w-auto sm:min-w-[200px] sm:px-8"
          >
            {ctaLabel}
          </button>
        </div>
      </div>
    );
  }
);

DailyHeroCard.displayName = 'DailyHeroCard';
