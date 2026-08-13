import React from 'react';
import type { NatalChartData, UserProfile } from '../../types';
import type { PreloadedNatalReport } from '../../components/NatalReading/HumanReport';
import { formatDisplayDate } from '../../lib/date-utils';
import { HumanReport } from '../../components/NatalReading/HumanReport';
import { ShimmerStyles } from '../../components/NatalReading/Skeleton';
import { MonoIllustChart } from '../../components/mono-ui';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { FreshPageTitle } from '../../components/fresh-ui';
import { NatalChartPortrait } from '../../components/NatalReading/NatalChartPortrait';
import { selectNatalEditorialSticker } from '../../lib/personalForecastVisuals';
import { buildPersonalForecastChartFingerprint } from '../../lib/personalForecastContract';
import type { ChartListItem } from '../../services/storageService';

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
};

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
}: NatalMagazineProps) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const subjectName = chartSubject?.name || profile.name;
  const subjectBirthDate = chartSubject?.birth_date || profile.birthDate;

  if (!data) {
    return (
      <div className="fresh-page natal-editorial-page">
        <AppTopBar title={language === 'ru' ? 'Натальная карта' : 'Natal chart'} />
        <FreshPageTitle
          kicker={language === 'ru' ? 'Карта' : 'Chart'}
          title={language === 'ru' ? 'Рассчитай натальную карту' : 'Calculate your natal chart'}
        />
        <section className="natal-empty-technical" aria-hidden>
          <MonoIllustChart size={120} className="opacity-90" />
        </section>
        <div className="natal-empty-content">
          <p>
            {language === 'ru'
              ? 'Для расчёта нужны дата, время и место рождения.'
              : 'The calculation needs your birth date, time, and place.'}
          </p>
          <button type="button" className="fresh-btn-primary" onClick={onCreateChart}>
            {language === 'ru' ? 'Ввести данные' : 'Enter birth details'}
          </button>
        </div>
      </div>
    );
  }

  const reportSubjectKey = [
    chartSubject?.subject_type || 'self',
    chartSubject?.id ?? chartId ?? 'primary',
    chartSubject?.input_hash || buildPersonalForecastChartFingerprint(data),
    chartSubject?.calculation_version || data.calculationVersion || 'unknown',
  ].join(':');
  const natalSticker = selectNatalEditorialSticker({
    chartKey: reportSubjectKey,
    userId: profile.id ? String(profile.id) : null,
  });

  return (
    <div className="fresh-page natal-editorial-page">
      <ShimmerStyles />

      <AppTopBar
        title={language === 'ru' ? 'Твой гороскоп' : 'Your Horoscope'}
      />

      <header className="natal-magazine-heading">
        <h1>{language === 'ru' ? 'Натальная карта' : 'Natal chart'}</h1>
        <p>{subjectName} · {formatDisplayDate(subjectBirthDate, language)}</p>
      </header>

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

      <NatalChartPortrait chart={data} language={language} />

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
      />
    </div>
  );
}
