
import React, { useState, useEffect } from 'react';
import { UserProfile, Language, Theme, NotificationFrequency } from '../types';
import { getText } from '../constants';
import { saveProfile } from '../services/storageService';
import { requestStarsPayment } from '../services/telegramService';
import { ScreenShell } from '../components/layout/ScreenShell';
import { hasActivePremium } from '../lib/accessMatrix';

interface SettingsProps {
    profile: UserProfile;
    onUpdate: (profile: UserProfile) => void;
    onShowPremiumPreview?: () => void;
    onOpenAdmin?: () => void;
    onOpenCharts?: () => void;
}

const NOTIFICATION_FREQUENCIES: NotificationFrequency[] = ['quiet', 'important', 'daily', 'twice_daily'];

const notificationLabels: Record<NotificationFrequency, { ru: string; en: string; ruBody: string; enBody: string }> = {
    quiet: {
        ru: 'Тихо',
        en: 'Quiet',
        ruBody: 'Без ежедневных напоминаний.',
        enBody: 'No daily reminders.',
    },
    important: {
        ru: 'Только важное',
        en: 'Important only',
        ruBody: 'Луна, события и сильные личные акценты.',
        enBody: 'Moon, events, and strong personal accents.',
    },
    daily: {
        ru: 'Каждый день',
        en: 'Every day',
        ruBody: 'Один теплый фокус дня.',
        enBody: 'One warm daily focus.',
    },
    twice_daily: {
        ru: 'Утро + вечер',
        en: 'Morning + evening',
        ruBody: 'Мягкий старт и спокойное закрытие дня.',
        enBody: 'A soft start and calm close.',
    },
};

const notificationPreferenceKey = (userId?: string) => `lumia.notificationFrequency.${userId || 'anonymous'}`;

function readStoredNotificationFrequency(userId?: string): NotificationFrequency | null {
    if (typeof window === 'undefined') return null;
    try {
        const value = window.localStorage.getItem(notificationPreferenceKey(userId));
        return NOTIFICATION_FREQUENCIES.includes(value as NotificationFrequency) ? (value as NotificationFrequency) : null;
    } catch {
        return null;
    }
}

function storeNotificationFrequency(userId: string | undefined, frequency: NotificationFrequency) {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(notificationPreferenceKey(userId), frequency);
    } catch {
        /* Preference remains in memory for the current session. */
    }
}

