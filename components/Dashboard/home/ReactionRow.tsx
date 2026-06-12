import React, { useState } from 'react';
import type { HoroscopeReactionKey } from '../../../types';
import { setHoroscopeReaction } from '../../../services/astrologyService';
import { lumiaImpactHaptic } from '../../../lib/haptics';

const REACTIONS: { key: HoroscopeReactionKey; emoji: string; ru: string; en: string }[] = [
  { key: 'spot_on', emoji: '🎯', ru: 'В точку', en: 'Spot on' },
  { key: 'funny', emoji: '😄', ru: 'Забавно', en: 'Funny' },
  { key: 'gentle', emoji: '🫶', ru: 'Мягко', en: 'Gentle' },
  { key: 'not_mine', emoji: '🤔', ru: 'Не моё', en: 'Not me' },
];

/** #5 — quick reactions to today's forecast (optimistic; POST persists server-side). */
export function ReactionRow({
  userId,
  sign,
  dateKey,
  language,
}: {
  userId: string | number | undefined;
  sign: string;
  dateKey: string;
  language: 'ru' | 'en';
}) {
  const [active, setActive] = useState<HoroscopeReactionKey | null>(null);
  const [busy, setBusy] = useState(false);

  if (!userId || !sign) return null;

  const react = (key: HoroscopeReactionKey) => {
    if (busy) return;
    lumiaImpactHaptic('light');
    setActive(key);
    setBusy(true);
    void setHoroscopeReaction(String(userId), sign, dateKey, key, language)
      .catch(() => { /* keep the optimistic selection */ })
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-1 items-center gap-2">
      {REACTIONS.map((r) => {
        const on = active === r.key;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => react(r.key)}
            aria-label={language === 'ru' ? r.ru : r.en}
            aria-pressed={on}
            className={`flex h-10 flex-1 items-center justify-center rounded-full border text-[17px] transition-colors ${
              on ? 'border-[#7B5CF6] bg-[#F1ECFB]' : 'border-[#EAE3F1] bg-white'
            }`}
          >
            <span className={on ? '' : 'opacity-80'}>{r.emoji}</span>
          </button>
        );
      })}
    </div>
  );
}
