import React, { useState } from 'react';
import { NatalChartData, UserProfile } from '../types';
import { getText } from '../constants';
import { getOrGenerateDeepDive, getOrGenerateHoroscope } from '../services/contentGenerationService';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Loading } from '../components/ui/Loading';
import { RegenerateButton } from '../components/RegenerateButton';
import { KeyBlock } from '../components/NatalChart/KeyBlock';
import { AnalysisModal } from '../components/NatalChart/AnalysisModal';

interface NatalChartProps {
    data: NatalChartData | null;
    profile: UserProfile;
    requestPremium: () => void;
}

/**
 * Иконки планет для блоков натальной карты
 * 
 * Используются Unicode символы как временное решение.
 * TODO: Заменить на SVG иконки для лучшего качества и контроля стилей
 */
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
        
        // Проверяем кэш ПЕРЕД установкой loading состояния
        if (profile.generatedContent?.deepDiveAnalyses?.[topic]) {
            console.log(`[NatalChart] Using cached Deep Dive for ${topic}`);
            setActiveAnalysis(topicTitle);
            setAnalysisResult(profile.generatedContent.deepDiveAnalyses[topic]);
            return; // Не показываем loading, сразу показываем результат
        }
        
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
        
        const periodMap = {
            'day': 'daily',
            'week': 'weekly',
            'month': 'monthly'
        } as const;
        
        const periodKey = periodMap[period];
        
        // Проверяем кэш ПЕРЕД установкой loading состояния
        let cachedText = null;
        if (period === 'day' && profile.generatedContent?.dailyHoroscope) {
            cachedText = profile.generatedContent.dailyHoroscope.content;
        } else if (period === 'week' && profile.generatedContent?.weeklyHoroscope) {
            cachedText = profile.generatedContent.weeklyHoroscope.advice;
        } else if (period === 'month' && profile.generatedContent?.monthlyHoroscope) {
            cachedText = profile.generatedContent.monthlyHoroscope.content;
        }
        
        if (cachedText) {
            console.log(`[NatalChart] Using cached ${period} forecast`);
            setActiveAnalysis(`${getText(profile.language, 'chart.forecast_title')} - ${titleMap[period]}`);
            setAnalysisResult(cachedText);
            return; // Не показываем loading, сразу показываем результат
        }
        
        setActiveAnalysis(`${getText(profile.language, 'chart.forecast_title')} - ${titleMap[period]}`);
        setLoadingAnalysis(true);
        setAnalysisResult("");
        
        try {
            let text = "";
            // Используем новый сервис с кэшированием
            const res = await getOrGenerateHoroscope(profile, data, periodKey);
            
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
    // Используем generatedContent.threeKeys как основной источник, profile.threeKeys как fallback
    const threeKeysSource = profile.generatedContent?.threeKeys || profile.threeKeys;
    const [keys, setKeys] = useState(threeKeysSource || {
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
        <div className="min-h-screen px-4 py-6 max-w-3xl mx-auto pb-32">
            
            {/* Главный заголовок страницы */}
            <h1 className="text-xl font-bold text-astro-text text-center mb-8 leading-tight">
                {getText(profile.language, 'chart.title')}
            </h1>

            {/* Три ключа - основные интерпретации */}
            <motion.div 
                className="space-y-6"
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

            </motion.div>

            {/* FREE USER CTA */}
            {!profile.isPremium && (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    transition={{ delay: 1 }}
                    className="mt-12 bg-astro-card rounded-2xl p-6 border border-astro-border text-center space-y-4"
                >
                    <p className="text-[15px] text-astro-text leading-relaxed max-w-[90%] mx-auto">
                        {getText(profile.language, 'hook.done')}
                    </p>
                    <button 
                        onClick={requestPremium}
                        className="bg-astro-highlight text-white px-6 py-3 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                        {getText(profile.language, 'hook.cta_button')}
                    </button>
                </motion.div>
            )}

            {/* PREMIUM: Deep Dive разделы */}
            <div className="mt-12">
                <h2 className="text-xl font-bold text-astro-text text-center mb-6">
                    {getText(profile.language, 'chart.placements')}
                </h2>

                <div className="space-y-4 max-w-2xl mx-auto">
                    {pillars.map((key) => {
                        const fullText = getText(profile.language, `chart.${key}`);
                        const words = fullText.split(' ');
                        const previewWords = words.slice(0, 3).join(' ');
                        const restWords = words.slice(3).join(' ');
                        
                        return (
                            <button
                                key={key}
                                onClick={() => handleDeepDive(key)}
                                className="w-full bg-astro-card rounded-xl p-5 md:p-6 border border-astro-border hover:border-astro-highlight transition-all hover:shadow-lg text-left relative group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span className="text-base md:text-[17px] font-medium text-astro-text">
                                            {previewWords}
                                        </span>
                                        {!profile.isPremium && restWords && (
                                            <>
                                                <span className="text-base md:text-[17px] font-medium text-astro-text blur-sm select-none">
                                                    {restWords}
                                                </span>
                                                <span className="text-astro-highlight ml-2 text-sm">🔒</span>
                                            </>
                                        )}
                                        {profile.isPremium && restWords && (
                                            <span className="text-base md:text-[17px] font-medium text-astro-text">
                                                {' ' + restWords}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-astro-subtext text-xs md:text-sm ml-4 group-hover:text-astro-highlight transition-colors">
                                        {profile.language === 'ru' ? 'Открыть' : 'Open'}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* PREMIUM: Прогнозы */}
            <div className="mt-12">
                <h2 className="text-xl font-bold text-astro-text text-center mb-6">
                    {getText(profile.language, 'chart.forecast_title')}
                </h2>

                <div className="grid grid-cols-3 gap-3 md:gap-4 max-w-2xl mx-auto">
                    {['day', 'week', 'month'].map((period) => {
                        const fullText = getText(profile.language, `chart.forecast_${period}`);
                        const words = fullText.split(' ');
                        const previewWords = words.slice(0, 3).join(' ');
                        const restWords = words.slice(3).join(' ');
                        
                        return (
                            <button 
                                key={period}
                                onClick={() => handleForecast(period as 'day' | 'week' | 'month')} 
                                className="bg-astro-card rounded-xl p-4 md:p-5 border border-astro-border hover:border-astro-highlight transition-all hover:shadow-lg relative group"
                            >
                                <div className="text-sm md:text-base font-medium text-astro-text text-center">
                                    <div>{previewWords}</div>
                                    {!profile.isPremium && restWords && (
                                        <div className="flex items-center justify-center gap-1 mt-1.5">
                                            <span className="blur-sm select-none text-xs md:text-sm">{restWords}</span>
                                            <span className="text-xs md:text-sm">🔒</span>
                                        </div>
                                    )}
                                    {profile.isPremium && restWords && (
                                        <div className="mt-1.5 text-xs md:text-sm">{restWords}</div>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Модалка с детальным анализом */}
            <AnalysisModal
                isOpen={!!activeAnalysis}
                title={activeAnalysis || ''}
                content={analysisResult}
                isLoading={loadingAnalysis}
                onClose={() => !loadingAnalysis && setActiveAnalysis(null)}
            />

            {/* Regenerate Button в самом низу страницы */}
            <div className="mt-12 max-w-md mx-auto">
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
            </div>
        </div>
    );
};
