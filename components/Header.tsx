
import React, { useEffect, useState } from 'react';
import { UserProfile, ViewState } from '../types';
import { getText } from '../constants';

interface HeaderProps {
    profile: UserProfile | null;
    view: ViewState;
    onOpenSettings: () => void;
    onBack: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, view, onOpenSettings, onBack }) => {
    const [tgUser, setTgUser] = useState<any>(null);
    const [headerOffset, setHeaderOffset] = useState(64);

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            setTgUser(tg.initDataUnsafe.user);
        }
        const safeInset = tg?.safeAreaInset?.top || 0;
        const platformOffset = tg?.platform === 'ios' ? 20 : 12;
        setHeaderOffset(Math.max(56, safeInset + 24 + platformOffset));
    }, []);

    if (!profile) return null;

    const displayName = tgUser?.first_name || profile.name;
    const photoUrl = tgUser?.photo_url;

    // Logic: If on Dashboard, show Main Header. If on sub-view, show Back Header.
    const isHub = view === 'dashboard';
    const isFunnel = view === 'onboarding' || view === 'hook' || view === 'paywall';

    if (isFunnel) return null;

    return (
        <header 
            className="bg-astro-bg/80 backdrop-blur-md border-b border-astro-border min-h-[4rem] shrink-0 flex items-center justify-between px-4 relative z-40"
            style={{ paddingTop: `${headerOffset}px`, paddingBottom: '12px' }}
        >
            
            {/* Left Side */}
            <div className="flex items-center gap-3 w-20">
                {isHub ? (
                    // Empty on Hub (avatar now in cosmic passport)
                    <div className="w-9"></div>
                ) : (
                    // Back Button on Sub-pages - опущена на дополнительные 24px
                    <button 
                        onClick={onBack}
                        aria-label="Назад"
                        className="w-10 h-10 flex items-center justify-center text-astro-text hover:text-astro-highlight transition-colors rounded-full bg-astro-bg/40 border border-astro-border/60 shadow-sm"
                        style={{ marginTop: '8px' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Center - Title */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center">
                 <h1 className="text-xl font-bold text-astro-text font-serif tracking-tighter drop-shadow-sm uppercase">
                     ASTROT
                 </h1>
            </div>

            {/* Right Side - Empty on Hub (settings now in cosmic passport) */}
            <div className="flex justify-end w-20">
                <div className="w-9"></div>
            </div>
        </header>
    );
};
