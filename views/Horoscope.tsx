import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { UserProfile, NatalChartData, DailyHoroscope } from '../types';
import { getOrGenerateHoroscope } from '../services/contentGenerationService';
import { getCachedDailyHoroscope } from '../services/astrologyService';
import { Loading } from '../components/ui/Loading';
import { ZodiacHeader } from '../components/Horoscope/ZodiacHeader';
import { HoroscopeContent } from '../components/Horoscope/HoroscopeContent';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import { getText } from '../constants';
import { READING_PAGE_CLASS, READING_SECTION_PAD } from '../components/layout/ReadingLayout';

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

function isValidHoroscopeForToday(cached: DailyHoroscope | null | undefined, today: string): cached is DailyHoroscope {
    if (!cached?.content || cached.content.length === 0) return false;
    if (cached.date === today) return true;
    if (!cached.date) return true;
    return false;
}

export const Horoscope = memo<HoroscopeProps>(({ profile, chartData, onUpdateProfile, onOpenChart, onRequestPremium }) => {
    const profileRef = useRef(profile);
    profileRef.current = profile;

    const [horoscope, setHoroscope] = useState<DailyHoroscope | null>(null);
    const [loading, setLoading] = useState(() => {
        const t = getMoscowTodayKey();
        const c = profile.generatedContent?.dailyHoroscope;
        return !isValidHoroscopeForToday(c, t);
    });
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
        if (isValidHoroscopeForToday(cached, today)) {
            const normalized = { ...cached!, date: cached!.date || today };
            setHoroscope(normalized);
            setIsStale(false);
            setStatusMessage(
                normalized.persisted === false || normalized.code === 'DAILY_PERSIST_FAILED'
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

            const applyHoroscope = (raw: DailyHoroscope) => {
                const data = { ...raw, date: raw.date || today };
                setHoroscope(data);
                setIsStale(false);
                setStatusMessage(
                    data.persisted === false || data.code === 'DAILY_PERSIST_FAILED'
                        ? getPersistNotice(language)
                        : null
                );
                if (onUpdateProfile) {
                    const p = profileRef.current;
                    const updatedProfile = { ...p };
                    if (!updatedProfile.generatedContent) {
                        updatedProfile.generatedContent = { timestamps: {} };
                    } else {
                        updatedProfile.generatedContent = { ...updatedProfile.generatedContent };
                    }
                    updatedProfile.generatedContent.dailyHoroscope = data;
                    updatedProfile.generatedContent.timestamps = {
                        ...(updatedProfile.generatedContent.timestamps || {}),
                        dailyHoroscopeGenerated: Date.now(),
                    };
                    onUpdateProfile(updatedProfile);
                }
                setLoading(false);
            };

            if (isValidHoroscopeForToday(cachedHoroscope, today)) {
                if (!cancelled) {
                    applyHoroscope(cachedHoroscope!);
                }
                return;
            }

            try {
                const fromDb = await getCachedDailyHoroscope(
                    String(profile.id),
                    profile.language === 'en' ? 'en' : 'ru'
                );
                if (cancelled) return;
                if (fromDb?.content && fromDb.content.length > 0) {
                    const d = { ...fromDb, date: fromDb.date || today };
                    if (d.date === today) {
                        applyHoroscope(d);
                        return;
                    }
                }
            } catch {
                /* сеть / ошибка чтения кэша — ниже POST с проверкой БД на сервере */
            }

            if (!cancelled) {
                setLoading(true);
                setStatusMessage(null);
                setIsStale(false);
            }

            let lastError: HoroscopeApiError | null = null;

            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const data = await getOrGenerateHoroscope(profileRef.current, chartData);
                    if (cancelled) return;

                    applyHoroscope(data);
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

            const fallback = profileRef.current.generatedContent?.dailyHoroscope;
            if (fallback?.content) {
                const stale = fallback.date !== today;
                setHoroscope(fallback);
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
    }, [profile.id, profile.generatedContent?.dailyHoroscope, profile.language, chartData?.sun?.sign, language, onUpdateProfile]);

    if (loading) {
        return <Loading message={getText(language, 'horoscope.loading')} />;
    }

    if (!horoscope || !chartData) {
        return (
            <div className={`flex min-h-full items-center justify-center py-8 ${READING_PAGE_CLASS}`}>
                <div className={`lumia-glass w-full rounded-2xl text-center sm:rounded-2xl ${READING_SECTION_PAD}`}>
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
                            className="mt-4 w-full rounded-xl bg-astro-highlight/12 px-4 py-2.5 text-sm font-medium text-astro-highlight ring-1 ring-astro-highlight/28 transition-[box-shadow] hover:ring-astro-highlight/45"
                        >
                            {getText(language, 'horoscope.empty_cta')}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen space-y-3 pt-4 screen-pb sm:space-y-3.5 ${READING_PAGE_CLASS}`}>
            <section className={`lumia-glass rounded-2xl sm:rounded-2xl ${READING_SECTION_PAD}`}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.today_layer_label')}</p>
                        <h1 className="mt-1.5 font-serif text-xl text-astro-text sm:text-2xl">
                            {getText(language, 'horoscope.title')}
                        </h1>
                    </div>
                    {horoscope?.date && (
                        <span className="shrink-0 rounded-full bg-astro-text/[0.07] px-2.5 py-1 text-[11px] lumia-muted">
                            {formatLumiaDate(horoscope.date, language)}
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

            <section className={`lumia-glass rounded-2xl sm:rounded-2xl ${READING_SECTION_PAD}`}>
                <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.foundation_label')}</p>
                <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.foundation_body')}</p>
                <div className="mt-3">
                    <ZodiacHeader sunSign={sunSign} language={language} />
                </div>
            </section>

            {signals.length > 0 && (
                <section className={`lumia-glass rounded-2xl sm:rounded-2xl ${READING_SECTION_PAD}`}>
                    <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.signals_title')}</p>
                    <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.signals_body')}</p>

                    <div
                        className={`mt-3 grid gap-2 sm:gap-2.5 ${
                            signals.length === 1
                                ? 'grid-cols-1'
                                : signals.length === 2
                                  ? 'grid-cols-1 min-[420px]:grid-cols-2'
                                  : 'grid-cols-1 min-[380px]:grid-cols-3'
                        }`}
                    >
                        {signals.map((signal) => (
                            <div key={signal.label} className="lumia-glass-inset px-3 py-3 text-center sm:py-3.5">
                                <p className="lumia-label text-[9px] tracking-wider">{signal.label}</p>
                                <p className="mt-1 text-[15px] font-medium text-astro-text sm:text-base">{signal.value}</p>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            <HoroscopeContent 
                content={horoscope.content || ''}
                moonImpact={horoscope.moonImpact}
                transitFocus={horoscope.transitFocus}
                advice={horoscope.advice}
                language={language}
            />

            <section className={`lumia-glass rounded-2xl sm:rounded-2xl ${READING_SECTION_PAD}`}>
                <p className="lumia-label tracking-[0.2em]">{getText(language, 'horoscope.bridge_label')}</p>
                <h2 className="mt-1.5 font-serif text-lg text-astro-text sm:text-xl">
                    {getText(language, 'horoscope.bridge_title')}
                </h2>
                <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.bridge_body')}</p>

                <div className="mt-4 space-y-2.5">
                    {onOpenChart && (
                        <button
                            type="button"
                            onClick={onOpenChart}
                            className="w-full rounded-xl bg-astro-highlight/12 px-4 py-2.5 text-sm font-medium text-astro-highlight ring-1 ring-astro-highlight/28 transition-[box-shadow] hover:ring-astro-highlight/45"
                        >
                            {getText(language, 'horoscope.open_chart')}
                        </button>
                    )}

                    {!profile.isPremium && onRequestPremium && (
                        <div className="lumia-glass-inset p-3.5">
                            <p className="text-sm font-medium text-astro-text">{getText(language, 'horoscope.premium_title')}</p>
                            <p className="lumia-muted mt-1.5 text-sm leading-relaxed">{getText(language, 'horoscope.premium_body')}</p>
                            <button
                                type="button"
                                onClick={onRequestPremium}
                                className="mt-2.5 text-sm font-medium text-astro-highlight"
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
