import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Clock3, MapPin } from 'lucide-react';
import type { NatalChartData, UserProfile } from '../../types';
import type { PreloadedNatalReport } from '../../components/NatalReading/HumanReport';
import { formatDisplayDate } from '../../lib/date-utils';
import { HumanReport } from '../../components/NatalReading/HumanReport';
import { ShimmerStyles } from '../../components/NatalReading/Skeleton';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { NatalChartWheel } from '../../components/NatalReading/NatalChartWheel';
import {
  EditorialCurve,
  EditorialProfileButton,
  EditorialTabs,
} from '../../components/editorial/EditorialScreenChrome';
import { selectNatalEditorialSticker } from '../../lib/personalForecastVisuals';
import { buildNatalChartFingerprint } from '../../lib/natalChartFingerprint';
import type { ChartListItem } from '../../services/storageService';
import type { PaywallContext } from '../../lib/paywallContext';

type NatalMagazineProps = {
  data: NatalChartData | null;
  profile: UserProfile;
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
  onOpenProfile?: () => void;
  onOpenMatrix?: () => void;
  onOpenEncyclopedia?: () => void;
};

type NatalScreenTab = 'map' | 'reading' | 'matrix' | 'questions';

export function NatalMagazine({
  data,
  profile,
  chartId,
  chartSubject,
  requestPremium,
  onUpdateProfile,
  preloadedReport,
  onCreateChart,
  onOpenPersonalityReport,
  premiumContinuation,
  onPremiumContinuationHandled,
  canPromotePremium,
  openQuestionRequest,
  onQuestionRequestHandled,
  onOpenProfile,
  onOpenMatrix,
  onOpenEncyclopedia,
}: NatalMagazineProps) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const subjectName = chartSubject ? chartSubject.name : profile.name;
  const subjectBirthDate = chartSubject ? chartSubject.birth_date : profile.birthDate;
  const subjectBirthTime = chartSubject ? (chartSubject.birth_time ?? '') : profile.birthTime;
  const subjectBirthPlace = chartSubject ? chartSubject.birth_place : profile.birthPlace;
  const [activeTab, setActiveTab] = useState<NatalScreenTab>('map');
  const [questionOpenRequest, setQuestionOpenRequest] = useState(0);
  const handledExternalQuestionRequestRef = useRef(0);
  const tabs = useMemo(() => [
    { id: 'map' as const, label: language === 'ru' ? 'Карта' : 'Chart' },
    { id: 'reading' as const, label: language === 'ru' ? 'Натальная карта' : 'Reading' },
    { id: 'matrix' as const, label: language === 'ru' ? 'Матрица судьбы' : 'Matrix' },
    { id: 'questions' as const, label: language === 'ru' ? 'Вопросы по карте' : 'Chart questions' },
  ], [language]);

  useEffect(() => {
    if (
      !openQuestionRequest
      || handledExternalQuestionRequestRef.current === openQuestionRequest
    ) return;
    if (!data) {
      onCreateChart?.();
      return;
    }
    handledExternalQuestionRequestRef.current = openQuestionRequest;
    setActiveTab('reading');
    setQuestionOpenRequest((value) => value + 1);
    onQuestionRequestHandled?.();
  }, [data, onCreateChart, onQuestionRequestHandled, openQuestionRequest]);

  const selectTab = (tab: NatalScreenTab) => {
    if (tab === 'matrix') {
      onOpenMatrix?.();
      return;
    }
    if (tab === 'questions') {
      if (!data) {
        onCreateChart?.();
        return;
      }
      setActiveTab('reading');
      setQuestionOpenRequest((value) => value + 1);
      return;
    }
    setActiveTab(tab);
  };

  const header = (
    <>
      <AppTopBar
        title={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
        rightAction={(
          <EditorialProfileButton
            label={language === 'ru' ? 'Открыть профиль' : 'Open profile'}
            onClick={onOpenProfile}
          />
        )}
      />
      <EditorialTabs
        label={language === 'ru' ? 'Разделы натальной карты' : 'Natal chart sections'}
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={selectTab}
        className="natal-editorial-tabs"
      />
    </>
  );

  if (!data) {
    return (
      <div className="fresh-page natal-editorial-page">
        {header}
        <EditorialCurve className="natal-empty-curve" />
        <section className="natal-empty-content">
          <p className="natal-empty-kicker">{language === 'ru' ? 'Твоя карта рождения' : 'Your birth chart'}</p>
          <h1>{language === 'ru' ? 'Соберём настоящий натальный круг' : 'Create your real natal wheel'}</h1>
          <p>
            {language === 'ru'
              ? 'Для расчёта нужны дата, время и место рождения.'
              : 'The calculation needs your birth date, time, and place.'}
          </p>
          <button type="button" className="fresh-btn-primary" onClick={onCreateChart}>
            {language === 'ru' ? 'Ввести данные' : 'Enter birth details'}
          </button>
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
  const natalSticker = selectNatalEditorialSticker({
    chartKey: reportSubjectKey,
    userId: profile.id ? String(profile.id) : null,
  });

  return (
    <div className="fresh-page natal-editorial-page">
      <ShimmerStyles />
      {header}

      {activeTab === 'map' ? (
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
      ) : (
        <section className="natal-reading-stage" aria-label={language === 'ru' ? 'Разбор натальной карты' : 'Natal chart reading'}>
          <header className="natal-magazine-heading">
            <p>{subjectName} · {formatDisplayDate(subjectBirthDate, language)}</p>
            <h1>{language === 'ru' ? 'Кто вы на самом деле?' : 'Who are you, really?'}</h1>
          </header>
          <EditorialCurve className="natal-reading-curve" />
          <section className="natal-personality-entry">
            <div>
              <h2>{language === 'ru' ? 'Разбор личности' : 'Personality reading'}</h2>
              <p>
                {language === 'ru'
                  ? 'Сначала — живой портрет человека. Расчёт и профессиональные детали останутся в карте.'
                  : 'Start with a clear human portrait. The calculation and professional details stay in the chart.'}
              </p>
            </div>
            <button type="button" onClick={onOpenPersonalityReport}>
              {language === 'ru' ? 'Открыть разбор' : 'Open reading'}
            </button>
          </section>
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
            editorialSticker={natalSticker}
            openQuestionRequest={questionOpenRequest}
            premiumContinuation={premiumContinuation}
            onPremiumContinuationHandled={onPremiumContinuationHandled}
            canPromotePremium={canPromotePremium}
          />
        </section>
      )}
    </div>
  );
}
