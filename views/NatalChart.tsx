import React, { useState, useEffect, useRef } from 'react';
import { NatalChartData, UserProfile } from '../types';
import { getText } from '../constants';
import { getOrGenerateDeepDive, getOrGenerateHoroscope } from '../services/contentGenerationService';
import { getNatalIntro } from '../services/astrologyService';
import { saveProfile } from '../services/storageService';
import { motion } from 'framer-motion';
import { Loading } from '../components/ui/Loading';
import { RegenerateButton } from '../components/RegenerateButton';
import { AnalysisModal } from '../components/NatalChart/AnalysisModal';

interface NatalChartProps {
    data: NatalChartData | null;
    profile: UserProfile;
    requestPremium: () => void;
    onUpdateProfile?: (profile: UserProfile) => void;
}

/**
 * Красивые символы планет для натальной карты
 */
const getPlanetSymbol = (planetId: string): string => {
    const symbols: Record<string, string> = {
        'sun': '☉',
        'moon': '☽',
        'mercury': '☿',
        'venus': '♀',
        'mars': '♂',
        'jupiter': '♃',
        'saturn': '♄',
        'uranus': '♅',
        'neptune': '♆',
        'pluto': '♇',
        'rising': 'ASC',
        'ascendant': 'ASC'
    };
    return symbols[planetId] || '●';
};

/**
 * Красивые названия планет
 */
const getPlanetFunName = (planetId: string, language: 'ru' | 'en'): string => {
    const names: Record<string, Record<string, string>> = {
        'sun': { ru: 'Солнце', en: 'Sun' },
        'moon': { ru: 'Луна', en: 'Moon' },
        'mercury': { ru: 'Меркурий', en: 'Mercury' },
        'venus': { ru: 'Венера', en: 'Venus' },
        'mars': { ru: 'Марс', en: 'Mars' },
        'rising': { ru: 'Асцендент', en: 'Rising' },
        'ascendant': { ru: 'Асцендент', en: 'Rising' }
    };
    return names[planetId]?.[language] || planetId;
};

/**
 * Премиальные SVG иконки планет для разделов натальной карты
 */
const PlanetIcon: React.FC<{ type: string; className?: string }> = ({ type, className = '' }) => {
    // Вспомогательная функция для получения иконок планет (для тизера)
    // Используем простые символы или SVG
    if (['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'lilith', 'chiron', 'north_node'].includes(type)) {
        const planetSvgs: Record<string, React.ReactNode> = {
            sun: <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" fill="none" />,
            moon: <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-1.1 2.2 6.6 6.6 0 0 1-9.2-9.2c.4-.4.88-.76 1.4-1.04" stroke="currentColor" strokeWidth="2" fill="none" />,
            // Для остальных используем первую букву или заглушку, так как полный набор SVG большой
            // В реальном проекте здесь должны быть все символы планет
            default: <circle cx="12" cy="12" r="4" fill="currentColor" />
        };
        return <svg viewBox="0 0 24 24" className={className}>{planetSvgs[type] || planetSvgs.default}</svg>;
    }

    // Красивые иконки для разделов (без эмодзи)
    const icons: Record<string, React.ReactElement> = {
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
/**
 * Компактная карточка раздела - читаемая и функциональная
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
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={onClick}
            disabled={!isPremium}
            className={`
                w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left
                ${isPremium 
                    ? 'bg-astro-card border-astro-border hover:border-astro-highlight active:scale-[0.99]' 
                    : 'bg-astro-card/50 border-astro-border/50 opacity-60'
                }
            `}
        >
            {/* Иконка */}
            <div className={`
                flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center
                ${isPremium ? 'bg-astro-highlight/20' : 'bg-astro-bg/50'}
            `}>
                <PlanetIcon 
                    type={iconType} 
                    className={`w-6 h-6 ${isPremium ? 'text-astro-highlight' : 'text-astro-subtext'}`}
                />
            </div>
            
            {/* Текст */}
            <div className="flex-1 min-w-0">
                <h3 className={`text-base font-medium ${isPremium ? 'text-astro-text' : 'text-astro-subtext'}`}>
                    {title}
                </h3>
                {!isPremium && (
                    <p className="text-xs text-astro-subtext mt-0.5">
                        {language === 'ru' ? 'Premium' : 'Premium'}
                    </p>
                )}
            </div>
            
            {/* Индикатор */}
            {isPremium ? (
                <span className="text-astro-subtext text-lg">→</span>
            ) : (
                <svg className="w-5 h-5 text-astro-subtext" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            )}
        </motion.button>
    );
};

