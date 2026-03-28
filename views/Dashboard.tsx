import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import { UserProfile, NatalChartData, UserContext, ViewState } from '../types';
import { getText } from '../constants';
import { SolarSystem } from '../components/SolarSystem';
import { Loading } from '../components/ui/Loading';
import { getTodayWeather } from '../services/weatherService';
import { motion } from 'framer-motion';
import { CosmicPassport } from '../components/Dashboard/CosmicPassport';
import { WeatherWidget } from '../components/Dashboard/WeatherWidget';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';

type DashboardView = Extract<ViewState, 'chart' | 'horoscope' | 'synastry' | 'oracle'>;

interface DashboardProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    onNavigate: (view: DashboardView) => void;
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
                            moonPhase: data.moonPhase
                                ? {
                                      phase: data.moonPhase.phase,
                                      illumination: parseInt(data.moonPhase.illumination, 10) || 0,
                                  }
                                : undefined,
                        },
                    };
                    setContext(nextContext);
                    onContextUpdate?.(nextContext);
                }
            } catch {
                setContext(null);
            }
        };

        void loadWeather();
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

        const cachedHoroscope = profile.generatedContent?.dailyHoroscope;
        const today = getMoscowTodayKey();
        if (cachedHoroscope && cachedHoroscope.date === today && cachedHoroscope.content) {
            setDailyHoroscope(cachedHoroscope);
        } else {
            setDailyHoroscope(null);
        }
    }, [profile.id, chartData?.sun?.sign, profile.generatedContent?.dailyHoroscope]);

    if (!chartData) return <Loading message={getText(profile.language, 'loading')} />;

    return (
        <div className="space-y-3.5 px-4 py-4 screen-pb sm:px-4 sm:py-4">
            <CosmicPassport
                profile={profile}
                chartData={chartData}
                photoUrl={photoUrl}
                displayName={displayName}
                onOpenSettings={onOpenSettings}
                weatherData={context?.weatherData}
            />

            <div className="space-y-2.5">
                <button
                    onClick={handleNavigateHoroscope}
                    type="button"
                    className="lumia-glass w-full rounded-2xl p-4 text-left transition-[transform,box-shadow] hover:ring-1 hover:ring-astro-highlight/22 active:scale-[0.99] sm:p-[18px]"
                >
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                                {getText(profile.language, 'dashboard.horoscope_today')}
                            </p>
                            <p className="text-xs leading-relaxed text-astro-subtext">
                                {getText(profile.language, 'dashboard.horoscope_footer')}
                            </p>
                        </div>
                        {horoscopeDateLabel && (
                            <span className="shrink-0 rounded-full bg-astro-text/[0.06] px-2.5 py-1 text-[11px] text-astro-subtext">
                                {horoscopeDateLabel}
                            </span>
                        )}
                    </div>

                    {dailyHoroscope?.content ? (
                        <>
                            <p className="lumia-prose mt-4 line-clamp-4 text-[15px] leading-[1.65] text-astro-text [text-wrap:pretty] sm:text-base sm:leading-[1.68]">
                                {dailyHoroscope.content.replace(/\*\*/g, '').trim()}
                            </p>
                            {(dailyHoroscope.mood || dailyHoroscope.color) && (
                                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-astro-subtext">
                                    {dailyHoroscope.mood && (
                                        <span className="rounded-full bg-astro-text/[0.06] px-2.5 py-1">
                                            {getText(profile.language, 'dashboard.mood')}: <span className="font-medium text-astro-highlight">{dailyHoroscope.mood}</span>
                                        </span>
                                    )}
                                    {dailyHoroscope.color && (
                                        <span className="rounded-full bg-astro-text/[0.06] px-2.5 py-1">
                                            {getText(profile.language, 'dashboard.color')}: <span className="font-medium text-astro-highlight">{dailyHoroscope.color}</span>
                                        </span>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <h3 className="mt-4 font-serif text-lg text-astro-text">
                            {getText(profile.language, 'dashboard.special_day')}
                        </h3>
                    )}

                    <p className="mt-4 text-sm font-medium text-astro-highlight">
                        {getText(profile.language, 'dashboard.detailed_forecast')}
                    </p>
                </button>

                <button
                    onClick={handleNavigateChart}
                    type="button"
                    className="lumia-glass w-full rounded-2xl p-4 text-left transition-[transform,box-shadow] hover:ring-1 hover:ring-astro-highlight/22 active:scale-[0.99] sm:p-[18px]"
                >
                    <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                        {getText(profile.language, 'dashboard.menu_analysis')}
                    </p>
                    <h3 className="mt-2 font-serif text-lg text-astro-text">
                        {getText(profile.language, 'chart.summary')}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                        {getText(profile.language, 'dashboard.chart_subtitle')}
                    </p>
                </button>
            </div>

            {context?.socialProof && (
                <div className="overflow-hidden border-y border-astro-border/50 bg-astro-bg py-2">
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
                    <WeatherWidget profile={profile} chartData={chartData} weatherData={context.weatherData} />
                ) : (
                    <div className="lumia-glass rounded-2xl p-4 opacity-80 sm:p-[18px]">
                        <h3 className="mb-1 text-[10px] uppercase tracking-widest text-astro-subtext">
                            {getText(profile.language, 'dashboard.context_weather')}
                        </h3>
                        <p className="text-sm text-astro-text">{getText(profile.language, 'dashboard.loading_weather')}</p>
                    </div>
                )
            ) : (
                <button
                    onClick={onOpenSettings}
                    type="button"
                    className="lumia-glass w-full rounded-2xl p-4 text-left transition-[transform,box-shadow] hover:ring-1 hover:ring-astro-highlight/22 active:scale-[0.99] sm:p-[18px]"
                >
                    <h3 className="mb-1 text-[10px] uppercase tracking-widest text-astro-subtext">
                        {getText(profile.language, 'dashboard.context_weather')}
                    </h3>
                    <p className="text-sm text-astro-text">{getText(profile.language, 'dashboard.set_city_hint')}</p>
                    <p className="mt-2 text-xs text-astro-subtext">{getText(profile.language, 'dashboard.tap_settings')}</p>
                </button>
            )}

            <div className="grid grid-cols-2 gap-2.5">
                <button
                    onClick={handleNavigateSynastry}
                    type="button"
                    className="lumia-glass rounded-2xl p-3.5 text-left transition-[transform,box-shadow] hover:ring-1 hover:ring-astro-highlight/22 active:scale-[0.99] sm:p-4"
                >
                    <span className="text-xl text-pink-400/90">♥</span>
                    <h3 className="mt-2 mb-0.5 font-serif text-sm text-astro-text">
                        {getText(profile.language, 'dashboard.menu_synastry')}
                    </h3>
                    <p className="text-[10px] text-astro-subtext">{getText(profile.language, 'dashboard.synastry_subtitle')}</p>
                    <p className="mt-1 text-[10px] text-astro-subtext">
                        {getText(profile.language, 'dashboard.synastry_hint')}
                    </p>
                    {!profile.isPremium && (
                        <span className="mt-1 block text-[9px] uppercase tracking-wider text-astro-highlight">
                            {getText(profile.language, 'dashboard.synastry_free')}
                        </span>
                    )}
                </button>

                <button
                    onClick={handleNavigateOracle}
                    type="button"
                    className="lumia-glass relative rounded-2xl p-3.5 text-left transition-[transform,box-shadow] hover:ring-1 hover:ring-astro-highlight/22 active:scale-[0.99] sm:p-4"
                >
                    {!profile.isPremium && (
                        <span className="absolute right-2 top-2 rounded-full bg-astro-highlight/20 px-2 py-0.5 text-[9px] font-bold uppercase text-astro-highlight">
                            {getText(profile.language, 'dashboard.premium_badge')}
                        </span>
                    )}
                    <span className="text-xl text-blue-400/90">✧</span>
                    <h3 className="mt-2 mb-0.5 font-serif text-sm text-astro-text">
                        {getText(profile.language, 'dashboard.menu_oracle')}
                    </h3>
                    <p className="text-[10px] text-astro-subtext">{getText(profile.language, 'dashboard.oracle_subtitle')}</p>
                </button>
            </div>

            <SolarSystem language={language} />
        </div>
    );
});

Dashboard.displayName = 'Dashboard';
