import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import { UserProfile, NatalChartData, UserContext } from '../types';
import { getText } from '../constants';
import { Loading } from '../components/ui/Loading';
import { getTodayWeather } from '../services/weatherService';
import { motion } from 'framer-motion';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import bgGoldNebula from '../ASTROT_ASSETS/backgrounds/bg_gold_nebula.jpg.png';
import { DailyHeroCard } from '../components/Dashboard/DailyHeroCard';
import { DashboardUserSummary } from '../components/Dashboard/DashboardUserSummary';
import { DashboardFeatureGrid, type FeatureItem } from '../components/Dashboard/DashboardFeatureGrid';
import { DashboardStatusStrip } from '../components/Dashboard/DashboardStatusStrip';
import { DashboardSecondaryCta } from '../components/Dashboard/DashboardSecondaryCta';

type DashboardView = 'chart' | 'horoscope' | 'synastry' | 'oracle';

interface DashboardProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    onNavigate: (view: DashboardView) => void;
    onOpenSettings: () => void;
    onContextUpdate?: (context: UserContext | null) => void;
    onRequestPremium?: () => void;
}

function pickHeroTitleVariant(mood: string | undefined, dateKey: string): 'ready' | 'energy' | 'clarity' {
    const seed = (mood || '').trim() || dateKey;
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = (h * 31 + seed.charCodeAt(i)) | 0;
    }
    const keys: Array<'ready' | 'energy' | 'clarity'> = ['ready', 'energy', 'clarity'];
    return keys[Math.abs(h) % 3];
}

export const Dashboard = memo<DashboardProps>(
    ({ profile, chartData, onNavigate, onOpenSettings, onContextUpdate, onRequestPremium }) => {
        const [context, setContext] = useState<UserContext | null>(null);
        const [tgUser, setTgUser] = useState<any>(null);
        const [dailyHoroscope, setDailyHoroscope] = useState<any>(null);

        const language = useMemo(() => profile.language, [profile.language]);
        const lang = language === 'en' ? 'en' : 'ru';
        const displayName = useMemo(() => tgUser?.first_name || profile.name, [tgUser?.first_name, profile.name]);
        const photoUrl = useMemo(() => tgUser?.photo_url, [tgUser?.photo_url]);

        const todayKey = useMemo(() => getMoscowTodayKey(), []);
        const horoscopeDateLabel = useMemo(() => {
            return formatLumiaDate(dailyHoroscope?.date || todayKey, language);
        }, [dailyHoroscope?.date, language, todayKey]);

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

        const heroTitleVariant = useMemo(
            () => pickHeroTitleVariant(dailyHoroscope?.mood, dailyHoroscope?.date || todayKey),
            [dailyHoroscope?.mood, dailyHoroscope?.date, todayKey]
        );

        const heroTitle = useMemo(() => {
            if (heroTitleVariant === 'energy') return getText(lang, 'dashboard.hero_title_energy');
            if (heroTitleVariant === 'clarity') return getText(lang, 'dashboard.hero_title_clarity');
            return getText(lang, 'dashboard.hero_title_ready');
        }, [heroTitleVariant, lang]);

        const featureItems: FeatureItem[] = useMemo(
            () => [
                {
                    id: 'chart',
                    icon: <span className="text-violet-400/95">◎</span>,
                    title: getText(lang, 'dashboard.menu_analysis'),
                    subtitle: getText(lang, 'dashboard.chart_subtitle'),
                    onClick: handleNavigateChart,
                },
                {
                    id: 'synastry',
                    icon: <span className="text-rose-400/90">♥</span>,
                    title: getText(lang, 'dashboard.menu_synastry'),
                    subtitle: getText(lang, 'dashboard.synastry_subtitle'),
                    onClick: handleNavigateSynastry,
                },
                {
                    id: 'forecast',
                    icon: <span className="text-amber-400/90">☀</span>,
                    title: getText(lang, 'dashboard.menu_forecast'),
                    subtitle: getText(lang, 'dashboard.feature_forecast_sub'),
                    onClick: handleNavigateHoroscope,
                },
                {
                    id: 'premium',
                    icon: <span className="text-astro-highlight">✦</span>,
                    title: getText(lang, 'premium_preview.title'),
                    subtitle: getText(lang, 'dashboard.feature_premium_sub'),
                    onClick: () => onRequestPremium?.(),
                    badge: profile.isPremium ? undefined : getText(lang, 'dashboard.premium_badge'),
                },
            ],
            [lang, handleNavigateChart, handleNavigateSynastry, handleNavigateHoroscope, profile.isPremium, onRequestPremium]
        );

        if (!chartData) return <Loading message={getText(profile.language, 'loading')} />;

        return (
            <div className="space-y-4 px-4 pb-2 pt-1 sm:px-4">
                <DashboardUserSummary
                    profile={profile}
                    chartData={chartData}
                    photoUrl={photoUrl}
                    displayName={displayName}
                    onOpenSettings={onOpenSettings}
                />

                <DailyHeroCard
                    heroImage={bgGoldNebula}
                    label={getText(lang, 'dashboard.hero_label')}
                    dateLine={horoscopeDateLabel}
                    title={heroTitle}
                    subtitle={getText(lang, 'dashboard.hero_subtitle')}
                    ctaLabel={getText(lang, 'dashboard.hero_cta')}
                    onCta={handleNavigateHoroscope}
                />

                <DashboardFeatureGrid items={featureItems} />

                {context?.socialProof && (
                    <div className="overflow-hidden rounded-xl border border-astro-border/30 bg-astro-card/35 py-1.5">
                        <motion.div
                            className="whitespace-nowrap text-[10px] uppercase tracking-widest text-astro-subtext/90"
                            animate={{ x: [280, -480] }}
                            transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                        >
                            {context.socialProof}
                        </motion.div>
                    </div>
                )}

                <DashboardStatusStrip
                    language={lang}
                    city={context?.weatherData?.city}
                    temp={context?.weatherData?.temp}
                    condition={context?.weatherData?.condition}
                    moonPhase={context?.weatherData?.moonPhase?.phase}
                    emptyHint={getText(lang, 'dashboard.weather_strip_set_city')}
                    onOpenSettings={onOpenSettings}
                />

                <DashboardSecondaryCta
                    title={getText(lang, 'dashboard.secondary_oracle_title')}
                    subtitle={getText(lang, 'dashboard.secondary_oracle_sub')}
                    onClick={handleNavigateOracle}
                    badge={!profile.isPremium ? getText(lang, 'dashboard.premium_badge') : undefined}
                />
            </div>
        );
    }
);

Dashboard.displayName = 'Dashboard';
