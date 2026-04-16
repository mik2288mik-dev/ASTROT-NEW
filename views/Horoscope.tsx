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
    getCachedFullDaypartForecast,
    getCachedDailyHoroscope,
    getDailyForecastLayer,
    getDailyHoroscope,
    getFullDaypartForecast,
    mapForecastDailyToLegacyHoroscope,
    mapLegacyHoroscopeToForecastDailyReading,
} from '../services/astrologyService';
import { Loading } from '../components/ui/Loading';
import { ZodiacHeader } from '../components/Horoscope/ZodiacHeader';
import { HoroscopeContent } from '../components/Horoscope/HoroscopeContent';
import { formatLumiaDate, getMoscowIsoWeekKey, getMoscowMonthKey, getMoscowTodayKey } from '../lib/date-utils';
import { getText } from '../constants';
import { FORECAST_FULL_DAY_LUMI_COST } from '../lib/forecastFullDay';
import { READING_GLASS_SECTION_CLASS, READING_PAGE_CLASS } from '../components/layout/ReadingLayout';
import { ReadingScreenShell } from '../components/layout/ScreenShell';

interface HoroscopeProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    onUpdateProfile?: (profile: UserProfile) => void;
    onOpenChart?: () => void;
}

type HoroscopeApiError = Error & {
    code?: string;
    status?: number;
    details?: any;
};

type FullDayAccess = 'premium' | 'lumi' | 'locked';

const DAYPART_SLOTS: ForecastDaypartSlot[] = ['morning', 'day', 'evening'];

const getPersistNotice = (language: string) =>
    getText(language as 'ru' | 'en', 'horoscope.persist_notice');

const getStaleNotice = (language: string) =>
    getText(language as 'ru' | 'en', 'horoscope.stale_notice');

const getFallbackError = (language: string) =>
    getText(language as 'ru' | 'en', 'horoscope.fallback_error');

function getFullDayStatusMessage(language: string, error: HoroscopeApiError | null | undefined) {
    if (!error) return getFallbackError(language);

    switch (error.code) {
        case 'LUMI_REQUIRED':
            return getText(language as 'ru' | 'en', 'horoscope.error_lumi_required').replace('{cost}', String(FORECAST_FULL_DAY_LUMI_COST));
        case 'INSUFFICIENT_LUMI':
            return getText(language as 'ru' | 'en', 'horoscope.error_insufficient_lumi');
        case 'LUMI_CONSENT_REQUIRED':
            return getText(language as 'ru' | 'en', 'horoscope.error_lumi_consent');
        case 'FULL_DAY_LOCKED':
            return getText(language as 'ru' | 'en', 'horoscope.premium_body');
        default:
            return error.message || getFallbackError(language);
    }
}

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

