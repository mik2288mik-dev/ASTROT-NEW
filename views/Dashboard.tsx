import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ForecastDailyReading, UserProfile, NatalChartData, ViewState } from '../types';
import { getText } from '../constants';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import { getCachedDailyForecastLayer, mapLegacyHoroscopeToForecastDailyReading } from '../services/astrologyService';
import { LumiaStudioHeader } from '../components/lumia-ui/LumiaStudioHeader';
import { LumiaButton } from '../components/lumia-ui/LumiaButton';
import { cn } from '../lib/cn';

type DashboardView = Extract<ViewState, 'chart' | 'horoscope' | 'synastry' | 'oracle'>;
type StudioTab = 'natal' | 'compatibility' | 'horoscope';

interface DashboardProps {
    profile: UserProfile;
    chartData: NatalChartData | null;
    activeChartId?: number;
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

export const Dashboard = memo<DashboardProps>(
    ({ profile, chartData, activeChartId, onNavigate, onOpenSettings }) => {
        const [activeTab, setActiveTab] = useState<StudioTab>('natal');
        const [dailyReading, setDailyReading] = useState<ForecastDailyReading | null>(null);

        const language = useMemo(() => profile.language, [profile.language]);
        const langKey = useMemo(() => (profile.language === 'en' ? 'en' : 'ru') as 'ru' | 'en', [profile.language]);

        const horoscopeDateLabel = useMemo(
            () => formatLumiaDate(dailyReading?.date || getMoscowTodayKey(), language),
            [dailyReading?.date, language]
        );

        const adviceLines = useMemo(
            () =>
                (Array.isArray(dailyReading?.advice) ? dailyReading.advice : [])
                    .map((item: string) => cleanDashboardText(item))
                    .filter(Boolean)
                    .slice(0, 3),
            [dailyReading?.advice]
        );
        const readingSentences = useMemo(
            () => splitIntoDashboardSentences(cleanDashboardText(dailyReading?.reading)),
            [dailyReading?.reading]
        );

        const heroHeadline = useMemo(() => {
            const raw =
                cleanDashboardText(dailyReading?.headline) ||
                adviceLines[0] ||
                readingSentences[0] ||
                getText(language, 'dashboard.hero_fallback_title');
            return trimDashboardText(raw.replace(/[.!?]+$/u, '').trim(), 84);
        }, [adviceLines, dailyReading?.headline, language, readingSentences]);

        const heroSupport = useMemo(() => {
            const summary = cleanDashboardText(dailyReading?.summary);
            const candidate =
                summary ||
                readingSentences.find((s) => s !== adviceLines[0]) ||
                cleanDashboardText(dailyReading?.context) ||
                '';
            if (!candidate) return null;
            const normalized = trimDashboardText(candidate, 148);
            if (normalized.replace(/[.!?]+$/u, '') === heroHeadline) return null;
            return normalized;
        }, [adviceLines, dailyReading?.context, dailyReading?.summary, heroHeadline, readingSentences]);

        const todayPoints = useMemo(
            () => [
                {
                    label: getText(language, 'dashboard.chance'),
                    value: trimDashboardText(
                        cleanDashboardText(dailyReading?.chance) ||
                            adviceLines[0] ||
                            readingSentences[0] ||
                            getText(language, 'dashboard.fallback_chance'),
                        116
                    ),
                },
                {
                    label: getText(language, 'dashboard.risk'),
                    value: trimDashboardText(
                        cleanDashboardText(dailyReading?.risk) ||
                            adviceLines[1] ||
                            readingSentences[1] ||
                            getText(language, 'dashboard.fallback_risk'),
                        116
                    ),
                },
                {
                    label: getText(language, 'dashboard.focus'),
                    value: trimDashboardText(
                        cleanDashboardText(dailyReading?.focus) ||
                            adviceLines[2] ||
                            readingSentences[0] ||
                            getText(language, 'dashboard.fallback_focus'),
                        116
                    ),
                },
            ],
            [adviceLines, dailyReading?.chance, dailyReading?.focus, dailyReading?.risk, language, readingSentences]
        );

        const natalHighlights = useMemo(
            () => [
                getText(profile.language, 'dashboard.natal_point_character'),
                getText(profile.language, 'dashboard.natal_point_love'),
                getText(profile.language, 'dashboard.natal_point_strengths'),
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
            let cancelled = false;
            const today = getMoscowTodayKey();

            const fromLegacy = (): ForecastDailyReading | null => {
                const legacy = profile.generatedContent?.dailyHoroscope;
                if (legacy?.date === today && legacy.content) {
                    return mapLegacyHoroscopeToForecastDailyReading(legacy, langKey);
                }
                return null;
            };

            const run = async () => {
                let next = fromLegacy();
                if (!profile.id) {
                    if (!cancelled) setDailyReading(next);
                    return;
                }
                try {
                    const apiReading = await getCachedDailyForecastLayer(String(profile.id), activeChartId);
                    if (
                        !cancelled &&
                        apiReading &&
                        apiReading.date === today &&
                        (apiReading.headline || apiReading.reading)
                    ) {
                        next = apiReading;
                    }
                } catch {
                    /* stable without forced generation */
                }
                if (!cancelled) setDailyReading(next);
            };

            void run();
            return () => {
                cancelled = true;
            };
        }, [activeChartId, langKey, profile.generatedContent?.dailyHoroscope, profile.id]);

        if (!chartData) {
            return (
                <div className="min-h-full max-w-md mx-auto lumia-tg-hub-pad lumia-pad-bottom-tg-scroll px-1 text-text-main">
                    <LumiaStudioHeader
                        className="-mt-2 sm:-mt-2.5"
                        onOpenSettings={onOpenSettings}
                        settingsAriaLabel={getText(language, 'nav.settings')}
                    />
                    <div className="mt-4 space-y-4 text-center">
                        <p className="font-medium text-text-main">{getText(language, 'dashboard.chart_load_failed_title')}</p>
                        <p className="text-sm leading-relaxed text-text-muted">
                            {getText(language, 'dashboard.chart_load_failed_body')}
                        </p>
                        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
                            <LumiaButton type="button" className="w-full sm:w-auto" onClick={() => window.location.reload()}>
                                {getText(language, 'dashboard.chart_load_retry')}
                            </LumiaButton>
                            <LumiaButton
                                type="button"
                                variant="outline"
                                className="w-full sm:w-auto"
                                onClick={() => onNavigate('chart')}
                            >
                                {getText(language, 'dashboard.chart_load_open_chart')}
                            </LumiaButton>
                        </div>
                    </div>
                </div>
            );
        }

        const tabs: { id: StudioTab; label: string }[] = [
            { id: 'natal', label: getText(language, 'dashboard.studio_tab_natal') },
            { id: 'compatibility', label: getText(language, 'dashboard.studio_tab_union') },
            { id: 'horoscope', label: getText(language, 'dashboard.studio_tab_horoscope') },
        ];

        return (
            <div className="min-h-full max-w-md mx-auto relative lumia-tg-hub-pad lumia-pad-bottom-tg-scroll text-text-main">
                <LumiaStudioHeader
                    className="-mt-2 sm:-mt-2.5"
                    onOpenSettings={onOpenSettings}
                    settingsAriaLabel={getText(language, 'nav.settings')}
                />

                <LayoutGroup id="studioTabs">
                    <div className="relative mb-6 w-full rounded-full bg-black/[0.04] p-0.5">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveTab(tab.id)}
                                className="relative z-0 flex min-h-[38px] flex-1 items-center justify-center px-0.5 py-1 sm:min-h-[40px] sm:px-1"
                            >
                                {activeTab === tab.id && (
                                    <motion.div
                                        layoutId="studioTabIndicator"
                                        className="absolute inset-y-0.5 left-0.5 right-0.5 rounded-full bg-white"
                                        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                                    />
                                )}
                                <span
                                    className={cn(
                                        'relative z-10 text-center text-[10px] font-semibold uppercase leading-tight tracking-wide [text-wrap:balance] sm:text-[11px]',
                                        activeTab === tab.id ? 'text-text-main' : 'text-text-muted'
                                    )}
                                >
                                    {tab.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </LayoutGroup>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-6"
                    >
                        {activeTab === 'natal' && (
                            <>
                                <div className="space-y-5">
                                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-text-muted/70 text-center">
                                        {getText(language, 'dashboard.natal_label')}
                                    </p>
                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div>
                                            <p className="text-[10px] uppercase text-text-muted/60">☉</p>
                                            <p className="serif text-lg font-medium text-text-main mt-1">
                                                {chartData.sun?.sign || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-text-muted/60">☽</p>
                                            <p className="serif text-lg font-medium text-text-main mt-1">
                                                {chartData.moon?.sign || '—'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase text-text-muted/60">ASC</p>
                                            <p className="serif text-lg font-medium text-text-main mt-1">
                                                {chartData.rising?.sign || '—'}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-text-muted leading-relaxed text-center px-1">
                                        {getText(language, 'dashboard.natal_body')}
                                    </p>
                                    <ul className="space-y-2 px-1">
                                        {natalHighlights.map((point) => (
                                            <li key={point} className="flex items-start gap-2 text-sm text-text-main/90">
                                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-gold/70" />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                    <LumiaButton className="w-full" onClick={handleNavigateChart}>
                                        {getText(language, 'dashboard.natal_cta')}
                                    </LumiaButton>
                                </div>

                                <div className="space-y-3 border-t border-black/[0.07] pt-8">
                                    <p className="text-[10px] uppercase tracking-wider text-text-muted">
                                        {getText(language, 'dashboard.questions_label')}
                                    </p>
                                    <p className="text-sm leading-relaxed text-text-main/90">{questionsSupport}</p>
                                    <LumiaButton className="w-full" onClick={handleNavigateOracle}>
                                        {getText(language, 'dashboard.questions_cta')}
                                    </LumiaButton>
                                </div>
                            </>
                        )}

                        {activeTab === 'compatibility' && (
                            <div className="space-y-5 text-center">
                                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent-gold">
                                    {getText(language, 'dashboard.synastry_label')}
                                </p>
                                <h3 className="serif text-2xl text-text-main">{getText(language, 'dashboard.menu_synastry')}</h3>
                                <p className="text-sm text-text-muted leading-relaxed text-left">
                                    {getText(language, 'dashboard.synastry_body')}
                                </p>
                                <p className="text-xs text-text-muted/80 italic">{getText(language, 'dashboard.synastry_hint')}</p>
                                <LumiaButton className="w-full" onClick={handleNavigateSynastry}>
                                    {getText(language, 'dashboard.synastry_cta')}
                                </LumiaButton>
                            </div>
                        )}

                        {activeTab === 'horoscope' && (
                            <div className="space-y-6">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted/70">
                                            {getText(language, 'dashboard.hero_label')}
                                        </p>
                                        <h3 className="serif text-2xl mt-2 leading-snug text-text-main">{heroHeadline}</h3>
                                    </div>
                                    {horoscopeDateLabel && (
                                        <span className="shrink-0 text-[11px] text-text-muted tabular-nums">
                                            {horoscopeDateLabel}
                                        </span>
                                    )}
                                </div>
                                {heroSupport && (
                                    <p className="lumia-reading-body text-text-main/85">{heroSupport}</p>
                                )}
                                <div className="space-y-4">
                                    {todayPoints.map((item) => (
                                        <div key={item.label} className="space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider text-text-muted">{item.label}</p>
                                            <p className="lumia-reading-body text-text-main/90">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <LumiaButton variant="outline" className="w-full" onClick={handleNavigateHoroscope}>
                                    {getText(language, 'dashboard.hero_cta')}
                                </LumiaButton>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }
);

Dashboard.displayName = 'Dashboard';
