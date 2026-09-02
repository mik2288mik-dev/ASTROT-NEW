import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, ChevronRight, Clock3, MapPin, Orbit } from 'lucide-react';
import type { NatalChartData, UserProfile } from '../../types';
import type { PreloadedNatalReport } from '../../components/NatalReading/HumanReport';
import type { NatalPermanentPremiumReport } from '../../lib/natalReading/permanentReport';
import { formatDisplayDate } from '../../lib/date-utils';
import { HumanReport } from '../../components/NatalReading/HumanReport';
import {
  NatalCatalogReport,
  type NatalCatalogReportUiPreview,
} from '../../components/NatalReading/NatalCatalogReport';
import { NatalQuestionExperience } from '../../components/NatalReading/NatalQuestionExperience';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { NatalChartWheel } from '../../components/NatalReading/NatalChartWheel';
import { EditorialChartsButton } from '../../components/editorial/EditorialScreenChrome';
import { buildNatalChartFingerprint } from '../../lib/natalChartFingerprint';
import {
  NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  type NatalReportCategoryKey,
} from '../../lib/natalReading/reportCatalog';
import {
  ensureNatalCatalogCategory,
  getNatalCatalogCategoryCached,
} from '../../services/natalCatalogService';
import {
  readNatalReadingVariant,
  resolveNatalReadingRenderer,
  subscribeNatalReadingVariant,
  type NatalReadingRenderer,
  type NatalReadingVariant,
} from '../../lib/natalReading/readingVariant';
import type { ChartListItem } from '../../services/storageService';
import type { PaywallContext } from '../../lib/paywallContext';
import styles from '../../styles/NatalMeaningExperience.module.css';
import shellStyles from '../../styles/NatalMeaningShell.module.css';

type NatalPreviewTab = 'map' | 'reading' | 'questions' | 'foundation' | 'explore';

type NatalMagazineProps = {
  data: NatalChartData | null;
  profile: UserProfile;
  chartLoadState?: 'idle' | 'loading' | 'ready' | 'error';
  onRetryChart?: () => void;
  chartId?: number;
  chartSubject?: ChartListItem | null;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  onUpdateProfile?: (profile: UserProfile) => void;
  preloadedReport?: PreloadedNatalReport | null;
  onCreateChart?: () => void;
  onOpenPersonalityReport: () => void;
  premiumContinuation?: PaywallContext | null;
  onPremiumContinuationHandled?: (paywallInstanceId: string) => void;
  canPromotePremium?: boolean;
  openQuestionRequest?: number;
  onQuestionRequestHandled?: () => void;
  onOpenCharts?: () => void;
  onOpenEncyclopedia?: () => void;
  uiPreview?: {
    initialTab?: NatalPreviewTab;
    openQuestion?: boolean;
    reportState?: 'ready' | 'loading' | 'error';
    premiumReport?: NatalPermanentPremiumReport | null;
    catalog?: NatalCatalogReportUiPreview;
  };
};

export type NatalScreenTab = 'foundation' | 'explore' | 'questions' | 'map';

const CATALOG_FALLBACK_MS = 18_000;

export function isSavedPersonChartSubject(
  chartSubject: Pick<ChartListItem, 'subject_type' | 'is_primary'> | null | undefined,
): boolean {
  return chartSubject?.subject_type === 'saved_person' || chartSubject?.is_primary === false;
}

function previewTab(
  value: NatalPreviewTab | undefined,
  openQuestion: boolean | undefined,
): NatalScreenTab {
  if (openQuestion || value === 'questions') return 'questions';
  if (value === 'map') return 'map';
  if (value === 'explore') return 'explore';
  return 'foundation';
}

export function normalizeNatalScreenTab(
  tab: NatalScreenTab,
  isSavedPerson: boolean,
): NatalScreenTab {
  return isSavedPerson && tab === 'questions' ? 'foundation' : tab;
}

