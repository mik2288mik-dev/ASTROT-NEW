import React, { useEffect, useMemo, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { Bell } from 'lucide-react';
import type { HoroscopeLayer, UserProfile } from '../../types';
import { LumiaHomeIconButton, LumiaHomeStoryCircle } from '../Dashboard/LumiaHomePrimitives';
import { getLumiaHomeCopy, type LumiaHomeLanguage } from '../Dashboard/lumiaHomeContent';

type UnifiedCollapsibleTopClusterProps = {
  profile: UserProfile;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onOpenSettings: () => void;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer) => void;
};

const COLLAPSE_DISTANCE = 132;

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function UnifiedCollapsibleTopCluster({
  profile,
  scrollRef,
  onOpenSettings,
  onOpenHoroscopeLayer,
}: UnifiedCollapsibleTopClusterProps) {
  const language: LumiaHomeLanguage = profile.language === 'en' ? 'en' : 'ru';
  const copy = getLumiaHomeCopy(language);
  const shouldReduceMotion = useReducedMotion();
  const progressValue = useMotionValue(0);
  const visualProgress = useSpring(progressValue, {
    stiffness: 360,
    damping: 44,
    mass: 0.85,
    restDelta: 0.001,
  });
  const progress = shouldReduceMotion ? progressValue : visualProgress;
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [storiesInteractive, setStoriesInteractive] = useState(true);
  const [actionsInteractive, setActionsInteractive] = useState(true);
  const initial = (profile.name || 'L').trim().slice(0, 1).toUpperCase();
  const locked = !profile.isPremium;

  useEffect(() => {
    const node = scrollRef?.current;
    if (!node) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const next = clampProgress(node.scrollTop / COLLAPSE_DISTANCE);
      progressValue.set(next);
      setStoriesInteractive((current) => {
        const shouldBeInteractive = next <= 0.72;
        return current === shouldBeInteractive ? current : shouldBeInteractive;
      });
      setActionsInteractive((current) => {
        const shouldBeInteractive = next <= 0.48;
        return current === shouldBeInteractive ? current : shouldBeInteractive;
      });
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    node.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      node.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [progressValue, scrollRef]);

  useEffect(() => {
    try {
      const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      setPhotoUrl(typeof tgUser?.photo_url === 'string' ? tgUser.photo_url : null);
    } catch {
      setPhotoUrl(null);
    }
  }, []);

  const bodyHeight = useTransform(progressValue, [0, 1], [204, 64]);
  const clusterHeight = useTransform(bodyHeight, (latest) => `calc(var(--lumia-home-content-safe-top) + ${latest}px)`);
  const solidOpacity = useTransform(progress, [0, 0.34, 1], [0, 0.56, 1]);
  const shadowOpacity = useTransform(progress, [0, 0.42, 1], [0, 0.24, 1]);
  const logoScale = useTransform(progress, [0, 1], [1, 0.6]);
  const logoY = useTransform(progress, [0, 1], [0, -8]);
  const brandY = useTransform(progress, [0, 1], [0, -3]);
  const subtitleOpacity = useTransform(progress, [0, 0.22, 0.48], [1, 0.3, 0]);
  const subtitleY = useTransform(progress, [0, 1], [0, -10]);
  const actionsOpacity = useTransform(progress, [0, 0.26, 0.58], [1, 0.32, 0]);
  const actionsScale = useTransform(progress, [0, 1], [1, 0.94]);
  const actionsY = useTransform(progress, [0, 1], [0, -14]);
  const storiesOpacity = useTransform(progress, [0, 0.45, 0.86], [1, 0.52, 0]);
  const storiesY = useTransform(progress, [0, 1], [0, -62]);
  const storiesScale = useTransform(progress, [0, 1], [1, 0.68]);
  const labelOpacity = useTransform(progress, [0, 0.15, 0.38], [1, 0.25, 0]);
  const compactClusterOpacity = useTransform(progress, [0, 0.46, 0.78, 1], [0, 0, 0.7, 1]);
  const compactClusterX = useTransform(progress, [0, 1], [-18, 0]);
  const compactClusterY = useTransform(progress, [0, 1], [16, 0]);
  const compactClusterScale = useTransform(progress, [0, 1], [0.84, 1]);

  const stories = useMemo(
    () => [
      {
        id: 'today',
        label: copy.stories.today,
        imageSrc: '/horoscope-moment-assets/01-today-focus.webp',
        locked: false,
        onClick: () => onOpenHoroscopeLayer('sign'),
      },
      {
        id: 'love',
        label: copy.stories.love,
        imageSrc: '/horoscope-moment-assets/02-love.webp',
        locked,
        onClick: () => onOpenHoroscopeLayer('love'),
      },
      {
        id: 'money',
        label: copy.stories.money,
        imageSrc: '/horoscope-moment-assets/03-money.webp',
        locked,
        onClick: () => onOpenHoroscopeLayer('work_money'),
      },
      {
        id: 'work',
        label: copy.stories.work,
        imageSrc: '/horoscope-moment-assets/04-work.webp',
        locked,
        onClick: () => onOpenHoroscopeLayer('work_money'),
      },
      {
        id: 'rhythm',
        label: copy.stories.rhythm,
        imageSrc: '/horoscope-moment-assets/05-personal-rhythm.webp',
        locked,
        onClick: () => onOpenHoroscopeLayer('chart'),
      },
    ],
    [copy.stories.love, copy.stories.money, copy.stories.rhythm, copy.stories.today, copy.stories.work, locked, onOpenHoroscopeLayer]
  );

  return (
    <motion.header className="lumia-home-top-cluster" style={{ height: clusterHeight }}>
      <motion.div className="lumia-home-top-cluster-bg" style={{ opacity: solidOpacity }} aria-hidden />
      <motion.div className="lumia-home-top-cluster-shadow" style={{ opacity: shadowOpacity }} aria-hidden />

      <div className="lumia-home-top-scene">
        <motion.div
          className="lumia-home-compact-story-cluster"
          style={{ opacity: compactClusterOpacity, x: compactClusterX, y: compactClusterY, scale: compactClusterScale }}
          aria-hidden
        >
          {stories.slice(0, 3).map((story, index) => (
            <span
              key={story.id}
              className="lumia-home-compact-story"
              data-active={story.id === 'today' ? 'true' : undefined}
              style={{ zIndex: 20 - index } as React.CSSProperties}
            >
              <img src={story.imageSrc} alt="" draggable={false} />
            </span>
          ))}
        </motion.div>

        <motion.div className="lumia-home-brand" style={{ y: brandY }}>
          <motion.p className="lumia-home-wordmark" style={{ scale: logoScale, y: logoY }}>
            LUMIA
          </motion.p>
          <motion.p className="lumia-home-tagline" style={{ opacity: subtitleOpacity, y: subtitleY }}>
            {copy.tagline}
          </motion.p>
        </motion.div>

        <motion.div
          className="lumia-home-top-actions"
          data-interactive={actionsInteractive ? 'true' : undefined}
          style={{ opacity: actionsOpacity, scale: actionsScale, y: actionsY }}
        >
          <LumiaHomeIconButton aria-label={copy.notifications} onClick={onOpenSettings} className="lumia-home-header-icon-button">
            <Bell size={17} strokeWidth={2.05} />
            <span className="lumia-home-notification-dot" aria-hidden />
          </LumiaHomeIconButton>
          <button type="button" onClick={onOpenSettings} aria-label={copy.settings} className="lumia-home-avatar-button lumia-home-header-avatar-button active:scale-[0.98]">
            {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" draggable={false} /> : initial}
          </button>
        </motion.div>

        <motion.div
          className="lumia-home-stories-strip"
          data-interactive={storiesInteractive ? 'true' : undefined}
          style={{ opacity: storiesOpacity, y: storiesY, scale: storiesScale, '--lumia-story-label-opacity': labelOpacity } as any}
        >
          <div className="scrollbar-hide lumia-home-stories-scroll">
            {stories.map((story) => (
              <LumiaHomeStoryCircle
                key={story.id}
                label={story.label}
                imageSrc={story.imageSrc}
                active={story.id === 'today'}
                locked={story.locked}
                onClick={story.onClick}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </motion.header>
  );
}
