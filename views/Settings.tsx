
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
}

export const Settings: React.FC<SettingsProps> = ({ profile, onUpdate, onShowPremiumPreview, onOpenAdmin, onOpenCharts }) => {
    const [editing, setEditing] = useState(false);
    const [tempName, setTempName] = useState(profile.name);
    const [tempPlace, setTempPlace] = useState(profile.birthPlace);
    const [editingWeather, setEditingWeather] = useState(false);
    const [tempWeatherCity, setTempWeatherCity] = useState('');
    const [currentWeatherCity, setCurrentWeatherCity] = useState<string | null>(null);
    const [weatherLoading, setWeatherLoading] = useState(false);

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
            
            const errorMessage = profile.language === 'ru'
                ? 'Не удалось сохранить город. Попробуйте ещё раз.'
                : 'Failed to save city. Please try again.';
            
            alert(errorMessage);
        } finally {
            setWeatherLoading(false);
        }
    };

    return (
        <div className="p-6 space-y-6 screen-pb">
            <h2 className="text-lg font-semibold text-astro-text font-serif mb-8 w-full text-center">{getText(profile.language, 'settings.title')}</h2>

            {/* Admin Button - Only visible if isAdmin */}
            {profile.isAdmin && onOpenAdmin && (
                <button 
                    onClick={onOpenAdmin}
                    className="w-full bg-red-500/10 border border-red-500 text-red-500 py-3 rounded-lg uppercase text-[10px] tracking-widest font-bold hover:bg-red-500/20 transition-colors mb-4"
                >
                    ! Open Admin Panel
                </button>
            )}

            {/* Subscription Card */}
            <div className="bg-astro-text text-astro-bg p-6 rounded-xl shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-lg font-serif font-bold mb-1">{getText(profile.language, 'settings.subscription')}</h3>
                    <p className="text-xs opacity-80 mb-6 font-medium tracking-wide uppercase">
                        {profile.isPremium ? getText(profile.language, 'settings.plan_pro') : getText(profile.language, 'settings.plan_basic')}
                    </p>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={handlePremiumPurchase}
                            disabled={profile.isPremium}
                            className="flex-1 bg-astro-bg text-astro-text font-bold py-3 px-4 rounded-lg text-[10px] uppercase tracking-widest shadow hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:scale-100"
                        >
                            {profile.isPremium ? getText(profile.language, 'settings.plan_active') : getText(profile.language, 'dashboard.get_premium')}
                        </button>
                        {!profile.isPremium && onShowPremiumPreview && (
                            <button 
                                onClick={onShowPremiumPreview}
                                className="bg-transparent border border-astro-bg text-astro-bg font-bold py-3 px-4 rounded-lg text-[10px] uppercase tracking-widest hover:bg-astro-bg/10 transition-colors"
                            >
                                ?
                            </button>
                        )}
                    </div>
                </div>
                <div className="absolute -right-6 -bottom-10 text-[100px] opacity-10"></div>
            </div>

            {/* My Charts */}
            {onOpenCharts && (
                <button 
                    onClick={onOpenCharts}
                    className="w-full bg-astro-card border border-astro-border rounded-xl p-5 flex items-center justify-between shadow-sm hover:border-astro-highlight/50 transition-colors text-left"
                >
                    <div>
                        <h3 className="text-astro-text font-medium font-serif">
                            {profile.language === 'ru' ? 'Мои карты' : 'My Charts'}
                        </h3>
                        <p className="text-[10px] uppercase tracking-wider text-astro-subtext mt-1">
                            {profile.language === 'ru' ? 'Управление натальными картами' : 'Manage natal charts'}
                        </p>
                    </div>
                    <span className="text-astro-subtext">→</span>
                </button>
            )}

            {/* Theme Switcher */}
            <div className="bg-astro-card border border-astro-border rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                    <h3 className="text-astro-text font-medium font-serif">{getText(profile.language, 'settings.theme')}</h3>
                    <p className="text-[10px] uppercase tracking-wider text-astro-subtext mt-1">
                        {profile.theme === 'light' ? getText(profile.language, 'settings.theme_light') : getText(profile.language, 'settings.theme_dark')}
                    </p>
                </div>
                <div className="flex bg-astro-bg rounded-lg p-1 border border-astro-border">
                    <button 
                        onClick={() => handleThemeToggle('dark')}
                        className={`p-2 rounded-md transition-colors ${profile.theme === 'dark' ? 'bg-astro-card text-white shadow-sm border border-white/10' : 'text-astro-subtext'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                    </button>
                    <button 
                        onClick={() => handleThemeToggle('light')}
                        className={`p-2 rounded-md transition-colors ${profile.theme === 'light' ? 'bg-white text-black shadow-sm border border-black/10' : 'text-astro-subtext'}`}
                        aria-label="Light theme"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M12 6a6 6 0 110 12 6 6 0 010-12z" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Language */}
            <div className="bg-astro-card border border-astro-border rounded-xl p-5 flex items-center justify-between shadow-sm">
                <div>
                    <h3 className="text-astro-text font-medium font-serif">{getText(profile.language, 'settings.language')}</h3>
                    <p className="text-[10px] uppercase tracking-wider text-astro-subtext mt-1">{profile.language === 'ru' ? 'Русский' : 'English'}</p>
                </div>
                <button 
                    onClick={handleLanguageToggle}
                    className="text-astro-text border border-astro-border px-3 py-1 rounded text-xs font-medium hover:bg-astro-bg transition-colors"
                >
                    {getText(profile.language, 'settings.switch_lang')}
                </button>
            </div>

            {/* Weather Settings */}
            <div className="bg-astro-card border border-astro-border rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-astro-text font-medium font-serif">
                            {profile.language === 'ru' ? 'Погода и Луна' : 'Weather & Moon'}
                        </h3>
                        <p className="text-[10px] uppercase tracking-wider text-astro-subtext mt-1">
                            {profile.language === 'ru' ? 'Настройка города для погоды' : 'Set city for weather'}
                        </p>
                    </div>
                    {!editingWeather && (
                        <button 
                            onClick={() => setEditingWeather(true)} 
                            className="text-astro-subtext text-[10px] uppercase tracking-wider hover:text-astro-primary border-b border-transparent hover:border-astro-subtext transition-all"
                        >
                            {profile.language === 'ru' ? 'Изменить' : 'Edit'}
                        </button>
                    )}
                </div>

                {editingWeather ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-astro-subtext mb-2">
                                {profile.language === 'ru' ? 'Город' : 'City'}
                            </label>
                            <input 
                                type="text" 
                                value={tempWeatherCity}
                                onChange={(e) => setTempWeatherCity(e.target.value)}
                                placeholder={profile.language === 'ru' ? 'Например: Москва или Moscow' : 'e.g. Moscow or London'}
                                className="w-full bg-transparent border-b border-astro-highlight py-2 text-astro-text text-sm focus:outline-none transition-colors font-serif"
                                disabled={weatherLoading}
                                minLength={2}
                                maxLength={64}
                            />
                            <p className="text-[9px] text-astro-subtext mt-2 italic">
                                {profile.language === 'ru' 
                                    ? 'Укажите название города (2-64 символа)'
                                    : 'Enter city name (2-64 characters)'}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleSaveWeatherCity}
                                disabled={weatherLoading || (tempWeatherCity.trim().length > 0 && tempWeatherCity.trim().length < 2)}
                                className="flex-1 bg-white text-black font-bold py-3 rounded-lg shadow-lg hover:opacity-90 transition-transform uppercase text-xs tracking-widest disabled:opacity-50"
                            >
                                {weatherLoading 
                                    ? (profile.language === 'ru' ? 'Сохранение...' : 'Saving...')
                                    : getText(profile.language, 'settings.save')
                                }
                            </button>
                            <button 
                                onClick={() => {
                                    setEditingWeather(false);
                                    setTempWeatherCity(currentWeatherCity || '');
                                }}
                                disabled={weatherLoading}
                                className="bg-transparent border border-astro-border text-astro-text font-bold py-3 px-4 rounded-lg text-xs uppercase tracking-widest hover:bg-astro-bg transition-colors disabled:opacity-50"
                            >
                                {profile.language === 'ru' ? 'Отмена' : 'Cancel'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <p className="text-sm text-astro-text font-serif">
                            {currentWeatherCity 
                                ? currentWeatherCity 
                                : (profile.language === 'ru' 
                                    ? 'Город не указан' 
                                    : 'City not set')
                            }
                        </p>
                        {currentWeatherCity && (
                            <p className="text-[10px] text-astro-subtext mt-2">
                                {profile.language === 'ru' 
                                    ? 'Погода и фаза луны будут отображаться на главном экране'
                                    : 'Weather and moon phase will be shown on the main screen'}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Profile Form */}
            <div className="bg-astro-card border border-astro-border rounded-xl p-6 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-astro-text font-medium font-serif">{getText(profile.language, 'settings.profile')}</h3>
                    {!editing && (
                        <button onClick={() => setEditing(true)} className="text-astro-subtext text-[10px] uppercase tracking-wider hover:text-astro-primary border-b border-transparent hover:border-astro-subtext transition-all">
                            {getText(profile.language, 'settings.edit')}
                        </button>
                    )}
                </div>

                <div className="space-y-5">
                    <div>
                        <label className="block text-[10px] uppercase tracking-widest text-astro-subtext mb-2">Name</label>
                        <input 
                            type="text" 
                            value={tempName}
                            onChange={(e) => setTempName(e.target.value)}
                            disabled={!editing}
                            className={`w-full bg-transparent border-b ${editing ? 'border-astro-highlight' : 'border-astro-border'} py-2 text-astro-text text-sm focus:outline-none transition-colors font-serif`}
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] uppercase tracking-widest text-astro-subtext mb-2">Birth Place</label>
                        <input 
                            type="text" 
                            value={tempPlace}
                            onChange={(e) => setTempPlace(e.target.value)}
                            disabled={!editing}
                            className={`w-full bg-transparent border-b ${editing ? 'border-astro-highlight' : 'border-astro-border'} py-2 text-astro-text text-sm focus:outline-none transition-colors font-serif`}
                        />
                    </div>
                    <div>
                         <label className="block text-[10px] uppercase tracking-widest text-astro-subtext mb-2">Date & Time</label>
                         <p className="text-sm text-astro-text font-serif opacity-70">
                             {profile.birthDate} • {profile.birthTime}
                         </p>
                    </div>

                    {editing && (
                        <button 
                            onClick={handleSaveProfile}
                            className="w-full bg-white text-black font-bold py-3 rounded-lg mt-4 shadow-lg hover:opacity-90 transition-transform uppercase text-xs tracking-widest"
                        >
                            {getText(profile.language, 'settings.save')}
                        </button>
                    )}
                </div>
            </div>

            <div className="text-center pt-4">
                 <button className="text-[10px] text-astro-subtext uppercase tracking-widest hover:text-astro-text transition-colors">
                     {getText(profile.language, 'settings.restore')}
                 </button>
            </div>
        </div>
    );
};