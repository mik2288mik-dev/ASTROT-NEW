import React, { useState } from 'react';
import type { NatalChartData, UserProfile } from '../../types';
import { Synastry } from '../Synastry';
import { FreshPageTitle, FreshHeroCard } from '../../components/fresh-ui';
import { MonoIllustCouple } from '../../components/mono-ui';
import { lumiaSelectionHaptic } from '../../lib/haptics';

type SynastryPrefill = {
  source: 'saved-chart' | 'manual';
  partnerChartId?: number;
  partnerName?: string;
  partnerDate?: string;
  partnerTime?: string;
  partnerPlace?: string;
} | null;

type UnionRoomProps = {
  profile: UserProfile;
  chartData?: NatalChartData | null;
  chartId?: number | null;
  requestPremium: () => void;
  initialPrefill?: SynastryPrefill;
  onOpenCharts?: () => void;
  onCreateNatalChart?: () => void;
  onUpdateProfile?: (profile: UserProfile) => void;
};

export function UnionRoom(props: UnionRoomProps) {
  const language = props.profile.language === 'en' ? 'en' : 'ru';
  const [started, setStarted] = useState(Boolean(props.initialPrefill));

  if (started) {
    return <Synastry {...props} embedded />;
  }

  const start = () => {
    lumiaSelectionHaptic();
    setStarted(true);
  };

  return (
    <div className="fresh-page">
      <FreshPageTitle
        kicker={language === 'ru' ? 'Союз' : 'Union'}
        title={language === 'ru' ? 'Проверь вашу связь' : 'Check your bond'}
      />

      <FreshHeroCard
        color="lavender"
        chipText={language === 'ru' ? 'совместимость' : 'compatibility'}
        chipPosition="top-right"
        softText={language === 'ru' ? 'Синастрия' : 'Synastry'}
        onClick={start}
        style={{ cursor: 'pointer' }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          <MonoIllustCouple size={120} className="opacity-90" />
        </div>
      </FreshHeroCard>

      <p
        style={{
          padding: '0 20px',
          margin: '0 0 18px',
          fontSize: 15,
          lineHeight: 1.5,
          color: 'var(--fresh-muted)',
        }}
      >
        {language === 'ru'
          ? 'Почему вас тянет, где вы задеваете друг друга и как говорить яснее.'
          : 'Why you connect, where friction shows up, and how to talk clearer.'}
      </p>

      <button type="button" className="fresh-btn-primary" onClick={start}>
        {language === 'ru' ? 'Проверить' : 'Check compatibility'}
      </button>
      <button
        type="button"
        className="fresh-btn-primary"
        onClick={start}
        style={{
          marginTop: 10,
          background: 'var(--fresh-surface)',
          color: 'var(--fresh-text)',
        }}
      >
        {language === 'ru' ? 'По знакам' : 'By signs'}
      </button>
    </div>
  );
}