export function NatalMagazine({
  data,
  profile,
  chartLoadState = 'idle',
  onRetryChart,
  chartId,
  chartSubject,
  requestPremium,
  onUpdateProfile,
  preloadedReport,
  onCreateChart,
  onOpenPersonalityReport: _onOpenPersonalityReport,
  premiumContinuation,
  onPremiumContinuationHandled,
  canPromotePremium,
  openQuestionRequest,
  onQuestionRequestHandled,
  onOpenCharts,
  onOpenEncyclopedia,
  uiPreview,
}: NatalMagazineProps) {
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const subjectName = chartSubject ? chartSubject.name : profile.name;
  const subjectBirthDate = chartSubject ? chartSubject.birth_date : profile.birthDate;
  const subjectBirthTime = chartSubject ? (chartSubject.birth_time ?? '') : profile.birthTime;
  const subjectBirthPlace = chartSubject ? chartSubject.birth_place : profile.birthPlace;
  const isSavedPerson = isSavedPersonChartSubject(chartSubject);
  const previewConfig = process.env.NODE_ENV === 'development'
    && process.env.NEXT_PUBLIC_UI_PREVIEW === '1'
      ? uiPreview
      : undefined;
  const initialTab = normalizeNatalScreenTab(
    previewTab(previewConfig?.initialTab, previewConfig?.openQuestion),
    isSavedPerson,
  );
  const [activeTab, setActiveTab] = useState<NatalScreenTab>(initialTab);
  const [lastContentTab, setLastContentTab] = useState<Exclude<NatalScreenTab, 'map'>>(
    initialTab === 'map' ? 'foundation' : initialTab,
  );
  const [requestedCategory, setRequestedCategory] = useState<NatalReportCategoryKey>('character');
  const [questionContext, setQuestionContext] = useState<NatalReportCategoryKey>('main');
  const handledExternalQuestionRequestRef = useRef(0);
  const handledQuestionContinuationRef = useRef('');

  const [readingVariant, setReadingVariant] = useState<NatalReadingVariant>(() => (
    readNatalReadingVariant(profile.id, profile.isAdmin === true)
  ));
  const [catalogFallback, setCatalogFallback] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);
  const catalogCacheIdentity = useMemo(() => data ? ({
    chartFingerprint: buildNatalChartFingerprint(data),
    reportVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  }) : null, [data]);
  const catalogIdentity = data && catalogCacheIdentity
    ? `${profile.id || ''}:${chartId ?? 'primary'}:${catalogCacheIdentity.chartFingerprint}`
    : 'empty';

  const readingRenderer: NatalReadingRenderer = catalogFallback && readingVariant === 'auto'
    ? 'classic'
    : resolveNatalReadingRenderer(readingVariant, catalogReady);

  useEffect(() => {
    const isAdmin = profile.isAdmin === true;
    setReadingVariant(readNatalReadingVariant(profile.id, isAdmin));
    return subscribeNatalReadingVariant(profile.id, isAdmin, (next) => {
      setReadingVariant(next);
    });
  }, [profile.id, profile.isAdmin]);

  useEffect(() => {
    setCatalogFallback(false);
    setCatalogReady(false);
  }, [catalogIdentity, readingVariant]);

  useEffect(() => {
    if (!data || !catalogCacheIdentity || readingVariant === 'classic') return;
    if (previewConfig?.catalog) {
      const previewState = previewConfig.catalog.state || 'ready';
      if (previewState === 'ready' && previewConfig.catalog.categoryPacks.main) {
        setCatalogReady(true);
      } else if (previewState === 'error' && readingVariant === 'auto') {
        setCatalogFallback(true);
      }
      return;
    }
    const userId = String(profile.id || '').trim();
    if (!userId) {
      if (readingVariant === 'auto') setCatalogFallback(true);
      return;
    }
    const cached = getNatalCatalogCategoryCached(
      userId,
      'main',
      chartId,
      language,
      catalogCacheIdentity,
    );
    if (cached) {
      setCatalogReady(true);
      return;
    }

    let cancelled = false;
    const fallbackTimer = readingVariant === 'auto'
      ? window.setTimeout(() => {
          if (!cancelled) setCatalogFallback(true);
        }, CATALOG_FALLBACK_MS)
      : null;

    void ensureNatalCatalogCategory(
      userId,
      'main',
      chartId,
      language,
      catalogCacheIdentity,
    )
      .then(() => {
        if (!cancelled) setCatalogReady(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn(
          '[NatalMagazine] New natal reading was not ready:',
          error instanceof Error ? error.message : error,
        );
        if (readingVariant === 'auto') setCatalogFallback(true);
      })
      .finally(() => {
        if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
      });

    return () => {
      cancelled = true;
      if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
    };
  }, [
    catalogCacheIdentity,
    chartId,
    data,
    language,
    previewConfig?.catalog,
    profile.id,
    readingVariant,
  ]);

  useEffect(() => {
    if (
      !openQuestionRequest
      || handledExternalQuestionRequestRef.current === openQuestionRequest
    ) return;
    if (!data && chartLoadState === 'idle' && !profile.isSetup) {
      onCreateChart?.();
      return;
    }
    if (!data) return;
    handledExternalQuestionRequestRef.current = openQuestionRequest;
    if (!isSavedPerson) {
      setQuestionContext('main');
      setActiveTab('questions');
      setLastContentTab('questions');
    }
    onQuestionRequestHandled?.();
  }, [
    chartLoadState,
    data,
    isSavedPerson,
    onCreateChart,
    onQuestionRequestHandled,
    openQuestionRequest,
    profile.isSetup,
  ]);

  useEffect(() => {
    if (
      !premiumContinuation
      || premiumContinuation.returnView !== 'chart'
      || premiumContinuation.featureKey !== 'natal_questions'
      || premiumContinuation.returnAction !== 'open_natal_questions'
      || handledQuestionContinuationRef.current === premiumContinuation.paywallInstanceId
    ) return;
    handledQuestionContinuationRef.current = premiumContinuation.paywallInstanceId;
    if (isSavedPerson) {
      setActiveTab('foundation');
      setLastContentTab('foundation');
      onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
      return;
    }
    setQuestionContext('main');
    setActiveTab('questions');
    setLastContentTab('questions');
  }, [isSavedPerson, onPremiumContinuationHandled, premiumContinuation]);

  const selectTab = useCallback((tab: NatalScreenTab) => {
    const normalized = normalizeNatalScreenTab(tab, isSavedPerson);
    setActiveTab(normalized);
    if (normalized !== 'map') setLastContentTab(normalized);
    if (normalized === 'explore' && requestedCategory === 'main') {
      setRequestedCategory('character');
    }
  }, [isSavedPerson, requestedCategory]);

  const openExplore = useCallback((categoryKey: NatalReportCategoryKey) => {
    setRequestedCategory(categoryKey === 'main' ? 'character' : categoryKey);
    setActiveTab('explore');
    setLastContentTab('explore');
  }, []);

  const openQuestions = useCallback((categoryKey: NatalReportCategoryKey = 'main') => {
    if (isSavedPerson) return;
    setQuestionContext(categoryKey);
    setActiveTab('questions');
    setLastContentTab('questions');
  }, [isSavedPerson]);

  const markCatalogReady = useCallback(() => {
    setCatalogReady(true);
  }, []);

  const markCatalogUnavailable = useCallback((error: unknown) => {
    console.warn(
      '[NatalMagazine] New natal reading failed:',
      error instanceof Error ? error.message : error,
    );
    if (readingVariant === 'auto') setCatalogFallback(true);
  }, [readingVariant]);

  const header = (
    <>
      <AppTopBar
        title={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
        rightAction={(
          <div className="natal-header-actions">
            {data ? (
              <button
                type="button"
                className="app-top-bar-action natal-header-wheel-button"
                aria-label={language === 'ru' ? 'Открыть круг карты' : 'Open chart wheel'}
                aria-pressed={activeTab === 'map'}
                onClick={() => selectTab(activeTab === 'map' ? lastContentTab : 'map')}
              >
                <Orbit aria-hidden="true" strokeWidth={1.35} />
              </button>
            ) : null}
            <EditorialChartsButton
              label={language === 'ru' ? 'Открыть мои карты' : 'Open my charts'}
              onClick={onOpenCharts}
            />
          </div>
        )}
      />
      {data ? (
        <div className={shellStyles.subjectBar}>
          <button
            type="button"
            className={shellStyles.subjectButton}
            onClick={onOpenCharts}
            disabled={!onOpenCharts}
          >
            <span>{subjectName || (language === 'ru' ? 'Моя карта' : 'My chart')}</span>
            {onOpenCharts ? <ChevronDown aria-hidden="true" /> : null}
          </button>
          <span className={shellStyles.subjectMeta}>
            {formatDisplayDate(subjectBirthDate, language)}
          </span>
        </div>
      ) : null}
      {data && activeTab !== 'map' ? (
        <nav
          className={styles.productNav}
          data-two-items={isSavedPerson || undefined}
          aria-label={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
        >
          <button
            type="button"
            className={`${styles.productNavButton}${activeTab === 'foundation' ? ` ${styles.productNavButtonActive}` : ''}`}
            aria-current={activeTab === 'foundation' ? 'page' : undefined}
            onClick={() => selectTab('foundation')}
          >
            {language === 'ru' ? 'Главное' : 'Main'}
          </button>
          <button
            type="button"
            className={`${styles.productNavButton}${activeTab === 'explore' ? ` ${styles.productNavButtonActive}` : ''}`}
            aria-current={activeTab === 'explore' ? 'page' : undefined}
            onClick={() => selectTab('explore')}
          >
            {language === 'ru' ? 'Подробнее' : 'Explore'}
          </button>
          {!isSavedPerson ? (
            <button
              type="button"
              className={`${styles.productNavButton}${activeTab === 'questions' ? ` ${styles.productNavButtonActive}` : ''}`}
              aria-current={activeTab === 'questions' ? 'page' : undefined}
              onClick={() => openQuestions(questionContext)}
            >
              {language === 'ru' ? 'Спросить' : 'Ask'}
            </button>
          ) : null}
        </nav>
      ) : null}
    </>
  );

  if (!data) {
    const isLoadingChart = chartLoadState === 'loading'
      || (profile.isSetup && chartLoadState === 'idle');
    const isChartError = chartLoadState === 'error'
      || (profile.isSetup && chartLoadState === 'ready');
    return (
      <div className="fresh-page natal-editorial-page natal-mvp-page">
        {header}
        <section
          className="natal-empty-content"
          aria-live="polite"
          aria-busy={isLoadingChart || undefined}
          role={isChartError ? 'alert' : undefined}
        >
          {isLoadingChart ? (
            <>
              <h1>{language === 'ru' ? 'Открываем твою карту' : 'Opening your chart'}</h1>
              <p>{language === 'ru' ? 'Данные уже найдены.' : 'Your details are already here.'}</p>
            </>
          ) : isChartError ? (
            <>
              <h1>{language === 'ru' ? 'Карта не открылась' : 'The chart did not open'}</h1>
              <p>{language === 'ru' ? 'Проверь интернет и повтори.' : 'Check your connection and try again.'}</p>
              {onRetryChart ? (
                <button type="button" className="fresh-btn-primary" onClick={onRetryChart}>
                  {language === 'ru' ? 'Повторить' : 'Retry'}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <h1>{language === 'ru' ? 'Сначала нужны данные рождения' : 'Start with your birth details'}</h1>
              <p>
                {language === 'ru'
                  ? 'Дата, время и место. Остальное посчитаем сами.'
                  : 'Date, time, and place. We will calculate the rest.'}
              </p>
              <button type="button" className="fresh-btn-primary" onClick={onCreateChart}>
                {language === 'ru' ? 'Добавить данные' : 'Add details'}
              </button>
            </>
          )}
        </section>
      </div>
    );
  }

  const reportSubjectKey = [
    chartSubject?.subject_type || 'self',
    chartSubject?.id ?? chartId ?? 'primary',
    chartSubject?.input_hash || buildNatalChartFingerprint(data),
    chartSubject?.calculation_version || data.calculationVersion || 'unknown',
  ].join(':');

  const catalogReport = activeTab === 'foundation' || activeTab === 'explore' ? (
    <NatalCatalogReport
      key={`meaning:${reportSubjectKey}`}
      profile={profile}
      chartData={data}
      chartId={chartId}
      chartSubject={chartSubject}
      requestPremium={requestPremium}
      premiumContinuation={premiumContinuation}
      onPremiumContinuationHandled={onPremiumContinuationHandled}
      canPromotePremium={canPromotePremium}
      displayMode={activeTab === 'foundation' ? 'foundation' : 'explore'}
      requestedCategory={requestedCategory}
      onOpenExplore={openExplore}
      onOpenQuestions={openQuestions}
      onMainReady={markCatalogReady}
      onMainUnavailable={markCatalogUnavailable}
      hideIntro
      uiPreview={previewConfig?.catalog}
    />
  ) : null;

  return (
    <div className={`fresh-page natal-editorial-page natal-mvp-page ${styles.shell}`}>
      {header}

      {activeTab === 'map' ? (
        <main className={shellStyles.mapRoot}>
          <button type="button" className={shellStyles.mapBack} onClick={() => selectTab(lastContentTab)}>
            <ArrowLeft aria-hidden="true" />
            {language === 'ru' ? 'К разбору' : 'Back to the reading'}
          </button>
          <header className={shellStyles.mapHeading}>
            <p>{language === 'ru' ? 'Карта рождения' : 'Birth chart'}</p>
            <h1>{subjectName}</h1>
          </header>

          <NatalChartWheel
            chart={data}
            language={language}
            downloadName={`${subjectName || 'natal'}-chart`}
          />

          <dl className={shellStyles.mapMeta}>
            <div>
              <dt><CalendarDays aria-hidden="true" />{language === 'ru' ? 'Дата' : 'Date'}</dt>
              <dd>{formatDisplayDate(subjectBirthDate, language)}</dd>
            </div>
            <div>
              <dt><Clock3 aria-hidden="true" />{language === 'ru' ? 'Время' : 'Time'}</dt>
              <dd>{subjectBirthTime || (language === 'ru' ? 'Не указано' : 'Not specified')}</dd>
            </div>
            <div>
              <dt><MapPin aria-hidden="true" />{language === 'ru' ? 'Место' : 'Place'}</dt>
              <dd>{subjectBirthPlace || (language === 'ru' ? 'Не указано' : 'Not specified')}</dd>
            </div>
          </dl>

          {onOpenEncyclopedia ? (
            <button type="button" className={shellStyles.mapLearn} onClick={onOpenEncyclopedia}>
              <span>{language === 'ru' ? 'Что означают точки и линии' : 'What the points and lines mean'}</span>
              <ChevronRight aria-hidden="true" />
            </button>
          ) : null}
        </main>
      ) : null}

      {(activeTab === 'foundation' || activeTab === 'explore') ? (
        readingRenderer === 'catalog' ? catalogReport : (
          <section className="natal-reading-stage" aria-label={language === 'ru' ? 'Разбор карты' : 'Chart reading'}>
            <HumanReport
              key={`classic:${reportSubjectKey}`}
              profile={profile}
              chartData={data}
              chartId={chartId}
              chartSubject={chartSubject}
              requestPremium={requestPremium}
              onUpdateProfile={onUpdateProfile}
              preloadedReport={preloadedReport}
              hideIntro
              surface="reading"
              premiumContinuation={premiumContinuation}
              onPremiumContinuationHandled={onPremiumContinuationHandled}
              canPromotePremium={canPromotePremium}
              onOpenQuestions={isSavedPerson ? undefined : () => openQuestions('main')}
              uiPreview={previewConfig ? {
                state: previewConfig.reportState || 'ready',
                premiumReport: previewConfig.premiumReport,
              } : undefined}
            />
          </section>
        )
      ) : null}

      {activeTab === 'questions' && !isSavedPerson ? (
        <NatalQuestionExperience
          key={`questions:${reportSubjectKey}`}
          profile={profile}
          chartData={data}
          chartId={chartId}
          context={questionContext}
          requestAccess={requestPremium}
          premiumContinuation={premiumContinuation}
          onPremiumContinuationHandled={onPremiumContinuationHandled}
        />
      ) : null}
    </div>
  );
}
