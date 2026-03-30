import React, { useState, useEffect, useMemo, memo, useCallback, useRef } from 'react';
import { UserProfile, NatalChartData, ViewState } from '../types';
import { getText } from '../constants';
import { Loading } from '../components/ui/Loading';
import { CosmicPassport } from '../components/Dashboard/CosmicPassport';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import { getCachedDailyHoroscope } from '../services/astrologyService';

type DashboardView = Extract<ViewState, 'chart' | 'horoscope' | 'synastry' | 'oracle'>;

interface DashboardProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    onNavigate: (view: DashboardView) => void;
    onOpenSettings: () => void;
}

const cleanDashboardText = (value?: string | null): string =>
    String(value || '')
        .replace(/\*\*/g, '')
        .replace(/\s+/g, ' ')
        .trim();

const trimDashboardText = (value: string, maxLength: number): string => {
    if (value.length <= maxLength) return value;

    const slice = value.slice(0, maxLength).trim();
    const lastSpace = slice.lastIndexOf(' ');
    const safeCut = lastSpace > Math.floor(maxLength * 0.6) ? lastSpace : maxLength;
    return `${slice.slice(0, safeCut).trim()}…`;
};

const splitIntoDashboardSentences = (value: string): string[] =>
    value
        .split(/(?<=[.!?…])\s+/)
        .map((part) => cleanDashboardText(part))
        .filter(Boolean);

