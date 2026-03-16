import React from 'react';
import { UserProfile, ViewState } from '../types';

interface HeaderProps {
    profile: UserProfile | null;
    view: ViewState;
    onOpenSettings: () => void;
    onBack: () => void;
    onOpenWallet: () => void;
}

export const Header: React.FC<HeaderProps> = ({ profile, view, onBack, onOpenWallet }) => {
    if (!profile) return null;

    const isHub = view === 'dashboard';
    const isFunnel = view === 'onboarding' || view === 'hook' || view === 'paywall';

    if (isFunnel) return null;

    const getViewTitle = () => {
        const titles: Record<string, { ru: string; en: string }> = {
            chart: { ru: 'Натальная карта', en: 'Natal Chart' },
            charts: { ru: 'Мои карты', en: 'My Charts' },
            horoscope: { ru: 'Гороскоп', en: 'Horoscope' },
            oracle: { ru: 'Оракул', en: 'Oracle' },
            synastry: { ru: 'Совместимость', en: 'Synastry' },
            wallet: { ru: 'Lumi Wallet', en: 'Lumi Wallet' },
            settings: { ru: 'Настройки', en: 'Settings' },
            admin: { ru: 'Админ', en: 'Admin' },
            dashboard: { ru: 'Lumia', en: 'Lumia' },
        };
        return titles[view]?.[profile.language] || 'Lumia';
    };

    return (
        <header
            className="bg-astro-bg border-b border-astro-border/50 shrink-0 relative z-40"
            style={{
                paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)',
                paddingLeft: 'env(safe-area-inset-left, 0px)',
                paddingRight: 'env(safe-area-inset-right, 0px)',
            }}
        >
            <div className="px-4 pt-1 pb-3">
                <div className="h-12 flex items-center justify-between">
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

                    <div className="flex-1 text-center">
                        <h1 className={`font-semibold text-astro-text ${isHub ? 'text-xl font-serif tracking-tight' : 'text-base'}`}>
                            {getViewTitle()}
                        </h1>
                    </div>

                    <div className="w-16" />
                </div>

                {typeof profile.lumiBalance === 'number' && (
                    <div className="mt-1 flex justify-center">
                        <button
                            onClick={onOpenWallet}
                            className="inline-flex items-center gap-2 rounded-full border border-astro-highlight/30 bg-astro-card/90 px-4 py-2 text-sm font-medium text-astro-text shadow-sm hover:border-astro-highlight/50 hover:bg-astro-card transition-colors"
                        >
                            <span className="text-yellow-400 text-base leading-none">✦</span>
                            <span>{profile.lumiBalance} Lumi</span>
                            <span className="text-xs text-astro-subtext">
                                {profile.language === 'ru' ? 'Кошелёк' : 'Wallet'}
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};
