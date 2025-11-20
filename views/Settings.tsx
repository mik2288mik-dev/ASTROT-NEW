
import React, { useState } from 'react';
import { UserProfile, Language, Theme } from '../types';
import { getText } from '../constants';
import { saveProfile } from '../services/storageService';
import { requestStarsPayment } from '../services/telegramService';

interface SettingsProps {
    profile: UserProfile;
    onUpdate: (profile: UserProfile) => void;
    onShowPremiumPreview?: () => void;
    onOpenAdmin?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ profile, onUpdate, onShowPremiumPreview, onOpenAdmin }) => {
    const [editing, setEditing] = useState(false);
    const [tempName, setTempName] = useState(profile.name);
    const [tempPlace, setTempPlace] = useState(profile.birthPlace);

    const handleLanguageToggle = () => {
        const newLang: Language = profile.language === 'ru' ? 'en' : 'ru';
        const updated = { ...profile, language: newLang };
        onUpdate(updated);
        saveProfile(updated);
    };

    const handleThemeToggle = (newTheme: Theme) => {
        const updated = { ...profile, theme: newTheme };
        onUpdate(updated);
        saveProfile(updated);
    };

    const handlePremiumPurchase = async () => {
        if (profile.isPremium) return;
        
        const success = await requestStarsPayment(profile);
        if (success) {
            const updated = { ...profile, isPremium: true };
            onUpdate(updated);
            saveProfile(updated);
        }
    };

    const handleSaveProfile = () => {
        const updated = { ...profile, name: tempName, birthPlace: tempPlace };
        onUpdate(updated);
        saveProfile(updated);
        setEditing(false);
    };

    return (
        <div className="p-6 pb-24 space-y-6">
            <h2 className="text-3xl font-bold text-astro-text font-serif mb-8">{getText(profile.language, 'settings.title')}</h2>

            {/* Admin Button - Only visible if isAdmin */}
            {profile.isAdmin && onOpenAdmin && (
                <button 
                    onClick={onOpenAdmin}
                    className="w-full bg-red-500/10 border border-red-500 text-red-500 py-3 rounded-lg uppercase text-[10px] tracking-widest font-bold hover:bg-red-500/20 transition-colors mb-4"
                >
                    ⚠️ Open Admin Panel
                </button>
            )}

            {/* Subscription Card */}
            <div className="bg-astro-text text-astro-bg p-6 rounded-xl shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-lg font-serif font-bold mb-1">{getText(profile.language, 'settings.subscription')}</h3>
                    <p className="text-xs opacity-80 mb-6 font-medium tracking-wide uppercase">
                        {profile.isPremium ? "PRO ACCESS UNLOCKED" : "BASIC PLAN"}
                    </p>
                    
                    <div className="flex gap-2">
                        <button 
                            onClick={handlePremiumPurchase}
                            disabled={profile.isPremium}
                            className="flex-1 bg-astro-bg text-astro-text font-bold py-3 px-4 rounded-lg text-[10px] uppercase tracking-widest shadow hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100"
                        >
                            {profile.isPremium ? "Active" : getText(profile.language, 'dashboard.get_premium')}
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
                <div className="absolute -right-6 -bottom-10 text-[100px] opacity-10">★</div>
            </div>

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
                        ☾
                    </button>
                    <button 
                        onClick={() => handleThemeToggle('light')}
                        className={`p-2 rounded-md transition-colors ${profile.theme === 'light' ? 'bg-white text-black shadow-sm border border-black/10' : 'text-astro-subtext'}`}
                    >
                        ☀
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