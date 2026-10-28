import React, { useEffect, useRef, useState } from 'react';
import { useTelemetrySection } from '../../services/useAppTelemetry';
import { MyChartHeader, type MyChartSegment } from '../../components/nebo/MyChartHeader';
import { sunSignFromDate } from '../../lib/synastry/compatScore';
import { getZodiacSign } from '../../constants';
import styles from '../../components/NatalReading/NatalSection.module.css';
import type { NatalChartData, UserProfile } from '../../types';
import { formatDisplayDate } from '../../lib/date-utils';
import { NatalQuestionExperience } from '../../components/NatalReading/NatalQuestionExperience';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { InteractiveNatalMap } from '../../components/NatalReading/InteractiveNatalMap';
import { hasFullPremium } from '../../lib/accessMatrix';
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
  /** Another part of «Моя карта»: Матрица, Числа, Таро, Руны. */
  onOpenSegment?: (segment: MyChartSegment) => void;
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
  onOpenEncyclopedia,
  onOpenSegment,
}: NatalMagazineProps) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const subjectName = chartSubject ? chartSubject.name : profile.name;
  const subjectBirthDate = chartSubject ? chartSubject.birth_date : profile.birthDate;
  const subjectBirthTime = chartSubject ? (chartSubject.birth_time ?? '') : profile.birthTime;
  const subjectBirthPlace = chartSubject ? chartSubject.birth_place : profile.birthPlace;
  const isSavedPerson = isSavedPersonChartSubject(chartSubject);
  const isPremium = hasFullPremium(profile);
  const [activeTab, setActiveTab] = useState<NatalScreenTab>(() => normalizeNatalScreenTab(
    'foundation',
    isSavedPerson,
  ));
  const [overviewMode, setOverviewMode] = useState<'story' | 'topics'>('story');

  const handledExternalQuestionRequestRef = useRef(0);
  const normalizedActiveTab = normalizeNatalScreenTab(activeTab, isSavedPerson);
  useTelemetrySection('chart', normalizedActiveTab);
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


  const sunSign = sunSignFromDate(subjectBirthDate);
  const header = (
    <>
      <AppTopBar title={language === 'ru' ? 'Натальная карта' : 'Natal chart'} />
      <MyChartHeader
        title={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
        subtitle={[subjectName, sunSign ? getZodiacSign(language, sunSign) : ''].filter(Boolean).join(' · ')}
        active="natal"
        onOpen={(segment) => onOpenSegment?.(segment)}
        whoseLabel={isSavedPerson ? subjectName : (language === 'ru' ? 'Моя' : 'Mine')}
        onChooseWhose={onOpenCharts}
      />
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

      <section className={styles.content}>
        {person}
        {canonicalChart ? <NatalCalculationProof key={`proof:${reportSubjectKey}`} chart={canonicalChart} name={subjectName || 'Моя карта'} /> : null}
        {canonicalChart ? <NatalHighlights key={`big-three:${reportSubjectKey}`} chart={canonicalChart} part="big-three" /> : null}
        {canonicalChart ? <NatalHighlights key={`moments:${reportSubjectKey}`} chart={canonicalChart} part="moments" /> : null}
        <h2 className={styles.readingHeading}>Рассказ о тебе</h2>
        <div className={styles.mode} role="group" aria-label="Как читать рассказ">{(['story','topics'] as const).map(mode => <button type="button" key={mode} aria-pressed={overviewMode === mode} onClick={() => setOverviewMode(mode)}>{mode === 'story' ? 'Рассказ' : 'По темам'}</button>)}</div>
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

      {isSavedPerson ? null : (
        <section id="natal-ask" className={styles.content}>
          <div className={styles.premiumQuestions}><NatalQuestionExperience
            key={reportSubjectKey}
            profile={profile}
            chartData={data}
            chartId={chartId}
            requestPremium={requestPremium}
            premiumContinuation={premiumContinuation}
            onPremiumContinuationHandled={onPremiumContinuationHandled}
          /></div>
        </section>
      )}

      {canonicalChart ? (
        <section className={styles.content}>
          <h2 className={styles.readingHeading}>Карта в цифрах</h2>
          <NatalProfileTab key={`profile:${reportSubjectKey}`} chart={canonicalChart} />
        </section>
      ) : null}

      {onOpenEncyclopedia ? (
        <button type="button" className="nebo-row-link" onClick={onOpenEncyclopedia}>
          <span>Справочник: планеты, знаки, дома, аспекты и точки</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      ) : null}

    </div>
  );
}
