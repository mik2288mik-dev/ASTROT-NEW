import React from 'react';
import { motion } from 'framer-motion';
import { getZodiacSign } from '../../../constants';
import type { Language } from '../../../types';
import { cn } from '../../../lib/cn';
import { lumiaSelectionHaptic } from '../../../lib/haptics';
import {
  formatSignPairLabel,
  getLocalSignCompatibility,
  ZODIAC_KEYS,
  type LocalCompatScores,
} from '../../../lib/localSignCompatibilityScores';
import { MonoTag } from '../../mono-ui/MonoTag';

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
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-white/75">{label}</span>
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

  return (
    <section className="mt-5 overflow-hidden rounded-mono-card bg-mono-black p-5 text-white">
      <MonoTag dark className="w-fit">
        {ru ? 'союз' : 'union'}
      </MonoTag>
      <h3 className="mt-2 text-[22px] font-bold leading-tight tracking-[-0.02em]">
        {ru ? 'Два знака' : 'Two signs'}
      </h3>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <SignPicker label={ru ? 'Ты' : 'You'} value={signA} language={language} onChange={onChangeSignA} dark />
        <SignPicker label={ru ? 'Партнёр' : 'Partner'} value={signB} language={language} onChange={onChangeSignB} dark />
      </div>

      {scores ? (
        <div className="mt-4 space-y-2">
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
          className="mt-4 w-full rounded-full border border-white/20 py-2.5 text-[13px] font-semibold text-white/85"
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
        className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#C45C4A] text-[14px] font-semibold text-white"
      >
        {ru ? 'Узнать больше' : 'Learn more'}
      </motion.button>
    </section>
  );
}

function SignPicker({
  label,
  value,
  language,
  onChange,
  dark,
}: {
  label: string;
  value: string;
  language: Language;
  onChange: (sign: string) => void;
  dark?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={cn('text-[11px] font-semibold uppercase tracking-wide', dark ? 'text-white/60' : 'text-mono-muted')}>
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => {
          lumiaSelectionHaptic();
          onChange(event.target.value);
        }}
        className={cn(
          'w-full rounded-xl border px-2.5 py-2.5 text-[13px] font-semibold outline-none',
          dark ? 'border-white/15 bg-white/10 text-white' : 'border-mono-line bg-mono-white text-mono-ink',
        )}
      >
        {ZODIAC_KEYS.map((key) => (
          <option key={key} value={key} className="text-mono-ink">
            {getZodiacSign(language, key)}
          </option>
        ))}
      </select>
    </label>
  );
}
