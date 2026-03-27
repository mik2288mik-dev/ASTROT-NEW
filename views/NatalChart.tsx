import React, { useEffect, useRef, useState } from 'react';
import { NatalChartData, UserProfile } from '../types';
import { getText, getZodiacSign } from '../constants';
import { getOrGenerateDeepDive } from '../services/contentGenerationService';
import { getNatalIntro } from '../services/astrologyService';
import { saveProfile } from '../services/storageService';
import { getTelegramInitDataHeaders } from '../services/sessionService';
import { motion, AnimatePresence } from 'framer-motion';
import { Loading } from '../components/ui/Loading';
import { FormattedAiText } from '../components/ui/FormattedAiText';
import { READING_PAGE_CLASS, READING_SECTION_PAD } from '../components/layout/ReadingLayout';

const NATAL_INTRO_REFRESH_COST = 250;

interface NatalChartProps {
    data: NatalChartData | null;
    profile: UserProfile;
    chartId?: number;
    requestPremium: () => void;
    onUpdateProfile?: (profile: UserProfile) => void;
    onOpenCharts?: () => void;
    onBalanceUpdate?: (balance: number) => void;
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

export const NatalChart: React.FC<NatalChartProps> = ({ data, profile, chartId, requestPremium, onUpdateProfile, onOpenCharts, onBalanceUpdate }) => {
    const [expandedTopic, setExpandedTopic] = useState<DeepDiveTopicId | null>('personality');
    const [topicContent, setTopicContent] = useState<Record<string, string>>({});
    const [loadingTopic, setLoadingTopic] = useState<DeepDiveTopicId | null>(null);
    const [natalIntro, setNatalIntro] = useState<string>('');
    const [isLoadingIntro, setIsLoadingIntro] = useState(true);
    const [refreshIntroBusy, setRefreshIntroBusy] = useState(false);
    const [hasTelegramAuth, setHasTelegramAuth] = useState(false);
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
        setHasTelegramAuth(Object.keys(getTelegramInitDataHeaders()).length > 0);
    }, []);

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

    const lumiBalance = profile.lumiBalance ?? 0;
    const refreshIntroDisabled = refreshIntroBusy || lumiBalance < NATAL_INTRO_REFRESH_COST;

    const handleRefreshIntro = async () => {
        const headers = getTelegramInitDataHeaders();
        if (!Object.keys(headers).length || refreshIntroBusy) return;
        setRefreshIntroBusy(true);
        try {
            const res = await fetch('/api/astrology/refresh-natal-intro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...headers },
                body: JSON.stringify({
                    userId: profile.id,
                    profile,
                    chartData: data,
                    chartId: chartId ?? undefined,
                }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload.message || payload.error || 'refresh failed');
            }
            const intro = payload.intro as string;
            if (intro && intro.length > 50) {
                setNatalIntro(intro);
                introLoadedRef.current = true;
                const newBal = typeof payload.newBalance === 'number' ? payload.newBalance : profile.lumiBalance;
                if (!chartId) {
                    const updated: UserProfile = {
                        ...profile,
                        lumiBalance: newBal,
                        generatedContent: {
                            ...(profile.generatedContent || {}),
                            natalIntro: intro,
                            timestamps: profile.generatedContent?.timestamps || {},
                        },
                    };
                    onUpdateProfile?.(updated);
                    saveProfile(updated).catch(console.error);
                } else if (typeof payload.newBalance === 'number') {
                    onUpdateProfile?.({ ...profile, lumiBalance: newBal });
                }
                if (typeof payload.newBalance === 'number') {
                    onBalanceUpdate?.(payload.newBalance);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setRefreshIntroBusy(false);
        }
    };

    const localizedSun = getZodiacSign(lang, data.sun.sign);
    const localizedMoon = getZodiacSign(lang, data.moon.sign);
    const greeting = `${getText(lang, 'chart.greeting')}, ${profile.name || getText(lang, 'chart.friend')}`;
    const soulPhrase = lang === 'ru'
        ? `${localizedSun} с лунным ритмом ${localizedMoon}`
        : `${localizedSun} with a ${localizedMoon} emotional rhythm`;
    const displayedIntro = natalIntro || data.summary || '';

    const freeTopic = TOPICS.find((item) => item.free)!;
    const premiumTopics = TOPICS.filter((item) => !item.free);

    const renderTopicAccordion = (topic: TopicMeta) => {
        const isExpanded = expandedTopic === topic.id;
        const isLocked = !topic.free && !profile.isPremium;
        const content = topicContent[topic.id];
        const isLoading = loadingTopic === topic.id;
        const panelId = `deep-dive-panel-${topic.id}`;
        const headerId = `deep-dive-header-${topic.id}`;

        return (
            <div
                key={topic.id}
                className={`rounded-2xl border transition-shadow ${
                    isExpanded && !isLocked
                        ? 'border-astro-border bg-astro-card/80 shadow-md shadow-black/5'
                        : isLocked
                          ? 'border-astro-border/60 bg-astro-card/40'
                          : 'border-astro-border/80 bg-astro-card/55 hover:border-astro-highlight/25'
                }`}
            >
                <button
                    type="button"
                    id={headerId}
                    aria-expanded={isExpanded && !isLocked}
                    aria-controls={panelId}
                    onClick={() => handleTopicClick(topic.id)}
                    className="flex w-full items-start gap-3 px-4 py-4 text-left sm:gap-4 sm:px-5 sm:py-5"
                >
                    <span className="mt-0.5 shrink-0 rounded-lg border border-astro-border/80 bg-astro-bg/50 px-2 py-1 font-mono text-[11px] font-semibold tabular-nums text-astro-subtext">
                        {topic.marker}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 gap-y-1">
                            <span className="text-base font-semibold text-astro-text sm:text-[17px]">
                                {getText(lang, topic.titleKey)}
                            </span>
                            <span
                                className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                                    topic.free
                                        ? 'bg-astro-highlight/15 text-astro-highlight'
                                        : 'bg-astro-bg/60 text-astro-subtext'
                                }`}
                            >
                                {topic.free ? getText(lang, 'chart.topic_free_included') : getText(lang, 'chart.premium_lock')}
                            </span>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-astro-subtext sm:text-[15px] sm:leading-relaxed">
                            {getText(lang, topic.teaserKey)}
                        </p>
                    </div>
                    <span
                        className={`mt-1 shrink-0 text-astro-subtext transition-transform duration-200 ${
                            isExpanded && !isLocked ? 'rotate-180' : ''
                        }`}
                        aria-hidden
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span>
                </button>

                <AnimatePresence initial={false}>
                    {isExpanded && !isLocked && (
                        <motion.div
                            id={panelId}
                            role="region"
                            aria-labelledby={headerId}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                            className="overflow-hidden border-t border-astro-border/60"
                        >
                            <div className="border-l-2 border-astro-highlight/30 bg-astro-bg/20 px-5 py-5 sm:px-7 sm:py-6 md:px-8 md:py-8">
                                {isLoading ? (
                                    <div className="flex min-h-[120px] items-center justify-center py-4">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-astro-highlight border-t-transparent" />
                                    </div>
                                ) : content ? (
                                    <FormattedAiText text={content} variant="article" />
                                ) : (
                                    <p className="py-6 text-center text-sm text-astro-subtext">
                                        {getText(lang, 'chart.loading_wisdom')}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    return (
        <div className={`min-h-full screen-pb pb-10 ${READING_PAGE_CLASS}`}>
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-6">
                <div
                    className={`rounded-2xl border border-astro-border/80 bg-gradient-to-b from-astro-card to-astro-card/60 shadow-soft sm:rounded-3xl ${READING_SECTION_PAD}`}
                >
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

                    <div className="mt-5 rounded-xl border border-astro-border/60 bg-astro-bg/20 p-4 sm:rounded-2xl sm:p-5 md:p-6">
                        {isLoadingIntro && !displayedIntro ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-astro-highlight border-t-transparent" />
                            </div>
                        ) : (
                            <FormattedAiText text={displayedIntro} variant="article" />
                        )}
                    </div>
                    {hasTelegramAuth && (
                        <div className="mt-4">
                            <button
                                type="button"
                                onClick={() => void handleRefreshIntro()}
                                disabled={refreshIntroDisabled}
                                className="w-full rounded-xl border border-astro-border/80 bg-astro-bg/20 px-4 py-3 text-left text-sm font-medium text-astro-text transition-colors hover:border-astro-highlight/35 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {refreshIntroBusy
                                    ? getText(lang, 'chart.refresh_intro_loading')
                                    : getText(lang, 'chart.refresh_intro_cta').replace(
                                        '{cost}',
                                        String(NATAL_INTRO_REFRESH_COST)
                                    )}
                            </button>
                            {lumiBalance < NATAL_INTRO_REFRESH_COST && (
                                <p className="mt-2 text-center text-xs text-astro-subtext">
                                    {getText(lang, 'chart.refresh_intro_insufficient')}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </motion.section>

            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 sm:mt-7">
                <div className={`rounded-2xl border border-astro-border/80 bg-astro-card/60 sm:rounded-3xl ${READING_SECTION_PAD}`}>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                        {getText(lang, 'chart.core_title')}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                        {getText(lang, 'chart.core_body')}
                    </p>

                    <div className="mt-5 grid grid-cols-1 gap-3 min-[400px]:grid-cols-3 sm:gap-4">
                        {mainPlanets.map((planet) => (
                            <div
                                key={planet.id}
                                className="rounded-xl border border-astro-border/70 bg-astro-bg/30 p-4 sm:rounded-2xl sm:p-4"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xl text-astro-highlight sm:text-2xl">{PLANET_SYMBOLS[planet.id]}</span>
                                    <span className="text-[10px] font-medium uppercase tracking-wider text-astro-subtext">
                                        {PLANET_NAMES[planet.id]?.[lang]}
                                    </span>
                                </div>
                                <p className="mt-3 text-lg font-semibold text-astro-text sm:text-xl">
                                    {planet.data?.sign ? getZodiacSign(lang, planet.data.sign) : '—'}
                                </p>
                                <p className="mt-1.5 text-xs leading-relaxed text-astro-subtext sm:text-[13px]">
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
                <div className="mt-5">
                    <button
                        onClick={onOpenCharts}
                        className="w-full rounded-2xl border border-astro-border/70 bg-astro-bg/15 px-4 py-3 text-left transition-colors hover:border-astro-highlight/30"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
                                    {getText(lang, 'chart.my_charts_title')}
                                </p>
                                <p className="mt-1 text-sm text-astro-text">
                                    {getText(lang, 'chart.my_charts_body')}
                                </p>
                            </div>
                            <span className="shrink-0 text-xs font-medium text-astro-highlight">
                                {getText(lang, 'chart.my_charts_cta')}
                            </span>
                        </div>
                    </button>
                </div>
            )}

            <section className="mt-7 sm:mt-8">
                <div className={`rounded-2xl border border-astro-border/80 bg-astro-card/55 sm:rounded-3xl ${READING_SECTION_PAD}`}>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                        {getText(lang, 'chart.deeper_section_label')}
                    </p>
                    <h2 className="mt-2 font-serif text-xl text-astro-text">
                        {getText(lang, 'chart.deeper')}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                        {getText(lang, 'chart.deeper_intro')}
                    </p>

                    <div className="mt-6 space-y-8 sm:mt-7">
                        <div>
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-astro-highlight">
                                        {getText(lang, 'chart.deeper_free_label')}
                                    </p>
                                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-astro-subtext sm:text-[15px]">
                                        {getText(lang, 'chart.deeper_free_body')}
                                    </p>
                                </div>
                                <span className="shrink-0 self-start rounded-full border border-astro-highlight/35 bg-astro-highlight/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-astro-highlight">
                                    {getText(lang, 'chart.topic_free_included')}
                                </span>
                            </div>
                            <div className="space-y-3">{renderTopicAccordion(freeTopic)}</div>
                        </div>

                        <div className="border-t border-astro-border/50 pt-8">
                            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-astro-subtext">
                                        {getText(lang, 'chart.deeper_premium_label')}
                                    </p>
                                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-astro-subtext sm:text-[15px]">
                                        {getText(lang, 'chart.deeper_premium_body')}
                                    </p>
                                </div>
                                <span className="shrink-0 self-start rounded-full border border-astro-border bg-astro-bg/40 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-astro-subtext">
                                    {getText(lang, 'chart.premium_lock')}
                                </span>
                            </div>

                            <div className="space-y-3">{premiumTopics.map((topic) => renderTopicAccordion(topic))}</div>
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
                                    className="mt-4 w-full rounded-xl border border-astro-highlight/35 bg-astro-highlight/10 py-3.5 text-sm font-semibold text-astro-highlight transition-colors hover:border-astro-highlight/55 hover:bg-astro-highlight/15"
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
