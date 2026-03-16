import React, { useState, useEffect, useMemo, memo } from 'react';
import { UserProfile, NatalChartData, DailyHoroscope } from '../types';
import { getOrGenerateHoroscope } from '../services/contentGenerationService';
import { Loading } from '../components/ui/Loading';
import { ZodiacHeader } from '../components/Horoscope/ZodiacHeader';
import { HoroscopeContent } from '../components/Horoscope/HoroscopeContent';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';

interface HoroscopeProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    onUpdateProfile?: (profile: UserProfile) => void;
}

type HoroscopeApiError = Error & {
    code?: string;
};

const getPersistNotice = (language: string) =>
    language === 'ru'
        ? 'Показываем свежий гороскоп, но он пока не сохранился в базе.'
        : 'Showing a fresh horoscope, but it has not been saved yet.';

const getStaleNotice = (language: string) =>
    language === 'ru'
        ? 'Показываем последнюю доступную версию гороскопа, пока свежая загрузка недоступна.'
        : 'Showing the latest available horoscope while a fresh one is unavailable.';

const getFallbackError = (language: string) =>
    language === 'ru' ? 'Не удалось загрузить гороскоп' : 'Failed to load horoscope';

export const Horoscope = memo<HoroscopeProps>(({ profile, chartData, onUpdateProfile }) => {
    const [horoscope, setHoroscope] = useState<DailyHoroscope | null>(null);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isStale, setIsStale] = useState(false);

    const sunSign = useMemo(() => chartData?.sun?.sign || 'Aries', [chartData?.sun?.sign]);
    const language = useMemo(() => profile.language, [profile.language]);

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
        return <Loading />;
    }

    if (!horoscope || !chartData) {
        return (
            <div className="flex items-center justify-center h-full px-6">
                <p className="text-astro-subtext text-center">
                    {statusMessage || getFallbackError(language)}
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto screen-pb">
            <h1 className="text-base font-normal text-astro-text text-center mb-6 leading-tight" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', fontWeight: 400 }}>
                {language === 'ru' ? 'Гороскоп на сегодня' : 'Today\'s Horoscope'}
            </h1>

            {horoscope?.date && (
                <p className="text-xs text-astro-subtext text-center mb-4" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
                    {formatLumiaDate(horoscope.date, language)}
                </p>
            )}

            {statusMessage && (
                <div className={`mb-5 rounded-xl border px-4 py-3 text-xs ${isStale ? 'bg-astro-card border-astro-border text-astro-subtext' : 'bg-astro-highlight/10 border-astro-highlight/30 text-astro-text'}`}>
                    {statusMessage}
                </div>
            )}

            <ZodiacHeader sunSign={sunSign} language={language} />

            <HoroscopeContent 
                content={horoscope.content || ''}
                moonImpact={horoscope.moonImpact}
                mood={horoscope.mood}
                color={horoscope.color}
                language={language}
            />

        </div>
    );
});

Horoscope.displayName = 'Horoscope';
