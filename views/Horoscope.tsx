import React, { useState, useEffect, useMemo, memo } from 'react';
import { UserProfile, NatalChartData, DailyHoroscope } from '../types';
import { getOrGenerateHoroscope } from '../services/contentGenerationService';
import { Loading } from '../components/ui/Loading';
import { ZodiacHeader } from '../components/Horoscope/ZodiacHeader';
import { HoroscopeContent } from '../components/Horoscope/HoroscopeContent';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import { getText } from '../constants';

interface HoroscopeProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    onUpdateProfile?: (profile: UserProfile) => void;
    onOpenChart?: () => void;
    onRequestPremium?: () => void;
}

type HoroscopeApiError = Error & {
    code?: string;
};

const getPersistNotice = (language: string) =>
    getText(language as 'ru' | 'en', 'horoscope.persist_notice');

const getStaleNotice = (language: string) =>
    getText(language as 'ru' | 'en', 'horoscope.stale_notice');

const getFallbackError = (language: string) =>
    getText(language as 'ru' | 'en', 'horoscope.fallback_error');

export const Horoscope = memo<HoroscopeProps>(({ profile, chartData, onUpdateProfile, onOpenChart, onRequestPremium }) => {
    const [horoscope, setHoroscope] = useState<DailyHoroscope | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isStale, setIsStale] = useState(false);

    const sunSign = useMemo(() => chartData?.sun?.sign || 'Aries', [chartData?.sun?.sign]);
    const language = useMemo(() => profile.language, [profile.language]);
    const signals = useMemo(() => {
        const items = [
            horoscope?.mood
                ? {
                      label: getText(language, 'dashboard.mood'),
                      value: horoscope.mood,
                  }
                : null,
            horoscope?.color
                ? {
                      label: getText(language, 'dashboard.color'),
                      value: horoscope.color,
                  }
                : null,
            horoscope?.number
                ? {
                      label: getText(language, 'horoscope.number'),
                      value: String(horoscope.number),
                  }
                : null,
        ];

        return items.filter(Boolean) as Array<{ label: string; value: string }>;
    }, [horoscope?.color, horoscope?.mood, horoscope?.number, language]);

    useEffect(() => {
        const cached = profile.generatedContent?.dailyHoroscope;
        const today = getMoscowTodayKey();
        if (cached && cached.date === today && cached.content && cached.content.length > 0) {
            setHoroscope(cached);
            setIsStale(false);
            setStatusMessage(
                cached.persisted === false || cached.code === 'DAILY_PERSIST_FAILED'
                    ? getPersistNotice(language)
                    : null
            );
            setLoading(false);
        }
    }, [language, profile.generatedContent?.dailyHoroscope]);

    useEffect(() => {
        let cancelled = false;

        const loadHoroscope = async () => {
            if (!chartData) {
                if (!cancelled) {
                    setHoroscope(null);
                    setStatusMessage(null);
                    setLoading(false);
                }
                return;
            }

            const today = getMoscowTodayKey();
            const cachedHoroscope = profile.generatedContent?.dailyHoroscope;

            if (cachedHoroscope && cachedHoroscope.date === today && cachedHoroscope.content && cachedHoroscope.content.length > 0) {
                if (!cancelled) {
                    setHoroscope(cachedHoroscope);
                    setIsStale(false);
                    setStatusMessage(
                        cachedHoroscope.persisted === false || cachedHoroscope.code === 'DAILY_PERSIST_FAILED'
                            ? getPersistNotice(language)
                            : null
                    );
                    setLoading(false);
                }
                return;
            }

            if (!cancelled) {
                setLoading(true);
                setStatusMessage(null);
                setIsStale(false);
            }

            let lastError: HoroscopeApiError | null = null;

            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const data = await getOrGenerateHoroscope(profile, chartData);
                    if (cancelled) return;

                    setHoroscope(data);
                    setIsStale(false);
                    setStatusMessage(
                        data.persisted === false || data.code === 'DAILY_PERSIST_FAILED'
                            ? getPersistNotice(language)
                            : null
                    );

                    if (onUpdateProfile) {
                        const updatedProfile = { ...profile };
                        if (!updatedProfile.generatedContent) {
                            updatedProfile.generatedContent = {
                                timestamps: {}
                            };
                        }
                        updatedProfile.generatedContent.dailyHoroscope = data;
                        updatedProfile.generatedContent.timestamps = {
                            ...(updatedProfile.generatedContent.timestamps || {}),
                            dailyHoroscopeGenerated: Date.now(),
                        };
                        onUpdateProfile(updatedProfile);
                    }

                    setLoading(false);
                    return;
                } catch (error: any) {
                    lastError = error as HoroscopeApiError;

                    if (lastError?.code === 'GENERATION_IN_PROGRESS' && attempt === 0) {
                        await new Promise((resolve) => setTimeout(resolve, 2500));
                        continue;
                    }

                    break;
                }
            }

            if (cancelled) return;

            if (cachedHoroscope && cachedHoroscope.content) {
                const stale = cachedHoroscope.date !== today;
                setHoroscope(cachedHoroscope);
                setIsStale(stale);
                setStatusMessage(lastError?.message || (stale ? getStaleNotice(language) : null));
            } else {
                setHoroscope(null);
                setStatusMessage(lastError?.message || getFallbackError(language));
            }

            setLoading(false);
        };

        loadHoroscope();

        return () => {
            cancelled = true;
        };
    }, [profile.id, profile.generatedContent?.dailyHoroscope?.date, chartData?.sun?.sign, language, onUpdateProfile]);

    if (loading) {
        return <Loading message={getText(language, 'horoscope.loading')} />;
    }

    if (!horoscope || !chartData) {
        return (
            <div className="flex min-h-full items-center justify-center px-5 py-8">
                <div className="w-full max-w-md rounded-[24px] border border-astro-border/80 bg-astro-card/70 p-6 text-center">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                        {getText(language, 'horoscope.today_layer_label')}
                    </p>
                    <h1 className="mt-3 font-serif text-2xl text-astro-text">
                        {getText(language, 'horoscope.empty_title')}
                    </h1>
                    <p className="mt-3 text-sm leading-relaxed text-astro-subtext">
                        {statusMessage || getText(language, 'horoscope.empty_body')}
                    </p>
                    {onOpenChart && (
                        <button
                            onClick={onOpenChart}
                            className="mt-5 w-full rounded-xl border border-astro-highlight/30 bg-astro-highlight/10 px-4 py-3 text-sm font-medium text-astro-highlight transition-colors hover:border-astro-highlight/50"
                        >
                            {getText(language, 'horoscope.empty_cta')}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen max-w-2xl mx-auto px-5 pt-6 space-y-4 screen-pb">
            <section className="rounded-[24px] border border-astro-border/80 bg-gradient-to-b from-astro-card to-astro-card/65 p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                            {getText(language, 'horoscope.today_layer_label')}
                        </p>
                        <h1 className="mt-2 font-serif text-2xl text-astro-text">
                            {getText(language, 'horoscope.title')}
                        </h1>
                    </div>
                    {horoscope?.date && (
                        <span className="shrink-0 rounded-full border border-astro-border/70 bg-astro-bg/25 px-3 py-1.5 text-[11px] text-astro-subtext">
                            {formatLumiaDate(horoscope.date, language)}
                        </span>
                    )}
                </div>

                <p className="mt-3 text-sm leading-relaxed text-astro-subtext">
                    {getText(language, 'horoscope.subtitle')}
                </p>

                {statusMessage && (
                    <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs leading-relaxed ${isStale ? 'bg-astro-bg/20 border-astro-border text-astro-subtext' : 'bg-astro-highlight/10 border-astro-highlight/30 text-astro-text'}`}>
                        {statusMessage}
                    </div>
                )}
            </section>

            <section className="rounded-[24px] border border-astro-border/80 bg-astro-card/60 p-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                    {getText(language, 'horoscope.foundation_label')}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                    {getText(language, 'horoscope.foundation_body')}
                </p>
                <div className="mt-5">
                    <ZodiacHeader sunSign={sunSign} language={language} />
                </div>
            </section>

            {signals.length > 0 && (
                <section className="rounded-[24px] border border-astro-border/80 bg-astro-card/55 p-5">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                        {getText(language, 'horoscope.signals_title')}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                        {getText(language, 'horoscope.signals_body')}
                    </p>

                    <div className={`mt-4 grid gap-3 ${signals.length === 1 ? 'grid-cols-1' : signals.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {signals.map((signal) => (
                            <div
                                key={signal.label}
                                className="rounded-2xl border border-astro-border/70 bg-astro-bg/25 p-4 text-center"
                            >
                                <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
                                    {signal.label}
                                </p>
                                <p className="mt-2 text-sm font-medium text-astro-text">
                                    {signal.value}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <HoroscopeContent 
                content={horoscope.content || ''}
                moonImpact={horoscope.moonImpact}
                transitFocus={horoscope.transitFocus}
                language={language}
            />

            <section className="rounded-[24px] border border-astro-border/80 bg-astro-card/45 p-5">
                <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                    {getText(language, 'horoscope.bridge_label')}
                </p>
                <h2 className="mt-2 font-serif text-xl text-astro-text">
                    {getText(language, 'horoscope.bridge_title')}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                    {getText(language, 'horoscope.bridge_body')}
                </p>

                <div className="mt-5 space-y-3">
                    {onOpenChart && (
                        <button
                            onClick={onOpenChart}
                            className="w-full rounded-xl border border-astro-highlight/30 bg-astro-highlight/10 px-4 py-3 text-sm font-medium text-astro-highlight transition-colors hover:border-astro-highlight/50"
                        >
                            {getText(language, 'horoscope.open_chart')}
                        </button>
                    )}

                    {!profile.isPremium && onRequestPremium && (
                        <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/20 p-4">
                            <p className="text-sm font-medium text-astro-text">
                                {getText(language, 'horoscope.premium_title')}
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                                {getText(language, 'horoscope.premium_body')}
                            </p>
                            <button
                                onClick={onRequestPremium}
                                className="mt-3 text-sm font-medium text-astro-highlight"
                            >
                                {getText(language, 'horoscope.premium_cta')}
                            </button>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
});

Horoscope.displayName = 'Horoscope';
