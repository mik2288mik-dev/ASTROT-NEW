import React, { useState, useEffect } from 'react';
import { UserProfile, NatalChartData } from '../types';
import { getOrGenerateHoroscope } from '../services/contentGenerationService';
import { Loading } from '../components/ui/Loading';
import { getZodiacSign } from '../constants';

interface HoroscopeProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
}

// Символы знаков зодиака (заглушки для будущих иконок)
const ZODIAC_SYMBOLS: Record<string, string> = {
    'Aries': '♈',
    'Taurus': '♉',
    'Gemini': '♊',
    'Cancer': '♋',
    'Leo': '♌',
    'Virgo': '♍',
    'Libra': '♎',
    'Scorpio': '♏',
    'Sagittarius': '♐',
    'Capricorn': '♑',
    'Aquarius': '♒',
    'Pisces': '♓'
};

// Даты знаков зодиака
const ZODIAC_DATES: Record<string, string> = {
    'Aries': '21.03 - 19.04',
    'Taurus': '20.04 - 20.05',
    'Gemini': '21.05 - 20.06',
    'Cancer': '21.06 - 22.07',
    'Leo': '23.07 - 22.08',
    'Virgo': '23.08 - 22.09',
    'Libra': '23.09 - 22.10',
    'Scorpio': '23.10 - 21.11',
    'Sagittarius': '22.11 - 21.12',
    'Capricorn': '22.12 - 19.01',
    'Aquarius': '20.01 - 18.02',
    'Pisces': '19.02 - 20.03'
};

export const Horoscope: React.FC<HoroscopeProps> = ({ profile, chartData }) => {
    const [horoscope, setHoroscope] = useState<any>(null);
    const [loading, setLoading] = useState(true);

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
    }, [profile, chartData]);

    if (loading) {
        return <Loading />;
    }

    if (!horoscope || !chartData) {
        return (
            <div className="flex items-center justify-center h-full">
                <p className="text-astro-subtext">
                    {profile.language === 'ru' ? 'Не удалось загрузить гороскоп' : 'Failed to load horoscope'}
                </p>
            </div>
        );
    }

    const sunSign = chartData.sun?.sign || 'Aries';
    const zodiacSymbol = ZODIAC_SYMBOLS[sunSign] || '♈';
    const zodiacDates = ZODIAC_DATES[sunSign] || '';
    const zodiacName = getZodiacSign(profile.language, sunSign);

    return (
        <div className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
            {/* Заголовок страницы */}
            <h1 className="text-2xl font-bold text-astro-text text-center mb-6 leading-tight">
                {profile.language === 'ru' ? 'Гороскоп на сегодня' : 'Today\'s Horoscope'}
            </h1>

            {/* Блок с иконкой знака зодиака - иконка слева, текст справа */}
            <div className="flex items-start gap-4 mb-6">
                {/* Иконка знака слева */}
                <div className="flex-shrink-0 w-16 h-16 rounded-full bg-astro-card border-2 border-astro-border flex items-center justify-center shadow-lg">
                    <span className="text-4xl text-astro-highlight">
                        {zodiacSymbol}
                    </span>
                </div>

                {/* Текст справа от иконки */}
                <div className="flex-1 pt-1">
                    {/* Название знака */}
                    <h2 className="text-xl font-semibold text-astro-text mb-1">
                        {zodiacName}
                    </h2>

                    {/* Даты знака */}
                    <p className="text-sm text-astro-subtext">
                        {zodiacDates}
                    </p>
                </div>
            </div>

            {/* Основной текст гороскопа */}
            <div className="bg-astro-card rounded-2xl p-6 border border-astro-border shadow-sm">
                <div className="max-w-[90%] mx-auto space-y-4">
                    {/* Разбиваем текст на абзацы */}
                    {horoscope.content?.split('\n').filter((p: string) => p.trim()).map((paragraph: string, index: number) => (
                        <p 
                            key={index}
                            className="text-[15px] leading-relaxed text-astro-text"
                            style={{ lineHeight: '1.6' }}
                        >
                            {paragraph.trim()}
                        </p>
                    ))}

                    {/* Если есть дополнительная информация */}
                    {horoscope.moonImpact && (
                        <div className="pt-4 border-t border-astro-border/30">
                            <h3 className="text-base font-semibold text-astro-text mb-2">
                                {profile.language === 'ru' ? 'Влияние Луны' : 'Moon Impact'}
                            </h3>
                            <p className="text-[14px] leading-relaxed text-astro-subtext">
                                {horoscope.moonImpact}
                            </p>
                        </div>
                    )}

                    {/* Настроение дня */}
                    {horoscope.mood && (
                        <div className="flex items-center justify-center gap-4 pt-4">
                            <div className="text-center">
                                <p className="text-xs text-astro-subtext mb-1">
                                    {profile.language === 'ru' ? 'Настроение' : 'Mood'}
                                </p>
                                <p className="text-base font-medium text-astro-text">
                                    {horoscope.mood}
                                </p>
                            </div>
                            {horoscope.color && (
                                <div className="text-center">
                                    <p className="text-xs text-astro-subtext mb-1">
                                        {profile.language === 'ru' ? 'Цвет дня' : 'Lucky Color'}
                                    </p>
                                    <p className="text-base font-medium text-astro-text">
                                        {horoscope.color}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Нижний отступ для безопасной зоны */}
            <div className="h-20"></div>
        </div>
    );
};
