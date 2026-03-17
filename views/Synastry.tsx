import React, { useState, useMemo, useEffect } from 'react';
import { UserProfile, SynastryResult, NatalChartData } from '../types';
import { getOrGenerateSynastry } from '../services/contentGenerationService';
import { getCharts, buyChartSlot, type ChartListItem } from '../services/storageService';
import { getText, getZodiacSign } from '../constants';
import { Loading } from '../components/ui/Loading';
import { getApproximateSunSignByDate } from '../lib/zodiac-utils';
import { toDateInputValue, formatLumiaDate } from '../lib/date-utils';

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
    const [slotActionLoading, setSlotActionLoading] = useState(false);

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
    const canBuySlot = (profile.lumiBalance ?? 0) >= 50;

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

    const handleBuySlot = async () => {
        if (!profile.id) return;
        setSlotActionLoading(true);
        setError(null);
        try {
            const res = await buyChartSlot(profile.id);
            onUpdateProfile?.({ ...profile, lumiBalance: res.newBalance, chartSlots: res.chartSlots });
            await loadCharts();
        } catch (buyError: any) {
            setError(buyError?.message || 'Failed to buy chart slot');
        } finally {
            setSlotActionLoading(false);
        }
    };

    const handleCalculate = async (mode: 'brief' | 'full') => {
        if (!partnerName || !partnerDate) return;
        if (mode === 'full' && !profile.isPremium) {
            requestPremium();
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await getOrGenerateSynastry(
                profile,
                partnerName,
                partnerDate,
                partnerTime || undefined,
                partnerPlace || undefined,
                relationshipType,
                mode,
                partnerInputMode === 'charts' && selectedPartnerChartId != null ? selectedPartnerChartId : undefined
            );
            setResult(data);
        } catch (e: any) {
            console.error('[Synastry] Error calculating synastry:', e);
            setError(e?.message || 'Failed to calculate synastry');
        } finally {
            setLoading(false);
        }
    };

    const sourceBadge = partnerInputMode === 'charts'
        ? getText(profile.language, 'synastry.selected_saved')
        : getText(profile.language, 'synastry.selected_manual');
    const canSubmit = Boolean(partnerName && partnerDate);
    const fieldLabelClass = 'mb-2 block text-[10px] uppercase tracking-[0.18em] text-astro-subtext';
    const fieldInputClass = 'w-full border-b border-astro-border bg-transparent py-3 text-sm text-astro-text outline-none transition-colors focus:border-astro-highlight';

    if (loading) {
        return <Loading message={getText(profile.language, 'synastry.loading')} />;
    }

    return (
        <div className="min-h-screen max-w-2xl mx-auto px-5 py-6 space-y-5 screen-pb">
            <section className="rounded-[24px] border border-astro-border/80 bg-gradient-to-b from-astro-card to-astro-card/65 p-5 shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                    {getText(profile.language, 'synastry.title')}
                </p>
                <h1 className="mt-2 font-serif text-2xl text-astro-text">
                    {getText(profile.language, 'synastry.title')}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-astro-subtext">
                    {getText(profile.language, 'synastry.desc')}
                </p>
            </section>

            {!result ? (
                <div className="space-y-5">
                    <div className="rounded-[24px] border border-astro-border/80 bg-astro-card/60 p-5 space-y-4">
                        <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/25 p-4 space-y-3">
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

                        <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/20 p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-astro-subtext">
                                {getText(profile.language, 'synastry.mode_label')}
                            </p>
                            <div className="mt-3 flex gap-2 rounded-2xl border border-astro-border bg-astro-bg/30 p-1">
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

                        <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/20 p-4 space-y-2">
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
                                <div className="rounded-2xl border border-astro-border bg-astro-bg/20 p-5 text-center space-y-3">
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
                                            canBuySlot ? (
                                                <button
                                                    type="button"
                                                    onClick={handleBuySlot}
                                                    disabled={slotActionLoading}
                                                    className="w-full rounded-xl border border-astro-highlight/40 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-astro-highlight disabled:opacity-50"
                                                >
                                                    {slotActionLoading
                                                        ? getText(profile.language, 'charts.purchasing')
                                                        : `${getText(profile.language, 'synastry.buy_slot')} • 50 Lumi`}
                                                </button>
                                            ) : (
                                                <p className="text-xs text-astro-subtext">
                                                    {getText(profile.language, 'charts.slots_need_more_lumi')}
                                                </p>
                                            )
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {selectedPartnerChart ? (
                                        <div className="rounded-2xl border border-astro-highlight/30 bg-astro-highlight/10 p-4">
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
                                                className="w-full bg-astro-bg/20 border border-astro-border rounded-2xl p-4 text-left hover:border-astro-highlight/40 transition-colors"
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
                            <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/15 p-4 space-y-4">
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
                            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                                {error}
                            </div>
                        )}

                        <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/20 p-4">
                            <p className="text-[10px] uppercase tracking-[0.18em] text-astro-subtext">
                                {getText(profile.language, 'synastry.cta_label')}
                            </p>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => handleCalculate('brief')}
                                    disabled={!canSubmit}
                                    className="w-full rounded-xl bg-astro-highlight px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                                >
                                    {getText(profile.language, 'synastry.brief_btn')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCalculate('full')}
                                    disabled={!canSubmit}
                                    className="w-full rounded-xl border border-astro-border px-4 py-3 text-sm font-semibold text-astro-text disabled:opacity-50"
                                >
                                    {getText(profile.language, 'synastry.full_btn')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    <div className="rounded-[24px] border border-astro-border/80 bg-astro-card/60 p-5 space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
                                    {getText(profile.language, 'synastry.result_title')}
                                </p>
                                <h2 className="font-serif text-xl text-astro-text mt-1">
                                    {profile.name} × {partnerName}
                                </h2>
                            </div>
                            <span className="text-[10px] uppercase tracking-wider text-astro-highlight bg-astro-highlight/15 px-2 py-1 rounded-full">
                                {partnerInputMode === 'charts'
                                    ? getText(profile.language, 'synastry.result_saved_badge')
                                    : getText(profile.language, 'synastry.result_manual_badge')}
                            </span>
                        </div>

                        {result.compatibilityScore !== undefined && (
                            <div className="inline-flex rounded-full border border-astro-highlight/30 bg-astro-highlight/10 px-4 py-2 text-2xl font-semibold text-astro-text">
                                {result.compatibilityScore}/100
                            </div>
                        )}

                        <p className="text-sm leading-relaxed text-astro-subtext">{result.summary}</p>

                        {result.briefOverview && (
                            <div className="space-y-3">
                                <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/20 p-4">
                                    <p className="text-sm text-astro-text">{result.briefOverview.introduction}</p>
                                </div>
                                <div className="grid grid-cols-1 gap-3">
                                    <div className="rounded-2xl border border-astro-border/70 p-4">
                                        <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-2">
                                            {getText(profile.language, 'synastry.emotional')}
                                        </p>
                                        <p className="text-sm text-astro-text">{result.briefOverview.harmony}</p>
                                    </div>
                                    <div className="rounded-2xl border border-astro-border/70 p-4">
                                        <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-2">
                                            {getText(profile.language, 'synastry.challenge')}
                                        </p>
                                        <p className="text-sm text-astro-text">{result.briefOverview.challenges}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {result.fullAnalysis && (
                            <div className="space-y-3">
                                {[
                                    result.fullAnalysis.generalTheme,
                                    result.fullAnalysis.attraction,
                                    result.fullAnalysis.difficulties,
                                    result.fullAnalysis.potential,
                                ].map((section, index) => (
                                    <div key={index} className="rounded-2xl border border-astro-border/70 p-4">
                                        <p className="text-sm text-astro-text">{section}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                setResult(null);
                                setError(null);
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
            )}
        </div>
    );
};
