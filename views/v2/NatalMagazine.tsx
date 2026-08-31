import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import type { NatalChartData, UserProfile } from '../../types';
import type { PreloadedNatalReport } from '../../components/NatalReading/HumanReport';
import type { NatalPermanentPremiumReport } from '../../lib/natalReading/permanentReport';
import { formatDisplayDate } from '../../lib/date-utils';
import { HumanReport } from '../../components/NatalReading/HumanReport';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { NatalChartWheel } from '../../components/NatalReading/NatalChartWheel';
import { MatrixRoom } from './MatrixRoom';
import {
  EditorialCurve,
  EditorialChartsButton,
  EditorialTabs,
} from '../../components/editorial/EditorialScreenChrome';
import { buildNatalChartFingerprint } from '../../lib/natalChartFingerprint';
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
    initialTab?: 'map' | 'reading' | 'questions';
    openQuestion?: boolean;
    reportState?: 'ready' | 'loading' | 'error';
    premiumReport?: NatalPermanentPremiumReport | null;
  };
};

export type NatalScreenTab = 'map' | 'reading' | 'questions' | 'matrix';

export function isSavedPersonChartSubject(
  chartSubject: Pick<ChartListItem, 'subject_type' | 'is_primary'> | null | undefined,
): boolean {
  return chartSubject?.subject_type === 'saved_person' || chartSubject?.is_primary === false;
}