export const Settings: React.FC<SettingsProps> = ({ profile, onUpdate, onShowPremiumPreview, onOpenAdmin, onOpenCharts }) => {
    const [tgUser, setTgUser] = useState<{ first_name?: string; last_name?: string; photo_url?: string } | null>(null);
    const [editing, setEditing] = useState(false);
    const [tempName, setTempName] = useState(profile.name);
    const [tempPlace, setTempPlace] = useState(profile.birthPlace);
    const [notificationFrequency, setNotificationFrequency] = useState<NotificationFrequency>(
        profile.notificationFrequency || 'important'
    );
    const sectionClass = 'rounded-mono-card border border-mono-line bg-mono-white p-4 sm:p-[18px]';
    const rowCardClass =
        'w-full rounded-mono-card border border-mono-line bg-mono-white p-4 text-left transition-transform active:scale-[0.99] sm:p-[18px]';
    const inlineActionClass = 'text-mono-muted text-[10px] uppercase tracking-wider hover:text-mono-ink transition-colors';
    const inputBaseClass = 'w-full bg-transparent border-b border-mono-line py-2 text-mono-ink text-sm focus:outline-none focus:border-mono-ink transition-colors';
    const editableInputClass = (enabled: boolean) =>
        `w-full bg-transparent border-b ${enabled ? 'border-astro-highlight' : 'border-astro-border'} py-2 text-astro-text text-sm focus:outline-none transition-colors font-serif`;
    const languageLabel = profile.language === 'ru'
        ? getText(profile.language, 'settings.language_ru')
        : getText(profile.language, 'settings.language_en');
    const activePremium = hasActivePremium(profile);

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            setTgUser(tg.initDataUnsafe.user);
        }
    }, []);

    useEffect(() => {
        setNotificationFrequency(
            readStoredNotificationFrequency(profile.id) || profile.notificationFrequency || 'important'
        );
    }, [profile.id, profile.notificationFrequency]);

    const profileDisplayName = (() => {
        const u = tgUser;
        const fromTg = [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim();
        return fromTg || profile.name || '—';
    })();
    const profilePhotoUrl = tgUser?.photo_url;


    const handleLanguageToggle = () => {
        const newLang: Language = profile.language === 'ru' ? 'en' : 'ru';
        const updated = { ...profile, language: newLang };
        console.log('[Settings] Language changed to:', newLang);
        onUpdate(updated);
        saveProfile(updated).catch(error => {
            console.error('[Settings] Failed to save language:', error);
        });
    };

    const handleThemeToggle = (newTheme: Theme) => {
        const updated = { ...profile, theme: newTheme };
        console.log('[Settings] Theme changed to:', newTheme);
        onUpdate(updated);
        saveProfile(updated).catch(error => {
            console.error('[Settings] Failed to save theme:', error);
        });
    };

    const handleNotificationFrequencyChange = (frequency: NotificationFrequency) => {
        setNotificationFrequency(frequency);
        storeNotificationFrequency(profile.id, frequency);
        const updated = { ...profile, notificationFrequency: frequency };
        onUpdate(updated);
        saveProfile(updated).catch(error => {
            console.error('[Settings] Failed to save notification preference:', error);
        });
    };

    const handlePremiumPurchase = async () => {
        if (activePremium) return;
        
        console.log('[Settings] Starting premium purchase...');
        const success = await requestStarsPayment(profile);
        if (success) {
            console.log('[Settings] Premium purchase successful');
            const updated = { ...profile, isPremium: true };
            onUpdate(updated);
            try {
                await saveProfile(updated);
                console.log('[Settings] Premium status saved');
            } catch (error) {
                console.error('[Settings] Failed to save premium status:', error);
            }
        } else {
            console.log('[Settings] Premium purchase cancelled');
        }
    };

    const handleSaveProfile = () => {
        const updated = { ...profile, name: tempName, birthPlace: tempPlace };
        console.log('[Settings] Saving profile changes:', {
            name: tempName,
            birthPlace: tempPlace
        });
        onUpdate(updated);
        saveProfile(updated).then(() => {
            console.log('[Settings] Profile saved successfully');
        }).catch(error => {
            console.error('[Settings] Failed to save profile:', error);
        });
        setEditing(false);
    };


    return (
        <ScreenShell className="mx-auto max-w-reading-wide pt-2">
            <section className="rounded-mono-card border border-mono-line bg-mono-white p-5 mb-4">
                <div className="flex items-center gap-4">
                    {profilePhotoUrl ? (
                        <img
                            src={profilePhotoUrl}
                            alt=""
                            className="h-16 w-16 shrink-0 rounded-full object-cover border border-black/5"
                        />
                    ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-xl font-serif text-text-muted">
                            {profileDisplayName.charAt(0).toUpperCase() || '?'}
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="serif text-2xl font-medium text-text-main truncate">{profileDisplayName}</p>
                        {profile.id && (
                            <p className="mt-0.5 text-xs text-text-muted/80">
                                Telegram · ID {profile.id}
                            </p>
                        )}
                    </div>
                </div>
            </section>

            <section className={sectionClass}>
                <p className="lumia-label tracking-[0.2em]">{getText(profile.language, 'settings.subscription')}</p>
                <h2 className="mt-1.5 font-serif text-xl text-astro-text sm:text-2xl">
                    {activePremium ? getText(profile.language, 'settings.plan_pro') : getText(profile.language, 'settings.plan_basic')}
                </h2>
                <p className="lumia-muted mt-2 text-sm leading-relaxed">
                    {getText(profile.language, 'settings.subscription_body')}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        onClick={handlePremiumPurchase}
                        disabled={activePremium}
                        className="min-h-[44px] flex-1 rounded-mono-pill bg-mono-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        {activePremium ? getText(profile.language, 'settings.plan_active') : getText(profile.language, 'dashboard.get_premium')}
                    </button>
                    {!activePremium && onShowPremiumPreview && (
                        <button
                            onClick={onShowPremiumPreview}
                            type="button"
                            className="min-h-[44px] rounded-xl bg-astro-text/[0.06] px-4 py-2.5 text-sm font-medium text-astro-text transition-[box-shadow] hover:ring-1 hover:ring-astro-highlight/25"
                        >
                            Lumia Premium
                        </button>
                    )}
                </div>
            </section>

            {onOpenCharts && (
                <button onClick={onOpenCharts} className={rowCardClass}>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="font-serif text-lg text-astro-text">
                                {getText(profile.language, 'settings.charts_title')}
                            </h3>
                            <p className="lumia-muted mt-1 text-sm">{getText(profile.language, 'settings.charts_body')}</p>
                        </div>
                        <span className="text-astro-subtext/70">→</span>
                    </div>
                </button>
            )}

            <div className={`${sectionClass} flex items-center justify-between gap-3`}>
                <div className="min-w-0 pr-2">
                    <h3 className="font-serif text-lg text-astro-text">{getText(profile.language, 'settings.theme')}</h3>
                    <p className="lumia-muted mt-1 text-sm leading-snug">{getText(profile.language, 'settings.theme_body')}</p>
                    <p className="lumia-label mt-1.5 tracking-wider">
                        {profile.theme === 'light' ? getText(profile.language, 'settings.theme_light') : getText(profile.language, 'settings.theme_dark')}
                    </p>
                </div>
                <div className="flex shrink-0 rounded-xl bg-astro-text/[0.06] p-0.5 ring-1 ring-astro-text/[0.05]">
                    <button 
                        type="button"
                        onClick={() => handleThemeToggle('dark')}
                        className={`rounded-lg p-2 transition-colors ${profile.theme === 'dark' ? 'bg-astro-card/90 text-white shadow-sm ring-1 ring-white/12' : 'text-astro-subtext'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    </button>
                    <button 
                        type="button"
                        onClick={() => handleThemeToggle('light')}
                        className={`rounded-lg p-2 transition-colors ${profile.theme === 'light' ? 'bg-white text-black shadow-sm ring-1 ring-black/8' : 'text-astro-subtext'}`}
                        aria-label="Light theme"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M12 6a6 6 0 110 12 6 6 0 010-12z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className={`${sectionClass} flex items-center justify-between gap-3`}>
                <div className="min-w-0 pr-2">
                    <h3 className="font-serif text-lg text-astro-text">{getText(profile.language, 'settings.language')}</h3>
                    <p className="lumia-muted mt-1 text-sm leading-snug">{getText(profile.language, 'settings.language_body')}</p>
                    <p className="lumia-label mt-1.5 tracking-wider">{languageLabel}</p>
                </div>
                <button 
                    type="button"
                    onClick={handleLanguageToggle}
                    className="shrink-0 rounded-xl bg-astro-text/[0.06] px-3.5 py-2 text-sm font-medium text-astro-text ring-1 ring-astro-text/[0.06] transition-[box-shadow] hover:ring-astro-highlight/28"
                >
                    {getText(profile.language, 'settings.switch_lang')}
                </button>
            </div>

            <div className={sectionClass}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="font-serif text-lg text-astro-text">
                            {profile.language === 'en' ? 'Notifications' : 'Оповещения'}
                        </h3>
                        <p className="lumia-muted mt-1 text-sm leading-snug">
                            {profile.language === 'en'
                                ? 'Choose how often Lumia should bring you back to the day.'
                                : 'Выбери, как часто Lumia будет возвращать тебя к дню.'}
                        </p>
                    </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2">
                    {NOTIFICATION_FREQUENCIES.map((frequency) => {
                        const label = notificationLabels[frequency];
                        const active = notificationFrequency === frequency;
                        return (
                            <button
                                key={frequency}
                                type="button"
                                aria-pressed={active}
                                onClick={() => handleNotificationFrequencyChange(frequency)}
                                className={`rounded-2xl px-4 py-3 text-left transition-[background,box-shadow,transform] active:scale-[0.99] ${
                                    active
                                        ? 'bg-astro-text text-white shadow-sm ring-1 ring-astro-text/10'
                                        : 'bg-white/56 text-astro-text ring-1 ring-black/[0.05] hover:bg-white/78'
                                }`}
                            >
                                <span className="block text-sm font-semibold">
                                    {profile.language === 'en' ? label.en : label.ru}
                                </span>
                                <span className={`mt-1 block text-xs leading-relaxed ${active ? 'text-white/72' : 'text-text-muted'}`}>
                                    {profile.language === 'en' ? label.enBody : label.ruBody}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={sectionClass}>
                <div className="flex items-start justify-between gap-4">
                    <h3 className="font-serif text-lg text-astro-text">{getText(profile.language, 'settings.profile')}</h3>
                    {!editing && (
                        <button onClick={() => setEditing(true)} className={inlineActionClass}>
                            {getText(profile.language, 'settings.edit')}
                        </button>
                    )}
                </div>

                <div className="mt-4 space-y-4">
                    <div>
                        <label className="mb-2 block text-[10px] uppercase tracking-widest text-astro-subtext">
                            {getText(profile.language, 'settings.profile_name')}
                        </label>
                        <input 
                            type="text" 
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            disabled={!editing}
                            className={editableInputClass(editing)}
                        />
                    </div>
                    <div>
                        <label className="mb-2 block text-[10px] uppercase tracking-widest text-astro-subtext">
                            {getText(profile.language, 'settings.profile_birth_place')}
                        </label>
                        <input 
                            type="text" 
                            value={tempPlace}
                            onChange={(e) => setTempPlace(e.target.value)}
                            disabled={!editing}
                            className={editableInputClass(editing)}
                        />
                    </div>
                    <div>
                         <label className="mb-2 block text-[10px] uppercase tracking-widest text-astro-subtext">
                             {getText(profile.language, 'settings.profile_date_time')}
                         </label>
                         <p className="text-sm font-serif text-astro-text/75">
                             {profile.birthDate} • {profile.birthTime}
                         </p>
                    </div>

                    {editing && (
                        <div className="flex gap-2">
                            <button 
                                onClick={handleSaveProfile}
                                className="flex-1 rounded-mono-pill bg-mono-black px-4 py-3 text-sm font-semibold text-white"
                            >
                                {getText(profile.language, 'settings.save')}
                            </button>
                            <button
                                onClick={() => {
                                    setEditing(false);
                                    setTempName(profile.name);
                                    setTempPlace(profile.birthPlace);
                                }}
                                className="rounded-xl bg-astro-text/[0.06] px-4 py-2.5 text-sm font-medium text-astro-text ring-1 ring-astro-text/[0.06] transition-[box-shadow] hover:ring-astro-highlight/25"
                            >
                                {getText(profile.language, 'settings.cancel')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {profile.isAdmin && onOpenAdmin && (
                <button onClick={onOpenAdmin} className={rowCardClass}>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="font-serif text-lg text-astro-text">
                                {getText(profile.language, 'settings.admin')}
                            </h3>
                            <p className="lumia-muted mt-1 text-sm">{getText(profile.language, 'settings.admin_body')}</p>
                        </div>
                        <span className="text-astro-subtext/70">→</span>
                    </div>
                </button>
            )}

            <div className="pt-1 text-center">
                 <button type="button" className="min-h-[44px] px-3 text-[10px] uppercase tracking-widest text-astro-subtext transition-colors hover:text-astro-text">
                     {getText(profile.language, 'settings.restore')}
                 </button>
            </div>
        </ScreenShell>
    );
};
