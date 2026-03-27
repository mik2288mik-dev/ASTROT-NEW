import React, { memo, useMemo } from 'react';
import { UserProfile, NatalChartData, UserContext } from '../../types';
import { motion } from 'framer-motion';
import { getWeatherJoke } from '../../lib/cosmic-jokes';

interface WeatherWidgetProps {
  profile: UserProfile;
  chartData: NatalChartData;
  weatherData: UserContext['weatherData'];
}

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

const translateCondition = (condition: string, lang: string): string => {
  if (lang !== 'ru') return condition;
  const map: Record<string, string> = {
    sunny: 'Солнечно',
    clear: 'Ясно',
    'partly cloudy': 'Облачно',
    cloudy: 'Облачно',
    overcast: 'Пасмурно',
    rain: 'Дождь',
    'light rain': 'Лёгкий дождь',
    'heavy rain': 'Ливень',
    snow: 'Снег',
    'light snow': 'Снежок',
    fog: 'Туман',
    mist: 'Дымка',
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="lumia-glass overflow-hidden rounded-2xl p-4 sm:p-[18px]"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-astro-text/[0.06] text-2xl leading-none"
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-sans text-3xl font-semibold tabular-nums leading-none tracking-tight text-astro-text">
              {Math.round(weatherData.temp)}°
            </span>
            <span className="text-sm font-medium text-astro-text/90">{condition}</span>
          </div>
          {weatherData.city ? (
            <p className="mt-1 text-xs text-astro-subtext">{weatherData.city}</p>
          ) : null}
          {weatherData.humidity ? (
            <p className="mt-0.5 text-[11px] text-astro-subtext/80">
              {lang === 'ru' ? 'Влажность' : 'Humidity'} {weatherData.humidity}%
            </p>
          ) : null}
        </div>
      </div>

      <p className="lumia-prose mt-3 border-t border-astro-border/30 pt-3 text-[13px] leading-relaxed text-astro-text/88 [text-wrap:pretty]">
        {joke}
      </p>

      {weatherData.moonPhase ? (
        <div className="mt-3 flex items-center gap-2 border-t border-astro-border/30 pt-3 text-xs text-astro-subtext">
          <span className="text-base leading-none" aria-hidden>
            🌙
          </span>
          <span>{lang === 'ru' ? 'Луна' : 'Moon'}</span>
          <span className="tabular-nums text-astro-text/90">{weatherData.moonPhase.illumination}%</span>
        </div>
      ) : null}
    </motion.div>
  );
});

WeatherWidget.displayName = 'WeatherWidget';
