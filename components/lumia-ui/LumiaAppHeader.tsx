import React, { useEffect, useState } from 'react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import type { RefObject } from 'react';
import type { UserProfile, ViewState } from '../../types';
import { getLumiaHomeCopy, type LumiaHomeLanguage } from '../Dashboard/lumiaHomeContent';

type LumiaAppHeaderProps = {
  profile: UserProfile;
  view: ViewState;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
};

const EXPANDED_BODY_HEIGHT = 112;
const COLLAPSED_BODY_HEIGHT = 48;
const COLLAPSE_DISTANCE = 108;

function clampProgress(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function LumiaAppHeader({
  profile,
  view,
  scrollContainerRef,
}: LumiaAppHeaderProps) {
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const node = scrollContainerRef?.current;
    if (!node) {
      progressValue.set(0);
      setIsCollapsed(false);
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const next = clampProgress(node.scrollTop / COLLAPSE_DISTANCE);
      progressValue.set(next);
      setIsCollapsed((current) => {
        const collapsed = next >= 0.92;
        return current === collapsed ? current : collapsed;
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
  }, [progressValue, scrollContainerRef, view]);

  const bodyHeight = useTransform(progressValue, [0, 1], [EXPANDED_BODY_HEIGHT, COLLAPSED_BODY_HEIGHT]);
  const headerHeight = useTransform(bodyHeight, (latest) => `calc(var(--lumia-app-safe-top) + ${latest}px)`);
  const bgOpacity = useTransform(progress, [0, 0.44, 1], [0, 0.16, 0.54]);
  const shadowOpacity = useTransform(progress, [0, 0.58, 1], [0, 0.04, 0.12]);
  const expandedOpacity = useTransform(progress, [0, 0.28, 0.62], [1, 0.5, 0]);
  const expandedY = useTransform(progress, [0, 1], [0, -30]);
  const expandedScale = useTransform(progress, [0, 1], [1, 0.92]);
  const taglineOpacity = useTransform(progress, [0, 0.2, 0.44], [1, 0.28, 0]);
  const taglineY = useTransform(progress, [0, 1], [0, -8]);
  const compactOpacity = useTransform(progress, [0, 0.52, 0.78, 1], [0, 0, 0.88, 1]);
  const compactY = useTransform(progress, [0, 0.6, 1], [-5, -5, 0]);
  const compactScale = useTransform(progress, [0, 0.72, 1], [0.9, 0.96, 1]);

  return (
    <motion.header
      className="lumia-app-header"
      data-view={view}
      data-collapsed={isCollapsed ? 'true' : undefined}
      style={{ height: headerHeight }}
    >
      <motion.div className="lumia-app-header-bg" style={{ opacity: bgOpacity }} aria-hidden />
      <motion.div className="lumia-app-header-shadow" style={{ opacity: shadowOpacity }} aria-hidden />

      <div className="lumia-app-header-canvas">
        <motion.div
          className="lumia-app-expanded-brand-layer"
          style={{ opacity: expandedOpacity, y: expandedY, scale: expandedScale }}
        >
          <div className="lumia-app-brand-center">
            <p className="lumia-app-logo">LUMIA</p>
            <motion.p className="lumia-app-tagline" style={{ opacity: taglineOpacity, y: taglineY }}>
              {copy.tagline}
            </motion.p>
          </div>
        </motion.div>

        <motion.div
          className="lumia-app-compact-brand-layer"
          style={{ opacity: compactOpacity, y: compactY, scale: compactScale }}
          aria-hidden
        >
          <p className="lumia-app-compact-logo">LUMIA</p>
        </motion.div>
      </div>
    </motion.header>
  );
}
