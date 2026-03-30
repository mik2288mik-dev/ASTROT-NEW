import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    return `${slice.slice(0, safeCut).trim()}...`;
};

const splitIntoDashboardSentences = (value: string): string[] =>
    value
        .split(/(?<=[.!?])\s+/)
        .map((part) => cleanDashboardText(part))
        .filter(Boolean);

export const Dashboard = memo<DashboardProps>(({ profile, chartData, onNavigate, onOpenSettings }) => {
    const [tgUser, setTgUser] = useState<any>(null);
    const [dailyHoroscope, setDailyHoroscope] = useState<any>(null);

    const language = useMemo(() => profile.language, [profile.language]);
    const displayName = useMemo(() => tgUser?.first_name || profile.name, [tgUser?.first_name, profile.name]);
    const photoUrl = useMemo(() => tgUser?.photo_url, [tgUser?.photo_url]);

    const horoscopeDateLabel = useMemo(
        () => formatLumiaDate(dailyHoroscope?.date || getMoscowTodayKey(), language),
        [dailyHoroscope?.date, language]
    );

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

        return trimDashboardText(candidate.replace(/[.!?]+$/u, '').trim(), 84);
    }, [adviceLines, contentSentences, language, transitFocus]);

    const heroSupport = useMemo(() => {
        const candidate = transitFocus || contentSentences.find((sentence) => sentence !== adviceLines[0]) || '';
        if (!candidate) return null;

        const normalized = trimDashboardText(candidate, 148);
        if (normalized.replace(/[.!?]+$/u, '') === heroHeadline) {
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

    const natalHighlights = useMemo(
        () => [
            getText(profile.language, 'dashboard.natal_point_character'),
            getText(profile.language, 'dashboard.natal_point_love'),
            getText(profile.language, 'dashboard.natal_point_strengths'),
            getText(profile.language, 'dashboard.natal_point_patterns'),
        ],
        [profile.language]
    );

    const questionsSupport = profile.isPremium
        ? getText(profile.language, 'dashboard.questions_support_premium')
        : getText(profile.language, 'dashboard.questions_support_free');

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
                // Dashboard remains stable without forcing generation on load.
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
        <div className="space-y-4 px-4 py-4 screen-pb sm:space-y-5 sm:px-4 sm:py-4">
            <CosmicPassport
                profile={profile}
                chartData={chartData}
                photoUrl={photoUrl}
                displayName={displayName}
                onOpenSettings={onOpenSettings}
            />

            <section className="lumia-glass rounded-[28px] px-5 py-5 sm:px-6 sm:py-6">
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
                        <span className="shrink-0 rounded-full border border-astro-border/45 bg-astro-text/[0.04] px-2.5 py-1 text-[11px] text-astro-subtext">
                            {horoscopeDateLabel}
                        </span>
                    )}
                </div>

                <p className="mt-4 max-w-[38ch] text-sm leading-relaxed text-astro-subtext">
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
                    className="mt-5 inline-flex items-center gap-2 rounded-full border border-astro-highlight/28 bg-astro-highlight/12 px-4 py-2.5 text-sm font-medium text-astro-highlight transition-[box-shadow,background-color] hover:bg-astro-highlight/16 hover:ring-1 hover:ring-astro-highlight/20"
                >
                    {getText(profile.language, 'dashboard.hero_cta')}
                </button>
            </section>

            <section className="lumia-glass rounded-[28px] px-5 py-5 sm:px-6 sm:py-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                    {getText(profile.language, 'dashboard.matters_label')}
                </p>
                <h3 className="mt-2 font-serif text-xl text-astro-text">
                    {getText(profile.language, 'dashboard.matters_title')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                    {getText(profile.language, 'dashboard.matters_body')}
                </p>

                <div className="mt-5">
                    {todayPoints.map((item, index) => (
                        <div
                            key={item.label}
                            className={`grid gap-1.5 py-3 first:pt-0 last:pb-0 md:grid-cols-[88px_minmax(0,1fr)] md:gap-4 ${
                                index > 0 ? 'border-t border-astro-border/40' : ''
                            }`}
                        >
                            <p className="text-[10px] uppercase tracking-[0.18em] text-astro-subtext">{item.label}</p>
                            <p className="text-[15px] leading-[1.65] text-astro-text [text-wrap:pretty]">
                                {item.value}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="lumia-glass rounded-[28px] px-5 py-5 sm:px-6 sm:py-6">
                <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                    {getText(profile.language, 'dashboard.natal_label')}
                </p>
                <h3 className="mt-2 font-serif text-xl text-astro-text">
                    {getText(profile.language, 'dashboard.natal_title')}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                    {getText(profile.language, 'dashboard.natal_body')}
                </p>

                <div className="mt-5 grid gap-2 sm:grid-cols-2 sm:gap-x-5">
                    {natalHighlights.map((point) => (
                        <div key={point} className="flex items-start gap-2.5">
                            <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-astro-highlight/60" />
                            <p className="text-sm leading-relaxed text-astro-text/92">{point}</p>
                        </div>
                    ))}
                </div>

                <p className="mt-5 max-w-[42ch] text-xs leading-relaxed text-astro-subtext">
                    {getText(profile.language, 'dashboard.natal_note')}
                </p>

                <button
                    onClick={handleNavigateChart}
                    type="button"
                    className="mt-5 inline-flex items-center gap-2 rounded-full border border-astro-border/70 bg-astro-card/60 px-4 py-2.5 text-sm font-medium text-astro-text transition-[box-shadow,border-color] hover:border-astro-highlight/32 hover:ring-1 hover:ring-astro-highlight/18"
                >
                    {getText(profile.language, 'dashboard.natal_cta')}
                </button>
            </section>

            <section className="px-1 pt-1">
                <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                    {getText(profile.language, 'dashboard.next_label')}
                </p>
                <div className="mt-2 max-w-[36ch]">
                    <h3 className="font-serif text-xl text-astro-text">
                        {getText(profile.language, 'dashboard.next_title')}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
                        {getText(profile.language, 'dashboard.next_body')}
                    </p>
                </div>

                <div className="mt-4 space-y-3 md:grid md:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] md:gap-3 md:space-y-0">
                    <button
                        onClick={handleNavigateSynastry}
                        type="button"
                        className="lumia-glass group rounded-[26px] px-5 py-4 text-left transition-[transform,box-shadow] hover:ring-1 hover:ring-astro-highlight/22 active:scale-[0.995] sm:px-6 sm:py-5"
                    >
                        <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                            {getText(profile.language, 'dashboard.synastry_label')}
                        </p>
                        <h3 className="mt-2 font-serif text-[22px] leading-tight text-astro-text">
                            {getText(profile.language, 'dashboard.menu_synastry')}
                        </h3>
                        <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-astro-subtext">
                            {getText(profile.language, 'dashboard.synastry_body')}
                        </p>
                        <p className="mt-3 text-xs leading-relaxed text-astro-subtext">
                            {getText(profile.language, 'dashboard.synastry_hint')}
                        </p>
                        <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-astro-text transition-colors group-hover:text-astro-highlight">
                            {getText(profile.language, 'dashboard.synastry_cta')}
                            <span aria-hidden="true">-&gt;</span>
                        </span>
                    </button>

                    <button
                        onClick={handleNavigateOracle}
                        type="button"
                        className="lumia-glass group rounded-[26px] px-5 py-4 text-left transition-[transform,box-shadow] hover:ring-1 hover:ring-astro-highlight/22 active:scale-[0.995] sm:px-6 sm:py-5"
                    >
                        <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                            {getText(profile.language, 'dashboard.questions_label')}
                        </p>
                        <h3 className="mt-2 font-serif text-[22px] leading-tight text-astro-text">
                            {getText(profile.language, 'dashboard.menu_oracle')}
                        </h3>
                        <p className="mt-2 max-w-[32ch] text-sm leading-relaxed text-astro-subtext">
                            {getText(profile.language, 'dashboard.questions_body')}
                        </p>
                        <p className={`mt-3 text-xs leading-relaxed ${profile.isPremium ? 'text-astro-subtext' : 'text-astro-highlight/85'}`}>
                            {questionsSupport}
                        </p>
                        <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-astro-text transition-colors group-hover:text-astro-highlight">
                            {getText(profile.language, 'dashboard.questions_cta')}
                            <span aria-hidden="true">-&gt;</span>
                        </span>
                    </button>
                </div>
            </section>
        </div>
    );
});

Dashboard.displayName = 'Dashboard';