export const Horoscope = memo<HoroscopeProps>(({ profile, chartData, onUpdateProfile, onOpenChart }) => {
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
    const [fullDayAccess, setFullDayAccess] = useState<FullDayAccess>(() => (profile.isPremium ? 'premium' : 'locked'));
    const [isStale, setIsStale] = useState(false);
    const [weeklyReading, setWeeklyReading] = useState<ForecastWeeklyReading | null>(null);
    const [monthlyReading, setMonthlyReading] = useState<ForecastMonthlyReading | null>(null);
    const [periodLoading, setPeriodLoading] = useState(false);
    const [periodError, setPeriodError] = useState<string | null>(null);

    const weekKey = getMoscowIsoWeekKey();
    const monthKey = getMoscowMonthKey();

    const syncBalance = (balance?: number) => {
        if (typeof balance !== 'number' || !onUpdateProfile) return;
        if ((profileRef.current.lumiBalance ?? 0) === balance) return;
        onUpdateProfile({ ...profileRef.current, lumiBalance: balance });
    };

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
        if (profile.isPremium) {
            setFullDayAccess('premium');
        }
    }, [profile.isPremium]);

    useEffect(() => {
        let cancelled = false;

        const detectLumiFullDay = async () => {
            if (!chartData || !profile.id || profile.isPremium) {
                if (!cancelled && !profile.isPremium) {
                    setFullDayAccess('locked');
                }
                return;
            }

            try {
                const morning = await getCachedFullDaypartForecast(String(profile.id), 'morning', {
                    accessTier: 'lumi',
                    dateKey: today,
                });
                if (!cancelled) {
                    setFullDayAccess(morning ? 'lumi' : 'locked');
                }
            } catch (error: any) {
                if (cancelled) return;
                const apiError = error as HoroscopeApiError;
                if (apiError.code === 'FULL_DAY_LOCKED' || apiError.status === 403 || apiError.status === 404) {
                    setFullDayAccess('locked');
                    return;
                }
                setDaypartsStatus(getFullDayStatusMessage(language, apiError));
            }
        };

        void detectLumiFullDay();

        return () => {
            cancelled = true;
        };
    }, [chartData, language, profile.id, profile.isPremium, today]);

    useEffect(() => {
        let cancelled = false;

        const loadDayparts = async () => {
            if (!chartData || fullDayAccess === 'locked') {
                if (!cancelled) {
                    setDayparts({});
                    setDaypartsLoading(false);
                    setDaypartsStatus(null);
                }
                return;
            }

            setDaypartsStatus(null);

            const userId = String(profile.id);
            const accessTier = fullDayAccess === 'premium' ? 'premium' : 'lumi';
            const cachedPairs = await Promise.all(
                DAYPART_SLOTS.map(async (slot) => {
                    try {
                        const reading = await getCachedFullDaypartForecast(userId, slot, { accessTier, dateKey: today });
                        return [slot, reading] as const;
                    } catch (error: any) {
                        const apiError = error as HoroscopeApiError;
                        if (apiError.code === 'FULL_DAY_LOCKED' || apiError.status === 403 || apiError.status === 404) {
                            return [slot, null] as const;
                        }
                        throw error;
                    }
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
                    const result = await getFullDaypartForecast(profileRef.current, chartData, slot, { accessTier });
                    return [slot, result.reading, result.lumiBalance] as const;
                })
            );

            if (cancelled) return;

            const merged: Partial<Record<ForecastDaypartSlot, ForecastDaypartReading>> = { ...next };
            const failures: string[] = [];
            let nextBalance: number | undefined;

            for (const result of results) {
                if (result.status === 'fulfilled') {
                    const [slot, reading, lumiBalance] = result.value;
                    merged[slot] = reading;
                    if (typeof lumiBalance === 'number') {
                        nextBalance = lumiBalance;
                    }
                } else {
                    const apiError = result.reason as HoroscopeApiError;
                    failures.push(getFullDayStatusMessage(language, apiError));
                }
            }

            setDayparts(merged);
            setDaypartsLoading(false);
            if (typeof nextBalance === 'number') {
                syncBalance(nextBalance);
            }
            setDaypartsStatus(
                DAYPART_SLOTS.some((s) => merged[s]) ? null : failures[0] || getFallbackError(language)
            );
        };

        void loadDayparts();

        return () => {
            cancelled = true;
        };
    }, [chartData, fullDayAccess, language, profile.id, syncBalance, today]);

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
                <div className="w-full text-center">
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
                            className="mt-4 inline-flex items-center px-0 py-1 text-sm font-medium text-astro-highlight underline underline-offset-4 transition-opacity hover:opacity-70"
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
            <section className="border-t-0 px-0 py-1 sm:py-1.5">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.today_layer_label')}</p>
                        <h1 className="mt-1.5 font-serif text-xl text-astro-text sm:text-2xl">
                            {getText(language, 'horoscope.title')}
                        </h1>
                    </div>
                    {dailyReading.date && (
                        <span className="shrink-0 text-[11px] uppercase tracking-[0.14em] text-astro-subtext">
                            {formatLumiaDate(dailyReading.date, language)}
                        </span>
                    )}
                </div>

                <div className="mt-4">
                    <ZodiacHeader sunSign={sunSign} language={language} />
                </div>

                {statusMessage && (
                    <div
                        className={`mt-3 border-t px-0 py-2.5 text-xs leading-relaxed ${
                            isStale
                                ? 'border-astro-border/12 lumia-muted'
                                : 'border-astro-highlight/20 text-astro-text'
                        }`}
                    >
                        {statusMessage}
                    </div>
                )}
            </section>

            <HoroscopeContent
                reading={dailyReading}
                language={language}
            />

            <section className={READING_GLASS_SECTION_CLASS}>
                <p className="lumia-label tracking-[0.2em]">
                    {getText(language, fullDayAccess === 'locked' ? 'horoscope.premium_label' : 'horoscope.dayparts_label')}
                </p>
                <h2 className="mt-1.5 font-serif text-lg text-astro-text sm:text-xl">
                    {getText(language, fullDayAccess === 'locked' ? 'horoscope.premium_title' : 'horoscope.dayparts_title')}
                </h2>

                {fullDayAccess === 'locked' ? (
                    <div className="mt-4 border-t border-astro-border/10 pt-4">
                        <p className="text-sm leading-relaxed text-astro-text/82">
                            {getText(language, 'horoscope.premium_body')}
                        </p>
                    </div>
                ) : (
                    <div className="mt-4 space-y-5">
                        {daypartsLoading ? (
                            <p className="border-t border-astro-border/10 pt-4 text-sm leading-relaxed text-astro-subtext">
                                {getText(language, 'horoscope.dayparts_loading')}
                            </p>
                        ) : null}

                        {daypartsStatus && !daypartsLoading ? (
                            <p className="border-t border-astro-border/10 pt-4 text-sm leading-relaxed text-astro-subtext">
                                {daypartsStatus}
                            </p>
                        ) : null}

                        {fullDayAccess === 'lumi' && !daypartsLoading ? (
                            <p className="text-xs leading-relaxed text-astro-subtext">
                                {getText(language, 'horoscope.lumi_active_note')}
                            </p>
                        ) : null}

                        {DAYPART_SLOTS.filter((slot) => dayparts[slot]).map((slot) => {
                            const reading = dayparts[slot];
                            if (!reading) return null;

                            return (
                                <div key={slot} className="border-t border-astro-border/10 pt-4">
                                    <p className="lumia-label tracking-[0.16em]">{getText(language, `horoscope.slot_${slot}`)}</p>
                                    <h3 className="mt-1.5 text-lg font-semibold text-astro-text sm:text-xl">{reading.headline}</h3>
                                    <p className="mt-2 text-sm leading-relaxed text-astro-text/82">{reading.summary}</p>
                                    <p className="mt-3 text-sm leading-relaxed text-astro-text">{reading.focus}</p>
                                    <p className="mt-3 text-sm leading-relaxed text-astro-subtext">{reading.guidance}</p>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className={READING_GLASS_SECTION_CLASS}>
                <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.weekly_label')}</p>
                <h2 className="mt-1.5 font-serif text-lg text-astro-text sm:text-xl">{getText(language, 'horoscope.weekly_title')}</h2>

                {periodLoading ? (
                    <p className="mt-4 border-t border-astro-border/10 pt-4 text-sm leading-relaxed text-astro-subtext">
                        {getText(language, 'horoscope.period_loading')}
                    </p>
                ) : null}

                {periodError && !periodLoading ? (
                    <p className="mt-4 border-t border-astro-border/10 pt-4 text-sm leading-relaxed text-astro-text/80">
                        {periodError}
                    </p>
                ) : null}

                {weeklyReading && !periodLoading ? (
                    <div className="mt-4 border-t border-astro-border/10 pt-4">
                        <p className="text-[11px] uppercase tracking-wider text-astro-subtext">{weeklyReading.periodLabel}</p>
                        <h3 className="mt-2 font-serif text-lg text-astro-text sm:text-xl">{weeklyReading.headline}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-astro-text sm:text-[15px]">{weeklyReading.summary}</p>
                        <p className="mt-3 text-sm leading-relaxed text-astro-subtext">{weeklyReading.focus}</p>
                    </div>
                ) : null}
            </section>

            <section className={READING_GLASS_SECTION_CLASS}>
                <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.monthly_label')}</p>
                <h2 className="mt-1.5 font-serif text-lg text-astro-text sm:text-xl">{getText(language, 'horoscope.monthly_title')}</h2>

                {monthlyReading && !periodLoading ? (
                    <div className="mt-4 border-t border-astro-border/10 pt-4">
                        <p className="text-[11px] uppercase tracking-wider text-astro-subtext">{monthlyReading.periodLabel}</p>
                        <h3 className="mt-2 font-serif text-lg text-astro-text sm:text-xl">{monthlyReading.headline}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-astro-text sm:text-[15px]">{monthlyReading.summary}</p>
                        <p className="mt-3 text-sm leading-relaxed text-astro-subtext">{monthlyReading.focus}</p>
                    </div>
                ) : null}
            </section>

            {onOpenChart ? (
                <section className={READING_GLASS_SECTION_CLASS}>
                    <button
                        type="button"
                        onClick={onOpenChart}
                        className="inline-flex items-center px-0 py-1 text-sm font-medium text-astro-highlight underline underline-offset-4 transition-opacity hover:opacity-70"
                    >
                        {getText(language, 'horoscope.empty_cta')}
                    </button>
                </section>
            ) : null}
        </ReadingScreenShell>
    );
});

Horoscope.displayName = 'Horoscope';
