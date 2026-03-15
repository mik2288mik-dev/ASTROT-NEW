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
    chartId?: number;
    requestPremium: () => void;
    onUpdateProfile?: (profile: UserProfile) => void;
    onBalanceUpdate?: (balance: number) => void;
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

export const NatalChart: React.FC<NatalChartProps> = ({ data, profile, chartId, requestPremium, onUpdateProfile, onBalanceUpdate }) => {
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

    // Сброс при смене карты — перезагружаем intro и topic content
    useEffect(() => {
        introLoadedRef.current = false;
        setNatalIntro('');
        setTopicContent({});
    }, [chartId, data?.sun?.sign]);

    // Загрузка вступления (chartId = selected chart; undefined = primary)
    useEffect(() => {
        if (introLoadedRef.current) return;

        // Profile cache только для primary (без chartId)
        const cached = !chartId && profile.generatedContent?.natalIntro;
        if (cached && cached.length > 50) {
            setNatalIntro(cached);
            setIsLoadingIntro(false);
            introLoadedRef.current = true;
            return;
        }

        introLoadedRef.current = true;
        setIsLoadingIntro(true);

        getNatalIntro(profile, data, chartId)
            .then((intro) => {
                if (intro && intro.length > 50) {
                    setNatalIntro(intro);
                    // Сохраняем в профиль только для primary (без chartId)
                    if (!chartId) {
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
                }
            })
            .catch(console.error)
            .finally(() => setIsLoadingIntro(false));
    }, [chartId, data?.sun?.sign]);

    // Загрузка контента темы при раскрытии (chartId = selected chart; undefined = primary)
    useEffect(() => {
        if (!expandedTopic) return;

        // Profile cache только для primary (без chartId)
        const analyses = !chartId && profile.generatedContent?.deepDiveAnalyses;
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

        // Загружаем (API/DB cache по chartId)
        setLoadingTopic(expandedTopic);
        getOrGenerateDeepDive(profile, data, expandedTopic as any, chartId)
            .then((content) => {
                if (content) {
                    setTopicContent(prev => ({ ...prev, [expandedTopic]: content }));
                }
            })
            .catch(console.error)
            .finally(() => setLoadingTopic(null));
    }, [expandedTopic, profile.isPremium, chartId, data?.sun?.sign]);

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

    const greeting = `${getText(lang, 'chart.greeting')}, ${profile.name || getText(lang, 'chart.friend')}!`;
    const soulPhrase = lang === 'ru'
        ? `${data.sun?.sign} ${getText(lang, 'chart.soul_connector')} ${data.moon?.sign}`
        : `${data.sun?.sign} ${getText(lang, 'chart.soul_connector')} ${data.moon?.sign}${getText(lang, 'chart.soul_suffix')}`;

    return (
        <div className="min-h-full screen-pb">
            {/* Intro */}
            {(natalIntro || isLoadingIntro) && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="px-5 pt-6 mb-6"
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

            {/* Chart summary — compact, above deep dive */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-5 mb-6"
            >
                <div className="bg-astro-card/60 rounded-xl border border-astro-border p-4">
                    <h2 className="text-lg font-bold text-astro-text mb-1">{greeting}</h2>
                    <p className="text-astro-subtext text-sm mb-4">{soulPhrase}</p>
                    <div className="grid grid-cols-3 gap-3">
                        {mainPlanets.map((planet) => (
                            <div key={planet.id} className="flex items-center gap-2">
                                <span className="text-lg text-astro-highlight">{PLANET_SYMBOLS[planet.id]}</span>
                                <div className="min-w-0">
                                    <div className="text-[10px] text-astro-subtext uppercase tracking-wider truncate">
                                        {PLANET_NAMES[planet.id]?.[lang]}
                                    </div>
                                    <div className="text-sm font-semibold text-astro-text truncate">
                                        {planet.data?.sign || '—'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-astro-subtext">
                        {otherPlanets.map((planet) => (
                            <span key={planet.id} className="flex items-center gap-1">
                                <span className="text-astro-highlight/70">{PLANET_SYMBOLS[planet.id]}</span>
                                <span>{planet.data?.sign || '—'}</span>
                            </span>
                        ))}
                    </div>
                    <p className="mt-3 text-[10px] text-astro-subtext/80 leading-relaxed">
                        {getText(lang, 'chart.chart_legend')}
                    </p>
                </div>
            </motion.div>

            {/* Deep dive sections */}
            <div className="px-5">
                <h3 className="text-base font-semibold text-astro-text mb-3">
                    {getText(lang, 'chart.deeper')}
                </h3>

                <div className="space-y-2">
                    {TOPICS.map((topic, idx) => {
                        const isExpanded = expandedTopic === topic.id;
                        const isLocked = !topic.free && !profile.isPremium;
                        const content = topicContent[topic.id];
                        const isLoading = loadingTopic === topic.id;

                        return (
                            <motion.div
                                key={topic.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                                className={`
                                    border border-astro-border/50 rounded-lg overflow-hidden transition-all
                                    ${isLocked ? 'opacity-90' : ''}
                                `}
                            >
                                <button
                                    onClick={() => handleTopicClick(topic.id)}
                                    className="w-full flex items-center justify-between py-3 px-4 text-left hover:bg-astro-card/30 transition-colors"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-lg shrink-0">{topic.icon}</span>
                                        <span className={`font-medium text-sm truncate ${isLocked ? 'text-astro-subtext' : 'text-astro-text'}`}>
                                            {topic[lang]}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {isLocked && (
                                            <span className="text-[10px] uppercase tracking-wider text-astro-highlight bg-astro-highlight/10 px-2 py-0.5 rounded-full">
                                                {getText(lang, 'chart.premium_lock')}
                                            </span>
                                        )}
                                        <motion.span
                                            animate={{ rotate: isExpanded ? 180 : 0 }}
                                            className="text-astro-subtext"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </motion.span>
                                    </div>
                                </button>

                                <AnimatePresence>
                                    {isExpanded && !isLocked && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden border-t border-astro-border/50"
                                        >
                                            <div className="p-4 pt-3">
                                                {isLoading ? (
                                                    <div className="flex items-center justify-center py-6">
                                                        <div className="w-5 h-5 border-2 border-astro-highlight border-t-transparent rounded-full animate-spin" />
                                                    </div>
                                                ) : content ? (
                                                    renderParagraphs(content)
                                                ) : (
                                                    <p className="text-astro-subtext text-sm text-center py-4">
                                                        {getText(lang, 'chart.loading_wisdom')}
                                                    </p>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* Premium CTA */}
            {!profile.isPremium && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="px-5 mt-6 pb-6"
                >
                    <button
                        onClick={requestPremium}
                        className="w-full bg-gradient-to-r from-astro-highlight to-purple-500 text-white font-semibold py-3.5 rounded-xl text-sm active:scale-[0.98] transition-transform"
                    >
                        {getText(lang, 'chart.unlock_full')}
                    </button>
                </motion.div>
            )}
        </div>
    );
};
