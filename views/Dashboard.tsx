
import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
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
import { WeatherWidget } from '../components/Dashboard/WeatherWidget';

interface DashboardProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    requestPremium: () => void;
    onNavigate: (view: any) => void;
    onOpenSettings: () => void;
    onUpdateProfile: (profile: UserProfile) => void;
}


export const Dashboard = memo<DashboardProps>(({ profile, chartData, requestPremium, onNavigate, onOpenSettings, onUpdateProfile }) => {
    
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

    // Загрузка погоды для города из профиля (weatherCity хранится в БД)
    useEffect(() => {
        const loadWeather = async () => {
            const weatherCity = profile.weatherCity?.trim();
            if (weatherCity && weatherCity.length > 0) {
                try {
                    const ctx = await getUserContext(profile);
                    setContext(prev => {
                        if (!prev) {
                            return { ...ctx, mood: 'Neutral' };
                        }
                        return { 
                            ...prev, 
                            weatherData: ctx.weatherData, 
                            weather: ctx.weather, 
                            moonPhase: ctx.moonPhase 
                        };
                    });
                } catch (error) {
                    // При ошибке просто не показываем погоду
                }
            } else {
                setContext(prev => prev ? { ...prev, weatherData: undefined, weather: undefined, moonPhase: undefined } : null);
            }
        };
        loadWeather();
    }, [profile.weatherCity]);

    // Основной useEffect для загрузки данных при первой загрузке или изменении профиля/карты
    // ВАЖНО: Этот useEffect НЕ должен срабатывать при изменении weatherCity или других несущественных полей
    // Используем ref для отслеживания того, что данные уже загружены
    const dataLoadedRef = useRef(false);
    const profileIdRef = useRef(profile.id);
    const zodiacSignRef = useRef(chartData?.sun?.sign);
    
    useEffect(() => {
        // Проверяем, изменились ли критически важные данные
        const profileIdChanged = profileIdRef.current !== profile.id;
        const zodiacSignChanged = zodiacSignRef.current !== chartData?.sun?.sign;
        
        // Если данные уже загружены и ничего критического не изменилось - пропускаем
        if (dataLoadedRef.current && !profileIdChanged && !zodiacSignChanged) {
            return;
        }
        
        // Обновляем refs
        profileIdRef.current = profile.id;
        zodiacSignRef.current = chartData?.sun?.sign;
        dataLoadedRef.current = true;
        
        // Загружаем контекст и эволюцию асинхронно после показа интерфейса
        const loadSmartFeatures = async () => {
            // Небольшая задержка, чтобы не блокировать показ интерфейса
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 1. Load Social Proof (погода загружается отдельным useEffect)
            try {
                const ctx = await getUserContext(profile);
                setContext(prev => {
                    if (!prev) {
                        return { ...ctx, mood: 'Neutral' };
                    }
                    return { 
                        ...ctx, 
                        weatherData: prev.weatherData || ctx.weatherData, 
                        weather: prev.weather || ctx.weather, 
                        moonPhase: prev.moonPhase || ctx.moonPhase 
                    };
                });
            } catch (error) {
                // При ошибке просто не показываем контекст
            }

            // 2. Load Daily Horoscope из БД (генерируется только раз в день)
            if (chartData) {
                const today = new Date().toISOString().split('T')[0];
                const cachedHoroscope = profile.generatedContent?.dailyHoroscope;
                
                // Если есть гороскоп на сегодня - используем из БД БЕЗ запроса к API
                if (cachedHoroscope && cachedHoroscope.date === today && cachedHoroscope.content && cachedHoroscope.content.length > 0) {
                    setDailyHoroscope(cachedHoroscope);
                } else {
                    // Если гороскопа на сегодня нет - генерируем, сохраняем в БД и показываем
                    try {
                        const horoscope = await getOrGenerateHoroscope(profile, chartData);
                        setDailyHoroscope(horoscope);
                        
                        if (onUpdateProfile) {
                            const updatedProfile = { ...profile };
                            if (!updatedProfile.generatedContent) {
                                updatedProfile.generatedContent = {
                                    timestamps: {}
                                };
                            }
                            updatedProfile.generatedContent.dailyHoroscope = horoscope;
                            onUpdateProfile(updatedProfile);
                        }
                    } catch (error) {
                        // При ошибке используем старый кэш если есть
                        if (cachedHoroscope && cachedHoroscope.content) {
                            setDailyHoroscope(cachedHoroscope);
                        }
                    }
                }
            }

            // 3. Update Evolution (Simulated Async)
            if (!profile.evolution || (Date.now() - profile.evolution.lastUpdated > 86400000)) {
                try {
                    const newEvo = await updateUserEvolution(profile, chartData || undefined);
                    setEvolution(newEvo);
                    const updatedProfile = { ...profile, evolution: newEvo };
                    await saveProfile(updatedProfile);
                } catch (error) {
                    // Ошибка не критична
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
                            <span className="text-3xl md:text-4xl text-astro-highlight opacity-90" style={{ filter: 'drop-shadow(0 2px 6px rgba(191, 161, 255, 0.3))' }}>L</span>
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
                        {context.socialProof}
                    </motion.div>
                </div>
            )}

            {/* 4. SOUL EVOLUTION (Layer 4: Evolution) */}
            {evolution && (
                <SoulEvolution evolution={evolution} language={language} />
            )}

            {/* 5. COSMIC WEATHER (Layer 3: Context) */}
            {profile.weatherCity ? (
                context?.weatherData && chartData ? (
                    <WeatherWidget 
                        profile={profile}
                        chartData={chartData}
                        weatherData={context.weatherData}
                        dailyHoroscope={dailyHoroscope}
                    />
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
                            <div className="text-3xl opacity-30 text-astro-highlight animate-pulse">...</div>
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
                        <div className="text-3xl opacity-30 text-astro-highlight group-hover:opacity-50 transition-opacity">...</div>
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
