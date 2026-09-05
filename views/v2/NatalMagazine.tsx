import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, Clock3, MapPin, Orbit } from 'lucide-react';
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
import type { NatalExperienceView } from '../../components/NatalReading/NatalMeaningExperience';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { NatalChartWheel } from '../../components/NatalReading/NatalChartWheel';
import { MatrixRoom } from './MatrixRoom';
import { buildNatalChartFingerprint } from '../../lib/natalChartFingerprint';
import type { NatalReportCategoryKey } from '../../lib/natalReading/reportCatalog';
import {
  readNatalReadingVariant,
  resolveNatalReadingRenderer,
  subscribeNatalReadingVariant,
  type NatalReadingVariant,
} from '../../lib/natalReading/readingVariant';
import type { ChartListItem } from '../../services/storageService';
import type { PaywallContext } from '../../lib/paywallContext';

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
    initialTab?: 'map' | 'reading' | 'questions' | 'foundation' | 'explore' | 'ask' | 'matrix';
    openQuestion?: boolean;
    reportState?: 'ready' | 'loading' | 'error';
    premiumReport?: NatalPermanentPremiumReport | null;
    catalog?: NatalCatalogReportUiPreview;
  };
};

export type NatalScreenTab = 'foundation' | 'explore' | 'ask' | 'map' | 'matrix';

export function isSavedPersonChartSubject(
  chartSubject: Pick<ChartListItem, 'subject_type' | 'is_primary'> | null | undefined,
): boolean {
  return chartSubject?.subject_type === 'saved_person' || chartSubject?.is_primary === false;
}

export function normalizeNatalScreenTab(
  tab: NatalScreenTab,
  isSavedPerson: boolean,
): NatalScreenTab {
  return isSavedPerson && tab === 'ask' ? 'foundation' : tab;
}

type NatalPreviewInitialTab = NonNullable<NatalMagazineProps['uiPreview']>['initialTab'];

