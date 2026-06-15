import React from 'react';
import type { NatalChartData, NatalInterpretationReport, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { formatLumiaDate } from '../../lib/date-utils';
import { HumanReport } from '../../components/NatalReading/HumanReport';
import { ShimmerStyles } from '../../components/NatalReading/Skeleton';
import { MonoIllustChart } from '../../components/mono-ui';
import { FreshPageTitle, FreshHeroCard } from '../../components/fresh-ui';

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

const chipStyle: React.CSSProperties = {
  background: 'var(--fresh-surface)',
  borderRadius: 'var(--fresh-radius-pill)',
  padding: '7px 13px',
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--fresh-text)',
};

export function NatalMagazine({
  data,
  profile,
  chartId,
  requestPremium,
  onUpdateProfile,
  preloadedReport,
  onCreateChart,
  onOpenPersonalDaily,
}: NatalMagazineProps) {
  const language = profile.language === 'en' ? 'en' : 'ru';

  if (!data) {
    return (
      <div className="fresh-page">
        <FreshPageTitle
          kicker={language === 'ru' ? 'Карта' : 'Chart'}
          title={language === 'ru' ? 'Создай натальную карту' : 'Create your natal chart'}
        />
        <FreshHeroCard color="mint" emojiBottom="🌙">
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <MonoIllustChart size={120} className="opacity-90" />
          </div>
        </FreshHeroCard>
        <p style={{ padding: '0 20px', margin: '0 0 18px', fontSize: 15, lineHeight: 1.5, color: 'var(--fresh-muted)' }}>
          {language === 'ru'
            ? 'Lumia рассчитает карту по дате, времени и месту рождения.'
            : 'Lumia calculates your chart from birth date, time, and place.'}
        </p>
        <button type="button" className="fresh-btn-primary" onClick={onCreateChart}>
          {language === 'ru' ? 'Создать карту' : 'Create chart'}
        </button>
      </div>
    );
  }

  return (
    <div className="fresh-page">
      <ShimmerStyles />
      <FreshPageTitle kicker={language === 'ru' ? 'Журнал' : 'Magazine'} title={profile.name} />
      <div style={{ padding: '0 20px 14px', fontSize: 14, color: 'var(--fresh-muted)' }}>
        {formatLumiaDate(profile.birthDate, language)} · {profile.birthPlace}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 20px 16px' }}>
        <span style={chipStyle}>☉ {getZodiacSign(language, data.sun.sign)}</span>
        <span style={chipStyle}>☾ {getZodiacSign(language, data.moon.sign)}</span>
        <span style={chipStyle}>↑ {getZodiacSign(language, data.rising.sign)}</span>
      </div>

      {onOpenPersonalDaily ? (
        <button
          type="button"
          className="fresh-btn-primary"
          onClick={onOpenPersonalDaily}
          style={{ marginBottom: 18, background: 'var(--fresh-surface)', color: 'var(--fresh-text)' }}
        >
          {language === 'ru' ? 'Личный день' : 'Personal day'}
        </button>
      ) : null}

      <HumanReport
        profile={profile}
        chartData={data}
        chartId={chartId}
        requestPremium={requestPremium}
        onUpdateProfile={onUpdateProfile}
        preloadedReport={preloadedReport}
        onOpenPersonalDaily={onOpenPersonalDaily}
      />
    </div>
  );
}
