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
    'first quarter': 'Первая четверть',
    'full moon': 'Полнолуние',
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

    return (
      <div className="relative overflow-hidden rounded-3xl border border-astro-border/60 bg-gradient-to-br from-astro-card via-astro-card to-astro-bg/40 shadow-soft">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-astro-highlight/10 blur-3xl"
          aria-hidden
        />
        <div className="pointer-events-none absolute -bottom-24 -left-12 h-48 w-48 rounded-full bg-astro-primary/5 blur-3xl" aria-hidden />

        <div className="relative px-5 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="relative shrink-0">
              {photoUrl ? (
                <div className="relative h-[52px] w-[52px] overflow-hidden rounded-2xl border border-astro-border/50 shadow-sm sm:h-14 sm:w-14">
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
                <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl border border-astro-border/50 bg-astro-bg/50 font-serif text-lg font-semibold text-astro-text sm:h-14 sm:w-14 sm:text-xl">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              {profile.isPremium && (
                <span className="absolute -bottom-1 -right-1 rounded-md border border-astro-card bg-astro-highlight/20 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-astro-highlight">
                  Pro
                </span>
              )}
            </div>

            <div className="flex min-w-0 flex-1 items-start justify-end gap-2 sm:gap-3">
              {weatherData && (
                <div className="min-w-0 max-w-[11rem] rounded-2xl border border-astro-border/40 bg-astro-bg/25 px-3 py-2 sm:max-w-none sm:px-4 sm:py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl opacity-90 sm:text-2xl" aria-hidden>
                      {getWeatherIcon(weatherData.condition)}
                    </span>
                    <div className="min-w-0 text-right">
                      <p className="font-serif text-lg font-medium leading-none text-astro-text sm:text-xl">
                        {Math.round(weatherData.temp)}°
                      </p>
                      <p
                        className="mt-1 truncate text-[10px] leading-tight text-astro-subtext/85"
                        title={translateWeather(weatherData.condition, lang)}
                      >
                        {translateWeather(weatherData.condition, lang)}
                      </p>
                      {weatherData.city && (
                        <p className="mt-0.5 truncate text-[9px] text-astro-subtext/55">{weatherData.city}</p>
                      )}
                      {weatherData.moonPhase && (
                        <p className="mt-0.5 text-[9px] text-astro-highlight/60">
                          {translateMoonPhase(weatherData.moonPhase.phase, lang)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onOpenSettings}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-transparent text-astro-subtext transition-colors hover:border-astro-border/50 hover:bg-astro-bg/40 hover:text-astro-text"
                aria-label={getText(lang, 'settings.title')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-6 border-t border-astro-border/35 pt-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-astro-subtext/90">
              {getText(lang, 'dashboard.passport')}
            </p>
            <h1 className="mt-2 font-serif text-2xl font-semibold tracking-tight text-astro-text sm:text-3xl">
              {profile.name || displayName}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-astro-border/50 bg-astro-bg/30 px-3 py-1.5 text-xs text-astro-text">
                <span className="text-[14px] text-astro-highlight/70" aria-hidden>
                  ☉
                </span>
                <span className="font-medium">{sunLabel}</span>
              </span>
              {moonLabel && (
                <span className="inline-flex items-center gap-2 rounded-full border border-astro-border/40 bg-astro-bg/20 px-3 py-1.5 text-xs text-astro-subtext">
                  <span className="text-[14px] text-astro-highlight/50" aria-hidden>
                    ☽
                  </span>
                  <span>{moonLabel}</span>
                </span>
              )}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-2xl border border-astro-border/35 bg-astro-bg/20 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-astro-subtext/80">
                  {getText(lang, 'dashboard.element')}
                </p>
                <p className="mt-1.5 font-serif text-base text-astro-text sm:text-lg">
                  {getElement(lang, chartData.element)}
                </p>
              </div>
              <div className="rounded-2xl border border-astro-border/35 bg-astro-bg/15 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-astro-subtext/80">
                  {getText(lang, 'chart.summary')}
                </p>
                <p className="mt-1.5 text-sm leading-snug text-astro-subtext sm:text-[15px]">
                  {getText(lang, 'dashboard.passport_tagline')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

CosmicPassport.displayName = 'CosmicPassport';
