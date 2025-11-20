
import React, { useState, useEffect } from 'react';
import { UserProfile, NatalChartData, UserContext, UserEvolution } from '../types';
import { getText } from '../constants';
import { SolarSystem } from '../components/SolarSystem';
import { Loading } from '../components/ui/Loading';
import { getUserContext } from '../services/contextService';
import { updateUserEvolution } from '../services/geminiService';
import { saveProfile } from '../services/storageService';
import { motion } from 'framer-motion';

interface DashboardProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    requestPremium: () => void;
    onNavigate: (view: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ profile, chartData, requestPremium, onNavigate }) => {
    
    const [context, setContext] = useState<UserContext | null>(null);
    const [evolution, setEvolution] = useState<UserEvolution | null>(profile.evolution || null);

    useEffect(() => {
        const loadSmartFeatures = async () => {
            // 1. Load Context (Weather/Social Proof)
            const ctx = await getUserContext(profile);
            setContext(ctx);

            // 2. Update Evolution (Simulated Async)
            if (!profile.evolution || (Date.now() - profile.evolution.lastUpdated > 86400000)) {
                // Update once every 24 hours or if missing
                const newEvo = await updateUserEvolution(profile);
                setEvolution(newEvo);
                
                // Save to profile
                const updatedProfile = { ...profile, evolution: newEvo };
                await saveProfile(updatedProfile);
            }
        };
        loadSmartFeatures();
    }, []);

    if (!chartData) return <Loading />;

    return (
        <div className="p-4 pb-32 space-y-6">
            
            {/* 1. COSMIC PASSPORT (Layer 1: Base) */}
            <div className="bg-astro-card rounded-2xl p-6 border border-astro-border shadow-soft relative overflow-hidden">
                 <div className="absolute -top-10 -right-10 w-48 h-48 bg-astro-highlight rounded-full blur-3xl opacity-20"></div>
                 <div className="relative z-10">
                    <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-2">{getText(profile.language, 'dashboard.passport')}</p>
                    <div className="flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-serif text-astro-text mb-1">{profile.name}</h1>
                            <div className="flex gap-3 text-xs font-medium text-astro-highlight">
                                <span>☉ {chartData.sun.sign}</span>
                                <span>☾ {chartData.moon.sign}</span>
                                <span>↑ {chartData.rising.sign}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-astro-subtext">{getText(profile.language, 'dashboard.element')}</p>
                            <p className="font-serif text-lg text-astro-text">{chartData.element}</p>
                        </div>
                    </div>
                 </div>
            </div>

            {/* 2. PRIMARY ACTION: NATAL CHART (Move to Top) */}
            <button 
                onClick={() => onNavigate('chart')}
                className="w-full bg-astro-card p-6 rounded-xl border border-astro-border text-left hover:border-astro-highlight transition-colors shadow-sm group relative overflow-hidden"
            >
                <div className="absolute -right-6 -bottom-6 text-[80px] opacity-5 grayscale group-hover:grayscale-0 transition-all">📜</div>
                <div className="flex justify-between items-center mb-2 relative z-10">
                    <h3 className="font-serif text-2xl text-astro-text">{getText(profile.language, 'dashboard.menu_analysis')}</h3>
                    <span className="text-2xl group-hover:scale-110 transition-transform">→</span>
                </div>
                <p className="text-astro-subtext text-xs font-light relative z-10">
                    Personality, Fate, Karma & Forecasts.
                </p>
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
                        <div className="text-3xl opacity-50">
                           {context.weather.includes('Rain') ? '🌧' : context.weather.includes('Sun') ? '☀' : '☁'}
                        </div>
                    </div>
                    <p className="relative z-10 text-xs text-astro-subtext mt-2 font-light italic">
                        "The stars align with the sky today..."
                    </p>
                </div>
            )}

            {/* 6. SECONDARY ACTIONS */}
            <div className="grid grid-cols-2 gap-4">
                
                {/* Synastry */}
                <button 
                    onClick={() => onNavigate('synastry')}
                    className="bg-astro-card p-4 rounded-xl border border-astro-border text-left hover:border-astro-highlight transition-colors shadow-sm group relative overflow-hidden"
                >
                    {!profile.isPremium && <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center z-20"><span className="text-xs font-bold bg-astro-text text-astro-bg px-2 py-1 rounded">PRO</span></div>}
                    <div className="flex flex-col justify-between h-24">
                         <span className="text-2xl group-hover:scale-110 transition-transform origin-left">💞</span>
                        <div>
                            <h3 className="font-serif text-md text-astro-text">{getText(profile.language, 'dashboard.menu_synastry')}</h3>
                            <p className="text-astro-subtext text-[10px] font-light">Check compatibility.</p>
                        </div>
                    </div>
                </button>

                 {/* Personal Oracle */}
                <button 
                    onClick={() => onNavigate('oracle')}
                    className="bg-astro-card p-4 rounded-xl border border-astro-border text-left hover:border-astro-highlight transition-colors shadow-sm group relative overflow-hidden"
                >
                    {!profile.isPremium && <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center z-20"><span className="text-xs font-bold bg-astro-text text-astro-bg px-2 py-1 rounded">PRO</span></div>}
                    <div className="flex flex-col justify-between h-24">
                         <span className="text-2xl group-hover:scale-110 transition-transform origin-left">👁</span>
                        <div>
                             <h3 className="font-serif text-md text-astro-text">{getText(profile.language, 'dashboard.menu_oracle')}</h3>
                             <p className="text-astro-subtext text-[10px] font-light">Ask Astra anything.</p>
                        </div>
                    </div>
                </button>
            </div>

            {/* Knowledge Base: Planets */}
            <SolarSystem language={profile.language} />
        </div>
    );
};
