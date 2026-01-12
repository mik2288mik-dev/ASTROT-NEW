import React, { useState, useEffect, useRef } from 'react';
import { NatalChartData, UserProfile } from '../types';
import { getText } from '../constants';
import { getOrGenerateDeepDive } from '../services/contentGenerationService';
import { getNatalIntro } from '../services/astrologyService';
import { saveProfile } from '../services/storageService';
import { motion, AnimatePresence } from 'framer-motion';
import { Loading } from '../components/ui/Loading';

interface NatalChartProps {
    data: NatalChartData | null;
    profile: UserProfile;
    requestPremium: () => void;
    onUpdateProfile?: (profile: UserProfile) => void;
}

// Символы планет
const PLANET_SYMBOLS: Record<string, string> = {
    sun: '☉', moon: '☽', mercury: '☿', venus: '♀', mars: '♂',
    jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆', pluto: '♇',
    rising: '↑', ascendant: '↑'
};

// Названия планет
const PLANET_NAMES: Record<string, { ru: string; en: string }> = {
    sun: { ru: 'Солнце', en: 'Sun' },
    moon: { ru: 'Луна', en: 'Moon' },
    rising: { ru: 'Асцендент', en: 'Rising' },
    mercury: { ru: 'Меркурий', en: 'Mercury' },
    venus: { ru: 'Венера', en: 'Venus' },
    mars: { ru: 'Марс', en: 'Mars' },
    jupiter: { ru: 'Юпитер', en: 'Jupiter' },
    saturn: { ru: 'Сатурн', en: 'Saturn' },
};

// Краткие описания планет
const PLANET_MEANINGS: Record<string, { ru: string; en: string }> = {
    sun: { ru: 'твоя суть', en: 'your core' },
    moon: { ru: 'твои эмоции', en: 'your emotions' },
    rising: { ru: 'твоя маска', en: 'your mask' },
    mercury: { ru: 'твой ум', en: 'your mind' },
    venus: { ru: 'твоя любовь', en: 'your love' },
    mars: { ru: 'твоя энергия', en: 'your drive' },
};

// Темы для deep dive
const TOPICS = [
    { id: 'personality', icon: '✨', ru: 'Личность и характер', en: 'Personality & Character', free: true },
    { id: 'love', icon: '💕', ru: 'Любовь и отношения', en: 'Love & Relationships', free: false },
    { id: 'career', icon: '🚀', ru: 'Карьера и призвание', en: 'Career & Purpose', free: false },
    { id: 'weakness', icon: '🌑', ru: 'Тени и слабости', en: 'Shadows & Weaknesses', free: false },
    { id: 'karma', icon: '♾️', ru: 'Кармические уроки', en: 'Karmic Lessons', free: false },
];

