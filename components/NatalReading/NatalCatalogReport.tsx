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
import { formatDisplayDate } from '../../lib/date-utils';
import { NatalReportHub } from './NatalReportHub';

const DEFAULT_CATEGORY = 'main' as NatalReportCategoryKey;
const STORAGE_PREFIX = 'nebo:natal-catalog:v1';

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
  onOpenQuestions?: () => void;
  hideIntro?: boolean;
  onReady?: () => void;
  onUnavailable?: (error: unknown) => void;
  uiPreview?: NatalCatalogReportUiPreview;
};

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

function readStoredAnswerKeyList(key: string): NatalReportAnswerKey[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value, index, values): value is NatalReportAnswerKey => (
      typeof value === 'string'
      && values.indexOf(value) === index
      && getNatalReportAnswer(value as NatalReportAnswerKey) != null
    )).slice(0, 8);
  } catch {
    return [];
  }
}

function readStoredAnswerKey(key: string): NatalReportAnswerKey | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(key);
    return value && getNatalReportAnswer(value as NatalReportAnswerKey)
      ? value as NatalReportAnswerKey
      : null;
  } catch {
    return null;
  }
}

function writeStoredAnswerKeys(key: string, values: ReadonlySet<NatalReportAnswerKey>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify([...values]));
  } catch {
    // A private WebView can deny localStorage. Reading still works for this session.
  }
}

function writeStoredAnswerKeyList(key: string, values: readonly NatalReportAnswerKey[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(values.slice(0, 8)));
  } catch {
    // History stays available for this session when persistent storage is unavailable.
  }
}

function writeStoredAnswerKey(key: string, value: NatalReportAnswerKey | null) {
  if (typeof window === 'undefined') return;
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    // The report remains usable even when persistent storage is unavailable.
  }
}

