
import React, { useState } from 'react';
import { NatalChartData, UserProfile } from '../types';
import { getText } from '../constants';
import { getOrGenerateDeepDive, getOrGenerateHoroscope } from '../services/contentGenerationService';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Loading } from '../components/ui/Loading';
import { RegenerateButton } from '../components/RegenerateButton';

interface NatalChartProps {
    data: NatalChartData | null;
    profile: UserProfile;
    requestPremium: () => void;
}

// Иконки планет для блоков
const PLANET_ICONS: Record<string, string> = {
    energy: '☉', // Солнце
    love: '♀', // Венера
    career: '♃', // Юпитер
    personality: '☉', // Солнце
    emotions: '☾', // Луна
    mind: '☿', // Меркурий
    weakness: '♄', // Сатурн
    karma: '♇' // Плутон
};

// Компонент блока натальной карты в стиле референса
const ChartBlock: React.FC<{
    title: string;
    planet: string;
    text: string;
    advice?: string[];
    language: 'ru' | 'en';
    variant?: 'default' | 'highlight';
}> = ({ title, planet, text, advice, language, variant = 'default' }) => {
    const gradientClass = variant === 'highlight' 
        ? 'from-purple-900/20 via-astro-card to-astro-card' 
        : 'from-astro-card to-astro-card';
    
    return (
        <div className={`relative rounded-3xl overflow-hidden bg-gradient-to-b ${gradientClass} border border-astro-border shadow-soft`}>
            {/* Декоративный фон */}
            <div className="absolute -top-20 -right-20 w-64 h-64 bg-astro-highlight rounded-full blur-3xl opacity-10"></div>
            
            <div className="relative z-10 p-8 space-y-6">
                {/* Заголовок */}
                <div className="text-center">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext mb-3 font-bold">
                        {title}
                    </p>
                </div>

                {/* Центральная иконка планеты */}
                <div className="flex justify-center">
                    <div className="relative">
                        <div className="absolute inset-0 bg-astro-highlight/20 rounded-full blur-2xl"></div>
                        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-astro-highlight/10 to-transparent border border-astro-highlight/30 flex items-center justify-center backdrop-blur-sm">
                            <span className="text-6xl text-astro-highlight opacity-90 font-light">
                                {planet}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Основной текст */}
                <div className="space-y-4 text-center px-2">
                    {text.split('\n\n').map((paragraph, idx) => (
                        paragraph.trim() && (
                            <p key={idx} className="text-sm text-astro-text leading-relaxed font-light">
                                {paragraph.trim()}
                            </p>
                        )
                    ))}
                </div>

                {/* Советы */}
                {advice && advice.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-astro-border/30">
                        <h4 className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext font-bold mb-4 text-center">
                            {language === 'ru' ? 'Советы' : 'Advice'}
                        </h4>
                        <div className="space-y-3">
                            {advice.map((item, index) => {
                                // Разные цвета для маркеров
                                const colors = ['text-purple-400', 'text-pink-400', 'text-blue-400'];
                                const colorClass = colors[index % colors.length];
                                
                                return (
                                    <div key={index} className="flex items-start gap-3">
                                        <span className={`flex-shrink-0 mt-1 ${colorClass} text-xs`}>●</span>
                                        <span className="flex-1 text-sm text-astro-text font-light leading-relaxed">
                                            {item}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

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
        
        // Мапим ключи из констант на наши ключи в кэше
        const topicMap: Record<string, 'personality' | 'love' | 'career' | 'weakness' | 'karma'> = {
            'section_personality': 'personality',
            'section_love': 'love',
            'section_career': 'career',
            'section_weakness': 'weakness',
            'section_karma': 'karma'
        };
        
        const topic = topicMap[topicKey];
        if (!topic) {
            console.error('[NatalChart] Unknown topic key:', topicKey);
            return;
        }
        
        const topicTitle = getText(profile.language, `chart.${topicKey}`);
        setActiveAnalysis(topicTitle);
        setLoadingAnalysis(true);
        setAnalysisResult("");
        
        try {
            // Используем новый сервис с кэшированием
            const result = await getOrGenerateDeepDive(profile, data, topic);
            setAnalysisResult(result);
        } catch (e) {
            console.error('[NatalChart] Error loading Deep Dive:', e);
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
            // Используем новый сервис с кэшированием
            const periodMap = {
                'day': 'daily',
                'week': 'weekly',
                'month': 'monthly'
            } as const;
            
            const res = await getOrGenerateHoroscope(profile, data, periodMap[period]);
            
            if (period === 'day') {
                text = (res as any).content;
            } else if (period === 'week') {
                text = (res as any).advice;
            } else {
                text = (res as any).content;
            }
            setAnalysisResult(text);
        } catch(e) {
            console.error('[NatalChart] Error loading forecast:', e);
            setAnalysisResult("Cosmic connection error.");
        } finally {
            setLoadingAnalysis(false);
        }
    };

    // The 3 Keys (From Profile) - обновляемые при регенерации
    const [keys, setKeys] = useState(profile.threeKeys || {
        key1: { title: getText(profile.language, 'hook.key1_title'), text: "...", advice: [] },
        key2: { title: getText(profile.language, 'hook.key2_title'), text: "...", advice: [] },
        key3: { title: getText(profile.language, 'hook.key3_title'), text: "...", advice: [] },
    });

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
        <div className="p-4 space-y-8 pb-32" style={{ paddingTop: 'calc(1rem + 24px)' }}>
            
            <div className="pb-2 text-center">
                 <h2 className="text-2xl font-bold text-astro-text font-serif tracking-wide">
                     {getText(profile.language, 'chart.title')}
                 </h2>
                 <div className="h-[1px] w-24 bg-astro-highlight mx-auto mt-2 opacity-50"></div>
            </div>

            {/* 1. HERO: The Three Keys (Animated Manifestation) */}
            <motion.div 
                className="space-y-8 py-4"
                variants={container}
                initial="hidden"
                animate="show"
            >
                {/* Key 1: Energy */}
                <motion.div variants={item}>
                    <ChartBlock
                        title={keys.key1.title}
                        planet={PLANET_ICONS.energy}
                        text={keys.key1.text}
                        advice={keys.key1.advice}
                        language={profile.language}
                        variant="highlight"
                    />
                </motion.div>

                {/* Key 2: Love */}
                <motion.div variants={item}>
                    <ChartBlock
                        title={keys.key2.title}
                        planet={PLANET_ICONS.love}
                        text={keys.key2.text}
                        advice={keys.key2.advice}
                        language={profile.language}
                        variant="default"
                    />
                </motion.div>

                {/* Key 3: Career */}
                <motion.div variants={item}>
                    <ChartBlock
                        title={keys.key3.title}
                        planet={PLANET_ICONS.career}
                        text={keys.key3.text}
                        advice={keys.key3.advice}
                        language={profile.language}
                        variant="default"
                    />
                </motion.div>

                {/* Regenerate Button */}
                {profile.isPremium && (
                    <motion.div variants={item}>
                        <RegenerateButton
                            userId={profile.id || ''}
                            contentType="three_keys"
                            isPremium={profile.isPremium}
                            language={profile.language}
                            profile={profile}
                            chartData={data}
                            onRegenerate={(newData) => {
                                setKeys(newData);
                            }}
                            onRequestPremium={requestPremium}
                        />
                    </motion.div>
                )}
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
                                {profile.isPremium ? '→' : '⚿'}
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
                        className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 pt-[88px]"
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
