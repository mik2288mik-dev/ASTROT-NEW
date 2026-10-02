import React, { useEffect, useRef, useState } from 'react';
import { MonoAvatar } from '../../components/mono-ui/MonoAvatar';
import styles from '../../components/NatalReading/NatalSection.module.css';
import type { NatalChartData, UserProfile } from '../../types';
import { formatDisplayDate } from '../../lib/date-utils';
import { NatalQuestionExperience } from '../../components/NatalReading/NatalQuestionExperience';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { InteractiveNatalMap } from '../../components/NatalReading/InteractiveNatalMap';
import { hasActivePremium } from '../../lib/accessMatrix';
import { NatalUnifiedReport } from '../../components/NatalReading/NatalUnifiedReport';
import { NatalHighlights } from '../../components/NatalReading/NatalHighlights';
import { NatalProfileTab } from '../../components/NatalReading/NatalProfileTab';
import { NatalCalculationProof } from '../../components/NatalReading/NatalCalculationProof';
import { isCanonicalNatalChart } from '../../lib/natalCalculationProof';


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
  preloadedReport?: unknown;
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
    premiumReport?: unknown;
    catalog?: unknown;
    questions?: React.ComponentProps<typeof NatalQuestionExperience>['uiPreview'];
  };
};

export type NatalScreenTab = 'foundation' | 'explore' | 'ask' | 'map' | 'matrix' | 'profile';

export function isSavedPersonChartSubject(
  chartSubject: Pick<ChartListItem, 'subject_type' | 'is_primary'> | null | undefined,
): boolean {
  return chartSubject?.subject_type === 'saved_person' || chartSubject?.is_primary === false;
}

export function normalizeNatalScreenTab(
  tab: NatalScreenTab,
  _isSavedPerson: boolean,
): NatalScreenTab {
  // Keep the three product tabs visible; saved-person questions show the existing API limitation.
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
  const [activeTab, setActiveTab] = useState<NatalScreenTab>(() => normalizeNatalScreenTab(
    previewTabToScreen(previewConfig?.initialTab, Boolean(previewConfig?.openQuestion)),
    isSavedPerson,
  ));
  const [overviewMode, setOverviewMode] = useState<'story' | 'topics'>('story');

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
      setActiveTab('ask');
    }
    onQuestionRequestHandled?.();
  }, [chartLoadState, data, isSavedPerson, onCreateChart, onQuestionRequestHandled, openQuestionRequest, profile.isSetup]);

  useEffect(() => {
    if (!premiumContinuation || premiumContinuation.returnView !== 'chart') return;
    if (premiumContinuation.returnAction === 'open_natal_map_element') {
      setActiveTab('map');
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


  const header = (
    <>
      <AppTopBar title={language === 'ru' ? 'Натальная карта' : 'Natal chart'} rightAction={onOpenCharts ? <button type="button" className="app-top-bar-action" aria-label={`Выбрать сохранённую карту: ${subjectName || 'Моя карта'}`} onClick={onOpenCharts}><MonoAvatar initial={(subjectName || '?').slice(0,1)} size={36}/></button> : undefined}/>
      {data ? <nav className={`${styles.navigation} editorial-tabs`} aria-label="Вкладки натальной карты" style={{ '--editorial-tab-count': 4 } as React.CSSProperties}>
        {([
          { id: 'foundation', label: 'Обзор' },
          { id: 'map', label: 'Карта' },
          { id: 'profile', label: 'Профиль' },
          { id: 'ask', label: 'Спросить' },
        ] as const).map(tab => {
          const active = tab.id === normalizedActiveTab || (tab.id === 'foundation' && normalizedActiveTab === 'explore');
          return <button key={tab.id} type="button" className={`editorial-tab${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => selectTab(tab.id)}>{tab.label}</button>;
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
  const canonicalChart = isCanonicalNatalChart(data) ? data : null;
  const person = <header className={styles.personInline}><h1>{subjectName || 'Моя карта'}</h1><p title={birthLine}>{birthLine}</p></header>;

  return (
    <div ref={sectionRef} className="fresh-page natal-editorial-page natal-mvp-page natal-v3-page">
      {header}

      {normalizedActiveTab === 'map' ? (
        <InteractiveNatalMap
          key={reportSubjectKey}
          chart={data}
          view="map"
          name={subjectName || 'Моя карта'}
          birthLine={birthLine}
          isPremium={isPremium}
          premiumContinuation={premiumContinuation}
          onPremiumContinuationHandled={onPremiumContinuationHandled}
          onRequestPremium={(selection, view) => { void requestPremium('deep_natal', {placement:'deep_natal',featureKey:'natal_deep',triggerType:'locked_feature',returnView:'chart',returnAction:'open_natal_map_element',returnEntityId:`${view}:${selection.kind}:${selection.id}`}); }}
        />
      ) : null}

      {normalizedActiveTab === 'map' && canonicalChart ? (
        <section className={styles.content}>
          <NatalCalculationProof key={`proof:${reportSubjectKey}`} chart={canonicalChart} name={subjectName || 'Моя карта'} />
        </section>
      ) : null}

      {normalizedActiveTab === 'profile' ? (
        <section className={styles.content}>
          {person}
          {canonicalChart ? <NatalProfileTab key={`profile:${reportSubjectKey}`} chart={canonicalChart} /> : null}
        </section>
      ) : null}

      {normalizedActiveTab === 'foundation' || normalizedActiveTab === 'explore' ? (
        <section className={styles.content}>
          {person}
          {canonicalChart ? <NatalHighlights key={`highlights:${reportSubjectKey}`} chart={canonicalChart} /> : null}
          {canonicalChart ? <h2 className={styles.readingHeading}>Рассказ о тебе</h2> : null}
          <div className={styles.mode} role="group" aria-label="Как читать обзор">{(['story','topics'] as const).map(mode => <button type="button" key={mode} aria-pressed={overviewMode === mode} onClick={() => {setOverviewMode(mode); if (mode === 'story') selectTab('foundation');}}>{mode === 'story' ? 'Рассказ' : 'По темам'}</button>)}</div>
          <NatalUnifiedReport
            key={`unified:${reportSubjectKey}`}
            profile={profile}
            chartData={data}
            chartId={chartId}
            mode={overviewMode}
            isPremium={isPremium}
            savedPerson={isSavedPerson}
            canPromotePremium={canPromotePremium}
            requestPremium={requestPremium}
          />
        </section>
      ) : null}

      {normalizedActiveTab === 'ask' ? (
        <section className={styles.content}>
          {person}
          {isSavedPerson ? <section className={styles.state}><h2>Вопросы по своей карте</h2><p>Сейчас «Спросить о себе» работает только с твоей основной картой. Для вопросов выбери её через аватар в шапке.</p></section> :
          <div className={styles.premiumQuestions}><NatalQuestionExperience
            key={reportSubjectKey}
            uiPreview={previewConfig?.questions}
            profile={profile}
            chartData={data}
            chartId={chartId}
            requestPremium={requestPremium}
            premiumContinuation={premiumContinuation}
            onPremiumContinuationHandled={onPremiumContinuationHandled}
          /></div>}
        </section>
      ) : null}

    </div>
  );
}
