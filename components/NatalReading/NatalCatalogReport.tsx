import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NatalChartData, UserProfile } from '../../types';
import type { ChartListItem } from '../../services/storageService';
import type { PaywallContext } from '../../lib/paywallContext';
import { hasActivePremium } from '../../lib/accessMatrix';
import { buildNatalChartFingerprint } from '../../lib/natalChartFingerprint';
import { NATIVE_BACK_EVENT, type NativeBackEventDetail } from '../../lib/nativeBack';
import {
  NATAL_REPORT_ANSWER_COUNT,
  NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  NATAL_REPORT_CATEGORIES,
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
import {
  NatalMeaningExperience,
  type NatalExperienceOpenSource,
  type NatalExperienceView,
} from './NatalMeaningExperience';

const DEFAULT_CATEGORY = 'main' as NatalReportCategoryKey;
const DEFAULT_EXPLORE_CATEGORY = 'character' as NatalReportCategoryKey;
const STORAGE_PREFIX = 'nebo:natal-catalog:v2';

type OpenSource = NatalExperienceOpenSource | 'paywall_return';

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
  view: NatalExperienceView;
  onViewChange: (view: NatalExperienceView) => void;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
  canPromotePremium?: boolean;
  onOpenQuestions?: (categoryKey: NatalReportCategoryKey) => void;
  hideIntro?: boolean;
  uiPreview?: NatalCatalogReportUiPreview;
};

function initialCategory(
  view: NatalExperienceView,
  previewCategory?: NatalReportCategoryKey,
): NatalReportCategoryKey {
  if (previewCategory) return previewCategory;
  return view === 'foundation' ? DEFAULT_CATEGORY : DEFAULT_EXPLORE_CATEGORY;
}

function readStoredAnswerKeys(key: string): Set<NatalReportAnswerKey> {
  if (typeof window === 'undefined') return new Set();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((value): value is NatalReportAnswerKey => (
      typeof value === 'string'
      && getNatalReportAnswer(value as NatalReportAnswerKey) != null
    )));
  } catch {
    return new Set();
  }
}

function writeStoredAnswerKeys(key: string, values: ReadonlySet<NatalReportAnswerKey>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...values]));
  } catch {
    // Bookmarks remain available for the current session if storage is blocked.
  }
}

function formatLoadError(error: unknown, language: 'ru' | 'en'): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  if (code === 'PREMIUM_REQUIRED') {
    return language === 'ru'
      ? 'Этот ответ откроется вместе со всей подробной картой.'
      : 'This answer opens with the complete detailed chart.';
  }
  return language === 'ru'
    ? 'Ответ не загрузился. Проверь соединение и попробуй ещё раз.'
    : 'The answer did not load. Check your connection and try again.';
}

function buildStaticDetailCategoryPack(
  categoryKey: NatalReportCategoryKey,
  language: 'ru' | 'en',
  selectedPreview: NatalReportCategoryPack['previews'][number] | null,
): NatalReportCategoryPack | null {
  const category = getNatalReportCategory(categoryKey);
  if (!category) return null;
  return {
    schemaVersion: 'natal-report-category-v1',
    contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
    categoryKey,
    title: category.title[language],
    summary: [],
    observations: [],
    previews: category.answerKeys.flatMap((answerKey) => {
      const definition = getNatalReportAnswer(answerKey);
      if (!definition) return [];
      const loadedPreview = selectedPreview?.answerKey === answerKey ? selectedPreview : null;
      return [{
        answerKey,
        title: loadedPreview?.title || definition.title[language],
        preview: loadedPreview?.preview || '',
        evidenceIds: loadedPreview?.evidenceIds || [],
        access: definition.access,
        related: definition.related,
        fullAnswerIncludes: loadedPreview?.fullAnswerIncludes
          || [...definition.fullAnswerIncludes[language]],
      }];
    }),
    freeAnswers: [],
  };
}

function selectNatalCatalogPreview(
  categoryPacks: Partial<Record<NatalReportCategoryKey, NatalReportCategoryPack>>,
  answerKey: NatalReportAnswerKey,
  primaryCategoryKey: NatalReportCategoryKey,
): NatalReportCategoryPack['previews'][number] | null {
  const definition = getNatalReportAnswer(answerKey);
  const priority = [primaryCategoryKey, definition?.categoryKey]
    .filter((categoryKey, index, values): categoryKey is NatalReportCategoryKey => (
      categoryKey != null && values.indexOf(categoryKey) === index
    ));
  for (const categoryKey of priority) {
    const preview = categoryPacks[categoryKey]?.previews.find((item) => item.answerKey === answerKey);
    if (preview) return preview;
  }
  return Object.values(categoryPacks)
    .flatMap((pack) => pack?.previews || [])
    .find((preview) => preview.answerKey === answerKey) || null;
}