export const Dashboard = memo<DashboardProps>(({ profile, chartData, onNavigate, onOpenSettings }) => {
    const [tgUser, setTgUser] = useState<any>(null);
    const [dailyHoroscope, setDailyHoroscope] = useState<any>(null);

    const language = useMemo(() => profile.language, [profile.language]);
    const displayName = useMemo(() => tgUser?.first_name || profile.name, [tgUser?.first_name, profile.name]);
    const photoUrl = useMemo(() => tgUser?.photo_url, [tgUser?.photo_url]);

    const horoscopeDateLabel = useMemo(() => {
        return formatLumiaDate(dailyHoroscope?.date || getMoscowTodayKey(), language);
    }, [dailyHoroscope?.date, language]);

    const cleanedContent = useMemo(() => cleanDashboardText(dailyHoroscope?.content), [dailyHoroscope?.content]);
    const contentSentences = useMemo(() => splitIntoDashboardSentences(cleanedContent), [cleanedContent]);
    const adviceLines = useMemo(
        () =>
            (Array.isArray(dailyHoroscope?.advice) ? dailyHoroscope.advice : [])
                .map((item: string) => cleanDashboardText(item))
                .filter(Boolean)
                .slice(0, 3),
        [dailyHoroscope?.advice]
    );
    const transitFocus = useMemo(() => cleanDashboardText(dailyHoroscope?.transitFocus), [dailyHoroscope?.transitFocus]);
    const moonImpact = useMemo(() => cleanDashboardText(dailyHoroscope?.moonImpact), [dailyHoroscope?.moonImpact]);

    const heroHeadline = useMemo(() => {
        const candidate =
            adviceLines[0] ||
            transitFocus ||
            contentSentences[0] ||
            getText(language, 'dashboard.hero_fallback_title');

        return trimDashboardText(candidate.replace(/[.!?…]+$/u, '').trim(), 84);
    }, [adviceLines, contentSentences, language, transitFocus]);

    const heroSupport = useMemo(() => {
        const candidate = transitFocus || contentSentences.find((sentence) => sentence !== adviceLines[0]) || '';
        if (!candidate) return null;

        const normalized = trimDashboardText(candidate, 148);
        if (normalized.replace(/[.!?…]+$/u, '') === heroHeadline) {
            return null;
        }

        return normalized;
    }, [adviceLines, contentSentences, heroHeadline, transitFocus]);

    const todayPoints = useMemo(
        () => [
            {
                label: getText(language, 'dashboard.chance'),
                value: trimDashboardText(
                    adviceLines[0] || contentSentences[0] || getText(language, 'dashboard.fallback_chance'),
                    116
                ),
            },
            {
                label: getText(language, 'dashboard.risk'),
                value: trimDashboardText(
                    adviceLines[1] || moonImpact || contentSentences[1] || getText(language, 'dashboard.fallback_risk'),
                    116
                ),
            },
            {
                label: getText(language, 'dashboard.focus'),
                value: trimDashboardText(
                    transitFocus || adviceLines[2] || contentSentences[0] || getText(language, 'dashboard.fallback_focus'),
                    116
                ),
            },
        ],
        [adviceLines, contentSentences, language, moonImpact, transitFocus]
    );

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
        const cached = profile.generatedContent?.dailyHoroscope;
        const today = getMoscowTodayKey();
        if (cached && cached.date === today && cached.content) {
            setDailyHoroscope(cached);
        } else {
            setDailyHoroscope(null);
        }
    }, [profile.generatedContent?.dailyHoroscope]);

    useEffect(() => {
        let cancelled = false;
        const cached = profile.generatedContent?.dailyHoroscope;
        const today = getMoscowTodayKey();
        if (!profile.id) return;
        if (cached && cached.date === today && cached.content) return;

        const loadCachedHoroscope = async () => {
            try {
                const dbCached = await getCachedDailyHoroscope(profile.id!, profile.language);
                if (!cancelled && dbCached?.date === today && dbCached.content) {
                    setDailyHoroscope(dbCached);
                }
            } catch {
                // Dashboard remains stable without forcing generation on load
            }
        };

        void loadCachedHoroscope();
        return () => {
            cancelled = true;
        };
    }, [profile.generatedContent?.dailyHoroscope, profile.id, profile.language]);

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
            />

            <section className="lumia-glass rounded-2xl p-4 sm:p-[18px]">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                            {getText(profile.language, 'dashboard.hero_label')}
                        </p>
                        <h2 className="mt-2 max-w-[15ch] font-serif text-[26px] leading-[1.1] tracking-tight text-astro-text sm:max-w-[18ch] sm:text-[30px]">
                            {heroHeadline}
                        </h2>
                    </div>
                    {horoscopeDateLabel && (
                        <span className="shrink-0 rounded-full bg-astro-text/[0.06] px-2.5 py-1 text-[11px] text-astro-subtext">
                            {horoscopeDateLabel}
                        </span>
                    )}
                </div>

                <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-astro-subtext">
                    {getText(profile.language, 'dashboard.hero_body')}
                </p>

                {heroSupport && (
                    <p className="mt-2.5 max-w-[38ch] text-[15px] leading-[1.6] text-astro-text/92 [text-wrap:pretty]">
                        {heroSupport}
                    </p>
                )}

                <button
                    onClick={handleNavigateHoroscope}
                    type="button"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-astro-highlight/28 bg-astro-highlight/12 px-4 py-2.5 text-sm font-medium text-astro-highlight transition-[box-shadow,background-color] hover:bg-astro-highlight/16 hover:ring-1 hover:ring-astro-highlight/20"
                >
                    {getText(profile.language, 'dashboard.hero_cta')}
                </button>
            </section>

            <section className="lumia-glass rounded-2xl p-4 sm:p-[18px]">
                <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                    {getText(profile.language, 'dashboard.matters_label')}
                </p>
                <h3 className="mt-2 font-serif text-xl text-astro-text">
                    {getText(profile.language, 'dashboard.matters_title')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                    {getText(profile.language, 'dashboard.matters_body')}
                </p>

                <div className="mt-4 space-y-2.5">
                    {todayPoints.map((item) => (
                        <div key={item.label} className="rounded-2xl border border-astro-border/55 bg-astro-text/[0.04] px-4 py-3.5">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-astro-subtext">{item.label}</p>
                            <p className="mt-1.5 text-[15px] leading-[1.6] text-astro-text [text-wrap:pretty]">
                                {item.value}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="lumia-glass rounded-2xl p-4 sm:p-[18px]">
                <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                    {getText(profile.language, 'dashboard.natal_label')}
                </p>
                <h3 className="mt-2 font-serif text-xl text-astro-text">
                    {getText(profile.language, 'dashboard.natal_title')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                    {getText(profile.language, 'dashboard.natal_body')}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                    {[
                        getText(profile.language, 'dashboard.natal_point_character'),
                        getText(profile.language, 'dashboard.natal_point_love'),
                        getText(profile.language, 'dashboard.natal_point_strengths'),
                        getText(profile.language, 'dashboard.natal_point_patterns'),
                    ].map((point) => (
                        <span
                            key={point}
                            className="rounded-full border border-astro-border/55 bg-astro-text/[0.04] px-3 py-1.5 text-[11px] text-astro-text/92"
                        >
                            {point}
                        </span>
                    ))}
                </div>

                <p className="mt-4 text-xs leading-relaxed text-astro-subtext">
                    {getText(profile.language, 'dashboard.natal_note')}
                </p>

                <button
                    onClick={handleNavigateChart}
                    type="button"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-astro-border/70 bg-astro-card/60 px-4 py-2.5 text-sm font-medium text-astro-text transition-[box-shadow,border-color] hover:border-astro-highlight/32 hover:ring-1 hover:ring-astro-highlight/18"
                >
                    {getText(profile.language, 'dashboard.natal_cta')}
                </button>
            </section>

            <div className="grid grid-cols-2 gap-2.5">
                <button
                    onClick={handleNavigateSynastry}
                    type="button"
                    className="lumia-glass rounded-2xl p-3.5 text-left transition-[transform,box-shadow] hover:ring-1 hover:ring-astro-highlight/22 active:scale-[0.99] sm:p-4"
                >
                    <span className="text-xl text-pink-400/90">♥</span>
                    <h3 className="mb-0.5 mt-2 font-serif text-sm text-astro-text">
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
                    <h3 className="mb-0.5 mt-2 font-serif text-sm text-astro-text">
                        {getText(profile.language, 'dashboard.menu_oracle')}
                    </h3>
                    <p className="text-[10px] text-astro-subtext">{getText(profile.language, 'dashboard.oracle_subtitle')}</p>
                </button>
            </div>
        </div>
    );
});

Dashboard.displayName = 'Dashboard';
