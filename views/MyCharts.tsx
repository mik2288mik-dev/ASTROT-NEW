import React, { useCallback, useEffect, useState } from 'react';
import { UserProfile } from '../types';
import {
  buyChartSlot,
  createChart,
  deleteChart,
  getCharts,
  setPrimaryChart,
  type ChartListItem,
  type ChartsResponse,
} from '../services/storageService';
import { Loading } from '../components/ui/Loading';
import { getText, getZodiacSign } from '../constants';
import { formatLumiaDate } from '../lib/date-utils';

interface MyChartsProps {
  profile: UserProfile;
  onBack: () => void;
  onChartSelect?: (chartData: any, chartId?: number) => void;
  onProfileUpdate?: (profile: UserProfile) => void;
  onOpenWallet?: () => void;
  onUseInSynastry?: (chart: ChartListItem) => void;
  onPrimaryChartUpdated?: () => Promise<void> | void;
}

export const MyCharts: React.FC<MyChartsProps> = ({
  profile,
  onBack,
  onChartSelect,
  onProfileUpdate,
  onOpenWallet,
  onUseInSynastry,
  onPrimaryChartUpdated,
}) => {
  void onBack;

  const [data, setData] = useState<ChartsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDate, setAddDate] = useState('');
  const [addTime, setAddTime] = useState('12:00');
  const [addPlace, setAddPlace] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const lang = profile.language || 'ru';

  const resetAddForm = useCallback(() => {
    setShowAddForm(false);
    setAddName('');
    setAddDate('');
    setAddTime('12:00');
    setAddPlace('');
  }, []);

  const loadCharts = useCallback(async () => {
    if (!profile.id) return;

    setLoading(true);
    try {
      const res = await getCharts(profile.id);
      setData(res);
    } catch (err: any) {
      console.error('[MyCharts] Load error', err);
      setData({ charts: [], chartSlots: 1, canAddMore: true, slotCost: 50 });
    } finally {
      setLoading(false);
    }
  }, [profile.id]);

  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  const charts = data?.charts ?? [];
  const canAddMore = data?.canAddMore ?? true;
  const chartSlots = data?.chartSlots ?? (profile.chartSlots ?? 1);
  const slotCost = data?.slotCost ?? 50;
  const lumiBalance = profile.lumiBalance ?? 0;
  const canBuySlot = !canAddMore && lumiBalance >= slotCost;
  const shouldOpenWallet = !canAddMore && !canBuySlot;
  const partnerCharts = charts.filter((chart) => !chart.is_primary);
  const isSingleChartState = charts.length === 1 && chartSlots > 1;

  useEffect(() => {
    if (!canAddMore && showAddForm) {
      setShowAddForm(false);
    }
  }, [canAddMore, showAddForm]);

  const handleBuySlot = async () => {
    if (!profile.id) return;

    setActionLoading('buy-slot');
    setAddError(null);

    try {
      const res = await buyChartSlot(profile.id);
      onProfileUpdate?.({
        ...profile,
        lumiBalance: res.newBalance,
        chartSlots: res.chartSlots,
      });
      await loadCharts();
      setShowAddForm(true);
    } catch (err: any) {
      setAddError(err?.message || getText(lang, 'charts.error_insufficient_lumi'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddChart = async () => {
    if (!profile.id || !addDate || !addPlace.trim()) {
      setAddError(getText(lang, 'charts.error_fill_required'));
      return;
    }

    if (!canAddMore) {
      setAddError(getText(lang, 'charts.error_no_free_slots'));
      return;
    }

    setActionLoading('add');
    setAddError(null);

    try {
      const createdChart = await createChart(profile.id, {
        name: addName.trim() || getText(lang, 'charts.default_chart_name'),
        birthDate: addDate,
        birthTime: addTime || '12:00',
        birthPlace: addPlace.trim(),
        language: lang,
      });

      resetAddForm();
      await loadCharts();

      if (createdChart.is_primary) {
        await onPrimaryChartUpdated?.();
      }
    } catch (err: any) {
      setAddError(err?.message || getText(lang, 'charts.error_create_failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetPrimary = async (chartId: number) => {
    if (!profile.id) return;

    setActionLoading(`primary-${chartId}`);
    setAddError(null);

    try {
      await setPrimaryChart(chartId, profile.id);
      await loadCharts();
      await onPrimaryChartUpdated?.();
    } catch (err: any) {
      setAddError(err?.message || getText(lang, 'charts.error_generic'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (chart: ChartListItem) => {
    if (!profile.id) return;

    const msg = `${getText(lang, 'charts.delete')} "${chart.name}"?`;
    if (!confirm(msg)) return;

    setActionLoading(`delete-${chart.id}`);
    setAddError(null);

    try {
      await deleteChart(chart.id, profile.id);
      await loadCharts();

      if (chart.is_primary) {
        await onPrimaryChartUpdated?.();
      }
    } catch (err: any) {
      setAddError(err?.message || getText(lang, 'charts.error_delete_failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectChart = (chart: ChartListItem) => {
    if (chart.chart_data && onChartSelect) {
      onChartSelect(chart.chart_data, chart.id);
    }
  };

  if (loading) {
    return <Loading message={getText(lang, 'charts.loading')} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-6 space-y-5 screen-pb">
      <div className="space-y-4 rounded-[24px] border border-astro-border/80 bg-gradient-to-b from-astro-card to-astro-card/65 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-astro-subtext">
              {getText(lang, 'charts.action_title')}
            </p>
            <h2 className="font-serif text-xl text-astro-text">
              {getText(lang, 'charts.title')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
              {getText(lang, 'charts.action_body')}
            </p>
          </div>
          <div className="min-w-[88px] text-right">
            <p className="mb-1 text-[10px] uppercase tracking-widest text-astro-subtext">
              {getText(lang, 'charts.slots')}
            </p>
            <p className="text-2xl font-semibold text-astro-text">
              {charts.length} / {chartSlots}
            </p>
            <p className="mb-1 text-[10px] uppercase tracking-widest text-astro-subtext">
              {getText(lang, 'charts.balance')}
            </p>
            <p className="text-sm font-semibold text-astro-text">{lumiBalance} Lumi</p>
          </div>
        </div>

        {canAddMore ? (
          <button
            onClick={() => {
              setAddError(null);
              setShowAddForm(true);
            }}
            className="w-full rounded-xl bg-astro-highlight px-4 py-3 text-sm font-semibold text-white"
          >
            + {getText(lang, 'charts.add_chart')}
          </button>
        ) : canBuySlot ? (
          <button
            onClick={handleBuySlot}
            disabled={actionLoading === 'buy-slot'}
            className="w-full rounded-xl bg-astro-highlight px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {actionLoading === 'buy-slot'
              ? getText(lang, 'charts.purchasing')
              : `${getText(lang, 'charts.buy_slot')} ${slotCost} ${getText(lang, 'charts.buy_slot_lumi')}`}
          </button>
        ) : (
          <button
            onClick={onOpenWallet}
            disabled={!onOpenWallet}
            className="w-full rounded-xl border border-astro-highlight/40 px-4 py-3 text-sm font-semibold text-astro-highlight disabled:opacity-50"
          >
            {getText(lang, 'charts.open_wallet')}
          </button>
        )}

        <div className="rounded-2xl border border-astro-border/70 bg-astro-bg/30 p-4">
          <p className="text-sm font-medium text-astro-text">{getText(lang, 'charts.value_title')}</p>
          <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
            {getText(lang, 'charts.value_body')}
          </p>
        </div>

        {!canAddMore && (
          <div className="space-y-2 rounded-xl border border-astro-highlight/30 bg-astro-highlight/10 p-4">
            <p className="text-sm font-medium text-astro-text">{getText(lang, 'charts.slots_full_title')}</p>
            <p className="text-sm text-astro-subtext">{getText(lang, 'charts.slots_full_body')}</p>
            {canBuySlot ? (
              <p className="text-xs text-astro-subtext">
                {getText(lang, 'charts.enough_balance_hint')}
              </p>
            ) : (
              <p className="text-xs text-astro-subtext">
                {getText(lang, 'charts.slots_need_more_lumi')} {Math.max(slotCost - lumiBalance, 0)} Lumi.
              </p>
            )}
          </div>
        )}

        {isSingleChartState && (
          <p className="text-sm text-astro-subtext">{getText(lang, 'charts.single_chart_body')}</p>
        )}
      </div>

      {addError && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {addError}
        </div>
      )}

      {charts.length === 0 ? (
        <div className="rounded-[24px] border border-astro-border/80 bg-astro-card/60 p-6 text-center">
          <p className="text-base font-medium text-astro-text">{getText(lang, 'charts.empty_title')}</p>
          <p className="mt-2 text-sm text-astro-subtext">{getText(lang, 'charts.empty_body')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {charts.map((chart) => {
            const sunSign = chart.chart_data?.sun?.sign;
            const signLabel = sunSign ? getZodiacSign(lang, sunSign) : '-';
            const isPrimary = chart.is_primary ?? false;
            const isBusy =
              actionLoading === `primary-${chart.id}` || actionLoading === `delete-${chart.id}`;
            const formattedBirthDate = formatLumiaDate(chart.birth_date, lang) || chart.birth_date;

            return (
              <div
                key={chart.id}
                className={`rounded-[24px] border bg-astro-card/55 p-4 sm:p-5 ${
                  isPrimary ? 'border-astro-highlight/70 shadow-[0_0_0_1px_rgba(244,176,255,0.06)]' : 'border-astro-border/80'
                }`}
              >
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words font-serif text-astro-text">{chart.name}</span>
                      {isPrimary && (
                        <span className="rounded-full border border-astro-highlight/25 bg-astro-highlight/12 px-2.5 py-1 text-[9px] uppercase tracking-wider text-astro-highlight">
                          {getText(lang, 'charts.primary_badge')}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-astro-subtext">
                      {isPrimary ? getText(lang, 'charts.primary_role') : getText(lang, 'charts.saved_role')}
                    </p>
                    <p className="mt-3 break-words text-xs text-astro-subtext">
                      {formattedBirthDate} • {chart.birth_place}
                    </p>
                    {sunSign && (
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-astro-subtext">☉ {signLabel}</p>
                    )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {onChartSelect && (
                      <button
                        onClick={() => handleSelectChart(chart)}
                        className="rounded-full border border-astro-border/80 px-3 py-1.5 text-[10px] uppercase tracking-wider text-astro-text transition-colors hover:border-astro-highlight/40 hover:text-astro-highlight"
                      >
                        {getText(lang, 'charts.open_chart')}
                      </button>
                    )}
                    {!isPrimary && onUseInSynastry && (
                      <button
                        onClick={() => onUseInSynastry(chart)}
                        className="rounded-full border border-astro-border/80 px-3 py-1.5 text-[10px] uppercase tracking-wider text-astro-text transition-colors hover:border-astro-highlight/40 hover:text-astro-highlight"
                      >
                        {getText(lang, 'charts.use_in_synastry')}
                      </button>
                    )}
                    {!isPrimary && (
                      <button
                        onClick={() => handleSetPrimary(chart.id)}
                        disabled={isBusy}
                        className="rounded-full border border-astro-border/80 px-3 py-1.5 text-[10px] uppercase tracking-wider text-astro-text transition-colors hover:border-astro-highlight/40 hover:text-astro-highlight disabled:opacity-50"
                      >
                        {isBusy ? '...' : getText(lang, 'charts.set_primary')}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(chart)}
                      disabled={isBusy}
                      className="rounded-full border border-red-500/30 px-3 py-1.5 text-[10px] uppercase tracking-wider text-red-400/80 transition-colors hover:border-red-500/60 hover:text-red-400 disabled:opacity-50"
                    >
                      {getText(lang, 'charts.delete')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm ? (
        <div className="space-y-4 rounded-[24px] border border-astro-border/80 bg-astro-card/60 p-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] text-astro-subtext">
              {getText(lang, 'charts.add_chart')}
            </p>
            <h3 className="mt-1 font-serif text-lg text-astro-text">{getText(lang, 'charts.add_form_title')}</h3>
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-astro-subtext">
              {getText(lang, 'charts.field_name')}
            </label>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder={getText(lang, 'charts.default_chart_name')}
              className="w-full border-b border-astro-border bg-transparent py-2 text-sm text-astro-text focus:border-astro-highlight focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-astro-subtext">
              {getText(lang, 'charts.field_birth_date')}
            </label>
            <input
              type="date"
              value={addDate}
              onChange={(e) => setAddDate(e.target.value)}
              className="w-full border-b border-astro-border bg-transparent py-2 text-sm text-astro-text focus:border-astro-highlight focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-astro-subtext">
              {getText(lang, 'charts.field_birth_time')}
            </label>
            <input
              type="time"
              value={addTime}
              onChange={(e) => setAddTime(e.target.value)}
              className="w-full border-b border-astro-border bg-transparent py-2 text-sm text-astro-text focus:border-astro-highlight focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] uppercase tracking-widest text-astro-subtext">
              {getText(lang, 'charts.field_birth_place')}
            </label>
            <input
              type="text"
              value={addPlace}
              onChange={(e) => setAddPlace(e.target.value)}
              placeholder={getText(lang, 'charts.field_birth_place_placeholder')}
              className="w-full border-b border-astro-border bg-transparent py-2 text-sm text-astro-text focus:border-astro-highlight focus:outline-none"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleAddChart}
              disabled={actionLoading === 'add'}
              className="flex-1 rounded-lg bg-astro-highlight py-3 text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50"
            >
              {actionLoading === 'add' ? getText(lang, 'charts.creating') : getText(lang, 'charts.create')}
            </button>
            <button
              onClick={resetAddForm}
              className="flex-1 rounded-lg border border-astro-border py-3 text-xs uppercase tracking-widest text-astro-text"
            >
              {getText(lang, 'charts.cancel')}
            </button>
          </div>
        </div>
      ) : shouldOpenWallet ? (
        <div className="rounded-[24px] border border-astro-border/80 bg-astro-card/60 p-5 text-center">
          <p className="text-sm text-astro-subtext">{getText(lang, 'charts.limit_reached')}</p>
          <p className="mt-2 text-base font-medium text-astro-highlight">
            {getText(lang, 'charts.balance')}: {lumiBalance} Lumi
          </p>
          {onOpenWallet && (
            <button
              onClick={onOpenWallet}
              className="mt-3 inline-flex rounded-lg border border-astro-highlight/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-astro-highlight"
            >
              {getText(lang, 'charts.open_wallet')}
            </button>
          )}
        </div>
      ) : null}

      {partnerCharts.length > 0 && (
        <p className="text-center text-xs text-astro-subtext">
          {getText(lang, 'charts.saved_for_synastry_hint')}
        </p>
      )}
    </div>
  );
};
