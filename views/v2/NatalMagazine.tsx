import React from 'react';
import type { NatalChartData, NatalInterpretationReport, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { formatDisplayDate } from '../../lib/date-utils';
import { HumanReport } from '../../components/NatalReading/HumanReport';
import { ShimmerStyles } from '../../components/NatalReading/Skeleton';
import { MonoIllustChart } from '../../components/mono-ui';
import { AppTopBar } from '../../components/lumia-ui/AppTopBar';
import { FreshPageTitle } from '../../components/fresh-ui';
import { PlanetIcon } from '../../components/icons/PlanetIcon';
import { EditorialSticker } from '../../components/EditorialSticker';
import { getZodiacEditorialSticker } from '../../lib/personalForecastVisuals';
import { getNatalReliability } from '../../lib/natalSemanticCompiler';
import { buildPersonalForecastChartFingerprint } from '../../lib/personalForecastContract';
import type { ChartListItem } from '../../services/storageService';

type NatalMagazineProps = {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  chartSubject?: ChartListItem | null;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  onUpdateProfile?: (profile: UserProfile) => void;
  preloadedReport?: NatalInterpretationReport | null;
  onCreateChart?: () => void;
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
}: NatalMagazineProps) {
  const language = profile.language === 'en' ? 'en' : 'ru';
  const natalSticker = data ? getZodiacEditorialSticker(String(data.sun.sign)) : null;
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
        <p style={{ padding: '0 20px', margin: '0 0 18px', fontSize: 15, lineHeight: 1.5, color: 'var(--fresh-muted)' }}>
          {language === 'ru'
            ? 'Для расчёта нужны дата, время и место рождения.'
            : 'The calculation needs your birth date, time, and place.'}
        </p>
        <button type="button" className="fresh-btn-primary" onClick={onCreateChart}>
          {language === 'ru' ? 'Ввести данные' : 'Enter birth details'}
        </button>
      </div>
    );
  }

  const reliability = getNatalReliability(data);
  const bigThree = [
    { planet: 'sun', label: language === 'ru' ? 'Солнце' : 'Sun', sign: data.sun.sign },
    { planet: 'moon', label: language === 'ru' ? 'Луна' : 'Moon', sign: data.moon.sign },
    ...(reliability.anglesReliable
      ? [{ planet: 'asc', label: language === 'ru' ? 'Асцендент' : 'Rising', sign: data.rising.sign }]
      : []),
  ];
  const reportSubjectKey = [
    chartSubject?.subject_type || 'self',
    chartSubject?.id ?? chartId ?? 'primary',
    chartSubject?.input_hash || buildPersonalForecastChartFingerprint(data),
    chartSubject?.calculation_version || data.calculationVersion || 'unknown',
  ].join(':');

  return (
    <div className="fresh-page natal-editorial-page">
      <ShimmerStyles />

      <AppTopBar
        title={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
        subtitle={`${subjectName} · ${formatDisplayDate(subjectBirthDate, language)}`}
      />

      <section
        className="product-screen-cover product-screen-cover--natal"
        aria-label={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
      >
        <div className="product-screen-cover-copy">
          <div className="product-screen-cover-title">{language === 'ru' ? 'Твоя карта рождения' : 'Your birth chart'}</div>
          <div className="product-screen-cover-text">
            {language === 'ru'
              ? 'Характер, привычные реакции, отношения, деньги и работа — по данным рождения.'
              : 'Character, usual reactions, relationships, money, and work based on your birth data.'}
          </div>
        </div>
      </section>

      <div className="natal-big3">
        {bigThree.map((it) => (
          <div key={it.planet} className="natal-big3-card">
            <div className="natal-big3-ico"><PlanetIcon planet={it.planet} size={18} strokeWidth={1.5} /></div>
            <div className="natal-big3-text">
              <div className="natal-big3-planet">{it.label}</div>
              <div className="natal-big3-sign">{getZodiacSign(language, it.sign)}</div>
            </div>
          </div>
        ))}
      </div>

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
      />
      {natalSticker ? (
        <EditorialSticker asset={natalSticker} className="natal-zodiac-sticker natal-zodiac-sticker--inline" />
      ) : null}
    </div>
  );
}
