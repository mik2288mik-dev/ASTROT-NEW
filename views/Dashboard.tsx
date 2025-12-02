
import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { UserProfile, NatalChartData, UserContext, UserEvolution } from '../types';
import { getText } from '../constants';
import { SolarSystem } from '../components/SolarSystem';
import { Loading } from '../components/ui/Loading';
import { getUserContext } from '../services/contextService';
import { updateUserEvolution } from '../services/astrologyService';
import { saveProfile } from '../services/storageService';
import { motion } from 'framer-motion';
import { CosmicPassport } from '../components/Dashboard/CosmicPassport';
import { SoulEvolution } from '../components/Dashboard/SoulEvolution';

interface DashboardProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    requestPremium: () => void;
    onNavigate: (view: any) => void;
    onOpenSettings: () => void;
}

export const Dashboard = memo<DashboardProps>(({ profile, chartData, requestPremium, onNavigate, onOpenSettings }) => {
    
    const [context, setContext] = useState<UserContext | null>(null);
    const [evolution, setEvolution] = useState<UserEvolution | null>(profile.evolution || null);
    const [tgUser, setTgUser] = useState<any>(null);

    // Мемуизируем язык для оптимизации
    const language = useMemo(() => profile.language, [profile.language]);

    // Мемуизируем displayName и photoUrl
    const displayName = useMemo(() => tgUser?.first_name || profile.name, [tgUser?.first_name, profile.name]);
    const photoUrl = useMemo(() => tgUser?.photo_url, [tgUser?.photo_url]);

    // Мемуизируем колбэки для навигации
    const handleNavigateHoroscope = useCallback(() => onNavigate('horoscope'), [onNavigate]);
    const handleNavigateChart = useCallback(() => onNavigate('chart'), [onNavigate]);
    const handleNavigateSynastry = useCallback(() => onNavigate('synastry'), [onNavigate]);
    const handleNavigateOracle = useCallback(() => onNavigate('oracle'), [onNavigate]);

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            setTgUser(tg.initDataUnsafe.user);
        }
    }, []);

    useEffect(() => {
        // Загружаем контекст и эволюцию асинхронно после показа интерфейса
        const loadSmartFeatures = async () => {
            // Небольшая задержка, чтобы не блокировать показ интерфейса
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 1. Load Context (Weather/Social Proof)
            try {
                const ctx = await getUserContext(profile);
                setContext(ctx);
            } catch (error) {
                console.error('[Dashboard] Failed to load context:', error);
            }

            // 2. Update Evolution (Simulated Async)
            if (!profile.evolution || (Date.now() - profile.evolution.lastUpdated > 86400000)) {
                // Update once every 24 hours or if missing
                try {
                    console.log('[Dashboard] Updating user evolution...');
                    const newEvo = await updateUserEvolution(profile, chartData || undefined);
                    setEvolution(newEvo);
                    
                    // Save to profile
                    const updatedProfile = { ...profile, evolution: newEvo };
                    await saveProfile(updatedProfile);
                    console.log('[Dashboard] Evolution saved successfully');
                } catch (error) {
                    console.error('[Dashboard] Failed to update evolution:', error);
                }
            }
        };
        loadSmartFeatures();
    }, [profile.id, chartData?.sun?.sign]); // Оптимизированные зависимости

    if (!chartData) return <Loading />;

    return (
        <div className="p-4 pb-32 space-y-6">
            
            {/* 1. COSMIC PASSPORT (Layer 1: Base) */}
            <CosmicPassport
              profile={profile}
              chartData={chartData}
              photoUrl={photoUrl}
              displayName={displayName}
              onOpenSettings={onOpenSettings}
            />

            {/* 1.5. HOROSCOPE FOR TODAY */}
            <button 
                onClick={handleNavigateHoroscope}
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
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-astro-highlight/10 border border-astro-highlight/30 flex items-center justify-center group-hover:scale-110 transition-transform">
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
                onClick={handleNavigateChart}
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
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-astro-highlight/10 border border-astro-highlight/30 flex items-center justify-center group-hover:scale-110 transition-transform">
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
                <SoulEvolution evolution={evolution} language={language} />
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
                    onClick={handleNavigateSynastry}
                    className="bg-gradient-to-br from-pink-900/20 to-astro-card p-5 rounded-2xl text-left transition-colors shadow-soft group relative overflow-hidden"
                >
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500 rounded-full blur-2xl opacity-20"></div>
                    <div className="relative z-10 flex flex-col justify-between h-28">
                        <div className="w-10 h-10 rounded-full bg-astro-highlight/10 border border-astro-highlight/30 flex items-center justify-center group-hover:scale-110 transition-transform">
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
                    onClick={handleNavigateOracle}
                    className="bg-gradient-to-br from-blue-900/20 to-astro-card p-5 rounded-2xl text-left transition-colors shadow-soft group relative overflow-hidden"
                >
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500 rounded-full blur-2xl opacity-20"></div>
                    {!profile.isPremium && <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center z-20 rounded-2xl"><span className="text-xs font-bold bg-astro-text text-astro-bg px-2 py-1 rounded">PRO</span></div>}
                    <div className="relative z-10 flex flex-col justify-between h-28">
                        <div className="w-10 h-10 rounded-full bg-astro-highlight/10 border border-astro-highlight/30 flex items-center justify-center group-hover:scale-110 transition-transform">
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
            <SolarSystem language={language} />
        </div>
    );
});

Dashboard.displayName = 'Dashboard';
