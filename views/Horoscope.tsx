import React, { useState, useEffect, useMemo, memo } from 'react';
import { UserProfile, NatalChartData } from '../types';
import { getOrGenerateHoroscope } from '../services/contentGenerationService';
import { Loading } from '../components/ui/Loading';
import { ZodiacHeader } from '../components/Horoscope/ZodiacHeader';
import { HoroscopeContent } from '../components/Horoscope/HoroscopeContent';

interface HoroscopeProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    onUpdateProfile?: (profile: UserProfile) => void;
}

export const Horoscope = memo<HoroscopeProps>(({ profile, chartData, onUpdateProfile }) => {
    const [horoscope, setHoroscope] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Мемуизируем sunSign чтобы избежать пересчета
    const sunSign = useMemo(() => {
        return chartData?.sun?.sign || 'Aries';
    }, [chartData?.sun?.sign]);

    // Мемуизируем язык для оптимизации
    const language = useMemo(() => profile.language, [profile.language]);

    useEffect(() => {
        const loadHoroscope = async () => {
            if (!chartData) {
                setLoading(false);
                return;
            }
            
            // ВАЖНО: Проверяем кэш ПЕРЕД загрузкой, не генерируем каждый раз!
            const today = new Date().toISOString().split('T')[0];
            const cachedHoroscope = profile.generatedContent?.dailyHoroscope;
            
            // Если есть актуальный кэш с контентом - используем его БЕЗ вызова API
            if (cachedHoroscope && cachedHoroscope.date === today && cachedHoroscope.content && cachedHoroscope.content.length > 0) {
                console.log('[Horoscope] Using cached horoscope from profile (NO API CALL)', {
                    date: cachedHoroscope.date,
                    hasContent: !!cachedHoroscope.content,
                    contentLength: cachedHoroscope.content.length
                });
                setHoroscope(cachedHoroscope);
                setLoading(false);
                return;
            }
            
            // Если кэша нет или он устарел - загружаем через API (который проверит централизованный кэш)
            setLoading(true);
            try {
                console.log('[Horoscope] Cache miss or outdated, loading from API', {
                    hasCache: !!cachedHoroscope,
                    cacheDate: cachedHoroscope?.date,
                    today,
                    hasContent: !!cachedHoroscope?.content
                });
                const data = await getOrGenerateHoroscope(profile, chartData);
                setHoroscope(data);
                
                // Обновляем профиль в родительском компоненте только если данные изменились
                if (onUpdateProfile) {
                    const updatedProfile = { ...profile };
                    if (!updatedProfile.generatedContent) {
                        updatedProfile.generatedContent = {};
                    }
                    updatedProfile.generatedContent.dailyHoroscope = data;
                    onUpdateProfile(updatedProfile);
                }
            } catch (error) {
                console.error('[Horoscope] Error loading horoscope:', error);
                // При ошибке используем кэш если есть
                if (cachedHoroscope && cachedHoroscope.content) {
                    console.log('[Horoscope] Using cached horoscope as fallback after error');
                    setHoroscope(cachedHoroscope);
                } else {
                    setLoading(false);
                }
            } finally {
                setLoading(false);
            }
        };

        loadHoroscope();
    }, [profile.id, chartData?.sun?.sign, profile.generatedContent?.dailyHoroscope?.date]); // Загружаем только при изменении даты гороскопа

    if (loading) {
        return <Loading />;
    }

    if (!horoscope || !chartData) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-astro-subtext">
                    {language === 'ru' ? 'Не удалось загрузить гороскоп' : 'Failed to load horoscope'}
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
            {/* Заголовок страницы */}
            <h1 className="text-base font-normal text-astro-text text-center mb-6 leading-tight" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', fontWeight: 400 }}>
                {language === 'ru' ? 'Гороскоп на сегодня' : 'Today\'s Horoscope'}
            </h1>
            
            {/* Дата гороскопа */}
            {horoscope?.date && (
                <p className="text-xs text-astro-subtext text-center mb-6" style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}>
                    {(() => {
                        const locale = language === 'ru' ? 'ru-RU' : 'en-US';
                        const rawDate = new Date(horoscope.date);
                        if (Number.isNaN(rawDate.getTime())) return '';
                        return rawDate.toLocaleDateString(locale, {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                        });
                    })()}
                </p>
            )}

            {/* Блок с иконкой знака зодиака */}
            <ZodiacHeader sunSign={sunSign} language={language} />

            {/* Основной текст гороскопа */}
            <HoroscopeContent 
                content={horoscope.content || ''}
                moonImpact={horoscope.moonImpact}
                mood={horoscope.mood}
                color={horoscope.color}
                language={language}
            />

            {/* Нижний отступ для безопасной зоны */}
            <div className="h-20"></div>
        </div>
    );
});

Horoscope.displayName = 'Horoscope';
