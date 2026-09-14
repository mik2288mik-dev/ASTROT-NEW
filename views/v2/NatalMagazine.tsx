import React, { useEffect, useRef, useState } from 'react';
import { MonoAvatar } from '../../components/mono-ui/MonoAvatar';
import { NatalOverviewExperience, NatalOverviewMode } from '../../components/NatalReading/NatalOverviewExperience';
import styles from '../../components/NatalReading/NatalSection.module.css';
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
import { InteractiveNatalMap } from '../../components/NatalReading/InteractiveNatalMap';
import { hasActivePremium } from '../../lib/accessMatrix';
import { NatalQuestionDemo } from '../../components/NatalReading/NatalQuestionDemo';
import { NatalArtwork } from '../../components/NatalReading/NatalArtwork';


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
    questions?: React.ComponentProps<typeof NatalQuestionExperience>['uiPreview'];
  };
};

export type NatalScreenTab = 'foundation' | 'explore' | 'ask' | 'map' | 'details' | 'matrix';

export function isSavedPersonChartSubject(
  chartSubject: Pick<ChartListItem, 'subject_type' | 'is_primary'> | null | undefined,
): boolean {
  return chartSubject?.subject_type === 'saved_person' || chartSubject?.is_primary === false;
}

export function normalizeNatalScreenTab(
  tab: NatalScreenTab,
  _isSavedPerson: boolean,
): NatalScreenTab {
  // Keep the four tabs visible; saved-person questions show the existing API limitation.
  return tab;
}

type NatalPreviewInitialTab = NonNullable<NatalMagazineProps['uiPreview']>['initialTab'];

