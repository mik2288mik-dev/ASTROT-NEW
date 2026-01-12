import React from 'react';
import { UserProfile, ViewState } from '../types';

interface HeaderProps {
    profile: UserProfile | null;
    view: ViewState;
    onOpenSettings: () => void;
    onBack: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, view, onBack }) => {
    if (!profile) return null;

    const isHub = view === 'dashboard';
    const isFunnel = view === 'onboarding' || view === 'hook' || view === 'paywall';

    if (isFunnel) return null;

    // Получаем название текущего раздела
    const getViewTitle = () => {
        const titles: Record<string, { ru: string; en: string }> = {
            chart: { ru: 'Натальная карта', en: 'Natal Chart' },
            horoscope: { ru: 'Гороскоп', en: 'Horoscope' },
            oracle: { ru: 'Оракул', en: 'Oracle' },
            synastry: { ru: 'Совместимость', en: 'Synastry' },
            settings: { ru: 'Настройки', en: 'Settings' },
            admin: { ru: 'Админ', en: 'Admin' },
            dashboard: { ru: 'ASTROT', en: 'ASTROT' },
        };
        return titles[view]?.[profile.language] || 'ASTROT';
    };

    return (
        <header 
            className="bg-astro-bg border-b border-astro-border/50 shrink-0 relative z-40"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
            <div className="h-14 flex items-center justify-between px-4">
                {/* Left - Back button */}
                <div className="w-16 flex items-center">
                    {!isHub && (
                        <button 
                            onClick={onBack}
                            className="flex items-center gap-1 text-astro-highlight active:opacity-70 transition-opacity"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="text-sm font-medium">
                                {profile.language === 'ru' ? 'Назад' : 'Back'}
                            </span>
                        </button>
                    )}
                </div>

                {/* Center - Title */}
                <div className="flex-1 text-center">
                    <h1 className={`font-semibold text-astro-text ${isHub ? 'text-xl font-serif tracking-tight' : 'text-base'}`}>
                        {getViewTitle()}
                    </h1>
                </div>

                {/* Right - Placeholder for balance */}
                <div className="w-16"></div>
            </div>
        </header>
    );
};
