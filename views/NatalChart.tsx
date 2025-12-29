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
 * Прикольные эмодзи планет для натальной карты! 🌟
 */
const getPlanetEmoji = (planetId: string): string => {
    const emojis: Record<string, string> = {
        'sun': '☀️',
        'moon': '🌙',
        'mercury': '☿️',
        'venus': '♀️',
        'mars': '♂️',
        'jupiter': '♃',
        'saturn': '♄',
        'uranus': '♅',
        'neptune': '♆',
        'pluto': '♇',
        'rising': '⬆️',
        'ascendant': '⬆️'
    };
    return emojis[planetId] || '✨';
};

/**
 * Веселые названия планет
 */
const getPlanetFunName = (planetId: string, language: 'ru' | 'en'): string => {
    const names: Record<string, Record<string, string>> = {
        'sun': { ru: 'Солнышко ☀️', en: 'Sun ☀️' },
        'moon': { ru: 'Луна 🌙', en: 'Moon 🌙' },
        'mercury': { ru: 'Меркурий ☿️', en: 'Mercury ☿️' },
        'venus': { ru: 'Венера ♀️', en: 'Venus ♀️' },
        'mars': { ru: 'Марс ♂️', en: 'Mars ♂️' },
        'rising': { ru: 'Асцендент ⬆️', en: 'Rising ⬆️' },
        'ascendant': { ru: 'Асцендент ⬆️', en: 'Rising ⬆️' }
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

    // Прикольные иконки с эмодзи для разделов
    const icons: Record<string, React.ReactElement> = {
        personality: (
            <div className="text-3xl">✨</div>
        ),
        love: (
            <div className="text-3xl">💕</div>
        ),
        career: (
            <div className="text-3xl">🚀</div>
        ),
        weakness: (
            <div className="text-3xl">🌱</div>
        ),
        karma: (
            <div className="text-3xl">🌀</div>
        ),
        forecast: (
            <div className="text-3xl">🔮</div>
        )
    };
    
    return icons[type] || icons.personality;
};

/**
 * Компонент карточки раздела натальной карты
 */
/**
 * Прикольная карточка раздела с веселыми анимациями! 🎨
 */
const SectionCard: React.FC<{
    title: string;
    iconType: string;
    isPremium: boolean;
    language: 'ru' | 'en';
    onClick: () => void;
    index: number;
}> = ({ title, iconType, isPremium, language, onClick, index }) => {
    // Прикольные эмодзи для разделов
    const sectionEmojis: Record<string, string> = {
        'personality': '✨',
        'love': '💕',
        'career': '🚀',
        'weakness': '🌱',
        'karma': '🌀'
    };
    
    // Веселые подсказки
    const funHints: Record<string, Record<string, string>> = {
        'personality': {
            ru: 'Узнай, кто ты на самом деле!',
            en: 'Discover who you really are!'
        },
        'love': {
            ru: 'Раскрой секреты любви!',
            en: 'Unlock love secrets!'
        },
        'career': {
            ru: 'Найди свой путь к успеху!',
            en: 'Find your path to success!'
        },
        'weakness': {
            ru: 'Преврати слабости в силу!',
            en: 'Turn weaknesses into strength!'
        },
        'karma': {
            ru: 'Узнай свою кармическую задачу!',
            en: 'Discover your karmic mission!'
        }
    };
    
    return (
        <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: index * 0.1, duration: 0.5, type: "spring", stiffness: 200 }}
            whileHover={isPremium ? { scale: 1.02, y: -2 } : {}}
            whileTap={isPremium ? { scale: 0.98 } : {}}
            onClick={onClick}
            disabled={!isPremium}
            className={`
                group relative w-full overflow-hidden rounded-2xl p-6
                border-2 transition-all duration-300 text-left
                ${isPremium 
                    ? 'bg-gradient-to-br from-purple-900/30 via-astro-card to-pink-900/20 border-astro-border hover:border-astro-highlight hover:shadow-2xl hover:shadow-astro-highlight/30 cursor-pointer' 
                    : 'bg-astro-card/30 border-astro-border/30 cursor-not-allowed opacity-70'
                }
            `}
        >
            {/* Прикольные декорации */}
            <motion.div 
                animate={isPremium ? { rotate: 360 } : {}}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-10 -right-10 w-32 h-32 bg-astro-highlight/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"
            />
            
            {/* Содержимое карточки */}
            <div className="relative z-10 flex items-center gap-5">
                {/* Прикольная иконка с эмодзи */}
                <motion.div
                    animate={isPremium ? { rotate: [0, 10, -10, 0] } : {}}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    className={`
                        flex-shrink-0 w-20 h-20 rounded-2xl 
                        flex items-center justify-center text-4xl
                        transition-all duration-300
                        ${isPremium 
                            ? 'bg-gradient-to-br from-astro-highlight/30 to-pink-500/20 group-hover:scale-110 group-hover:rotate-12 shadow-lg' 
                            : 'bg-astro-bg/50'
                        }
                    `}
                >
                    {sectionEmojis[iconType] || '✨'}
                </motion.div>
                
                {/* Текст */}
                <div className="flex-1 min-w-0">
                    <h3 className={`text-xl font-bold mb-2 transition-colors ${isPremium ? 'text-astro-text group-hover:text-astro-highlight' : 'text-astro-subtext'}`}>
                        {title}
                    </h3>
                    {isPremium && funHints[iconType] && (
                        <p className="text-sm text-astro-subtext italic">
                            {funHints[iconType][language]}
                        </p>
                    )}
                    {!isPremium && (
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-lg">🔒</span>
                            <p className="text-xs text-astro-subtext uppercase tracking-wider font-semibold">
                                {language === 'ru' ? 'Premium доступ' : 'Premium access'}
                            </p>
                        </div>
                    )}
                </div>
                
                {/* Прикольная стрелка */}
                {isPremium && (
                    <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="flex-shrink-0 text-astro-subtext group-hover:text-astro-highlight group-hover:translate-x-2 transition-all text-2xl"
                    >
                        →
                    </motion.div>
                )}
            </div>
            
            {/* Блокирующий overlay для free пользователей */}
            {!isPremium && (
                <div className="absolute inset-0 flex items-center justify-center bg-astro-bg/50 backdrop-blur-sm rounded-2xl">
                    <div className="text-center">
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="text-4xl mb-2"
                        >
                            🔒
                        </motion.div>
                        <p className="text-xs text-astro-subtext font-semibold">
                            {language === 'ru' ? 'Разблокируй Premium!' : 'Unlock Premium!'}
                        </p>
                    </div>
                </div>
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
            {/* Прикольный заголовок страницы! 🌟 */}
            <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, type: "spring" }}
                className="text-center mb-8"
            >
                <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
                    className="text-5xl mb-4"
                >
                    🌟
                </motion.div>
                <h1 className="text-3xl md:text-4xl font-bold mb-3 font-serif bg-gradient-to-r from-astro-highlight via-pink-400 to-purple-400 bg-clip-text text-transparent">
                    {getText(profile.language, 'chart.title')}
                </h1>
                <div className="flex items-center justify-center gap-2 text-sm text-astro-subtext">
                    <span className="text-lg">✨</span>
                    <p>
                        {profile.name ? `${profile.name}, ${profile.birthDate}` : profile.birthDate}
                    </p>
                    <span className="text-lg">💫</span>
                </div>
            </motion.div>

            {/* ВСТУПЛЕНИЕ: ТИЗЕР ДЛЯ ВСЕХ (Cosmic Passport) */}
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-4 px-2">
                    <div className="w-1 h-6 bg-astro-highlight rounded-full"></div>
                    <h2 className="text-lg font-serif text-astro-text uppercase tracking-widest">
                        {getText(profile.language, 'chart.free_teaser_title')}
                    </h2>
                </div>

                {/* Прикольный горизонтальный скролл с планетами! 🌟 */}
                <div className="flex overflow-x-auto gap-3 pb-4 px-1 scrollbar-hide snap-x">
                    {[
                        { id: 'sun', sign: data.sun?.sign, name: getPlanetFunName('sun', profile.language) },
                        { id: 'moon', sign: data.moon?.sign, name: getPlanetFunName('moon', profile.language) },
                        { id: 'rising', sign: data.rising?.sign, name: getPlanetFunName('rising', profile.language) },
                        { id: 'mercury', sign: data.mercury?.sign, name: getPlanetFunName('mercury', profile.language) },
                        { id: 'venus', sign: data.venus?.sign, name: getPlanetFunName('venus', profile.language) },
                        { id: 'mars', sign: data.mars?.sign, name: getPlanetFunName('mars', profile.language) },
                    ].map((planet, idx) => (
                        <motion.div
                            key={planet.id}
                            initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{ delay: idx * 0.1, duration: 0.4, type: "spring", stiffness: 200 }}
                            whileHover={{ scale: 1.05, rotate: 5 }}
                            className="snap-start flex-shrink-0 w-32 bg-gradient-to-br from-astro-card/50 via-astro-card/30 to-astro-bg/50 border-2 border-astro-border rounded-2xl p-4 flex flex-col items-center justify-center gap-2 shadow-lg hover:border-astro-highlight/50 transition-all cursor-pointer group"
                        >
                            <motion.div
                                animate={{ rotate: [0, 10, -10, 0] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                                className="w-14 h-14 rounded-full bg-gradient-to-br from-astro-highlight/30 to-astro-highlight/10 border-2 border-astro-highlight/40 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform"
                            >
                                {getPlanetEmoji(planet.id)}
                            </motion.div>
                            <div className="text-center">
                                <p className="text-[10px] text-astro-subtext uppercase tracking-wider font-bold">{planet.name}</p>
                                <p className="text-base font-bold text-astro-text mt-1">{planet.sign || '?'}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Прикольное вступление с веселым дизайном! ✨ */}
                <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="relative bg-gradient-to-br from-purple-900/30 via-astro-card to-pink-900/20 rounded-2xl p-6 border-2 border-astro-border shadow-xl overflow-hidden group hover:border-astro-highlight/50 transition-all"
                >
                    {/* Прикольные декорации */}
                    <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                        className="absolute -top-10 -right-10 w-40 h-40 bg-astro-highlight/20 rounded-full blur-3xl"
                    />
                    <motion.div 
                        animate={{ rotate: -360 }}
                        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                        className="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-500/20 rounded-full blur-2xl"
                    />
                    
                    <div className="relative z-10">
                        <motion.h3 
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.3, type: "spring" }}
                            className="text-base font-bold text-astro-text mb-4 flex items-center gap-3"
                        >
                            <motion.span
                                animate={{ rotate: [0, 15, -15, 0] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                                className="text-2xl"
                            >
                                ✨
                            </motion.span>
                            <span className="bg-gradient-to-r from-astro-highlight to-pink-400 bg-clip-text text-transparent">
                                {profile.language === 'ru' ? 'Твоя Космическая Суть' : 'Your Cosmic Essence'}
                            </span>
                            <motion.span
                                animate={{ rotate: [0, -15, 15, 0] }}
                                transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                                className="text-2xl"
                            >
                                🌟
                            </motion.span>
                        </motion.h3>
                        
                        {isLoadingIntro ? (
                            <Loading message="" />
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="text-base text-astro-text/95 leading-relaxed font-serif italic bg-astro-bg/30 rounded-xl p-4 border border-astro-border/30 backdrop-blur-sm"
                            >
                                <span className="text-2xl mr-2">💫</span>
                                "{natalIntro}"
                                <span className="text-2xl ml-2">✨</span>
                            </motion.div>
                        )}
                        
                        {!profile.isPremium && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.5 }}
                                className="mt-5 pt-4 border-t border-astro-border/30"
                            >
                                <p className="text-xs text-astro-subtext text-center font-semibold">
                                    {profile.language === 'ru' 
                                        ? '🎁 Это лишь 5% твоей карты! Раскрой полную картину ниже 👇' 
                                        : '🎁 This is only 5% of your chart! Unlock the full picture below 👇'}
                                </p>
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Прикольные разделы натальной карты! 🎉 */}
            <div className="mb-12">
                <motion.h2 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4, type: "spring" }}
                    className="text-2xl font-bold text-astro-text mb-6 text-center flex items-center justify-center gap-3"
                >
                    <motion.span
                        animate={{ rotate: [0, 20, -20, 0] }}
                        transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                        className="text-3xl"
                    >
                        🔮
                    </motion.span>
                    <span className="bg-gradient-to-r from-astro-highlight via-pink-400 to-purple-400 bg-clip-text text-transparent">
                        {profile.language === 'ru' ? 'Глубокий Анализ' : 'Deep Analysis'}
                    </span>
                    <motion.span
                        animate={{ rotate: [0, -20, 20, 0] }}
                        transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                        className="text-3xl"
                    >
                        ✨
                    </motion.span>
                </motion.h2>

                <div className="grid grid-cols-1 gap-4">
                    {sections.map((section, index) => (
                        <div key={section.key} className="relative group">
                            {/* Карточка */}
                            <SectionCard
                                title={getText(profile.language, `chart.${section.key}`)}
                                iconType={section.icon}
                                isPremium={profile.isPremium}
                                language={profile.language}
                                onClick={() => profile.isPremium ? handleDeepDive(section.key) : requestPremium()}
                                index={index}
                            />
                            
                            {/* BLUR EFFECT FOR FREE USERS: Добавляем визуализацию скрытого контента */}
                            {!profile.isPremium && (
                                <div className="absolute top-[70%] left-6 right-6 bottom-4 pointer-events-none overflow-hidden">
                                    <div className="flex flex-col gap-2 opacity-30 blur-[2px]">
                                        <div className="h-2 w-3/4 bg-astro-subtext rounded"></div>
                                        <div className="h-2 w-1/2 bg-astro-subtext rounded"></div>
                                    </div>
                                    {/* Замок по центру */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-astro-bg/80 backdrop-blur-sm p-2 rounded-full border border-astro-highlight/30 shadow-lg">
                                            <svg className="w-4 h-4 text-astro-highlight" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
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
