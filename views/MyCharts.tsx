import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import {
  getCharts,
  createChart,
  buyChartSlot,
  deleteChart,
  setPrimaryChart,
  calculateNatalChartData,
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

const T = (lang: string, ru: string, en: string) => (lang === 'ru' ? ru : en);

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
  const slotCost = 50;

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

  const handleBuySlot = async () => {
    if (!profile.id) return;
    setActionLoading('buy-slot');
    setAddError(null);
    try {
      const res = await buyChartSlot(profile.id);
      onProfileUpdate?.({ ...profile, lumiBalance: res.newBalance, chartSlots: res.chartSlots });
      await loadCharts();
    } catch (err: any) {
      setAddError(err?.message || T(lang, 'Недостаточно Lumi', 'Insufficient Lumi'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddChart = async () => {
    if (!profile.id || !addDate || !addPlace.trim()) {
      setAddError(T(lang, 'Заполните дату и место рождения', 'Fill date and birth place'));
      return;
    }
    setActionLoading('add');
    setAddError(null);
    try {
      const chartData = await calculateNatalChartData({
        name: addName.trim() || T(lang, 'Моя карта', 'My Chart'),
        birthDate: addDate,
        birthTime: addTime || '12:00',
        birthPlace: addPlace.trim(),
        language: lang,
      });
      await createChart(profile.id, {
        name: addName.trim() || T(lang, 'Моя карта', 'My Chart'),
        birthDate: addDate,
        birthTime: addTime || '12:00',
        birthPlace: addPlace.trim(),
        chartData,
      });
      setShowAddForm(false);
      setAddName('');
      setAddDate('');
      setAddTime('12:00');
      setAddPlace('');
      await loadCharts();
    } catch (err: any) {
      setAddError(err?.message || T(lang, 'Ошибка создания карты', 'Failed to create chart'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetPrimary = async (chartId: number) => {
    if (!profile.id) return;
    setActionLoading(`primary-${chartId}`);
    try {
      await setPrimaryChart(chartId, profile.id);
      await loadCharts();
      await onPrimaryChartUpdated?.();
    } catch (err: any) {
      setAddError(err?.message || T(lang, 'Ошибка', 'Error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (chart: ChartListItem) => {
    if (!profile.id) return;
    const msg = T(lang, `Удалить карту "${chart.name}"?`, `Delete chart "${chart.name}"?`);
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
      setAddError(err?.message || T(lang, 'Ошибка удаления', 'Delete failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectChart = (chart: ChartListItem) => {
    const cd = chart.chart_data;
    if (cd && onChartSelect) onChartSelect(cd, chart.id);
  };

  if (loading) return <Loading message={getText(lang, 'charts.loading')} />;

  const charts = data?.charts ?? [];
  const canAddMore = data?.canAddMore ?? true;
  const chartSlots = data?.chartSlots ?? 1;
  const lumiBalance = profile.lumiBalance ?? 0;
  const canBuySlot = !canAddMore && lumiBalance >= slotCost;
  const partnerCharts = charts.filter((chart) => !chart.is_primary);
  const isSingleChartState = charts.length === 1 && chartSlots > 1;
  const shouldOpenWallet = !canAddMore && !canBuySlot;

  return (
    <div className="p-4 space-y-6 screen-pb">
      <h2 className="text-lg font-semibold text-astro-text font-serif mb-2">
        {getText(lang, 'charts.title')}
      </h2>

      <div className="bg-astro-card border border-astro-border rounded-xl p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
              {getText(lang, 'charts.slots')}
            </p>
            <p className="text-2xl font-semibold text-astro-text">
              {charts.length} / {chartSlots}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
              {getText(lang, 'charts.balance')}
            </p>
            <p className="text-lg font-semibold text-astro-text">{lumiBalance} Lumi</p>
          </div>
        </div>

        {canAddMore ? (
          <button
            onClick={() => setShowAddForm(true)}
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
            {T(lang, 'Открыть Lumi Wallet', 'Open Lumi Wallet')}
          </button>
        )}

        <div className="rounded-xl border border-astro-border/70 bg-astro-bg/40 p-4">
          <p className="text-sm font-medium text-astro-text">{getText(lang, 'charts.value_title')}</p>
          <p className="mt-2 text-sm leading-relaxed text-astro-subtext">
            {getText(lang, 'charts.value_body')}
          </p>
        </div>

        {!canAddMore && (
          <div className="rounded-xl border border-astro-highlight/30 bg-astro-highlight/10 p-4 space-y-2">
            <p className="text-sm font-medium text-astro-text">{getText(lang, 'charts.slots_full_title')}</p>
            <p className="text-sm text-astro-subtext">{getText(lang, 'charts.slots_full_body')}</p>
            {canBuySlot ? (
              <p className="text-xs text-astro-subtext">
                {T(lang, 'Баланса хватает, можно сразу купить новый слот.', 'You have enough balance to buy a new slot right away.')}
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
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 text-sm text-red-300">
          {addError}
        </div>
      )}

      {charts.length === 0 ? (
        <div className="bg-astro-card border border-astro-border rounded-xl p-6 text-center">
          <p className="text-base font-medium text-astro-text">{getText(lang, 'charts.empty_title')}</p>
          <p className="mt-2 text-sm text-astro-subtext">{getText(lang, 'charts.empty_body')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {charts.map((chart) => {
            const cd = chart.chart_data;
            const sunSign = cd?.sun?.sign;
            const signLabel = sunSign ? getZodiacSign(lang, sunSign) : '-';
            const isPrimary = chart.is_primary ?? false;
            const isBusy = actionLoading === `primary-${chart.id}` || actionLoading === `delete-${chart.id}`;
            const formattedBirthDate = formatLumiaDate(chart.birth_date, lang) || chart.birth_date;

            return (
              <div
                key={chart.id}
                className={`bg-astro-card border rounded-xl p-4 ${
                  isPrimary ? 'border-astro-highlight' : 'border-astro-border'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif text-astro-text break-words">{chart.name}</span>
                      {isPrimary && (
                        <span className="text-[9px] uppercase tracking-wider text-astro-highlight bg-astro-highlight/20 px-2 py-0.5 rounded">
                          {T(lang, 'Основная', 'Primary')}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-astro-subtext">
                      {isPrimary ? getText(lang, 'charts.primary_role') : getText(lang, 'charts.saved_role')}
                    </p>
                    <p className="text-xs text-astro-subtext mt-2 break-words">
                      {formattedBirthDate} • {chart.birth_place}
                    </p>
                    {sunSign && (
                      <p className="text-[10px] text-astro-subtext mt-0.5">
                        ☉ {signLabel}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 text-right">
                    {onChartSelect && (
                      <button
                        onClick={() => handleSelectChart(chart)}
                        className="text-[10px] uppercase tracking-wider text-astro-highlight hover:underline"
                      >
                        {T(lang, 'Открыть', 'Open')}
                      </button>
                    )}
                    {!isPrimary && onUseInSynastry && (
                      <button
                        onClick={() => onUseInSynastry(chart)}
                        className="text-[10px] uppercase tracking-wider text-astro-highlight hover:underline"
                      >
                        {getText(lang, 'charts.use_in_synastry')}
                      </button>
                    )}
                    {!isPrimary && (
                      <button
                        onClick={() => handleSetPrimary(chart.id)}
                        disabled={!!isBusy}
                        className="text-[10px] uppercase tracking-wider text-astro-highlight hover:underline disabled:opacity-50"
                      >
                        {isBusy ? '...' : T(lang, 'Сделать основной', 'Set primary')}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(chart)}
                      disabled={!!isBusy}
                      className="text-[10px] uppercase tracking-wider text-red-400/80 hover:text-red-400 disabled:opacity-50"
                    >
                      {T(lang, 'Удалить', 'Delete')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddForm ? (
        <div className="bg-astro-card border border-astro-border rounded-xl p-5 space-y-4">
          <h3 className="font-serif text-astro-text">
            {T(lang, 'Добавить карту', 'Add chart')}
          </h3>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
              {T(lang, 'Имя', 'Name')}
            </label>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder={T(lang, 'Моя карта', 'My Chart')}
              className="w-full bg-transparent border-b border-astro-border py-2 text-astro-text text-sm focus:outline-none focus:border-astro-highlight"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
              {T(lang, 'Дата рождения', 'Birth date')}
            </label>
            <input
              type="date"
              value={addDate}
              onChange={(e) => setAddDate(e.target.value)}
              className="w-full bg-transparent border-b border-astro-border py-2 text-astro-text text-sm focus:outline-none focus:border-astro-highlight"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
              {T(lang, 'Время рождения', 'Birth time')}
            </label>
            <input
              type="time"
              value={addTime}
              onChange={(e) => setAddTime(e.target.value)}
              className="w-full bg-transparent border-b border-astro-border py-2 text-astro-text text-sm focus:outline-none focus:border-astro-highlight"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-astro-subtext mb-1">
              {T(lang, 'Место рождения', 'Birth place')}
            </label>
            <input
              type="text"
              value={addPlace}
              onChange={(e) => setAddPlace(e.target.value)}
              placeholder={T(lang, 'Москва, Россия', 'Moscow, Russia')}
              className="w-full bg-transparent border-b border-astro-border py-2 text-astro-text text-sm focus:outline-none focus:border-astro-highlight"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddChart}
              disabled={actionLoading === 'add'}
              className="flex-1 bg-astro-highlight text-white font-bold py-3 rounded-lg text-xs uppercase tracking-widest disabled:opacity-50"
            >
              {actionLoading === 'add' ? T(lang, 'Создание...', 'Creating...') : T(lang, 'Создать', 'Create')}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 border border-astro-border text-astro-text py-3 rounded-lg text-xs uppercase tracking-widest"
            >
              {T(lang, 'Отмена', 'Cancel')}
            </button>
          </div>
        </div>
      ) : shouldOpenWallet ? (
        <div className="bg-astro-card border border-astro-border rounded-xl p-4 text-center">
          <p className="text-sm text-astro-subtext">{getText(lang, 'charts.limit_reached')}</p>
          <p className="mt-2 text-base font-medium text-astro-highlight">
            {getText(lang, 'charts.balance')}: {lumiBalance} Lumi
          </p>
          {onOpenWallet && (
            <button
              onClick={onOpenWallet}
              className="mt-3 inline-flex rounded-lg border border-astro-highlight/40 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-astro-highlight"
            >
              {T(lang, 'Открыть Lumi Wallet', 'Open Lumi Wallet')}
            </button>
          )}
        </div>
      ) : null}

      {partnerCharts.length > 0 && (
        <p className="text-xs text-astro-subtext text-center">
          {T(
            lang,
            'Карты партнёров уже готовы к повторному использованию в синастрии.',
            'Your saved partner charts are ready to reuse in Synastry.'
          )}
        </p>
      )}
    </div>
  );
};
