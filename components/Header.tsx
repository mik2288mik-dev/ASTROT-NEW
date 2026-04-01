import React from 'react';
import { UserProfile, ViewState } from '../types';
import { getText } from '../constants';
import { LumiaLogo } from './brand/LumiaLogo';

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
        <header
            className="shrink-0 relative z-40 border-b border-astro-border/40 bg-astro-bg/72 backdrop-blur-xl backdrop-saturate-150"
            style={{
                paddingTop: 'max(env(safe-area-inset-top, 0px), 8px)',
                paddingLeft: 'env(safe-area-inset-left, 0px)',
                paddingRight: 'env(safe-area-inset-right, 0px)',
            }}
        >
            <div className="px-4 pt-1 pb-2.5">
                <div className="h-11 flex items-center justify-between">
                    <div className="w-20 flex items-center">
                        {!isHub && (
                            <button
                                onClick={onBack}
                                type="button"
                                className="flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-lg px-2 -ml-2 text-astro-subtext hover:text-astro-text active:opacity-70 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                                </svg>
                                <span className="text-xs font-medium tracking-wide">
                                    {getText(profile.language, 'header.back')}
                                </span>
                            </button>
                        )}
                    </div>

                    <div className="flex flex-1 items-center justify-center gap-2 min-w-0">
                        {isHub ? (
                            <LumiaLogo variant="row" className="justify-center scale-[0.92] sm:scale-100" />
                        ) : (
                            <h1 className="truncate text-center text-[15px] font-semibold text-astro-text">
                                {getViewTitle()}
                            </h1>
                        )}
                    </div>

                    <div className="w-20 flex justify-end">
                        {!isHub && hasLumi && (
                            <button
                                type="button"
                                onClick={onOpenWallet}
                                aria-label={getText(profile.language, 'header.wallet')}
                                className="relative inline-flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-astro-border/70 bg-astro-card/60 text-astro-subtext transition-colors hover:border-astro-highlight/35 hover:text-astro-text"
                            >
                                <span className="text-sm leading-none">✦</span>
                                <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full border border-astro-bg bg-astro-highlight px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white">
                                    {lumiValue}
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                {isHub && (
                    <div className="mt-1.5 flex justify-center">
                        <button
                            type="button"
                            onClick={onOpenWallet}
                            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-astro-border/70 bg-astro-card/60 px-4 py-2 text-xs font-medium text-astro-text shadow-sm transition-colors hover:border-astro-highlight/35 hover:bg-astro-card/80"
                        >
                            <span className="text-yellow-400 text-sm leading-none">✦</span>
                            <span>{lumiValue} Lumi</span>
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};
