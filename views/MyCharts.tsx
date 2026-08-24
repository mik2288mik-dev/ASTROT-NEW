import React, { useCallback, useEffect, useState } from 'react';
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
import { hasActivePremium, PREMIUM_SAVED_PERSON_LIMIT } from '../lib/accessMatrix';
import { clearLocalHumanBaseReport } from '../lib/localHumanBaseReportCache';
import { getChartSubjectType, isSelfChart } from '../lib/chartAccessPolicy';
import type { PaywallContext } from '../lib/paywallContext';
import {
  MonoButton,
  MonoFadeIn,
  MonoInput,
  MonoStagger,
  MonoStaggerItem,
  MonoTag,
} from '../components/mono-ui';

interface MyChartsProps {
  profile: UserProfile;
  onChartSelect?: (chart: ChartListItem) => void;
  onProfileUpdate?: (profile: UserProfile) => void;
  onUseInSynastry?: (chart: ChartListItem) => void;
  onPrimaryChartUpdated?: () => Promise<void> | void;
  onRequestPremium?: (source?: string, payload?: Record<string, unknown>) => void;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
  canPromotePremium?: boolean;
  uiPreview?: ChartsResponse;
  embedded?: boolean;
}

export const MyCharts: React.FC<MyChartsProps> = ({
  profile,
  onChartSelect,
  onProfileUpdate: _onProfileUpdate,
  onUseInSynastry,
  onPrimaryChartUpdated: _onPrimaryChartUpdated,
  onRequestPremium,
  premiumContinuation,
  onPremiumContinuationHandled,
  canPromotePremium = true,
  uiPreview,
  embedded = false,
}) => {
  const previewData = process.env.NODE_ENV === 'development'
    && process.env.NEXT_PUBLIC_UI_PREVIEW === '1'
      ? uiPreview
      : undefined;

  const [data, setData] = useState<ChartsResponse | null>(previewData ?? null);
  const [loading, setLoading] = useState(!previewData);
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
    if (previewData) {
      setData(previewData);
      setLoading(false);
      return previewData;
    }
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
  }, [lang, previewData, profile.id, profile.premiumEntitlement?.state, profile.premiumEntitlement?.endsAt]);

  useEffect(() => {
    loadCharts();
  }, [loadCharts]);

  const charts = data?.charts ?? [];
  // This value comes from the live server entitlement. Do not offer creation
  // when an older or incomplete response cannot confirm the permission.
  const serverCanAddMore = data?.canAddSavedPeople ?? data?.canAddMore ?? false;
  const chartSlots = data?.chartSlots ?? (profile.chartSlots ?? 1);
  const selfChart = charts.find(isSelfChart) ?? null;
  const savedCharts = charts.filter((chart) => getChartSubjectType(chart) === 'saved_person');
  // The profile carries the latest backend-validated entitlement. A cached
  // chart-list boolean must never outlive its dated canonical snapshot.
  const hasPremiumAccess = hasActivePremium(profile, entitlementNow);
  const canAddMore = hasPremiumAccess && serverCanAddMore;
  const canOpenPremiumFlow = canPromotePremium && Boolean(onRequestPremium);
  const isChartEffectivelyLocked = useCallback((chart: ChartListItem) => (
    chart.access_locked === true
    || (getChartSubjectType(chart) === 'saved_person' && !hasPremiumAccess)
  ), [hasPremiumAccess]);
  const lockedChartCount = savedCharts.filter(isChartEffectivelyLocked).length;
  const showPremiumSlotsCta = canOpenPremiumFlow && !canAddMore && !hasPremiumAccess;

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

    const msg = lang === 'ru'
      ? `Убрать «${chart.name}» из сохранённых карт?`
      : `Remove “${chart.name}” from saved charts?`;
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
      if (!canOpenPremiumFlow) return;
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

  const renderChartCard = (chart: ChartListItem) => {
    const sunSign = chart.chart_data?.sun?.sign;
    const signLabel = sunSign ? getZodiacSign(lang, sunSign) : null;
    const isPrimary = isSelfChart(chart);
    const isLocked = isChartEffectivelyLocked(chart);
    const isBusy = actionLoading === `delete-${chart.id}`;
    const formattedBirthDate = formatDisplayDate(chart.birth_date, lang) || chart.birth_date;
    const canOpenChart = Boolean(onChartSelect) && (!isLocked || hasPremiumAccess || canOpenPremiumFlow);
    const cardText = isPrimary ? 'text-white' : 'text-mono-ink';
    const mutedText = isPrimary ? 'text-white/70' : 'text-mono-muted';

    return (
      <article
        key={chart.id}
        className={`rounded-mono-card border p-4 sm:p-5 ${
          isPrimary ? 'border-mono-ink bg-mono-black' : 'border-mono-line bg-mono-white'
        }`}
      >
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className={`break-words text-[18px] font-bold leading-snug ${cardText}`} title={chart.name}>
              {chart.name}
            </h3>
            <p className={`mt-1 text-[13px] leading-relaxed ${mutedText}`}>
              {isPrimary
                ? getText(lang, 'charts.primary_role')
                : chart.relation_label || getText(lang, 'charts.saved_role')}
            </p>
          </div>
          {isPrimary ? (
            <MonoTag dark className="!bg-white/15">{lang === 'ru' ? 'Моя карта' : 'My chart'}</MonoTag>
          ) : isLocked ? (
            <MonoTag>Premium</MonoTag>
          ) : null}
        </div>

        <dl className={`mt-4 grid gap-3 text-[13px] leading-relaxed sm:grid-cols-3 ${mutedText}`}>
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-70">
              {lang === 'ru' ? 'Дата рождения' : 'Birth date'}
            </dt>
            <dd className={`mt-0.5 break-words font-medium ${cardText}`}>
              <time dateTime={chart.birth_date}>{formattedBirthDate}</time>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-70">
              {lang === 'ru' ? 'Место' : 'Place'}
            </dt>
            <dd className={`mt-0.5 break-words font-medium ${cardText}`} title={chart.birth_place}>
              {chart.birth_place || (lang === 'ru' ? 'Не указано' : 'Not specified')}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] opacity-70">
              {lang === 'ru' ? 'Время рождения' : 'Birth time'}
            </dt>
            <dd className={`mt-0.5 break-words font-medium ${cardText}`}>
              {chart.birth_time || (lang === 'ru' ? 'Не указано' : 'Not specified')}
            </dd>
          </div>
        </dl>

        {signLabel ? (
          <p className={`mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${mutedText}`}>
            <PlanetIcon planet="sun" size={11} stroke="currentColor" />
            <span>{signLabel}</span>
          </p>
        ) : null}

        {isLocked ? (
          <p className="mt-4 rounded-mono-card bg-mono-plate px-3 py-2 text-[13px] leading-relaxed text-mono-muted" role="status">
            {lang === 'ru'
              ? 'Карта сохранена. Открытие и совместимость вернутся после подключения Premium.'
              : 'This chart is saved. Reading and compatibility return with Premium.'}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {canOpenChart ? (
            <MonoButton
              variant={isPrimary ? 'ghost' : 'outline'}
              className="!min-h-[44px] !px-3 !text-[13px]"
              onClick={() => handleSelectChart(chart)}
            >
              {isLocked
                ? hasPremiumAccess
                  ? (lang === 'ru' ? 'Обновить доступ' : 'Refresh access')
                  : (lang === 'ru' ? 'Открыть с Premium' : 'Unlock with Premium')
                : getText(lang, 'charts.open_chart')}
            </MonoButton>
          ) : null}
          {!isPrimary && onUseInSynastry && !isLocked ? (
            <MonoButton
              variant="outline"
              className="!min-h-[44px] !px-3 !text-[13px]"
              onClick={() => onUseInSynastry(chart)}
            >
              {getText(lang, 'charts.use_in_synastry')}
            </MonoButton>
          ) : null}
          {!isPrimary ? (
            <button
              type="button"
              onClick={() => { void handleDelete(chart); }}
              disabled={isBusy}
              className="min-h-[44px] rounded-mono-pill border border-red-200 px-3 py-2 text-[13px] font-semibold text-red-700 transition-opacity hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50"
            >
              {isBusy
                ? (lang === 'ru' ? 'Убираем…' : 'Removing…')
                : (lang === 'ru' ? 'Убрать' : 'Remove')}
            </button>
          ) : null}
        </div>
      </article>
    );
  };

  if (loading) {
    return <Loading message={getText(lang, 'charts.loading')} />;
  }

  if (!data && loadError) {
    return (
      <main className="fresh-page charts-editorial-page">
        <div className="mx-auto max-w-2xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          <div role="alert" className="fresh-card space-y-3 p-5">
            <p className="text-[14px] leading-relaxed text-red-700">{loadError}</p>
            <MonoButton fullWidth onClick={() => { void reloadAndResume(); }}>
              {lang === 'ru' ? 'Повторить' : 'Try again'}
            </MonoButton>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`fresh-page charts-editorial-page${embedded ? ' charts-editorial-page--embedded' : ''}`}>
      <div className={`mx-auto max-w-2xl px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] ${embedded ? 'space-y-5' : 'space-y-7'}`}>
        {!embedded ? (
          <MonoStagger>
            <MonoStaggerItem>
              <header className="fresh-card p-5 sm:p-6">
                <h1 className="text-[25px] font-bold tracking-[-0.02em] text-mono-ink">
                  {getText(lang, 'charts.title')}
                </h1>
                <p className="mt-2 text-[14px] leading-relaxed text-mono-muted">
                  {lang === 'ru'
                    ? 'Твоя карта доступна всегда. Карты других людей сохраняются и открываются с Premium.'
                    : 'Your chart is always available. Other people’s charts are saved and unlocked with Premium.'}
                </p>
                {canAddMore ? (
                  <MonoButton className="mt-5" fullWidth onClick={() => { setAddError(null); setShowAddForm(true); }}>
                    + {getText(lang, 'charts.add_chart')}
                  </MonoButton>
                ) : null}
              </header>
            </MonoStaggerItem>
          </MonoStagger>
        ) : canAddMore ? (
          <MonoButton fullWidth onClick={() => { setAddError(null); setShowAddForm(true); }}>
            + {getText(lang, 'charts.add_chart')}
          </MonoButton>
        ) : null}

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

        {showAddForm ? (
          <MonoFadeIn className="space-y-4 fresh-card p-5">
            <h2 id="new-chart-heading" className="text-[18px] font-bold text-mono-ink">{getText(lang, 'charts.add_form_title')}</h2>
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

        <section aria-labelledby="my-chart-heading" className="space-y-3">
          <div>
            <h2 id="my-chart-heading" className="text-[18px] font-bold text-mono-ink">
              {lang === 'ru' ? 'Моя карта' : 'My chart'}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-mono-muted">
              {lang === 'ru' ? 'Это основная личная карта. Её нельзя заменить картой другого человека.' : 'This is your main personal chart. A saved person cannot replace it.'}
            </p>
          </div>
          {selfChart ? renderChartCard(selfChart) : (
            <div className="fresh-card p-5">
              <p className="text-[15px] font-semibold text-mono-ink">
                {lang === 'ru' ? 'Личная карта пока не загрузилась' : 'Your personal chart has not loaded yet'}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-mono-muted">
                {lang === 'ru' ? 'Обнови экран и попробуй снова.' : 'Refresh this screen and try again.'}
              </p>
              <MonoButton className="mt-4" variant="outline" onClick={() => { void reloadAndResume(); }}>
                {lang === 'ru' ? 'Обновить' : 'Refresh'}
              </MonoButton>
            </div>
          )}
        </section>

        <section aria-labelledby="saved-charts-heading" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="saved-charts-heading" className="text-[18px] font-bold text-mono-ink">
                {lang === 'ru' ? 'Сохранённые люди' : 'Saved people'}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-mono-muted">
                {hasPremiumAccess
                  ? (lang === 'ru' ? `Сохранено ${savedCharts.length} из ${PREMIUM_SAVED_PERSON_LIMIT}` : `${savedCharts.length} of ${PREMIUM_SAVED_PERSON_LIMIT} saved`)
                  : (lang === 'ru' ? `С Premium — до ${PREMIUM_SAVED_PERSON_LIMIT} дополнительных карт` : `Premium includes up to ${PREMIUM_SAVED_PERSON_LIMIT} additional charts`)}
              </p>
            </div>
            {lockedChartCount > 0 ? (
              <MonoTag>{lang === 'ru' ? `Заблокировано: ${lockedChartCount}` : `Locked: ${lockedChartCount}`}</MonoTag>
            ) : null}
          </div>

          {savedCharts.length > 0 ? (
            <MonoStagger className="space-y-3">
              {savedCharts.map((chart) => <MonoStaggerItem key={chart.id}>{renderChartCard(chart)}</MonoStaggerItem>)}
            </MonoStagger>
          ) : (
            <div className="fresh-card p-5">
              <p className="text-[15px] font-semibold text-mono-ink">
                {lang === 'ru' ? 'Сохранённых карт пока нет' : 'No saved charts yet'}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-mono-muted">
                {hasPremiumAccess
                  ? (lang === 'ru' ? 'Добавь карту близкого человека для чтения или совместимости.' : 'Add someone close for a reading or compatibility.')
                  : (lang === 'ru' ? 'Сохранённые карты станут доступны после подключения Premium.' : 'Saved charts become available with Premium.')}
              </p>
            </div>
          )}

          {!hasPremiumAccess ? (
            <aside className="fresh-card fresh-card--flat space-y-3 p-4" aria-label={lang === 'ru' ? 'Доступ к сохранённым картам' : 'Saved charts access'}>
              <p className="text-[14px] font-semibold text-mono-ink">
                {lang === 'ru' ? 'Сохранённые карты доступны с Premium' : 'Saved charts are available with Premium'}
              </p>
              <p className="text-[13px] leading-relaxed text-mono-muted">
                {lockedChartCount > 0
                  ? (lang === 'ru' ? 'Эти карты не удалены: они снова откроются после подключения Premium.' : 'These charts are not deleted: they unlock again with Premium.')
                  : (lang === 'ru' ? `Можно сохранить до ${PREMIUM_SAVED_PERSON_LIMIT} дополнительных карт.` : `You can save up to ${PREMIUM_SAVED_PERSON_LIMIT} additional charts.`)}
              </p>
              {showPremiumSlotsCta ? (
                <MonoButton fullWidth onClick={() => onRequestPremium?.('charts', {
                  placement: 'saved_people',
                  featureKey: 'saved_people',
                  triggerType: 'locked_feature',
                  returnView: 'charts',
                  returnAction: 'add_saved_person',
                })}>{getText(lang, 'charts.premium_slots_cta')}</MonoButton>
              ) : null}
            </aside>
          ) : !canAddMore ? (
            <aside className="fresh-card fresh-card--flat p-4">
              <p className="text-[14px] font-semibold text-mono-ink">
                {lang === 'ru' ? 'Лимит сохранённых карт достигнут' : 'Saved chart limit reached'}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-mono-muted">
                {lang === 'ru' ? `В текущем доступе можно хранить до ${chartSlots - 1} дополнительных карт.` : `Your current access allows up to ${chartSlots - 1} additional charts.`}
              </p>
            </aside>
          ) : null}
        </section>
      </div>
    </main>
  );
};