function previewTabToScreen(
  value: NatalPreviewInitialTab,
  openQuestion: boolean,
): NatalScreenTab {
  if (openQuestion || value === 'questions' || value === 'ask') return 'ask';
  if (value === 'map') return 'map';
  if (value === 'matrix') return 'map';
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
  uiPreview,
}: NatalMagazineProps) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const subjectName = chartSubject ? chartSubject.name : profile.name;
  const subjectBirthDate = chartSubject ? chartSubject.birth_date : profile.birthDate;
  const subjectBirthTime = chartSubject ? (chartSubject.birth_time ?? '') : profile.birthTime;
  const subjectBirthPlace = chartSubject ? chartSubject.birth_place : profile.birthPlace;
  const isSavedPerson = isSavedPersonChartSubject(chartSubject);
  const isPremium = hasActivePremium(profile);
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
  const [overviewMode, setOverviewMode] = useState<'story' | 'topics'>('story');
  const [questionContext, setQuestionContext] = useState<NatalReportCategoryKey>('main');

  const handledExternalQuestionRequestRef = useRef(0);
  const normalizedActiveTab = normalizeNatalScreenTab(activeTab, isSavedPerson);
  const sectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = sectionRef.current?.closest('.lumia-main-scroll');
    if (host) host.scrollTo({ top: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [normalizedActiveTab, chartId, chartSubject?.id]);

  useEffect(() => {
    if (normalizedActiveTab !== activeTab) setActiveTab(normalizedActiveTab);
  }, [activeTab, normalizedActiveTab]);

  useEffect(() => {
    if (readingRenderer !== 'classic' || normalizedActiveTab !== 'explore') return;
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
    }
    onQuestionRequestHandled?.();
  }, [chartLoadState, data, isSavedPerson, onCreateChart, onQuestionRequestHandled, openQuestionRequest, profile.isSetup]);

  useEffect(() => {
    if (!premiumContinuation || premiumContinuation.returnView !== 'chart') return;
    if (premiumContinuation.returnAction === 'open_natal_map_element') {
      setActiveTab(premiumContinuation.returnEntityId?.startsWith('details:') ? 'details' : 'map');
      return;
    }
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
      if (!isPremium) onPremiumContinuationHandled?.(premiumContinuation.paywallInstanceId);
      return;
    }
    if (
      premiumContinuation.featureKey === 'natal_deep'
      && premiumContinuation.returnAction === 'open_natal_answer'
    ) {
      setActiveTab('explore');
    }
  }, [isPremium, isSavedPerson, onPremiumContinuationHandled, premiumContinuation]);

  const selectTab = (tab: NatalScreenTab) => {
    setActiveTab(tab === 'matrix' ? 'map' : tab);
  };

  const openQuestions = (categoryKey: NatalReportCategoryKey) => {
    if (isSavedPerson) return;
    setQuestionContext(categoryKey);
    selectTab('ask');
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  };

  const header = (
    <>
      <AppTopBar title={language === 'ru' ? 'Натальная карта' : 'Natal chart'} rightAction={onOpenCharts ? <button type="button" className="app-top-bar-action" aria-label={`Выбрать сохранённую карту: ${subjectName || 'Моя карта'}`} onClick={onOpenCharts}><MonoAvatar initial={(subjectName || '?').slice(0,1)} size={36}/></button> : undefined}/>
      {data ? <nav className={styles.navigation} aria-label="Вкладки натальной карты">
        {([
          { id: 'foundation', label: 'Обзор' },
          { id: 'map', label: 'Карта' },
          { id: 'details', label: 'Подробно' },
          { id: 'ask', label: 'Спросить' },
        ] as const).map(tab => {
          const active = tab.id === normalizedActiveTab || (tab.id === 'foundation' && normalizedActiveTab === 'explore');
          return <button key={tab.id} type="button" aria-current={active ? 'page' : undefined} onClick={() => selectTab(tab.id)}>{tab.label}</button>;
        })}
      </nav> : null}
    </>
  );

  if (!data) {
    const isLoadingChart = chartLoadState === 'loading'
      || (profile.isSetup && chartLoadState === 'idle');
    const isChartError = chartLoadState === 'error'
      || (profile.isSetup && chartLoadState === 'ready');
    return (
      <div ref={sectionRef} className="fresh-page natal-editorial-page natal-mvp-page natal-v3-page">
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
  const birthLine = [formatDisplayDate(data.birth?.localDate || subjectBirthDate, language), (data.birth ? data.birth.localTime : subjectBirthTime)?.slice(0, 5) || 'Время не указано', data.birth?.place || subjectBirthPlace].filter(Boolean).join(' · ');
  const person = <header className={styles.person}><h1>{subjectName || 'Моя карта'}</h1><p>{birthLine}</p></header>;
  const catalogView: NatalExperienceView = normalizedActiveTab === 'explore'
    ? 'explore'
    : 'foundation';

  return (
    <div ref={sectionRef} className="fresh-page natal-editorial-page natal-mvp-page natal-v3-page">
      {header}

      {normalizedActiveTab === 'map' || normalizedActiveTab === 'details' ? (
        <InteractiveNatalMap
          key={reportSubjectKey}
          chart={data}
          view={normalizedActiveTab === 'details' ? 'details' : 'map'}
          name={subjectName || 'Моя карта'}
          birthLine={birthLine}
          isPremium={isPremium}
          premiumContinuation={premiumContinuation}
          onPremiumContinuationHandled={onPremiumContinuationHandled}
          onRequestPremium={(selection, view) => { void requestPremium('deep_natal', {placement:'deep_natal',featureKey:'natal_deep',triggerType:'locked_feature',returnView:'chart',returnAction:'open_natal_map_element',returnEntityId:`${view}:${selection.kind}:${selection.id}`}); }}
        />
      ) : null}

      {normalizedActiveTab === 'foundation' || normalizedActiveTab === 'explore' ? (
        <section className={styles.content}>
          {person}
          <div className={styles.mode} role="group" aria-label="Как читать обзор">{(['story','topics'] as const).map(mode => <button type="button" key={mode} aria-pressed={overviewMode === mode} onClick={() => {setOverviewMode(mode); if (mode === 'story') selectTab('foundation');}}>{mode === 'story' ? 'Рассказ' : 'По темам'}</button>)}</div>
          <NatalOverviewMode.Provider value={{mode:overviewMode,onTopics:() => setOverviewMode('topics')}}>
          {readingRenderer === 'catalog' ? (
            <NatalCatalogReport
              key={`catalog:${reportSubjectKey}`}
              profile={profile}
              chartData={data}
              chartId={chartId}
              chartSubject={chartSubject}
              view={catalogView}
              onViewChange={(view) => { if (view === 'explore') setOverviewMode('topics'); selectTab(view); }}
              experienceComponent={NatalOverviewExperience}
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
              overviewMode={overviewMode}
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
          </NatalOverviewMode.Provider>
        </section>
      ) : null}

      {normalizedActiveTab === 'ask' ? (
        <section className={styles.content}>
          {person}
          {isSavedPerson ? <section className={styles.state}><h2>Вопросы по своей карте</h2><p>Сейчас «Спросить о себе» работает только с твоей основной картой. Для вопросов выбери её через аватар в шапке.</p></section> :
          !isPremium ? <NatalQuestionDemo chart={data} onRequestPremium={() => {void requestPremium('natal_questions',{placement:'natal_questions',featureKey:'natal_questions',triggerType:'locked_feature',returnView:'chart',returnAction:'open_natal_questions'});}}/> : <div className={styles.premiumQuestions}><NatalArtwork art="plus" className={styles.questionArtwork}/><NatalQuestionExperience
            key={reportSubjectKey}
            uiPreview={previewConfig?.questions}
            profile={profile}
            chartData={data}
            chartId={chartId}
            contextCategory={questionContext}
            onContextChange={setQuestionContext}
            requestPremium={requestPremium}
            premiumContinuation={premiumContinuation}
            onPremiumContinuationHandled={onPremiumContinuationHandled}
          /></div>}
        </section>
      ) : null}

    </div>
  );
}
