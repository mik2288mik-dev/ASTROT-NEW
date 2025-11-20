
import React, { useState } from 'react';
import { NatalChartData, UserProfile } from '../types';
import { getText } from '../constants';
import { getDeepDiveAnalysis, getDailyHoroscope, getWeeklyHoroscope, getMonthlyHoroscope } from '../services/geminiService';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Loading } from '../components/ui/Loading';

interface NatalChartProps {
    data: NatalChartData | null;
    profile: UserProfile;
    requestPremium: () => void;
}

export const NatalChart: React.FC<NatalChartProps> = ({ data, profile, requestPremium }) => {
    const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<string>("");
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);

    // If no data or no stored keys, show loading or basic state
    if (!data) return <Loading />;

    const handleDeepDive = async (topicKey: string) => {
        if (!profile.isPremium) {
            requestPremium();
            return;
        }
        const topicTitle = getText(profile.language, `chart.${topicKey}`);
        setActiveAnalysis(topicTitle);
        setLoadingAnalysis(true);
        setAnalysisResult("");
        try {
            const result = await getDeepDiveAnalysis(profile, topicTitle, data);
            setAnalysisResult(result);
        } catch (e) {
            setAnalysisResult("The stars are silent.");
        } finally {
            setLoadingAnalysis(false);
        }
    };

    const handleForecast = async (period: 'day' | 'week' | 'month') => {
        if (!profile.isPremium) {
            requestPremium();
            return;
        }
        const titleMap = {
            day: getText(profile.language, 'chart.forecast_day'),
            week: getText(profile.language, 'chart.forecast_week'),
            month: getText(profile.language, 'chart.forecast_month'),
        };
        
        setActiveAnalysis(`${getText(profile.language, 'chart.forecast_title')} - ${titleMap[period]}`);
        setLoadingAnalysis(true);
        setAnalysisResult("");
        
        try {
            let text = "";
            if (period === 'day') {
                const res = await getDailyHoroscope(profile, data);
                text = res.content;
            } else if (period === 'week') {
                const res = await getWeeklyHoroscope(profile, data);
                text = res.advice; // Simplified for demo
            } else {
                const res = await getMonthlyHoroscope(profile, data);
                text = res.content;
            }
            setAnalysisResult(text);
        } catch(e) {
             setAnalysisResult("Cosmic connection error.");
        } finally {
            setLoadingAnalysis(false);
        }
    };

    // The 3 Keys (From Profile)
    const keys = profile.threeKeys || {
        key1: { title: getText(profile.language, 'hook.key1_title'), text: "..." },
        key2: { title: getText(profile.language, 'hook.key2_title'), text: "..." },
        key3: { title: getText(profile.language, 'hook.key3_title'), text: "..." },
    };

    // Premium Pillars
    const pillars = [
        'section_personality',
        'section_love',
        'section_career',
        'section_weakness',
        'section_karma'
    ];

    // Animation variants for "Manifesting" effect
    const container: Variants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.3
            }
        }
    };

    const item: Variants = {
        hidden: { opacity: 0, y: 20, filter: "blur(5px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: "easeOut" } }
    };

    return (
        <div className="p-4 space-y-8 pb-32">
            
            <div className="pt-4 pb-2 text-center">
                 <h2 className="text-2xl font-bold text-astro-text font-serif tracking-wide uppercase">
                     {getText(profile.language, 'chart.title')}
                 </h2>
                 <div className="h-[1px] w-24 bg-astro-highlight mx-auto mt-2 opacity-50"></div>
            </div>

            {/* 1. HERO: The Three Keys (Animated Manifestation) */}
            <motion.div 
                className="space-y-10 py-4"
                variants={container}
                initial="hidden"
                animate="show"
            >
                <motion.div variants={item} className="flex flex-col items-center text-center w-full">
                    <h4 className="text-astro-highlight text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
                        {getText(profile.language, 'hook.key1_title')}
                    </h4>
                    <p className="text-astro-text text-lg leading-8 font-serif font-light drop-shadow-sm max-w-[90%]">
                        {keys.key1.text}
                    </p>
                </motion.div>
                <motion.div variants={item} className="flex flex-col items-center text-center w-full">
                    <h4 className="text-astro-highlight text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
                        {getText(profile.language, 'hook.key2_title')}
                    </h4>
                    <p className="text-astro-text text-lg leading-8 font-serif font-light drop-shadow-sm max-w-[90%]">
                        {keys.key2.text}
                    </p>
                </motion.div>
                <motion.div variants={item} className="flex flex-col items-center text-center w-full">
                    <h4 className="text-astro-highlight text-[10px] font-bold uppercase tracking-[0.3em] mb-4">
                        {getText(profile.language, 'hook.key3_title')}
                    </h4>
                    <p className="text-astro-text text-lg leading-8 font-serif font-light drop-shadow-sm max-w-[90%]">
                        {keys.key3.text}
                    </p>
                </motion.div>
            </motion.div>

            {/* FREE USER CTA */}
            {!profile.isPremium && (
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
                    className="bg-astro-card p-6 rounded-xl border border-astro-highlight/30 shadow-glow text-center space-y-4 mt-8"
                >
                    <p className="text-astro-subtext text-sm whitespace-pre-wrap">
                        {getText(profile.language, 'hook.done')}
                    </p>
                    <button 
                        onClick={requestPremium}
                        className="w-full bg-astro-text text-astro-bg py-4 rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg hover:scale-105 transition-transform"
                    >
                        {getText(profile.language, 'hook.cta_button')}
                    </button>
                </motion.div>
            )}

            {/* 2. PREMIUM PILLARS (Locked for Free) */}
            <div className={`mt-12 border-t border-astro-border pt-8 ${!profile.isPremium ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <h3 className="text-center text-[10px] font-bold text-astro-subtext mb-6 uppercase tracking-widest">
                    {getText(profile.language, 'chart.placements')}
                </h3>

                <div className="space-y-3">
                    {pillars.map((key) => (
                        <button
                            key={key}
                            onClick={() => handleDeepDive(key)}
                            className="w-full bg-astro-card p-5 rounded-xl border border-astro-border flex items-center justify-between group relative overflow-hidden hover:border-astro-highlight transition-all shadow-soft"
                        >
                            <div className="flex items-center gap-4 z-10">
                                <div className="w-8 h-8 rounded-full bg-astro-bg border border-astro-border flex items-center justify-center text-astro-highlight text-sm">
                                    ✦
                                </div>
                                <span className="text-astro-text font-serif text-lg">
                                    {getText(profile.language, `chart.${key}`)}
                                </span>
                            </div>
                            <div className="z-10 text-astro-subtext group-hover:text-astro-highlight transition-colors">
                                {profile.isPremium ? '→' : '🔒'}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. FORECASTS (Premium Only) */}
            <div className={`mt-8 border-t border-astro-border pt-8 ${!profile.isPremium ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                 <h3 className="text-center text-[10px] font-bold text-astro-subtext mb-6 uppercase tracking-widest">
                    {getText(profile.language, 'chart.forecast_title')}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    <button onClick={() => handleForecast('day')} className="bg-astro-card p-4 rounded-xl border border-astro-border hover:border-astro-highlight text-[10px] uppercase font-bold tracking-wider">
                        {getText(profile.language, 'chart.forecast_day')}
                    </button>
                     <button onClick={() => handleForecast('week')} className="bg-astro-card p-4 rounded-xl border border-astro-border hover:border-astro-highlight text-[10px] uppercase font-bold tracking-wider">
                        {getText(profile.language, 'chart.forecast_week')}
                    </button>
                     <button onClick={() => handleForecast('month')} className="bg-astro-card p-4 rounded-xl border border-astro-border hover:border-astro-highlight text-[10px] uppercase font-bold tracking-wider">
                        {getText(profile.language, 'chart.forecast_month')}
                    </button>
                </div>
                 <p className="text-center text-[9px] text-astro-subtext mt-4 uppercase tracking-widest opacity-60">
                     Updates daily at 00:01
                 </p>
            </div>

            {/* Analysis Modal */}
            <AnimatePresence>
                {activeAnalysis && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
                        onClick={() => !loadingAnalysis && setActiveAnalysis(null)}
                    >
                        <motion.div 
                            initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
                            className="bg-astro-card w-full max-w-sm rounded-2xl p-8 border border-astro-border shadow-2xl max-h-[80vh] flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6 border-b border-astro-border pb-4 shrink-0">
                                <h3 className="text-xl text-astro-text font-serif leading-tight">{activeAnalysis}</h3>
                                <button onClick={() => setActiveAnalysis(null)} className="text-astro-subtext hover:text-astro-text p-2">✕</button>
                            </div>
                            <div className="flex-1 overflow-y-auto scrollbar-hide">
                                {loadingAnalysis ? (
                                    <Loading />
                                ) : (
                                    <p className="text-astro-text text-sm leading-8 font-light whitespace-pre-wrap font-serif">{analysisResult}</p>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
