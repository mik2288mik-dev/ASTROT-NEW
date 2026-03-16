import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import { UserProfile, NatalChartData, UserContext } from '../types';
import { getText } from '../constants';
import { SolarSystem } from '../components/SolarSystem';
import { Loading } from '../components/ui/Loading';
import { getTodayWeather } from '../services/weatherService';
import { motion } from 'framer-motion';
import { CosmicPassport } from '../components/Dashboard/CosmicPassport';
import { WeatherWidget } from '../components/Dashboard/WeatherWidget';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';

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

    const language = useMemo(() => profile.language, [profile.language]);
    const displayName = useMemo(() => tgUser?.first_name || profile.name, [tgUser?.first_name, profile.name]);
    const photoUrl = useMemo(() => tgUser?.photo_url, [tgUser?.photo_url]);

    const horoscopeDateLabel = useMemo(() => {
        return formatLumiaDate(dailyHoroscope?.date || getMoscowTodayKey(), language);
    }, [dailyHoroscope?.date, language]);

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
                                illumination: parseInt(data.moonPhase.illumination) || 0,
                            } : undefined,
                        },
                    };
                    setContext(nextContext);
                    onContextUpdate?.(nextContext);
                }
            } catch {
                setContext(null);
            }
        };

        loadWeather();
    }, [profile.id, profile.weatherCity, onContextUpdate]);

    useEffect(() => {
        const cached = profile.generatedContent?.dailyHoroscope;
        const today = getMoscowTodayKey();
        if (cached && cached.date === today && cached.content) {
            setDailyHoroscope(cached);
        } else {
            setDailyHoroscope(null);
        }
    }, [profile.generatedContent?.dailyHoroscope]);

    const dataLoadedRef = useRef(false);
    const profileIdRef = useRef(profile.id);
    const zodiacSignRef = useRef(chartData?.sun?.sign);

    useEffect(() => {
        const profileIdChanged = profileIdRef.current !== profile.id;
        const zodiacSignChanged = zodiacSignRef.current !== chartData?.sun?.sign;

        if (dataLoadedRef.current && !profileIdChanged && !zodiacSignChanged) {
            return;
        }

        profileIdRef.current = profile.id;
        zodiacSignRef.current = chartData?.sun?.sign;
        dataLoadedRef.current = true;

        const loadDashboardData = async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
            const cachedHoroscope = profile.generatedContent?.dailyHoroscope;
            const today = getMoscowTodayKey();
            if (cachedHoroscope && cachedHoroscope.date === today && cachedHoroscope.content) {
                setDailyHoroscope(cachedHoroscope);
            } else {
                setDailyHoroscope(null);
            }
        };

        void loadDashboardData();
    }, [profile.id, chartData?.sun?.sign, profile.generatedContent?.dailyHoroscope]);

    if (!chartData) return <Loading message={getText(profile.language, 'loading')} />;

    return (
        <div className="p-4 space-y-6 screen-pb">
            <CosmicPassport
                profile={profile}
                chartData={chartData}
                photoUrl={photoUrl}
                displayName={displayName}
                onOpenSettings={onOpenSettings}
                weatherData={context?.weatherData}
            />

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
                                return shortText.length > 0 ? `${shortText}.` : `${dailyHoroscope.content.substring(0, 120)}...`;
                            })()}
                        </h3>
                        {(dailyHoroscope.mood || dailyHoroscope.color) && (
                            <div className="flex items-center gap-2 flex-wrap text-xs text-astro-subtext">
                                {dailyHoroscope.mood && (
                                    <span>{getText(profile.language, 'dashboard.mood')}: <span className="text-astro-highlight font-medium">{dailyHoroscope.mood}</span></span>
                                )}
                                {dailyHoroscope.mood && dailyHoroscope.color && <span>•</span>}
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

            <button
                onClick={handleNavigateChart}
                className="w-full bg-astro-card rounded-xl p-5 border border-astro-border hover:border-astro-highlight/30 transition-colors text-left"
            >
                <h3 className="font-serif text-lg text-astro-text mb-0.5">{getText(profile.language, 'dashboard.menu_analysis')}</h3>
                <p className="text-astro-subtext text-xs">
                    {profile.language === 'ru'
                        ? 'Ваша натальная карта, личные интерпретации и вход в сохранённые карты.'
                        : 'Your natal chart, personal interpretations, and access to saved charts.'}
                </p>
            </button>

            {context?.socialProof && (
                <div className="overflow-hidden py-2 bg-astro-bg border-y border-astro-border/50">
                    <motion.div
                        className="whitespace-nowrap text-[10px] uppercase tracking-widest text-astro-subtext"
                        animate={{ x: [300, -500] }}
                        transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                    >
                        {context.socialProof}
                    </motion.div>
                </div>
            )}

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

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={handleNavigateSynastry}
                    className="bg-astro-card p-4 rounded-xl border border-astro-border hover:border-astro-highlight/30 transition-colors text-left"
                >
                    <span className="text-xl text-pink-400/90">♥</span>
                    <h3 className="font-serif text-sm text-astro-text mt-2 mb-0.5">{getText(profile.language, 'dashboard.menu_synastry')}</h3>
                    <p className="text-astro-subtext text-[10px]">{getText(profile.language, 'dashboard.synastry_subtitle')}</p>
                    <p className="text-astro-subtext text-[10px] mt-1">
                        {profile.language === 'ru' ? 'Используй сохранённые карты без повторного ввода.' : 'Reuse saved charts without entering the data again.'}
                    </p>
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

            <SolarSystem language={language} />
        </div>
    );
});

Dashboard.displayName = 'Dashboard';
