
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

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            setTgUser(tg.initDataUnsafe.user);
        }
    }, []);

    if (!profile) return null;

    const displayName = tgUser?.first_name || profile.name;
    const photoUrl = tgUser?.photo_url;

    // Logic: If on Dashboard, show Main Header. If on sub-view, show Back Header.
    const isHub = view === 'dashboard';
    const isFunnel = view === 'onboarding' || view === 'hook' || view === 'paywall';

    if (isFunnel) return null;

    return (
        <header className="bg-astro-bg/80 backdrop-blur-md border-b border-astro-border h-16 shrink-0 flex items-center justify-between px-4 relative z-40">
            
            {/* Left Side */}
            <div className="flex items-center gap-3 w-20">
                {isHub ? (
                    // User Profile on Hub
                    <div className="flex items-center gap-3 mt-3 ml-1">
                         <div className="relative group">
                            {photoUrl ? (
                                <img src={photoUrl} alt="Avatar" className="w-9 h-9 rounded-full border border-astro-border shadow-sm object-cover" />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-astro-primary to-astro-accent flex items-center justify-center text-white text-xs font-bold shadow-lg">
                                    {displayName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            {profile.isPremium && (
                                <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black text-[8px] font-bold px-1.5 py-0.5 rounded-full border border-astro-bg shadow-sm z-10">
                                    PRO
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    // Back Button on Sub-pages
                    <button 
                        onClick={onBack}
                        className="w-9 h-9 flex items-center justify-center text-astro-text hover:text-astro-highlight transition-colors"
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
                     {isHub ? 'ASTROT' : getText(profile.language, `nav.${view}`)}
                 </h1>
            </div>

            {/* Right Side - Settings Icon */}
            <div className="flex justify-end w-20">
                {isHub ? (
                    <button 
                        onClick={onOpenSettings}
                        className="w-9 h-9 flex items-center justify-center text-astro-subtext hover:text-astro-text transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </button>
                ) : (
                    // Empty div to balance layout on sub-pages
                    <div className="w-9"></div>
                )}
            </div>
        </header>
    );
};
