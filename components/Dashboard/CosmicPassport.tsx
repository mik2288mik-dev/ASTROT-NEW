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

const translateWeather = (condition: string, language: string): string => {
  if (language !== 'ru') return condition;
  const translations: Record<string, string> = {
    sunny: 'Солнечно',
    clear: 'Ясно',
    'partly cloudy': 'Переменная облачность',
    cloudy: 'Облачно',
    overcast: 'Пасмурно',
    mist: 'Туман',
    fog: 'Туман',
    'light rain': 'Небольшой дождь',
    'moderate rain': 'Умеренный дождь',
    'heavy rain': 'Сильный дождь',
    'patchy rain': 'Местами дождь',
    thundery: 'Гроза',
  };
  const lower = condition.toLowerCase();
  for (const [key, value] of Object.entries(translations)) {
    if (lower.includes(key)) return value;
  }
  return condition;
};

const translateMoonPhase = (phase: string, language: string): string => {
  if (language !== 'ru') return phase;
  const translations: Record<string, string> = {
    'new moon': 'Новолуние',
    'waxing crescent': 'Растущий серп',
    'waxing gibbous': 'Растущая Луна',
    'first quarter': 'Первая четверть',
    'full moon': 'Полнолуние',
    'waning gibbous': 'Убывающая Луна',
    'last quarter': 'Последняя четверть',
  };
  const lower = phase.toLowerCase();
  for (const [key, value] of Object.entries(translations)) {
    if (lower.includes(key)) return value;
  }
  return phase;
};

const getWeatherIcon = (condition: string): string => {
  const lower = condition.toLowerCase();
  if (lower.includes('sun') || lower.includes('clear') || lower.includes('ясн')) return '☀️';
  if (lower.includes('rain') || lower.includes('дожд')) return '🌧️';
  if (lower.includes('snow') || lower.includes('снег')) return '❄️';
  if (lower.includes('cloud') || lower.includes('overcast') || lower.includes('пасмур')) return '☁️';
  if (lower.includes('fog') || lower.includes('mist') || lower.includes('туман')) return '🌫️';
  if (lower.includes('thunder') || lower.includes('гроз')) return '⛈️';
  return '🌤️';
};

export const CosmicPassport = memo<CosmicPassportProps>(
  ({ profile, chartData, photoUrl, displayName, onOpenSettings, weatherData }) => {
    const lang = profile.language;
    const sunSign = chartData.sun?.sign || 'Aries';
    const sunLabel = getZodiacSign(lang, sunSign);
    const moonLabel = chartData.moon?.sign ? getZodiacSign(lang, chartData.moon.sign) : null;
    const sameSign = moonLabel && moonLabel === sunLabel;
    const displayNameFinal = profile.name?.trim() || displayName;

    const signsLine =
      lang === 'ru'
        ? sameSign
          ? `☉☽ ${sunLabel}`
          : moonLabel
            ? `☉ ${sunLabel} · ☽ ${moonLabel}`
            : `☉ ${sunLabel}`
        : sameSign
          ? `Sun & Moon · ${sunLabel}`
          : moonLabel
            ? `Sun ${sunLabel} · Moon ${moonLabel}`
            : `Sun · ${sunLabel}`;

    return (
      <div className="lumia-glass relative overflow-hidden rounded-2xl">
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-astro-text/[0.05] via-transparent to-transparent"
          aria-hidden
        />

        <button
          type="button"
          onClick={onOpenSettings}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-astro-subtext transition-colors hover:bg-astro-bg/50 hover:text-astro-text sm:right-4 sm:top-4"
          aria-label={getText(lang, 'settings.title')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-[20px] w-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>

        <div className="relative px-4 pb-4 pt-4 pr-12 sm:px-5 sm:pb-5 sm:pr-14 sm:pt-5">
          <div className="flex items-center gap-3.5">
            <div className="relative h-[50px] w-[50px] shrink-0 sm:h-[54px] sm:w-[54px]">
              {photoUrl ? (
                <div className="relative h-full w-full overflow-hidden rounded-full ring-1 ring-astro-text/12 ring-offset-2 ring-offset-transparent">
                  <Image
                    src={photoUrl}
                    alt=""
                    width={56}
                    height={56}
                    className="h-full w-full object-cover"
                    unoptimized={photoUrl.startsWith('http')}
                  />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-astro-text/[0.05] font-serif text-lg font-semibold text-astro-text ring-1 ring-astro-text/12">
                  {displayNameFinal.charAt(0).toUpperCase()}
                </div>
              )}
              {profile.isPremium && (
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-astro-highlight px-1 py-px text-[6px] font-bold uppercase leading-none text-white ring-2 ring-astro-card">
                  Pro
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="truncate font-serif text-[22px] font-semibold leading-tight tracking-tight text-astro-text sm:text-[26px]">
                {displayNameFinal}
              </h1>
              <p className="mt-1 text-[13px] leading-snug text-astro-subtext sm:text-sm">{signsLine}</p>
            </div>
          </div>

          {weatherData && (
            <div className="mt-4 flex items-center gap-3 border-t border-astro-border/35 pt-3.5">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-astro-text/[0.06] text-[20px] leading-none"
                aria-hidden
              >
                {getWeatherIcon(weatherData.condition)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-sans text-[17px] font-semibold tabular-nums leading-tight text-astro-text sm:text-lg">
                  {Math.round(weatherData.temp)}°
                  <span className="ml-2 text-[13px] font-normal text-astro-subtext">
                    {translateWeather(weatherData.condition, lang)}
                    {weatherData.city ? ` · ${weatherData.city}` : ''}
                  </span>
                </p>
                {weatherData.moonPhase && (
                  <p className="mt-0.5 text-[11px] text-astro-subtext/85">
                    {translateMoonPhase(weatherData.moonPhase.phase, lang)}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 border-t border-astro-border/35 pt-3.5">
            <p className="text-[13px] leading-relaxed text-astro-text sm:text-sm">
              <span className="font-medium">{getText(lang, 'dashboard.element')}</span>
              <span className="text-astro-subtext"> — </span>
              {getElement(lang, chartData.element)}
              <span className="mx-2 text-astro-border">·</span>
              <span className="text-astro-subtext">{getText(lang, 'dashboard.passport_tagline')}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }
);

CosmicPassport.displayName = 'CosmicPassport';
