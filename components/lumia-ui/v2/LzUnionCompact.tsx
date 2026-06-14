import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { getZodiacSign } from '../../../constants';
import type { Language } from '../../../types';
import { lumiaSelectionHaptic } from '../../../lib/haptics';
import {
  formatSignPairLabel,
  getLocalSignCompatibility,
  type LocalCompatScores,
} from '../../../lib/localSignCompatibilityScores';
import { getLzArtSrc } from '../../../lib/lzArtAssets';
import { MonoIllustCouple } from '../../mono-ui/MonoIllustrations';
import { MonoTag } from '../../mono-ui/MonoTag';
import { LzArtPlate } from './LzArtPlate';
import { LzSignPickerSheet } from './LzSignPickerSheet';

type LzUnionCompactProps = {
  language: Language;
  signA: string;
  signB: string;
  onChangeSignA: (sign: string) => void;
  onChangeSignB: (sign: string) => void;
  onOpenUnion?: () => void;
  onRequestPremium?: () => void;
  isPremium?: boolean;
};

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2 text-[13px] first:border-t-0 first:pt-0">
      <span className="text-white/72">{label}</span>
      <span className="font-bold tabular-nums">{value}%</span>
    </div>
  );
}

export function LzUnionCompact({
  language,
  signA,
  signB,
  onChangeSignA,
  onChangeSignB,
  onOpenUnion,
  onRequestPremium,
  isPremium,
}: LzUnionCompactProps) {
  const scores: LocalCompatScores | null = getLocalSignCompatibility(signA, signB);
  const pairLabel = formatSignPairLabel(signA, signB, language);
  const ru = language === 'ru';
  const [picker, setPicker] = useState<'a' | 'b' | null>(null);

  return (
    <>
      <section className="lz-union-card mt-6 overflow-hidden">
        <LzArtPlate
          imageSrc={getLzArtSrc('homeUnion')}
          fallback={<MonoIllustCouple size={110} className="opacity-80" />}
          aspect="wide"
          className="rounded-none"
        />

        <div className="relative bg-mono-black px-5 pb-5 pt-4 text-white">
          <MonoTag dark className="w-fit bg-white/10 text-white/90">
            {ru ? 'союз' : 'union'}
          </MonoTag>
          <h3 className="mt-3 font-lora text-[24px] font-bold leading-tight tracking-[-0.02em]">
            {ru ? 'Два знака — одна история' : 'Two signs, one story'}
          </h3>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <SignField
              label={ru ? 'Ты' : 'You'}
              value={getZodiacSign(language, signA)}
              onClick={() => {
                lumiaSelectionHaptic();
                setPicker('a');
              }}
            />
            <SignField
              label={ru ? 'Партнёр' : 'Partner'}
              value={getZodiacSign(language, signB)}
              onClick={() => {
                lumiaSelectionHaptic();
                setPicker('b');
              }}
            />
          </div>

          {scores ? (
            <div className="mt-5 space-y-2 rounded-[16px] bg-white/[0.06] px-4 py-3">
              <p className="text-[15px] font-semibold">{pairLabel} · {scores.overall}%</p>
              <ScoreRow label={ru ? 'Дружба' : 'Friendship'} value={scores.friendship} />
              <ScoreRow label={ru ? 'Разговор' : 'Talk'} value={scores.talk} />
              <ScoreRow label={ru ? 'Искра' : 'Spark'} value={scores.spark} />
              <ScoreRow label={ru ? 'Трение' : 'Friction'} value={scores.friction} />
            </div>
          ) : null}

          {!isPremium ? (
            <button
              type="button"
              onClick={() => {
                lumiaSelectionHaptic();
                onRequestPremium?.();
              }}
              className="mt-4 w-full rounded-full border border-white/18 py-2.5 text-[13px] font-semibold text-white/82"
            >
              {ru ? 'Полная история пары — Premium' : 'Full pair story — Premium'}
            </button>
          ) : null}

          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              lumiaSelectionHaptic();
              onOpenUnion?.();
            }}
            className="lz-union-cta mt-3 inline-flex h-12 w-full items-center justify-center rounded-full text-[14px] font-bold text-white"
          >
            {ru ? 'Узнать больше' : 'Learn more'}
          </motion.button>
        </div>
      </section>

      <LzSignPickerSheet
        open={picker === 'a'}
        language={language}
        current={signA}
        title={ru ? 'Твой знак' : 'Your sign'}
        onPick={onChangeSignA}
        onClose={() => setPicker(null)}
      />
      <LzSignPickerSheet
        open={picker === 'b'}
        language={language}
        current={signB}
        title={ru ? 'Знак партнёра' : 'Partner sign'}
        onPick={onChangeSignB}
        onClose={() => setPicker(null)}
      />
    </>
  );
}

function SignField({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[52px] flex-col items-start justify-center rounded-[14px] border border-white/14 bg-white/[0.08] px-3 py-2 text-left active:scale-[0.98]"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">{label}</span>
      <span className="mt-1 flex w-full items-center justify-between gap-1 text-[14px] font-semibold">
        {value}
        <ChevronDown size={16} className="shrink-0 text-white/55" />
      </span>
    </button>
  );
}
