import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ForecastDailyReading, UserProfile, NatalChartData, ViewState } from '../types';
import { getText } from '../constants';
import { Loading } from '../components/ui/Loading';
import { formatLumiaDate, getMoscowTodayKey } from '../lib/date-utils';
import { getCachedDailyForecastLayer, mapLegacyHoroscopeToForecastDailyReading } from '../services/astrologyService';
import { LumiaStudioHeader } from '../components/lumia-ui/LumiaStudioHeader';
import { LumiaCard } from '../components/lumia-ui/LumiaCard';
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
    onRequestPremium: () => void;
    onOpenWallet: () => void;
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
    ({ profile, chartData, activeChartId, onNavigate, onOpenSettings, onRequestPremium, onOpenWallet }) => {
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

        const lumiValue = Math.max(0, profile.lumiBalance ?? 0);

        if (!chartData) return <Loading message={getText(profile.language, 'loading')} />;

        const tabs: { id: StudioTab; label: string }[] = [
            { id: 'natal', label: getText(language, 'dashboard.studio_tab_natal') },
            { id: 'compatibility', label: getText(language, 'dashboard.studio_tab_union') },
            { id: 'horoscope', label: getText(language, 'dashboard.studio_tab_horoscope') },
        ];

        return (
            <div className="min-h-full max-w-md mx-auto relative px-6 pt-10 pb-24 text-text-main">
                <LumiaStudioHeader
                    subtitle={getText(language, 'dashboard.lumia_subtitle')}
                    isPremium={!!profile.isPremium}
                    onOpenSettings={onOpenSettings}
                    onPremiumClick={onRequestPremium}
                />

                <button
                    type="button"
                    onClick={onOpenWallet}
                    className="mb-6 w-full flex items-center justify-center gap-2 rounded-full border border-black/5 bg-white/50 py-2.5 text-xs font-medium text-text-muted transition-colors hover:border-black/10 hover:text-text-main"
                >
                    <span className="text-accent-gold">✦</span>
                    <span>
                        {lumiValue} Lumi · {getText(language, 'dashboard.studio_wallet_hint')}
                    </span>
                </button>

                <div className="flex bg-white/50 p-1 rounded-full border border-black/5 mb-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'flex-1 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all',
                                activeTab === tab.id ? 'bg-white text-text-main shadow-sm' : 'text-text-muted'
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

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
                                <LumiaCard className="space-y-5">
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
                                </LumiaCard>

                                <LumiaCard className="space-y-3 bg-text-main text-white border-none">
                                    <p className="text-[10px] uppercase tracking-wider opacity-60">
                                        {getText(language, 'dashboard.questions_label')}
                                    </p>
                                    <p className="text-sm opacity-90 leading-relaxed">{questionsSupport}</p>
                                    <LumiaButton
                                        variant="secondary"
                                        className="w-full bg-white text-text-main hover:bg-white/90"
                                        onClick={handleNavigateOracle}
                                    >
                                        {getText(language, 'dashboard.questions_cta')}
                                    </LumiaButton>
                                </LumiaCard>
                            </>
                        )}

                        {activeTab === 'compatibility' && (
                            <LumiaCard className="space-y-5 text-center">
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
                            </LumiaCard>
                        )}

                        {activeTab === 'horoscope' && (
                            <LumiaCard className="space-y-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted/70">
                                            {getText(language, 'dashboard.hero_label')}
                                        </p>
                                        <h3 className="serif text-2xl mt-2 leading-tight text-text-main">{heroHeadline}</h3>
                                    </div>
                                    {horoscopeDateLabel && (
                                        <span className="shrink-0 rounded-full border border-black/5 bg-white/80 px-2.5 py-1 text-[11px] text-text-muted">
                                            {horoscopeDateLabel}
                                        </span>
                                    )}
                                </div>
                                {heroSupport && (
                                    <p className="text-sm leading-relaxed text-text-main/85 [text-wrap:pretty]">{heroSupport}</p>
                                )}
                                <div className="space-y-3 border-t border-black/5 pt-4">
                                    {todayPoints.map((item) => (
                                        <div key={item.label} className="space-y-1">
                                            <p className="text-[10px] uppercase tracking-wider text-text-muted">{item.label}</p>
                                            <p className="text-sm text-text-main/90 leading-relaxed">{item.value}</p>
                                        </div>
                                    ))}
                                </div>
                                <LumiaButton variant="outline" className="w-full" onClick={handleNavigateHoroscope}>
                                    {getText(language, 'dashboard.hero_cta')}
                                </LumiaButton>
                            </LumiaCard>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }
);

Dashboard.displayName = 'Dashboard';