export function normalizeNatalScreenTab(
  tab: NatalScreenTab,
  isSavedPerson: boolean,
): NatalScreenTab {
  return isSavedPerson && tab === 'questions' ? 'map' : tab;
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
  const [activeTab, setActiveTab] = useState<NatalScreenTab>(() => (
    normalizeNatalScreenTab(
      previewConfig?.openQuestion ? 'questions' : previewConfig?.initialTab || 'map',
      isSavedPerson,
    )
  ));
  const normalizedActiveTab = normalizeNatalScreenTab(activeTab, isSavedPerson);
  const [matrixMounted, setMatrixMounted] = useState(false);
  const handledExternalQuestionRequestRef = useRef(0);
  const tabs = useMemo(() => {
    const availableTabs = [
      { id: 'map' as const, label: language === 'ru' ? 'Карта' : 'Chart' },
      { id: 'reading' as const, label: language === 'ru' ? 'Разбор' : 'Reading' },
      { id: 'questions' as const, label: language === 'ru' ? 'Спросить о себе' : 'Ask about yourself' },
      { id: 'matrix' as const, label: language === 'ru' ? 'Матрица судьбы' : 'Matrix' },
    ];
    return isSavedPerson
      ? availableTabs.filter((tab) => tab.id !== 'questions')
      : availableTabs;
  }, [isSavedPerson, language]);

  useEffect(() => {
    if (normalizedActiveTab !== activeTab) setActiveTab(normalizedActiveTab);
  }, [activeTab, normalizedActiveTab]);

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
    if (!isSavedPerson) setActiveTab('questions');
    onQuestionRequestHandled?.();
  }, [chartLoadState, data, isSavedPerson, onCreateChart, onQuestionRequestHandled, openQuestionRequest, profile.isSetup]);

  useEffect(() => {
    if (
      premiumContinuation?.returnView !== 'chart'
      || premiumContinuation.featureKey !== 'natal_questions'
      || premiumContinuation.returnAction !== 'open_natal_questions'
    ) return;
    if (isSavedPerson) {
      setActiveTab('map');
      onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
      return;
    }
    setActiveTab('questions');
  }, [isSavedPerson, onPremiumContinuationHandled, premiumContinuation]);

  const selectTab = (tab: NatalScreenTab) => {
    if (isSavedPerson && tab === 'questions') return;
    if (tab === 'matrix') setMatrixMounted(true);
    setActiveTab(tab);
  };

  const header = (
    <>
      <AppTopBar
        title={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
        rightAction={(
          <EditorialChartsButton
            label={language === 'ru' ? 'Открыть мои карты' : 'Open my charts'}
            onClick={onOpenCharts}
          />
        )}
      />
      {data ? (
        <EditorialTabs
          label={language === 'ru' ? 'Разделы натальной карты' : 'Natal chart sections'}
          tabs={tabs}
          activeTab={normalizedActiveTab}
          onTabChange={selectTab}
          className="natal-editorial-tabs"
        />
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
        <EditorialCurve className="natal-empty-curve" />
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
              <h1>{language === 'ru' ? 'Соберём настоящий натальный круг' : 'Create your real natal wheel'}</h1>
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
  return (
    <div className="fresh-page natal-editorial-page natal-mvp-page">
      {header}

      {normalizedActiveTab === 'map' ? (
        <section className="natal-map-stage" aria-labelledby="natal-map-title">
          <header className="natal-map-heading">
            <p>{language === 'ru' ? 'Карта рождения' : 'Birth chart'}</p>
            <h1 id="natal-map-title">{subjectName}</h1>
          </header>

          <NatalChartWheel
            chart={data}
            language={language}
            downloadName={`${subjectName || 'natal'}-chart`}
          />

          <dl className="natal-map-meta">
            <div>
              <dt><CalendarDays aria-hidden="true" strokeWidth={1.45} />{language === 'ru' ? 'Дата' : 'Date'}</dt>
              <dd>{formatDisplayDate(subjectBirthDate, language)}</dd>
            </div>
            <div>
              <dt><Clock3 aria-hidden="true" strokeWidth={1.45} />{language === 'ru' ? 'Время' : 'Time'}</dt>
              <dd>{subjectBirthTime || (language === 'ru' ? 'Не указано' : 'Not specified')}</dd>
            </div>
            <div>
              <dt><MapPin aria-hidden="true" strokeWidth={1.45} />{language === 'ru' ? 'Место' : 'Place'}</dt>
              <dd>{subjectBirthPlace || (language === 'ru' ? 'Не указано' : 'Not specified')}</dd>
            </div>
          </dl>

          {onOpenEncyclopedia ? (
            <button type="button" className="editorial-context-link" onClick={onOpenEncyclopedia}>
              <span>{language === 'ru' ? 'Открыть энциклопедию астрологии' : 'Open the astrology encyclopedia'}</span>
              <span aria-hidden="true">→</span>
            </button>
          ) : null}
          <EditorialCurve className="natal-map-curve" />
        </section>
      ) : null}

      {normalizedActiveTab === 'reading' || normalizedActiveTab === 'questions' ? (
        <section
          className={`natal-reading-stage${normalizedActiveTab === 'questions' ? ' natal-question-stage' : ''}`}
          aria-labelledby={normalizedActiveTab === 'questions' ? 'natal-question-page-title' : 'natal-reading-page-title'}
        >
          <header className="natal-magazine-heading">
            <p>{subjectName} · {formatDisplayDate(subjectBirthDate, language)}</p>
            <h1
              id={normalizedActiveTab === 'questions' ? 'natal-question-page-title' : 'natal-reading-page-title'}
              className={normalizedActiveTab === 'reading' ? 'natal-reading-page-title' : undefined}
            >
              {normalizedActiveTab === 'questions' ? (
                language === 'ru' ? 'Спросить о себе' : 'Ask about yourself'
              ) : (
                language === 'ru' ? 'Натальная карта' : 'Natal chart'
              )}
            </h1>
            {normalizedActiveTab === 'questions' ? (
              <p className="natal-question-intro">
                {language === 'ru'
                  ? 'Задай один конкретный вопрос. Ответ будет опираться только на уже рассчитанную карту.'
                  : 'Ask one specific question. The answer will use only the chart already calculated.'}
              </p>
            ) : null}
          </header>
          <EditorialCurve className={`natal-reading-curve${normalizedActiveTab === 'questions' ? ' natal-question-curve' : ''}`} />
          <HumanReport
            key={reportSubjectKey}
            profile={profile}
            chartData={data}
            chartId={chartId}
            chartSubject={chartSubject}
            requestPremium={requestPremium}
            onUpdateProfile={onUpdateProfile}
            preloadedReport={preloadedReport}
            hideIntro
            surface={normalizedActiveTab === 'questions' ? 'questions' : 'reading'}
            premiumContinuation={premiumContinuation}
            onPremiumContinuationHandled={onPremiumContinuationHandled}
            canPromotePremium={canPromotePremium}
            onOpenQuestions={isSavedPerson ? undefined : () => {
              selectTab('questions');
              requestAnimationFrame(() => {
                window.scrollTo({ top: 0, behavior: 'auto' });
              });
            }}
            uiPreview={previewConfig ? {
              state: previewConfig.reportState || 'ready',
              premiumReport: previewConfig.premiumReport,
            } : undefined}
          />
        </section>
      ) : null}

      {matrixMounted ? (
        <div className="natal-matrix-stage" hidden={normalizedActiveTab !== 'matrix'}>
          <MatrixRoom
            profile={profile}
            onBack={() => setActiveTab('map')}
            embedded
          />
        </div>
      ) : null}
    </div>
  );
}
