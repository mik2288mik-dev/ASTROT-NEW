import React, { useEffect, useMemo, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import type { HoroscopeLayer, UserProfile } from '../../types';
import { captureLumiaHomeLayout, lumiaDebugLog } from '../../lib/lumiaDebug';
import { LumiaHomeStoryCircle } from '../Dashboard/LumiaHomePrimitives';
import { getLumiaHomeCopy, type LumiaHomeLanguage } from '../Dashboard/lumiaHomeContent';

type UnifiedCollapsibleTopClusterProps = {
  profile: UserProfile;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer) => void;
};

const EXPANDED_BODY_HEIGHT = 184;
const COLLAPSED_BODY_HEIGHT = 48;
const COLLAPSE_DISTANCE = 118;

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function UnifiedCollapsibleTopCluster({
  profile,
  scrollRef,
  onOpenHoroscopeLayer,
}: UnifiedCollapsibleTopClusterProps) {
  const language: LumiaHomeLanguage = profile.language === 'en' ? 'en' : 'ru';
  const copy = getLumiaHomeCopy(language);
  const shouldReduceMotion = useReducedMotion();
  const progressValue = useMotionValue(0);
  const lastDebugSampleRef = React.useRef(0);
  const lastDebugPhaseRef = React.useRef('');
  const visualProgress = useSpring(progressValue, {
    stiffness: 360,
    damping: 44,
    mass: 0.85,
    restDelta: 0.001,
  });
  const progress = shouldReduceMotion ? progressValue : visualProgress;
  const [storiesInteractive, setStoriesInteractive] = useState(true);
  const locked = !profile.isPremium;

  useEffect(() => {
    const node = scrollRef?.current;
    if (!node) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const next = clampProgress(node.scrollTop / COLLAPSE_DISTANCE);
      progressValue.set(next);
      const phase = next >= 0.92 ? 'collapsed' : next <= 0.08 ? 'expanded' : 'transition';
      const now = Date.now();
      if (phase !== lastDebugPhaseRef.current || now - lastDebugSampleRef.current > 350) {
        lastDebugPhaseRef.current = phase;
        lastDebugSampleRef.current = now;
        lumiaDebugLog('scroll_sample', {
          scrollTop: Math.round(node.scrollTop),
          progress: Math.round(next * 1000) / 1000,
          scrollHeight: node.scrollHeight,
          clientHeight: node.clientHeight,
        });
        lumiaDebugLog('collapse_state', {
          phase,
          scrollTop: Math.round(node.scrollTop),
          progress: Math.round(next * 1000) / 1000,
          headerHeight: `safeTop + ${Math.round(EXPANDED_BODY_HEIGHT + (COLLAPSED_BODY_HEIGHT - EXPANDED_BODY_HEIGHT) * next)}px`,
          compactRailHeight: COLLAPSED_BODY_HEIGHT,
        });
      }
      setStoriesInteractive((current) => {
        const shouldBeInteractive = next <= 0.56;
        return current === shouldBeInteractive ? current : shouldBeInteractive;
      });
    };
    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.setTimeout(() => captureLumiaHomeLayout('home_header_mount'), 160);
    node.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      node.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [progressValue, scrollRef]);

  const bodyHeight = useTransform(progress, [0, 1], [EXPANDED_BODY_HEIGHT, COLLAPSED_BODY_HEIGHT]);
  const clusterHeight = useTransform(bodyHeight, (latest) => `calc(var(--lumia-home-content-safe-top) + ${latest}px)`);
  const solidOpacity = useTransform(progress, [0, 0.44, 1], [0, 0.18, 0.56]);
  const shadowOpacity = useTransform(progress, [0, 0.58, 1], [0, 0.04, 0.12]);
  const expandedBrandOpacity = useTransform(progress, [0, 0.24, 0.54], [1, 0.48, 0]);
  const expandedBrandY = useTransform(progress, [0, 1], [0, -30]);
  const expandedBrandScale = useTransform(progress, [0, 1], [1, 0.9]);
  const subtitleOpacity = useTransform(progress, [0, 0.2, 0.42], [1, 0.28, 0]);
  const subtitleY = useTransform(progress, [0, 1], [0, -8]);
  const storiesOpacity = useTransform(progress, [0, 0.34, 0.64], [1, 0.36, 0]);
  const storiesY = useTransform(progress, [0, 1], [0, -72]);
  const storiesScale = useTransform(progress, [0, 1], [1, 0.7]);
  const labelOpacity = useTransform(progress, [0, 0.12, 0.32], [1, 0.22, 0]);
  const compactRowOpacity = useTransform(progress, [0, 0.52, 0.78, 1], [0, 0, 0.88, 1]);
  const compactRowY = useTransform(progress, [0, 0.6, 1], [-5, -5, 0]);
  const compactRowScale = useTransform(progress, [0, 0.72, 1], [0.82, 0.94, 1]);

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
          className="lumia-home-compact-row"
          style={{ opacity: compactRowOpacity, y: compactRowY, scale: compactRowScale }}
          aria-hidden
        >
          <div className="lumia-home-compact-story-cluster">
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
          </div>
          <p className="lumia-home-compact-logo">LUMIA</p>
        </motion.div>

        <motion.div
          className="lumia-home-brand"
          style={{ opacity: expandedBrandOpacity, y: expandedBrandY, scale: expandedBrandScale }}
        >
          <p className="lumia-home-wordmark">
            LUMIA
          </p>
          <motion.p className="lumia-home-tagline" style={{ opacity: subtitleOpacity, y: subtitleY }}>
            {copy.tagline}
          </motion.p>
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
