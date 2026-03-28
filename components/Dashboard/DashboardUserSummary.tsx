import React, { memo } from 'react';
import Image from 'next/image';
import { getText, getZodiacSign } from '../../constants';
import type { UserProfile, NatalChartData } from '../../types';

interface DashboardUserSummaryProps {
  profile: UserProfile;
  chartData: NatalChartData;
  photoUrl?: string;
  displayName: string;
  onOpenSettings: () => void;
}

export const DashboardUserSummary = memo<DashboardUserSummaryProps>(
  ({ profile, chartData, photoUrl, displayName, onOpenSettings }) => {
    const lang = profile.language;
    const sunSign = chartData.sun?.sign || 'Aries';
    const signLabel = getZodiacSign(lang, sunSign);

    return (
      <div className="flex items-center gap-3 rounded-2xl border border-astro-border/35 bg-astro-card/55 px-3 py-2.5 shadow-sm backdrop-blur-sm">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full ring-1 ring-astro-text/10">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt=""
              width={44}
              height={44}
              className="h-full w-full object-cover"
              unoptimized={photoUrl.startsWith('http')}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-astro-text/[0.06] font-serif text-base font-semibold text-astro-text">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight text-astro-text">{displayName}</p>
          <p className="mt-0.5 truncate text-xs text-astro-subtext">☉ {signLabel}</p>
        </div>
        {profile.isPremium && (
          <span className="shrink-0 rounded-full bg-astro-highlight/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-astro-highlight">
            {getText(lang, 'dashboard.premium_badge')}
          </span>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-astro-subtext transition-colors hover:bg-astro-text/[0.06] hover:text-astro-text"
          aria-label={getText(lang, 'settings.title')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>
    );
  }
);

DashboardUserSummary.displayName = 'DashboardUserSummary';
