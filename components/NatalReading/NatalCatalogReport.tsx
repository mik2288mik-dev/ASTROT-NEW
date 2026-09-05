import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NatalChartData, UserProfile } from '../../types';
import { getCharts, type ChartListItem } from '../../services/storageService';
import type { PaywallContext } from '../../lib/paywallContext';
import { getProfilePremiumUntil, hasActivePremium } from '../../lib/accessMatrix';
import { buildNatalChartFingerprint } from '../../lib/natalChartFingerprint';
import {
  NATAL_REPORT_CATALOG_CONTRACT_VERSION, getNatalReportAnswer, getNatalReportCategory,
  type NatalReportAnswer, type NatalReportAnswerKey, type NatalReportCategoryKey, type NatalReportCategoryPack,
} from '../../lib/natalReading/reportCatalog';
import { ensureNatalCatalogCategory, getNatalCatalogCategoryCached } from '../../services/natalCatalogService';
import { recordUserAppEvent } from '../../services/sessionService';
import { NatalMeaningExperience, type NatalExperienceView } from './NatalMeaningExperience';

export type NatalCatalogReportUiPreview = {
  state?: 'ready' | 'loading' | 'error';
  initialCategory?: NatalReportCategoryKey;
  initialAnswerKey?: NatalReportAnswerKey;
  categoryPacks: Partial<Record<NatalReportCategoryKey, NatalReportCategoryPack>>;
  answers: Partial<Record<NatalReportAnswerKey, NatalReportAnswer>>;
};
type Props = {
  profile: UserProfile; chartData: NatalChartData; chartId?: number; chartSubject?: ChartListItem | null;
  view: NatalExperienceView; onViewChange: (view: NatalExperienceView) => void;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
  canPromotePremium?: boolean;
  onOpenQuestions?: (categoryKey: NatalReportCategoryKey) => void;
  hideIntro?: boolean; uiPreview?: NatalCatalogReportUiPreview;
};
type ReadingState = {
  identity: string;
  category: NatalReportCategoryKey;
  packs: Partial<Record<NatalReportCategoryKey, NatalReportCategoryPack>>;
  loading: boolean;
  error: string | null;
};
type ChartAccessState = { identity: string; status: 'allowed' | 'locked' | 'error'; error: string | null };
function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
}
function readingError(error: unknown, ru: boolean): string {
  if (errorCode(error) === 'CHART_REPAIR_REQUIRED') return ru
    ? 'Сохранённую карту нужно восстановить, прежде чем готовить разбор.'
    : 'The saved chart needs repair before its reading can be prepared.';
  return ru ? 'Разбор не загрузился. Попробуй ещё раз.' : 'The reading did not load. Try again.';
}
export const NatalCatalogReport: React.FC<Props> = ({
  profile, chartData, chartId, chartSubject, view, onViewChange, requestPremium,
  premiumContinuation, onPremiumContinuationHandled, canPromotePremium = true,
  onOpenQuestions, uiPreview,
}) => {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const userId = profile.id ? String(profile.id) : '';
  const [clock, setClock] = useState(Date.now);
  const premiumUntil = getProfilePremiumUntil(profile);
  const isPremium = hasActivePremium(profile, Math.max(clock, Date.now()));
  const entitlementIdentity = JSON.stringify([userId, premiumUntil, profile.premiumEntitlement, profile.isAdmin, isPremium]);
  const [premiumDeniedFor, setPremiumDeniedFor] = useState<string | null>(null);
  const canReadPremium = isPremium && premiumDeniedFor !== entitlementIdentity;
  const preview = process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_UI_PREVIEW === '1' ? uiPreview : undefined;
  const cacheIdentity = useMemo(() => ({
    chartFingerprint: buildNatalChartFingerprint(chartData),
    reportVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  }), [chartData]);
  const identity = `${userId}:${chartId ?? 'primary'}:${language}:${cacheIdentity.chartFingerprint}:${cacheIdentity.reportVersion}`;
  const [chosenCategory, setChosenCategory] = useState<NatalReportCategoryKey>(preview?.initialCategory || 'love');
  const activeCategory = view === 'foundation' ? 'main' : chosenCategory === 'main' ? 'love' : chosenCategory;
  const [retryToken, setRetryToken] = useState(0);
  const [state, setState] = useState<ReadingState>({ identity, category: activeCategory, packs: {}, loading: true, error: null });
  const savedPerson = chartSubject?.subject_type === 'saved_person' || chartSubject?.is_primary === false;
  const selectedChartId = chartSubject?.id ?? chartId;
  const chartAccessIdentity = `${identity}:${entitlementIdentity}`;
  const [chartAccess, setChartAccess] = useState<ChartAccessState | null>(null);
  const matchingChartAccess = chartAccess?.identity === chartAccessIdentity;
  const chartReadable = Boolean(preview) || !savedPerson || (matchingChartAccess && chartAccess.status === 'allowed');
  const resultEventRef = useRef('');
  const continuationRef = useRef('');
  const matchingIdentity = state.identity === identity;
  const matchingRequest = matchingIdentity && state.category === activeCategory;
  const packs = matchingIdentity && chartReadable
    ? canReadPremium ? state.packs : { main: state.packs.main }
    : {};

  useEffect(() => {
    const refreshClock = () => setClock(Date.now());
    const deadline = premiumUntil ? Date.parse(premiumUntil) : NaN;
    const timer = isPremium && Number.isFinite(deadline) && deadline > Date.now()
      ? setTimeout(refreshClock, Math.min(deadline - Date.now() + 1, 2_147_483_647)) : null;
    window.addEventListener('focus', refreshClock);
    document.addEventListener('visibilitychange', refreshClock);
    return () => {
      if (timer !== null) clearTimeout(timer);
      window.removeEventListener('focus', refreshClock);
      document.removeEventListener('visibilitychange', refreshClock);
    };
  }, [clock, isPremium, premiumUntil]);

  useEffect(() => {
    if (preview || !savedPerson) return;
    let cancelled = false;
    setChartAccess(null);
    void getCharts(userId, { repairPrimary: false }).then((result) => {
      if (cancelled) return;
      if (result.isPremium === false && isPremium) setPremiumDeniedFor(entitlementIdentity);
      const selected = result.charts.find((chart) => chart.id === selectedChartId && !chart.archived_at);
      if (!selected) {
        setChartAccess({ identity: chartAccessIdentity, status: 'error', error: readingError(null, language === 'ru') });
      } else if (selected.access_locked) {
        setChartAccess({ identity: chartAccessIdentity, status: 'locked', error: null });
      } else if ('repair_required' in selected && selected.repair_required === true) {
        setChartAccess({ identity: chartAccessIdentity, status: 'error', error: readingError({ code: 'CHART_REPAIR_REQUIRED' }, language === 'ru') });
      } else {
        setChartAccess({ identity: chartAccessIdentity, status: 'allowed', error: null });
      }
    }).catch((error) => {
      if (!cancelled) setChartAccess({ identity: chartAccessIdentity, status: 'error', error: readingError(error, language === 'ru') });
    });
    return () => { cancelled = true; };
  }, [chartAccessIdentity, entitlementIdentity, isPremium, language, preview, retryToken, savedPerson, selectedChartId, userId]);

  useEffect(() => {
    if (preview) {
      setState({ identity, category: activeCategory, packs: preview.state === 'ready' || !preview.state ? preview.categoryPacks : {}, loading: preview.state === 'loading', error: preview.state === 'error' ? readingError(null, language === 'ru') : null });
      return;
    }
    if (!userId) {
      setState({ identity, category: activeCategory, packs: {}, loading: false, error: readingError(null, language === 'ru') });
      return;
    }
    if (!chartReadable) return;
    let cancelled = false;
    const cachedMain = getNatalCatalogCategoryCached(userId, 'main', chartId, language, cacheIdentity, canReadPremium);
    const cachedChapter = activeCategory !== 'main' && canReadPremium
      ? getNatalCatalogCategoryCached(userId, activeCategory, chartId, language, cacheIdentity, canReadPremium) : null;
    setState((current) => ({
      identity, category: activeCategory,
      packs: { ...(current.identity === identity ? current.packs : {}), ...(cachedMain ? { main: cachedMain } : {}), ...(cachedChapter ? { [activeCategory]: cachedChapter } : {}) },
      loading: !(activeCategory === 'main' ? cachedMain : cachedChapter) && (activeCategory === 'main' || canReadPremium),
      error: null,
    }));
    // The free story is the anchor for every continuation. Reuse its saved text.
    void (async () => {
      const main = await ensureNatalCatalogCategory(userId, 'main', chartId, language, cacheIdentity, canReadPremium);
      if (cancelled) return;
      setState((current) => ({ ...current, identity, packs: { ...current.packs, main } }));
      if (activeCategory !== 'main' && canReadPremium) {
        const chapter = await ensureNatalCatalogCategory(userId, activeCategory, chartId, language, cacheIdentity, canReadPremium);
        if (cancelled) return;
        setState((current) => ({ ...current, packs: { ...current.packs, [activeCategory]: chapter } }));
      }
    })().catch((error) => {
      if (cancelled) return;
      const code = errorCode(error);
      if (code === 'PREMIUM_REQUIRED') setPremiumDeniedFor(entitlementIdentity);
      if (code === 'PREMIUM_REQUIRED' && activeCategory === 'main' && savedPerson) {
        setChartAccess({ identity: chartAccessIdentity, status: 'locked', error: null });
      }
      setState((current) => ({
        ...current,
        packs: code === 'CHART_REPAIR_REQUIRED' || code === 'CHART_NOT_FOUND' || code === 'CHART_ACCESS_DENIED' ? {} : current.packs,
        error: readingError(error, language === 'ru'),
      }));
    }).finally(() => {
      if (!cancelled) setState((current) => ({ ...current, loading: false }));
    });
    return () => { cancelled = true; };
  }, [activeCategory, cacheIdentity, canReadPremium, chartAccessIdentity, chartId, chartReadable, entitlementIdentity, identity, language, preview, retryToken, savedPerson, userId]);

  useEffect(() => {
    if (preview || !packs.main || resultEventRef.current === identity) return;
    resultEventRef.current = identity;
    void recordUserAppEvent({ eventType: 'first_result_ready', section: 'natal', source: 'natal_report', eventPayload: { result_type: 'natal_report', open_section_count: 1, total_section_count: 6, source: 'natal_reading' } });
  }, [identity, packs.main, preview]);

  const selectCategory = useCallback((category: NatalReportCategoryKey) => {
    if (!getNatalReportCategory(category)) return;
    setChosenCategory(category);
    onViewChange(category === 'main' ? 'foundation' : 'explore');
  }, [onViewChange]);

  useEffect(() => {
    if (!canReadPremium || !premiumContinuation || premiumContinuation.returnView !== 'chart'
      || premiumContinuation.featureKey !== 'natal_deep'
      || continuationRef.current === premiumContinuation.paywallInstanceId) return;
    const entity = premiumContinuation.returnEntityId;
    const category = premiumContinuation.returnAction === 'open_natal_category'
      ? getNatalReportCategory(entity as NatalReportCategoryKey)?.key
      : premiumContinuation.returnAction === 'open_natal_answer'
        ? getNatalReportAnswer(entity as NatalReportAnswerKey)?.categoryKey : 'love';
    if (!category) return;
    continuationRef.current = premiumContinuation.paywallInstanceId;
    selectCategory(category);
    onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
  }, [canReadPremium, onPremiumContinuationHandled, premiumContinuation, selectCategory]);

  const requestChapterPremium = (category: NatalReportCategoryKey) => {
    void requestPremium('deep_natal', {
      placement: 'deep_natal', featureKey: 'natal_deep', triggerType: 'locked_feature',
      returnView: 'chart', returnScrollAnchor: `natal-chapter-${category}`,
      returnAction: 'open_natal_category', returnEntityId: category,
    });
  };
  if (!chartReadable) {
    const checking = !matchingChartAccess;
    const locked = matchingChartAccess && chartAccess.status === 'locked';
    return <article className="natal-catalog-report natal-catalog-report--v3">
      <section className={checking ? 'natal-v3-reading-loading' : 'natal-v3-reading-error'} role={checking ? 'status' : 'alert'} aria-busy={checking}>
        <p>{checking
          ? language === 'ru' ? 'Загружаем сохранённую карту' : 'Loading the saved chart'
          : locked
            ? language === 'ru' ? 'Эта сохранённая карта доступна с Premium.' : 'This saved chart is available with Premium.'
            : chartAccess?.error}</p>
        {locked && canPromotePremium ? <button type="button" onClick={() => requestChapterPremium(activeCategory)}>{language === 'ru' ? 'Читать с Premium' : 'Read with Premium'}</button> : null}
        {!checking && !locked ? <button type="button" onClick={() => setRetryToken((value) => value + 1)}>{language === 'ru' ? 'Попробовать снова' : 'Try again'}</button> : null}
      </section>
    </article>;
  }
  return (
    <article className="natal-catalog-report natal-catalog-report--v3">
      <NatalMeaningExperience
        profile={profile} chartData={chartData} subjectName={chartSubject?.name || profile.name}
        activeCategoryKey={activeCategory} mainPack={packs.main || null} categoryPack={packs[activeCategory] || null}
        categoryLoading={!matchingRequest || state.loading} categoryError={matchingRequest ? state.error : null}
        isPremium={canReadPremium} canPromotePremium={canPromotePremium}
        onSelectCategory={selectCategory} onRetryCategory={() => setRetryToken((value) => value + 1)}
        onRequestPremium={requestChapterPremium} onOpenQuestions={onOpenQuestions}
      />
    </article>
  );
};
