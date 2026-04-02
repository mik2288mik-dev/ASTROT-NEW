import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
    DailyHoroscope,
    ForecastDailyReading,
    ForecastDaypartReading,
    ForecastDaypartSlot,
    ForecastMonthlyReading,
    ForecastWeeklyReading,
    NatalChartData,
    UserProfile,
} from '../types';
import {
    ensureMonthlyForecastLayer,
    ensureWeeklyForecastLayer,
    getCachedDailyForecastLayer,
    getCachedDailyHoroscope,
    getCachedPremiumDaypartForecast,
    getDailyForecastLayer,
    getDailyHoroscope,
    getPremiumDaypartForecast,
    mapForecastDailyToLegacyHoroscope,
    mapLegacyHoroscopeToForecastDailyReading,
} from '../services/astrologyService';
import { Loading } from '../components/ui/Loading';
import { ZodiacHeader } from '../components/Horoscope/ZodiacHeader';
import { HoroscopeContent } from '../components/Horoscope/HoroscopeContent';
import { formatLumiaDate, getMoscowIsoWeekKey, getMoscowMonthKey, getMoscowTodayKey } from '../lib/date-utils';
import { getText } from '../constants';
import { READING_GLASS_SECTION_CLASS, READING_PAGE_CLASS } from '../components/layout/ReadingLayout';
import { ReadingScreenShell } from '../components/layout/ScreenShell';

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

const DAYPART_SLOTS: ForecastDaypartSlot[] = ['morning', 'day', 'evening'];

const getPersistNotice = (language: string) =>
    getText(language as 'ru' | 'en', 'horoscope.persist_notice');

const getStaleNotice = (language: string) =>
    getText(language as 'ru' | 'en', 'horoscope.stale_notice');

const getFallbackError = (language: string) =>
    getText(language as 'ru' | 'en', 'horoscope.fallback_error');

function isValidHoroscopeForToday(cached: DailyHoroscope | null | undefined, today: string): cached is DailyHoroscope {
    if (!cached?.content || cached.content.length === 0) return false;
    if (cached.date === today) return true;
    if (!cached.date) return true;
    return false;
}

function getLegacyStatusMessage(language: string, legacy: DailyHoroscope | null | undefined) {
    if (!legacy) return null;
    if (legacy.persisted === false || legacy.code === 'DAILY_PERSIST_FAILED') {
        return getPersistNotice(language);
    }
    return legacy.message || null;
}

