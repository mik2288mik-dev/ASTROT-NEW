import React, { useEffect } from 'react';
import {
  motion,
  useTransform,
} from 'framer-motion';
import type { NatalChartData, UserProfile } from '../../types';
import { getZodiacSign } from '../../constants';
import { getApproximateSunSignByDate } from '../../lib/zodiac-utils';
import { formatPassportBirthLine, getZodiacCardBackground } from '../../lib/zodiacCardBackgrounds';
import { captureLumiaHomeLayout } from '../../lib/lumiaDebug';
import { getLumiaHomeCopy, type LumiaHomeLanguage } from '../Dashboard/lumiaHomeContent';
import { useCollapsibleHeaderProgress } from './useCollapsibleHeaderProgress';

type UnifiedCollapsibleTopClusterProps = {
  profile: UserProfile;
  chartData?: NatalChartData | null;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
};

const EXPANDED_BODY_HEIGHT = 164;
const COLLAPSED_BODY_HEIGHT = 48;
const COLLAPSE_DISTANCE = 104;

function resolveSunSign(profile: UserProfile, chartData: NatalChartData | null | undefined) {
  if (chartData?.sun?.sign) return chartData.sun.sign;
  const [year, month, day] = (profile.birthDate || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return getApproximateSunSignByDate(year, month, day);
}

export function UnifiedCollapsibleTopCluster({
  profile,
  chartData,
  scrollRef,
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
  const [photoUrl, setPhotoUrl] = React.useState<string | null>(null);

  useEffect(() => {
    window.setTimeout(() => captureLumiaHomeLayout('home_header_mount'), 160);
  }, []);

  useEffect(() => {
    try {
      const tgUser = (window as any)?.Telegram?.WebApp?.initDataUnsafe?.user;
      setPhotoUrl(typeof tgUser?.photo_url === 'string' ? tgUser.photo_url : null);
    } catch {
      setPhotoUrl(null);
    }
  }, []);

  const expandedBrandOpacity = useTransform(visualProgress, [0, 0.24, 0.54], [1, 0.48, 0]);
  const expandedBrandY = useTransform(rawProgress, [0, 1], [0, -78]);
  const expandedBrandScale = useTransform(visualProgress, [0, 1], [1, 0.9]);
  const subtitleOpacity = useTransform(visualProgress, [0, 0.2, 0.42], [1, 0.28, 0]);
  const subtitleY = useTransform(rawProgress, [0, 1], [0, -12]);
  const passportOpacity = useTransform(visualProgress, [0, 0.38, 0.72], [1, 0.42, 0]);
  const passportY = useTransform(rawProgress, [0, 1], [0, -88]);
  const passportScale = useTransform(visualProgress, [0, 1], [1, 0.94]);
  const compactRowOpacity = useTransform(visualProgress, [0, 0.52, 0.78, 1], [0, 0, 0.88, 1]);
  const compactRowY = useTransform(rawProgress, [0, 1], [-5, 0]);
  const compactRowScale = useTransform(visualProgress, [0, 0.72, 1], [0.82, 0.94, 1]);

  const displayName = profile.name?.trim() || 'LUMIA';
  const initial = displayName.slice(0, 1).toUpperCase();
  const sunSign = resolveSunSign(profile, chartData);
  const signLabel = sunSign ? getZodiacSign(profile.language, sunSign) : (language === 'ru' ? 'Знак не указан' : 'Sign missing');
  const birthLine = formatPassportBirthLine(profile, language);
  const passportBackground = getZodiacCardBackground(
    sunSign,
    [profile.id, profile.birthDate, sunSign].filter(Boolean).join(':'),
  );
  const passportStyle = {
    '--lumia-passport-bg': passportBackground ? `url("${passportBackground}")` : 'none',
  } as React.CSSProperties;

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
            className="lumia-home-passport"
            style={{ opacity: passportOpacity, y: passportY, scale: passportScale }}
          >
            <div className="lumia-home-passport-card" style={passportStyle}>
              <div className="lumia-home-passport-avatar" aria-hidden>
                {photoUrl ? <img src={photoUrl} alt="" draggable={false} /> : <span>{initial}</span>}
              </div>
              <div className="lumia-home-passport-copy">
                <div className="lumia-home-passport-main">
                  <p className="lumia-home-passport-name">{displayName}</p>
                  <span className="lumia-home-passport-sign">{signLabel}</span>
                </div>
                <p className="lumia-home-passport-meta">{birthLine}</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.header>
      <div className="lumia-home-top-spacer" aria-hidden />
    </>
  );
}
