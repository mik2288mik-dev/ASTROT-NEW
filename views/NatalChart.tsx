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
    energy: '',      // Солнце - для энергии
    love: '',        // Венера - для любви
    career: '',      // Юпитер - для карьеры
    personality: '', // Солнце - для личности
    emotions: '',    // Луна - для эмоций
    mind: '',        // Меркурий - для разума
    weakness: '',    // Сатурн - для слабостей
    karma: ''        // Плутон - для кармы
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

    const handleForecast = async () => {
        if (!profile.isPremium) {
            requestPremium();
            return;
        }
        const title = getText(profile.language, 'chart.forecast_day');

        // Проверяем кэш ПЕРЕД установкой loading состояния
        const cachedText = profile.generatedContent?.dailyHoroscope?.content || null;

        if (cachedText) {
            console.log('[NatalChart] Using cached daily forecast');
            setActiveAnalysis(`${getText(profile.language, 'chart.forecast_title')} - ${title}`);
            setAnalysisResult(cachedText);
            return; // Не показываем loading, сразу показываем результат
        }

        setActiveAnalysis(`${getText(profile.language, 'chart.forecast_title')} - ${title}`);
        setLoadingAnalysis(true);
        setAnalysisResult("");

        try {
            const res = await getOrGenerateHoroscope(profile, data);
            const text = res.content;
            setAnalysisResult(text);
        } catch(e) {
            console.error('[NatalChart] Error loading forecast:', e);
            setAnalysisResult("Cosmic connection error.");
        } finally {
            setLoadingAnalysis(false);
        }
    };

    // НОВАЯ ЛОГИКА: Используем вступление натальной карты вместо "трех ключей"
    // Вступительный текст для натальной карты (intro)
    const natalIntroSource = profile.generatedContent?.natalIntro;
    
    const [natalIntro, setNatalIntro] = useState<string>(
        natalIntroSource || getText(profile.language, 'chart.loading_intro')
    );

    // Обновляем intro при изменении профиля
    React.useEffect(() => {
        const newIntro = profile.generatedContent?.natalIntro;
        if (newIntro && newIntro !== natalIntro) {
            console.log('[NatalChart] Updating intro from profile');
            setNatalIntro(newIntro);
        }
    }, [profile.generatedContent?.natalIntro]);

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
            <h1 className="text-xl font-semibold text-astro-text text-center mb-2 leading-tight">
                {getText(profile.language, 'chart.title')}
            </h1>
            
            <p className="text-sm text-astro-subtext text-center mb-8">
                {profile.name ? `${profile.name}, ${profile.birthDate}` : profile.birthDate}
            </p>

            {/* ВСТУПЛЕНИЕ: Общий портрет личности (FREE) */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-gradient-to-br from-astro-card to-astro-bg rounded-2xl p-6 border border-astro-border mb-8 shadow-lg"
            >
                <div className="prose prose-sm max-w-none">
                    <div 
                        className="text-[15px] text-astro-text leading-relaxed whitespace-pre-line"
                        dangerouslySetInnerHTML={{ __html: natalIntro.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                    />
                </div>
            </motion.div>

            {/* FREE USER CTA */}
            {!profile.isPremium && (
                <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    transition={{ delay: 0.5 }}
                    className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/30 text-center space-y-4 mb-8"
                >
                    <h3 className="text-lg font-semibold text-astro-text">
                        {profile.language === 'ru' ? 'Хочешь узнать больше?' : 'Want to know more?'}
                    </h3>
                    <p className="text-[15px] text-astro-text leading-relaxed">
                        {profile.language === 'ru' 
                            ? 'Полный разбор карты с глубокими анализами доступен в Premium' 
                            : 'Full chart analysis with deep insights available in Premium'}
                    </p>
                    <button 
                        onClick={requestPremium}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-3 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg"
                    >
                        {getText(profile.language, 'hook.cta_button')}
                    </button>
                </motion.div>
            )}

            {/* ПОЛНЫЕ РАЗДЕЛЫ НАТАЛЬНОЙ КАРТЫ */}
            <div className="space-y-3">
                <h2 className="text-base font-semibold text-astro-text mb-4">
                    {profile.language === 'ru' ? 'Разделы натальной карты' : 'Natal Chart Sections'}
                </h2>

                <div className="space-y-3 max-w-2xl mx-auto">
                    {pillars.map((key, index) => {
                        const fullText = getText(profile.language, `chart.${key}`);
                        
                        return (
                            <button
                                key={key}
                                onClick={() => handleDeepDive(key)}
                                disabled={!profile.isPremium}
                                className={`w-full bg-astro-card rounded-xl p-4 border transition-all text-left relative ${
                                    profile.isPremium 
                                        ? 'border-astro-border hover:border-astro-highlight hover:shadow-lg cursor-pointer group' 
                                        : 'border-astro-border/50 cursor-not-allowed opacity-60'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col">
                                            <span className="text-[15px] font-medium text-astro-text">
                                                {fullText}
                                            </span>
                                            {!profile.isPremium && (
                                                <span className="text-xs text-astro-subtext mt-0.5">
                                                    {profile.language === 'ru' ? 'Premium доступ' : 'Premium access'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {profile.isPremium ? (
                                        <span className="text-astro-subtext text-sm group-hover:text-astro-highlight transition-colors">
                                            {profile.language === 'ru' ? 'Читать →' : 'Read →'}
                                        </span>
                                    ) : (
                                        <span className="text-sm text-astro-subtext">Locked</span>
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* PREMIUM: Прогнозы */}
            <div className="mt-12">
                <h2 className="text-sm font-normal text-astro-text text-center mb-6" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', fontWeight: 400 }}>
                    {getText(profile.language, 'chart.forecast_title')}
                </h2>

                <div className="grid grid-cols-1 gap-3 md:gap-4 max-w-2xl mx-auto">
                    <button
                        onClick={handleForecast}
                        className="bg-astro-card rounded-xl p-4 md:p-5 border border-astro-border hover:border-astro-highlight transition-all hover:shadow-lg relative group"
                    >
                        <div className="text-sm md:text-base font-medium text-astro-text text-center">
                            <div>{getText(profile.language, 'chart.forecast_day')}</div>
                            {!profile.isPremium && (
                                <div className="flex items-center justify-center gap-1 mt-1.5">
                                    <span className="text-xs md:text-sm text-astro-subtext">Locked</span>
                                    <span className="blur-sm select-none text-xs md:text-sm">
                                        {getText(profile.language, 'chart.forecast_week')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </button>
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

            {/* Regenerate Button для вступления (только для premium) */}
            {profile.isPremium && (
                <div className="mt-12 max-w-md mx-auto">
                    <RegenerateButton
                        userId={profile.id || ''}
                        contentType="natal_intro"
                        isPremium={profile.isPremium}
                        language={profile.language}
                        profile={profile}
                        chartData={data}
                        onRegenerate={(newIntro) => {
                            if (typeof newIntro === 'string') {
                                setNatalIntro(newIntro);
                            }
                        }}
                        onRequestPremium={requestPremium}
                    />
                </div>
            )}
        </div>
    );
};
