import React from 'react';
import { UserProfile, ViewState } from '../types';
import { getText } from '../constants';
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
    /** Lumia Studio AIR hub — own top bar (LUMIA + gear + lock), no global header */
    if (isHub) return null;

    const hasLumi = typeof profile.lumiBalance === 'number';
    const lumiValue = Math.max(0, profile.lumiBalance ?? 0);

    const getViewTitle = () => {
        const titles: Record<string, { ru: string; en: string }> = {
            chart: { ru: 'Натальная карта', en: 'Natal Chart' },
            charts: { ru: 'Мои карты', en: 'My Charts' },
            horoscope: { ru: 'Гороскоп', en: 'Horoscope' },
            oracle: { ru: 'Спросить Lumia', en: 'Ask Lumia' },
            synastry: { ru: 'Совместимость', en: 'Synastry' },
            wallet: { ru: 'Кошелёк Lumi', en: 'Lumi Wallet' },
            settings: { ru: 'Настройки', en: 'Settings' },
            admin: { ru: 'Админ-панель', en: 'Admin Panel' },
            dashboard: { ru: 'Lumia', en: 'Lumia' },
        };
        return titles[view]?.[profile.language] || 'Lumia';
    };

    return (
        <header className="lumia-tg-header-bar shrink-0 relative z-40 border-b border-astro-border/40 bg-astro-bg/72 backdrop-blur-xl backdrop-saturate-150">
            <div className="pt-1 pb-2.5">
                <div className="grid min-h-[44px] grid-cols-[minmax(2.75rem,auto)_minmax(0,1fr)_minmax(2.75rem,auto)] items-center gap-2">
                    <div className="flex min-w-0 items-center justify-start">
                        {!isHub && (
                            <button
                                onClick={onBack}
                                type="button"
                                className="flex min-h-[44px] min-w-[44px] items-center gap-1 rounded-lg pr-1 text-astro-subtext hover:text-astro-text active:opacity-70 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                <span className="max-[360px]:hidden text-xs font-medium tracking-wide">
                                    {getText(profile.language, 'header.back')}
                                </span>
                            </button>
                        )}
                    </div>

                    <div className="flex min-w-0 items-center justify-center px-1">
                        <h1 className="w-full truncate text-center font-outfit text-[15px] font-semibold leading-tight tracking-tight text-astro-text">
                            {getViewTitle()}
                        </h1>
                    </div>

                    <div className="flex min-w-0 items-center justify-end">
                        {!isHub && hasLumi && (
                            <button
                                type="button"
                                onClick={onOpenWallet}
                                aria-label={getText(profile.language, 'header.wallet')}
                                className="relative inline-flex h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full border border-astro-border/70 bg-astro-card/60 text-astro-subtext transition-colors hover:border-astro-highlight/35 hover:text-astro-text"
                            >
                                <span className="text-sm leading-none">✦</span>
                                <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full border border-astro-bg bg-astro-highlight px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white">
                                    {lumiValue}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};
