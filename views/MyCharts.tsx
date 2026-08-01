import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { UserProfile } from '../types';
import {
  createChart,
  deleteChart,
  getCharts,
  setPrimaryChart,
  type ChartListItem,
  type ChartsResponse,
} from '../services/storageService';
import { Loading } from '../components/ui/Loading';
import { getText, getZodiacSign } from '../constants';
import { formatDisplayDate } from '../lib/date-utils';
import { PlanetIcon } from '../components/icons/PlanetIcon';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../lib/nativeBack';
import { hasActivePremium } from '../lib/accessMatrix';
import { clearLocalNatalChart } from '../lib/localNatalChartCache';
import { clearLocalHumanBaseReport } from '../lib/localHumanBaseReportCache';
import {
  MonoButton,
  MonoFadeIn,
  MonoInput,
  MonoSegment,
  MonoStagger,
  MonoStaggerItem,
  MonoTag,
} from '../components/mono-ui';

interface MyChartsProps {
  profile: UserProfile;
  onBack: () => void;
  onChartSelect?: (chartData: any, chartId?: number) => void;
  onProfileUpdate?: (profile: UserProfile) => void;
  onUseInSynastry?: (chart: ChartListItem) => void;
  onPrimaryChartUpdated?: () => Promise<void> | void;
  onRequestPremium?: () => void;
}

