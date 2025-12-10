
import React, { useState, useEffect, useMemo, memo, useCallback } from 'react';
import { UserProfile, NatalChartData, UserContext, UserEvolution } from '../types';
import { getText } from '../constants';
import { SolarSystem } from '../components/SolarSystem';
import { Loading } from '../components/ui/Loading';
import { getUserContext } from '../services/contextService';
import { updateUserEvolution } from '../services/astrologyService';
import { saveProfile } from '../services/storageService';
import { getOrGenerateHoroscope } from '../services/contentGenerationService';
import { motion } from 'framer-motion';
import { CosmicPassport } from '../components/Dashboard/CosmicPassport';
import { SoulEvolution } from '../components/Dashboard/SoulEvolution';

interface DashboardProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    requestPremium: () => void;
    onNavigate: (view: any) => void;
    onOpenSettings: () => void;
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

export const Dashboard = memo<DashboardProps>(({ profile, chartData, requestPremium, onNavigate, onOpenSettings }) => {
    
    const [context, setContext] = useState<UserContext | null>(null);
    const [evolution, setEvolution] = useState<UserEvolution | null>(profile.evolution || null);
    const [tgUser, setTgUser] = useState<any>(null);
    const [dailyHoroscope, setDailyHoroscope] = useState<any>(null);

    // Мемуизируем язык для оптимизации
    const language = useMemo(() => profile.language, [profile.language]);

    // Мемуизируем displayName и photoUrl
    const displayName = useMemo(() => tgUser?.first_name || profile.name, [tgUser?.first_name, profile.name]);
    const photoUrl = useMemo(() => tgUser?.photo_url, [tgUser?.photo_url]);

    const horoscopeDateLabel = useMemo(() => {
        const locale = language === 'ru' ? 'ru-RU' : 'en-US';
        const rawDate = dailyHoroscope?.date ? new Date(dailyHoroscope.date) : new Date();
        if (Number.isNaN(rawDate.getTime())) return '';
        return rawDate.toLocaleDateString(locale, {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }, [dailyHoroscope?.date, language]);

    // Мемуизируем колбэки для навигации
    const handleNavigateHoroscope = useCallback(() => onNavigate('horoscope'), [onNavigate]);
    const handleNavigateChart = useCallback(() => onNavigate('chart'), [onNavigate]);
    const handleNavigateSynastry = useCallback(() => onNavigate('synastry'), [onNavigate]);
    const handleNavigateOracle = useCallback(() => onNavigate('oracle'), [onNavigate]);

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            setTgUser(tg.initDataUnsafe.user);
        }
    }, []);

    // Отдельный useEffect для обновления ТОЛЬКО погоды при изменении weatherCity
    // ВАЖНО: Этот useEffect НЕ должен вызывать генерацию карты или гороскопа
    useEffect(() => {
        const updateWeatherContext = async () => {
            if (profile.weatherCity) {
                try {
                    // Загружаем только погоду, не трогая другие данные
                    const ctx = await getUserContext(profile);
                    // Обновляем только weatherData в контексте, не трогая остальное
                    setContext(prev => {
                        if (!prev) {
                            return { ...ctx, mood: 'Neutral' };
                        }
                        return { ...prev, weatherData: ctx.weatherData, weather: ctx.weather, moonPhase: ctx.moonPhase };
                    });
                    if (!ctx.weatherData) {
                        console.warn('[Dashboard] Weather city is set but weather data was not loaded', {
                            weatherCity: profile.weatherCity
                        });
                    }
                } catch (error) {
                    console.error('[Dashboard] Failed to load weather context:', error);
                    // При ошибке НЕ делаем ничего - просто не показываем погоду
                    // НЕ вызываем генерацию карты или гороскопа!
                }
            } else {
                // Если город не указан, очищаем только контекст погоды
                setContext(prev => prev ? { ...prev, weatherData: undefined, weather: undefined, moonPhase: undefined } : null);
            }
        };
        updateWeatherContext();
    }, [profile.weatherCity]); // Обновляем только при изменении weatherCity

    // Основной useEffect для загрузки данных при первой загрузке или изменении профиля/карты
    // ВАЖНО: Этот useEffect НЕ должен срабатывать при изменении weatherCity
    useEffect(() => {
        // Загружаем контекст и эволюцию асинхронно после показа интерфейса
        const loadSmartFeatures = async () => {
            // Небольшая задержка, чтобы не блокировать показ интерфейса
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 1. Load Context (Weather/Social Proof) - только при первой загрузке
            // ВАЖНО: Загружаем контекст только при первой загрузке или изменении основных данных
            // НЕ загружаем погоду здесь - она обрабатывается отдельным useEffect
            try {
                const ctx = await getUserContext(profile);
                // Обновляем контекст, но если погода уже загружена - сохраняем её
                setContext(prev => {
                    if (!prev) return ctx;
                    // Сохраняем погоду если она уже была загружена
                    return { ...ctx, weatherData: prev.weatherData || ctx.weatherData, weather: prev.weather || ctx.weather, moonPhase: prev.moonPhase || ctx.moonPhase };
                });
                if (profile.weatherCity && !ctx.weatherData) {
                    console.warn('[Dashboard] Weather city is set but weather data was not loaded', {
                        weatherCity: profile.weatherCity
                    });
                }
            } catch (error) {
                console.error('[Dashboard] Failed to load context:', error);
                // При ошибке НЕ делаем ничего - просто не показываем контекст
            }

            // 2. Load Daily Horoscope (with cache check)
            // ВАЖНО: Используем кэш из профиля, не генерируем каждый раз!
            // Загружаем ТОЛЬКО если chartData есть
            if (chartData) {
                try {
                    // Проверяем кэш перед загрузкой
                    const today = new Date().toISOString().split('T')[0];
                    const cachedHoroscope = profile.generatedContent?.dailyHoroscope;
                    
                    // Если есть актуальный кэш - используем его БЕЗ вызова API
                    if (cachedHoroscope && cachedHoroscope.date === today && cachedHoroscope.content) {
                        console.log('[Dashboard] Using cached horoscope from profile (no API call)', {
                            date: cachedHoroscope.date,
                            hasContent: !!cachedHoroscope.content
                        });
                        setDailyHoroscope(cachedHoroscope);
                    } else {
                        // Если кэша нет или он устарел - загружаем через API (который проверит централизованный кэш)
                        console.log('[Dashboard] Cache miss or outdated, loading horoscope from API', {
                            hasCache: !!cachedHoroscope,
                            cacheDate: cachedHoroscope?.date,
                            today
                        });
                        const horoscope = await getOrGenerateHoroscope(profile, chartData, 'daily');
                        setDailyHoroscope(horoscope);
                    }
                } catch (error) {
                    console.error('[Dashboard] Failed to load horoscope:', error);
                    // При ошибке используем кэш если есть
                    const cachedHoroscope = profile.generatedContent?.dailyHoroscope;
                    if (cachedHoroscope) {
                        console.log('[Dashboard] Using cached horoscope as fallback after error');
                        setDailyHoroscope(cachedHoroscope);
                    }
                }
            }

            // 3. Update Evolution (Simulated Async)
            if (!profile.evolution || (Date.now() - profile.evolution.lastUpdated > 86400000)) {
                // Update once every 24 hours or if missing
                try {
                    console.log('[Dashboard] Updating user evolution...');
                    const newEvo = await updateUserEvolution(profile, chartData || undefined);
                    setEvolution(newEvo);
                    
                    // Save to profile
                    const updatedProfile = { ...profile, evolution: newEvo };
                    await saveProfile(updatedProfile);
                    console.log('[Dashboard] Evolution saved successfully');
                } catch (error) {
                    console.error('[Dashboard] Failed to update evolution:', error);
                }
            }
        };
        loadSmartFeatures();
    }, [profile.id, chartData?.sun?.sign]); // НЕ включаем weatherCity - он обрабатывается отдельным useEffect

    if (!chartData) return <Loading />;

    return (
        <div className="p-4 pb-32 space-y-6">
            
            {/* 1. COSMIC PASSPORT (Layer 1: Base) */}
            <CosmicPassport
              profile={profile}
              chartData={chartData}
              photoUrl={photoUrl}
              displayName={displayName}
              onOpenSettings={onOpenSettings}
              weatherData={context?.weatherData}
            />

            {/* 1.5. HOROSCOPE FOR TODAY */}
            <button 
                onClick={handleNavigateHoroscope}
                className="w-full bg-gradient-to-br from-purple-900/20 to-astro-card rounded-2xl p-6 shadow-soft relative overflow-hidden text-left transition-colors group"
            >
                <div className="absolute -top-16 -left-16 w-48 h-48 bg-purple-500 rounded-full blur-3xl opacity-20"></div>
                <div className="relative z-10">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
                                {profile.language === 'ru' ? 'Гороскоп на сегодня' : 'Today\'s Horoscope'}
                            </p>
                            {horoscopeDateLabel && (
                                <p className="text-[9px] text-astro-subtext mb-2">
                                    {profile.language === 'ru' ? `Дата прогноза: ${horoscopeDateLabel}` : `Forecast date: ${horoscopeDateLabel}`}
                                </p>
                            )}
                            {dailyHoroscope?.content ? (
                                <>
                                    {/* Краткий гороскоп - только первое предложение или первые 2-3 предложения */}
                                    <h3 className="font-serif text-lg text-astro-text mb-2">
                                        {(() => {
                                            // Берем первые 2-3 предложения для краткого отображения
                                            const sentences = dailyHoroscope.content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
                                            const shortText = sentences.slice(0, 2).join('. ').trim();
                                            return shortText.length > 0 ? shortText + '.' : dailyHoroscope.content.substring(0, 150) + '...';
                                        })()}
                                    </h3>
                                    {dailyHoroscope.mood && (
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs text-astro-subtext">
                                                {profile.language === 'ru' ? 'Настроение:' : 'Mood:'} <span className="text-astro-highlight font-medium">{dailyHoroscope.mood}</span>
                                            </span>
                                            {dailyHoroscope.color && (
                                                <>
                                                    <span className="text-astro-subtext">•</span>
                                                    <span className="text-xs text-astro-subtext">
                                                        {profile.language === 'ru' ? 'Цвет:' : 'Color:'} <span className="text-astro-highlight font-medium">{dailyHoroscope.color}</span>
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <h3 className="font-serif text-xl text-astro-text mb-2">
                                    {profile.language === 'ru' ? 'Сегодня тебя ждёт особенный день' : 'A special day awaits you'}
                                </h3>
                            )}
                        </div>
                        <div className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-astro-highlight/20 to-astro-highlight/5 border-2 border-astro-highlight/40 flex items-center justify-center group-hover:scale-110 transition-all shadow-md group-hover:shadow-lg ml-3">
                            <span className="text-3xl md:text-4xl text-astro-highlight opacity-90" style={{ filter: 'drop-shadow(0 2px 6px rgba(191, 161, 255, 0.3))' }}>☾</span>
                        </div>
                    </div>
                    <div className="text-xs text-astro-highlight font-medium mb-2">
                        {profile.language === 'ru' ? 'Подробный прогноз →' : 'Detailed forecast →'}
                    </div>
                    <p className="text-[9px] text-astro-subtext/70 font-light italic mt-3 pt-3 border-t border-astro-border/30">
                        {profile.language === 'ru' 
                            ? 'Гороскоп составлен на основе ваших планет, Луны, Солнца и точных данных рождения' 
                            : 'Horoscope generated from your planets, Moon, Sun and precise birth data'}
                    </p>
                </div>
            </button>

            {/* 2. PRIMARY ACTION: NATAL CHART */}
            <button 
                onClick={handleNavigateChart}
                className="w-full bg-gradient-to-br from-purple-900/20 to-astro-card rounded-2xl p-6 text-left transition-colors shadow-soft group relative overflow-hidden"
            >
                <div className="absolute -top-16 -left-16 w-48 h-48 bg-purple-500 rounded-full blur-3xl opacity-20"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="font-serif text-xl text-astro-text mb-1">{getText(profile.language, 'dashboard.menu_analysis')}</h3>
                            <p className="text-astro-subtext text-xs font-light">
                                {profile.language === 'ru' ? 'Личность, судьба, карма и прогнозы' : 'Personality, Fate, Karma & Forecasts'}
                            </p>
                        </div>
                        <div className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-astro-highlight/20 to-astro-highlight/5 border-2 border-astro-highlight/40 flex items-center justify-center group-hover:scale-110 group-hover:rotate-[-10deg] transition-all shadow-md group-hover:shadow-lg">
                            <span className="text-3xl md:text-4xl text-astro-highlight opacity-90" style={{ filter: 'drop-shadow(0 2px 6px rgba(191, 161, 255, 0.3))' }}>→</span>
                        </div>
                    </div>
                </div>
            </button>

            {/* 3. SOCIAL PROOF (Layer 2/4: Community) */}
            {context?.socialProof && (
                <div className="overflow-hidden py-2 bg-astro-bg border-y border-astro-border/50">
                    <motion.div 
                        className="whitespace-nowrap text-[10px] uppercase tracking-widest text-astro-subtext"
                        animate={{ x: [300, -500] }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    >
                        ★ {context.socialProof} ★
                    </motion.div>
                </div>
            )}

            {/* 4. SOUL EVOLUTION (Layer 4: Evolution) */}
            {evolution && (
                <SoulEvolution evolution={evolution} language={language} />
            )}

            {/* 5. COSMIC WEATHER (Layer 3: Context) */}
            {profile.weatherCity ? (
                context?.weatherData ? (
                    <div className="bg-gradient-to-r from-astro-card to-astro-bg p-5 rounded-xl border border-astro-border relative overflow-hidden">
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex-1">
                                    <h3 className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
                                        {getText(profile.language, 'dashboard.context_weather')}
                                    </h3>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-xl font-serif text-astro-text">
                                            {translateWeather(context.weatherData.condition, profile.language)}
                                        </p>
                                        <span className="text-sm text-astro-subtext">
                                            {context.weatherData.temp}°C
                                        </span>
                                    </div>
                                    <p className="text-xs text-astro-subtext mt-1">
                                        {context.weatherData.city}
                                        {context.weatherData.humidity && ` • ${context.weatherData.humidity}% ${profile.language === 'ru' ? 'влажность' : 'humidity'}`}
                                    </p>
                                    <p className="text-[9px] text-astro-subtext/70 mt-1">
                                        {profile.language === 'ru' ? 'Обновлено только что' : 'Updated just now'}
                                    </p>
                                </div>
                                <div className="text-3xl opacity-50 text-astro-highlight">
                                    {context.weatherData.condition.toLowerCase().includes('rain') || context.weatherData.condition.toLowerCase().includes('дождь') ? '☂' : 
                                     context.weatherData.condition.toLowerCase().includes('sun') || context.weatherData.condition.toLowerCase().includes('солн') ? '☀' : 
                                     context.weatherData.condition.toLowerCase().includes('cloud') || context.weatherData.condition.toLowerCase().includes('облач') ? '☁' : 
                                     context.weatherData.condition.toLowerCase().includes('clear') || context.weatherData.condition.toLowerCase().includes('ясн') ? '☀' : '🌤'}
                                </div>
                            </div>
                            
                            {context.moonPhase && (
                                <div className="mt-3 pt-3 border-t border-astro-border/30">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-xs text-astro-subtext uppercase tracking-wider">
                                                {profile.language === 'ru' ? 'Фаза Луны' : 'Moon Phase'}
                                            </p>
                                            <p className="text-sm font-serif text-astro-text mt-1">
                                                {translateMoonPhase(context.moonPhase.phase, profile.language)}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-astro-subtext">
                                                {context.moonPhase.illumination}%
                                            </p>
                                            <p className="text-[10px] text-astro-subtext uppercase tracking-wider">
                                                {profile.language === 'ru' ? 'освещённость' : 'illumination'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            <p className="text-xs text-astro-subtext mt-3 font-light italic">
                                {profile.language === 'ru' ? 'Звёзды согласны с небом сегодня...' : 'The stars align with the sky today...'}
                            </p>
                            
                            {/* WeatherAPI Attribution */}
                            <div className="mt-3 pt-2 border-t border-astro-border/20">
                                <a 
                                    href="https://www.weatherapi.com/" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[8px] text-astro-subtext hover:text-astro-highlight transition-colors flex items-center gap-1"
                                >
                                    <span>{profile.language === 'ru' ? 'Погода от' : 'Weather by'}</span>
                                    <span className="underline">WeatherAPI.com</span>
                                </a>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-gradient-to-r from-astro-card to-astro-bg p-5 rounded-xl border border-astro-border relative overflow-hidden opacity-60">
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <h3 className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
                                    {getText(profile.language, 'dashboard.context_weather')}
                                </h3>
                                <p className="text-sm font-serif text-astro-text">
                                    {profile.language === 'ru' ? 'Загрузка погоды...' : 'Loading weather...'}
                                </p>
                            </div>
                            <div className="text-3xl opacity-30 text-astro-highlight animate-pulse">☁</div>
                        </div>
                    </div>
                )
            ) : (
                <button 
                    onClick={onOpenSettings}
                    className="w-full bg-gradient-to-r from-astro-card to-astro-bg p-5 rounded-xl border border-astro-border relative overflow-hidden text-left hover:border-astro-highlight/50 transition-colors group"
                >
                    <div className="relative z-10 flex items-center justify-between">
                        <div>
                            <h3 className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
                                {getText(profile.language, 'dashboard.context_weather')}
                            </h3>
                            <p className="text-sm font-serif text-astro-text">
                                {profile.language === 'ru' 
                                    ? 'Укажите город в настройках для отображения погоды'
                                    : 'Set city in settings to see weather'}
                            </p>
                        </div>
                        <div className="text-3xl opacity-30 text-astro-highlight group-hover:opacity-50 transition-opacity">☁</div>
                    </div>
                    <p className="relative z-10 text-xs text-astro-subtext mt-2 font-light italic">
                        {profile.language === 'ru' 
                            ? 'Нажмите, чтобы открыть настройки →' 
                            : 'Tap to open settings →'}
                    </p>
                </button>
            )}

            {/* 6. SECONDARY ACTIONS */}
            <div className="grid grid-cols-2 gap-4">
                
                {/* Synastry - доступна всем */}
                <button 
                    onClick={handleNavigateSynastry}
                    className="bg-gradient-to-br from-pink-900/20 to-astro-card p-5 rounded-2xl text-left transition-colors shadow-soft group relative overflow-hidden"
                >
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500 rounded-full blur-2xl opacity-20"></div>
                    <div className="relative z-10 flex flex-col justify-between h-28">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-pink-400/20 to-pink-600/5 border-2 border-pink-400/40 flex items-center justify-center group-hover:scale-110 transition-all shadow-md group-hover:shadow-lg">
                            <span className="text-2xl md:text-3xl text-pink-400 opacity-90" style={{ filter: 'drop-shadow(0 2px 6px rgba(244, 114, 182, 0.3))' }}>♥</span>
                        </div>
                        <div>
                            <h3 className="font-serif text-base text-astro-text mb-1">{getText(profile.language, 'dashboard.menu_synastry')}</h3>
                            <p className="text-astro-subtext text-[10px] font-light">
                                {profile.language === 'ru' ? 'Совместимость' : 'Check compatibility'}
                            </p>
                            {!profile.isPremium && (
                                <span className="text-[8px] text-astro-highlight uppercase tracking-wider">
                                    {profile.language === 'ru' ? 'Бесплатный тизер' : 'Free preview'}
                                </span>
                            )}
                        </div>
                    </div>
                </button>

                 {/* Personal Oracle */}
                <button 
                    onClick={handleNavigateOracle}
                    className="bg-gradient-to-br from-blue-900/20 to-astro-card p-5 rounded-2xl text-left transition-colors shadow-soft group relative overflow-hidden"
                >
                    <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-500 rounded-full blur-2xl opacity-20"></div>
                    {!profile.isPremium && <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] flex items-center justify-center z-20 rounded-2xl"><span className="text-xs font-bold bg-astro-text text-astro-bg px-2 py-1 rounded">PRO</span></div>}
                    <div className="relative z-10 flex flex-col justify-between h-28">
                        <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/5 border-2 border-blue-400/40 flex items-center justify-center group-hover:scale-110 group-hover:rotate-[20deg] transition-all shadow-md group-hover:shadow-lg">
                            <span className="text-2xl md:text-3xl text-blue-400 opacity-90" style={{ filter: 'drop-shadow(0 2px 6px rgba(96, 165, 250, 0.3))' }}>✧</span>
                        </div>
                        <div>
                             <h3 className="font-serif text-base text-astro-text mb-1">{getText(profile.language, 'dashboard.menu_oracle')}</h3>
                             <p className="text-astro-subtext text-[10px] font-light">
                                {profile.language === 'ru' ? 'Спроси у Астры' : 'Ask Astra anything'}
                             </p>
                        </div>
                    </div>
                </button>
            </div>

            {/* Knowledge Base: Planets */}
            <SolarSystem language={language} />
        </div>
    );
});

Dashboard.displayName = 'Dashboard';
