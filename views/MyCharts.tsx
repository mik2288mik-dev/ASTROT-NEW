import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { UserProfile } from '../types';
import {
  createChart,
  deleteChart,
  getCharts,
  type ChartListItem,
  type ChartsResponse,
} from '../services/storageService';
import { Loading } from '../components/ui/Loading';
import { getText, getZodiacSign } from '../constants';
import { formatDisplayDate } from '../lib/date-utils';
import { PlanetIcon } from '../components/icons/PlanetIcon';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../lib/nativeBack';
import { hasActivePremium } from '../lib/accessMatrix';
import { clearLocalHumanBaseReport } from '../lib/localHumanBaseReportCache';
import { getChartSubjectType, isSelfChart } from '../lib/chartAccessPolicy';
import type { PaywallContext } from '../lib/paywallContext';
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
  onChartSelect?: (chart: ChartListItem) => void;
  onProfileUpdate?: (profile: UserProfile) => void;
  onUseInSynastry?: (chart: ChartListItem) => void;
  onPrimaryChartUpdated?: () => Promise<void> | void;
  onRequestPremium?: (source?: string, payload?: Record<string, unknown>) => void;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
  canPromotePremium?: boolean;
}

export const MyCharts: React.FC<MyChartsProps> = ({
  profile,
  onBack,
  onChartSelect,
  onProfileUpdate: _onProfileUpdate,
  onUseInSynastry,
  onPrimaryChartUpdated: _onPrimaryChartUpdated,
  onRequestPremium,
  premiumContinuation,
  onPremiumContinuationHandled,
  canPromotePremium = true,
}) => {
  void onBack;

  const [data, setData] = useState<ChartsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDate, setAddDate] = useState('');
  const [addTime, setAddTime] = useState('');
  const [addPlace, setAddPlace] = useState('');
  const [addRelation, setAddRelation] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [addInvalidFields, setAddInvalidFields] = useState<Array<'date' | 'place'>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'primary' | 'partners'>('all');
  const [entitlementNow, setEntitlementNow] = useState(() => Date.now());

  const lang = profile.language || 'ru';

  const resetAddForm = useCallback(() => {
    setShowAddForm(false);
    setAddName('');
    setAddDate('');
    setAddTime('');
    setAddPlace('');
    setAddRelation('');
    setAddError(null);
    setAddInvalidFields([]);
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
    setLoadError(null);
    try {
      const res = await getCharts(profile.id);
      setData(res);
      return res;
    } catch (err: any) {
      console.error('[MyCharts] Load error', err);
      setLoadError(err?.message || (lang === 'ru' ? 'Не удалось загрузить карты.' : 'Could not load charts.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [lang, profile.id, profile.premiumEntitlement?.state, profile.premiumEntitlement?.endsAt]);

  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  const charts = data?.charts ?? [];
  const serverCanAddMore = data?.canAddSavedPeople ?? data?.canAddMore ?? true;
  const chartSlots = data?.chartSlots ?? (profile.chartSlots ?? 1);
  const partnerCharts = charts.filter((chart) => getChartSubjectType(chart) === 'saved_person');
  const isSingleChartState = charts.length === 1 && chartSlots > 1;
  // The profile carries the latest backend-validated entitlement. A cached
  // chart-list boolean must never outlive its dated canonical snapshot.
  const hasPremiumAccess = hasActivePremium(profile, entitlementNow);
  const canAddMore = hasPremiumAccess && serverCanAddMore;
  const isChartEffectivelyLocked = useCallback((chart: ChartListItem) => (
    chart.access_locked === true
    || (getChartSubjectType(chart) === 'saved_person' && !hasPremiumAccess)
  ), [hasPremiumAccess]);
  const accessibleChartCount = charts.filter((chart) => !isChartEffectivelyLocked(chart)).length;
  const lockedChartCount = charts.length - accessibleChartCount;
  const showPremiumSlotsCta = canPromotePremium && !canAddMore && !hasPremiumAccess && !!onRequestPremium;

  useEffect(() => {
    const end = profile.premiumEntitlement?.endsAt || profile.premiumUntil;
    const endMs = end ? new Date(end).getTime() : Number.NaN;
    setEntitlementNow(Date.now());
    if (!Number.isFinite(endMs) || endMs <= Date.now()) return;
    let timer = 0;
    const scheduleBoundary = () => {
      const remaining = endMs - Date.now() + 50;
      if (remaining <= 0) {
        setEntitlementNow(Date.now());
        return;
      }
      timer = window.setTimeout(
        scheduleBoundary,
        Math.min(2_147_000_000, Math.max(1, remaining)),
      );
    };
    scheduleBoundary();
    return () => window.clearTimeout(timer);
  }, [profile.premiumEntitlement?.endsAt, profile.premiumUntil]);

  const filteredCharts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return charts.filter((chart) => {
      const self = isSelfChart(chart);
      if (listFilter === 'primary' && !self) return false;
      if (listFilter === 'partners' && self) return false;
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

  const resumePremiumContinuation = useCallback((refreshed: ChartsResponse | null | undefined) => {
    if (!hasPremiumAccess || !premiumContinuation || !refreshed) return false;
    if (premiumContinuation.featureKey !== 'saved_people') return false;
    if (premiumContinuation.returnAction === 'add_saved_person') {
        setShowAddForm(true);
    } else if (
      premiumContinuation.returnAction === 'open_saved_person'
      && premiumContinuation.returnEntityId
    ) {
      const requested = refreshed.charts.find(
        (chart) => String(chart.id) === premiumContinuation.returnEntityId,
      );
      if (!requested?.chart_data || requested.access_locked) {
        setLoadError(lang === 'ru'
          ? 'Premium открыт, но запрошенная карта пока не загрузилась. Повтори попытку.'
          : 'Premium is active, but the requested chart has not loaded yet. Retry.');
        return false;
      }
      onChartSelect?.({ ...requested, access_locked: false });
    } else {
      return false;
    }
    onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
    return true;
  }, [
    hasPremiumAccess,
    lang,
    onChartSelect,
    onPremiumContinuationHandled,
    premiumContinuation,
  ]);

  const reloadAndResume = useCallback(async () => {
    const refreshed = await loadCharts();
    resumePremiumContinuation(refreshed);
  }, [loadCharts, resumePremiumContinuation]);

  useEffect(() => {
    if (!hasPremiumAccess || !premiumContinuation) return;
    if (premiumContinuation.featureKey !== 'saved_people') return;
    void reloadAndResume();
  }, [
    hasPremiumAccess,
    premiumContinuation,
    reloadAndResume,
  ]);

  const handleAddChart = async () => {
    const missingFields: Array<'date' | 'place'> = [];
    if (!addDate) missingFields.push('date');
    if (!addPlace.trim()) missingFields.push('place');
    if (!profile.id || missingFields.length) {
      setAddInvalidFields(missingFields);
      setAddError(getText(lang, 'charts.error_fill_required'));
      return;
    }

    if (!canAddMore) {
      setAddError(getText(lang, 'charts.error_no_free_slots'));
      return;
    }

    setActionLoading('add');
    setAddError(null);
    setAddInvalidFields([]);

    try {
      await createChart(profile.id, {
        name: addName.trim() || getText(lang, 'charts.default_chart_name'),
        birthDate: addDate,
        birthTime: addTime,
        birthPlace: addPlace.trim(),
        language: lang,
        relationLabel: addRelation.trim() || null,
      });

      resetAddForm();
      await loadCharts();
    } catch (err: any) {
      setAddError(err?.message || getText(lang, 'charts.error_create_failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (chart: ChartListItem) => {
    if (!profile.id || isSelfChart(chart)) return;

    const msg = `${getText(lang, 'charts.delete')} "${chart.name}"?`;
    if (!confirm(msg)) return;

    setActionLoading(`delete-${chart.id}`);
    setAddError(null);

    try {
      await deleteChart(chart.id, profile.id);
      clearLocalHumanBaseReport(profile, chart.id, {
        subjectType: getChartSubjectType(chart),
        subjectIdentity: {
          name: chart.name,
          birthDate: chart.birth_date,
          birthTime: chart.birth_time,
          birthPlace: chart.birth_place,
        },
        chartData: chart.chart_data,
        inputHash: chart.input_hash,
        calculationVersion: chart.calculation_version,
      });
      await loadCharts();
    } catch (err: any) {
      setAddError(err?.message || getText(lang, 'charts.error_delete_failed'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSelectChart = (chart: ChartListItem) => {
    if (isChartEffectivelyLocked(chart)) {
      if (hasPremiumAccess) {
        void loadCharts();
        return;
      }
      onRequestPremium?.('charts', {
        placement: 'saved_people',
        featureKey: 'saved_people',
        triggerType: 'locked_feature',
        returnView: 'charts',
        returnAction: 'open_saved_person',
        returnEntityId: chart.id,
      });
      return;
    }
    if (chart.chart_data && onChartSelect) {
      onChartSelect(chart);
    }
  };

  if (loading) {
    return <Loading message={getText(lang, 'charts.loading')} />;
  }

  if (!data && loadError) {
    return (
      <div className="fresh-page charts-editorial-page">
        <div className="mx-auto max-w-2xl px-4 pb-8">
          <div role="alert" className="fresh-card space-y-3 p-5">
            <p className="text-[14px] leading-relaxed text-red-700">{loadError}</p>
            <MonoButton fullWidth onClick={() => { void reloadAndResume(); }}>
              {lang === 'ru' ? 'Повторить' : 'Try again'}
            </MonoButton>
          </div>
        </div>
      </div>
    );
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
                {getText(lang, 'charts.slots')}: {accessibleChartCount} / {chartSlots}
                {lockedChartCount > 0 && canPromotePremium && !hasPremiumAccess
                  ? ` · ${lockedChartCount} ${lang === 'ru' ? 'сохранено с Premium' : 'saved with Premium'}`
                  : ''}
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
                    <MonoButton fullWidth onClick={() => onRequestPremium?.('charts', {
                      placement: 'saved_people',
                      featureKey: 'saved_people',
                      triggerType: 'locked_feature',
                      returnView: 'charts',
                      returnAction: 'add_saved_person',
                    })}>{getText(lang, 'charts.premium_slots_cta')}</MonoButton>
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
              aria-label={lang === 'ru' ? 'Поиск карт по имени или месту' : 'Search charts by name or place'}
            />
          </MonoStaggerItem>

          <MonoStaggerItem>
            <MonoSegment
              value={listFilter}
              onChange={setListFilter}
              options={filterOptions}
              ariaLabel={lang === 'ru' ? 'Фильтр списка карт' : 'Chart list filter'}
            />
          </MonoStaggerItem>
        </MonoStagger>

        {loadError ? (
          <div role="alert" className="rounded-mono-card border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p>{loadError}</p>
            <button type="button" className="mt-2 min-h-[44px] font-semibold underline underline-offset-4" onClick={() => { void reloadAndResume(); }}>
              {lang === 'ru' ? 'Повторить' : 'Try again'}
            </button>
          </div>
        ) : null}

        {addError ? (
          <div id="charts-add-error" role="alert" className="rounded-mono-card border border-red-200 bg-red-50 p-3 text-sm text-red-700">{addError}</div>
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
              const isPrimary = isSelfChart(chart);
              const isLocked = isChartEffectivelyLocked(chart);
              const isBusy = actionLoading === `delete-${chart.id}`;
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
                      {isLocked ? (
                        <MonoTag>{canPromotePremium && !hasPremiumAccess ? 'Premium' : (lang === 'ru' ? 'Закрыто' : 'Locked')}</MonoTag>
                      ) : null}
                    </div>
                    <p className={`mt-1 text-[13px] ${isPrimary ? 'text-white/70' : 'text-mono-muted'}`}>
                      {isPrimary
                        ? getText(lang, 'charts.primary_role')
                        : chart.relation_label || getText(lang, 'charts.saved_role')}
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
                        <MonoButton variant={isPrimary ? 'ghost' : 'outline'} className="!min-h-[44px] !px-3 !text-[12px]" onClick={() => handleSelectChart(chart)}>
                          {isLocked
                            ? canPromotePremium && !hasPremiumAccess
                              ? (lang === 'ru' ? 'Открыть с Premium' : 'Unlock with Premium')
                              : hasPremiumAccess
                                ? (lang === 'ru' ? 'Обновить доступ' : 'Refresh access')
                                : (lang === 'ru' ? 'Пока недоступно' : 'Unavailable for now')
                            : getText(lang, 'charts.open_chart')}
                        </MonoButton>
                      ) : null}
                      {!isPrimary && onUseInSynastry && !isLocked ? (
                        <MonoButton variant="outline" className="!min-h-[44px] !px-3 !text-[12px]" onClick={() => onUseInSynastry(chart)}>
                          {getText(lang, 'charts.use_in_synastry')}
                        </MonoButton>
                      ) : null}
                      {!isPrimary ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(chart)}
                          disabled={isBusy}
                          className="min-h-[44px] rounded-mono-pill border border-red-200 px-3 py-2 text-[12px] font-semibold text-red-600 disabled:opacity-50"
                        >
                          {getText(lang, 'charts.delete')}
                        </button>
                      ) : null}
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
            <MonoInput id="chart-person-name" label={getText(lang, 'charts.field_name')} value={addName} onChange={(e) => setAddName(e.target.value)} placeholder={getText(lang, 'charts.default_chart_name')} />
            <MonoInput id="chart-birth-date" label={getText(lang, 'charts.field_birth_date')} type="date" value={addDate} onChange={(e) => { setAddDate(e.target.value); setAddInvalidFields((fields) => fields.filter((field) => field !== 'date')); }} aria-invalid={addInvalidFields.includes('date') || undefined} aria-describedby={addInvalidFields.includes('date') ? 'charts-add-error' : undefined} />
            <MonoInput label={getText(lang, 'charts.field_birth_time')} type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)} />
            <p className="-mt-2 text-[12px] leading-relaxed text-mono-muted">
              {lang === 'ru'
                ? 'Не знаешь точное время — оставь поле пустым. Дома и Асцендент не будут выдаваться за точные.'
                : 'Leave this blank if the exact time is unknown. Houses and Ascendant will not be presented as exact.'}
            </p>
            <MonoInput id="chart-birth-place" label={getText(lang, 'charts.field_birth_place')} value={addPlace} onChange={(e) => { setAddPlace(e.target.value); setAddInvalidFields((fields) => fields.filter((field) => field !== 'place')); }} placeholder={getText(lang, 'charts.field_birth_place_placeholder')} aria-invalid={addInvalidFields.includes('place') || undefined} aria-describedby={addInvalidFields.includes('place') ? 'charts-add-error' : undefined} />
            <MonoInput
              label={lang === 'ru' ? 'Кем этот человек тебе приходится (необязательно)' : 'Relation (optional)'}
              value={addRelation}
              onChange={(e) => setAddRelation(e.target.value)}
              placeholder={lang === 'ru' ? 'Друг, сестра, коллега' : 'Friend, sister, colleague'}
            />
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
