import React, { useEffect, useMemo } from 'react';
import {
  motion,
  useTransform,
} from 'framer-motion';
import type { HoroscopeLayer, UserProfile } from '../../types';
import { lumiaImpactHaptic } from '../../lib/haptics';
import { captureLumiaHomeLayout } from '../../lib/lumiaDebug';
import { LumiaHomeStoryCircle } from '../Dashboard/LumiaHomePrimitives';
import { getLumiaHomeCopy, type LumiaHomeLanguage } from '../Dashboard/lumiaHomeContent';
import { useCollapsibleHeaderProgress } from './useCollapsibleHeaderProgress';

type UnifiedCollapsibleTopClusterProps = {
  profile: UserProfile;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer) => void;
};

const EXPANDED_BODY_HEIGHT = 184;
const COLLAPSED_BODY_HEIGHT = 48;
const COLLAPSE_DISTANCE = 118;

export function UnifiedCollapsibleTopCluster({
  profile,
  scrollRef,
  onOpenHoroscopeLayer,
}: UnifiedCollapsibleTopClusterProps) {
  const language: LumiaHomeLanguage = profile.language === 'en' ? 'en' : 'ru';
  const copy = getLumiaHomeCopy(language);
  const { rawProgress, visualProgress } = useCollapsibleHeaderProgress({
    scrollRef,
    collapseDistance: COLLAPSE_DISTANCE,
    source: 'home',
    expandedBodyHeight: EXPANDED_BODY_HEIGHT,
    collapsedBodyHeight: COLLAPSED_BODY_HEIGHT,
    hapticEdges: true,
  });
  const locked = !profile.isPremium;

  useEffect(() => {
    window.setTimeout(() => captureLumiaHomeLayout('home_header_mount'), 160);
  }, []);

  const solidOpacity = useTransform(visualProgress, [0, 0.44, 1], [0, 0.18, 0.56]);
  const shadowOpacity = useTransform(visualProgress, [0, 0.58, 1], [0, 0.04, 0.12]);
  const expandedBrandOpacity = useTransform(visualProgress, [0, 0.24, 0.54], [1, 0.48, 0]);
  const expandedBrandY = useTransform(rawProgress, [0, 1], [0, -98]);
  const expandedBrandScale = useTransform(visualProgress, [0, 1], [1, 0.9]);
  const subtitleOpacity = useTransform(visualProgress, [0, 0.2, 0.42], [1, 0.28, 0]);
  const subtitleY = useTransform(rawProgress, [0, 1], [0, -12]);
  const storiesOpacity = useTransform(visualProgress, [0, 0.34, 0.64], [1, 0.36, 0]);
  const storiesY = useTransform(rawProgress, [0, 1], [0, -124]);
  const storiesScale = useTransform(visualProgress, [0, 1], [1, 0.7]);
  const storiesPointerEvents = useTransform(rawProgress, (latest) => (latest <= 0.56 ? 'auto' : 'none'));
  const labelOpacity = useTransform(visualProgress, [0, 0.12, 0.32], [1, 0.22, 0]);
  const compactRowOpacity = useTransform(visualProgress, [0, 0.52, 0.78, 1], [0, 0, 0.88, 1]);
  const compactRowY = useTransform(rawProgress, [0, 1], [-5, 0]);
  const compactRowScale = useTransform(visualProgress, [0, 0.72, 1], [0.82, 0.94, 1]);

  const stories = useMemo(
    () => [
      {
        id: 'today',
        label: copy.stories.today,
        imageSrc: '/horoscope-moment-assets/01-today-focus.webp',
        locked: false,
        onClick: () => {
          lumiaImpactHaptic('light');
          onOpenHoroscopeLayer('sign');
        },
      },
      {
        id: 'love',
        label: copy.stories.love,
        imageSrc: '/horoscope-moment-assets/02-love.webp',
        locked,
        onClick: () => {
          lumiaImpactHaptic('light');
          onOpenHoroscopeLayer('love');
        },
      },
      {
        id: 'money',
        label: copy.stories.money,
        imageSrc: '/horoscope-moment-assets/03-money.webp',
        locked,
        onClick: () => {
          lumiaImpactHaptic('light');
          onOpenHoroscopeLayer('work_money');
        },
      },
      {
        id: 'work',
        label: copy.stories.work,
        imageSrc: '/horoscope-moment-assets/04-work.webp',
        locked,
        onClick: () => {
          lumiaImpactHaptic('light');
          onOpenHoroscopeLayer('work_money');
        },
      },
      {
        id: 'rhythm',
        label: copy.stories.rhythm,
        imageSrc: '/horoscope-moment-assets/05-personal-rhythm.webp',
        locked,
        onClick: () => {
          lumiaImpactHaptic('light');
          onOpenHoroscopeLayer('chart');
        },
      },
    ],
    [copy.stories.love, copy.stories.money, copy.stories.rhythm, copy.stories.today, copy.stories.work, locked, onOpenHoroscopeLayer]
  );

  return (
    <>
      <motion.header className="lumia-home-top-cluster">
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
            style={{ opacity: storiesOpacity, y: storiesY, scale: storiesScale, pointerEvents: storiesPointerEvents, '--lumia-story-label-opacity': labelOpacity } as any}
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
      <div className="lumia-home-top-spacer" aria-hidden />
    </>
  );
}
