import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, SynastryResult, NatalChartData } from '../types';
import { getOrGenerateSynastry } from '../services/contentGenerationService';
import { getCharts, type ChartListItem } from '../services/storageService';
import { getText, getZodiacSign } from '../constants';
import { Loading } from '../components/ui/Loading';
import { FormattedAiText } from '../components/ui/FormattedAiText';
import { getApproximateSunSignByDate } from '../lib/zodiac-utils';
import { toDateInputValue, formatLumiaDate } from '../lib/date-utils';
import { SYNASTRY_EXTENDED_STARS_COST } from '../lib/synastryExtended';
import { ScreenShell } from '../components/layout/ScreenShell';

type SynastryPrefill = {
    source: 'saved-chart' | 'manual';
    partnerChartId?: number;
    partnerName?: string;
    partnerDate?: string;
    partnerTime?: string;
    partnerPlace?: string;
} | null;

interface SynastryProps {
    profile: UserProfile;
    chartData?: NatalChartData | null;
    requestPremium: () => void;
    initialPrefill?: SynastryPrefill;
    onOpenCharts?: () => void;
    onUpdateProfile?: (profile: UserProfile) => void;
}

const getSynastryEditorialText = (language: 'ru' | 'en') => ({
    introTitle: language === 'ru' ? 'Как вы ощущаетесь друг другу' : 'How you feel to each other',
    generalTheme: language === 'ru' ? 'Общая тема связи' : 'The shape of your bond',
    attraction: language === 'ru' ? 'Притяжение' : 'Attraction',
    difficulties: language === 'ru' ? 'Сложные места' : 'Challenges',
    potential: language === 'ru' ? 'Потенциал связи' : 'Potential',
    recommendations: language === 'ru' ? 'Что поможет вам точнее' : 'What will help most',
});

const SynastryEditorialSection: React.FC<{ title: string; text: string }> = ({ title, text }) => (
    <section className="border-t border-astro-border/12 pt-7 first:border-t-0 first:pt-0 sm:pt-8">
        <h3 className="lumia-reading-section-title text-astro-text">{title}</h3>
        <div className="mt-4 sm:mt-5">
            <FormattedAiText text={text} variant="article" className="lumia-prose" />
        </div>
    </section>
);

