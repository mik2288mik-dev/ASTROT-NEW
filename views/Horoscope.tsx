import React, { useState, useEffect, useMemo, memo } from 'react';
import { UserProfile, NatalChartData } from '../types';
import { getOrGenerateHoroscope } from '../services/contentGenerationService';
import { Loading } from '../components/ui/Loading';
import { ZodiacHeader } from '../components/Horoscope/ZodiacHeader';
import { HoroscopeContent } from '../components/Horoscope/HoroscopeContent';

interface HoroscopeProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
}

export const Horoscope = memo<HoroscopeProps>(({ profile, chartData }) => {
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
            if (!chartData) return;
            
            setLoading(true);
            try {
                const data = await getOrGenerateHoroscope(profile, chartData, 'daily');
                setHoroscope(data);
            } catch (error) {
                console.error('[Horoscope] Error loading horoscope:', error);
            } finally {
                setLoading(false);
            }
        };

        loadHoroscope();
    }, [profile.id, chartData?.sun?.sign]); // Зависимости оптимизированы

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
            <h1 className="text-xl font-bold text-astro-text text-center mb-6 leading-tight">
                {language === 'ru' ? 'Гороскоп на сегодня' : 'Today\'s Horoscope'}
            </h1>

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
