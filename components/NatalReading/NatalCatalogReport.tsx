import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NatalChartData, UserProfile } from '../../types';
import type { ChartListItem } from '../../services/storageService';
import type { PaywallContext } from '../../lib/paywallContext';
import { hasActivePremium } from '../../lib/accessMatrix';
import { buildNatalChartFingerprint } from '../../lib/natalChartFingerprint';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import {
  NATAL_REPORT_ANSWER_COUNT,
  NATAL_REPORT_CATEGORIES,
  NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  getNatalReportAnswer,
  getNatalReportCategory,
  isNatalReportAnswerFree,
  type NatalReportAnswer,
  type NatalReportAnswerKey,
  type NatalReportCategoryKey,
  type NatalReportCategoryPack,
} from '../../lib/natalReading/reportCatalog';
import {
  ensureNatalCatalogAnswer,
  ensureNatalCatalogCategory,
  getNatalCatalogAnswerCached,
  getNatalCatalogCategoryCached,
} from '../../services/natalCatalogService';
import { recordUserAppEvent } from '../../services/sessionService';
import { NatalMeaningExperience } from './NatalMeaningExperience';

const DEFAULT_CATEGORY = 'main' as NatalReportCategoryKey;
const DEFAULT_EXPLORE_CATEGORY = 'character' as NatalReportCategoryKey;

type OpenSource = 'section_grid' | 'continue' | 'history' | 'related_question' | 'paywall_return';

export type NatalCatalogReportUiPreview = {
  state?: 'ready' | 'loading' | 'error';
  initialCategory?: NatalReportCategoryKey;
  initialAnswerKey?: NatalReportAnswerKey;
  categoryPacks: Partial<Record<NatalReportCategoryKey, NatalReportCategoryPack>>;
  answers: Partial<Record<NatalReportAnswerKey, NatalReportAnswer>>;
};

type Props = {
  profile: UserProfile;
  chartData: NatalChartData;
  chartId?: number;
  chartSubject?: ChartListItem | null;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
  canPromotePremium?: boolean;
  onOpenQuestions?: (categoryKey?: NatalReportCategoryKey) => void;
  onOpenExplore?: (categoryKey: NatalReportCategoryKey) => void;
  onMainReady?: () => void;
  onMainUnavailable?: (error: unknown) => void;
  displayMode?: 'foundation' | 'explore';
  requestedCategory?: NatalReportCategoryKey;
  hideIntro?: boolean;
  uiPreview?: NatalCatalogReportUiPreview;
};

function formatLoadError(error: unknown, language: 'ru' | 'en'): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  if (code === 'PREMIUM_REQUIRED') {
    return language === 'ru'
      ? 'Этот ответ пока закрыт.'
      : 'This answer is not open yet.';
  }
  return language === 'ru'
    ? 'Не получилось открыть ответ. Попробуй ещё раз.'
    : 'The answer did not open. Try again.';
}

function selectPreview(
  categoryPacks: Partial<Record<NatalReportCategoryKey, NatalReportCategoryPack>>,
  answerKey: NatalReportAnswerKey,
  preferredCategory: NatalReportCategoryKey,
): NatalReportCategoryPack['previews'][number] | null {
  const definition = getNatalReportAnswer(answerKey);
  const priority = [preferredCategory, definition?.categoryKey]
    .filter((categoryKey, index, values): categoryKey is NatalReportCategoryKey => (
      categoryKey != null && values.indexOf(categoryKey) === index
    ));
  for (const categoryKey of priority) {
    const preview = categoryPacks[categoryKey]?.previews.find(
      (item) => item.answerKey === answerKey,
    );
    if (preview) return preview;
  }
  return Object.values(categoryPacks)
    .flatMap((pack) => pack?.previews || [])
    .find((preview) => preview.answerKey === answerKey) || null;
}

function categoryForMode(
  mode: 'foundation' | 'explore',
  requestedCategory: NatalReportCategoryKey | undefined,
  current: NatalReportCategoryKey,
): NatalReportCategoryKey {
  if (mode === 'foundation') return DEFAULT_CATEGORY;
  if (requestedCategory && requestedCategory !== DEFAULT_CATEGORY) return requestedCategory;
  return current === DEFAULT_CATEGORY ? DEFAULT_EXPLORE_CATEGORY : current;
}

