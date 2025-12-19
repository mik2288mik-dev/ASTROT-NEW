import React, { useState } from 'react';
import { NatalChartData, UserProfile } from '../types';
import { getText } from '../constants';
import { getOrGenerateDeepDive, getOrGenerateHoroscope } from '../services/contentGenerationService';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Loading } from '../components/ui/Loading';
import { RegenerateButton } from '../components/RegenerateButton';
import { AnalysisModal } from '../components/NatalChart/AnalysisModal';

interface NatalChartProps {
    data: NatalChartData | null;
    profile: UserProfile;
    requestPremium: () => void;
}

/**
 * Премиальные SVG иконки планет для разделов натальной карты
 */
const PlanetIcon: React.FC<{ type: string; className?: string }> = ({ type, className = '' }) => {
    const icons: Record<string, JSX.Element> = {
        personality: (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3"/>
                <circle cx="12" cy="12" r="6" fill="currentColor" opacity="0.8"/>
                <circle cx="12" cy="12" r="2" fill="currentColor"/>
                <path d="M12 2 L12 6 M12 18 L12 22 M2 12 L6 12 M18 12 L22 12" stroke="currentColor" strokeWidth="1.5" opacity="0.5"/>
            </svg>
        ),
        love: (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" 
                      stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.9"/>
            </svg>
        ),
        career: (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <path d="M12 2 L15 8 L22 9 L17 14 L18 21 L12 18 L6 21 L7 14 L2 9 L9 8 Z" 
                      stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.9"/>
            </svg>
        ),
        weakness: (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3"/>
                <path d="M8 12 L16 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 8 L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
        ),
        karma: (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3"/>
                <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6"/>
                <path d="M12 22 A10 10 0 0 1 2 12" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6"/>
                <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.8"/>
            </svg>
        ),
        forecast: (
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
                <path d="M12 2 L15 8 L22 9 L17 14 L18 21 L12 18 L6 21 L7 14 L2 9 L9 8 Z" 
                      stroke="currentColor" strokeWidth="1.5" fill="currentColor" opacity="0.9"/>
                <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3"/>
            </svg>
        )
    };
    
    return icons[type] || icons.personality;
};

/**
 * Компонент карточки раздела натальной карты
 */
const SectionCard: React.FC<{
    title: string;
    iconType: string;
    isPremium: boolean;
    language: 'ru' | 'en';
    onClick: () => void;
    index: number;
}> = ({ title, iconType, isPremium, language, onClick, index }) => {
    return (
        <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            onClick={onClick}
            disabled={!isPremium}
            className={`
                group relative w-full overflow-hidden rounded-2xl p-6
                border-2 transition-all duration-300 text-left
                ${isPremium 
                    ? 'bg-gradient-to-br from-astro-card via-astro-card to-astro-bg border-astro-border hover:border-astro-highlight hover:shadow-xl hover:shadow-astro-highlight/20 cursor-pointer' 
                    : 'bg-astro-card/50 border-astro-border/30 cursor-not-allowed opacity-60'
                }
            `}
        >
            {/* Декоративный градиентный фон */}
            <div className="absolute inset-0 bg-gradient-to-br from-astro-highlight/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Содержимое карточки */}
            <div className="relative z-10 flex items-center gap-5">
                {/* Иконка планеты */}
                <div className={`
                    flex-shrink-0 w-16 h-16 rounded-2xl 
                    flex items-center justify-center
                    transition-all duration-300
                    ${isPremium 
                        ? 'bg-gradient-to-br from-astro-highlight/20 to-astro-highlight/5 group-hover:scale-110 group-hover:rotate-6' 
                        : 'bg-astro-bg/50'
                    }
                `}>
                    <PlanetIcon 
                        type={iconType} 
                        className={`w-8 h-8 ${isPremium ? 'text-astro-highlight' : 'text-astro-subtext'}`}
                    />
                </div>
                
                {/* Текст */}
                <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-astro-text mb-1 group-hover:text-astro-highlight transition-colors">
                        {title}
                    </h3>
                    {!isPremium && (
                        <p className="text-xs text-astro-subtext uppercase tracking-wider">
                            {language === 'ru' ? 'Premium доступ' : 'Premium access'}
                        </p>
                    )}
                </div>
                
                {/* Стрелка */}
                {isPremium && (
                    <div className="flex-shrink-0 text-astro-subtext group-hover:text-astro-highlight group-hover:translate-x-1 transition-all">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                    </div>
                )}
            </div>
            
            {/* Блокирующий overlay для free пользователей */}
            {!isPremium && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-6 h-6 text-astro-subtext" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                </div>
            )}
        </motion.button>
    );
};

