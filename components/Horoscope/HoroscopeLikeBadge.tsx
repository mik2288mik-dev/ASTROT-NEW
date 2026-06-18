import React, { useEffect, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import type { HoroscopeReactionSummary } from '../../types';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import { getHoroscopeReactionSummary, setHoroscopeReaction } from '../../services/astrologyService';

/**
 * Плашка лайков под общим гороскопом знака. Социальное доказательство:
 * показывает, сколько людей оценило этот же знак сегодня. Счётчик настоящий —
 * это агрегат реакций `spot_on` по (sign, date) из db.horoscope_reactions.
 * Лайк односторонний (без «развидеть»): один на знак в день, как и реакции.
 */

type Props = {
  userId?: string;
  sign: string;
  date: string;
  language: 'ru' | 'en';
};

function spotOnCount(summary: HoroscopeReactionSummary | null): number {
  return summary?.counts.find((c) => c.key === 'spot_on')?.count ?? 0;
}

export const HoroscopeLikeBadge: React.FC<Props> = ({ userId, sign, date, language }) => {
  const ru = language !== 'en';
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) { setReady(false); return; }
    let alive = true;
    setReady(false);
    void getHoroscopeReactionSummary(userId, sign, date, language).then((summary) => {
      if (!alive) return;
      if (!summary) { setReady(false); return; }
      setCount(spotOnCount(summary));
      setLiked(summary.userReaction === 'spot_on');
      setReady(true);
    });
    return () => { alive = false; };
  }, [userId, sign, date, language]);

  if (!ready || !userId) return null;

  const onLike = async () => {
    if (liked || busy) return;
    lumiaSelectionHaptic();
    setLiked(true);
    setCount((c) => c + 1);
    setBusy(true);
    try {
      const summary = await setHoroscopeReaction(userId, sign, date, 'spot_on', language);
      setCount(spotOnCount(summary));
      setLiked(summary.userReaction === 'spot_on');
    } catch {
      // откатываем оптимистичный апдейт при ошибке
      setLiked(false);
      setCount((c) => Math.max(0, c - 1));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="horo-like-row">
      <button
        type="button"
        className="horo-like"
        data-liked={liked ? 'true' : 'false'}
        onClick={onLike}
        aria-pressed={liked}
        aria-label={ru ? 'Нравится' : 'Like'}
      >
        <ThumbsUp size={16} strokeWidth={2} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" />
        <span>{liked ? (ru ? 'Нравится' : 'Liked') : (ru ? 'Нравится' : 'Like')}</span>
        {count > 0 ? <span className="horo-like-count">{count}</span> : null}
      </button>
    </div>
  );
};
