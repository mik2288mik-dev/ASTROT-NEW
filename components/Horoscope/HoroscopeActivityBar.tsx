import React, { useEffect, useState } from 'react';
import { Eye, Heart, Share2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { HoroscopeEngagementSummary, HoroscopeReactionSummary } from '../../types';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import {
  getHoroscopeReactionSummary,
  setHoroscopeReaction,
  removeHoroscopeReaction,
  markHoroscopeView,
} from '../../services/astrologyService';

/**
 * Engagement bar under a sign horoscope: views · like (heart, toggle) · share.
 * Counters are REAL — likes from horoscope_reactions, views from
 * horoscope_engagement (deduped per user/sign/day). Keyed by (sign, date) so
 * today / tomorrow / week each keep their own counts. State resets on every
 * sign/date change so one sign's like never leaks onto another.
 */

type Props = {
  userId?: string;
  sign: string;
  date: string;
  language: 'ru' | 'en';
  onShare: () => void;
};

function spotOn(summary: HoroscopeReactionSummary | null): number {
  return summary?.counts.find((c) => c.key === 'spot_on')?.count ?? 0;
}

function compact(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k >= 10 || n % 1000 < 100 ? Math.round(k) : k.toFixed(1)}k`;
}

const Count: React.FC<{ value: number }> = ({ value }) => (
  <span className="horo-act-count">
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={value}
        initial={{ y: 7, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -7, opacity: 0 }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        style={{ display: 'inline-block' }}
      >
        {compact(value)}
      </motion.span>
    </AnimatePresence>
  </span>
);

export const HoroscopeActivityBar: React.FC<Props> = ({ userId, sign, date, language, onShare }) => {
  const ru = language !== 'en';
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [views, setViews] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Сброс — чтобы счётчики/лайк предыдущего знака не показывались на новом.
    setLikes(0);
    setLiked(false);
    setViews(0);
    if (!userId) return;
    let alive = true;
    void markHoroscopeView(userId, sign, date).then((e: HoroscopeEngagementSummary | null) => {
      if (!alive || !e) return;
      setViews(e.views);
    });
    void getHoroscopeReactionSummary(userId, sign, date, language).then((s) => {
      if (!alive || !s) return;
      setLikes(spotOn(s));
      setLiked(s.userReaction === 'spot_on');
    });
    return () => { alive = false; };
  }, [userId, sign, date, language]);

  const onToggleLike = async () => {
    if (!userId || busy) return;
    lumiaSelectionHaptic();
    const wasLiked = liked;
    setBusy(true);
    // оптимистично
    setLiked(!wasLiked);
    setLikes((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    try {
      if (wasLiked) {
        const s = await removeHoroscopeReaction(userId, sign, date, language);
        if (s) { setLikes(spotOn(s)); setLiked(s.userReaction === 'spot_on'); }
        else { setLiked(true); setLikes((c) => c + 1); } // снять не удалось — откат
      } else {
        const s = await setHoroscopeReaction(userId, sign, date, 'spot_on', language);
        setLikes(spotOn(s));
        setLiked(s.userReaction === 'spot_on');
      }
    } catch {
      setLiked(wasLiked);
      setLikes((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="horo-act">
      <div className="horo-act-item horo-act-views" aria-label={ru ? 'Просмотры' : 'Views'}>
        <Eye size={18} strokeWidth={2} />
        <Count value={views} />
      </div>

      <button
        type="button"
        className="horo-act-item horo-act-btn horo-act-like"
        data-on={liked ? 'true' : 'false'}
        onClick={onToggleLike}
        aria-pressed={liked}
        aria-label={ru ? 'Нравится' : 'Like'}
        disabled={!userId}
      >
        <motion.span whileTap={{ scale: 0.8 }} style={{ display: 'inline-flex' }}>
          <Heart size={18} strokeWidth={2} fill={liked ? 'currentColor' : 'none'} />
        </motion.span>
        <Count value={likes} />
      </button>

      <button
        type="button"
        className="horo-act-item horo-act-btn horo-act-share"
        onClick={() => { lumiaSelectionHaptic(); onShare(); }}
        aria-label={ru ? 'Поделиться' : 'Share'}
      >
        <motion.span whileTap={{ scale: 0.85 }} style={{ display: 'inline-flex' }}>
          <Share2 size={18} strokeWidth={2} />
        </motion.span>
      </button>
    </div>
  );
};
