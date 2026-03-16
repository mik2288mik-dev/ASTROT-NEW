
import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import { UserProfile, NatalChartData, UserContext } from '../types';
import { getText } from '../constants';
import { SolarSystem } from '../components/SolarSystem';
import { Loading } from '../components/ui/Loading';
import { getTodayWeather } from '../services/weatherService';
import { motion } from 'framer-motion';
import { CosmicPassport } from '../components/Dashboard/CosmicPassport';
import { WeatherWidget } from '../components/Dashboard/WeatherWidget';

interface DashboardProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    onNavigate: (view: any) => void;
    onOpenSettings: () => void;
    onContextUpdate?: (context: UserContext | null) => void;
}


export const Dashboard = memo<DashboardProps>(({ profile, chartData, onNavigate, onOpenSettings, onContextUpdate }) => {
    
    const [context, setContext] = useState<UserContext | null>(null);
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
    const handleNavigateCharts = useCallback(() => onNavigate('charts'), [onNavigate]);
    const handleNavigateSynastry = useCallback(() => onNavigate('synastry'), [onNavigate]);
    const handleNavigateOracle = useCallback(() => onNavigate('oracle'), [onNavigate]);

    useEffect(() => {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.initDataUnsafe?.user) {
            setTgUser(tg.initDataUnsafe.user);
        }
    }, []);

    // Загрузка погоды через новый API (город хранится в БД user_settings)
    useEffect(() => {
        const userId = profile.id;
        if (!userId) return;
        
        const loadWeather = async () => {
            try {
                const data = await getTodayWeather(userId);
                if (data) {
                    const nextContext = {
                        mood: 'Neutral',
                        weatherData: {
                            city: data.city,
                            temp: data.temp,
                            condition: data.condition,
                            humidity: data.humidity ?? 0,
                            moonPhase: data.moonPhase ? {
                                phase: data.moonPhase.phase,
                                illumination: parseInt(data.moonPhase.illumination) || 0
                            } : undefined
                        }
                    };
                    setContext(nextContext);
                    onContextUpdate?.(nextContext);
                }
            } catch {
                // При ошибке просто не показываем погоду
                setContext(null);
            }
        };
        
        loadWeather();
    }, [profile.id, profile.weatherCity]);

    // Sync: when profile.generatedContent.dailyHoroscope arrives, apply immediately (no guard)
    useEffect(() => {
        const cached = profile.generatedContent?.dailyHoroscope;
        if (cached && cached.content) {
            setDailyHoroscope(cached);
        }
    }, [profile.generatedContent?.dailyHoroscope]);

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
        
        // Загружаем данные асинхронно (horoscope sync handled by dedicated effect above)
        const loadDashboardData = async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
            const cachedHoroscope = profile.generatedContent?.dailyHoroscope;
            if (cachedHoroscope && cachedHoroscope.content) {
                setDailyHoroscope(cachedHoroscope);
            }
        };
        
        loadDashboardData();
    }, [profile.id, chartData?.sun?.sign]);

    if (!chartData) return <Loading message={getText(profile.language, 'loading')} />;

    return (
        <div className="p-4 space-y-6 screen-pb">
            
            {/* 1. COSMIC PASSPORT (Layer 1: Base) */}
            <CosmicPassport
              profile={profile}
              chartData={chartData}
              photoUrl={photoUrl}
              displayName={displayName}
              onOpenSettings={onOpenSettings}
              weatherData={context?.weatherData}
            />

            {/* Horoscope */}
            <button 
                onClick={handleNavigateHoroscope}
                className="w-full bg-astro-card rounded-xl p-5 border border-astro-border hover:border-astro-highlight/30 transition-colors text-left"
            >
                <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
                    {getText(profile.language, 'dashboard.horoscope_today')}
                </p>
                {horoscopeDateLabel && (
                    <p className="text-[9px] text-astro-subtext mb-2">
                        {getText(profile.language, 'dashboard.forecast_date')}: {horoscopeDateLabel}
                    </p>
                )}
                {dailyHoroscope?.content ? (
                    <>
                        <h3 className="font-serif text-base text-astro-text mb-2 line-clamp-2">
                            {(() => {
                                const sentences = dailyHoroscope.content.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
                                const shortText = sentences.slice(0, 2).join('. ').trim();
                                return shortText.length > 0 ? shortText + '.' : dailyHoroscope.content.substring(0, 120) + '...';
                            })()}
                        </h3>
                        {(dailyHoroscope.mood || dailyHoroscope.color) && (
                            <div className="flex items-center gap-2 flex-wrap text-xs text-astro-subtext">
                                {dailyHoroscope.mood && (
                                    <span>{getText(profile.language, 'dashboard.mood')}: <span className="text-astro-highlight font-medium">{dailyHoroscope.mood}</span></span>
                                )}
                                {dailyHoroscope.mood && dailyHoroscope.color && <span>·</span>}
                                {dailyHoroscope.color && (
                                    <span>{getText(profile.language, 'dashboard.color')}: <span className="text-astro-highlight font-medium">{dailyHoroscope.color}</span></span>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <h3 className="font-serif text-base text-astro-text">
                        {getText(profile.language, 'dashboard.special_day')}
                    </h3>
                )}
                <p className="text-xs text-astro-highlight font-medium mt-2">
                    {getText(profile.language, 'dashboard.detailed_forecast')}
                </p>
            </button>

            {/* Natal Chart CTA */}
            <button 
                onClick={handleNavigateChart}
                className="w-full bg-astro-card rounded-xl p-5 border border-astro-border hover:border-astro-highlight/30 transition-colors text-left"
            >
                <h3 className="font-serif text-lg text-astro-text mb-0.5">{getText(profile.language, 'dashboard.menu_analysis')}</h3>
                <p className="text-astro-subtext text-xs">
                    {getText(profile.language, 'dashboard.chart_subtitle')}
                </p>
            </button>

            {/* My Charts shortcut */}
            <button 
                onClick={handleNavigateCharts}
                className="w-full bg-astro-card rounded-xl p-4 border border-astro-border hover:border-astro-highlight/30 transition-colors text-left flex items-center gap-3"
            >
                <span className="text-xl text-astro-highlight/90">◇</span>
                <div className="text-left">
                    <h3 className="font-serif text-sm text-astro-text mb-0.5">{getText(profile.language, 'dashboard.my_charts')}</h3>
                    <p className="text-astro-subtext text-[10px]">{getText(profile.language, 'dashboard.my_charts_subtitle')}</p>
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

            {/* 4. COSMIC WEATHER (Layer 3: Context) */}
            {profile.weatherCity ? (
                context?.weatherData && chartData ? (
                    <WeatherWidget 
                        profile={profile}
                        chartData={chartData}
                        weatherData={context.weatherData}
                    />
                ) : (
                    <div className="bg-astro-card/60 p-5 rounded-xl border border-astro-border opacity-70">
                        <h3 className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
                            {getText(profile.language, 'dashboard.context_weather')}
                        </h3>
                        <p className="text-sm text-astro-text">{getText(profile.language, 'dashboard.loading_weather')}</p>
                    </div>
                )
            ) : (
                <button 
                    onClick={onOpenSettings}
                    className="w-full bg-astro-card/60 p-5 rounded-xl border border-astro-border text-left hover:border-astro-highlight/40 transition-colors"
                >
                    <h3 className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
                        {getText(profile.language, 'dashboard.context_weather')}
                    </h3>
                    <p className="text-sm text-astro-text">{getText(profile.language, 'dashboard.set_city_hint')}</p>
                    <p className="text-xs text-astro-subtext mt-2">{getText(profile.language, 'dashboard.tap_settings')}</p>
                </button>
            )}

            {/* Synastry & Oracle */}
            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={handleNavigateSynastry}
                    className="bg-astro-card p-4 rounded-xl border border-astro-border hover:border-astro-highlight/30 transition-colors text-left"
                >
                    <span className="text-xl text-pink-400/90">♥</span>
                    <h3 className="font-serif text-sm text-astro-text mt-2 mb-0.5">{getText(profile.language, 'dashboard.menu_synastry')}</h3>
                    <p className="text-astro-subtext text-[10px]">{getText(profile.language, 'dashboard.synastry_subtitle')}</p>
                    {!profile.isPremium && (
                        <span className="text-[9px] text-astro-highlight uppercase tracking-wider mt-1 block">{getText(profile.language, 'dashboard.synastry_free')}</span>
                    )}
                </button>

                <button 
                    onClick={handleNavigateOracle}
                    className="bg-astro-card p-4 rounded-xl border border-astro-border hover:border-astro-highlight/30 transition-colors text-left relative"
                >
                    {!profile.isPremium && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold bg-astro-highlight/20 text-astro-highlight px-2 py-0.5 rounded-full uppercase">
                            {getText(profile.language, 'dashboard.premium_badge')}
                        </span>
                    )}
                    <span className="text-xl text-blue-400/90">✧</span>
                    <h3 className="font-serif text-sm text-astro-text mt-2 mb-0.5">{getText(profile.language, 'dashboard.menu_oracle')}</h3>
                    <p className="text-astro-subtext text-[10px]">{getText(profile.language, 'dashboard.oracle_subtitle')}</p>
                </button>
            </div>

            {/* Knowledge Base: Planets */}
            <SolarSystem language={language} />
        </div>
    );
});

Dashboard.displayName = 'Dashboard';
