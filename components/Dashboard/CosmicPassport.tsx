import React, { memo } from 'react';
import Image from 'next/image';
import { UserProfile, NatalChartData, UserContext } from '../../types';
import { getText, getZodiacSign, getElement } from '../../constants';

interface CosmicPassportProps {
  profile: UserProfile;
  chartData: NatalChartData;
  photoUrl?: string;
  displayName: string;
  onOpenSettings: () => void;
  weatherData?: UserContext['weatherData'];
}

// Функция для перевода погоды на русский
const translateWeather = (condition: string, language: string): string => {
    if (language !== 'ru') return condition;
    
    const translations: Record<string, string> = {
        'sunny': 'Солнечно',
        'clear': 'Ясно',
        'partly cloudy': 'Переменная облачность',
        'cloudy': 'Облачно',
        'overcast': 'Пасмурно',
        'mist': 'Туман',
        'fog': 'Туман',
        'light rain': 'Небольшой дождь',
        'moderate rain': 'Умеренный дождь',
        'heavy rain': 'Сильный дождь',
        'light snow': 'Небольшой снег',
        'moderate snow': 'Умеренный снег',
        'heavy snow': 'Сильный снег',
        'sleet': 'Мокрый снег',
        'light drizzle': 'Моросящий дождь',
        'moderate drizzle': 'Умеренная морось',
        'heavy drizzle': 'Сильная морось',
        'freezing drizzle': 'Ледяная морось',
        'freezing rain': 'Ледяной дождь',
        'freezing fog': 'Ледяной туман',
        'patchy rain': 'Местами дождь',
        'patchy snow': 'Местами снег',
        'patchy sleet': 'Местами мокрый снег',
        'patchy freezing drizzle': 'Местами ледяная морось',
        'thundery outbreaks': 'Грозовые ливни',
        'blowing snow': 'Метель',
        'blizzard': 'Метель',
        'light snow showers': 'Небольшие снежные ливни',
        'moderate snow showers': 'Умеренные снежные ливни',
        'heavy snow showers': 'Сильные снежные ливни',
        'light rain showers': 'Небольшие дождевые ливни',
        'moderate rain showers': 'Умеренные дождевые ливни',
        'heavy rain showers': 'Сильные дождевые ливни',
    };
    
    const lowerCondition = condition.toLowerCase();
    for (const [key, value] of Object.entries(translations)) {
        if (lowerCondition.includes(key)) {
            return value;
        }
    }
    
    return condition;
};

// Функция для перевода фазы луны на русский
const translateMoonPhase = (phase: string, language: string): string => {
    if (language !== 'ru') return phase;
    
    const translations: Record<string, string> = {
        'new moon': 'Новолуние',
        'waxing crescent': 'Растущий серп',
        'first quarter': 'Первая четверть',
        'waxing gibbous': 'Растущая луна',
        'full moon': 'Полнолуние',
        'waning gibbous': 'Убывающая луна',
        'last quarter': 'Последняя четверть',
        'waning crescent': 'Убывающий серп',
    };
    
    const lowerPhase = phase.toLowerCase();
    for (const [key, value] of Object.entries(translations)) {
        if (lowerPhase.includes(key)) {
            return value;
        }
    }
    
    return phase;
};

// Функция для получения иконки погоды
const getWeatherIcon = (condition: string): string => {
    const lowerCondition = condition.toLowerCase();
    if (lowerCondition.includes('rain') || lowerCondition.includes('дождь')) return '☂';
    if (lowerCondition.includes('snow') || lowerCondition.includes('снег')) return '❄';
    if (lowerCondition.includes('sun') || lowerCondition.includes('солн') || lowerCondition.includes('clear') || lowerCondition.includes('ясн')) return '☀';
    if (lowerCondition.includes('cloud') || lowerCondition.includes('облач') || lowerCondition.includes('overcast') || lowerCondition.includes('пасмурно')) return '☁';
    if (lowerCondition.includes('fog') || lowerCondition.includes('mist') || lowerCondition.includes('туман')) return '🌫';
    return '🌤';
};

export const CosmicPassport = memo<CosmicPassportProps>(({ 
  profile, 
  chartData, 
  photoUrl, 
  displayName, 
  onOpenSettings,
  weatherData
}) => {
  return (
    <div className="bg-astro-card rounded-2xl p-6 border border-astro-border shadow-soft relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-48 h-48 bg-astro-highlight rounded-full blur-3xl opacity-20"></div>
      <div className="relative z-10">
        {/* Header with Avatar and Settings */}
        <div className="flex items-start justify-between mb-4">
          {/* Avatar */}
          <div className="relative group">
            {photoUrl ? (
              <div className="relative w-14 h-14 rounded-full border-2 border-astro-border shadow-md overflow-hidden">
                <Image 
                  src={photoUrl} 
                  alt="Avatar" 
                  width={56}
                  height={56}
                  className="object-cover"
                  unoptimized={photoUrl.startsWith('http')} // Telegram URLs могут требовать unoptimized
                />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-astro-primary to-astro-accent flex items-center justify-center text-white text-lg font-bold shadow-lg">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            {profile.isPremium && (
              <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black text-[9px] font-bold px-2 py-0.5 rounded-full border-2 border-astro-card shadow-md z-10">
                PRO
              </div>
            )}
          </div>
          
          {/* Settings Button */}
          <button 
            onClick={onOpenSettings}
            className="w-10 h-10 flex items-center justify-center text-astro-subtext hover:text-astro-text transition-colors rounded-full hover:bg-astro-bg/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-2">
          {getText(profile.language, 'dashboard.passport')}
        </p>
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-serif text-astro-text mb-2">{profile.name}</h1>
            <div className="text-sm font-medium text-astro-highlight">
              <span>☉ {getZodiacSign(profile.language, chartData.sun?.sign || 'Aries')}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
              {getText(profile.language, 'dashboard.element')}
            </p>
            <p className="font-serif text-base text-astro-text">
              {getElement(profile.language, chartData.element)}
            </p>
          </div>
        </div>
        
        {/* Weather Display */}
        {weatherData && (
          <div className="mt-4 pt-4 border-t border-astro-border/30">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getWeatherIcon(weatherData.condition)}</span>
                <div>
                  <p className="text-xl font-serif text-astro-text">
                    {Math.round(weatherData.temp)}°C
                  </p>
                  <p className="text-[10px] text-astro-subtext/80 mt-0.5">
                    {translateWeather(weatherData.condition, profile.language)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-astro-subtext font-medium">
                  {weatherData.city}
                </p>
                {weatherData.humidity && (
                  <p className="text-[9px] text-astro-subtext/70 mt-0.5">
                    {profile.language === 'ru' ? `${weatherData.humidity}% влажность` : `${weatherData.humidity}% humidity`}
                  </p>
                )}
              </div>
            </div>
            {weatherData.moonPhase && (
              <div className="pt-2 mt-2 border-t border-astro-border/20 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-astro-subtext uppercase tracking-wider">
                    {profile.language === 'ru' ? 'Фаза Луны' : 'Moon Phase'}
                  </p>
                  <p className="text-xs font-serif text-astro-text mt-0.5">
                    {translateMoonPhase(weatherData.moonPhase.phase, profile.language)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-astro-subtext">
                    {weatherData.moonPhase.illumination}%
                  </p>
                  <p className="text-[9px] text-astro-subtext/70 uppercase tracking-wider">
                    {profile.language === 'ru' ? 'освещённость' : 'illumination'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

CosmicPassport.displayName = 'CosmicPassport';
