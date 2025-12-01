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

// Иконки планет для блоков (ЗАГЛУШКИ - символы Unicode)
// TODO: Заменить на SVG иконки
const PLANET_ICONS: Record<string, string> = {
    energy: '☉',      // Солнце - для энергии
    love: '♀',        // Венера - для любви
    career: '♃',      // Юпитер - для карьеры
    personality: '☉', // Солнце - для личности
    emotions: '☾',    // Луна - для эмоций
    mind: '☿',        // Меркурий - для разума
    weakness: '♄',    // Сатурн - для слабостей
    karma: '♇'        // Плутон - для кармы
};

// Минималистичный компонент блока "три ключа"
const KeyBlock: React.FC<{
    title: string;
    planetSymbol: string;
    text: string;
    advice?: string[];
    language: 'ru' | 'en';
}> = ({ title, planetSymbol, text, advice, language }) => {
    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* Заголовок блока */}
            <h3 className="text-center text-lg font-semibold text-astro-subtext uppercase tracking-wider mb-6">
                {title}
            </h3>

            {/* Большая круглая иконка планеты - ЗАГЛУШКА */}
            <div className="flex justify-center mb-8">
                <div className="w-36 h-36 rounded-full bg-astro-card border-2 border-astro-border flex items-center justify-center shadow-md">
                    <span className="text-7xl text-astro-highlight">
                        {planetSymbol}
                    </span>
                </div>
            </div>

            {/* Основной текст интерпретации */}
            <div className="max-w-[85%] mx-auto space-y-6 mb-8">
                {text.split('\n\n').filter(p => p.trim()).map((paragraph, idx) => (
                    <p 
                        key={idx}
                        className="text-[18px] leading-relaxed text-astro-text text-center"
                        style={{ lineHeight: '1.7' }}
                    >
                        {paragraph.trim()}
                    </p>
                ))}
            </div>

            {/* Советы (если есть) */}
            {advice && advice.length > 0 && (
                <div className="max-w-[85%] mx-auto mt-8 pt-6 border-t border-astro-border/30">
                    <h4 className="text-base font-semibold text-astro-text mb-4 text-center">
                        {language === 'ru' ? 'Советы' : 'Advice'}
                    </h4>
                    <div className="space-y-4">
                        {advice.map((item, index) => (
                            <p 
                                key={index}
                                className="text-[17px] leading-relaxed text-astro-subtext text-center"
                            >
                                {item}
                            </p>
                        ))}
                    </div>
                </div>
            )}
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

    // Animation variants
    const container: Variants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.2
            }
        }
    };

    const item: Variants = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
    };

    return (
        <div className="min-h-screen px-6 py-8 max-w-3xl mx-auto pb-32">
            
            {/* Главный заголовок страницы */}
            <h1 className="text-[32px] font-bold text-astro-text text-center mb-12 leading-tight">
                {getText(profile.language, 'chart.title')}
            </h1>

            {/* Три ключа - основные интерпретации */}
            <motion.div 
                className="space-y-16"
                variants={container}
                initial="hidden"
                animate="show"
            >
                {/* Key 1: Энергия */}
                <motion.div variants={item}>
                    <KeyBlock
                        title={keys.key1.title}
                        planetSymbol={PLANET_ICONS.energy}
                        text={keys.key1.text}
                        advice={keys.key1.advice}
                        language={profile.language}
                    />
                </motion.div>

                {/* Key 2: Любовь */}
                <motion.div variants={item}>
                    <KeyBlock
                        title={keys.key2.title}
                        planetSymbol={PLANET_ICONS.love}
                        text={keys.key2.text}
                        advice={keys.key2.advice}
                        language={profile.language}
                    />
                </motion.div>

                {/* Key 3: Карьера */}
                <motion.div variants={item}>
                    <KeyBlock
                        title={keys.key3.title}
                        planetSymbol={PLANET_ICONS.career}
                        text={keys.key3.text}
                        advice={keys.key3.advice}
                        language={profile.language}
                    />
                </motion.div>

                {/* Regenerate Button для премиум пользователей */}
                {profile.isPremium && (
                    <motion.div variants={item} className="pt-8">
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
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    transition={{ delay: 1 }}
                    className="mt-16 bg-astro-card rounded-3xl p-8 border border-astro-border text-center space-y-6"
                >
                    <p className="text-[17px] text-astro-text leading-relaxed max-w-[85%] mx-auto">
                        {getText(profile.language, 'hook.done')}
                    </p>
                    <button 
                        onClick={requestPremium}
                        className="bg-astro-highlight text-white px-8 py-4 rounded-full text-base font-semibold hover:opacity-90 transition-opacity"
                    >
                        {getText(profile.language, 'hook.cta_button')}
                    </button>
                </motion.div>
            )}

            {/* PREMIUM: Deep Dive разделы */}
            <div className={`mt-20 ${!profile.isPremium ? 'opacity-40 pointer-events-none' : ''}`}>
                <h2 className="text-2xl font-bold text-astro-text text-center mb-8">
                    {getText(profile.language, 'chart.placements')}
                </h2>

                <div className="space-y-4 max-w-xl mx-auto">
                    {pillars.map((key) => (
                        <button
                            key={key}
                            onClick={() => handleDeepDive(key)}
                            className="w-full bg-astro-card rounded-2xl p-6 border border-astro-border hover:border-astro-highlight transition-colors text-left"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[18px] font-medium text-astro-text">
                                    {getText(profile.language, `chart.${key}`)}
                                </span>
                                <span className="text-astro-subtext text-sm">
                                    {profile.language === 'ru' ? 'Открыть' : 'Open'}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* PREMIUM: Прогнозы */}
            <div className={`mt-16 ${!profile.isPremium ? 'opacity-40 pointer-events-none' : ''}`}>
                <h2 className="text-2xl font-bold text-astro-text text-center mb-8">
                    {getText(profile.language, 'chart.forecast_title')}
                </h2>

                <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
                    <button 
                        onClick={() => handleForecast('day')} 
                        className="bg-astro-card rounded-xl p-4 border border-astro-border hover:border-astro-highlight transition-colors"
                    >
                        <p className="text-sm font-medium text-astro-text text-center">
                            {getText(profile.language, 'chart.forecast_day')}
                        </p>
                    </button>
                    <button 
                        onClick={() => handleForecast('week')} 
                        className="bg-astro-card rounded-xl p-4 border border-astro-border hover:border-astro-highlight transition-colors"
                    >
                        <p className="text-sm font-medium text-astro-text text-center">
                            {getText(profile.language, 'chart.forecast_week')}
                        </p>
                    </button>
                    <button 
                        onClick={() => handleForecast('month')} 
                        className="bg-astro-card rounded-xl p-4 border border-astro-border hover:border-astro-highlight transition-colors"
                    >
                        <p className="text-sm font-medium text-astro-text text-center">
                            {getText(profile.language, 'chart.forecast_month')}
                        </p>
                    </button>
                </div>
            </div>

            {/* Модалка с детальным анализом */}
            <AnimatePresence>
                {activeAnalysis && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-6"
                        onClick={() => !loadingAnalysis && setActiveAnalysis(null)}
                    >
                        <motion.div 
                            initial={{ scale: 0.95 }} 
                            animate={{ scale: 1 }} 
                            exit={{ scale: 0.95 }}
                            className="bg-astro-card w-full max-w-lg rounded-3xl p-8 border border-astro-border max-h-[80vh] flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-astro-border shrink-0">
                                <h3 className="text-xl font-semibold text-astro-text">{activeAnalysis}</h3>
                                <button 
                                    onClick={() => setActiveAnalysis(null)} 
                                    className="text-astro-subtext hover:text-astro-text text-2xl leading-none"
                                >
                                    ×
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto scrollbar-hide">
                                {loadingAnalysis ? (
                                    <Loading />
                                ) : (
                                    <div className="max-w-[90%] mx-auto space-y-4">
                                        {analysisResult.split('\n\n').filter(p => p.trim()).map((paragraph, idx) => (
                                            <p 
                                                key={idx}
                                                className="text-[17px] leading-relaxed text-astro-text"
                                            >
                                                {paragraph.trim()}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