export const NatalCatalogReport: React.FC<Props> = ({
  profile,
  chartData,
  chartId,
  chartSubject,
  view,
  onViewChange,
  requestPremium,
  premiumContinuation,
  onPremiumContinuationHandled,
  canPromotePremium = true,
  onOpenQuestions,
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
  const subjectName = chartSubject?.name || profile.name;
  const cacheIdentity = useMemo(() => ({
    chartFingerprint: buildNatalChartFingerprint(chartData),
    reportVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  }), [chartData]);
  const reportIdentity = `${userId}:${chartId ?? 'primary'}:${cacheIdentity.chartFingerprint}`;
  const storageScope = `${STORAGE_PREFIX}:${reportIdentity}`;

  const [activeCategory, setActiveCategory] = useState<NatalReportCategoryKey>(() => (
    initialCategory(view, previewFixture?.initialCategory)
  ));
  const [categoryPacks, setCategoryPacks] = useState<Partial<Record<NatalReportCategoryKey, NatalReportCategoryPack>>>({});
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryRetryToken, setCategoryRetryToken] = useState(0);
  const [selectedAnswerKey, setSelectedAnswerKey] = useState<NatalReportAnswerKey | null>(
    previewFixture?.initialAnswerKey || null,
  );
  const [answerOriginCategory, setAnswerOriginCategory] = useState<NatalReportCategoryKey | null>(null);
  const [answers, setAnswers] = useState<Partial<Record<NatalReportAnswerKey, NatalReportAnswer>>>({});
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [answerRetryToken, setAnswerRetryToken] = useState(0);
  const [bookmarkedAnswerKeys, setBookmarkedAnswerKeys] = useState<Set<NatalReportAnswerKey>>(new Set());
  const [storageReady, setStorageReady] = useState(false);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const firstResultIdentityRef = useRef('');
  const handledContinuationRef = useRef('');

  const activeCategoryPack = categoryPacks[activeCategory] || null;
  const selectedAnswer = selectedAnswerKey ? answers[selectedAnswerKey] || null : null;
  const selectedPreview = useMemo(() => (
    selectedAnswerKey
      ? selectNatalCatalogPreview(
          categoryPacks,
          selectedAnswerKey,
          answerOriginCategory || activeCategory,
        )
      : null
  ), [activeCategory, answerOriginCategory, categoryPacks, selectedAnswerKey]);
  const selectedDefinition = selectedAnswerKey ? getNatalReportAnswer(selectedAnswerKey) : null;
  const detailCategoryPack = useMemo(() => {
    if (!selectedDefinition) return null;
    return categoryPacks[selectedDefinition.categoryKey]
      || buildStaticDetailCategoryPack(selectedDefinition.categoryKey, language, selectedPreview);
  }, [categoryPacks, language, selectedDefinition, selectedPreview]);

  useEffect(() => {
    setStorageReady(false);
    setActiveCategory(initialCategory(view, previewFixture?.initialCategory));
    setSelectedAnswerKey(previewFixture?.initialAnswerKey || null);
    setAnswerOriginCategory(null);
    setCategoryPacks(previewFixture?.state === 'ready' || !previewFixture?.state
      ? previewFixture?.categoryPacks || {}
      : {});
    setAnswers(previewFixture?.state === 'ready' || !previewFixture?.state
      ? previewFixture?.answers || {}
      : {});
    setBookmarkedAnswerKeys(readStoredAnswerKeys(`${storageScope}:bookmarks`));
    setStorageReady(true);
  }, [previewFixture, reportIdentity, storageScope]);

  useEffect(() => {
    if (!storageReady) return;
    writeStoredAnswerKeys(`${storageScope}:bookmarks`, bookmarkedAnswerKeys);
  }, [bookmarkedAnswerKeys, storageReady, storageScope]);

  useEffect(() => {
    const desiredCategory = view === 'foundation'
      ? DEFAULT_CATEGORY
      : activeCategory === DEFAULT_CATEGORY
        ? DEFAULT_EXPLORE_CATEGORY
        : activeCategory;
    if (desiredCategory !== activeCategory) {
      setActiveCategory(desiredCategory);
      setCategoryError(null);
    }
    setSelectedAnswerKey(null);
    setAnswerOriginCategory(null);
    setAnswerError(null);
  }, [view]);

  useEffect(() => {
    if (previewFixture) {
      const previewState = previewFixture.state || 'ready';
      setCategoryPacks(previewState === 'ready' ? previewFixture.categoryPacks : {});
      setAnswers(previewState === 'ready' ? previewFixture.answers : {});
      setCategoryLoading(previewState === 'loading');
      setCategoryError(previewState === 'error'
        ? language === 'ru'
          ? 'Разбор не загрузился. Нажми «Попробовать снова».'
          : 'The reading did not load. Try again.'
        : null);
      return;
    }
    if (!userId) {
      setCategoryLoading(false);
      setCategoryError(language === 'ru'
        ? 'Разбор не открылся. Вернись к карте и попробуй ещё раз.'
        : 'The reading did not open. Return to the chart and try again.');
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
        ...Object.fromEntries(cached.freeAnswers.map((answer) => [answer.answerKey, answer])),
      }));
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
          ...Object.fromEntries(next.freeAnswers.map((answer) => [answer.answerKey, answer])),
        }));
      })
      .catch((loadError) => {
        if (!cancelled && !cached) setCategoryError(formatLoadError(loadError, language));
      })
      .finally(() => {
        if (!cancelled) setCategoryLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeCategory, cacheIdentity, categoryRetryToken, chartId, language, previewFixture, userId]);

  useEffect(() => {
    if (previewFixture) {
      if (!selectedAnswerKey) {
        setAnswerLoading(false);
        setAnswerError(null);
        return;
      }
      const previewState = previewFixture.state || 'ready';
      setAnswerLoading(previewState === 'loading');
      setAnswerError(previewState === 'error'
        ? language === 'ru'
          ? 'Ответ не загрузился. Нажми «Попробовать снова».'
          : 'The answer did not load. Try again.'
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
    const owningPack = categoryPacks[definition.categoryKey] || null;
    if (isNatalReportAnswerFree(selectedAnswerKey) && !owningPack) {
      const cachedOwningPack = getNatalCatalogCategoryCached(
        userId,
        definition.categoryKey,
        chartId,
        language,
        cacheIdentity,
      );
      if (cachedOwningPack) {
        setCategoryPacks((current) => ({ ...current, [definition.categoryKey]: cachedOwningPack }));
        setAnswers((current) => ({
          ...current,
          ...Object.fromEntries(cachedOwningPack.freeAnswers.map((answer) => [answer.answerKey, answer])),
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
          setCategoryPacks((current) => ({ ...current, [definition.categoryKey]: next }));
          setAnswers((current) => ({
            ...current,
            ...Object.fromEntries(next.freeAnswers.map((answer) => [answer.answerKey, answer])),
          }));
        })
        .catch((loadError) => {
          if (!cancelled) setAnswerError(formatLoadError(loadError, language));
        })
        .finally(() => {
          if (!cancelled) setAnswerLoading(false);
        });
      return () => { cancelled = true; };
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
    let cancelled = false;
    const cached = getNatalCatalogAnswerCached(
      userId,
      selectedAnswerKey,
      isPremium,
      chartId,
      language,
      cacheIdentity,
    );
    if (cached) setAnswers((current) => ({ ...current, [selectedAnswerKey]: cached }));
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
        if (!cancelled) setAnswers((current) => ({ ...current, [selectedAnswerKey]: next }));
      })
      .catch((loadError) => {
        if (!cancelled && !cached) setAnswerError(formatLoadError(loadError, language));
      })
      .finally(() => {
        if (!cancelled) setAnswerLoading(false);
      });
    return () => { cancelled = true; };
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

  useEffect(() => {
    if (previewFixture) return;
    const mainPack = categoryPacks[DEFAULT_CATEGORY];
    if (!mainPack) return;
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
          (count, category) => count + category.answerKeys.filter(isNatalReportAnswerFree).length,
          0,
        ),
        total_section_count: NATAL_REPORT_ANSWER_COUNT,
        source: 'natal_meaning_map',
      },
    });
  }, [categoryPacks, previewFixture, reportIdentity]);

  const closeAnswer = useCallback(() => {
    const answerKey = selectedAnswerKey;
    setSelectedAnswerKey(null);
    setAnswerOriginCategory(null);
    setAnswerError(null);
    requestAnimationFrame(() => {
      const answerRow = answerKey
        ? document.getElementById(`natal-catalog-row-${answerKey}`)
        : null;
      answerRow?.focus({ preventScroll: true });
      answerRow?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    });
  }, [selectedAnswerKey]);

  useEffect(() => {
    if (!selectedAnswerKey) return;
    const handleNativeBack = (event: Event) => {
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail.handled) return;
      detail.handled = true;
      closeAnswer();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAnswer();
    };
    window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [closeAnswer, selectedAnswerKey]);

  const openAnswer = useCallback((answerKey: NatalReportAnswerKey, source: OpenSource) => {
    const definition = getNatalReportAnswer(answerKey);
    if (!definition) return;
    const previewAlreadyLoaded = Object.values(categoryPacks).some((pack) => (
      pack?.previews.some((preview) => preview.answerKey === answerKey)
    ));
    setAnswerOriginCategory((current) => source === 'paywall_return'
      ? current || definition.categoryKey
      : activeCategory);
    if (!previewAlreadyLoaded) setActiveCategory(definition.categoryKey);
    const canReadAnswer = isPremium || isNatalReportAnswerFree(answerKey);
    const readableAnswerLoaded = Boolean(
      answers[answerKey]
      || Object.values(categoryPacks).some((pack) => (
        pack?.freeAnswers.some((answer) => answer.answerKey === answerKey)
      )),
    );
    setAnswerLoading(canReadAnswer && !readableAnswerLoaded);
    setSelectedAnswerKey(answerKey);
    setAnswerError(null);
    setFocusRequestId((value) => value + 1);
    const accessState = isNatalReportAnswerFree(answerKey)
      ? 'open'
      : isPremium ? 'premium' : 'locked';
    if (!previewFixture) {
      void recordUserAppEvent({
        eventType: 'natal_section_open',
        section: 'natal',
        source: 'deep_natal',
        eventPayload: {
          section_key: answerKey,
          access_state: accessState,
          source,
          navigation_model: 'meaning_map_sheet',
        },
      });
    }
  }, [activeCategory, answers, categoryPacks, isPremium, previewFixture]);

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
    const definition = answerKey ? getNatalReportAnswer(answerKey) : null;
    if (!answerKey || !definition) return;
    handledContinuationRef.current = premiumContinuation.paywallInstanceId;
    setActiveCategory(definition.categoryKey);
    onViewChange(definition.categoryKey === 'main' ? 'foundation' : 'explore');
    openAnswer(answerKey, 'paywall_return');
    onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
  }, [isPremium, onPremiumContinuationHandled, onViewChange, openAnswer, premiumContinuation]);

  const selectCategory = useCallback((categoryKey: NatalReportCategoryKey) => {
    if (!getNatalReportCategory(categoryKey)) return;
    setCategoryLoading(!categoryPacks[categoryKey]);
    setSelectedAnswerKey(null);
    setAnswerOriginCategory(null);
    setActiveCategory(categoryKey);
    setCategoryError(null);
    if (!previewFixture) {
      void recordUserAppEvent({
        eventType: 'natal_section_open',
        section: 'natal',
        source: 'deep_natal',
        eventPayload: {
          section_key: categoryKey,
          access_state: 'navigation',
          source: 'meaning_map',
        },
      });
    }
  }, [categoryPacks, previewFixture]);

  const toggleBookmark = useCallback((answerKey: NatalReportAnswerKey) => {
    setBookmarkedAnswerKeys((current) => {
      const next = new Set(current);
      if (next.has(answerKey)) next.delete(answerKey);
      else next.add(answerKey);
      return next;
    });
  }, []);

  const requestAnswerPremium = useCallback((answerKey: NatalReportAnswerKey) => {
    void requestPremium('deep_natal', {
      placement: 'deep_natal',
      featureKey: 'natal_deep',
      triggerType: 'locked_feature',
      returnView: 'chart',
      returnScrollAnchor: `natal-answer-unlock-${answerKey}`,
      returnAction: 'open_natal_answer',
      returnEntityId: answerKey,
    });
  }, [requestPremium]);

  const retryAnswer = () => {
    setAnswerRetryToken((value) => value + 1);
    if (
      selectedAnswerKey
      && isNatalReportAnswerFree(selectedAnswerKey)
      && !categoryPacks[getNatalReportAnswer(selectedAnswerKey)?.categoryKey || activeCategory]
    ) {
      setCategoryRetryToken((value) => value + 1);
    }
  };

  return (
    <article className="natal-catalog-report natal-catalog-report--v3">
      <NatalMeaningExperience
        profile={profile}
        chartData={chartData}
        subjectName={subjectName}
        view={view}
        activeCategoryKey={activeCategory}
        mainPack={categoryPacks[DEFAULT_CATEGORY] || null}
        categoryPack={selectedAnswerKey ? detailCategoryPack : activeCategoryPack}
        categoryLoading={categoryLoading}
        categoryError={categoryError}
        selectedAnswerKey={selectedAnswerKey}
        selectedPreview={selectedPreview}
        selectedAnswer={selectedAnswer}
        answerLoading={answerLoading}
        answerError={answerError}
        isPremium={isPremium}
        canPromotePremium={canPromotePremium || !isPremium}
        bookmarkedAnswerKeys={bookmarkedAnswerKeys}
        focusRequestId={focusRequestId}
        onChangeView={onViewChange}
        onSelectCategory={selectCategory}
        onOpenAnswer={openAnswer}
        onCloseAnswer={closeAnswer}
        onRetryCategory={() => setCategoryRetryToken((value) => value + 1)}
        onRetryAnswer={retryAnswer}
        onRequestPremium={requestAnswerPremium}
        onToggleBookmark={toggleBookmark}
        onOpenQuestions={onOpenQuestions}
      />
    </article>
  );
};