export const Horoscope = memo<HoroscopeProps>(({ profile, chartData, onUpdateProfile, onOpenChart, onRequestPremium }) => {
    const profileRef = useRef(profile);
    profileRef.current = profile;

    const today = getMoscowTodayKey();
    const language = useMemo(() => profile.language, [profile.language]);
    const sunSign = useMemo(() => chartData?.sun?.sign || 'Aries', [chartData?.sun?.sign]);

    const [dailyReading, setDailyReading] = useState<ForecastDailyReading | null>(() => {
        const cached = profile.generatedContent?.dailyHoroscope;
        if (!isValidHoroscopeForToday(cached, today)) return null;
        return mapLegacyHoroscopeToForecastDailyReading(cached, language);
    });
    const [dayparts, setDayparts] = useState<Partial<Record<ForecastDaypartSlot, ForecastDaypartReading>>>({});
    const [loading, setLoading] = useState(() => !isValidHoroscopeForToday(profile.generatedContent?.dailyHoroscope, today));
    const [daypartsLoading, setDaypartsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [daypartsStatus, setDaypartsStatus] = useState<string | null>(null);
    const [isStale, setIsStale] = useState(false);
    const [weeklyReading, setWeeklyReading] = useState<ForecastWeeklyReading | null>(null);
    const [monthlyReading, setMonthlyReading] = useState<ForecastMonthlyReading | null>(null);
    const [periodLoading, setPeriodLoading] = useState(false);
    const [periodError, setPeriodError] = useState<string | null>(null);

    const weekKey = getMoscowIsoWeekKey();
    const monthKey = getMoscowMonthKey();

    const syncLegacyIntoProfile = (legacy: DailyHoroscope) => {
        if (!onUpdateProfile) return;

        const current = profileRef.current;
        const nextProfile = { ...current };
        if (!nextProfile.generatedContent) {
            nextProfile.generatedContent = { timestamps: {} };
        } else {
            nextProfile.generatedContent = { ...nextProfile.generatedContent };
        }

        nextProfile.generatedContent.dailyHoroscope = legacy;
        nextProfile.generatedContent.timestamps = {
            ...(nextProfile.generatedContent.timestamps || {}),
            dailyHoroscopeGenerated: Date.now(),
        };
        onUpdateProfile(nextProfile);
    };

    const applyLegacyForecast = (
        raw: DailyHoroscope,
        options?: {
            syncProfile?: boolean;
            stale?: boolean;
            statusMessage?: string | null;
        }
    ) => {
        const normalized = { ...raw, date: raw.date || today };
        setDailyReading(mapLegacyHoroscopeToForecastDailyReading(normalized, language));
        setIsStale(Boolean(options?.stale));
        setStatusMessage(options?.statusMessage ?? getLegacyStatusMessage(language, normalized));
        setLoading(false);

        if (options?.syncProfile) {
            syncLegacyIntoProfile(normalized);
        }
    };

    const applyDailyForecast = (
        reading: ForecastDailyReading,
        options?: {
            syncProfile?: boolean;
            source?: string;
            statusMessage?: string | null;
        }
    ) => {
        const normalized = mapForecastDailyToLegacyHoroscope(reading, {
            source: options?.source,
            persisted: true,
            message: options?.statusMessage || undefined,
        });

        setDailyReading(reading);
        setIsStale(false);
        setStatusMessage(options?.statusMessage || null);
        setLoading(false);

        if (options?.syncProfile) {
            syncLegacyIntoProfile(normalized);
        }
    };

    useEffect(() => {
        const cached = profile.generatedContent?.dailyHoroscope;
        if (isValidHoroscopeForToday(cached, today)) {
            applyLegacyForecast(cached, { syncProfile: false });
        }
    }, [language, profile.generatedContent?.dailyHoroscope, today]);

    useEffect(() => {
        let cancelled = false;

        const loadHoroscope = async () => {
            if (!chartData) {
                if (!cancelled) {
                    setDailyReading(null);
                    setStatusMessage(null);
                    setLoading(false);
                }
                return;
            }

            const cachedLegacy = profile.generatedContent?.dailyHoroscope;
            if (isValidHoroscopeForToday(cachedLegacy, today)) {
                if (!cancelled) {
                    applyLegacyForecast(cachedLegacy, { syncProfile: false });
                }
                return;
            }

            try {
                const cachedReading = await getCachedDailyForecastLayer(String(profile.id));
                if (cancelled) return;
                if (cachedReading) {
                    applyDailyForecast(cachedReading, { syncProfile: true, source: 'cache' });
                    return;
                }
            } catch {
                // fallback below
            }

            try {
                const cachedLegacyFromApi = await getCachedDailyHoroscope(
                    String(profile.id),
                    profile.language === 'en' ? 'en' : 'ru'
                );
                if (cancelled) return;
                if (cachedLegacyFromApi?.content && cachedLegacyFromApi.content.length > 0) {
                    applyLegacyForecast(cachedLegacyFromApi, { syncProfile: true });
                    return;
                }
            } catch {
                // fallback below
            }

            if (!cancelled) {
                setLoading(true);
                setStatusMessage(null);
                setIsStale(false);
            }

            let lastError: HoroscopeApiError | null = null;

            try {
                const reading = await getDailyForecastLayer(profileRef.current, chartData);
                if (cancelled) return;
                applyDailyForecast(reading, { syncProfile: true, source: 'generated' });
                return;
            } catch (error: any) {
                lastError = error as HoroscopeApiError;
            }

            try {
                const legacy = await getDailyHoroscope(profileRef.current, chartData);
                if (cancelled) return;
                applyLegacyForecast(legacy, { syncProfile: true });
                return;
            } catch (error: any) {
                lastError = error as HoroscopeApiError;
            }

            if (cancelled) return;

            const fallback = profileRef.current.generatedContent?.dailyHoroscope;
            if (fallback?.content) {
                const stale = fallback.date !== today;
                applyLegacyForecast(fallback, {
                    syncProfile: false,
                    stale,
                    statusMessage: lastError?.message || (stale ? getStaleNotice(language) : null),
                });
                return;
            }

            setDailyReading(null);
            setStatusMessage(lastError?.message || getFallbackError(language));
            setLoading(false);
        };

        void loadHoroscope();

        return () => {
            cancelled = true;
        };
    }, [chartData, language, profile.id, today]);

    useEffect(() => {
        let cancelled = false;

        const loadDayparts = async () => {
            if (!chartData || !profile.isPremium) {
                if (!cancelled) {
                    setDayparts({});
                    setDaypartsLoading(false);
                    setDaypartsStatus(null);
                }
                return;
            }

            setDaypartsStatus(null);

            const userId = String(profile.id);
            const cachedPairs = await Promise.all(
                DAYPART_SLOTS.map(async (slot) => {
                    const reading = await getCachedPremiumDaypartForecast(userId, slot);
                    return [slot, reading] as const;
                })
            );

            if (cancelled) return;

            const next: Partial<Record<ForecastDaypartSlot, ForecastDaypartReading>> = {};
            const slotsToGenerate: ForecastDaypartSlot[] = [];

            for (const [slot, reading] of cachedPairs) {
                if (reading) {
                    next[slot] = reading;
                } else {
                    slotsToGenerate.push(slot);
                }
            }

            setDayparts(next);

            if (slotsToGenerate.length === 0) {
                setDaypartsLoading(false);
                setDaypartsStatus(null);
                return;
            }

            setDaypartsLoading(true);

            const results = await Promise.allSettled(
                slotsToGenerate.map(async (slot) => {
                    const reading = await getPremiumDaypartForecast(profileRef.current, chartData, slot);
                    return [slot, reading] as const;
                })
            );

            if (cancelled) return;

            const merged: Partial<Record<ForecastDaypartSlot, ForecastDaypartReading>> = { ...next };
            const failures: string[] = [];

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    const [slot, reading] = result.value;
                    merged[slot] = reading;
                } else {
                    failures.push(result.reason?.message || '');
                }
            }

            setDayparts(merged);
            setDaypartsLoading(false);
            setDaypartsStatus(
                DAYPART_SLOTS.some((s) => merged[s]) ? null : failures[0] || getFallbackError(language)
            );
        };

        void loadDayparts();

        return () => {
            cancelled = true;
        };
    }, [chartData, language, profile.id, profile.isPremium]);

    useEffect(() => {
        let cancelled = false;

        const loadPeriodLayers = async () => {
            if (!chartData || !profile.id) {
                if (!cancelled) {
                    setWeeklyReading(null);
                    setMonthlyReading(null);
                    setPeriodLoading(false);
                    setPeriodError(null);
                }
                return;
            }

            setPeriodLoading(true);
            setPeriodError(null);

            try {
                const [w, m] = await Promise.all([
                    ensureWeeklyForecastLayer(profileRef.current, chartData, weekKey),
                    ensureMonthlyForecastLayer(profileRef.current, chartData, monthKey),
                ]);
                if (!cancelled) {
                    setWeeklyReading(w);
                    setMonthlyReading(m);
                }
            } catch (e: any) {
                if (!cancelled) {
                    setPeriodError(e?.message || getText(language, 'horoscope.period_error'));
                    setWeeklyReading(null);
                    setMonthlyReading(null);
                }
            } finally {
                if (!cancelled) setPeriodLoading(false);
            }
        };

        void loadPeriodLayers();

        return () => {
            cancelled = true;
        };
    }, [chartData, language, monthKey, profile.id, profile.isPremium, weekKey]);

    if (loading) {
        return <Loading message={getText(language, 'horoscope.loading')} />;
    }

    if (!dailyReading || !chartData) {
        return (
            <div className={`flex min-h-full items-center justify-center py-8 ${READING_PAGE_CLASS}`}>
                <div className={`${READING_GLASS_SECTION_CLASS} w-full text-center`}>
                    <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.today_layer_label')}</p>
                    <h1 className="mt-2 font-serif text-xl text-astro-text sm:text-2xl">
                        {getText(language, 'horoscope.empty_title')}
                    </h1>
                    <p className="lumia-muted mt-2 text-sm leading-relaxed">
                        {statusMessage || getText(language, 'horoscope.empty_body')}
                    </p>
                    {onOpenChart && (
                        <button
                            type="button"
                            onClick={onOpenChart}
                            className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-astro-highlight/12 px-4 py-2.5 text-sm font-medium text-astro-highlight ring-1 ring-astro-highlight/28 transition-[box-shadow] hover:ring-astro-highlight/45"
                        >
                            {getText(language, 'horoscope.empty_cta')}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <ReadingScreenShell>
            <section className={READING_GLASS_SECTION_CLASS}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.today_layer_label')}</p>
                        <h1 className="mt-1.5 font-serif text-xl text-astro-text sm:text-2xl">
                            {getText(language, 'horoscope.title')}
                        </h1>
                    </div>
                    {dailyReading.date && (
                        <span className="shrink-0 rounded-full bg-astro-text/[0.07] px-2.5 py-1 text-[11px] lumia-muted">
                            {formatLumiaDate(dailyReading.date, language)}
                        </span>
                    )}
                </div>

                <p className="lumia-muted mt-2 text-sm leading-relaxed">{getText(language, 'horoscope.subtitle')}</p>

                {statusMessage && (
                    <div
                        className={`mt-3 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                            isStale
                                ? 'lumia-glass-inset lumia-muted'
                                : 'bg-astro-highlight/12 text-astro-text ring-1 ring-astro-highlight/25'
                        }`}
                    >
                        {statusMessage}
                    </div>
                )}
            </section>

            <section className={READING_GLASS_SECTION_CLASS}>
                <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.foundation_label')}</p>
                <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.foundation_body')}</p>
                <div className="mt-3">
                    <ZodiacHeader sunSign={sunSign} language={language} />
                </div>
            </section>

            <HoroscopeContent reading={dailyReading} language={language} />

            <section className={READING_GLASS_SECTION_CLASS}>
                <p className="lumia-label tracking-[0.2em]">
                    {getText(language, profile.isPremium ? 'horoscope.dayparts_label' : 'horoscope.premium_label')}
                </p>
                <h2 className="mt-1.5 font-serif text-lg text-astro-text sm:text-xl">
                    {getText(language, profile.isPremium ? 'horoscope.dayparts_title' : 'horoscope.premium_title')}
                </h2>
                <p className="lumia-muted mt-1.5 text-sm leading-relaxed">
                    {getText(language, profile.isPremium ? 'horoscope.dayparts_body' : 'horoscope.premium_body')}
                </p>

                {profile.isPremium ? (
                    <div className="mt-4 space-y-3">
                        {daypartsLoading && (
                            <div className="lumia-glass-inset px-4 py-3 text-sm lumia-muted">
                                {getText(language, 'horoscope.dayparts_loading')}
                            </div>
                        )}

                        {daypartsStatus && !daypartsLoading && (
                            <div className="lumia-glass-inset px-4 py-3 text-sm lumia-muted">
                                {daypartsStatus}
                            </div>
                        )}

                        {DAYPART_SLOTS.filter((slot) => dayparts[slot]).map((slot) => {
                            const reading = dayparts[slot];
                            if (!reading) return null;

                            const details = [
                                { label: getText(language, 'horoscope.daypart_focus_title'), value: reading.focus },
                                { label: getText(language, 'horoscope.daypart_relationships_title'), value: reading.relationships },
                                { label: getText(language, 'horoscope.daypart_money_title'), value: reading.money },
                            ];

                            return (
                                <div key={slot} className="lumia-glass-inset p-4 sm:p-4.5">
                                    <p className="lumia-label tracking-[0.16em]">{getText(language, `horoscope.slot_${slot}`)}</p>
                                    <h3 className="mt-1.5 text-lg font-semibold text-astro-text sm:text-xl">{reading.headline}</h3>
                                    <p className="lumia-muted mt-2 text-sm leading-relaxed">{reading.summary}</p>

                                    <div className="mt-4 space-y-2.5">
                                        {details.map((item) => (
                                            <div key={item.label} className="border-b border-astro-border/12 pb-2.5 last:border-b-0 last:pb-0">
                                                <p className="lumia-label text-[10px] tracking-[0.16em]">{item.label}</p>
                                                <p className="mt-1 text-sm leading-relaxed text-astro-text sm:text-[15px]">{item.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-4">
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.daypart_guidance_title')}</p>
                                        <p className="mt-1.5 text-sm leading-relaxed text-astro-text sm:text-[15px]">{reading.guidance}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    onRequestPremium && (
                        <div className="mt-4 rounded-2xl border border-astro-highlight/16 bg-astro-highlight/[0.06] px-4 py-4">
                            <p className="text-sm leading-relaxed text-astro-text">
                                {getText(language, 'horoscope.premium_supporting_line')}
                            </p>
                            <button
                                type="button"
                                onClick={onRequestPremium}
                                className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-astro-highlight"
                            >
                                {getText(language, 'horoscope.premium_cta')}
                            </button>
                        </div>
                    )
                )}
            </section>

            <section className={READING_GLASS_SECTION_CLASS}>
                <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.weekly_label')}</p>
                <h2 className="mt-1.5 font-serif text-lg text-astro-text sm:text-xl">{getText(language, 'horoscope.weekly_title')}</h2>
                <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.weekly_body')}</p>

                {periodLoading && (
                    <div className="lumia-glass-inset mt-4 px-4 py-3 text-sm lumia-muted">
                        {getText(language, 'horoscope.period_loading')}
                    </div>
                )}

                {periodError && !periodLoading && (
                    <div className="lumia-glass-inset mt-4 px-4 py-3 text-sm text-amber-200/90">{periodError}</div>
                )}

                {weeklyReading && !periodLoading && (
                    <div className="mt-4 space-y-4">
                        <p className="text-[11px] uppercase tracking-wider text-astro-subtext">{weeklyReading.periodLabel}</p>
                        <h3 className="font-serif text-lg text-astro-text sm:text-xl">{weeklyReading.headline}</h3>
                        <p className="text-sm leading-relaxed text-astro-text sm:text-[15px]">{weeklyReading.summary}</p>
                        <div>
                            <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.focus_title')}</p>
                            <p className="mt-1 text-sm leading-relaxed text-astro-text">{weeklyReading.focus}</p>
                        </div>

                        {profile.isPremium && weeklyReading.theme ? (
                            <div className="space-y-3 rounded-2xl border border-astro-border/40 bg-astro-card/30 p-4">
                                <div>
                                    <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_theme')}</p>
                                    <p className="mt-1 text-sm font-medium text-astro-text">{weeklyReading.theme}</p>
                                </div>
                                {weeklyReading.opportunities ? (
                                    <div>
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_opportunities')}</p>
                                        <p className="mt-1 text-sm leading-relaxed text-astro-text">{weeklyReading.opportunities}</p>
                                    </div>
                                ) : null}
                                {weeklyReading.challenges ? (
                                    <div>
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_challenges')}</p>
                                        <p className="mt-1 text-sm leading-relaxed text-astro-text">{weeklyReading.challenges}</p>
                                    </div>
                                ) : null}
                                {weeklyReading.relationships ? (
                                    <div>
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_relationships')}</p>
                                        <p className="mt-1 text-sm leading-relaxed text-astro-text">{weeklyReading.relationships}</p>
                                    </div>
                                ) : null}
                                {weeklyReading.career ? (
                                    <div>
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_career')}</p>
                                        <p className="mt-1 text-sm leading-relaxed text-astro-text">{weeklyReading.career}</p>
                                    </div>
                                ) : null}
                                {weeklyReading.guidance ? (
                                    <div>
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_guidance')}</p>
                                        <p className="mt-1 text-sm leading-relaxed text-astro-text">{weeklyReading.guidance}</p>
                                    </div>
                                ) : null}
                                {weeklyReading.reading ? (
                                    <div>
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_reading')}</p>
                                        <div className="mt-2 space-y-3 text-sm leading-relaxed text-astro-text whitespace-pre-line [text-wrap:pretty]">
                                            {weeklyReading.reading}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        {!profile.isPremium && onRequestPremium ? (
                            <div className="rounded-2xl border border-astro-highlight/16 bg-astro-highlight/[0.06] px-4 py-4">
                                <p className="text-sm leading-relaxed text-astro-text">
                                    {getText(language, 'horoscope.period_premium_hint_weekly')}
                                </p>
                                <button
                                    type="button"
                                    onClick={onRequestPremium}
                                    className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-astro-highlight"
                                >
                                    {getText(language, 'horoscope.premium_cta')}
                                </button>
                            </div>
                        ) : null}
                    </div>
                )}
            </section>

            <section className={READING_GLASS_SECTION_CLASS}>
                <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.monthly_label')}</p>
                <h2 className="mt-1.5 font-serif text-lg text-astro-text sm:text-xl">{getText(language, 'horoscope.monthly_title')}</h2>
                <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.monthly_body')}</p>

                {monthlyReading && !periodLoading && (
                    <div className="mt-4 space-y-4">
                        <p className="text-[11px] uppercase tracking-wider text-astro-subtext">{monthlyReading.periodLabel}</p>
                        <h3 className="font-serif text-lg text-astro-text sm:text-xl">{monthlyReading.headline}</h3>
                        <p className="text-sm leading-relaxed text-astro-text sm:text-[15px]">{monthlyReading.summary}</p>
                        <div>
                            <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.focus_title')}</p>
                            <p className="mt-1 text-sm leading-relaxed text-astro-text">{monthlyReading.focus}</p>
                        </div>

                        {profile.isPremium && monthlyReading.theme ? (
                            <div className="space-y-3 rounded-2xl border border-astro-border/40 bg-astro-card/30 p-4">
                                <div>
                                    <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_theme')}</p>
                                    <p className="mt-1 text-sm font-medium text-astro-text">{monthlyReading.theme}</p>
                                </div>
                                {monthlyReading.opportunities ? (
                                    <div>
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_opportunities')}</p>
                                        <p className="mt-1 text-sm leading-relaxed text-astro-text">{monthlyReading.opportunities}</p>
                                    </div>
                                ) : null}
                                {monthlyReading.challenges ? (
                                    <div>
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_challenges')}</p>
                                        <p className="mt-1 text-sm leading-relaxed text-astro-text">{monthlyReading.challenges}</p>
                                    </div>
                                ) : null}
                                {monthlyReading.relationships ? (
                                    <div>
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_relationships')}</p>
                                        <p className="mt-1 text-sm leading-relaxed text-astro-text">{monthlyReading.relationships}</p>
                                    </div>
                                ) : null}
                                {monthlyReading.money ? (
                                    <div>
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_money')}</p>
                                        <p className="mt-1 text-sm leading-relaxed text-astro-text">{monthlyReading.money}</p>
                                    </div>
                                ) : null}
                                {monthlyReading.guidance ? (
                                    <div>
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_guidance')}</p>
                                        <p className="mt-1 text-sm leading-relaxed text-astro-text">{monthlyReading.guidance}</p>
                                    </div>
                                ) : null}
                                {monthlyReading.reading ? (
                                    <div>
                                        <p className="lumia-label text-[10px] tracking-[0.16em]">{getText(language, 'horoscope.period_reading')}</p>
                                        <div className="mt-2 space-y-3 text-sm leading-relaxed text-astro-text whitespace-pre-line [text-wrap:pretty]">
                                            {monthlyReading.reading}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        {!profile.isPremium && onRequestPremium ? (
                            <div className="rounded-2xl border border-astro-highlight/16 bg-astro-highlight/[0.06] px-4 py-4">
                                <p className="text-sm leading-relaxed text-astro-text">
                                    {getText(language, 'horoscope.period_premium_hint_monthly')}
                                </p>
                                <button
                                    type="button"
                                    onClick={onRequestPremium}
                                    className="mt-3 inline-flex min-h-[44px] items-center text-sm font-medium text-astro-highlight"
                                >
                                    {getText(language, 'horoscope.premium_cta')}
                                </button>
                            </div>
                        ) : null}
                    </div>
                )}
            </section>

            <section className={READING_GLASS_SECTION_CLASS}>
                <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.bridge_label')}</p>
                <h2 className="mt-1.5 font-serif text-lg text-astro-text sm:text-xl">
                    {getText(language, 'horoscope.bridge_title')}
                </h2>
                <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.bridge_body')}</p>

                {onOpenChart && (
                    <button
                        type="button"
                        onClick={onOpenChart}
                        className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-astro-highlight/12 px-4 py-2.5 text-sm font-medium text-astro-highlight ring-1 ring-astro-highlight/28 transition-[box-shadow] hover:ring-astro-highlight/45"
                    >
                        {getText(language, 'horoscope.open_chart')}
                    </button>
                )}
            </section>
        </ReadingScreenShell>
    );
});

Horoscope.displayName = 'Horoscope';