export const NatalChart: React.FC<NatalChartProps> = ({ data, profile, requestPremium }) => {
    const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<string>("");
    const [loadingAnalysis, setLoadingAnalysis] = useState(false);

    if (!data) return <Loading />;

    const handleDeepDive = async (topicKey: string) => {
        if (!profile.isPremium) {
            requestPremium();
            return;
        }
        
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
        
        if (profile.generatedContent?.deepDiveAnalyses?.[topic]) {
            console.log(`[NatalChart] Using cached Deep Dive for ${topic}`);
            setActiveAnalysis(topicTitle);
            setAnalysisResult(profile.generatedContent.deepDiveAnalyses[topic]);
            return;
        }
        
        setActiveAnalysis(topicTitle);
        setLoadingAnalysis(true);
        setAnalysisResult("");
        
        try {
            const result = await getOrGenerateDeepDive(profile, data, topic);
            setAnalysisResult(result);
        } catch (e) {
            console.error('[NatalChart] Error loading Deep Dive:', e);
            setAnalysisResult(profile.language === 'ru' ? 'Звёзды молчат.' : 'The stars are silent.');
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

        const cachedText = profile.generatedContent?.dailyHoroscope?.content || null;

        if (cachedText) {
            console.log('[NatalChart] Using cached daily forecast');
            setActiveAnalysis(`${getText(profile.language, 'chart.forecast_title')} - ${title}`);
            setAnalysisResult(cachedText);
            return;
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
            setAnalysisResult(profile.language === 'ru' ? 'Ошибка космического соединения.' : 'Cosmic connection error.');
        } finally {
            setLoadingAnalysis(false);
        }
    };

    const natalIntroSource = profile.generatedContent?.natalIntro;
    const [natalIntro, setNatalIntro] = useState<string>(
        natalIntroSource || getText(profile.language, 'chart.loading_intro')
    );

    React.useEffect(() => {
        const newIntro = profile.generatedContent?.natalIntro;
        if (newIntro && newIntro !== natalIntro) {
            console.log('[NatalChart] Updating intro from profile');
            setNatalIntro(newIntro);
        }
    }, [profile.generatedContent?.natalIntro]);

    const sections = [
        { key: 'section_personality', icon: 'personality' },
        { key: 'section_love', icon: 'love' },
        { key: 'section_career', icon: 'career' },
        { key: 'section_weakness', icon: 'weakness' },
        { key: 'section_karma', icon: 'karma' }
    ];

    return (
        <div className="min-h-screen px-4 py-6 max-w-4xl mx-auto pb-32">
            {/* Заголовок страницы */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-8"
            >
                <h1 className="text-2xl md:text-3xl font-bold text-astro-text mb-2 font-serif">
                    {getText(profile.language, 'chart.title')}
                </h1>
                <p className="text-sm text-astro-subtext">
                    {profile.name ? `${profile.name}, ${profile.birthDate}` : profile.birthDate}
                </p>
            </motion.div>

            {/* ВСТУПЛЕНИЕ: Общий портрет личности */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="relative bg-gradient-to-br from-astro-card via-astro-card to-astro-bg rounded-3xl p-8 md:p-10 border border-astro-border mb-10 shadow-xl overflow-hidden"
            >
                {/* Декоративные элементы */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-astro-highlight/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-astro-highlight/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-astro-highlight/20 to-astro-highlight/5 flex items-center justify-center">
                            <PlanetIcon type="personality" className="w-6 h-6 text-astro-highlight" />
                        </div>
                        <h2 className="text-lg font-semibold text-astro-text">
                            {profile.language === 'ru' ? 'Твой космический портрет' : 'Your cosmic portrait'}
                        </h2>
                    </div>
                    
                    <div 
                        className="text-[16px] md:text-[17px] text-astro-text leading-relaxed space-y-4 prose prose-lg max-w-none"
                        style={{ lineHeight: '1.75' }}
                        dangerouslySetInnerHTML={{ 
                            __html: natalIntro
                                .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-astro-highlight">$1</strong>')
                                .replace(/\n/g, '<br/>')
                        }} 
                    />
                </div>
            </motion.div>

            {/* FREE USER CTA */}
            {!profile.isPremium && (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    transition={{ delay: 0.3, duration: 0.4 }}
                    className="relative bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-purple-500/20 rounded-3xl p-8 border-2 border-purple-500/30 text-center mb-10 overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent animate-pulse" />
                    <div className="relative z-10 space-y-4">
                        <h3 className="text-xl font-bold text-astro-text">
                            {profile.language === 'ru' ? 'Раскрой всю свою карту' : 'Unlock your full chart'}
                        </h3>
                        <p className="text-[15px] text-astro-text/90 leading-relaxed max-w-2xl mx-auto">
                            {profile.language === 'ru' 
                                ? 'Получи глубокие анализы по всем разделам, персональные прогнозы и кармические инсайты' 
                                : 'Get deep insights into all sections, personal forecasts and karmic insights'}
                        </p>
                        <button 
                            onClick={requestPremium}
                            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-10 py-4 rounded-full text-base font-semibold hover:opacity-90 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                        >
                            {getText(profile.language, 'hook.cta_button')}
                        </button>
                    </div>
                </motion.div>
            )}

            {/* РАЗДЕЛЫ НАТАЛЬНОЙ КАРТЫ */}
            <div className="mb-12">
                <motion.h2 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-xl font-semibold text-astro-text mb-6 text-center"
                >
                    {profile.language === 'ru' ? 'Глубокий анализ' : 'Deep Analysis'}
                </motion.h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sections.map((section, index) => (
                        <SectionCard
                            key={section.key}
                            title={getText(profile.language, `chart.${section.key}`)}
                            iconType={section.icon}
                            isPremium={profile.isPremium}
                            language={profile.language}
                            onClick={() => handleDeepDive(section.key)}
                            index={index}
                        />
                    ))}
                </div>
            </div>

            {/* ПРОГНОЗЫ */}
            <div className="mb-12">
                <motion.h2 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="text-xl font-semibold text-astro-text mb-6 text-center"
                >
                    {getText(profile.language, 'chart.forecast_title')}
                </motion.h2>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                >
                    <button
                        onClick={handleForecast}
                        disabled={!profile.isPremium}
                        className={`
                            w-full relative overflow-hidden rounded-2xl p-8 border-2 transition-all duration-300
                            ${profile.isPremium 
                                ? 'bg-gradient-to-br from-astro-card via-astro-card to-astro-bg border-astro-border hover:border-astro-highlight hover:shadow-xl hover:shadow-astro-highlight/20 cursor-pointer' 
                                : 'bg-astro-card/50 border-astro-border/30 cursor-not-allowed opacity-60'
                            }
                        `}
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-astro-highlight/5 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                        
                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center gap-5">
                                <div className={`
                                    w-16 h-16 rounded-2xl flex items-center justify-center
                                    transition-all duration-300
                                    ${profile.isPremium 
                                        ? 'bg-gradient-to-br from-astro-highlight/20 to-astro-highlight/5 hover:scale-110' 
                                        : 'bg-astro-bg/50'
                                    }
                                `}>
                                    <PlanetIcon 
                                        type="forecast" 
                                        className={`w-8 h-8 ${profile.isPremium ? 'text-astro-highlight' : 'text-astro-subtext'}`}
                                    />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-astro-text mb-1">
                                        {getText(profile.language, 'chart.forecast_day')}
                                    </h3>
                                    {!profile.isPremium && (
                                        <p className="text-xs text-astro-subtext uppercase tracking-wider">
                                            {profile.language === 'ru' ? 'Premium доступ' : 'Premium access'}
                                        </p>
                                    )}
                                </div>
                            </div>
                            
                            {profile.isPremium && (
                                <svg className="w-6 h-6 text-astro-subtext hover:text-astro-highlight transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            )}
                        </div>
                    </button>
                </motion.div>
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
