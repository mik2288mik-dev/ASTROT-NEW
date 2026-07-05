import React from 'react';
import type { NatalChartData, NatalInterpretationReport, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { formatLumiaDate } from '../../lib/date-utils';
import { HumanReport } from '../../components/NatalReading/HumanReport';
import { ChartBalance } from '../../components/NatalReading/ChartBalance';
import { ShimmerStyles } from '../../components/NatalReading/Skeleton';
import { MonoIllustChart } from '../../components/mono-ui';
import { FreshInnerHeader } from '../../components/fresh-ui/FreshHeaders';
import { FreshPageTitle, FreshHeroCard } from '../../components/fresh-ui';
import { PlanetIcon } from '../../components/icons/PlanetIcon';

type NatalMagazineProps = {
  data: NatalChartData | null;
  profile: UserProfile;
  chartId?: number;
  requestPremium: (source?: string, payload?: Record<string, unknown>) => void | Promise<void>;
  onUpdateProfile?: (profile: UserProfile) => void;
  preloadedReport?: NatalInterpretationReport | null;
  onCreateChart?: () => void;
  onOpenPersonalDaily?: () => void;
};

export function NatalMagazine({
  data,
  profile,
  chartId,
  requestPremium,
  onUpdateProfile,
  preloadedReport,
  onCreateChart,
}: NatalMagazineProps) {
  const language = profile.language === 'en' ? 'en' : 'ru';

  if (!data) {
    return (
      <div className="fresh-page">
        <FreshPageTitle
          kicker={language === 'ru' ? 'Карта' : 'Chart'}
          title={language === 'ru' ? 'Создай натальную карту' : 'Create your natal chart'}
        />
        <FreshHeroCard color="mint">
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MonoIllustChart size={120} className="opacity-90" />
          </div>
        </FreshHeroCard>
        <p style={{ padding: '0 20px', margin: '0 0 18px', fontSize: 15, lineHeight: 1.5, color: 'var(--fresh-muted)' }}>
          {language === 'ru'
            ? 'Астролог рассчитает карту по дате, времени и месту рождения.'
            : 'The astrologer calculates your chart from birth date, time, and place.'}
        </p>
        <button type="button" className="fresh-btn-primary" onClick={onCreateChart}>
          {language === 'ru' ? 'Создать карту' : 'Create chart'}
        </button>
      </div>
    );
  }

  const bigThree = [
    { planet: 'sun', label: language === 'ru' ? 'Солнце' : 'Sun', sign: data.sun.sign },
    { planet: 'moon', label: language === 'ru' ? 'Луна' : 'Moon', sign: data.moon.sign },
    { planet: 'asc', label: language === 'ru' ? 'Асцендент' : 'Rising', sign: data.rising.sign },
  ];

  return (
    <div className="fresh-page">
      <ShimmerStyles />

      {/* Единый верх — как на всех экранах. Имя и дата рождения — в подзаголовке. */}
      <FreshInnerHeader
        title={language === 'ru' ? 'Натальная карта' : 'Natal chart'}
        subtitle={`${profile.name} · ${formatLumiaDate(profile.birthDate, language)}`}
      />

      {/* Большая тройка: Солнце / Луна / Асцендент */}
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

      {/* Стихии в карте — аккуратный спектр (локально, без ИИ) */}
      <ChartBalance chart={data} language={language} />

      {/* Контент карты — без своей шапки (hideIntro), «Личный день» уехал в Гороскоп */}
      <HumanReport
        profile={profile}
        chartData={data}
        chartId={chartId}
        requestPremium={requestPremium}
        onUpdateProfile={onUpdateProfile}
        preloadedReport={preloadedReport}
        hideIntro
      />
    </div>
  );
}
