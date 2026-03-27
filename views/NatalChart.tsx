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

/** Drop AI duplicate opener when it repeats the screen greeting (Привет, Имя). */
function stripRedundantIntroGreeting(raw: string, name: string | undefined): string {
    if (!raw?.trim() || !name?.trim()) return raw;
    const parts = raw.trim().split(/\n{2,}/);
    const first = parts[0]?.replace(/\*/g, '').trim().toLowerCase() || '';
    const n = name.trim().toLowerCase();
    const isGreeting =
        first.length < 140 &&
        (first.startsWith(`привет, ${n}`) ||
            first.startsWith(`привет ${n}`) ||
            first.startsWith(`hi, ${n}`) ||
            first.startsWith(`hey, ${n}`));
    if (!isGreeting || parts.length < 2) return raw;
    return parts.slice(1).join('\n\n').trim() || raw;
}

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

    const handleTopicSelect = (topicId: DeepDiveTopicId) => {
        const topic = TOPICS.find((item) => item.id === topicId);
        if (!topic?.free && !profile.isPremium) {
            requestPremium();
            return;
        }
        setExpandedTopic(topicId);
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
    const displayedIntro = stripRedundantIntroGreeting(natalIntro || data.summary || '', profile.name);

    const freeTopic = TOPICS.find((item) => item.free)!;
    const premiumTopics = TOPICS.filter((item) => !item.free);

    const activeTopicMeta = expandedTopic ? TOPICS.find((t) => t.id === expandedTopic) : null;
    const activeContent = expandedTopic ? topicContent[expandedTopic] : '';
    const activeLoading = expandedTopic ? loadingTopic === expandedTopic : false;

    const chipWrapClass =
        'flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-2';

    const renderTopicChip = (topic: TopicMeta) => {
        const selected = expandedTopic === topic.id;
        const locked = !topic.free && !profile.isPremium;
        return (
            <button
                key={topic.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => (locked ? requestPremium() : handleTopicSelect(topic.id))}
                className={`w-full rounded-xl border px-3 py-2.5 text-center text-[13px] font-medium leading-snug transition-all sm:min-h-[3rem] sm:w-[calc(50%-0.25rem)] sm:px-3 sm:text-sm ${
                    locked
                        ? 'border-astro-border/50 bg-astro-bg/20 text-astro-subtext/80'
                        : selected
                          ? 'border-astro-highlight/40 bg-astro-highlight/10 text-astro-text shadow-sm'
                          : 'border-astro-border/70 bg-astro-card/60 text-astro-text hover:border-astro-highlight/25 hover:bg-astro-bg/25'
                }`}
            >
                <span className="block [text-wrap:balance]">{getText(lang, topic.titleKey)}</span>
                {locked && (
                    <span className="mt-1 block text-[10px] font-normal uppercase tracking-wider text-astro-subtext">
                        {getText(lang, 'chart.premium_lock')}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div className={`min-h-full screen-pb pb-10 ${READING_PAGE_CLASS}`}>
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-6">
                <div
                    className={`rounded-2xl border border-astro-border/80 bg-gradient-to-b from-astro-card to-astro-card/60 shadow-soft sm:rounded-3xl ${READING_SECTION_PAD}`}
                >
                    <div className="flex items-start justify-between gap-4 border-b border-astro-border/35 pb-5">
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                                {getText(lang, 'chart.summary')}
                            </p>
                            <h1 className="mt-2 font-serif text-2xl font-semibold text-astro-text">
                                {greeting}
                            </h1>
                            <p className="mt-2 text-sm text-astro-subtext">{soulPhrase}</p>
                        </div>
                        <span className="shrink-0 rounded-full border border-astro-highlight/25 bg-astro-highlight/8 px-2.5 py-1 text-[9px] uppercase tracking-widest text-astro-highlight">
                            {getText(lang, 'chart.free_layer_label')}
                        </span>
                    </div>

                    <div className="pt-6">
                        {isLoadingIntro && !displayedIntro ? (
                            <div className="flex items-center justify-center py-10">
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
                    <h2 className="mt-2 font-serif text-xl text-astro-text sm:text-2xl">
                        {getText(lang, 'chart.deeper')}
                    </h2>
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-astro-subtext sm:text-[15px]">
                        {getText(lang, 'chart.deeper_intro')}
                    </p>

                    <div className="mt-6 space-y-5">
                        <div>
                            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-astro-highlight">
                                {getText(lang, 'chart.deeper_free_label')}
                            </p>
                            <div className={`${chipWrapClass} mt-2.5`} role="tablist" aria-label={getText(lang, 'chart.deeper')}>
                                {renderTopicChip(freeTopic)}
                            </div>
                        </div>

                        <div>
                            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-astro-subtext">
                                {getText(lang, 'chart.deeper_premium_label')}
                            </p>
                            <div
                                className={`${chipWrapClass} mt-2.5`}
                                role="tablist"
                                aria-label={getText(lang, 'chart.deeper_premium_label')}
                            >
                                {premiumTopics.map((t) => renderTopicChip(t))}
                            </div>
                        </div>

                        <div className="rounded-xl border border-astro-border/60 bg-astro-bg/15 p-5 sm:rounded-2xl sm:p-6 md:p-7">
                            {activeTopicMeta && (
                                <div className="mb-5 border-b border-astro-border/40 pb-5">
                                    <h3 className="font-serif text-lg text-astro-text sm:text-xl">
                                        {getText(lang, activeTopicMeta.titleKey)}
                                    </h3>
                                    <p className="mt-2 text-sm leading-relaxed text-astro-subtext sm:text-[15px]">
                                        {getText(lang, activeTopicMeta.teaserKey)}
                                    </p>
                                </div>
                            )}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={expandedTopic || 'none'}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.18 }}
                                >
                                    {activeLoading ? (
                                        <div className="flex min-h-[140px] items-center justify-center py-6">
                                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-astro-highlight/40 border-t-astro-highlight" />
                                        </div>
                                    ) : activeContent ? (
                                        <FormattedAiText text={activeContent} variant="article" />
                                    ) : (
                                        <p className="py-4 text-center text-sm text-astro-subtext">
                                            {getText(lang, 'chart.loading_wisdom')}
                                        </p>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>

                        {!profile.isPremium && (
                            <div className="rounded-xl border border-astro-border/70 bg-astro-bg/20 p-4 sm:p-5">
                                <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
                                    Lumia Premium
                                </p>
                                <p className="mt-1 text-sm leading-relaxed text-astro-subtext">
                                    {getText(lang, 'chart.premium_value_body')}
                                </p>
                                <button
                                    type="button"
                                    onClick={requestPremium}
                                    className="mt-3 w-full rounded-lg border border-astro-highlight/35 bg-astro-highlight/10 py-3 text-sm font-semibold text-astro-highlight transition-colors hover:bg-astro-highlight/15"
                                >
                                    {getText(lang, 'chart.unlock_full')}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};