function previewTabToScreen(
  value: NatalPreviewInitialTab,
  openQuestion: boolean,
): NatalScreenTab {
  if (openQuestion || value === 'questions' || value === 'ask') return 'ask';
  if (value === 'map') return 'map';
  if (value === 'matrix') return 'matrix';
  if (value === 'explore') return 'explore';
  return 'foundation';
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
  premiumContinuation,
  onPremiumContinuationHandled,
  canPromotePremium,
  openQuestionRequest,
  onQuestionRequestHandled,
  onOpenCharts,
  onOpenEncyclopedia,
  uiPreview,
}: NatalMagazineProps) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const subjectName = chartSubject ? chartSubject.name : profile.name;
  const subjectBirthDate = chartSubject ? chartSubject.birth_date : profile.birthDate;
  const subjectBirthTime = chartSubject ? (chartSubject.birth_time ?? '') : profile.birthTime;
  const subjectBirthPlace = chartSubject ? chartSubject.birth_place : profile.birthPlace;
  const isSavedPerson = isSavedPersonChartSubject(chartSubject);
  const previewConfig = process.env.NODE_ENV === 'development'
    && process.env.NEXT_PUBLIC_UI_PREVIEW === '1'
      ? uiPreview
      : undefined;
  const [readingVariant, setReadingVariant] = useState<NatalReadingVariant>(() => (
    readNatalReadingVariant(profile.id, profile.isAdmin === true)
  ));
  const readingRenderer = previewConfig?.catalog
    ? 'catalog'
    : resolveNatalReadingRenderer(profile.isAdmin === true ? readingVariant : 'auto', false);
  const [activeTab, setActiveTab] = useState<NatalScreenTab>(() => normalizeNatalScreenTab(
    previewTabToScreen(previewConfig?.initialTab, Boolean(previewConfig?.openQuestion)),
    isSavedPerson,
  ));
  const [questionContext, setQuestionContext] = useState<NatalReportCategoryKey>('main');
  const [matrixMounted, setMatrixMounted] = useState(false);
  const lastContentTabRef = useRef<Exclude<NatalScreenTab, 'map'>>('foundation');
  const handledExternalQuestionRequestRef = useRef(0);
  const normalizedActiveTab = normalizeNatalScreenTab(activeTab, isSavedPerson);
  const showPrimaryNavigation = true;
  const primaryNavItemCount = readingRenderer === 'catalog'
    ? (isSavedPerson ? 3 : 4)
    : (isSavedPerson ? 2 : 3);

  useEffect(() => {
    if (normalizedActiveTab !== activeTab) setActiveTab(normalizedActiveTab);
  }, [activeTab, normalizedActiveTab]);

  useEffect(() => {
    if (readingRenderer !== 'classic' || normalizedActiveTab !== 'explore') return;
    lastContentTabRef.current = 'foundation';
    setActiveTab('foundation');
  }, [normalizedActiveTab, readingRenderer]);

  useEffect(() => {
    const isAdmin = profile.isAdmin === true;
    setReadingVariant(readNatalReadingVariant(profile.id, isAdmin));
    return subscribeNatalReadingVariant(profile.id, isAdmin, (next) => {
      setReadingVariant(next);
    });
  }, [profile.id, profile.isAdmin]);

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
      setActiveTab('ask');
      lastContentTabRef.current = 'ask';
    }
    onQuestionRequestHandled?.();
  }, [chartLoadState, data, isSavedPerson, onCreateChart, onQuestionRequestHandled, openQuestionRequest, profile.isSetup]);

  useEffect(() => {
    if (!premiumContinuation || premiumContinuation.returnView !== 'chart') return;
    if (
      premiumContinuation.featureKey === 'natal_questions'
      && premiumContinuation.returnAction === 'open_natal_questions'
    ) {
      if (isSavedPerson) {
        setActiveTab('foundation');
        onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
        return;
      }
      setActiveTab('ask');
      lastContentTabRef.current = 'ask';
      return;
    }
    if (
      premiumContinuation.featureKey === 'natal_deep'
      && premiumContinuation.returnAction === 'open_natal_answer'
    ) {
      setActiveTab('explore');
      lastContentTabRef.current = 'explore';
    }
  }, [isSavedPerson, onPremiumContinuationHandled, premiumContinuation]);

  const selectTab = (tab: NatalScreenTab) => {
    const requestedTab = tab === 'explore' && readingRenderer === 'classic'
      ? 'foundation'
      : tab;
    const normalized = normalizeNatalScreenTab(requestedTab, isSavedPerson);
    if (normalized === 'matrix') {
      setMatrixMounted(true);
      lastContentTabRef.current = 'matrix';
      setActiveTab('matrix');
      return;
    }
    if (normalized === 'map') {
      if (normalizedActiveTab !== 'map') {
        lastContentTabRef.current = normalizedActiveTab as Exclude<NatalScreenTab, 'map'>;
      }
      setActiveTab('map');
      return;
    }
    lastContentTabRef.current = normalized as Exclude<NatalScreenTab, 'map'>;
    setActiveTab(normalized);
  };

  const openQuestions = (categoryKey: NatalReportCategoryKey) => {
    if (isSavedPerson) return;
    setQuestionContext(categoryKey);
    selectTab('ask');
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  };

  const header = (
    <>
      <AppTopBar title={language === 'ru' ? 'Натальная карта' : 'Natal chart'} />
      {data ? (
        <div className="natal-v3-subject-bar">
          {onOpenCharts ? (
            <button
              type="button"
              className="natal-v3-subject-switch"
              onClick={onOpenCharts}
              aria-label={language === 'ru' ? 'Выбрать другую карту' : 'Choose another chart'}
            >
              <span>{subjectName || (language === 'ru' ? 'Моя карта' : 'My chart')}</span>
              <ChevronDown aria-hidden="true" />
            </button>
          ) : (
            <span className="natal-v3-subject-name">{subjectName}</span>
          )}
          {normalizedActiveTab === 'map' ? (
            <button
              type="button"
              className="natal-v3-header-action"
              onClick={() => selectTab(lastContentTabRef.current)}
            >
              <ArrowLeft aria-hidden="true" />
              {lastContentTabRef.current === 'matrix'
                ? (language === 'ru' ? 'К матрице' : 'Back to matrix')
                : (language === 'ru' ? 'К разбору' : 'Back to reading')}
            </button>
          ) : (
            <button
              type="button"
              className="natal-v3-header-action"
              onClick={() => selectTab('map')}
            >
              <Orbit aria-hidden="true" />
              {language === 'ru' ? 'Круг карты' : 'Chart wheel'}
            </button>
          )}
        </div>
      ) : null}
      {data && normalizedActiveTab !== 'map' && showPrimaryNavigation ? (
        <nav
          className="natal-v3-primary-nav"
          data-items={primaryNavItemCount}
          aria-label={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
        >
          <button
            type="button"
            className={normalizedActiveTab === 'foundation' ? 'is-active' : undefined}
            aria-current={normalizedActiveTab === 'foundation' ? 'page' : undefined}
            onClick={() => selectTab('foundation')}
          >
            {readingRenderer === 'catalog'
              ? (language === 'ru' ? 'Основа' : 'Foundation')
              : (language === 'ru' ? 'Разбор' : 'Reading')}
          </button>
          {readingRenderer === 'catalog' ? (
            <button
              type="button"
              className={normalizedActiveTab === 'explore' ? 'is-active' : undefined}
              aria-current={normalizedActiveTab === 'explore' ? 'page' : undefined}
              onClick={() => selectTab('explore')}
            >
              {language === 'ru' ? 'Разобрать' : 'Explore'}
            </button>
          ) : null}
          {!isSavedPerson ? (
            <button
              type="button"
              className={normalizedActiveTab === 'ask' ? 'is-active' : undefined}
              aria-current={normalizedActiveTab === 'ask' ? 'page' : undefined}
              onClick={() => selectTab('ask')}
            >
              {language === 'ru' ? 'Спросить' : 'Ask'}
            </button>
          ) : null}
          <button
            type="button"
            className={normalizedActiveTab === 'matrix' ? 'is-active' : undefined}
            aria-current={normalizedActiveTab === 'matrix' ? 'page' : undefined}
            onClick={() => selectTab('matrix')}
          >
            {language === 'ru' ? 'Матрица судьбы' : 'Matrix'}
          </button>
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
      <div className="fresh-page natal-editorial-page natal-mvp-page natal-v3-page">
        {header}
        <section
          className="natal-empty-content"
          aria-live="polite"
          aria-busy={isLoadingChart || undefined}
          role={isChartError ? 'alert' : undefined}
        >
          <p className="natal-empty-kicker">{language === 'ru' ? 'Твоя карта рождения' : 'Your birth chart'}</p>
          {isLoadingChart ? (
            <>
              <h1>{language === 'ru' ? 'Загружаем натальную карту' : 'Loading your natal chart'}</h1>
              <p>{language === 'ru' ? 'Сохранённые данные уже найдены.' : 'Your saved birth data is already available.'}</p>
            </>
          ) : isChartError ? (
            <>
              <h1>{language === 'ru' ? 'Карта пока не загрузилась' : 'Your chart has not loaded yet'}</h1>
              <p>{language === 'ru' ? 'Проверь соединение и попробуй ещё раз.' : 'Check your connection and try again.'}</p>
              {onRetryChart ? (
                <button type="button" className="fresh-btn-primary" onClick={onRetryChart}>
                  {language === 'ru' ? 'Повторить' : 'Retry'}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <h1>{language === 'ru' ? 'Соберём твою натальную карту' : 'Create your birth chart'}</h1>
              <p>
                {language === 'ru'
                  ? 'Для расчёта нужны дата, время и место рождения.'
                  : 'The calculation needs your birth date, time, and place.'}
              </p>
              <button type="button" className="fresh-btn-primary" onClick={onCreateChart}>
                {language === 'ru' ? 'Ввести данные' : 'Enter birth details'}
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
  const catalogView: NatalExperienceView = normalizedActiveTab === 'explore'
    ? 'explore'
    : 'foundation';

  return (
    <div className="fresh-page natal-editorial-page natal-mvp-page natal-v3-page">
      {header}

      {normalizedActiveTab === 'map' ? (
        <section className="natal-v3-wheel-stage" aria-labelledby="natal-map-title">
          <header className="natal-v3-wheel-heading">
            <p>{language === 'ru' ? 'Карта рождения' : 'Birth chart'}</p>
            <h1 id="natal-map-title">{subjectName}</h1>
          </header>

          <NatalChartWheel
            chart={data}
            language={language}
            downloadName={`${subjectName || 'natal'}-chart`}
          />

          <dl className="natal-v3-wheel-meta">
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
            <button type="button" className="natal-v3-reference-link" onClick={onOpenEncyclopedia}>
              <span>{language === 'ru' ? 'Что означают знаки, дома и аспекты' : 'What signs, houses, and aspects mean'}</span>
              <span aria-hidden="true">→</span>
            </button>
          ) : null}
        </section>
      ) : null}

      {normalizedActiveTab === 'foundation' || normalizedActiveTab === 'explore' ? (
        <section className="natal-reading-stage natal-catalog-stage natal-v3-reading-stage">
          {readingRenderer === 'catalog' ? (
            <NatalCatalogReport
              key={`catalog:${reportSubjectKey}`}
              profile={profile}
              chartData={data}
              chartId={chartId}
              chartSubject={chartSubject}
              view={catalogView}
              onViewChange={(view) => selectTab(view)}
              requestPremium={requestPremium}
              premiumContinuation={premiumContinuation}
              onPremiumContinuationHandled={onPremiumContinuationHandled}
              canPromotePremium={canPromotePremium}
              onOpenQuestions={isSavedPerson ? undefined : openQuestions}
              hideIntro
              uiPreview={previewConfig?.catalog}
            />
          ) : (
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
          )}
        </section>
      ) : null}

      {normalizedActiveTab === 'ask' && !isSavedPerson ? (
        <section className="natal-v3-question-stage">
          <NatalQuestionExperience
            profile={profile}
            chartData={data}
            chartId={chartId}
            contextCategory={questionContext}
            onContextChange={setQuestionContext}
            requestPremium={requestPremium}
            premiumContinuation={premiumContinuation}
            onPremiumContinuationHandled={onPremiumContinuationHandled}
          />
        </section>
      ) : null}

      {matrixMounted ? (
        <div className="natal-matrix-stage" hidden={normalizedActiveTab !== 'matrix'}>
          <MatrixRoom
            profile={profile}
            onBack={() => selectTab('foundation')}
            embedded
          />
        </div>
      ) : null}
    </div>
  );
}