function formatLoadError(error: unknown, language: 'ru' | 'en'): string {
  const code = typeof error === 'object' && error && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  if (code === 'PREMIUM_REQUIRED') {
    return language === 'ru'
      ? 'Этот ответ откроется вместе со всей картой.'
      : 'This answer opens with the full chart.';
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
  requestPremium,
  premiumContinuation,
  onPremiumContinuationHandled,
  canPromotePremium = true,
  onOpenQuestions,
  hideIntro = false,
  onReady,
  onUnavailable,
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
  const subjectBirthDate = chartSubject?.birth_date || profile.birthDate;
  const cacheIdentity = useMemo(() => ({
    chartFingerprint: buildNatalChartFingerprint(chartData),
    reportVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  }), [chartData]);
  const reportIdentity = `${userId}:${chartId ?? 'primary'}:${cacheIdentity.chartFingerprint}`;
  const storageScope = `${STORAGE_PREFIX}:${reportIdentity}`;

  const [activeCategory, setActiveCategory] = useState<NatalReportCategoryKey>(
    previewFixture?.initialCategory || DEFAULT_CATEGORY,
  );
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
  const [readAnswerKeys, setReadAnswerKeys] = useState<Set<NatalReportAnswerKey>>(new Set());
  const [bookmarkedAnswerKeys, setBookmarkedAnswerKeys] = useState<Set<NatalReportAnswerKey>>(new Set());
  const [recentAnswerKeys, setRecentAnswerKeys] = useState<NatalReportAnswerKey[]>([]);
  const [lastReadAnswerKey, setLastReadAnswerKey] = useState<NatalReportAnswerKey | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [focusRequestId, setFocusRequestId] = useState(0);
  const firstResultIdentityRef = useRef('');
  const handledContinuationRef = useRef('');
  const onReadyRef = useRef(onReady);
  const onUnavailableRef = useRef(onUnavailable);
  const mainAvailabilityRef = useRef<'pending' | 'ready' | 'unavailable'>('pending');

  useEffect(() => {
    onReadyRef.current = onReady;
    onUnavailableRef.current = onUnavailable;
  }, [onReady, onUnavailable]);

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
  const displayCategoryPack = selectedAnswerKey ? detailCategoryPack : activeCategoryPack;

  const notifyMainReady = () => {
    if (mainAvailabilityRef.current === 'ready') return;
    mainAvailabilityRef.current = 'ready';
    onReadyRef.current?.();
  };

  const notifyMainUnavailable = (error: unknown) => {
    if (mainAvailabilityRef.current === 'ready') return;
    mainAvailabilityRef.current = 'unavailable';
    onUnavailableRef.current?.(error);
  };

  useEffect(() => {
    mainAvailabilityRef.current = 'pending';
  }, [storageScope]);

  useEffect(() => {
    setStorageReady(false);
    setActiveCategory(previewFixture?.initialCategory || DEFAULT_CATEGORY);
    setSelectedAnswerKey(previewFixture?.initialAnswerKey || null);
    setAnswerOriginCategory(null);
    setCategoryPacks(previewFixture?.state === 'ready' || !previewFixture?.state
      ? previewFixture?.categoryPacks || {}
      : {});
    setAnswers(previewFixture?.state === 'ready' || !previewFixture?.state
      ? previewFixture?.answers || {}
      : {});
    setReadAnswerKeys(readStoredAnswerKeys(`${storageScope}:read`));
    setBookmarkedAnswerKeys(readStoredAnswerKeys(`${storageScope}:bookmarks`));
    setRecentAnswerKeys(readStoredAnswerKeyList(`${storageScope}:recent`));
    setLastReadAnswerKey(readStoredAnswerKey(`${storageScope}:last-read`));
    setStorageReady(true);
  }, [previewFixture, storageScope]);

  useEffect(() => {
    if (!storageReady) return;
    writeStoredAnswerKeys(`${storageScope}:read`, readAnswerKeys);
  }, [readAnswerKeys, storageReady, storageScope]);

  useEffect(() => {
    if (!storageReady) return;
    writeStoredAnswerKeys(`${storageScope}:bookmarks`, bookmarkedAnswerKeys);
  }, [bookmarkedAnswerKeys, storageReady, storageScope]);

  useEffect(() => {
    if (!storageReady) return;
    writeStoredAnswerKeyList(`${storageScope}:recent`, recentAnswerKeys);
  }, [recentAnswerKeys, storageReady, storageScope]);

  useEffect(() => {
    if (!storageReady) return;
    writeStoredAnswerKey(`${storageScope}:last-read`, lastReadAnswerKey);
  }, [lastReadAnswerKey, storageReady, storageScope]);

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
      if (previewState === 'ready' && previewFixture.categoryPacks[DEFAULT_CATEGORY]) {
        notifyMainReady();
      } else if (previewState === 'error') {
        notifyMainUnavailable(new Error('NATAL_REPORT_CATEGORY_PREVIEW_FAILED'));
      }
      return;
    }
    if (!userId) {
      setCategoryLoading(false);
      setCategoryError(language === 'ru'
        ? 'Разбор не открылся. Вернись к карте и попробуй ещё раз.'
        : 'The reading did not open. Return to the chart and try again.');
      if (activeCategory === DEFAULT_CATEGORY) {
        notifyMainUnavailable(new Error('NATAL_CATALOG_USER_ID_MISSING'));
      }
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
      if (activeCategory === DEFAULT_CATEGORY) notifyMainReady();
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
        if (!cancelled) {
          setCategoryPacks((current) => ({ ...current, [activeCategory]: next }));
          setAnswers((current) => ({
            ...current,
            ...Object.fromEntries(next.freeAnswers.map((answer) => [answer.answerKey, answer])),
          }));
          if (activeCategory === DEFAULT_CATEGORY) notifyMainReady();
        }
      })
      .catch((loadError) => {
        if (!cancelled && !cached) {
          setCategoryError(formatLoadError(loadError, language));
          if (activeCategory === DEFAULT_CATEGORY) notifyMainUnavailable(loadError);
        }
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
    if (!selectedAnswerKey || selectedAnswer?.answerKey !== selectedAnswerKey) return;
    setReadAnswerKeys((current) => {
      if (current.has(selectedAnswerKey)) return current;
      const next = new Set(current);
      next.add(selectedAnswerKey);
      return next;
    });
    setRecentAnswerKeys((current) => [
      selectedAnswerKey,
      ...current.filter((answerKey) => answerKey !== selectedAnswerKey),
    ].slice(0, 8));
    setLastReadAnswerKey(selectedAnswerKey);
  }, [selectedAnswer, selectedAnswerKey]);

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
        source: 'natal_report',
      },
    });
  }, [categoryPacks, previewFixture, reportIdentity]);

  const returnToCategory = useCallback(() => {
    const answerKey = selectedAnswerKey;
    const definition = answerKey ? getNatalReportAnswer(answerKey) : null;
    const returnCategory = answerOriginCategory || definition?.categoryKey || activeCategory;
    setSelectedAnswerKey(null);
    setAnswerOriginCategory(null);
    setActiveCategory(returnCategory);
    setAnswerError(null);
    requestAnimationFrame(() => {
      const answerRow = answerKey
        ? document.getElementById(`natal-catalog-row-${answerKey}`)
        : null;
      const target = answerRow || document.getElementById('natal-catalog-category-title');
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    });
  }, [activeCategory, answerOriginCategory, selectedAnswerKey]);

  useEffect(() => {
    if (!selectedAnswerKey) return;
    const handleNativeBack = (event: Event) => {
      const detail = (event as CustomEvent<NativeBackEventDetail>).detail;
      if (detail.handled) return;
      detail.handled = true;
      returnToCategory();
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') returnToCategory();
    };
    window.addEventListener(NATIVE_BACK_EVENT, handleNativeBack);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener(NATIVE_BACK_EVENT, handleNativeBack);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [returnToCategory, selectedAnswerKey]);

  const openAnswer = useCallback((answerKey: NatalReportAnswerKey, source: OpenSource) => {
    const definition = getNatalReportAnswer(answerKey);
    if (!definition) return;
    const previewAlreadyLoaded = Object.values(categoryPacks).some((pack) => (
      pack?.previews.some((preview) => preview.answerKey === answerKey)
    ));
    setAnswerOriginCategory((current) => {
      if (source === 'paywall_return') return current || definition.categoryKey;
      if (source === 'related_question') return current || activeCategory;
      if (source === 'continue') return definition.categoryKey;
      return activeCategory;
    });
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
    if (!answerKey || !getNatalReportAnswer(answerKey)) return;
    handledContinuationRef.current = premiumContinuation.paywallInstanceId;
    openAnswer(answerKey, 'paywall_return');
    onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
  }, [isPremium, onPremiumContinuationHandled, openAnswer, premiumContinuation]);

  const selectCategory = useCallback((categoryKey: NatalReportCategoryKey) => {
    if (!getNatalReportCategory(categoryKey)) return;
    setCategoryLoading(!categoryPacks[categoryKey]);
    setSelectedAnswerKey(null);
    setAnswerOriginCategory(null);
    setActiveCategory(categoryKey);
    setCategoryError(null);
    setFocusRequestId((value) => value + 1);
  }, [categoryPacks]);

  const selectCategoryByKeyboard = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % NATAL_REPORT_CATEGORIES.length;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + NATAL_REPORT_CATEGORIES.length) % NATAL_REPORT_CATEGORIES.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = NATAL_REPORT_CATEGORIES.length - 1;
    if (nextIndex == null) return;
    event.preventDefault();
    const next = NATAL_REPORT_CATEGORIES[nextIndex];
    if (!next) return;
    selectCategory(next.key);
    requestAnimationFrame(() => {
      document.getElementById(`natal-catalog-tab-${next.key}`)?.focus();
    });
  };

  const continueReading = useCallback(() => {
    if (!lastReadAnswerKey) return;
    openAnswer(lastReadAnswerKey, 'continue');
  }, [lastReadAnswerKey, openAnswer]);

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

  return (
    <article className="natal-catalog-report" aria-label={language === 'ru' ? 'Разбор натальной карты' : 'Natal chart reading'}>
      {!hideIntro ? (
        <header className="natal-catalog-intro">
          <p>{subjectName} · {formatDisplayDate(subjectBirthDate, language)}</p>
          <h1>{language === 'ru' ? 'Разбор натальной карты' : 'Natal chart reading'}</h1>
        </header>
      ) : null}

      {!selectedAnswerKey ? (
        <div className="natal-catalog-tabs-wrap">
          <div
            className="natal-catalog-tabs"
            role="tablist"
            aria-label={language === 'ru' ? 'Темы натальной карты' : 'Natal chart topics'}
          >
            {NATAL_REPORT_CATEGORIES.map((category, index) => (
              <button
                key={category.key}
                id={`natal-catalog-tab-${category.key}`}
                type="button"
                role="tab"
                aria-selected={activeCategory === category.key}
                aria-controls="natal-catalog-panel"
                tabIndex={activeCategory === category.key ? 0 : -1}
                onClick={() => selectCategory(category.key)}
                onKeyDown={(event) => selectCategoryByKeyboard(event, index)}
              >
                {category.title[language]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        id="natal-catalog-panel"
        className="natal-catalog-panel"
        role="tabpanel"
        aria-labelledby={!selectedAnswerKey ? `natal-catalog-tab-${activeCategory}` : undefined}
        aria-label={selectedAnswerKey
          ? language === 'ru' ? 'Ответ по натальной карте' : 'Natal chart answer'
          : undefined}
        aria-busy={(categoryLoading || answerLoading) || undefined}
      >
        <NatalReportHub
          mode="catalog"
          language={language}
          categoryKey={activeCategory}
          categoryPack={displayCategoryPack}
          categoryLoading={categoryLoading}
          categoryError={categoryError}
          selectedAnswerKey={selectedAnswerKey}
          answerOriginCategoryKey={answerOriginCategory}
          selectedPreview={selectedPreview}
          selectedAnswer={selectedAnswer}
          answerLoading={answerLoading}
          answerError={answerError}
          isPremium={isPremium}
          canPromotePremium={canPromotePremium || !isPremium}
          readAnswerKeys={readAnswerKeys}
          bookmarkedAnswerKeys={bookmarkedAnswerKeys}
          recentAnswerKeys={recentAnswerKeys}
          totalReadCount={readAnswerKeys.size}
          continueAnswerKey={lastReadAnswerKey}
          focusRequestId={focusRequestId}
          onOpenAnswer={openAnswer}
          onBackToCategory={returnToCategory}
          onRetryCategory={() => setCategoryRetryToken((value) => value + 1)}
          onRetryAnswer={() => {
            setAnswerRetryToken((value) => value + 1);
            if (
              selectedAnswerKey
              && isNatalReportAnswerFree(selectedAnswerKey)
              && !categoryPacks[getNatalReportAnswer(selectedAnswerKey)?.categoryKey || activeCategory]
            ) {
              setCategoryRetryToken((value) => value + 1);
            }
          }}
          onRequestPremium={requestAnswerPremium}
          onToggleBookmark={toggleBookmark}
          onContinue={continueReading}
          onOpenQuestions={onOpenQuestions}
        />
      </div>
    </article>
  );
};