export const MyCharts: React.FC<MyChartsProps> = ({
  profile,
  onBack,
  onChartSelect,
  onProfileUpdate: _onProfileUpdate,
  onUseInSynastry,
  onPrimaryChartUpdated,
  onRequestPremium,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'primary' | 'partners'>('all');

  const lang = profile.language || 'ru';

  const resetAddForm = useCallback(() => {
    setShowAddForm(false);
    setAddName('');
    setAddDate('');
    setAddTime('12:00');
    setAddPlace('');
  }, []);

  useEffect(() => {
    if (!showAddForm) return;
    const handleNativeBack = (event: Event) => {
      resetAddForm();
      (event as CustomEvent<NativeBackEventDetail>).detail.handled = true;
    };
    window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack);
  }, [resetAddForm, showAddForm]);

  const loadCharts = useCallback(async () => {
    if (!profile.id) return;

    setLoading(true);
    try {
      const res = await getCharts(profile.id);
      setData(res);
    } catch (err: any) {
      console.error('[MyCharts] Load error', err);
      setData({ charts: [], chartSlots: 1, canAddMore: true });
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
  const partnerCharts = charts.filter((chart) => !chart.is_primary);
  const isSingleChartState = charts.length === 1 && chartSlots > 1;
  const showPremiumSlotsCta = !canAddMore && !hasActivePremium(profile) && !!onRequestPremium;

  const filteredCharts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return charts.filter((chart) => {
      if (listFilter === 'primary' && !chart.is_primary) return false;
      if (listFilter === 'partners' && chart.is_primary) return false;
      if (!q) return true;
      const hay = `${chart.name} ${chart.birth_place || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [charts, listFilter, searchQuery]);

  const filterOptions = lang === 'ru'
    ? [
        { value: 'all' as const, label: 'Все' },
        { value: 'primary' as const, label: 'Моя' },
        { value: 'partners' as const, label: 'Люди' },
      ]
    : [
        { value: 'all' as const, label: 'All' },
        { value: 'primary' as const, label: 'Mine' },
        { value: 'partners' as const, label: 'People' },
      ];

  useEffect(() => {
    if (!canAddMore && showAddForm) {
      setShowAddForm(false);
    }
  }, [canAddMore, showAddForm]);

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
        clearLocalNatalChart(profile);
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
      clearLocalNatalChart(profile);
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
      clearLocalHumanBaseReport(profile, chart.is_primary ? undefined : chart.id);
      if (chart.is_primary) {
        clearLocalNatalChart(profile);
      }
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
    <div className="fresh-page charts-editorial-page">
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-8">
        <MonoStagger>
          <MonoStaggerItem>
            <div className="fresh-card p-5">
              <MonoTag>{getText(lang, 'charts.action_title')}</MonoTag>
              <h2 className="mt-2 text-[24px] font-bold tracking-[-0.02em] text-mono-ink">
                {getText(lang, 'charts.title')}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-mono-muted">
                {getText(lang, 'charts.action_body')}
              </p>
              <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-mono-muted">
                {getText(lang, 'charts.slots')}: {charts.length} / {chartSlots}
              </p>

              {canAddMore ? (
                <MonoButton className="mt-4" fullWidth onClick={() => { setAddError(null); setShowAddForm(true); }}>
                  + {getText(lang, 'charts.add_chart')}
                </MonoButton>
              ) : (
                <div className="mt-4 space-y-3 fresh-card fresh-card--flat p-4">
                  <p className="text-[14px] font-semibold text-mono-ink">{getText(lang, 'charts.slots_full_title')}</p>
                  <p className="text-[13px] text-mono-muted">{getText(lang, 'charts.limit_reached')}</p>
                  {showPremiumSlotsCta && (
                    <MonoButton fullWidth onClick={onRequestPremium}>{getText(lang, 'charts.premium_slots_cta')}</MonoButton>
                  )}
                </div>
              )}
            </div>
          </MonoStaggerItem>

          <MonoStaggerItem>
            <MonoInput
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'ru' ? 'Поиск по имени или месту' : 'Search by name or place'}
            />
          </MonoStaggerItem>

          <MonoStaggerItem>
            <MonoSegment value={listFilter} onChange={setListFilter} options={filterOptions} />
          </MonoStaggerItem>
        </MonoStagger>

        {addError ? (
          <div className="rounded-mono-card border border-red-200 bg-red-50 p-3 text-sm text-red-700">{addError}</div>
        ) : null}

        {charts.length === 0 ? (
          <div className="fresh-card p-6 text-center">
            <p className="text-[16px] font-semibold text-mono-ink">{getText(lang, 'charts.empty_title')}</p>
            <p className="mt-2 text-[14px] text-mono-muted">{getText(lang, 'charts.empty_body')}</p>
          </div>
        ) : filteredCharts.length === 0 ? (
          <p className="text-center text-[14px] text-mono-muted">{lang === 'ru' ? 'Ничего не найдено' : 'Nothing found'}</p>
        ) : (
          <MonoStagger className="space-y-3">
            {filteredCharts.map((chart) => {
              const sunSign = chart.chart_data?.sun?.sign;
              const signLabel = sunSign ? getZodiacSign(lang, sunSign) : '-';
              const isPrimary = chart.is_primary ?? false;
              const isBusy =
                actionLoading === `primary-${chart.id}` || actionLoading === `delete-${chart.id}`;
              const formattedBirthDate = formatDisplayDate(chart.birth_date, lang) || chart.birth_date;

              return (
                <MonoStaggerItem key={chart.id}>
                  <motion.div
                    whileTap={{ scale: 0.99 }}
                    className={`rounded-mono-card border p-4 sm:p-5 ${
                      isPrimary ? 'border-mono-ink bg-mono-black text-white' : 'border-mono-line bg-mono-white text-mono-ink'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="break-words text-[17px] font-bold">{chart.name}</span>
                      {isPrimary ? (
                        <MonoTag dark className="!bg-white/15">{getText(lang, 'charts.primary_badge')}</MonoTag>
                      ) : null}
                    </div>
                    <p className={`mt-1 text-[13px] ${isPrimary ? 'text-white/70' : 'text-mono-muted'}`}>
                      {isPrimary ? getText(lang, 'charts.primary_role') : getText(lang, 'charts.saved_role')}
                    </p>
                    <p className={`mt-2 text-[13px] ${isPrimary ? 'text-white/65' : 'text-mono-muted'}`}>
                      {formattedBirthDate} · {chart.birth_place}
                    </p>
                    {sunSign ? (
                      <p className={`mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${isPrimary ? 'text-white/60' : 'text-mono-muted'}`}>
                        <PlanetIcon planet="sun" size={11} stroke="currentColor" />
                        <span>{signLabel}</span>
                      </p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {onChartSelect ? (
                        <MonoButton variant={isPrimary ? 'ghost' : 'outline'} className="!min-h-[36px] !px-3 !text-[11px]" onClick={() => handleSelectChart(chart)}>
                          {getText(lang, 'charts.open_chart')}
                        </MonoButton>
                      ) : null}
                      {!isPrimary && onUseInSynastry ? (
                        <MonoButton variant="outline" className="!min-h-[36px] !px-3 !text-[11px]" onClick={() => onUseInSynastry(chart)}>
                          {getText(lang, 'charts.use_in_synastry')}
                        </MonoButton>
                      ) : null}
                      {!isPrimary ? (
                        <MonoButton variant="outline" className="!min-h-[36px] !px-3 !text-[11px]" disabled={isBusy} onClick={() => handleSetPrimary(chart.id)}>
                          {isBusy ? '...' : getText(lang, 'charts.set_primary')}
                        </MonoButton>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDelete(chart)}
                        disabled={isBusy}
                        className="rounded-mono-pill border border-red-200 px-3 py-2 text-[11px] font-semibold text-red-600 disabled:opacity-50"
                      >
                        {getText(lang, 'charts.delete')}
                      </button>
                    </div>
                  </motion.div>
                </MonoStaggerItem>
              );
            })}
          </MonoStagger>
        )}

        {isSingleChartState ? (
          <p className="text-[13px] text-mono-muted">{getText(lang, 'charts.single_chart_body')}</p>
        ) : null}

        {showAddForm ? (
          <MonoFadeIn className="space-y-4 fresh-card p-5">
            <h3 className="text-[18px] font-bold text-mono-ink">{getText(lang, 'charts.add_form_title')}</h3>
            <MonoInput label={getText(lang, 'charts.field_name')} value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={getText(lang, 'charts.default_chart_name')} />
            <MonoInput label={getText(lang, 'charts.field_birth_date')} type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
            <MonoInput label={getText(lang, 'charts.field_birth_time')} type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)} />
            <MonoInput label={getText(lang, 'charts.field_birth_place')} value={addPlace} onChange={(e) => setAddPlace(e.target.value)} placeholder={getText(lang, 'charts.field_birth_place_placeholder')} />
            <div className="flex gap-2">
              <MonoButton className="flex-1" disabled={actionLoading === 'add'} onClick={handleAddChart}>
                {actionLoading === 'add' ? getText(lang, 'charts.creating') : getText(lang, 'charts.create')}
              </MonoButton>
              <MonoButton className="flex-1" variant="outline" onClick={resetAddForm}>
                {getText(lang, 'charts.cancel')}
              </MonoButton>
            </div>
          </MonoFadeIn>
        ) : null}

        {partnerCharts.length > 0 ? (
          <p className="text-center text-[12px] text-mono-muted">{getText(lang, 'charts.saved_for_synastry_hint')}</p>
        ) : null}
      </div>
    </div>
  );
};
