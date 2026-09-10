import React, { useEffect, useRef, useState } from 'react';
import { Eye, Heart, Share2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type {
  ContentReactionSurface,
  HoroscopeEngagementSummary,
  HoroscopeReactionSummary,
} from '../../types';
import { lumiaSelectionHaptic } from '../../lib/haptics';
import {
  getHoroscopeReactionSummary,
  setHoroscopeReaction,
  removeHoroscopeReaction,
  markHoroscopeView,
} from '../../services/astrologyService';
import {
  getContentReactionSummary,
  removeContentReaction,
  setContentReaction,
} from '../../services/contentReactionService';

/**
 * Engagement bar under a sign horoscope: views · like (heart, toggle) · share.
 * Counters are REAL — likes from horoscope_reactions, views from
 * horoscope_engagement (deduped per user/forecast). The shared
 * (sign, period, stable period date) identity keeps day/week/month separate.
 * State resets on every forecast change so one sign's like never leaks.
 */

type SharedProps = {
  userId?: string;
  language: 'ru' | 'en';
  onShare: () => void;
  showLabels?: boolean;
  showCounts?: boolean;
  className?: string;
};

type Props = SharedProps & {
  sign: string;
  date: string;
  /** Период гороскопа — лайк раздельный: сегодня/неделя/месяц у одного знака не делят один лайк. */
  period?: 'today' | 'week' | 'month';
  showViews?: boolean;
};

type ContentProps = SharedProps & {
  surface: ContentReactionSurface;
  contentKey: string;
};

type ActivityTarget =
  | { kind: 'horoscope'; sign: string; date: string; period: 'today' | 'week' | 'month' }
  | { kind: 'content'; surface: ContentReactionSurface; contentKey: string };

type ActivityProps = SharedProps & {
  target: ActivityTarget;
  showViews: boolean;
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

const ActivityBar: React.FC<ActivityProps> = ({
  userId,
  target,
  language,
  onShare,
  showViews,
  showLabels = false,
  showCounts = true,
  className = '',
}) => {
  const ru = language !== 'en';
  const targetKind = target.kind;
  const sign = target.kind === 'horoscope' ? target.sign : '';
  const date = target.kind === 'horoscope' ? target.date : '';
  const period = target.kind === 'horoscope' ? target.period : 'today';
  const surface = target.kind === 'content' ? target.surface : 'compatibility';
  const contentKey = target.kind === 'content' ? target.contentKey : '';
  const [likes, setLikes] = useState(0);
  const [liked, setLiked] = useState(false);
  const [views, setViews] = useState(0);
  const [busy, setBusy] = useState(false);
  const reactionRequestVersion = useRef(0);

  useEffect(() => {
    const requestVersion = reactionRequestVersion.current + 1;
    reactionRequestVersion.current = requestVersion;
    // Сброс — чтобы счётчики/лайк предыдущего знака не показывались на новом.
    setLikes(0);
    setLiked(false);
    setViews(0);
    setBusy(false);
    if (!userId) return;
    let alive = true;
    if (showViews) {
      if (targetKind === 'horoscope') {
        void markHoroscopeView(userId, sign, date, period).then((e: HoroscopeEngagementSummary | null) => {
          if (!alive || !e) return;
          setViews(e.views);
        });
      }
    }
    if (targetKind === 'content') {
      void getContentReactionSummary(userId, { surface, contentKey }).then((summary) => {
        if (!alive || reactionRequestVersion.current !== requestVersion || !summary) return;
        setLikes(summary.count);
        setLiked(summary.reacted);
      });
    } else {
      void getHoroscopeReactionSummary(userId, sign, date, language, period).then((summary) => {
        if (!alive || reactionRequestVersion.current !== requestVersion || !summary) return;
        setLikes(spotOn(summary));
        setLiked(summary.userReaction === 'spot_on');
      });
    }
    return () => { alive = false; };
  }, [userId, targetKind, sign, date, period, surface, contentKey, language, showViews]);

  const onToggleLike = async () => {
    if (!userId || busy) return;
    lumiaSelectionHaptic();
    const wasLiked = liked;
    const requestVersion = reactionRequestVersion.current + 1;
    reactionRequestVersion.current = requestVersion;
    setBusy(true);
    // оптимистично
    setLiked(!wasLiked);
    setLikes((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    try {
      if (targetKind === 'content') {
        const summary = wasLiked
          ? await removeContentReaction(userId, { surface, contentKey })
          : await setContentReaction(userId, { surface, contentKey });
        if (reactionRequestVersion.current !== requestVersion) return;
        if (summary) { setLikes(summary.count); setLiked(summary.reacted); }
        else { setLiked(true); setLikes((c) => c + 1); } // снять не удалось — откат
      } else {
        const summary = wasLiked
          ? await removeHoroscopeReaction(userId, sign, date, language, period)
          : await setHoroscopeReaction(userId, sign, date, 'spot_on', language, period);
        if (reactionRequestVersion.current !== requestVersion) return;
        if (summary) { setLikes(spotOn(summary)); setLiked(summary.userReaction === 'spot_on'); }
        else { setLiked(true); setLikes((c) => c + 1); }
      }
    } catch {
      if (reactionRequestVersion.current !== requestVersion) return;
      setLiked(wasLiked);
      setLikes((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
    } finally {
      if (reactionRequestVersion.current === requestVersion) setBusy(false);
    }
  };

  return (
    <div className={`horo-act${className ? ` ${className}` : ''}`}>
      {showViews ? (
        <div className="horo-act-item horo-act-views" aria-label={ru ? 'Просмотры' : 'Views'}>
          <Eye size={18} strokeWidth={2} />
          {showCounts ? <Count value={views} /> : null}
        </div>
      ) : null}

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
        {showLabels ? <span className="horo-act-label">{ru ? 'Нравится' : 'Like'}</span> : null}
        {showCounts ? <Count value={likes} /> : null}
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
        {showLabels ? <span className="horo-act-label">{ru ? 'Поделиться' : 'Share'}</span> : null}
      </button>
    </div>
  );
};

export const HoroscopeActivityBar: React.FC<Props> = ({
  sign,
  date,
  period = 'today',
  showViews = true,
  ...props
}) => (
  <ActivityBar
    {...props}
    target={{ kind: 'horoscope', sign, date, period }}
    showViews={showViews}
  />
);

export const ContentActivityBar: React.FC<ContentProps> = ({
  surface,
  contentKey,
  ...props
}) => (
  <ActivityBar
    {...props}
    target={{ kind: 'content', surface, contentKey }}
    showViews={false}
  />
);
