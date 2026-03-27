import React, { memo } from 'react';
import Image from 'next/image';
import { UserProfile, NatalChartData, UserContext } from '../../types';
import { getText, getZodiacSign, getElement } from '../../constants';
import { LumiaLogo } from '../brand/LumiaLogo';

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
      <div className="relative overflow-hidden rounded-3xl border border-astro-border/50 bg-astro-card/90 shadow-soft backdrop-blur-sm">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/30 to-transparent opacity-70" aria-hidden />

        <div className="relative px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="mb-5 flex justify-center">
            <LumiaLogo variant="row" className="scale-[0.82] opacity-[0.92] sm:scale-90" />
          </div>

          {/* Одна сетка: аватар | имя и знаки | погода + настройки — выравнивание по центру строки */}
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-0">
            <div className="relative h-14 w-14 shrink-0 sm:h-[60px] sm:w-[60px]">
              {photoUrl ? (
                <div className="relative h-full w-full overflow-hidden rounded-full border-2 border-astro-border/40 bg-astro-bg shadow-sm ring-2 ring-white/50 ring-offset-2 ring-offset-astro-card">
                  <Image
                    src={photoUrl}
                    alt=""
                    width={60}
                    height={60}
                    className="h-full w-full object-cover"
                    unoptimized={photoUrl.startsWith('http')}
                  />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-astro-border/40 bg-astro-bg/60 font-serif text-xl font-semibold text-astro-text shadow-sm">
                  {displayNameFinal.charAt(0).toUpperCase()}
                </div>
              )}
              {profile.isPremium && (
                <span className="absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-astro-card bg-astro-highlight/90 px-1.5 py-0.5 text-[7px] font-bold uppercase leading-none tracking-wide text-white shadow-sm">
                  Pro
                </span>
              )}
            </div>

            <div className="min-w-0 py-0.5 text-left">
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-astro-subtext/90">
                {getText(lang, 'dashboard.passport')}
              </p>
              <h1 className="mt-1 truncate font-serif text-[22px] font-semibold leading-tight tracking-tight text-astro-text sm:text-[26px]">
                {displayNameFinal}
              </h1>
              <p className="mt-1.5 text-[13px] leading-snug text-astro-subtext sm:text-sm">{signsLine}</p>
            </div>

            <div className="flex shrink-0 flex-col items-end justify-center gap-2 self-center">
              {weatherData && (
                <div className="max-w-[9.5rem] rounded-2xl border border-astro-border/35 bg-astro-bg/40 px-2.5 py-2 sm:max-w-[10.5rem] sm:px-3">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-lg leading-none opacity-90" aria-hidden>
                      {getWeatherIcon(weatherData.condition)}
                    </span>
                    <div className="min-w-0 text-right">
                      <p className="font-sans text-base font-semibold tabular-nums leading-none text-astro-text sm:text-lg">
                        {Math.round(weatherData.temp)}°
                      </p>
                      <p
                        className="mt-1 line-clamp-1 text-[9px] leading-tight text-astro-subtext/85"
                        title={translateWeather(weatherData.condition, lang)}
                      >
                        {translateWeather(weatherData.condition, lang)}
                        {weatherData.city ? ` · ${weatherData.city}` : ''}
                      </p>
                      {weatherData.moonPhase && (
                        <p className="mt-0.5 line-clamp-1 text-[8px] text-astro-highlight/70">
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
                className="flex h-9 w-9 items-center justify-center rounded-full border border-astro-border/40 bg-astro-bg/30 text-astro-subtext transition-colors hover:border-astro-border/60 hover:bg-astro-bg/50 hover:text-astro-text"
                aria-label={getText(lang, 'settings.title')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

          {/* Без второй «карточки в карточке»: одна линия стихии + теглайн (не дублируем «Кратко о тебе») */}
          <div className="mt-5 border-t border-astro-border/30 pt-4">
            <p className="text-[13px] leading-relaxed text-astro-text sm:text-sm">
              <span className="font-medium text-astro-text">{getText(lang, 'dashboard.element')}</span>
              <span className="text-astro-subtext"> — </span>
              <span className="text-astro-text">{getElement(lang, chartData.element)}</span>
              <span className="mx-2 text-astro-border/80">·</span>
              <span className="text-astro-subtext/95">{getText(lang, 'dashboard.passport_tagline')}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }
);

CosmicPassport.displayName = 'CosmicPassport';
