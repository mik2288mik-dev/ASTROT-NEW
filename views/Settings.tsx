
import React, { useState, useEffect } from 'react';
import { UserProfile, Language, Theme } from '../types';
import { getText } from '../constants';
import { saveProfile } from '../services/storageService';
import { requestStarsPayment } from '../services/telegramService';
import { getWeatherSettings, saveWeatherCity } from '../services/weatherService';
import { ScreenShell, AIR_GLASS_PANEL_CLASS } from '../components/layout/ScreenShell';

interface SettingsProps {
    profile: UserProfile;
    onUpdate: (profile: UserProfile) => void;
    onShowPremiumPreview?: () => void;
    onOpenAdmin?: () => void;
    onOpenCharts?: () => void;
    onOpenWallet?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ profile, onUpdate, onShowPremiumPreview, onOpenAdmin, onOpenCharts, onOpenWallet }) => {
    const [editing, setEditing] = useState(false);
    const [tempName, setTempName] = useState(profile.name);
    const [tempPlace, setTempPlace] = useState(profile.birthPlace);
    const [editingWeather, setEditingWeather] = useState(false);
    const [tempWeatherCity, setTempWeatherCity] = useState('');
    const [currentWeatherCity, setCurrentWeatherCity] = useState<string | null>(null);
    const [weatherLoading, setWeatherLoading] = useState(false);
    const sectionClass = 'lumia-glass rounded-2xl p-4 sm:p-[18px]';
    const rowCardClass =
        'lumia-glass w-full rounded-2xl p-4 text-left transition-[transform,box-shadow] hover:ring-1 hover:ring-astro-highlight/22 active:scale-[0.99] sm:p-[18px]';
    const inlineActionClass = 'text-astro-subtext text-[10px] uppercase tracking-wider hover:text-astro-text transition-colors';
    const inputBaseClass = 'w-full bg-transparent border-b border-astro-border py-2 text-astro-text text-sm focus:outline-none focus:border-astro-highlight transition-colors font-serif';
    const editableInputClass = (enabled: boolean) =>
        `w-full bg-transparent border-b ${enabled ? 'border-astro-highlight' : 'border-astro-border'} py-2 text-astro-text text-sm focus:outline-none transition-colors font-serif`;
    const languageLabel = profile.language === 'ru'
        ? getText(profile.language, 'settings.language_ru')
        : getText(profile.language, 'settings.language_en');

    // Загружаем настройки погоды из БД при монтировании
    useEffect(() => {
        if (profile.id) {
            getWeatherSettings(profile.id)
                .then(settings => {
                    setCurrentWeatherCity(settings.city);
                    setTempWeatherCity(settings.city || '');
                })
                .catch(console.error);
        }
    }, [profile.id]);

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

    const handlePremiumPurchase = async () => {
        if (profile.isPremium) return;
        
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

    const handleSaveWeatherCity = async () => {
        if (!profile.id) return;
        
        const city = tempWeatherCity.trim();
        setWeatherLoading(true);
        
        console.log('[Settings] Saving weather city:', city || 'null');

        try {
            // Сохраняем через новый API (в таблицу user_settings)
            const cityToSave = city.length >= 2 ? city : null;
            await saveWeatherCity(profile.id, cityToSave);
            
            // Обновляем локальное состояние
            setCurrentWeatherCity(cityToSave);
            
            // Обновляем профиль для обновления UI в других компонентах
            const updated = { ...profile, weatherCity: cityToSave || undefined };
            onUpdate(updated);
            
            console.log('[Settings] Weather city saved successfully');
            setEditingWeather(false);
        } catch (error: any) {
            console.error('[Settings] Error saving weather city:', error);

            alert(getText(profile.language, 'settings.weather_error'));
        } finally {
            setWeatherLoading(false);
        }
    };

    return (
        <ScreenShell className="mx-auto max-w-reading-wide pt-2">
            <section className={sectionClass}>
                <p className="lumia-label tracking-[0.2em]">{getText(profile.language, 'settings.subscription')}</p>
                <h2 className="mt-1.5 font-serif text-xl text-astro-text sm:text-2xl">
                    {profile.isPremium ? getText(profile.language, 'settings.plan_pro') : getText(profile.language, 'settings.plan_basic')}
                </h2>
                <p className="lumia-muted mt-2 text-sm leading-relaxed">
                    {getText(profile.language, 'settings.subscription_body')}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        onClick={handlePremiumPurchase}
                        disabled={profile.isPremium}
                        className="min-h-[44px] flex-1 rounded-xl bg-astro-highlight px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_0_1px_color-mix(in_srgb,var(--highlight)_35%,transparent)_inset] disabled:opacity-50"
                    >
                        {profile.isPremium ? getText(profile.language, 'settings.plan_active') : getText(profile.language, 'dashboard.get_premium')}
                    </button>
                    {!profile.isPremium && onShowPremiumPreview && (
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

            {onOpenWallet && (
                <button onClick={onOpenWallet} className={rowCardClass}>
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="font-serif text-lg text-astro-text">
                                {getText(profile.language, 'settings.wallet_title')}
                            </h3>
                            <p className="lumia-muted mt-1 text-sm">{getText(profile.language, 'settings.wallet_body')}</p>
                        </div>
                        <span className="rounded-full bg-astro-highlight/14 px-3 py-1 text-sm font-medium text-astro-highlight ring-1 ring-astro-highlight/20">
                            {profile.lumiBalance ?? 0} Lumi
                        </span>
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
                        <h3 className="font-serif text-lg text-astro-text">{getText(profile.language, 'settings.weather_title')}</h3>
                        <p className="lumia-muted mt-1 text-sm">{getText(profile.language, 'settings.weather_body')}</p>
                    </div>
                    {!editingWeather && (
                        <button
                            onClick={() => setEditingWeather(true)}
                            className={inlineActionClass}
                        >
                            {getText(profile.language, 'settings.edit_inline')}
                        </button>
                    )}
                </div>

                {editingWeather ? (
                    <div className="mt-4 space-y-3">
                        <div>
                            <label className="mb-2 block text-[10px] uppercase tracking-widest text-astro-subtext">
                                {getText(profile.language, 'settings.weather_city')}
                            </label>
                            <input 
                                type="text" 
                                value={tempWeatherCity}
                                onChange={(e) => setTempWeatherCity(e.target.value)}
                                placeholder={getText(profile.language, 'settings.weather_placeholder')}
                                className={inputBaseClass}
                                disabled={weatherLoading}
                                minLength={2}
                                maxLength={64}
                            />
                            <p className="lumia-muted mt-2 text-[11px] leading-relaxed">{getText(profile.language, 'settings.weather_helper')}</p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleSaveWeatherCity}
                                disabled={weatherLoading || (tempWeatherCity.trim().length > 0 && tempWeatherCity.trim().length < 2)}
                                className="flex-1 rounded-xl bg-astro-highlight px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                            >
                                {weatherLoading ? getText(profile.language, 'settings.saving') : getText(profile.language, 'settings.save')}
                            </button>
                            <button 
                                onClick={() => {
                                    setEditingWeather(false);
                                    setTempWeatherCity(currentWeatherCity || '');
                                }}
                                disabled={weatherLoading}
                                className="rounded-xl bg-astro-text/[0.06] px-4 py-2.5 text-sm font-medium text-astro-text ring-1 ring-astro-text/[0.06] transition-[box-shadow] hover:ring-astro-highlight/25 disabled:opacity-50"
                            >
                                {getText(profile.language, 'settings.cancel')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="lumia-glass-inset mt-4 p-3.5">
                        <p className="font-serif text-base text-astro-text">
                            {currentWeatherCity || getText(profile.language, 'settings.weather_empty')}
                        </p>
                        <p className="lumia-muted mt-1.5 text-sm leading-relaxed">
                            {currentWeatherCity ? getText(profile.language, 'settings.weather_ready') : getText(profile.language, 'settings.weather_helper')}
                        </p>
                    </div>
                )}
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
                                className="flex-1 rounded-xl bg-astro-highlight px-4 py-3 text-sm font-semibold text-white"
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
