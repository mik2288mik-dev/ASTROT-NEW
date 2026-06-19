import React, { useEffect, useState } from 'react';
import { Eye, Heart, Repeat, Share2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { HoroscopeEngagementSummary, HoroscopeReactionSummary } from '../../types';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import {
  getHoroscopeReactionSummary,
  setHoroscopeReaction,
  markHoroscopeView,
  markHoroscopeRepost,
} from '../../services/astrologyService';

/**
 * Engagement bar under the sign horoscope: views · repost · like (heart) · share.
 * Every counter is REAL — likes from horoscope_reactions, views/reposts from
 * horoscope_engagement (deduped per user/sign/day). Repost shares to Telegram and
 * counts it; share just shares. No favorites/bookmark (deferred). No new deps.
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
  const [reposts, setReposts] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    const applyEngagement = (e: HoroscopeEngagementSummary | null) => {
      if (!alive || !e) return;
      setViews(e.views);
      setReposts(e.reposts);
      setReposted(e.reposted);
    };
    // Открытие разбора = просмотр (дедуп на сервере). Возвращает уже обновлённые счётчики.
    void markHoroscopeView(userId, sign, date).then(applyEngagement);
    void getHoroscopeReactionSummary(userId, sign, date, language).then((s) => {
      if (!alive || !s) return;
      setLikes(spotOn(s));
      setLiked(s.userReaction === 'spot_on');
    });
    return () => { alive = false; };
  }, [userId, sign, date, language]);

  const onLike = async () => {
    if (!userId || liked || busy) return;
    lumiaSelectionHaptic();
    setLiked(true);
    setLikes((c) => c + 1);
    setBusy(true);
    try {
      const s = await setHoroscopeReaction(userId, sign, date, 'spot_on', language);
      setLikes(spotOn(s));
      setLiked(s.userReaction === 'spot_on');
    } catch {
      setLiked(false);
      setLikes((c) => Math.max(0, c - 1));
    } finally {
      setBusy(false);
    }
  };

  const onRepost = async () => {
    lumiaSelectionHaptic();
    onShare();
    if (!userId || reposted) return;
    setReposted(true);
    setReposts((c) => c + 1);
    try {
      const e = await markHoroscopeRepost(userId, sign, date);
      if (e) { setReposts(e.reposts); setReposted(e.reposted); setViews(e.views); }
    } catch {
      setReposted(false);
      setReposts((c) => Math.max(0, c - 1));
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
        className="horo-act-item horo-act-btn"
        data-on={reposted ? 'true' : 'false'}
        onClick={onRepost}
        aria-label={ru ? 'Поделиться знаком' : 'Repost'}
      >
        <motion.span whileTap={{ scale: 0.85 }} style={{ display: 'inline-flex' }}>
          <Repeat size={18} strokeWidth={2} />
        </motion.span>
        <Count value={reposts} />
      </button>

      <button
        type="button"
        className="horo-act-item horo-act-btn horo-act-like"
        data-on={liked ? 'true' : 'false'}
        onClick={onLike}
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
