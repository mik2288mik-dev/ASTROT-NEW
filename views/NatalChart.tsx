import React, { useEffect, useRef, useState } from 'react';
import { NatalChartData, UserProfile } from '../types';
import { getText, getZodiacSign } from '../constants';
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
    onOpenCharts?: () => void;
}

type DeepDiveTopicId = 'personality' | 'love' | 'career' | 'weakness' | 'karma';

type TopicMeta = {
    id: DeepDiveTopicId;
    marker: string;
    titleKey: string;
    teaserKey: string;
    free: boolean;
};

const PLANET_SYMBOLS: Record<string, string> = {
    sun: '☉',
    moon: '☽',
    mercury: '☿',
    venus: '♀',
    mars: '♂',
    rising: '↑',
    ascendant: '↑',
};

const PLANET_NAMES: Record<string, { ru: string; en: string }> = {
    sun: { ru: 'Солнце', en: 'Sun' },
    moon: { ru: 'Луна', en: 'Moon' },
    rising: { ru: 'Асцендент', en: 'Rising' },
    mercury: { ru: 'Меркурий', en: 'Mercury' },
    venus: { ru: 'Венера', en: 'Venus' },
    mars: { ru: 'Марс', en: 'Mars' },
};

const PLANET_MEANINGS: Record<string, { ru: string; en: string }> = {
    sun: { ru: 'твоя основа', en: 'your core' },
    moon: { ru: 'эмоции и ритм', en: 'your emotional rhythm' },
    rising: { ru: 'то, как ты входишь в мир', en: 'how you meet the world' },
    mercury: { ru: 'мышление', en: 'mind' },
    venus: { ru: 'близость', en: 'love style' },
    mars: { ru: 'драйв', en: 'drive' },
};

const TOPICS: TopicMeta[] = [
    { id: 'personality', marker: '01', titleKey: 'chart.section_personality', teaserKey: 'chart.topic_personality_teaser', free: true },
    { id: 'love', marker: '02', titleKey: 'chart.section_love', teaserKey: 'chart.topic_love_teaser', free: false },
    { id: 'career', marker: '03', titleKey: 'chart.section_career', teaserKey: 'chart.topic_career_teaser', free: false },
    { id: 'weakness', marker: '04', titleKey: 'chart.section_weakness', teaserKey: 'chart.topic_weakness_teaser', free: false },
    { id: 'karma', marker: '05', titleKey: 'chart.section_karma', teaserKey: 'chart.topic_karma_teaser', free: false },
];

