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
    'Aries': '21.03 – 19.04',
    'Taurus': '20.04 – 20.05',
    'Gemini': '21.05 – 20.06',
    'Cancer': '21.06 – 22.07',
    'Leo': '23.07 – 22.08',
    'Virgo': '23.08 – 22.09',
    'Libra': '23.09 – 22.10',
    'Scorpio': '23.10 – 21.11',
    'Sagittarius': '22.11 – 21.12',
    'Capricorn': '22.12 – 19.01',
    'Aquarius': '20.01 – 18.02',
    'Pisces': '19.02 – 20.03'
};

// Нормализация знаков (учитываем русские названия и лишние символы)
const ZODIAC_LOOKUP: Record<string, string> = {
    aries: 'Aries',
    овен: 'Aries',
    taurus: 'Taurus',
    телец: 'Taurus',
    gemini: 'Gemini',
    близнецы: 'Gemini',
    cancer: 'Cancer',
    рак: 'Cancer',
    leo: 'Leo',
    лев: 'Leo',
    virgo: 'Virgo',
    дева: 'Virgo',
    libra: 'Libra',
    весы: 'Libra',
    scorpio: 'Scorpio',
    скорпион: 'Scorpio',
    sagittarius: 'Sagittarius',
    стрелец: 'Sagittarius',
    capricorn: 'Capricorn',
    козерог: 'Capricorn',
    aquarius: 'Aquarius',
    водолей: 'Aquarius',
    pisces: 'Pisces',
    рыбы: 'Pisces'
};

const normalizeSign = (sign?: string): string => {
    if (!sign) return 'Aries';
    const cleaned = sign
        .toLowerCase()
        .replace(/[^a-zа-яё]/gi, '');
    return ZODIAC_LOOKUP[cleaned] || (sign.charAt(0).toUpperCase() + sign.slice(1).toLowerCase());
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

    const sunSign = normalizeSign(chartData.sun?.sign);
    const zodiacSymbol = ZODIAC_SYMBOLS[sunSign] || '♈';
    const zodiacDates = ZODIAC_DATES[sunSign] || '';
    const zodiacName = getZodiacSign(profile.language, sunSign);

    return (
        <div className="min-h-screen px-6 py-8 max-w-2xl mx-auto">
            {/* Заголовок страницы */}
            <h1 className="text-[32px] font-bold text-astro-text text-center mb-8 leading-tight">
                {profile.language === 'ru' ? 'Гороскоп на сегодня' : 'Today\'s Horoscope'}
            </h1>

            {/* Блок с иконкой знака зодиака */}
            <div className="bg-astro-card rounded-3xl p-6 border border-astro-border shadow-soft mb-8">
                <div className="flex items-center gap-6 flex-wrap">
                    <div className="w-28 h-28 rounded-2xl bg-astro-bg/60 border border-astro-border flex items-center justify-center">
                        <span className="text-6xl text-astro-highlight">
                            {zodiacSymbol}
                        </span>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                        <p className="text-xs uppercase tracking-[0.3em] text-astro-subtext mb-2">
                            {profile.language === 'ru' ? 'Твой солнечный знак' : 'Your sun sign'}
                        </p>
                        <h2 className="text-3xl font-serif text-astro-text mb-1">
                            {zodiacName}
                        </h2>
                        <p className="text-sm text-astro-subtext">
                            {zodiacDates}
                        </p>
                    </div>
                </div>
            </div>

            {/* Основной текст гороскопа */}
            <div className="bg-astro-card rounded-3xl p-8 border border-astro-border shadow-sm">
                <div className="max-w-[85%] mx-auto space-y-6">
                    {/* Разбиваем текст на абзацы */}
                    {horoscope.content?.split('\n').filter((p: string) => p.trim()).map((paragraph: string, index: number) => (
                        <p 
                            key={index}
                            className="text-[18px] leading-relaxed text-astro-text"
                            style={{ lineHeight: '1.7' }}
                        >
                            {paragraph.trim()}
                        </p>
                    ))}

                    {/* Если есть дополнительная информация */}
                    {horoscope.moonImpact && (
                        <div className="pt-6 border-t border-astro-border/30">
                            <h3 className="text-lg font-semibold text-astro-text mb-3">
                                {profile.language === 'ru' ? 'Влияние Луны' : 'Moon Impact'}
                            </h3>
                            <p className="text-[17px] leading-relaxed text-astro-subtext">
                                {horoscope.moonImpact}
                            </p>
                        </div>
                    )}

                    {/* Настроение дня */}
                    {horoscope.mood && (
                        <div className="flex items-center justify-center gap-4 pt-6">
                            <div className="text-center">
                                <p className="text-sm text-astro-subtext mb-1">
                                    {profile.language === 'ru' ? 'Настроение' : 'Mood'}
                                </p>
                                <p className="text-lg font-medium text-astro-text">
                                    {horoscope.mood}
                                </p>
                            </div>
                            {horoscope.color && (
                                <div className="text-center">
                                    <p className="text-sm text-astro-subtext mb-1">
                                        {profile.language === 'ru' ? 'Цвет дня' : 'Lucky Color'}
                                    </p>
                                    <p className="text-lg font-medium text-astro-text">
                                        {horoscope.color}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Нижний отступ для безопасной зоны */}
            <div className="h-24"></div>
        </div>
    );
};
