import React, { useState } from 'react';
import type { NatalChartData, UserProfile } from '../../types';
import { Synastry } from '../Synastry';
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

/** Типы отношений — задают фокус разбора (нейтрально, не только романтика) */
const REL_TYPES = [
  { key: 'love', ru: 'Любовь', en: 'Love', backend: 'любовь' },
  { key: 'friend', ru: 'Дружба', en: 'Friendship', backend: 'дружба' },
  { key: 'family', ru: 'Семья', en: 'Family', backend: 'семья' },
  { key: 'work', ru: 'Работа', en: 'Work', backend: 'работа' },
] as const;

export function UnionRoom(props: UnionRoomProps) {
  const ru = props.profile.language !== 'en';
  const [rel, setRel] = useState<(typeof REL_TYPES)[number]['key']>('love');
  const [started, setStarted] = useState<null | { mode: 'signs' | 'personal' }>(
    props.initialPrefill ? { mode: 'personal' } : null,
  );

  if (started) {
    const backend = REL_TYPES.find((r) => r.key === rel)?.backend ?? 'отношения';
    return <Synastry {...props} embedded initialMode={started.mode} relationshipType={backend} />;
  }

  const start = (mode: 'signs' | 'personal') => {
    lumiaSelectionHaptic();
    setStarted({ mode });
  };

  return (
    <div className="fresh-page">
      <div className="fresh-page-title-block" style={{ textAlign: 'center', paddingTop: 0, paddingBottom: 12 }}>
        <div className="fresh-page-kicker">{ru ? 'Союз' : 'Union'}</div>
        <div className="fresh-page-title">{ru ? 'Совместимость' : 'Compatibility'}</div>
      </div>

      <div className="union-hero">
        <div className="union-hero-text">
          {ru
            ? 'Что между вами: что притягивает, где возникают трения и как говорить друг с другом яснее.'
            : 'What is between you: what attracts, where friction shows up, and how to talk clearer.'}
        </div>
      </div>

      <div className="union-rel-label">{ru ? 'Тип отношений' : 'Relationship'}</div>
      <div className="union-rel">
        {REL_TYPES.map((r) => (
          <button
            key={r.key}
            type="button"
            className={`union-rel-chip ${rel === r.key ? 'active' : ''}`}
            aria-pressed={rel === r.key}
            onClick={() => { lumiaSelectionHaptic(); setRel(r.key); }}
          >
            {ru ? r.ru : r.en}
          </button>
        ))}
      </div>

      <button type="button" className="fresh-btn-primary" onClick={() => start('personal')}>
        {ru ? 'Проверить совместимость' : 'Check compatibility'}
      </button>
      <button type="button" className="union-secondary" onClick={() => start('signs')}>
        {ru ? 'Быстро по знакам' : 'Quick by signs'}
      </button>
    </div>
  );
}