export const Synastry: React.FC<SynastryProps> = ({
    profile,
    chartData,
    requestPremium,
    initialPrefill,
    onOpenCharts,
    onUpdateProfile,
}) => {
    const [partnerInputMode, setPartnerInputMode] = useState<'manual' | 'charts'>('manual');
    const [savedCharts, setSavedCharts] = useState<ChartListItem[]>([]);
    const [selectedPartnerChartId, setSelectedPartnerChartId] = useState<number | null>(null);
    const [partnerName, setPartnerName] = useState('');
    const [partnerDate, setPartnerDate] = useState('');
    const [partnerTime, setPartnerTime] = useState('');
    const [partnerPlace, setPartnerPlace] = useState('');
    const [relationshipType, setRelationshipType] = useState('романтика');
    const [result, setResult] = useState<SynastryResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [allowStarsConsent, setAllowStarsConsent] = useState(false);

    const extendedCost = SYNASTRY_EXTENDED_STARS_COST;
    const readingText = getSynastryEditorialText(profile.language === 'en' ? 'en' : 'ru');
    const t = (key: string, replacements?: Record<string, string>) => {
        let s = getText(profile.language, key);
        if (replacements) {
            for (const [k, v] of Object.entries(replacements)) {
                s = s.replace(`{${k}}`, v);
            }
        }
        return s;
    };

    const loadCharts = async () => {
        if (!profile.id) return;
        try {
            const res = await getCharts(profile.id);
            setSavedCharts(res.charts ?? []);
        } catch {
            setSavedCharts([]);
        }
    };

    useEffect(() => {
        void loadCharts();
    }, [profile.id]);

    const partnerCharts = useMemo(() => savedCharts.filter((c) => !c.is_primary), [savedCharts]);
    const selectedPartnerChart = useMemo(
        () => partnerCharts.find((chart) => chart.id === selectedPartnerChartId) || null,
        [partnerCharts, selectedPartnerChartId]
    );
    const slotsUsed = savedCharts.length;
    const slotsTotal = profile.chartSlots ?? 1;
    const slotsFull = slotsUsed >= slotsTotal;
    const showStarsFullAction = !profile.isPremium;

    useEffect(() => {
        if (initialPrefill?.source === 'saved-chart' && initialPrefill.partnerChartId) {
            setPartnerInputMode('charts');
            setSelectedPartnerChartId(initialPrefill.partnerChartId);
            setPartnerName(initialPrefill.partnerName || '');
            setPartnerDate(toDateInputValue(initialPrefill.partnerDate || ''));
            setPartnerTime(initialPrefill.partnerTime || '12:00');
            setPartnerPlace(initialPrefill.partnerPlace || '');
            return;
        }

        if (initialPrefill?.source === 'manual') {
            setPartnerInputMode('manual');
            setSelectedPartnerChartId(null);
            setPartnerName(initialPrefill.partnerName || '');
            setPartnerDate(toDateInputValue(initialPrefill.partnerDate || ''));
            setPartnerTime(initialPrefill.partnerTime || '');
            setPartnerPlace(initialPrefill.partnerPlace || '');
            return;
        }

        if (partnerCharts.length > 0) {
            setPartnerInputMode('charts');
            setSelectedPartnerChartId((current) => current ?? partnerCharts[0].id);
        } else {
            setPartnerInputMode('manual');
        }
    }, [initialPrefill, partnerCharts]);

    useEffect(() => {
        if (!selectedPartnerChart) return;
        setPartnerName(selectedPartnerChart.name);
        setPartnerDate(toDateInputValue(selectedPartnerChart.birth_date));
        setPartnerTime(selectedPartnerChart.birth_time || '12:00');
        setPartnerPlace(selectedPartnerChart.birth_place || '');
    }, [selectedPartnerChart]);

    const partnerZodiacSign = useMemo(() => {
        if (!partnerDate) return null;
        try {
            const [year, month, day] = partnerDate.split('-').map(Number);
            if (!year || !month || !day) return null;
            const sign = getApproximateSunSignByDate(year, month, day);
            return { sign: getZodiacSign(profile.language, sign), signEn: sign };
        } catch {
            return null;
        }
    }, [partnerDate, profile.language]);

    const handleSelectChartAsPartner = (chart: ChartListItem) => {
        setError(null);
        setResult(null);
        setSelectedPartnerChartId(chart.id);
        setPartnerInputMode('charts');
    };

    const partnerChartIdForRequest =
        partnerInputMode === 'charts' && selectedPartnerChartId != null ? selectedPartnerChartId : undefined;

    const runSynastry = async (mode: 'brief' | 'extended' | 'full') => {
        if (!partnerName || !partnerDate) return;
        const effectiveMode = mode === 'extended' && profile.isPremium ? 'full' : mode;
        if (effectiveMode === 'extended' && !allowStarsConsent) {
            setError(t('synastry.error_stars_consent'));
            return;
        }
        if (effectiveMode === 'full' && !profile.isPremium) {
            requestPremium();
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { result: data } = await getOrGenerateSynastry(
                profile,
                partnerName,
                partnerDate,
                partnerTime || undefined,
                partnerPlace || undefined,
                relationshipType,
                effectiveMode,
                partnerChartIdForRequest,
                effectiveMode === 'extended' ? {} : undefined
            );
            setResult(data);
        } catch (e: any) {
            console.error('[Synastry] Error calculating synastry:', e);
            const code = e?.code as string | undefined;
            if (code === 'STARS_PAYMENT_REQUIRED') {
                setError(t('synastry.error_lumi_required').replace(/Lumi/gi, 'Stars'));
            } else if (code === 'PREMIUM_REQUIRED') {
                setError(e?.message || t('synastry.full_btn'));
            } else {
                setError(e?.message || 'Failed to calculate synastry');
            }
        } finally {
            setLoading(false);
        }
    };

    const sourceBadge = partnerInputMode === 'charts'
        ? getText(profile.language, 'synastry.selected_saved')
        : getText(profile.language, 'synastry.selected_manual');
    const canSubmit = Boolean(partnerName && partnerDate);
    const fieldLabelClass = 'mb-2 block text-[10px] uppercase tracking-[0.18em] text-astro-subtext';
    const fieldInputClass = 'w-full border-b border-black/10 bg-transparent py-3 text-sm text-astro-text outline-none transition-colors focus:border-astro-highlight';

    if (loading) {
        return <Loading message={getText(profile.language, 'synastry.loading')} />;
    }

    return (
        <div className="min-h-full bg-white pb-8 font-sans">
        <ScreenShell className="mx-auto max-w-reading-wide pt-2">
            <section className="px-1 pb-2 pt-2">
                <p className="text-[10px] uppercase tracking-[0.24em] text-astro-subtext">
                    {t('synastry.hero_kicker')}
                </p>
                <h1 className="mt-3 max-w-[21rem] text-[clamp(2.35rem,11vw,3.25rem)] leading-[0.98] tracking-[-0.02em] text-astro-text">
                    {t('synastry.headline')}
                </h1>
                <p className="mt-4 max-w-[21rem] text-[15px] leading-relaxed text-astro-subtext">
                    {t('synastry.desc')}
                </p>
            </section>

            {!result ? (
                <div className="space-y-5">
                    <div className="space-y-4 rounded-[32px] bg-white/38 p-5 shadow-[0_24px_70px_rgba(55,44,30,0.07)] ring-1 ring-white/62 backdrop-blur-2xl">
                        <div className="space-y-3 rounded-[24px] bg-white/34 p-4 ring-1 ring-black/[0.04] backdrop-blur-xl">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-astro-subtext">
                                        {getText(profile.language, 'synastry.primary_title')}
                                    </p>
                                    <h3 className="font-serif text-base text-astro-text mt-1">{profile.name}</h3>
                                </div>
                                <span className="text-[10px] uppercase tracking-wider text-astro-highlight bg-astro-highlight/15 px-2 py-1 rounded-full">
                                    {chartData?.sun?.sign ? getZodiacSign(profile.language, chartData.sun.sign) : '—'}
                                </span>
                            </div>
                            <p className="text-xs text-astro-subtext">
                                {getText(profile.language, 'synastry.primary_hint')}
                            </p>
                        </div>

                        <div className="rounded-[24px] bg-white/30 p-4 ring-1 ring-black/[0.04] backdrop-blur-xl">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-astro-subtext">
                                {getText(profile.language, 'synastry.mode_label')}
                            </p>
                            <div className="mt-3 flex gap-2 rounded-[20px] bg-white/38 p-1 ring-1 ring-black/[0.04]">
                            <button
                                type="button"
                                onClick={() => {
                                    setPartnerInputMode('charts');
                                    if (!selectedPartnerChartId && partnerCharts[0]) {
                                        setSelectedPartnerChartId(partnerCharts[0].id);
                                    }
                                }}
                                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                                    partnerInputMode === 'charts'
                                        ? 'border border-astro-highlight/40 bg-astro-highlight/12 text-astro-highlight'
                                        : 'text-astro-subtext hover:text-astro-text'
                                }`}
                            >
                                {getText(profile.language, 'synastry.partner_from_charts')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setPartnerInputMode('manual');
                                    setSelectedPartnerChartId(null);
                                }}
                                className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                                    partnerInputMode === 'manual'
                                        ? 'border border-astro-highlight/40 bg-astro-highlight/12 text-astro-highlight'
                                        : 'text-astro-subtext hover:text-astro-text'
                                }`}
                            >
                                {getText(profile.language, 'synastry.partner_from_manual')}
                            </button>
                            </div>
                        </div>

                        <div className="space-y-2 rounded-[24px] bg-white/28 p-4 ring-1 ring-black/[0.04] backdrop-blur-xl">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.18em] text-astro-subtext">
                                        {getText(profile.language, 'synastry.details_label')}
                                    </p>
                                    <p className="text-sm font-medium text-astro-text mt-1">{sourceBadge}</p>
                                </div>
                                {partnerInputMode === 'charts' && selectedPartnerChart && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedPartnerChartId(null)}
                                        className="text-[10px] uppercase tracking-wider text-astro-highlight hover:underline"
                                    >
                                        {getText(profile.language, 'synastry.change_partner')}
                                    </button>
                                )}
                            </div>
                            <p className="text-sm leading-relaxed text-astro-subtext">
                                {getText(profile.language, 'synastry.details_body')}
                            </p>
                            <p className="text-xs text-astro-subtext">
                                {partnerInputMode === 'charts'
                                    ? getText(profile.language, 'synastry.saved_first_hint')
                                    : getText(profile.language, 'synastry.manual_hint')}
                            </p>
                        </div>

                        {partnerInputMode === 'charts' ? (
                            partnerCharts.length === 0 ? (
                                <div className="space-y-3 rounded-[24px] bg-white/30 p-5 text-center ring-1 ring-black/[0.04] backdrop-blur-xl">
                                    <p className="text-base font-medium text-astro-text">
                                        {getText(profile.language, 'synastry.no_saved_title')}
                                    </p>
                                    <p className="text-sm text-astro-subtext">
                                        {getText(profile.language, 'synastry.no_saved_body')}
                                    </p>
                                    <div className="flex flex-col gap-2">
                                        {onOpenCharts && (
                                            <button
                                                type="button"
                                                onClick={onOpenCharts}
                                                className="w-full rounded-xl bg-astro-highlight px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white"
                                            >
                                                {getText(profile.language, 'synastry.open_charts')}
                                            </button>
                                        )}
                                        {slotsFull && (
                                            <div className="space-y-2">
                                              <p className="text-xs text-astro-subtext">
                                                  {getText(profile.language, 'charts.limit_reached')}
                                              </p>
                                              {!profile.isPremium && (
                                                  <button
                                                      type="button"
                                                      onClick={() => requestPremium()}
                                                      className="w-full rounded-xl bg-astro-highlight px-4 py-3 text-xs font-semibold uppercase tracking-widest text-white"
                                                  >
                                                      {getText(profile.language, 'charts.premium_slots_cta')}
                                                  </button>
                                              )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedPartnerChart ? (
                                        <div className="rounded-[24px] bg-astro-highlight/10 p-4 ring-1 ring-astro-highlight/20">
                                            <p className="text-[10px] uppercase tracking-[0.18em] text-astro-highlight">
                                                {getText(profile.language, 'synastry.selected_partner_title')}
                                            </p>
                                            <div className="mt-3 flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="font-serif text-base text-astro-text">{selectedPartnerChart.name}</p>
                                                    <p className="text-xs text-astro-subtext mt-1">
                                                        {formatLumiaDate(selectedPartnerChart.birth_date, profile.language) || selectedPartnerChart.birth_date}
                                                        {' • '}
                                                        {selectedPartnerChart.birth_place}
                                                    </p>
                                                    {selectedPartnerChart.chart_data?.sun?.sign && (
                                                        <p className="text-[10px] text-astro-highlight mt-2">
                                                            ☉ {getZodiacSign(profile.language, selectedPartnerChart.chart_data.sun.sign)}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-[10px] uppercase tracking-wider text-astro-highlight">
                                                    {getText(profile.language, 'synastry.selected_saved')}
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        partnerCharts.map((chart) => (
                                            <button
                                                key={chart.id}
                                                type="button"
                                                onClick={() => handleSelectChartAsPartner(chart)}
                                                className="w-full rounded-[22px] bg-white/30 p-4 text-left ring-1 ring-black/[0.04] transition-colors hover:ring-astro-highlight/30"
                                            >
                                                <p className="font-medium text-astro-text">{chart.name}</p>
                                                <p className="text-xs text-astro-subtext mt-1">
                                                    {formatLumiaDate(chart.birth_date, profile.language) || chart.birth_date} • {chart.birth_place}
                                                </p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )
                        ) : (
                            <div className="space-y-4 rounded-[24px] bg-white/30 p-4 ring-1 ring-black/[0.04] backdrop-blur-xl">
                                <div>
                                    <label className={fieldLabelClass}>
                                        {getText(profile.language, 'synastry.partner_name')}
                                    </label>
                                    <input
                                        type="text"
                                        value={partnerName}
                                        onChange={(e) => setPartnerName(e.target.value)}
                                        placeholder={getText(profile.language, 'synastry.partner_name_placeholder')}
                                        className={`${fieldInputClass} font-serif`}
                                    />
                                </div>

                                <div>
                                    <label className={fieldLabelClass}>
                                        {getText(profile.language, 'synastry.birth_date_label')}
                                    </label>
                                    <input
                                        type="date"
                                        value={partnerDate}
                                        onChange={(e) => setPartnerDate(e.target.value)}
                                        className={fieldInputClass}
                                    />
                                    {partnerZodiacSign && (
                                        <p className="mt-2 text-sm text-astro-highlight">
                                            {getText(profile.language, 'synastry.partner_sign_label')}: {partnerZodiacSign.sign}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className={fieldLabelClass}>
                                            {getText(profile.language, 'synastry.birth_time_label')}
                                        </label>
                                        <input
                                            type="time"
                                            value={partnerTime}
                                            onChange={(e) => setPartnerTime(e.target.value)}
                                            className={fieldInputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={fieldLabelClass}>
                                            {getText(profile.language, 'synastry.relationship_type_label')}
                                        </label>
                                        <select
                                            value={relationshipType}
                                            onChange={(e) => setRelationshipType(e.target.value)}
                                            className={fieldInputClass}
                                        >
                                            <option value="романтика">{getText(profile.language, 'synastry.relationship_romantic')}</option>
                                            <option value="дружба">{getText(profile.language, 'synastry.relationship_friendship')}</option>
                                            <option value="семья">{getText(profile.language, 'synastry.relationship_family')}</option>
                                            <option value="работа">{getText(profile.language, 'synastry.relationship_work')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className={fieldLabelClass}>
                                        {getText(profile.language, 'synastry.birth_place_label')}
                                    </label>
                                    <input
                                        type="text"
                                        value={partnerPlace}
                                        onChange={(e) => setPartnerPlace(e.target.value)}
                                        placeholder={getText(profile.language, 'synastry.birth_place_placeholder')}
                                        className={`${fieldInputClass} font-serif`}
                                    />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="rounded-[20px] bg-red-500/10 p-3 text-sm text-red-700 ring-1 ring-red-500/20">
                                {error}
                            </div>
                        )}

                        <div className="space-y-3 rounded-[24px] bg-white/32 p-4 ring-1 ring-black/[0.04] backdrop-blur-xl">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-astro-subtext">
                                {getText(profile.language, 'synastry.cta_label')}
                            </p>
                            <p className="text-xs text-astro-subtext leading-relaxed">
                                {t('synastry.extended_hint')}
                            </p>
                            <div className={`mt-1 grid grid-cols-1 gap-3 ${showStarsFullAction ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                                <button
                                    type="button"
                                    onClick={() => void runSynastry('brief')}
                                    disabled={!canSubmit}
                                    className="w-full rounded-xl bg-astro-highlight px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {t('synastry.brief_btn')}
                                </button>
                                {showStarsFullAction && (
                                    <button
                                        type="button"
                                        onClick={() => void runSynastry('extended')}
                                        disabled={!canSubmit}
                                        className="w-full rounded-xl border border-astro-highlight/50 bg-astro-highlight/10 px-4 py-3 text-sm font-semibold text-astro-highlight disabled:opacity-50"
                                    >
                                        {t('synastry.extended_btn', { cost: String(extendedCost) })}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => void runSynastry('full')}
                                    disabled={!canSubmit}
                                    className="w-full rounded-xl border border-astro-border px-4 py-3 text-sm font-semibold text-astro-text disabled:opacity-50"
                                >
                                    {t('synastry.full_btn')}
                                </button>
                            </div>
                            {showStarsFullAction && (
                                <label className="flex cursor-pointer items-start gap-3 rounded-[20px] bg-white/34 px-3 py-3 text-sm text-astro-subtext ring-1 ring-black/[0.04]">
                                    <input
                                        type="checkbox"
                                        className="mt-1 h-4 w-4 shrink-0 rounded border-astro-border text-astro-highlight focus:ring-astro-highlight"
                                        checked={allowStarsConsent}
                                        onChange={(e) => setAllowStarsConsent(e.target.checked)}
                                    />
                                    <span>{t('synastry.stars_consent', { cost: String(extendedCost) })}</span>
                                </label>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="rounded-[32px] bg-white/40 p-5 shadow-[0_24px_70px_rgba(55,44,30,0.07)] ring-1 ring-white/62 backdrop-blur-2xl sm:p-6">
                        <div className="space-y-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                                        {getText(profile.language, 'synastry.result_title')}
                                    </p>
                                </div>
                                <span className="text-[10px] uppercase tracking-wider text-astro-highlight bg-astro-highlight/15 px-2 py-1 rounded-full">
                                    {partnerInputMode === 'charts'
                                        ? getText(profile.language, 'synastry.result_saved_badge')
                                        : getText(profile.language, 'synastry.result_manual_badge')}
                                </span>
                            </div>

                            <div className="text-center">
                                <h2 className="lumia-reading-display text-astro-text">
                                    {profile.name} / {partnerName}
                                </h2>
                            </div>

                            <div className="flex flex-wrap items-center justify-center gap-3">
                                {result.compatibilityScore !== undefined && (
                                    <div className="inline-flex rounded-full border border-astro-highlight/30 bg-astro-highlight/10 px-4 py-2 text-2xl font-semibold text-astro-text">
                                        {result.compatibilityScore}/100
                                    </div>
                                )}
                                <span className="inline-flex rounded-full border border-astro-border/70 bg-astro-bg/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-astro-subtext">
                                    {t('synastry.relationship_type_label')}: {relationshipType}
                                </span>
                            </div>

                            <p className="lumia-reading-intro lumia-muted mx-auto max-w-reading-wide">
                                {result.summary}
                            </p>

                            {(result.briefOverview || result.extendedOverview || result.fullAnalysis) && (
                                <div className="mx-auto w-full max-w-reading-wide">
                                    <div className="space-y-8 rounded-[28px] bg-white/24 p-5 ring-1 ring-black/[0.04] backdrop-blur-xl sm:space-y-10 sm:p-6">
                                        {result.briefOverview && (
                                            <>
                                                <SynastryEditorialSection
                                                    title={readingText.introTitle}
                                                    text={result.briefOverview.introduction}
                                                />
                                                <SynastryEditorialSection
                                                    title={getText(profile.language, 'synastry.emotional')}
                                                    text={result.briefOverview.harmony}
                                                />
                                                <SynastryEditorialSection
                                                    title={getText(profile.language, 'synastry.challenge')}
                                                    text={result.briefOverview.challenges}
                                                />
                                                {result.briefOverview.tips && result.briefOverview.tips.length > 0 && (
                                                    <section className="border-t border-astro-border/12 pt-7 sm:pt-8">
                                                        <h3 className="lumia-reading-section-title text-astro-text">
                                                            {t('synastry.tips_label')}
                                                        </h3>
                                                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                                            {result.briefOverview.tips.map((tip, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="lumia-glass-inset rounded-air-sm px-4 py-4 text-center"
                                                                >
                                                                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-astro-highlight/14 text-sm font-semibold text-astro-highlight ring-1 ring-astro-highlight/18">
                                                                        {i + 1}
                                                                    </span>
                                                                    <p className="mt-3 text-[15px] leading-relaxed text-astro-text [text-wrap:pretty] sm:text-base sm:leading-relaxed">
                                                                        {tip}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                )}
                                            </>
                                        )}

                                        {result.extendedOverview && (
                                            <>
                                                {(
                                                    [
                                                        ['synastry.extended_connection', result.extendedOverview.connection],
                                                        ['synastry.extended_tension', result.extendedOverview.tension],
                                                        ['synastry.extended_navigation', result.extendedOverview.navigation],
                                                        ['synastry.extended_bond', result.extendedOverview.bondContext],
                                                    ] as const
                                                ).map(([labelKey, text]) => (
                                                    <SynastryEditorialSection key={labelKey} title={t(labelKey)} text={text} />
                                                ))}
                                            </>
                                        )}

                                        {result.fullAnalysis && (
                                            <>
                                                <SynastryEditorialSection
                                                    title={readingText.generalTheme}
                                                    text={result.fullAnalysis.generalTheme}
                                                />
                                                <SynastryEditorialSection
                                                    title={readingText.attraction}
                                                    text={result.fullAnalysis.attraction}
                                                />
                                                <SynastryEditorialSection
                                                    title={readingText.difficulties}
                                                    text={result.fullAnalysis.difficulties}
                                                />
                                                <SynastryEditorialSection
                                                    title={readingText.potential}
                                                    text={result.fullAnalysis.potential}
                                                />
                                                {result.fullAnalysis.recommendations &&
                                                    result.fullAnalysis.recommendations.length > 0 && (
                                                        <section className="border-t border-astro-border/12 pt-7 sm:pt-8">
                                                            <h3 className="lumia-reading-section-title text-astro-text">
                                                                {readingText.recommendations}
                                                            </h3>
                                                            <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                                                {result.fullAnalysis.recommendations.map((rec, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="lumia-glass-inset rounded-air-sm px-4 py-4 text-center"
                                                                    >
                                                                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-astro-highlight/14 text-sm font-semibold text-astro-highlight ring-1 ring-astro-highlight/18">
                                                                            {i + 1}
                                                                        </span>
                                                                        <p className="mt-3 text-[15px] leading-relaxed text-astro-text [text-wrap:pretty] sm:text-base sm:leading-relaxed">
                                                                            {rec}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </section>
                                                    )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3.5 border-t border-astro-border/12 pt-5 sm:pt-6">
                                {!result.fullAnalysis && (
                                    <>
                                        <div className="space-y-3">
                                            <p className="text-center text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                                                {getText(profile.language, 'synastry.cta_label')}
                                            </p>
                                            {profile.isPremium ? (
                                                <button
                                                    type="button"
                                                    onClick={() => void runSynastry('full')}
                                                    className="w-full rounded-[24px] bg-astro-highlight px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(201,166,88,0.65)] ring-1 ring-astro-highlight/30 transition-transform hover:scale-[1.01]"
                                                >
                                                    {t('synastry.add_full_btn')}
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => requestPremium()}
                                                    className="w-full rounded-[24px] bg-astro-highlight px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_40px_-24px_rgba(201,166,88,0.65)] ring-1 ring-astro-highlight/30 transition-transform hover:scale-[1.01]"
                                                >
                                                    {t('synastry.full_btn')}
                                                </button>
                                            )}
                                        </div>

                                        {showStarsFullAction && (
                                            <div className="rounded-[24px] border border-astro-highlight/28 bg-astro-highlight/[0.06] p-4 sm:p-5">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-[10px] uppercase tracking-[0.18em] text-astro-highlight">
                                                            Stars
                                                        </p>
                                                        <p className="mt-2 text-sm leading-relaxed text-astro-text">
                                                            {t('synastry.extended_hint')}
                                                        </p>
                                                    </div>
                                                    <span className="shrink-0 rounded-full border border-astro-highlight/25 bg-astro-highlight/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-astro-highlight">
                                                        {extendedCost} Stars
                                                    </span>
                                                </div>

                                                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[18px] border border-astro-border/55 bg-astro-bg/15 px-3.5 py-3 text-sm text-astro-subtext">
                                                    <input
                                                        type="checkbox"
                                                        className="mt-1 h-4 w-4 shrink-0 rounded border-astro-border text-astro-highlight focus:ring-astro-highlight"
                                                        checked={allowStarsConsent}
                                                        onChange={(e) => setAllowStarsConsent(e.target.checked)}
                                                    />
                                                    <span>{t('synastry.stars_consent', { cost: String(extendedCost) })}</span>
                                                </label>

                                                <button
                                                    type="button"
                                                    onClick={() => void runSynastry('extended')}
                                                    disabled={!allowStarsConsent}
                                                    className="mt-3 w-full rounded-[20px] border border-astro-highlight/50 bg-white/55 px-4 py-3 text-sm font-semibold text-astro-highlight backdrop-blur disabled:opacity-50"
                                                >
                                                    {t('synastry.add_extended_btn', { cost: String(extendedCost) })}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setResult(null);
                                    setError(null);
                                    setAllowStarsConsent(false);
                                    if (partnerCharts.length > 0) {
                                        setPartnerInputMode('charts');
                                    }
                                }}
                                className="w-full rounded-xl border border-astro-border px-4 py-3 text-sm font-semibold text-astro-text"
                            >
                                {getText(profile.language, 'synastry.compare_again')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ScreenShell>
        </div>
    );
};
