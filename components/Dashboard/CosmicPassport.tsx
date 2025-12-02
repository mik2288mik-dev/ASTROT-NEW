import React, { memo } from 'react';
import Image from 'next/image';
import { UserProfile, NatalChartData } from '../../types';
import { getText, getZodiacSign, getElement } from '../../constants';

interface CosmicPassportProps {
  profile: UserProfile;
  chartData: NatalChartData;
  photoUrl?: string;
  displayName: string;
  onOpenSettings: () => void;
}

export const CosmicPassport = memo<CosmicPassportProps>(({ 
  profile, 
  chartData, 
  photoUrl, 
  displayName, 
  onOpenSettings 
}) => {
  return (
    <div className="bg-astro-card rounded-2xl p-6 border border-astro-border shadow-soft relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-astro-highlight rounded-full blur-3xl opacity-20"></div>
      <div className="relative z-10">
        {/* Header with Avatar and Settings */}
        <div className="flex items-start justify-between mb-4">
          {/* Avatar */}
          <div className="relative group">
            {photoUrl ? (
              <div className="relative w-14 h-14 rounded-full border-2 border-astro-border shadow-md overflow-hidden">
                <Image 
                  src={photoUrl} 
                  alt="Avatar" 
                  width={56}
                  height={56}
                  className="object-cover"
                  unoptimized={photoUrl.startsWith('http')} // Telegram URLs могут требовать unoptimized
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-astro-primary to-astro-accent flex items-center justify-center text-white text-lg font-bold shadow-lg">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            {profile.isPremium && (
              <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black text-[9px] font-bold px-2 py-0.5 rounded-full border-2 border-astro-card shadow-md z-10">
                PRO
              </div>
            )}
          </div>
          
          {/* Settings Button */}
          <button 
            onClick={onOpenSettings}
            className="w-10 h-10 flex items-center justify-center text-astro-subtext hover:text-astro-text transition-colors rounded-full hover:bg-astro-bg/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-2">
          {getText(profile.language, 'dashboard.passport')}
        </p>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-serif text-astro-text mb-2">{profile.name}</h1>
            <div className="text-sm font-medium text-astro-highlight">
              <span>☉ {getZodiacSign(profile.language, chartData.sun?.sign || 'Aries')}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
              {getText(profile.language, 'dashboard.element')}
            </p>
            <p className="font-serif text-base text-astro-text">
              {getElement(profile.language, chartData.element)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
});

CosmicPassport.displayName = 'CosmicPassport';
