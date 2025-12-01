
import React, { useState, useEffect } from 'react';
import { UserProfile, NatalChartData, UserContext, UserEvolution } from '../types';
import { getText, getZodiacSign, getElement } from '../constants';
import { SolarSystem } from '../components/SolarSystem';
import { Loading } from '../components/ui/Loading';
import { getUserContext } from '../services/contextService';
import { updateUserEvolution } from '../services/astrologyService';
import { saveProfile } from '../services/storageService';
import { motion } from 'framer-motion';

interface DashboardProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    requestPremium: () => void;
    onNavigate: (view: any) => void;
    onOpenSettings: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ profile, chartData, requestPremium, onNavigate, onOpenSettings }) => {
    
    const [context, setContext] = useState<UserContext | null>(null);
    const [evolution, setEvolution] = useState<UserEvolution | null>(profile.evolution || null);
    const [tgUser, setTgUser] = useState<any>(null);

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            setTgUser(tg.initDataUnsafe.user);
        }
    }, []);

    useEffect(() => {
        const loadSmartFeatures = async () => {
            // 1. Load Context (Weather/Social Proof)
            const ctx = await getUserContext(profile);
            setContext(ctx);

            // 2. Update Evolution (Simulated Async)
            if (!profile.evolution || (Date.now() - profile.evolution.lastUpdated > 86400000)) {
                // Update once every 24 hours or if missing
                console.log('[Dashboard] Updating user evolution...');
                const newEvo = await updateUserEvolution(profile, chartData || undefined);
                setEvolution(newEvo);
                
                // Save to profile
                const updatedProfile = { ...profile, evolution: newEvo };
                try {
                    await saveProfile(updatedProfile);
                    console.log('[Dashboard] Evolution saved successfully');
                } catch (error) {
                    console.error('[Dashboard] Failed to save evolution:', error);
                }
            }
        };
        loadSmartFeatures();
    }, []);

    if (!chartData) return <Loading />;

    const displayName = tgUser?.first_name || profile.name;
    const photoUrl = tgUser?.photo_url;

    return (
        <div className="p-4 pb-32 space-y-6">
            
            {/* 1. COSMIC PASSPORT (Layer 1: Base) */}
            <div className="bg-astro-card rounded-2xl p-6 border border-astro-border shadow-soft relative overflow-hidden">
                 <div className="absolute -top-10 -right-10 w-48 h-48 bg-astro-highlight rounded-full blur-3xl opacity-20"></div>
                 <div className="relative z-10">
                    {/* Header with Avatar and Settings */}
                    <div className="flex items-start justify-between mb-4">
                        {/* Avatar */}
                        <div className="relative group">
                            {photoUrl ? (
                                <img src={photoUrl} alt="Avatar" className="w-14 h-14 rounded-full border-2 border-astro-border shadow-md object-cover" />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-astro-primary to-astro-accent flex items-center justify-center text-white text-lg font-bold shadow-lg">
                                    {displayName.charAt(0).toUpperCase()}
                                </div>
                            )}
                            {profile.isPremium && (
                                <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black text-[9px] font-bold px-2 py-0.5 rounded-full border-2 border-astro-card shadow-md z-10">
                                    PRO
                                </div>
                            )}
                        </div>
                        
                        {/* Settings Button */}
                        <button 
                            onClick={onOpenSettings}
                            className="w-10 h-10 flex items-center justify-center text-astro-subtext hover:text-astro-text transition-colors rounded-full hover:bg-astro-bg/50"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>

                    <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-2">{getText(profile.language, 'dashboard.passport')}</p>
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-serif text-astro-text mb-1">{profile.name}</h1>
                            <div className="flex gap-3 text-xs font-medium text-astro-highlight">
                                <span>☉ {getZodiacSign(profile.language, chartData.sun.sign)}</span>
                                <span>☾ {getZodiacSign(profile.language, chartData.moon.sign)}</span>
                                <span>↑ {getZodiacSign(profile.language, chartData.rising.sign)}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-astro-subtext">{getText(profile.language, 'dashboard.element')}</p>
                            <p className="font-serif text-lg text-astro-text">{getElement(profile.language, chartData.element)}</p>
                        </div>
                    </div>
                 </div>
            </div>

            {/* 1.5. HOROSCOPE FOR TODAY */}
            <button 
                onClick={() => onNavigate('horoscope')}
                className="w-full bg-gradient-to-br from-purple-900/20 to-astro-card rounded-2xl p-6 shadow-soft relative overflow-hidden text-left transition-colors group"
            >
                <div className="absolute -top-16 -left-16 w-48 h-48 bg-purple-500 rounded-full blur-3xl opacity-20"></div>
                <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
                                {profile.language === 'ru' ? 'Гороскоп на сегодня' : 'Today\'s Horoscope'}
                            </p>
                            <h3 className="font-serif text-xl text-astro-text">
                                {profile.language === 'ru' ? 'Сегодня тебя ждёт особенный день' : 'A special day awaits you'}
                            </h3>
                        </div>
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-astro-highlight/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <span className="text-2xl text-astro-highlight">☾</span>
                        </div>
                    </div>
                    <p className="text-xs text-astro-subtext font-light mb-4">
                        {profile.language === 'ru' 
                            ? 'Луна усиливает твою интуицию. Прислушайся к внутреннему голосу.' 
                            : 'The Moon strengthens your intuition. Listen to your inner voice.'}
                    </p>
                    <div className="text-xs text-astro-highlight font-medium">
                        {profile.language === 'ru' ? 'Подробный прогноз →' : 'Detailed forecast →'}
                    </div>
                </div>
            </button>

            {/* 2. PRIMARY ACTION: NATAL CHART */}
            <button 
                onClick={() => onNavigate('chart')}
                className="w-full bg-gradient-to-br from-purple-900/20 to-astro-card rounded-2xl p-6 text-left transition-colors shadow-soft group relative overflow-hidden"
            >
                <div className="absolute -top-16 -left-16 w-48 h-48 bg-purple-500 rounded-full blur-3xl opacity-20"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="font-serif text-xl text-astro-text mb-1">{getText(profile.language, 'dashboard.menu_analysis')}</h3>
                            <p className="text-astro-subtext text-xs font-light">
                                {profile.language === 'ru' ? 'Личность, судьба, карма и прогнозы' : 'Personality, Fate, Karma & Forecasts'}
                            </p>
                        </div>
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-astro-highlight/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <span className="text-2xl text-astro-highlight">→</span>
                        </div>
                    </div>
                </div>
            </button>

            {/* 3. SOCIAL PROOF (Layer 2/4: Community) */}
            {context?.socialProof && (
                <div className="overflow-hidden py-2 bg-astro-bg border-y border-astro-border/50">
                    <motion.div 
                        className="whitespace-nowrap text-[10px] uppercase tracking-widest text-astro-subtext"
                        animate={{ x: [300, -500] }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    >
                        ★ {context.socialProof} ★
                    </motion.div>
                </div>
            )}

            {/* 4. SOUL EVOLUTION (Layer 4: Evolution) */}
            {evolution && (
                <div className="bg-astro-card p-5 rounded-xl border border-astro-border space-y-3">
                    <div className="flex justify-between items-center">
                         <h3 className="text-[10px] uppercase tracking-widest text-astro-text font-bold">
                            {getText(profile.language, 'dashboard.evolution')}
                         </h3>
                         <span className="text-astro-highlight text-xs font-serif">{evolution.title} • Lvl {evolution.level}</span>
                    </div>
                    
                    {/* Bars */}
                    <div>
                        <div className="flex justify-between text-[9px] text-astro-subtext mb-1 uppercase tracking-wider">
                            <span>{getText(profile.language, 'dashboard.stats_intuition')}</span>
                            <span>{evolution.stats.intuition}%</span>
                        </div>
                        <div className="h-1.5 bg-astro-bg rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }} animate={{ width: `${evolution.stats.intuition}%` }}
                                className="h-full bg-purple-400/70 rounded-full"
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[9px] text-astro-subtext mb-1 uppercase tracking-wider">
                            <span>{getText(profile.language, 'dashboard.stats_confidence')}</span>
                            <span>{evolution.stats.confidence}%</span>
                        </div>
                         <div className="h-1.5 bg-astro-bg rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }} animate={{ width: `${evolution.stats.confidence}%` }}
                                className="h-full bg-yellow-400/70 rounded-full"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* 5. COSMIC WEATHER (Layer 3: Context) */}
            {context?.weather && (
                <div className="bg-gradient-to-r from-astro-card to-astro-bg p-5 rounded-xl border border-astro-border relative overflow-hidden">
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h3 className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">{getText(profile.language, 'dashboard.context_weather')}</h3>
                            <p className="text-xl font-serif text-astro-text capitalize">{context.weather}</p>
                        </div>
                        <div className="text-3xl opacity-50 text-astro-highlight">
                           {context.weather.includes('Rain') ? '☂' : context.weather.includes('Sun') ? '☀' : '☁'}
                        </div>
                    </div>
                    <p className="relative z-10 text-xs text-astro-subtext mt-2 font-light italic">
                        {profile.language === 'ru' ? 'Звёзды согласны с небом сегодня...' : 'The stars align with the sky today...'}
                    </p>
                </div>
            )}

            {/* 6. SECONDARY ACTIONS */}
            <div className="grid grid-cols-2 gap-4">
                
                {/* Synastry - доступна всем */}
                <button 
                    onClick={() => onNavigate('synastry')}
                    className="bg-gradient-to-br from-pink-900/20 to-astro-card p-5 rounded-2xl text-left transition-colors shadow-soft group relative overflow-hidden"
                >
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500 rounded-full blur-2xl opacity-20"></div>
                    <div className="relative z-10 flex flex-col justify-between h-28">
                        <div className="w-10 h-10 rounded-full bg-astro-highlight/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <span className="text-xl text-astro-highlight">♥</span>
                        </div>
                        <div>
                            <h3 className="font-serif text-base text-astro-text mb-1">{getText(profile.language, 'dashboard.menu_synastry')}</h3>
                            <p className="text-astro-subtext text-[10px] font-light">
                                {profile.language === 'ru' ? 'Совместимость' : 'Check compatibility'}
                            </p>
                            {!profile.isPremium && (
                                <span className="text-[8px] text-astro-highlight uppercase tracking-wider">
                                    {profile.language === 'ru' ? 'Бесплатный тизер' : 'Free preview'}
                                </span>
                            )}
                        </div>
                    </div>
                </button>

                 {/* Personal Oracle */}
                <button 
                    onClick={() => onNavigate('oracle')}
                    className="bg-gradient-to-br from-blue-900/20 to-astro-card p-5 rounded-2xl text-left transition-colors shadow-soft group relative overflow-hidden"
                >
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500 rounded-full blur-2xl opacity-20"></div>
                    {!profile.isPremium && <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center z-20 rounded-2xl"><span className="text-xs font-bold bg-astro-text text-astro-bg px-2 py-1 rounded">PRO</span></div>}
                    <div className="relative z-10 flex flex-col justify-between h-28">
                        <div className="w-10 h-10 rounded-full bg-astro-highlight/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <span className="text-xl text-astro-highlight">✧</span>
                        </div>
                        <div>
                             <h3 className="font-serif text-base text-astro-text mb-1">{getText(profile.language, 'dashboard.menu_oracle')}</h3>
                             <p className="text-astro-subtext text-[10px] font-light">
                                {profile.language === 'ru' ? 'Спроси у Астры' : 'Ask Astra anything'}
                             </p>
                        </div>
                    </div>
                </button>
            </div>

            {/* Knowledge Base: Planets */}
            <SolarSystem language={profile.language} />
        </div>
    );
};
