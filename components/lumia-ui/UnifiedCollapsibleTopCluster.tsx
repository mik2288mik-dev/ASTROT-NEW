import React, { useEffect, useMemo } from 'react';
import {
  motion,
  useTransform,
} from 'framer-motion';
import type { HoroscopeLayer, UserProfile } from '../../types';
import { lumiaImpactHaptic } from '../../lib/haptics';
import { captureLumiaHomeLayout } from '../../lib/lumiaDebug';
import { LumiaHomeQuickActionCard } from '../Dashboard/LumiaHomePrimitives';
import { getLumiaHomeCopy, type LumiaHomeLanguage } from '../Dashboard/lumiaHomeContent';
import { useCollapsibleHeaderProgress } from './useCollapsibleHeaderProgress';

type UnifiedCollapsibleTopClusterProps = {
  profile: UserProfile;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onOpenHoroscopeLayer: (layer: HoroscopeLayer) => void;
};

const EXPANDED_BODY_HEIGHT = 330;
const COLLAPSED_BODY_HEIGHT = 48;
const COLLAPSE_DISTANCE = 172;

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
  useEffect(() => {
    window.setTimeout(() => captureLumiaHomeLayout('home_header_mount'), 160);
  }, []);

  const expandedBrandOpacity = useTransform(visualProgress, [0, 0.24, 0.54], [1, 0.48, 0]);
  const expandedBrandY = useTransform(rawProgress, [0, 1], [0, -98]);
  const expandedBrandScale = useTransform(visualProgress, [0, 1], [1, 0.9]);
  const subtitleOpacity = useTransform(visualProgress, [0, 0.2, 0.42], [1, 0.28, 0]);
  const subtitleY = useTransform(rawProgress, [0, 1], [0, -12]);
  const actionsOpacity = useTransform(visualProgress, [0, 0.34, 0.64], [1, 0.36, 0]);
  const actionsY = useTransform(rawProgress, [0, 1], [0, -236]);
  const actionsScale = useTransform(visualProgress, [0, 1], [1, 0.68]);
  const actionsPointerEvents = useTransform(rawProgress, (latest) => (latest <= 0.56 ? 'auto' : 'none'));
  const compactRowOpacity = useTransform(visualProgress, [0, 0.52, 0.78, 1], [0, 0, 0.88, 1]);
  const compactRowY = useTransform(rawProgress, [0, 1], [-5, 0]);
  const compactRowScale = useTransform(visualProgress, [0, 0.72, 1], [0.82, 0.94, 1]);

  const actions = useMemo(
    () => [
      {
        id: 'today',
        title: copy.quickActions.today.title,
        imageSrc: '/lumia-home/quick-actions/horoscope-today.webp',
        onClick: () => {
          lumiaImpactHaptic('light');
          onOpenHoroscopeLayer('sign');
        },
      },
      {
        id: 'love',
        title: copy.quickActions.love.title,
        imageSrc: '/lumia-home/quick-actions/love.webp',
        onClick: () => {
          lumiaImpactHaptic('light');
          onOpenHoroscopeLayer('love');
        },
      },
      {
        id: 'money',
        title: copy.quickActions.money.title,
        imageSrc: '/lumia-home/quick-actions/money.webp',
        onClick: () => {
          lumiaImpactHaptic('light');
          onOpenHoroscopeLayer('work_money');
        },
      },
      {
        id: 'work',
        title: copy.quickActions.work.title,
        imageSrc: '/lumia-home/quick-actions/work.webp',
        onClick: () => {
          lumiaImpactHaptic('light');
          onOpenHoroscopeLayer('work_money');
        },
      },
      {
        id: 'rhythm',
        title: copy.quickActions.rhythm.title,
        imageSrc: '/lumia-home/quick-actions/personal-rhythm.webp',
        onClick: () => {
          lumiaImpactHaptic('light');
          onOpenHoroscopeLayer('chart');
        },
      },
    ],
    [
      copy.quickActions.love.title,
      copy.quickActions.money.title,
      copy.quickActions.rhythm.title,
      copy.quickActions.today.title,
      copy.quickActions.work.title,
      onOpenHoroscopeLayer,
    ]
  );

  return (
    <>
      <motion.header className="lumia-home-top-cluster">
        <div className="lumia-home-top-scene">
          <motion.div
            className="lumia-home-compact-row"
            style={{ opacity: compactRowOpacity, y: compactRowY, scale: compactRowScale }}
            aria-hidden
          >
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
            className="lumia-home-action-strip"
            style={{ opacity: actionsOpacity, y: actionsY, scale: actionsScale, pointerEvents: actionsPointerEvents }}
          >
            <div className="scrollbar-hide lumia-home-action-scroll">
              {actions.map((action) => (
                <LumiaHomeQuickActionCard
                  key={action.id}
                  title={action.title}
                  imageSrc={action.imageSrc}
                  active={action.id === 'today'}
                  onClick={action.onClick}
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
