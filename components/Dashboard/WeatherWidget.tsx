import React, { memo, useMemo } from 'react';
import { UserProfile, NatalChartData, UserContext } from '../../types';
import { motion } from 'framer-motion';
import { getWeatherJoke } from '../../lib/cosmic-jokes';

interface WeatherWidgetProps {
  profile: UserProfile;
  chartData: NatalChartData;
  weatherData: UserContext['weatherData'];
}

// Символ погоды
const getWeatherIcon = (condition: string): string => {
    const c = condition.toLowerCase();
    if (c.includes('sun') || c.includes('clear') || c.includes('ясн')) return '☀️';
    if (c.includes('rain') || c.includes('дожд') || c.includes('drizzle')) return '🌧️';
    if (c.includes('snow') || c.includes('снег')) return '❄️';
    if (c.includes('cloud') || c.includes('облач') || c.includes('overcast')) return '☁️';
    if (c.includes('fog') || c.includes('туман') || c.includes('mist')) return '🌫️';
    if (c.includes('thunder') || c.includes('гроз')) return '⛈️';
    return '🌤️';
};

// Перевод погоды
const translateCondition = (condition: string, lang: string): string => {
    if (lang !== 'ru') return condition;
    const map: Record<string, string> = {
        'sunny': 'Солнечно', 'clear': 'Ясно', 'partly cloudy': 'Облачно',
        'cloudy': 'Облачно', 'overcast': 'Пасмурно', 'rain': 'Дождь',
        'light rain': 'Лёгкий дождь', 'heavy rain': 'Ливень',
        'snow': 'Снег', 'light snow': 'Снежок', 'fog': 'Туман', 'mist': 'Дымка',
    };
    const lower = condition.toLowerCase();
    for (const [k, v] of Object.entries(map)) {
        if (lower.includes(k)) return v;
    }
    return condition;
};

export const WeatherWidget = memo<WeatherWidgetProps>(({ profile, chartData, weatherData }) => {
    if (!weatherData) return null;

    const lang = profile.language;
    const sunSign = chartData?.sun?.sign || 'Aries';
    const moonSign = chartData?.moon?.sign || 'Cancer';
    const marsSign = chartData?.mars?.sign;

    // Генерируем шутку (мемоизируем чтобы не менялась при каждом рендере)
    const joke = useMemo(() => {
        return getWeatherJoke(
            weatherData.temp,
            weatherData.condition,
            sunSign,
            moonSign,
            marsSign,
            lang,
            profile.name
        );
    }, [weatherData.temp, weatherData.condition, sunSign, moonSign, marsSign, lang, profile.name]);

    const icon = getWeatherIcon(weatherData.condition);
    const condition = translateCondition(weatherData.condition, lang);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-astro-card to-astro-bg border border-astro-border rounded-2xl p-5 overflow-hidden"
        >
            {/* Верхняя часть - погода */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <span className="text-4xl">{icon}</span>
                    <div>
                        <div className="text-3xl font-bold text-astro-text">
                            {Math.round(weatherData.temp)}°
                        </div>
                        <div className="text-sm text-astro-subtext">
                            {condition}
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-sm text-astro-subtext">
                        {weatherData.city}
                    </div>
                    {weatherData.humidity && (
                        <div className="text-xs text-astro-subtext/70">
                            💧 {weatherData.humidity}%
                        </div>
                    )}
                </div>
            </div>

            {/* Шутка */}
            <div className="bg-astro-bg/50 rounded-xl p-3 border border-astro-border/30">
                <p className="text-sm text-astro-text/90 leading-relaxed">
                    {joke}
                </p>
            </div>

            {/* Фаза луны */}
            {weatherData.moonPhase && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-astro-border/30">
                    <div className="flex items-center gap-2">
                        <span className="text-lg">🌙</span>
                        <span className="text-xs text-astro-subtext">
                            {lang === 'ru' ? 'Луна' : 'Moon'}
                        </span>
                    </div>
                    <span className="text-xs text-astro-text">
                        {weatherData.moonPhase.illumination}%
                    </span>
                </div>
            )}
        </motion.div>
    );
});

WeatherWidget.displayName = 'WeatherWidget';
