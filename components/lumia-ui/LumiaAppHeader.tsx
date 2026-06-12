import React from 'react';
import {
  motion,
  useTransform,
} from 'framer-motion';
import type { RefObject } from 'react';
import type { UserProfile, ViewState } from '../../types';
import { getLumiaHomeCopy, type LumiaHomeLanguage } from '../Dashboard/lumiaHomeContent';
import { useCollapsibleHeaderProgress } from './useCollapsibleHeaderProgress';

type LumiaAppHeaderProps = {
  profile: UserProfile;
  view: ViewState;
  scrollContainerRef?: RefObject<HTMLDivElement | null>;
};

const EXPANDED_BODY_HEIGHT = 64;
const COLLAPSED_BODY_HEIGHT = 48;
const COLLAPSE_DISTANCE = 64;

export function LumiaAppHeader({
  profile,
  view,
  scrollContainerRef,
}: LumiaAppHeaderProps) {
  const language: LumiaHomeLanguage = profile.language === 'en' ? 'en' : 'ru';
  const copy = getLumiaHomeCopy(language);
  const { rawProgress, visualProgress } = useCollapsibleHeaderProgress({
    scrollRef: scrollContainerRef,
    collapseDistance: COLLAPSE_DISTANCE,
    source: `app:${view}`,
    expandedBodyHeight: EXPANDED_BODY_HEIGHT,
    collapsedBodyHeight: COLLAPSED_BODY_HEIGHT,
    hapticEdges: true,
  });

  const expandedOpacity = useTransform(visualProgress, [0, 0.24, 0.54], [1, 0.48, 0]);
  const expandedY = useTransform(rawProgress, [0, 1], [0, -58]);
  const expandedScale = useTransform(visualProgress, [0, 1], [1, 0.92]);
  const taglineOpacity = useTransform(visualProgress, [0, 0.2, 0.42], [1, 0.28, 0]);
  const taglineY = useTransform(rawProgress, [0, 1], [0, -12]);
  // Compact wordmark only starts after the expanded one has fully faded (>0.54),
  // so the two "LUMIA" layers are never painted at the same time.
  const compactOpacity = useTransform(visualProgress, [0, 0.56, 0.82, 1], [0, 0, 0.88, 1]);
  const compactY = useTransform(rawProgress, [0, 1], [-5, 0]);
  const compactScale = useTransform(visualProgress, [0, 0.72, 1], [0.82, 0.94, 1]);
  // Hard on/off so neither layer ever overlaps the other, even mid-transition.
  const expandedVisibility = useTransform(visualProgress, (v) => (v < 0.55 ? 'visible' : 'hidden'));
  const compactVisibility = useTransform(visualProgress, (v) => (v >= 0.55 ? 'visible' : 'hidden'));

  return (
    <motion.header
      className="lumia-app-header"
      data-view={view}
    >
      <div className="lumia-app-header-canvas">
        <motion.div
          className="lumia-app-expanded-brand-layer"
          style={{ opacity: expandedOpacity, y: expandedY, scale: expandedScale, visibility: expandedVisibility }}
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
          style={{ opacity: compactOpacity, y: compactY, scale: compactScale, visibility: compactVisibility }}
          aria-hidden
        >
          <p className="lumia-app-compact-logo">LUMIA</p>
        </motion.div>
      </div>
    </motion.header>
  );
}