/**
 * Состояния загрузки натальной карты
 */
type NatalChartLoadingState = 
    | { type: 'idle' }
    | { type: 'loading_intro' }
    | { type: 'loading_analysis'; topic: string }
    | { type: 'loading_forecast' }
    | { type: 'error'; message: string }
    | { type: 'success' };

export const NatalChart: React.FC<NatalChartProps> = ({ data, profile, requestPremium, onUpdateProfile }) => {
    // Состояния модального окна с анализом
    const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
    const [analysisResult, setAnalysisResult] = useState<string>("");
    const [loadingState, setLoadingState] = useState<NatalChartLoadingState>({ type: 'idle' });

    // Валидация данных натальной карты
    if (!data || !data.sun || !data.moon) {
        return <Loading />;
    }

    /**
     * ЧЕТКАЯ ЛОГИКА: Загрузка вступления натальной карты
     * 1. Проверяем кэш в профиле
     * 2. Если нет - загружаем через API
     * 3. Сохраняем в профиль
     * 4. Обновляем состояние
     */
    const natalIntroSource = profile.generatedContent?.natalIntro;
    const [natalIntro, setNatalIntro] = useState<string>(() => {
        // Инициализация: используем кэш или fallback
        if (natalIntroSource && natalIntroSource.length > 50) {
            return natalIntroSource;
        }
        return profile.language === 'ru' 
            ? `Привет, ${profile.name || 'друг'}! Загружаю твою натальную карту...`
            : `Hi, ${profile.name || 'friend'}! Loading your natal chart...`;
    });
    const [isLoadingIntro, setIsLoadingIntro] = useState(!natalIntroSource || natalIntroSource.length < 50);
    const introLoadAttemptedRef = useRef(false);

    /**
     * Загружает вступление натальной карты (один раз при монтировании)
     */
    useEffect(() => {
        // Если уже есть валидное вступление в профиле - используем его
        const cachedIntro = profile.generatedContent?.natalIntro;
        if (cachedIntro && cachedIntro.length > 50) {
            if (cachedIntro !== natalIntro) {
                setNatalIntro(cachedIntro);
            }
            setIsLoadingIntro(false);
            introLoadAttemptedRef.current = true;
            return;
        }

        // Если уже пытались загрузить - не повторяем
        if (introLoadAttemptedRef.current) {
            return;
        }

        // Загружаем вступление (только один раз)
        if (data && !isLoadingIntro && !cachedIntro) {
            introLoadAttemptedRef.current = true;
            setIsLoadingIntro(true);
            setLoadingState({ type: 'loading_intro' });
            
            getNatalIntro(profile, data)
                .then((intro) => {
                    if (intro && intro.length > 50) {
                        setNatalIntro(intro);
                        setLoadingState({ type: 'success' });
                        
                        // Сохраняем в профиль
                        const updatedContent = {
                            ...(profile.generatedContent || {}),
                            natalIntro: intro,
                            timestamps: {
                                ...(profile.generatedContent?.timestamps || {}),
                                natalIntroGenerated: Date.now()
                            }
                        };
                        const updatedProfile = {
                            ...profile,
                            generatedContent: updatedContent
                        };
                        
                        if (onUpdateProfile) {
                            onUpdateProfile(updatedProfile);
                        }
                        
                        saveProfile(updatedProfile).catch((error) => {
                            console.error('Failed to save natal intro:', error);
                        });
                    } else {
                        throw new Error('Intro too short');
                    }
                })
                .catch((error) => {
                    console.error('Failed to load natal intro:', error);
                    const fallback = profile.language === 'ru'
                        ? `Привет, ${profile.name || 'друг'}! Я изучила твою натальную карту. Твоё Солнце в ${data.sun?.sign || 'неизвестном знаке'}, Луна в ${data.moon?.sign || 'неизвестном знаке'}.`
                        : `Hi, ${profile.name || 'friend'}! I've studied your natal chart. Your Sun is in ${data.sun?.sign || 'unknown sign'}, Moon in ${data.moon?.sign || 'unknown sign'}.`;
                    setNatalIntro(fallback);
                    setLoadingState({ type: 'error', message: 'Failed to load intro' });
                })
                .finally(() => {
                    setIsLoadingIntro(false);
                });
        }
    }, [profile.generatedContent?.natalIntro, data, profile, natalIntro]);

    /**
     * ЧЕТКАЯ ЛОГИКА: Обработка Deep Dive анализа
     * 1. Проверяем премиум статус
     * 2. Проверяем кэш
     * 3. Если нет - загружаем
     * 4. Показываем в модальном окне
     */
    const handleDeepDive = async (topicKey: string) => {
        // Шаг 1: Проверка премиум статуса
        if (!profile.isPremium) {
            requestPremium();
            return;
        }
        
        // Шаг 2: Маппинг ключа на тему
        const topicMap: Record<string, 'personality' | 'love' | 'career' | 'weakness' | 'karma'> = {
            'section_personality': 'personality',
            'section_love': 'love',
            'section_career': 'career',
            'section_weakness': 'weakness',
            'section_karma': 'karma'
        };
        
        const topic = topicMap[topicKey];
        if (!topic) {
            console.error(`Unknown topic key: ${topicKey}`);
            return;
        }
        
        const topicTitle = getText(profile.language, `chart.${topicKey}`);
        
        // Шаг 3: Проверка кэша
        const cachedAnalysis = profile.generatedContent?.deepDiveAnalyses?.[topic];
        if (cachedAnalysis && cachedAnalysis.length > 0) {
            setActiveAnalysis(topicTitle);
            setAnalysisResult(cachedAnalysis);
            setLoadingState({ type: 'success' });
            return;
        }
        
        // Шаг 4: Загрузка анализа
        setActiveAnalysis(topicTitle);
        setLoadingState({ type: 'loading_analysis', topic });
        setAnalysisResult("");
        
        try {
            const result = await getOrGenerateDeepDive(profile, data, topic);
            if (result && result.length > 0) {
                setAnalysisResult(result);
                setLoadingState({ type: 'success' });
            } else {
                throw new Error('Empty analysis result');
            }
        } catch (e: any) {
            console.error(`Failed to load deep dive for ${topic}:`, e);
            const errorMessage = profile.language === 'ru' 
                ? 'Звёзды молчат. Попробуйте позже.' 
                : 'The stars are silent. Please try again later.';
            setAnalysisResult(errorMessage);
            setLoadingState({ type: 'error', message: `Failed to load ${topic}` });
        }
    };

    /**
     * ЧЕТКАЯ ЛОГИКА: Обработка прогноза
     * 1. Проверяем премиум статус
     * 2. Проверяем кэш (по дате)
     * 3. Если нет или устарел - загружаем
     * 4. Показываем в модальном окне
     */
    const handleForecast = async () => {
        // Шаг 1: Проверка премиум статуса
        if (!profile.isPremium) {
            requestPremium();
            return;
        }

        const title = getText(profile.language, 'chart.forecast_day');
        const modalTitle = `${getText(profile.language, 'chart.forecast_title')} - ${title}`;

        // Шаг 2: Проверка кэша
        const cachedHoroscope = profile.generatedContent?.dailyHoroscope;
        const today = new Date().toISOString().split('T')[0];
        
        if (cachedHoroscope && 
            cachedHoroscope.date === today && 
            cachedHoroscope.content && 
            cachedHoroscope.content.length > 0) {
            setActiveAnalysis(modalTitle);
            setAnalysisResult(cachedHoroscope.content);
            setLoadingState({ type: 'success' });
            return;
        }

        // Шаг 3: Загрузка прогноза
        setActiveAnalysis(modalTitle);
        setLoadingState({ type: 'loading_forecast' });
        setAnalysisResult("");

        try {
            const horoscope = await getOrGenerateHoroscope(profile, data);
            if (horoscope.content && horoscope.content.length > 0) {
                setAnalysisResult(horoscope.content);
                setLoadingState({ type: 'success' });
            } else {
                throw new Error('Empty horoscope content');
            }
        } catch (e: any) {
            console.error('Failed to load forecast:', e);
            const errorMessage = profile.language === 'ru' 
                ? 'Ошибка космического соединения. Попробуйте позже.' 
                : 'Cosmic connection error. Please try again later.';
            setAnalysisResult(errorMessage);
            setLoadingState({ type: 'error', message: 'Failed to load forecast' });
        }
    };

    const sections = [
        { key: 'section_personality', icon: 'personality' },
        { key: 'section_love', icon: 'love' },
        { key: 'section_career', icon: 'career' },
        { key: 'section_weakness', icon: 'weakness' },
        { key: 'section_karma', icon: 'karma' }
    ];

    return (
        <div className="min-h-screen px-4 py-6 max-w-4xl mx-auto pb-32">
            {/* Заголовок страницы - компактный и читаемый */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center mb-6"
            >
                <h1 className="text-2xl md:text-3xl font-bold mb-2 font-serif text-astro-text">
                    {getText(profile.language, 'chart.title')}
                </h1>
                <p className="text-sm text-astro-subtext">
                    {profile.name ? `${profile.name} • ${profile.birthDate}` : profile.birthDate}
                    {profile.birthTime && ` • ${profile.birthTime}`}
                </p>
            </motion.div>

            {/* ПЛАНЕТЫ: Компактная и читаемая сетка */}
            <div className="mb-6">
                <h2 className="text-base font-semibold text-astro-text mb-4 px-1">
                    {profile.language === 'ru' ? 'Твои планеты' : 'Your Planets'}
                </h2>

                {/* Сетка планет - 3 колонки на мобильном */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                        { id: 'sun', sign: data.sun?.sign, name: getPlanetFunName('sun', profile.language), degree: data.sun?.degree },
                        { id: 'moon', sign: data.moon?.sign, name: getPlanetFunName('moon', profile.language), degree: data.moon?.degree },
                        { id: 'rising', sign: data.rising?.sign, name: getPlanetFunName('rising', profile.language), degree: data.rising?.degree },
                        { id: 'mercury', sign: data.mercury?.sign, name: getPlanetFunName('mercury', profile.language), degree: data.mercury?.degree },
                        { id: 'venus', sign: data.venus?.sign, name: getPlanetFunName('venus', profile.language), degree: data.venus?.degree },
                        { id: 'mars', sign: data.mars?.sign, name: getPlanetFunName('mars', profile.language), degree: data.mars?.degree },
                    ].map((planet, idx) => (
                        <motion.div
                            key={planet.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-astro-card border border-astro-border rounded-xl p-3 text-center"
                        >
                            <div className="text-xl mb-1 text-astro-highlight font-bold">
                                {getPlanetSymbol(planet.id)}
                            </div>
                            <div className="text-[10px] text-astro-subtext uppercase tracking-wide mb-1">
                                {planet.name}
                            </div>
                            <div className="text-sm font-semibold text-astro-text">
                                {planet.sign || '—'}
                            </div>
                            {planet.degree !== undefined && (
                                <div className="text-[10px] text-astro-subtext mt-0.5">
                                    {Math.round(planet.degree)}°
                                </div>
                            )}
                        </motion.div>
                    ))}
                </div>

                {/* Вступление - чистое и читаемое */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="bg-astro-card border border-astro-border rounded-xl p-4"
                >
                    <h3 className="text-sm font-semibold text-astro-text mb-3">
                        {profile.language === 'ru' ? 'Твоя космическая суть' : 'Your Cosmic Essence'}
                    </h3>
                    
                    {isLoadingIntro ? (
                        <div className="flex items-center justify-center py-4">
                            <div className="w-5 h-5 border-2 border-astro-highlight border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <p className="text-sm text-astro-text/90 leading-relaxed">
                            {natalIntro}
                        </p>
                    )}
                    
                    {!profile.isPremium && (
                        <p className="text-xs text-astro-subtext mt-3 pt-3 border-t border-astro-border/50 text-center">
                            {profile.language === 'ru' 
                                ? 'Раскрой полную картину ниже ↓' 
                                : 'Unlock the full picture below ↓'}
                        </p>
                    )}
                </motion.div>
            </div>

            {/* Разделы глубокого анализа */}
            <div className="mb-8">
                <h2 className="text-base font-semibold text-astro-text mb-4 px-1">
                    {profile.language === 'ru' ? 'Глубокий анализ' : 'Deep Analysis'}
                </h2>

                <div className="space-y-3">
                    {sections.map((section, index) => (
                        <SectionCard
                            key={section.key}
                            title={getText(profile.language, `chart.${section.key}`)}
                            iconType={section.icon}
                            isPremium={profile.isPremium}
                            language={profile.language}
                            onClick={() => profile.isPremium ? handleDeepDive(section.key) : requestPremium()}
                            index={index}
                        />
                    ))}
                </div>
            </div>

            {/* Прогноз на день */}
            <div className="mb-8">
                <h2 className="text-base font-semibold text-astro-text mb-4 px-1">
                    {getText(profile.language, 'chart.forecast_title')}
                </h2>

                <button
                    onClick={handleForecast}
                    disabled={!profile.isPremium}
                    className={`
                        w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left
                        ${profile.isPremium 
                            ? 'bg-astro-card border-astro-border hover:border-astro-highlight active:scale-[0.99]' 
                            : 'bg-astro-card/50 border-astro-border/50 opacity-60'
                        }
                    `}
                >
                    <div className={`
                        flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center
                        ${profile.isPremium ? 'bg-astro-highlight/20' : 'bg-astro-bg/50'}
                    `}>
                        <PlanetIcon 
                            type="forecast" 
                            className={`w-6 h-6 ${profile.isPremium ? 'text-astro-highlight' : 'text-astro-subtext'}`}
                        />
                    </div>
                    
                    <div className="flex-1">
                        <h3 className={`text-base font-medium ${profile.isPremium ? 'text-astro-text' : 'text-astro-subtext'}`}>
                            {getText(profile.language, 'chart.forecast_day')}
                        </h3>
                        {!profile.isPremium && (
                            <p className="text-xs text-astro-subtext mt-0.5">Premium</p>
                        )}
                    </div>
                    
                    {profile.isPremium ? (
                        <span className="text-astro-subtext text-lg">→</span>
                    ) : (
                        <svg className="w-5 h-5 text-astro-subtext" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Модалка с детальным анализом */}
            <AnalysisModal
                isOpen={!!activeAnalysis}
                title={activeAnalysis || ''}
                content={analysisResult}
                isLoading={loadingState.type === 'loading_analysis' || loadingState.type === 'loading_forecast'}
                onClose={() => {
                    if (loadingState.type !== 'loading_analysis' && loadingState.type !== 'loading_forecast') {
                        setActiveAnalysis(null);
                        setAnalysisResult("");
                        setLoadingState({ type: 'idle' });
                    }
                }}
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