export const NatalChart: React.FC<NatalChartProps> = ({ data, profile, requestPremium, onUpdateProfile }) => {
    // Состояния
    const [expandedTopic, setExpandedTopic] = useState<string | null>('personality'); // Личность открыта по умолчанию
    const [topicContent, setTopicContent] = useState<Record<string, string>>({});
    const [loadingTopic, setLoadingTopic] = useState<string | null>(null);
    const [natalIntro, setNatalIntro] = useState<string>('');
    const [isLoadingIntro, setIsLoadingIntro] = useState(true);
    const introLoadedRef = useRef(false);

    const lang = profile.language;

    // Валидация
    if (!data || !data.sun || !data.moon) {
        return <Loading />;
    }

    // Загрузка вступления
    useEffect(() => {
        if (introLoadedRef.current) return;
        
        const cached = profile.generatedContent?.natalIntro;
        if (cached && cached.length > 50) {
            setNatalIntro(cached);
            setIsLoadingIntro(false);
            introLoadedRef.current = true;
            return;
        }

        introLoadedRef.current = true;
        setIsLoadingIntro(true);
        
        getNatalIntro(profile, data)
            .then((intro) => {
                if (intro && intro.length > 50) {
                    setNatalIntro(intro);
                    // Сохраняем в профиль
                    const updated: UserProfile = {
                        ...profile,
                        generatedContent: {
                            ...(profile.generatedContent || {}),
                            natalIntro: intro,
                            timestamps: profile.generatedContent?.timestamps || {}
                        }
                    };
                    onUpdateProfile?.(updated);
                    saveProfile(updated).catch(console.error);
                }
            })
            .catch(console.error)
            .finally(() => setIsLoadingIntro(false));
    }, []);

    // Загрузка контента темы при раскрытии
    useEffect(() => {
        if (!expandedTopic) return;
        
        // Проверяем кэш
        const analyses = profile.generatedContent?.deepDiveAnalyses;
        const cached = analyses ? (analyses as Record<string, string | undefined>)[expandedTopic] : undefined;
        if (cached) {
            setTopicContent(prev => ({ ...prev, [expandedTopic]: cached }));
            return;
        }

        // Если уже загружен локально
        if (topicContent[expandedTopic]) return;

        // Проверяем доступ
        const topic = TOPICS.find(t => t.id === expandedTopic);
        if (!topic?.free && !profile.isPremium) return;

        // Загружаем
        setLoadingTopic(expandedTopic);
        getOrGenerateDeepDive(profile, data, expandedTopic as any)
            .then((content) => {
                if (content) {
                    setTopicContent(prev => ({ ...prev, [expandedTopic]: content }));
                }
            })
            .catch(console.error)
            .finally(() => setLoadingTopic(null));
    }, [expandedTopic, profile.isPremium]);

    // Обработка клика на тему
    const handleTopicClick = (topicId: string) => {
        const topic = TOPICS.find(t => t.id === topicId);
        
        // Если премиум-контент и нет премиума
        if (!topic?.free && !profile.isPremium) {
            requestPremium();
            return;
        }

        // Переключаем раскрытие
        setExpandedTopic(expandedTopic === topicId ? null : topicId);
    };

    // Основные планеты для отображения
    const mainPlanets = [
        { id: 'sun', data: data.sun },
        { id: 'moon', data: data.moon },
        { id: 'rising', data: data.rising },
    ];

    const otherPlanets = [
        { id: 'mercury', data: data.mercury },
        { id: 'venus', data: data.venus },
        { id: 'mars', data: data.mars },
    ];

    const normalizeText = (value: string) => value.replace(/\*/g, '').replace(/\s+\n/g, '\n').trim();
    const splitParagraphs = (value: string) => normalizeText(value)
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
    const renderParagraphs = (value: string) => (
        <div className="space-y-3 text-astro-text leading-relaxed text-[15px]">
            {splitParagraphs(value).map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 12)}`} className="whitespace-pre-line">
                    {paragraph}
                </p>
            ))}
        </div>
    );

    return (
        <div className="min-h-full pb-24">
            {/* Вступление */}
            {(natalIntro || isLoadingIntro) && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-5 pt-6 mb-8"
                >
                    {isLoadingIntro ? (
                        <div className="flex items-center justify-center py-4">
                            <div className="w-5 h-5 border-2 border-astro-highlight border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        renderParagraphs(natalIntro)
                    )}
                </motion.div>
            )}

            {/* Разделы анализа */}
            <div className="px-5">
                <h3 className="text-lg font-semibold text-astro-text mb-4">
                    {lang === 'ru' ? 'Глубже в тебя' : 'Deeper Into You'}
                </h3>

                <div className="space-y-3">
                    {TOPICS.map((topic, idx) => {
                        const isExpanded = expandedTopic === topic.id;
                        const isLocked = !topic.free && !profile.isPremium;
                        const content = topicContent[topic.id];
                        const isLoading = loadingTopic === topic.id;

                        return (
                            <motion.div
                                key={topic.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className={`
                                    border-b border-astro-border/30 overflow-hidden transition-all
                                    ${isLocked ? 'opacity-80' : ''}
                                `}
                            >
                                {/* Заголовок раздела */}
                                <button
                                    onClick={() => handleTopicClick(topic.id)}
                                    className="w-full flex items-center justify-between py-4 text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{topic.icon}</span>
                                        <span className={`font-medium ${isLocked ? 'text-astro-subtext' : 'text-astro-text'}`}>
                                            {topic[lang]}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {isLocked && (
                                            <span className="text-[10px] uppercase tracking-wider text-astro-highlight bg-astro-highlight/10 px-2 py-1 rounded-full">
                                                Premium
                                            </span>
                                        )}
                                        <motion.span
                                            animate={{ rotate: isExpanded ? 180 : 0 }}
                                            className="text-astro-subtext"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </motion.span>
                                    </div>
                                </button>

                                {/* Контент раздела */}
                                <AnimatePresence>
                                    {isExpanded && !isLocked && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="pb-4 pt-0">
                                                <div className="pt-3">
                                                    {isLoading ? (
                                                        <div className="flex items-center justify-center py-8">
                                                            <div className="w-6 h-6 border-2 border-astro-highlight border-t-transparent rounded-full animate-spin" />
                                                        </div>
                                                    ) : content ? (
                                                        renderParagraphs(content)
                                                    ) : (
                                                        <p className="text-astro-subtext text-center py-4">
                                                            {lang === 'ru' ? 'Загружаю космическую мудрость...' : 'Loading cosmic wisdom...'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* CTA для премиума */}
            {!profile.isPremium && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="px-5 mt-8"
                >
                    <button
                        onClick={requestPremium}
                        className="w-full bg-gradient-to-r from-astro-highlight to-purple-500 text-white font-semibold py-4 rounded-2xl active:scale-[0.98] transition-transform"
                    >
                        {lang === 'ru' ? '✨ Открыть полный анализ' : '✨ Unlock Full Analysis'}
                    </button>
                </motion.div>
            )}

            {/* Сводка карты */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-5 mt-10 pb-6"
            >
                <h2 className="text-2xl font-bold text-astro-text mb-1">
                    {lang === 'ru' ? `Привет, ${profile.name || 'друг'}!` : `Hey, ${profile.name || 'friend'}!`}
                </h2>
                <p className="text-astro-subtext mb-4">
                    {lang === 'ru' 
                        ? `${data.sun?.sign} с душой ${data.moon?.sign}`
                        : `${data.sun?.sign} with a ${data.moon?.sign} soul`
                    }
                </p>

                <div className="space-y-3">
                    {mainPlanets.map((planet, idx) => (
                        <motion.div
                            key={planet.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-2xl text-astro-highlight">{PLANET_SYMBOLS[planet.id]}</span>
                                <div>
                                    <div className="text-xs text-astro-subtext uppercase tracking-wider">
                                        {PLANET_NAMES[planet.id]?.[lang]}
                                    </div>
                                    <div className="text-base font-semibold text-astro-text">
                                        {planet.data?.sign || '—'}
                                    </div>
                                </div>
                            </div>
                            <span className="text-xs text-astro-subtext">
                                {PLANET_MEANINGS[planet.id]?.[lang]}
                            </span>
                        </motion.div>
                    ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-astro-subtext">
                    {otherPlanets.map((planet) => (
                        <span key={planet.id} className="flex items-center gap-1">
                            <span className="text-astro-highlight/70">{PLANET_SYMBOLS[planet.id]}</span>
                            <span>{planet.data?.sign || '—'}</span>
                        </span>
                    ))}
                </div>

                <div className="mt-4 text-[11px] text-astro-subtext leading-relaxed">
                    {lang === 'ru' 
                        ? 'Солнце — твоя основа и характер, Луна — эмоции и привычки, Асцендент — первое впечатление и стиль поведения.'
                        : 'Sun = your core, Moon = emotions and habits, Rising = first impression and style.'
                    }
                </div>
            </motion.div>
        </div>
    );
};
