
import React, { useState, useEffect } from 'react';
import { UserProfile, Language, Theme } from '../types';
import { getText } from '../constants';
import { saveProfile } from '../services/storageService';
import { requestStarsPayment } from '../services/telegramService';
import { getWeatherSettings, saveWeatherCity } from '../services/weatherService';

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
    const sectionClass = 'rounded-[24px] border border-astro-border/80 bg-astro-card/60 p-5';
    const rowCardClass = 'w-full rounded-[24px] border border-astro-border/80 bg-astro-card/55 p-5 text-left transition-colors hover:border-astro-highlight/35';
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
        <div className="mx-auto max-w-2xl px-5 py-6 space-y-5 screen-pb">
            <section className="rounded-[24px] border border-astro-border/80 bg-gradient-to-b from-astro-card to-astro-card/65 p-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                    {getText(profile.language, 'settings.subscription')}
                </p>
                <h2 className="mt-2 font-serif text-2xl text-astro-text">
                    {profile.isPremium ? getText(profile.language, 'settings.plan_pro') : getText(profile.language, 'settings.plan_basic')}
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-astro-subtext">
                    {getText(profile.language, 'settings.subscription_body')}
                </p>

                <div className="mt-5 flex gap-2">
                    <button
                        onClick={handlePremiumPurchase}
                        disabled={profile.isPremium}
                        className="flex-1 rounded-xl bg-astro-highlight px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        {profile.isPremium ? getText(profile.language, 'settings.plan_active') : getText(profile.language, 'dashboard.get_premium')}
                    </button>
                    {!profile.isPremium && onShowPremiumPreview && (
                        <button
                            onClick={onShowPremiumPreview}
                            className="rounded-xl border border-astro-border/80 px-4 py-3 text-sm font-medium text-astro-text transition-colors hover:border-astro-highlight/35"
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
                            <p className="mt-1 text-sm text-astro-subtext">
                                {getText(profile.language, 'settings.charts_body')}
                            </p>
                        </div>
                        <span className="text-astro-subtext">→</span>
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
                            <p className="mt-1 text-sm text-astro-subtext">
                                {getText(profile.language, 'settings.wallet_body')}
                            </p>
                        </div>
                        <span className="rounded-full border border-astro-highlight/25 bg-astro-highlight/10 px-3 py-1 text-sm font-medium text-astro-highlight">
                            {profile.lumiBalance ?? 0} Lumi
                        </span>
                    </div>
                </button>
            )}

            <div className={`${sectionClass} flex items-center justify-between gap-4`}>
                <div>
                    <h3 className="font-serif text-lg text-astro-text">{getText(profile.language, 'settings.theme')}</h3>
                    <p className="mt-1 text-sm text-astro-subtext">{getText(profile.language, 'settings.theme_body')}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-astro-subtext">
                        {profile.theme === 'light' ? getText(profile.language, 'settings.theme_light') : getText(profile.language, 'settings.theme_dark')}
                    </p>
                </div>
                <div className="flex rounded-xl border border-astro-border bg-astro-bg/30 p-1">
                    <button 
                        onClick={() => handleThemeToggle('dark')}
                        className={`rounded-lg p-2 transition-colors ${profile.theme === 'dark' ? 'bg-astro-card text-white shadow-sm border border-white/10' : 'text-astro-subtext'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    </button>
                    <button 
                        onClick={() => handleThemeToggle('light')}
                        className={`rounded-lg p-2 transition-colors ${profile.theme === 'light' ? 'bg-white text-black shadow-sm border border-black/10' : 'text-astro-subtext'}`}
                        aria-label="Light theme"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M12 6a6 6 0 110 12 6 6 0 010-12z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className={`${sectionClass} flex items-center justify-between gap-4`}>
                <div>
                    <h3 className="font-serif text-lg text-astro-text">{getText(profile.language, 'settings.language')}</h3>
                    <p className="mt-1 text-sm text-astro-subtext">{getText(profile.language, 'settings.language_body')}</p>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-astro-subtext">{languageLabel}</p>
                </div>
                <button 
                    onClick={handleLanguageToggle}
                    className="rounded-xl border border-astro-border/80 px-4 py-2 text-sm font-medium text-astro-text transition-colors hover:border-astro-highlight/35"
                >
                    {getText(profile.language, 'settings.switch_lang')}
                </button>
            </div>

            <div className={sectionClass}>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="font-serif text-lg text-astro-text">{getText(profile.language, 'settings.weather_title')}</h3>
                        <p className="mt-1 text-sm text-astro-subtext">{getText(profile.language, 'settings.weather_body')}</p>
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
                    <div className="mt-5 space-y-4">
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
                            <p className="mt-2 text-[11px] leading-relaxed text-astro-subtext">
                                {getText(profile.language, 'settings.weather_helper')}
                            </p>
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
                                className="rounded-xl border border-astro-border/80 px-4 py-3 text-sm font-medium text-astro-text transition-colors hover:border-astro-highlight/35 disabled:opacity-50"
                            >
                                {getText(profile.language, 'settings.cancel')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-5 rounded-2xl border border-astro-border/70 bg-astro-bg/20 p-4">
                        <p className="font-serif text-base text-astro-text">
                            {currentWeatherCity || getText(profile.language, 'settings.weather_empty')}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
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

                <div className="mt-5 space-y-5">
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
                                className="rounded-xl border border-astro-border/80 px-4 py-3 text-sm font-medium text-astro-text transition-colors hover:border-astro-highlight/35"
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
                            <p className="mt-1 text-sm text-astro-subtext">
                                {getText(profile.language, 'settings.admin_body')}
                            </p>
                        </div>
                        <span className="text-astro-subtext">→</span>
                    </div>
                </button>
            )}

            <div className="pt-1 text-center">
                 <button className="text-[10px] uppercase tracking-widest text-astro-subtext transition-colors hover:text-astro-text">
                     {getText(profile.language, 'settings.restore')}
                 </button>
            </div>
        </div>
    );
};
