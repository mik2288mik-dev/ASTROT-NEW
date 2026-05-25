import React, { useEffect } from 'react';
import {
  motion,
  useTransform,
} from 'framer-motion';
import { MoreHorizontal, Settings2, UserCircle } from 'lucide-react';
import type { UserProfile } from '../../types';
import { captureLumiaHomeLayout } from '../../lib/lumiaDebug';
import { LumiaHomeIconButton } from '../Dashboard/LumiaHomePrimitives';
import { getLumiaHomeCopy, type LumiaHomeLanguage } from '../Dashboard/lumiaHomeContent';
import { useCollapsibleHeaderProgress } from './useCollapsibleHeaderProgress';

type UnifiedCollapsibleTopClusterProps = {
  profile: UserProfile;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onOpenSettings?: () => void;
};

const EXPANDED_BODY_HEIGHT = 96;
const COLLAPSED_BODY_HEIGHT = 48;
const COLLAPSE_DISTANCE = 74;

export function UnifiedCollapsibleTopCluster({
  profile,
  scrollRef,
  onOpenSettings,
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
  const compactRowOpacity = useTransform(visualProgress, [0, 0.52, 0.78, 1], [0, 0, 0.88, 1]);
  const compactRowY = useTransform(rawProgress, [0, 1], [-5, 0]);
  const compactRowScale = useTransform(visualProgress, [0, 0.72, 1], [0.82, 0.94, 1]);

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
            className="lumia-home-top-actions"
            data-interactive="true"
            style={{ opacity: expandedBrandOpacity }}
          >
            <LumiaHomeIconButton
              className="lumia-home-header-avatar-button"
              aria-label={language === 'ru' ? 'Профиль' : 'Profile'}
              onClick={onOpenSettings}
            >
              {profile.name ? (
                <span className="text-[0.82rem] font-extrabold uppercase leading-none">
                  {profile.name.trim().slice(0, 1)}
                </span>
              ) : (
                <UserCircle size={17} strokeWidth={2.15} />
              )}
            </LumiaHomeIconButton>
            <LumiaHomeIconButton
              className="lumia-home-header-icon-button"
              aria-label={language === 'ru' ? 'Настройки' : 'Settings'}
              onClick={onOpenSettings}
            >
              <Settings2 size={17} strokeWidth={2.15} />
            </LumiaHomeIconButton>
            <LumiaHomeIconButton
              className="lumia-home-header-icon-button"
              aria-label={language === 'ru' ? 'Меню' : 'Menu'}
              onClick={onOpenSettings}
            >
              <MoreHorizontal size={18} strokeWidth={2.15} />
            </LumiaHomeIconButton>
          </motion.div>
        </div>
      </motion.header>
      <div className="lumia-home-top-spacer" aria-hidden />
    </>
  );
}
