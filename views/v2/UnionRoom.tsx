import React, { useState } from 'react';
import type { NatalChartData, UserProfile } from '../../types';
import { Synastry } from '../Synastry';
import {
  MonoButton,
  MonoIllustCouple,
  MonoPage,
  MonoStagger,
  MonoStaggerItem,
  MonoTag,
} from '../../components/mono-ui';
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

  return (
    <MonoPage className="px-4" withTabClearance>
      <div className="mx-auto max-w-[28rem] pb-28">
        <MonoStagger>
          <MonoStaggerItem>
            <div className="relative overflow-hidden rounded-mono-card bg-mono-plate px-5 py-8">
              <MonoIllustCouple className="absolute right-1 top-1 opacity-35" size={120} />
              <MonoTag>{language === 'ru' ? 'союз' : 'union'}</MonoTag>
              <h1 className="mt-4 max-w-[75%] font-lora text-[32px] font-bold leading-[1.05] text-mono-ink">
                {language === 'ru' ? 'Проверь вашу связь' : 'Check your bond'}
              </h1>
              <p className="mt-3 max-w-[85%] text-[15px] leading-relaxed text-mono-muted">
                {language === 'ru'
                  ? 'Почему вас тянет, где вы задеваете друг друга и как говорить яснее.'
                  : 'Why you connect, where friction shows up, and how to talk clearer.'}
              </p>
            </div>
          </MonoStaggerItem>

          <MonoStaggerItem>
            <MonoButton
              variant="accent"
              fullWidth
              className="mt-5"
              onClick={() => {
                lumiaSelectionHaptic();
                setStarted(true);
              }}
            >
              {language === 'ru' ? 'Проверить' : 'Check compatibility'}
            </MonoButton>
            <MonoButton
              variant="outline"
              fullWidth
              className="mt-3"
              onClick={() => {
                lumiaSelectionHaptic();
                setStarted(true);
              }}
            >
              {language === 'ru' ? 'По знакам' : 'By signs'}
            </MonoButton>
          </MonoStaggerItem>
        </MonoStagger>
      </div>
    </MonoPage>
  );
}
