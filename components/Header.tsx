
import React, { useEffect, useState } from 'react';
import { UserProfile } from '../types';

interface HeaderProps {
    profile: UserProfile | null;
}

export const Header: React.FC<HeaderProps> = ({ profile }) => {
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

    return (
        <header className="bg-astro-bg/80 backdrop-blur-md border-b border-astro-border h-16 shrink-0 flex items-center justify-between px-4 relative z-40">
            
            {/* Left Side - User Info (Shifted down/left to avoid Close button) */}
            <div className="flex items-center gap-3 mt-3 ml-1 transition-all duration-500 ease-out">
                {/* Avatar */}
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
                
                {/* Name */}
                <div className="flex flex-col justify-center">
                    <h1 className="text-xs font-bold text-astro-text font-serif tracking-wide leading-none">
                        {displayName}
                    </h1>
                </div>
            </div>

            {/* Center - ASTROT Title */}
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                 <h1 className="text-3xl font-bold text-astro-text font-serif tracking-tighter drop-shadow-sm">
                     ASTROT
                 </h1>
            </div>

            {/* Right Side - Glowing Star Icon */}
            <div className="flex justify-end w-9 animate-pulse-slow">
                <svg 
                    viewBox="0 0 24 24" 
                    className="w-6 h-6 text-astro-highlight fill-current drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                >
                     <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
                </svg>
            </div>
        </header>
    );
};
