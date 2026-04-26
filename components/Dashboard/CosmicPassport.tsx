import React, { memo } from 'react';
import Image from 'next/image';
import { UserProfile, NatalChartData } from '../../types';
import { getText, getZodiacSign } from '../../constants';
import { PlanetIcon } from '../icons/PlanetIcon';

interface CosmicPassportProps {
  profile: UserProfile;
  chartData: NatalChartData;
  photoUrl?: string;
  displayName: string;
  onOpenSettings: () => void;
}

export const CosmicPassport = memo<CosmicPassportProps>(
  ({ profile, chartData, photoUrl, displayName, onOpenSettings }) => {
    const lang = profile.language;
    const sunSign = chartData.sun?.sign || 'Aries';
    const sunLabel = getZodiacSign(lang, sunSign);
    const moonLabel = chartData.moon?.sign ? getZodiacSign(lang, chartData.moon.sign) : null;
    const sameSign = moonLabel && moonLabel === sunLabel;
    const displayNameFinal = profile.name?.trim() || displayName;

    const renderSignsLine = () => {
      if (lang !== 'ru') {
        return (
          <span>
            {sameSign
              ? `Sun & Moon · ${sunLabel}`
              : moonLabel
                ? `Sun ${sunLabel} · Moon ${moonLabel}`
                : `Sun · ${sunLabel}`}
          </span>
        );
      }
      if (sameSign) {
        return (
          <span className="inline-flex items-center gap-1.5">
            <PlanetIcon planet="sun" size={12} stroke="currentColor" />
            <PlanetIcon planet="moon" size={12} stroke="currentColor" />
            <span>{sunLabel}</span>
          </span>
        );
      }
      if (moonLabel) {
        return (
          <span className="inline-flex items-center gap-1.5">
            <PlanetIcon planet="sun" size={12} stroke="currentColor" />
            <span>{sunLabel}</span>
            <span className="text-astro-subtext/55">·</span>
            <PlanetIcon planet="moon" size={12} stroke="currentColor" />
            <span>{moonLabel}</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1.5">
          <PlanetIcon planet="sun" size={12} stroke="currentColor" />
          <span>{sunLabel}</span>
        </span>
      );
    };

    return (
      <div className="lumia-glass relative overflow-hidden rounded-[30px]">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-astro-text/[0.04] via-transparent to-transparent"
          aria-hidden
        />

        <button
          type="button"
          onClick={onOpenSettings}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-astro-subtext transition-colors hover:bg-astro-bg/50 hover:text-astro-text sm:right-4 sm:top-4"
          aria-label={getText(lang, 'settings.title')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-[20px] w-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <div className="relative px-5 pb-5 pt-5 pr-12 sm:px-6 sm:pb-6 sm:pr-14 sm:pt-6">
          <div className="flex items-center gap-3.5">
            <div className="relative h-[50px] w-[50px] shrink-0 sm:h-[54px] sm:w-[54px]">
              {photoUrl ? (
                <div className="relative h-full w-full overflow-hidden rounded-full ring-1 ring-astro-text/12 ring-offset-2 ring-offset-transparent">
                  <Image
                    src={photoUrl}
                    alt=""
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                    unoptimized={photoUrl.startsWith('http')}
                  />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-astro-text/[0.05] font-serif text-lg font-semibold text-astro-text ring-1 ring-astro-text/12">
                  {displayNameFinal.charAt(0).toUpperCase()}
                </div>
              )}
              {profile.isPremium && (
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-astro-highlight px-1.5 py-px text-[7px] font-bold uppercase leading-none text-white ring-2 ring-astro-card">
                  PRO
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate font-serif text-[22px] font-semibold leading-tight tracking-tight text-astro-text sm:text-[26px]">
                {displayNameFinal}
              </h1>
              <p className="mt-1 text-[13px] leading-snug text-astro-subtext sm:text-sm">{renderSignsLine()}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="max-w-[40ch] text-sm leading-relaxed text-astro-text/92">
              {getText(lang, 'dashboard.identity_body')}
            </p>
          </div>
        </div>
      </div>
    );
  }
);

CosmicPassport.displayName = 'CosmicPassport';