export const NatalCatalogReport: React.FC<Props> = ({
  profile,
  chartData,
  chartId,
  chartSubject: _chartSubject,
  requestPremium,
  premiumContinuation,
  onPremiumContinuationHandled,
  canPromotePremium = true,
  onOpenQuestions,
  onOpenExplore,
  onMainReady,
  onMainUnavailable,
  displayMode = 'foundation',
  requestedCategory,
  hideIntro: _hideIntro = false,
  uiPreview,
}) => {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const userId = profile.id ? String(profile.id) : '';
  const isPremium = hasActivePremium(profile);
  const previewFixture = process.env.NODE_ENV === 'development'
    && process.env.NEXT_PUBLIC_UI_PREVIEW === '1'
      ? uiPreview
      : undefined;
  const cacheIdentity = useMemo(() => ({
    chartFingerprint: buildNatalChartFingerprint(chartData),
    reportVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  }), [chartData]);
  const reportIdentity = `${userId}:${chartId ?? 'primary'}:${cacheIdentity.chartFingerprint}`;
  const handledContinuationRef = useRef('');
  const firstResultIdentityRef = useRef('');

  const [activeCategory, setActiveCategory] = useState<NatalReportCategoryKey>(() => (
    categoryForMode(
      displayMode,
      requestedCategory || previewFixture?.initialCategory,
      previewFixture?.initialCategory || DEFAULT_CATEGORY,
    )
  ));
  const [categoryPacks, setCategoryPacks] = useState<
    Partial<Record<NatalReportCategoryKey, NatalReportCategoryPack>>
  >(() => (
    previewFixture?.state === 'ready' || !previewFixture?.state
      ? previewFixture?.categoryPacks || {}
      : {}
  ));
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryRetryToken, setCategoryRetryToken] = useState(0);
  const [selectedAnswerKey, setSelectedAnswerKey] = useState<NatalReportAnswerKey | null>(
    previewFixture?.initialAnswerKey || null,
  );
  const [answers, setAnswers] = useState<
    Partial<Record<NatalReportAnswerKey, NatalReportAnswer>>
  >(() => (
    previewFixture?.state === 'ready' || !previewFixture?.state
      ? previewFixture?.answers || {}
      : {}
  ));
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [answerRetryToken, setAnswerRetryToken] = useState(0);

  const activeCategoryPack = categoryPacks[activeCategory] || null;
  const selectedAnswer = selectedAnswerKey ? answers[selectedAnswerKey] || null : null;
  const selectedPreview = useMemo(
    () => selectedAnswerKey
      ? selectPreview(categoryPacks, selectedAnswerKey, activeCategory)
      : null,
    [activeCategory, categoryPacks, selectedAnswerKey],
  );

  useEffect(() => {
    const next = categoryForMode(displayMode, requestedCategory, activeCategory);
    if (next === activeCategory) return;
    setSelectedAnswerKey(null);
    setAnswerError(null);
    setActiveCategory(next);
  }, [activeCategory, displayMode, requestedCategory]);

  useEffect(() => {
    setSelectedAnswerKey(previewFixture?.initialAnswerKey || null);
    setAnswerError(null);
    setCategoryError(null);
  }, [previewFixture?.initialAnswerKey, reportIdentity]);

  useEffect(() => {
    if (previewFixture) {
      const state = previewFixture.state || 'ready';
      setCategoryPacks(state === 'ready' ? previewFixture.categoryPacks : {});
      setAnswers(state === 'ready' ? previewFixture.answers : {});
      setCategoryLoading(state === 'loading');
      setCategoryError(state === 'error'
        ? language === 'ru' ? 'Не получилось открыть разбор.' : 'The reading did not open.'
        : null);
      if (activeCategory === DEFAULT_CATEGORY) {
        if (state === 'ready' && previewFixture.categoryPacks[DEFAULT_CATEGORY]) {
          onMainReady?.();
        } else if (state === 'error') {
          onMainUnavailable?.(new Error('NATAL_REPORT_CATEGORY_PREVIEW_FAILED'));
        }
      }
      return;
    }

    if (!userId) {
      const error = new Error('NATAL_REPORT_USER_REQUIRED');
      setCategoryLoading(false);
      setCategoryError(language === 'ru'
        ? 'Не получилось открыть разбор. Войди ещё раз.'
        : 'The reading did not open. Sign in again.');
      if (activeCategory === DEFAULT_CATEGORY) onMainUnavailable?.(error);
      return;
    }

    let cancelled = false;
    const cached = getNatalCatalogCategoryCached(
      userId,
      activeCategory,
      chartId,
      language,
      cacheIdentity,
    );
    if (cached) {
      setCategoryPacks((current) => ({ ...current, [activeCategory]: cached }));
      setAnswers((current) => ({
        ...current,
        ...Object.fromEntries(
          cached.freeAnswers.map((answer) => [answer.answerKey, answer]),
        ),
      }));
      if (activeCategory === DEFAULT_CATEGORY) onMainReady?.();
    }
    setCategoryLoading(!cached);
    setCategoryError(null);

    void ensureNatalCatalogCategory(
      userId,
      activeCategory,
      chartId,
      language,
      cacheIdentity,
    )
      .then((next) => {
        if (cancelled) return;
        setCategoryPacks((current) => ({ ...current, [activeCategory]: next }));
        setAnswers((current) => ({
          ...current,
          ...Object.fromEntries(
            next.freeAnswers.map((answer) => [answer.answerKey, answer]),
          ),
        }));
        if (activeCategory === DEFAULT_CATEGORY) onMainReady?.();
      })
      .catch((loadError) => {
        if (cancelled || cached) return;
        setCategoryError(formatLoadError(loadError, language));
        if (activeCategory === DEFAULT_CATEGORY) onMainUnavailable?.(loadError);
      })
      .finally(() => {
        if (!cancelled) setCategoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeCategory,
    cacheIdentity,
    categoryRetryToken,
    chartId,
    language,
    onMainReady,
    onMainUnavailable,
    previewFixture,
    userId,
  ]);

  useEffect(() => {
    if (previewFixture) {
      if (!selectedAnswerKey) {
        setAnswerLoading(false);
        setAnswerError(null);
        return;
      }
      const state = previewFixture.state || 'ready';
      setAnswerLoading(state === 'loading');
      setAnswerError(state === 'error'
        ? language === 'ru' ? 'Не получилось открыть ответ.' : 'The answer did not open.'
        : null);
      return;
    }

    if (!selectedAnswerKey || !userId) {
      setAnswerLoading(false);
      setAnswerError(null);
      return;
    }

    const definition = getNatalReportAnswer(selectedAnswerKey);
    if (!definition) {
      setAnswerLoading(false);
      setAnswerError(null);
      return;
    }

    const canRead = isPremium || isNatalReportAnswerFree(selectedAnswerKey);
    if (!canRead) {
      setAnswerLoading(false);
      setAnswerError(null);
      return;
    }

    const bundledAnswer = Object.values(categoryPacks)
      .flatMap((pack) => pack?.freeAnswers || [])
      .find((answer) => answer.answerKey === selectedAnswerKey) || null;
    if (bundledAnswer) {
      setAnswers((current) => ({ ...current, [selectedAnswerKey]: bundledAnswer }));
      setAnswerLoading(false);
      setAnswerError(null);
      return;
    }

    const owningPack = categoryPacks[definition.categoryKey] || null;
    if (isNatalReportAnswerFree(selectedAnswerKey) && !owningPack) {
      const cachedPack = getNatalCatalogCategoryCached(
        userId,
        definition.categoryKey,
        chartId,
        language,
        cacheIdentity,
      );
      if (cachedPack) {
        setCategoryPacks((current) => ({
          ...current,
          [definition.categoryKey]: cachedPack,
        }));
        setAnswers((current) => ({
          ...current,
          ...Object.fromEntries(
            cachedPack.freeAnswers.map((answer) => [answer.answerKey, answer]),
          ),
        }));
        setAnswerLoading(false);
        setAnswerError(null);
        return;
      }

      let cancelled = false;
      setAnswerLoading(true);
      setAnswerError(null);
      void ensureNatalCatalogCategory(
        userId,
        definition.categoryKey,
        chartId,
        language,
        cacheIdentity,
      )
        .then((next) => {
          if (cancelled) return;
          setCategoryPacks((current) => ({
            ...current,
            [definition.categoryKey]: next,
          }));
          setAnswers((current) => ({
            ...current,
            ...Object.fromEntries(
              next.freeAnswers.map((answer) => [answer.answerKey, answer]),
            ),
          }));
        })
        .catch((loadError) => {
          if (!cancelled) setAnswerError(formatLoadError(loadError, language));
        })
        .finally(() => {
          if (!cancelled) setAnswerLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    const cached = getNatalCatalogAnswerCached(
      userId,
      selectedAnswerKey,
      isPremium,
      chartId,
      language,
      cacheIdentity,
    );
    if (cached) {
      setAnswers((current) => ({ ...current, [selectedAnswerKey]: cached }));
    }
    setAnswerLoading(!cached);
    setAnswerError(null);

    void ensureNatalCatalogAnswer(
      userId,
      selectedAnswerKey,
      isPremium,
      chartId,
      language,
      cacheIdentity,
    )
      .then((next) => {
        if (!cancelled) {
          setAnswers((current) => ({ ...current, [selectedAnswerKey]: next }));
        }
      })
      .catch((loadError) => {
        if (!cancelled && !cached) {
          setAnswerError(formatLoadError(loadError, language));
        }
      })
      .finally(() => {
        if (!cancelled) setAnswerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    answerRetryToken,
    cacheIdentity,
    categoryPacks,
    chartId,
    isPremium,
    language,
    previewFixture,
    selectedAnswerKey,
    userId,
  ]);

  const closeAnswer = useCallback(() => {
    setSelectedAnswerKey(null);
    setAnswerError(null);
  }, []);

  useEffect(() => {
    if (!selectedAnswerKey) return;
    const handleNativeBack = (event: Event) => {
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail?.handled) return;
      if (detail) detail.handled = true;
      closeAnswer();
    };
    window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack);
    return () => window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack);
  }, [closeAnswer, selectedAnswerKey]);

  const openAnswer = useCallback((answerKey: NatalReportAnswerKey, source: OpenSource) => {
    const definition = getNatalReportAnswer(answerKey);
    if (!definition) return;
    setSelectedAnswerKey(answerKey);
    setAnswerLoading(
      (isPremium || isNatalReportAnswerFree(answerKey))
      && !answers[answerKey],
    );
    setAnswerError(null);
    if (!previewFixture) {
      void recordUserAppEvent({
        eventType: 'natal_section_open',
        section: 'natal',
        source: 'deep_natal',
        eventPayload: {
          section_key: answerKey,
          access_state: isNatalReportAnswerFree(answerKey)
            ? 'open'
            : isPremium ? 'premium' : 'locked',
          source,
        },
      });
    }
  }, [answers, isPremium, previewFixture]);

  useEffect(() => {
    if (
      !isPremium
      || !premiumContinuation
      || premiumContinuation.returnView !== 'chart'
      || premiumContinuation.featureKey !== 'natal_deep'
      || premiumContinuation.returnAction !== 'open_natal_answer'
      || handledContinuationRef.current === premiumContinuation.paywallInstanceId
    ) return;
    const answerKey = premiumContinuation.returnEntityId as NatalReportAnswerKey | null;
    if (!answerKey || !getNatalReportAnswer(answerKey)) return;
    handledContinuationRef.current = premiumContinuation.paywallInstanceId;
    openAnswer(answerKey, 'paywall_return');
    onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
  }, [
    isPremium,
    onPremiumContinuationHandled,
    openAnswer,
    premiumContinuation,
  ]);

  useEffect(() => {
    const mainPack = categoryPacks[DEFAULT_CATEGORY];
    if (!mainPack || previewFixture) return;
    const eventIdentity = `${reportIdentity}:${mainPack.contractVersion}`;
    if (firstResultIdentityRef.current === eventIdentity) return;
    firstResultIdentityRef.current = eventIdentity;
    void recordUserAppEvent({
      eventType: 'first_result_ready',
      section: 'natal',
      source: 'natal_report',
      eventPayload: {
        result_type: 'natal_report',
        open_section_count: NATAL_REPORT_CATEGORIES.reduce(
          (count, category) => count
            + category.answerKeys.filter(isNatalReportAnswerFree).length,
          0,
        ),
        total_section_count: NATAL_REPORT_ANSWER_COUNT,
        source: 'natal_meaning_map',
      },
    });
  }, [categoryPacks, previewFixture, reportIdentity]);

  const selectCategory = useCallback((categoryKey: NatalReportCategoryKey) => {
    if (!getNatalReportCategory(categoryKey)) return;
    setSelectedAnswerKey(null);
    setAnswerError(null);
    setCategoryError(null);
    setActiveCategory(categoryKey);
  }, []);

  const requestAnswerAccess = useCallback((answerKey: NatalReportAnswerKey) => {
    void requestPremium('deep_natal', {
      placement: 'deep_natal',
      featureKey: 'natal_deep',
      triggerType: 'locked_feature',
      returnView: 'chart',
      returnScrollAnchor: `natal-answer-${answerKey}`,
      returnAction: 'open_natal_answer',
      returnEntityId: answerKey,
    });
  }, [requestPremium]);

  return (
    <NatalMeaningExperience
      mode={displayMode}
      language={language}
      profile={profile}
      chartData={chartData}
      categoryKey={activeCategory}
      categoryPack={activeCategoryPack}
      categoryLoading={categoryLoading}
      categoryError={categoryError}
      selectedAnswerKey={selectedAnswerKey}
      selectedPreview={selectedPreview}
      selectedAnswer={selectedAnswer}
      answerLoading={answerLoading}
      answerError={answerError}
      isPremium={isPremium}
      canPromoteAccess={canPromotePremium || !isPremium}
      onSelectCategory={selectCategory}
      onOpenExplore={(categoryKey) => {
        selectCategory(categoryKey);
        onOpenExplore?.(categoryKey);
      }}
      onOpenAnswer={openAnswer}
      onCloseAnswer={closeAnswer}
      onRetryCategory={() => setCategoryRetryToken((value) => value + 1)}
      onRetryAnswer={() => setAnswerRetryToken((value) => value + 1)}
      onRequestAccess={requestAnswerAccess}
      onOpenQuestions={onOpenQuestions}
    />
  );
};