export const NatalChart: React.FC<NatalChartProps> = ({ data, profile, chartId, requestPremium, onUpdateProfile, onOpenCharts }) => {
    const [expandedTopic, setExpandedTopic] = useState<DeepDiveTopicId | null>('personality');
    const [topicContent, setTopicContent] = useState<Record<string, string>>({});
    const [loadingTopic, setLoadingTopic] = useState<DeepDiveTopicId | null>(null);
    const [natalIntro, setNatalIntro] = useState<string>('');
    const [isLoadingIntro, setIsLoadingIntro] = useState(true);
    const introLoadedRef = useRef(false);
    const apiInFlightRef = useRef(false);

    const lang = profile.language;

    if (!data || !data.sun || !data.moon) {
        return <Loading />;
    }

    useEffect(() => {
        introLoadedRef.current = false;
        apiInFlightRef.current = false;
        setNatalIntro('');
        setTopicContent({});
        setExpandedTopic('personality');
    }, [chartId, data.sun.sign]);

    useEffect(() => {
        if (chartId) return;
        const cached = profile.generatedContent?.natalIntro;
        if (cached && cached.length > 50) {
            setNatalIntro(cached);
            setIsLoadingIntro(false);
            introLoadedRef.current = true;
        }
    }, [chartId, profile.generatedContent?.natalIntro]);

    useEffect(() => {
        const cached = !chartId && profile.generatedContent?.natalIntro;
        if (cached && cached.length > 50) {
            setNatalIntro(cached);
            setIsLoadingIntro(false);
            introLoadedRef.current = true;
            return;
        }

        if (introLoadedRef.current || apiInFlightRef.current) return;

        apiInFlightRef.current = true;
        setIsLoadingIntro(true);

        getNatalIntro(profile, data, chartId)
            .then((intro) => {
                if (intro && intro.length > 50) {
                    setNatalIntro(intro);
                    introLoadedRef.current = true;
                    if (!chartId) {
                        const updated: UserProfile = {
                            ...profile,
                            generatedContent: {
                                ...(profile.generatedContent || {}),
                                natalIntro: intro,
                                timestamps: profile.generatedContent?.timestamps || {},
                            },
                        };
                        onUpdateProfile?.(updated);
                        saveProfile(updated).catch(console.error);
                    }
                }
            })
            .catch(console.error)
            .finally(() => {
                apiInFlightRef.current = false;
                setIsLoadingIntro(false);
            });
    }, [chartId, data.sun.sign, onUpdateProfile, profile, profile.generatedContent?.natalIntro]);

    useEffect(() => {
        if (!expandedTopic || chartId) return;
        const analyses = profile.generatedContent?.deepDiveAnalyses as Record<string, string | undefined> | undefined;
        const cached = analyses?.[expandedTopic];
        if (cached) {
            setTopicContent((prev) => ({ ...prev, [expandedTopic]: cached }));
        }
    }, [chartId, expandedTopic, profile.generatedContent?.deepDiveAnalyses]);

    useEffect(() => {
        if (!expandedTopic) return;

        const analyses = !chartId ? profile.generatedContent?.deepDiveAnalyses : undefined;
        const cached = analyses ? (analyses as Record<string, string | undefined>)[expandedTopic] : undefined;
        if (cached) {
            setTopicContent((prev) => ({ ...prev, [expandedTopic]: cached }));
            return;
        }

        if (topicContent[expandedTopic]) return;

        const topic = TOPICS.find((item) => item.id === expandedTopic);
        if (!topic?.free && !profile.isPremium) return;

        setLoadingTopic(expandedTopic);
        getOrGenerateDeepDive(profile, data, expandedTopic, chartId)
            .then((content) => {
                if (content) {
                    setTopicContent((prev) => ({ ...prev, [expandedTopic]: content }));
                }
            })
            .catch(console.error)
            .finally(() => setLoadingTopic(null));
    }, [chartId, data, expandedTopic, profile, profile.generatedContent?.deepDiveAnalyses, profile.isPremium, topicContent]);

    const handleTopicClick = (topicId: DeepDiveTopicId) => {
        const topic = TOPICS.find((item) => item.id === topicId);
        if (!topic?.free && !profile.isPremium) {
            requestPremium();
            return;
        }

        setExpandedTopic((prev) => (prev === topicId ? null : topicId));
    };

    const mainPlanets = [
        { id: 'sun', data: data.sun },
        { id: 'moon', data: data.moon },
        { id: 'rising', data: data.rising },
    ];

    const otherPlanets = [
        { id: 'mercury', data: data.mercury },
        { id: 'venus', data: data.venus },
        { id: 'mars', data: data.mars },
    ].filter((planet) => planet.data);

    const normalizeText = (value: string) => value.replace(/\*/g, '').replace(/\s+\n/g, '\n').trim();
    const splitParagraphs = (value: string) => normalizeText(value)
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
    const renderParagraphs = (value: string) => (
        <div className="space-y-3 text-[15px] leading-relaxed text-astro-text">
            {splitParagraphs(value).map((paragraph, index) => (
                <p key={`${index}-${paragraph.slice(0, 12)}`} className="whitespace-pre-line">
                    {paragraph}
                </p>
            ))}
        </div>
    );

    const localizedSun = getZodiacSign(lang, data.sun.sign);
    const localizedMoon = getZodiacSign(lang, data.moon.sign);
    const greeting = `${getText(lang, 'chart.greeting')}, ${profile.name || getText(lang, 'chart.friend')}`;
    const soulPhrase = lang === 'ru'
        ? `${localizedSun} с лунным ритмом ${localizedMoon}`
        : `${localizedSun} with a ${localizedMoon} emotional rhythm`;
    const displayedIntro = natalIntro || data.summary || '';

    const freeTopic = TOPICS.find((item) => item.free)!;
    const premiumTopics = TOPICS.filter((item) => !item.free);

    const renderTopicCard = (topic: TopicMeta) => {
        const isExpanded = expandedTopic === topic.id;
        const isLocked = !topic.free && !profile.isPremium;
        const content = topicContent[topic.id];
        const isLoading = loadingTopic === topic.id;

        return (
            <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`overflow-hidden rounded-2xl border transition-colors ${
                    isLocked
                        ? 'border-astro-border/70 bg-astro-card/45'
                        : 'border-astro-border bg-astro-card/60'
                }`}
            >
                <button
                    onClick={() => handleTopicClick(topic.id)}
                    className="w-full px-4 py-4 text-left transition-colors hover:bg-astro-card/70"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <div className="flex items-center gap-3">
                                <span className="rounded-full border border-astro-border bg-astro-bg/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-astro-subtext">
                                    {topic.marker}
                                </span>
                                <span className="text-sm font-semibold text-astro-text">
                                    {getText(lang, topic.titleKey)}
                                </span>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-astro-subtext">
                                {getText(lang, topic.teaserKey)}
                            </p>
                        </div>

                        <div className="shrink-0 pt-0.5">
                            <span className={`rounded-full px-2 py-1 text-[10px] uppercase tracking-widest ${
                                topic.free
                                    ? 'border border-astro-highlight/30 bg-astro-highlight/10 text-astro-highlight'
                                    : 'border border-astro-border bg-astro-bg/50 text-astro-subtext'
                            }`}>
                                {topic.free ? getText(lang, 'chart.topic_free_included') : getText(lang, 'chart.premium_lock')}
                            </span>
                        </div>
                    </div>
                </button>

                <AnimatePresence initial={false}>
                    {isExpanded && !isLocked && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden border-t border-astro-border/70"
                        >
                            <div className="px-4 py-4">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-6">
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-astro-highlight border-t-transparent" />
                                    </div>
                                ) : content ? (
                                    renderParagraphs(content)
                                ) : (
                                    <p className="py-4 text-center text-sm text-astro-subtext">
                                        {getText(lang, 'chart.loading_wisdom')}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    };

    return (
        <div className="min-h-full screen-pb pb-8">
            <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-5 pt-6"
            >
                <div className="rounded-[24px] border border-astro-border bg-gradient-to-b from-astro-card to-astro-card/60 p-5 shadow-soft">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                                {getText(lang, 'chart.summary')}
                            </p>
                            <h1 className="mt-2 font-serif text-2xl font-semibold text-astro-text">
                                {greeting}
                            </h1>
                        </div>
                        <span className="rounded-full border border-astro-highlight/30 bg-astro-highlight/10 px-3 py-1 text-[10px] uppercase tracking-widest text-astro-highlight">
                            {getText(lang, 'chart.free_layer_label')}
                        </span>
                    </div>

                    <p className="mt-3 text-sm text-astro-subtext">
                        {soulPhrase}
                    </p>

                    <div className="mt-5 rounded-2xl border border-astro-border/70 bg-astro-bg/25 p-4">
                        {isLoadingIntro && !displayedIntro ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-astro-highlight border-t-transparent" />
                            </div>
                        ) : (
                            renderParagraphs(displayedIntro)
                        )}
                    </div>
                </div>
            </motion.section>

            <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-5 mt-6"
            >
                <div className="rounded-[24px] border border-astro-border bg-astro-card/65 p-5">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                        {getText(lang, 'chart.core_title')}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                        {getText(lang, 'chart.core_body')}
                    </p>

                    <div className="mt-5 grid grid-cols-3 gap-3">
                        {mainPlanets.map((planet) => (
                            <div key={planet.id} className="rounded-2xl border border-astro-border/70 bg-astro-bg/30 p-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-lg text-astro-highlight">{PLANET_SYMBOLS[planet.id]}</span>
                                    <span className="text-[10px] uppercase tracking-widest text-astro-subtext">
                                        {PLANET_NAMES[planet.id]?.[lang]}
                                    </span>
                                </div>
                                <p className="mt-3 text-base font-semibold text-astro-text">
                                    {planet.data?.sign ? getZodiacSign(lang, planet.data.sign) : '—'}
                                </p>
                                <p className="mt-1 text-[11px] leading-relaxed text-astro-subtext">
                                    {PLANET_MEANINGS[planet.id]?.[lang]}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {otherPlanets.map((planet) => (
                            <span
                                key={planet.id}
                                className="inline-flex items-center gap-2 rounded-full border border-astro-border/70 bg-astro-bg/25 px-3 py-2 text-xs text-astro-subtext"
                            >
                                <span className="text-astro-highlight">{PLANET_SYMBOLS[planet.id]}</span>
                                <span>{PLANET_NAMES[planet.id]?.[lang]}</span>
                                <span>·</span>
                                <span>{planet.data?.sign ? getZodiacSign(lang, planet.data.sign) : '—'}</span>
                            </span>
                        ))}
                    </div>

                    <p className="mt-4 text-[11px] leading-relaxed text-astro-subtext/85">
                        {getText(lang, 'chart.chart_legend')}
                    </p>
                </div>
            </motion.section>

            {onOpenCharts && (
                <div className="px-5 mt-5">
                    <button
                        onClick={onOpenCharts}
                        className="w-full rounded-2xl border border-astro-border/80 bg-astro-card/35 px-4 py-3 text-left transition-colors hover:border-astro-highlight/35"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
                                    {lang === 'ru' ? 'Мои карты' : 'My Charts'}
                                </p>
                                <p className="mt-1 text-sm text-astro-text">
                                    {lang === 'ru'
                                        ? 'Primary chart, saved profiles, slots и Synastry в одном месте.'
                                        : 'Primary chart, saved profiles, slots, and Synastry in one place.'}
                                </p>
                            </div>
                            <span className="shrink-0 text-xs font-medium text-astro-highlight">
                                {lang === 'ru' ? 'Открыть' : 'Open'}
                            </span>
                        </div>
                    </button>
                </div>
            )}

            <section className="px-5 mt-6">
                <div className="rounded-[24px] border border-astro-border bg-astro-card/55 p-5">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                        {getText(lang, 'chart.deeper')}
                    </p>
                    <h2 className="mt-2 font-serif text-xl text-astro-text">
                        {getText(lang, 'chart.deeper')}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                        {getText(lang, 'chart.deeper_intro')}
                    </p>

                    <div className="mt-5 space-y-5">
                        <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/25 p-4">
                            <div className="mb-4 flex items-center justify-between gap-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-astro-highlight">
                                        {getText(lang, 'chart.deeper_free_label')}
                                    </p>
                                    <p className="mt-1 text-sm text-astro-subtext">
                                        {getText(lang, 'chart.deeper_free_body')}
                                    </p>
                                </div>
                                <span className="rounded-full border border-astro-highlight/30 bg-astro-highlight/10 px-3 py-1 text-[10px] uppercase tracking-widest text-astro-highlight">
                                    {getText(lang, 'chart.topic_free_included')}
                                </span>
                            </div>
                            {renderTopicCard(freeTopic)}
                        </div>

                        <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/25 p-4">
                            <div className="mb-4 flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
                                        {getText(lang, 'chart.deeper_premium_label')}
                                    </p>
                                    <p className="mt-1 text-sm text-astro-subtext">
                                        {getText(lang, 'chart.deeper_premium_body')}
                                    </p>
                                </div>
                                <span className="rounded-full border border-astro-border bg-astro-card px-3 py-1 text-[10px] uppercase tracking-widest text-astro-subtext">
                                    {getText(lang, 'chart.premium_lock')}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {premiumTopics.map((topic) => renderTopicCard(topic))}
                            </div>
                        </div>

                        {!profile.isPremium && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="rounded-2xl border border-astro-highlight/30 bg-gradient-to-b from-astro-highlight/10 to-transparent p-5"
                            >
                                <p className="text-[10px] uppercase tracking-widest text-astro-highlight">
                                    Lumia Premium
                                </p>
                                <h3 className="mt-2 font-serif text-lg text-astro-text">
                                    {getText(lang, 'chart.premium_value_title')}
                                </h3>
                                <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                                    {getText(lang, 'chart.premium_value_body')}
                                </p>
                                <button
                                    onClick={requestPremium}
                                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-astro-highlight to-purple-500 py-3.5 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
                                >
                                    {getText(lang, 'chart.unlock_full')}
                                </button>
                            </motion.div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};
